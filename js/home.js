// Regras do painel que não dependem da tela. Ficam fora do carregamento da
// página para os testes (js/testes-painel.js) usarem exatamente as mesmas.
window.FinckPainel = (() => {
  const moeda = v => window.FinckUtils ? window.FinckUtils.moeda(v) : `R$ ${Number(v || 0).toFixed(2)}`;
  // Preferências do painel ficam no aparelho, separadas por pessoa: o que a
  // demonstração marcou não vale para a conta de verdade no mesmo navegador.
  const chave = (usuarioId, nome) => `finck.painel.${usuarioId || "anonimo"}.${nome}`;
  function lerLocal(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  }
  function gravarLocal(k, valor) {
    try {
      if (valor === null || valor === undefined) {
        localStorage.removeItem(k);
      } else {
        localStorage.setItem(k, String(valor));
      }
    } catch {}
  }
  // Análises que a própria pessoa salvou. A de exemplo da demonstração não
  // conta: quem abre a demo pela primeira vez ainda não decidiu nada.
  function analisesProprias(analises = [], {demo: demo = false, exemplo: exemplo = null} = {}) {
    const lista = analises || [];
    if (!demo || !exemplo) {
      return lista.length;
    }
    return lista.filter(a => !(a.item_name === exemplo.item_name && Number(a.price) === Number(exemplo.price))).length;
  }
  const mostrarFaixaInicio = ({dispensada: dispensada = false, concluida: concluida = false, proprias: proprias = 0} = {}) => !dispensada && !concluida && proprias === 0;
  // O convite de instalação só aparece depois de uma ação de valor (a
  // primeira análise salva) e, dispensado, espera 30 dias para voltar.
  const ESPERA_INSTALAR = 30 * 864e5;
  function deveConvidarInstalacao({instalado: instalado = false, podeConvidar: podeConvidar = false, proprias: proprias = 0, dispensadoEm: dispensadoEm = null, agora: agora = Date.now(), espera: espera = ESPERA_INSTALAR} = {}) {
    if (instalado || !podeConvidar || proprias < 1) {
      return false;
    }
    const quando = Number(dispensadoEm);
    return !(quando > 0 && agora - quando < espera);
  }
  // Complemento das pistas do Reality (pensadas para compras) com gastos do
  // dia a dia. É regra de palavras, não IA, e vale só como sugestão: a pessoa
  // confirma ao registrar ou troca a categoria antes.
  const FIM = "(?![\\p{L}\\p{N}])";
  const INICIO = "(?<![\\p{L}\\p{N}])";
  const pista = (categoria, termos) => [ categoria, new RegExp(`${INICIO}(${termos})s?${FIM}`, "iu") ];
  const PISTAS_DIA_A_DIA = [ pista("Alimentação", "almo[cç]o|jantar|janta|caf[eé] da manh[aã]|lanchonete|a[cç]a[ií]|sorvete|hortifruti|sacol[aã]o|rod[ií]zio|churrasco|salgado|quitanda"), pista("Moradia", "luz|energia|conta de [aá]gua|[aá]gua e esgoto|g[aá]s|internet|iptu|faxina|diarista"), pista("Transporte", "trem|bilhete [uú]nico|oficina|ipva|licenciamento"), pista("Saúde", "drogaria|hospital|vacina|fisioterapia|nutricionista"), pista("Educação", "escola|aula|matr[ií]cula"), pista("Lazer", "bar|barzinho|balada|clube|parque|museu|praia") ];
  function sugerirCategoria(descricao, {categorias: categorias = []} = {}) {
    const texto = String(descricao || "").normalize("NFC").trim();
    if (!texto) {
      return null;
    }
    const doReality = window.FinckReality && window.FinckReality.inferirCategoria ? window.FinckReality.inferirCategoria(texto) : null;
    const achada = doReality || (PISTAS_DIA_A_DIA.find(([, padrao]) => padrao.test(texto)) || [])[0] || null;
    if (!achada) {
      return null;
    }
    return !categorias.length || categorias.includes(achada) ? achada : null;
  }
  // Com contas cadastradas, todo lançamento diz onde o dinheiro está (ou
  // declara que fica fora delas). Para não travar o registro rápido, a conta
  // já vem escolhida: a última usada, a padrão ou a única ativa.
  const FORA_DAS_CONTAS = "__sem_conta";
  function contaInicial(contas = [], ultimaId = null) {
    const ativas = (contas || []).filter(c => c.active !== false);
    if (!ativas.length) {
      return "";
    }
    if (ultimaId === FORA_DAS_CONTAS) {
      return FORA_DAS_CONTAS;
    }
    const ultima = ultimaId ? ativas.find(c => String(c.id) === String(ultimaId)) : null;
    if (ultima) {
      return String(ultima.id);
    }
    const padrao = ativas.find(c => c.is_default);
    if (padrao) {
      return String(padrao.id);
    }
    return ativas.length === 1 ? String(ativas[0].id) : "";
  }
  // Sem contas cadastradas, "sem conta" em toda linha parece erro. A etiqueta
  // só aparece quando existem contas e o lançamento ficou sem dizer onde está.
  const mostrarSeloSemConta = (t, temContas) => Boolean(temContas && t && !t.account_id && !t.unallocated);
  function resumoGastos(doMesAtual = []) {
    const saidas = (doMesAtual || []).filter(t => t.type === "saida");
    const total = saidas.reduce((s, t) => s + Number(t.amount || 0), 0);
    const porCategoria = {};
    saidas.forEach(t => {
      const c = t.category || "Outros";
      porCategoria[c] = (porCategoria[c] || 0) + Number(t.amount || 0);
    });
    const [categoria, valor] = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0] || [];
    return {
      total: total,
      quantidade: saidas.length,
      maior: categoria ? {
        categoria: categoria,
        valor: valor,
        percentual: total > 0 ? valor / total * 100 : 0
      } : null
    };
  }
  // Falta dinheiro de verdade quando o caixa corrido (saldo, entradas e
  // saídas previstas na ordem das datas) fica negativo. Sem esse número,
  // vale a conta sem entradas, a mais cautelosa.
  function faltaDeVerdade(p = {}) {
    const caixa = p.caixaAposPrevisoes60Dias;
    if (caixa === null || caixa === undefined) {
      return false;
    }
    const menor = p.menorCaixaComEntradas60Dias;
    return (menor === null || menor === undefined ? caixa : menor) < 0;
  }
  // A previsão de 60 dias tem um status só, o mesmo no resumo, no cartão da
  // situação e na programação. Quando as saídas passam o saldo de hoje, mas
  // as entradas previstas chegam antes de faltar, o status é "Coberto pelas
  // entradas previstas" e o negativo fica só no detalhe ("Só com as
  // saídas"). Vermelho só quando falta de verdade.
  const COBERTO = "Coberto pelas entradas previstas";
  const SO_SAIDAS = "Só com as saídas";
  function statusPrevisao(projecoes = {}) {
    const p = projecoes || {};
    const caixa = p.caixaAposPrevisoes60Dias;
    const saldo = Number(p.saldoAtual) || 0;
    const entradas = Number(p.entradasPrevistas60Dias) || 0;
    if (caixa === null || caixa === undefined) {
      return { tipo: "sem-previsao", status: "", valor: null, soSaidas: null, entradas: 0, tom: saldo < 0 ? "alerta" : "neutro" };
    }
    const saidas = p.saidasPrevistas60Dias;
    if (saidas !== null && saidas !== undefined && Number(saidas) === 0) {
      return { tipo: "sem-saidas", status: "Nenhuma saída prevista", valor: saldo, soSaidas: null, entradas: entradas, tom: saldo < 0 ? "alerta" : "neutro" };
    }
    if (faltaDeVerdade(p)) {
      const menor = p.menorCaixaComEntradas60Dias;
      const comEntradas = entradas > 0 && menor !== null && menor !== undefined;
      return {
        tipo: "falta",
        status: "O saldo previsto fica negativo",
        valor: comEntradas ? Number(menor) : Number(caixa),
        soSaidas: Number(caixa),
        entradas: entradas,
        comEntradas: comEntradas,
        quando: p.descobertoEm60Dias instanceof Date ? p.descobertoEm60Dias : null,
        tom: "alerta"
      };
    }
    if (caixa < 0) {
      return { tipo: "coberto", status: COBERTO, valor: null, soSaidas: Number(caixa), entradas: entradas, tom: saldo < 0 ? "alerta" : "neutro" };
    }
    return { tipo: "saldo-cobre", status: "O saldo cobre as saídas previstas", valor: Number(caixa), soSaidas: Number(caixa), entradas: entradas, tom: saldo < 0 ? "alerta" : "ok" };
  }
  // A programação (js/programacao-home.js) fala em panorama; o status usa os
  // mesmos nomes de ctx.projecoes.
  const projecoesDoPanorama = (pan = {}) => ({
    saldoAtual: pan.saldo,
    caixaAposPrevisoes60Dias: pan.naoComprometido,
    saidasPrevistas60Dias: pan.comprometidoTotal,
    entradasPrevistas60Dias: pan.entradasPrevistas,
    menorCaixaComEntradas60Dias: pan.menorCaixaComEntradas,
    descobertoEm60Dias: pan.descobertoComEntradasEm || null
  });
  // "Como estou?": o dinheiro registrado e, ao lado, o status da previsão.
  function respostaComoEstou(projecoes = {}) {
    const p = projecoes || {};
    const saldo = Number(p.saldoAtual) || 0;
    const s = statusPrevisao(p);
    const notas = {
      "sem-previsao": "Registrado até hoje.",
      "sem-saidas": "Registrado até hoje. Nenhuma saída prevista nos próximos 60 dias.",
      coberto: `Registrado até hoje. Previsão de 60 dias: ${COBERTO.toLowerCase()}.`,
      falta: s.comEntradas ? `Registrado até hoje. Mesmo com as entradas previstas, o saldo chega a ${moeda(s.valor)} nos próximos 60 dias.` : `Registrado até hoje. Depois das saídas previstas em 60 dias: ${moeda(s.valor)}.`,
      "saldo-cobre": `Registrado até hoje. Depois das saídas previstas em 60 dias: ${moeda(s.valor)}.`
    };
    return {
      valor: moeda(saldo),
      nota: notas[s.tipo],
      tom: s.tom,
      status: s.tipo
    };
  }
  // "Atenção necessária": alertas viram tarefas com um verbo concreto.
  function tarefasDoPainel(ctx = {}, {acompanhar: acompanhar = []} = {}) {
    const tarefas = [];
    const renda = Number(ctx.perfil?.income_monthly) || 0;
    if (!(renda > 0)) {
      tarefas.push({
        nivel: "alerta",
        texto: "Sem renda mensal, o FinCK não converte compras em horas de trabalho.",
        acao: "Informar minha renda",
        href: "perfil.html"
      });
    }
    if (ctx.semFolga) {
      tarefas.push({
        nivel: "alerta",
        texto: `Suas despesas fixas passam da renda em ${moeda(ctx.deficitFixos)} por mês.`,
        acao: "Revisar despesas fixas",
        href: "recorrentes.html"
      });
    }
    const p = ctx.projecoes || {};
    const caixa = p.caixaAposPrevisoes60Dias;
    const temCaixa = caixa !== null && caixa !== undefined;
    if (faltaDeVerdade(p)) {
      const menor = p.menorCaixaComEntradas60Dias;
      const entradas = Number(p.entradasPrevistas60Dias) || 0;
      const quando = p.descobertoEm60Dias instanceof Date ? ` a partir de ${p.descobertoEm60Dias.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit"
      })}` : "";
      tarefas.push({
        nivel: "alerta",
        texto: entradas > 0 && menor !== null && menor !== undefined ? `Se nada mudar, mesmo com as entradas previstas, o saldo fica negativo nos próximos 60 dias${quando}: chega a ${moeda(menor)}.` : `Se nada mudar, as saídas previstas para os próximos 60 dias passam o seu saldo de hoje em ${moeda(-caixa)}.`,
        acao: "Ver a programação",
        href: "#programacaoFinanceira"
      });
    } else if (!(temCaixa && caixa < 0) && (p.saldoAposParcelas ?? ctx.disponivelProjetado) < 0) {
      tarefas.push({
        nivel: "alerta",
        texto: `As parcelas que faltam pagar somam ${moeda(-(p.saldoAposParcelas ?? ctx.disponivelProjetado))} a mais que o seu saldo.`,
        acao: "Ver parcelas",
        href: "planejamento.html"
      });
    }
    if (acompanhar.length) {
      const a = acompanhar[0];
      tarefas.push({
        nivel: "info",
        texto: acompanhar.length === 1 ? `Faz mais de 30 dias que você analisou "${a.item_name}". O que aconteceu depois?` : `${acompanhar.length} decisões de compra completaram 30 dias. O que aconteceu depois?`,
        acao: "Contar o que aconteceu",
        href: "decisoes.html"
      });
    }
    const temContas = (ctx.contas || []).some(c => c.active !== false);
    const semConta = temContas ? (ctx.transacoesRealizadas || []).filter(t => !t.account_id && !t.unallocated).length : 0;
    if (semConta) {
      tarefas.push({
        nivel: "info",
        texto: `${semConta} movimentação(ões) ainda sem conta: o saldo geral e a soma das contas não fecham.`,
        acao: "Conferir contas",
        href: "contas.html"
      });
    }
    return tarefas;
  }
  // "Próximo passo": uma ação só, e só quando há algo a fazer. Previsões
  // vencidas vêm antes, porque mudam os outros números assim que a pessoa
  // responde. Sem nada relevante, uma frase neutra e nenhum botão.
  const SEM_PENDENCIA = "Nenhuma pendência agora.";
  function proximoPasso({pendentes: pendentes = [], tarefas: tarefas = [], metas: metas = []} = {}) {
    if (pendentes.length) {
      return {
        texto: pendentes.length === 1 ? `1 previsão venceu: ${pendentes[0].description}.` : `${pendentes.length} previsões venceram.`,
        nota: "Diga se aconteceram.",
        acao: "Revisar agora",
        tipo: "revisar"
      };
    }
    const tarefa = tarefas.find(t => t.nivel === "alerta") || tarefas[0];
    if (tarefa) {
      return {
        texto: tarefa.texto,
        nota: "",
        acao: tarefa.acao,
        href: tarefa.href
      };
    }
    if (!(metas || []).length) {
      return {
        texto: "Você ainda não definiu uma meta.",
        nota: "Com uma meta, cada análise mostra quanto a compra atrasa o que importa para você.",
        acao: "Criar meta",
        href: "metas.html#nova"
      };
    }
    // O progresso das metas não é um passo a dar: ele está em "Suas metas".
    return {
      texto: SEM_PENDENCIA,
      nota: "",
      acao: null,
      href: null,
      tipo: "neutro"
    };
  }
  // Conta real que ainda não registrou nada: em vez de uma parede de zeros,
  // o painel mostra por onde começar. A demonstração nunca cai aqui (tem
  // dados de exemplo) e qualquer registro desfaz o estado.
  function contaSemDados(ctx = {}) {
    const c = ctx || {};
    const vazia = k => !(c[k] || []).length;
    return [ "todasTransacoes", "recorrentes", "parcelamentos", "metas", "analises", "contas" ].every(vazia) && Math.abs(Number(c.saldo) || 0) < .005;
  }
  // Atalhos de "Mais ferramentas": quatro por tarefa à vista e o resto em
  // "Ver todas", separado pelas famílias de FinckNav.FAMILIAS (js/nav.js).
  const ATALHOS = [
    { href: "analises.html", tarefa: "Ver para onde vai o dinheiro", nome: "Análises", icone: "analises", familia: "financas", principal: true },
    { href: "recorrentes.html", tarefa: "Cadastrar contas de todo mês", nome: "Recorrentes", icone: "recorrentes", familia: "financas", principal: true },
    { href: "planejamento.html", tarefa: "Acompanhar parcelas", nome: "Planejamento", icone: "planejamento", familia: "financas", principal: true },
    { href: "decisoes.html", tarefa: "Rever minhas decisões de compra", nome: "Decisões", icone: "decisoes", familia: "reality", principal: true },
    { href: "contas.html", tarefa: "Onde seu dinheiro está", nome: "Contas", icone: "contas", familia: "financas" },
    { href: "assistente.html", tarefa: "Prioridades e próximas ações", nome: "Revisão financeira", icone: "revisao", familia: "financas" },
    { href: "relatorios.html", tarefa: "Fechamento do mês e exportação", nome: "Relatórios", icone: "relatorios", familia: "financas" },
    { href: "gamificacao.html", tarefa: "Conquistas e hábitos", nome: "Jornada", icone: "jornada", familia: "financas" },
    { href: "cenarios.html", tarefa: "Comparar formas de decidir", nome: "Cenários", icone: "cenarios", familia: "reality" },
    { href: "locais.html", tarefa: "Conserto, usado, troca, doação e descarte", nome: "Alternativas perto de você", icone: "locais", familia: "reality" }
  ];
  const atalhosDaHome = (lista = ATALHOS) => ({
    visiveis: lista.filter(a => a.principal),
    todas: lista.filter(a => !a.principal)
  });
  // Texto pronto para innerHTML com o valor negativo inteiro numa linha só:
  // o "-" sozinho no fim da linha fazia o valor parecer positivo.
  function semQuebrarNegativo(texto) {
    const esc = window.FinckUtils ? window.FinckUtils.escapeHTML(String(texto || "")) : String(texto || "");
    return esc.replace(/-R\$[\s\u00a0]?[\d.,]+/g, v => `<span class="valor-junto">${v}</span>`);
  }
  const textoRegistrado = ({tipo: tipo, valor: valor, descricao: descricao}) => `✓ ${tipo === "entrada" ? "Entrada" : "Saída"} registrada: ${moeda(valor)}, ${String(descricao || "").trim()}`;
  // Seções recolhíveis: fechadas só na primeira visita. Para quem já usa o
  // app (voltou à home ou já salvou uma análise), abertas. Depois que a
  // pessoa abre ou fecha uma, vale a escolha dela.
  let abertasPorPadrao = false;
  function iniciarRecolhiveis(usuarioId) {
    abertasPorPadrao = lerLocal(chave(usuarioId, "visitou")) === "1" || lerLocal(chave(usuarioId, "inicio-concluido")) === "1";
    gravarLocal(chave(usuarioId, "visitou"), "1");
    return abertasPorPadrao;
  }
  function ligarRecolhiveis(raiz, usuarioId, {abertas: abertas = abertasPorPadrao} = {}) {
    (raiz || document).querySelectorAll("details[data-recolhivel]").forEach(det => {
      if (det.dataset.recolhivelLigado) {
        return;
      }
      det.dataset.recolhivelLigado = "1";
      const k = chave(usuarioId, `aberto.${det.dataset.recolhivel}`);
      const salvo = lerLocal(k);
      // "Ver todas as ferramentas" começa fechado para todo mundo: abrir
      // sozinho desfaria a separação entre atalhos e o resto.
      det.open = salvo === "1" || salvo === "0" ? salvo === "1" : abertas && det.dataset.recolhivelPadrao !== "fechado";
      det.addEventListener("toggle", () => gravarLocal(k, det.open ? "1" : "0"));
    });
  }
  // A primeira análise própria conta como uso: abre o que a pessoa ainda
  // não abriu nem fechou.
  function abrirRecolhiveisSemEscolha(raiz, usuarioId) {
    abertasPorPadrao = true;
    (raiz || document).querySelectorAll("details[data-recolhivel]").forEach(det => {
      if (lerLocal(chave(usuarioId, `aberto.${det.dataset.recolhivel}`)) === null && det.dataset.recolhivelPadrao !== "fechado") {
        det.open = true;
      }
    });
  }
  return {
    chave: chave,
    lerLocal: lerLocal,
    gravarLocal: gravarLocal,
    analisesProprias: analisesProprias,
    mostrarFaixaInicio: mostrarFaixaInicio,
    deveConvidarInstalacao: deveConvidarInstalacao,
    ESPERA_INSTALAR: ESPERA_INSTALAR,
    sugerirCategoria: sugerirCategoria,
    FORA_DAS_CONTAS: FORA_DAS_CONTAS,
    contaInicial: contaInicial,
    mostrarSeloSemConta: mostrarSeloSemConta,
    resumoGastos: resumoGastos,
    faltaDeVerdade: faltaDeVerdade,
    COBERTO: COBERTO,
    SO_SAIDAS: SO_SAIDAS,
    statusPrevisao: statusPrevisao,
    projecoesDoPanorama: projecoesDoPanorama,
    respostaComoEstou: respostaComoEstou,
    tarefasDoPainel: tarefasDoPainel,
    SEM_PENDENCIA: SEM_PENDENCIA,
    proximoPasso: proximoPasso,
    contaSemDados: contaSemDados,
    ATALHOS: ATALHOS,
    atalhosDaHome: atalhosDaHome,
    semQuebrarNegativo: semQuebrarNegativo,
    textoRegistrado: textoRegistrado,
    iniciarRecolhiveis: iniciarRecolhiveis,
    ligarRecolhiveis: ligarRecolhiveis,
    abrirRecolhiveisSemEscolha: abrirRecolhiveisSemEscolha
  };
})();

document.addEventListener("DOMContentLoaded", async () => {
  if (document.body.dataset.page !== "home") {
    return;
  }
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const T = window.FinckTempo;
  const F = window.FinckFinance;
  const R = window.FinckReality;
  const G = window.FinckGame;
  const PN = window.FinckPainel;
  const $ = id => document.getElementById(id);
  // Outras partes da home (revisão de previsões, programação) pedem para
  // redesenhar antes de a página terminar de carregar: o pedido espera.
  let marcarPronto;
  const pronto = new Promise(r => {
    marcarPronto = r;
  });
  window.FinckHome = {
    recarregar: () => pronto.then(() => render())
  };
  desenharAtalhos();
  const user = await window.FinckNav.iniciarPagina({
    titulo: "FinCK",
    subtitulo: "Consumo consciente"
  });
  if (!user) {
    return;
  }
  const chave = nome => PN.chave(user.id, nome);
  const emDemo = () => Boolean(S.emDemo && S.emDemo());
  let ctxAtual = null;
  let geracao = 0;
  PN.iniciarRecolhiveis(user.id);
  PN.ligarRecolhiveis(document, user.id);

  async function render() {
    const minha = ++geracao;
    const ctx = await F.carregarContexto();
    // Só a leitura mais recente desenha: duas atualizações seguidas não
    // podem deixar números de momentos diferentes na mesma tela.
    if (minha !== geracao) {
      return;
    }
    ctxAtual = ctx;
    // Conta sem nenhum registro: o começo no lugar das perguntas, e as seções
    // que só teriam zeros ficam fora (css/painel.css, .painel--vazio).
    const vazia = PN.contaSemDados(ctx);
    document.body.classList.toggle("painel--vazio", vazia);
    $("painelComeco").hidden = !vazia;
    $("painelPerguntas").hidden = vazia;
    $("painelRegistro").hidden = vazia;
    // Dados de exemplo identificados uma vez, no topo do resumo.
    $("seloExemplo").hidden = !emDemo() || vazia;
    window.FinckProgramacaoHome?.desenhar?.(ctx.programacao, {
      usuarioId: user.id
    });
    const pendentes = window.FinckOcorrencias ? window.FinckOcorrencias.pendentes(ctx.ocorrencias || []) : [];
    if (!pendentes.length && $("avisoRevisao")) {
      $("avisoRevisao").hidden = true;
    }
    const tarefas = PN.tarefasDoPainel(ctx, {
      acompanhar: R.paraAcompanhar(ctx.analises)
    });
    const proprias = PN.analisesProprias(ctx.analises, {
      demo: emDemo(),
      exemplo: F.FIXTURE_DEMO?.analise
    });
    renderTopo(ctx, tarefas, pendentes);
    renderFaixaInicio(proprias);
    window.FinckInstalarHome?.avaliar?.({
      proprias: proprias
    });
    renderSituacao(ctx);
    await renderContas(ctx);
    renderTarefas(tarefas);
    renderRevisao(ctx);
    renderOrcamento(ctx);
    renderMetas(ctx);
    renderMovimentos(ctx);
    await renderInterpretacao(ctx);
    prepararRegistro(ctx);
  }

  function renderTopo(ctx, tarefas, pendentes) {
    const como = PN.respostaComoEstou(ctx.projecoes);
    const valorComo = $("respostaComoEstou");
    valorComo.textContent = como.valor;
    valorComo.classList.toggle("cor-vermelha", (ctx.projecoes?.saldoAtual ?? ctx.saldo) < 0);
    $("notaComoEstou").innerHTML = PN.semQuebrarNegativo(como.nota);
    $("notaComoEstou").dataset.tom = como.tom;
    const gastos = PN.resumoGastos(ctx.doMesAtual);
    if (gastos.quantidade) {
      $("respostaParaOnde").textContent = `${U.moeda(gastos.total)} gastos este mês`;
      $("notaParaOnde").textContent = gastos.maior ? `Maior parte: ${gastos.maior.categoria}, ${U.moeda(gastos.maior.valor)} (${U.percentual(gastos.maior.percentual, 0)}).` : "";
      $("acaoParaOnde").innerHTML = `<a class="link-mais painel-pergunta__acao" href="analises.html">Ver gastos</a>`;
    } else {
      // "Registrar gasto" está logo abaixo das perguntas: aqui, só o fato.
      $("respostaParaOnde").textContent = "Nenhum gasto registrado este mês";
      $("notaParaOnde").textContent = "";
      $("acaoParaOnde").innerHTML = "";
    }
    const passo = PN.proximoPasso({
      pendentes: pendentes,
      tarefas: tarefas,
      metas: ctx.metas
    });
    $("respostaAgora").textContent = passo.texto;
    $("respostaAgora").dataset.tipo = passo.tipo || "";
    $("notaAgora").textContent = passo.nota;
    $("acaoAgora").innerHTML = !passo.acao ? "" : passo.tipo === "revisar" ? `<button type="button" class="link-mais painel-pergunta__acao" data-revisar>${U.escapeHTML(passo.acao)}</button>` : `<a class="link-mais painel-pergunta__acao" href="${U.escapeHTML(passo.href)}">${U.escapeHTML(passo.acao)}</a>`;
    $("acaoAgora").querySelector("[data-revisar]")?.addEventListener("click", () => {
      window.FinckRevisao?.abrir(pendentes, {
        aoTerminar: () => window.FinckHome.recarregar()
      });
    });
    $("painelPerguntas").setAttribute("aria-busy", "false");
  }

  function renderFaixaInicio(proprias) {
    if (proprias > 0 && PN.lerLocal(chave("inicio-concluido")) !== "1") {
      PN.gravarLocal(chave("inicio-concluido"), "1");
      PN.abrirRecolhiveisSemEscolha(document, user.id);
    }
    // Com a conta vazia, o começo do resumo já diz por onde ir: uma dica só.
    $("faixaInicio").hidden = document.body.classList.contains("painel--vazio") || !PN.mostrarFaixaInicio({
      dispensada: PN.lerLocal(chave("inicio-dispensado")) === "1",
      concluida: PN.lerLocal(chave("inicio-concluido")) === "1",
      proprias: proprias
    });
  }
  $("btnDispensarInicio").addEventListener("click", () => {
    PN.gravarLocal(chave("inicio-dispensado"), "1");
    $("faixaInicio").hidden = true;
    // O foco não pode sumir junto com a faixa.
    document.querySelector(".reality-cta__acoes .btn-primario")?.focus();
  });

  // Cada número com o seu nome, a sua janela e se é dinheiro registrado ou
  // previsão. Nenhum card responde a mesma pergunta que outro.
  function renderSituacao(ctx) {
    const p = ctx.projecoes || F.projecoesDe({
      saldo: ctx.saldo,
      renda: ctx.renda,
      despesasFixas: ctx.despesasFixas,
      parcelasAPagar: ctx.compromissosAbertos
    });
    $("saldoAtual").textContent = U.moeda(p.saldoAtual);
    $("entradasMes").textContent = U.moeda(ctx.entradasMes);
    $("saidasMes").textContent = U.moeda(ctx.saidasMes);
    const sobra = $("rendaLivre");
    sobra.textContent = U.moeda(p.sobraRendaAposFixos);
    sobra.classList.toggle("cor-vermelha", p.sobraRendaAposFixos < 0);
    const caixa = $("caixa60");
    const temCaixa = p.caixaAposPrevisoes60Dias !== null && p.caixaAposPrevisoes60Dias !== undefined;
    $("cardCaixa60").hidden = !temCaixa;
    if (temCaixa) {
      const pan = ctx.programacao;
      const dataCurta = d => d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit"
      });
      const ate = pan?.limite ? dataCurta(pan.limite) : null;
      const s = PN.statusPrevisao(p);
      $("rotuloCaixa60").textContent = s.tipo === "falta" && s.comEntradas ? "Menor saldo previsto" : "Caixa depois das saídas previstas";
      $("janelaCaixa60").textContent = ate ? `próximos ${p.janelaDias} dias, até ${ate}` : `próximos ${p.janelaDias} dias`;
      // Um status só: o número principal ou, quando as entradas cobrem, a
      // frase do status. O negativo "só com as saídas" fica no detalhe.
      caixa.textContent = s.valor === null ? s.status : U.moeda(s.valor);
      caixa.classList.toggle("projecao__status", s.valor === null);
      caixa.classList.toggle("cor-vermelha", s.tipo === "falta");
      const saidas = U.moeda(p.saidasPrevistas60Dias);
      const entradas = s.entradas > 0 ? U.moeda(s.entradas) : null;
      const detalhe = {
        "sem-saidas": "Nenhuma saída prevista no período: o caixa é o saldo atual.",
        "saldo-cobre": `Saldo atual menos ${saidas} em contas fixas, parcelas e agendados: o saldo cobre as saídas previstas.${entradas ? ` Não soma as entradas previstas (${entradas}).` : ""}`,
        coberto: `${PN.SO_SAIDAS}: ${U.moeda(s.soSaidas)}. Com as entradas previstas (${entradas}) na ordem das datas, o saldo não fica negativo.`,
        falta: s.comEntradas ? `Menor saldo previsto, mesmo com as entradas previstas (${entradas})${s.quando ? `, a partir de ${dataCurta(s.quando)}` : ""}. ${PN.SO_SAIDAS}: ${U.moeda(s.soSaidas)}.` : `Saldo atual menos ${saidas} em saídas previstas. Não há entradas previstas no período.`
      };
      $("explicaCaixa60").innerHTML = PN.semQuebrarNegativo(detalhe[s.tipo] || "");
    }
    $("cardParcelas").hidden = !(p.parcelasAPagar > 0);
    $("parcelasAPagar").textContent = U.moeda(p.parcelasAPagar);
    $("notaSaldo").textContent = ctx.origemSaldo?.nota || "";
    const notaFolga = $("notaFolga");
    notaFolga.textContent = ctx.semFolga ? `Suas despesas fixas consomem toda a renda do mês: faltam ${U.moeda(ctx.deficitFixos)}. O que você gastar agora sai do caixa acumulado, não da renda deste mês.` : "";
    notaFolga.classList.toggle("nota-saldo--alerta", Boolean(ctx.semFolga));
    const dias = Number(ctx.perfil?.work_days_month) || cfg.PADRAO.work_days_month;
    const horas = Number(ctx.perfil?.work_hours_day) || cfg.PADRAO.work_hours_day;
    const valorDia = (Number(ctx.perfil?.income_monthly) || 0) / dias;
    $("valorDia").textContent = U.moeda(valorDia);
    $("valorHora").textContent = U.moeda(valorDia / horas);
  }

  async function renderContas(ctx) {
    const CT = window.FinckContas;
    const contas = ctx.contas || [];
    const temContas = contas.some(c => c.active !== false);
    if (!temContas) {
      const comLancamentos = (ctx.transacoesRealizadas || []).length > 0;
      // Um único aviso aqui substitui a etiqueta "sem conta" em cada linha.
      const aviso = !comLancamentos ? "" : emDemo() ? `<p class="nota nota--sem-contas"><strong>Demonstração sem contas bancárias.</strong> O saldo do exemplo é controlado pelo perfil e os lançamentos ainda não foram distribuídos por conta.</p>` : `<p class="nota nota--sem-contas">Sem contas cadastradas, o saldo vem do seu perfil e os lançamentos ficam só no saldo geral. Não é um erro: as contas são opcionais.</p>`;
      $("cardContas").innerHTML = `\n        <article class="card-contas vazio--guia">\n          <div class="card-contas__topo"><h3>Minhas contas</h3></div>\n          <p class="descricao">Contas mostram <strong>onde</strong> o seu saldo está: banco, carteira digital ou dinheiro em espécie. Assim fica fácil conferir com o extrato do banco.</p>\n          ${aviso}\n          <p class="nota">O FinCK não acessa seu banco: você informa e edita quando quiser.</p>\n          <a class="btn-secundario" href="contas.html">Adicionar minha primeira conta</a>\n        </article>`;
      return;
    }
    const [transferencias, ajustes] = await Promise.all([ S.listar("transfers"), S.listar("balance_adjustments") ]);
    const resumoContas = CT.consolidado(contas, {
      transacoes: ctx.transacoesRealizadas,
      transferencias: transferencias,
      ajustes: ajustes
    });
    const orfaos = CT.semConta(ctx.transacoesRealizadas);
    const diferenca = ctx.saldo - resumoContas.disponivel;
    const conciliacao = Math.abs(diferenca) >= .01 ? `<p class="nota nota--conciliacao">\n           O saldo geral (${U.moeda(ctx.saldo)}) e a soma das contas (${U.moeda(resumoContas.disponivel)})\n           diferem em ${U.moeda(Math.abs(diferenca))}${orfaos ? ` porque ${orfaos} lançamento(s) ainda não têm conta` : " por causa de ajustes de saldo"}.\n           <a href="contas.html">Conferir</a>\n         </p>` : `<p class="nota">Saldo geral e soma das contas estão conciliados.</p>`;
    $("cardContas").innerHTML = `<article class="card-contas">\n         <div class="card-contas__topo">\n           <h3>Minhas contas</h3>\n           <span class="card-contas__total ${resumoContas.disponivel < 0 ? "cor-vermelha" : "cor-verde"}">${U.moeda(resumoContas.disponivel)}</span>\n         </div>\n         <p class="descricao">${resumoContas.quantidade} conta(s) ativa(s)${orfaos ? ` · ${orfaos} lançamento(s) sem conta` : ""}</p>\n         ${conciliacao}\n         ${resumoContas.contas.slice(0, 3).map(c => `\n           <div class="card-contas__linha">\n             <span class="ponto-banco" style="--cor:${U.escapeHTML(c.instituicao.cor)}"></span>\n             <span>${U.escapeHTML(c.name)}</span>\n             <strong class="${c.saldo < 0 ? "cor-vermelha" : ""}">${U.moeda(c.saldo)}</strong>\n           </div>`).join("")}\n         <a class="link-mais" href="contas.html">Ver contas</a>\n       </article>`;
  }

  function renderTarefas(tarefas) {
    const host = $("tarefasHome");
    const item = t => `\n      <li class="tarefa tarefa--${t.nivel}">\n        <span class="tarefa__texto">${U.escapeHTML(t.texto)}</span>\n        <a class="btn-secundario btn-mini" href="${U.escapeHTML(t.href)}">${U.escapeHTML(t.acao)}</a>\n      </li>`;
    // Sem tarefa, a seção some (css/clareza.css); a frase neutra fica para
    // navegadores sem :has().
    host.innerHTML = tarefas.length ? tarefas.slice(0, 4).map(item).join("") : `\n      <li class="tarefa tarefa--em-dia">\n        <span class="tarefa__texto">${U.escapeHTML(PN.SEM_PENDENCIA)}</span>\n      </li>`;
  }

  // A Revisão financeira é calculada pelas regras do FinCK
  // (diagnostico-engine.js). Nada aqui chama IA.
  function renderRevisao(ctx) {
    const D = window.FinckDiagnostico;
    const host = $("sinaisAssistente");
    if (!D || !host) {
      return;
    }
    const d = D.diagnosticar(ctx);
    $("resumoAssistente").textContent = d.resumo;
    host.innerHTML = d.prioridades.slice(0, 2).map(p => `\n      <li class="sinal sinal--${U.escapeHTML(p.nivel)}"><span class="sinal__ponto" aria-hidden="true"></span>${U.escapeHTML(p.titulo)}</li>`).join("");
  }

  // Atalhos de "Mais ferramentas" (FinckPainel.ATALHOS): quatro por tarefa à
  // vista; o resto, por família, dentro de "Ver todas as ferramentas".
  function desenharAtalhos() {
    const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const ICONES = {
      analises: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4v8l6 4"/>'),
      recorrentes: svg('<path d="M4 7h11a3 3 0 0 1 3 3v1"/><path d="M15 4l3 3-3 3"/><path d="M20 17H9a3 3 0 0 1-3-3v-1"/><path d="M9 20l-3-3 3-3"/>'),
      planejamento: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 15h2M14 15h2"/>'),
      decisoes: svg('<path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
      contas: svg('<rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="M2.5 10h19"/><path d="M6 14.5h4"/>'),
      revisao: svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3.5h6v3H9z"/><path d="M9 13.5l2 2 4-4"/>'),
      relatorios: svg('<path d="M5 20V11"/><path d="M12 20V4"/><path d="M19 20v-7"/>'),
      jornada: svg('<path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M12 13v3"/><path d="M8.5 20h7l-1-3.5h-5z"/>'),
      cenarios: svg('<path d="M12 3v5"/><path d="M12 8 6 13v8"/><path d="M12 8l6 5v8"/><circle cx="12" cy="3" r="1.6"/><circle cx="6" cy="21" r="1.6"/><circle cx="18" cy="21" r="1.6"/>'),
      locais: svg('<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>')
    };
    const item = (a, titulo, nota) => `<li><a href="${U.escapeHTML(a.href)}"><span class="atalho-icone" aria-hidden="true">${ICONES[a.icone] || ""}</span><span><strong>${U.escapeHTML(titulo)}</strong><small>${U.escapeHTML(nota)}</small></span></a></li>`;
    const {visiveis: visiveis, todas: todas} = PN.atalhosDaHome();
    const hostTarefas = $("atalhosTarefas");
    if (hostTarefas) {
      hostTarefas.innerHTML = visiveis.map(a => item(a, a.tarefa, a.nome)).join("");
    }
    const hostTodas = $("atalhosTodas");
    if (!hostTodas) {
      return;
    }
    const familias = window.FinckNav?.FAMILIAS || {};
    hostTodas.innerHTML = Object.entries(familias).map(([id, f]) => {
      const lista = todas.filter(a => a.familia === id);
      if (!lista.length) {
        return "";
      }
      return `\n      <div class="mais-ferramentas__familia" data-familia="${U.escapeHTML(id)}">\n        <h3 class="mais-ferramentas__familia-titulo" id="familia-${U.escapeHTML(id)}">${U.escapeHTML(f.rotulo)} <small>${U.escapeHTML(f.descricao)}</small></h3>\n        <ul class="mais-ferramentas__lista" aria-labelledby="familia-${U.escapeHTML(id)}">${lista.map(a => item(a, a.nome, a.tarefa)).join("")}</ul>\n      </div>`;
    }).join("");
  }

  // Mesma base do card "Sobra da renda após fixos": renda do perfil menos
  // despesas fixas. Antes este bloco usava as entradas recorrentes e podia
  // mostrar uma sobra diferente da do card logo acima.
  function renderOrcamento(ctx) {
    const renda = Number(ctx.renda) || 0;
    const fixas = Number(ctx.despesasFixas) || 0;
    const sobra = ctx.projecoes ? ctx.projecoes.sobraRendaAposFixos : renda - fixas;
    const comprometido = renda > 0 ? fixas / renda * 100 : 0;
    const entradasRecorrentes = Number(ctx.previstoEntradas) || 0;
    const fechamento = comprometido > 100 ? ": as fixas passaram da renda." : comprometido === 100 ? ": exatamente no limite, sem folga." : ".";
    $("orcamento").innerHTML = `\n      <ul class="lista-resumo">\n        <li><span>Renda do mês (do seu perfil)</span><strong class="cor-verde">${U.moeda(renda)}</strong></li>\n        <li><span>Despesas fixas previstas</span><strong class="cor-vermelha">${U.moeda(fixas)}</strong></li>\n        <li><span>Sobra da renda após fixos</span><strong class="${sobra < 0 ? "cor-vermelha" : ""}">${U.moeda(sobra)}</strong></li>\n      </ul>\n      <div class="barra" role="img" aria-label="${U.percentual(comprometido, 0)} da renda comprometida com despesas fixas">\n        <div class="barra-preenchida" style="width:${Math.min(100, comprometido)}%"></div>\n      </div>\n      <p class="nota">${renda > 0 ? `${U.percentual(comprometido, 1)} da renda já está comprometida com despesas fixas${fechamento}` : "Informe a sua renda no Perfil para ver quanto dela as despesas fixas ocupam."}</p>\n      ${entradasRecorrentes > 0 && Math.abs(entradasRecorrentes - renda) >= .01 ? `<p class="nota">Suas entradas recorrentes somam ${U.moeda(entradasRecorrentes)} por mês; as contas do FinCK usam a renda do perfil. <a href="perfil.html">Conferir no Perfil</a></p>` : ""}\n      <p class="nota">Estes valores são previsão do mês, não o que já saiu da conta.</p>`;
  }

  function renderMetas(ctx) {
    const host = $("metasResumo");
    const metas = ctx.metas || [];
    $("linkMetas").hidden = !metas.length;
    host.innerHTML = metas.length ? metas.slice(0, 3).map(m => {
      const p = U.progresso(m.current_amount, m.target_amount);
      return `\n          <article class="card-meta">\n            <h3>${U.escapeHTML(m.name)}</h3>\n            <div class="barra" role="img" aria-label="${U.percentual(p, 0)} concluída"><div class="barra-preenchida" style="width:${p}%"></div></div>\n            <p>${U.moeda(m.current_amount)} de ${U.moeda(m.target_amount)} · ${U.percentual(p, 0)}</p>\n          </article>`;
    }).join("") : `<div class="vazio vazio--guia vazio--inicio">\n          <p><strong>Você ainda não definiu uma meta.</strong> Crie uma meta para começar a acompanhar seu progresso.</p>\n          <p>Com ela, o FinCK of Reality também mostra quanto cada compra atrasa aquilo que importa para você.</p>\n          <a class="btn-secundario" href="metas.html#nova">Criar meta</a>\n        </div>`;
  }

  function renderMovimentos(ctx) {
    const lista = $("lista");
    const ultimas = (ctx.transacoes || []).slice(0, 8);
    const temContas = (ctx.contas || []).some(c => c.active !== false);
    const hoje = ctx.hoje || U.hojeISO();
    $("vazio").hidden = ultimas.length > 0;
    lista.hidden = !ultimas.length;
    lista.innerHTML = ultimas.map(t => {
      const agendada = String(t.date || "").slice(0, 10) > hoje;
      return `\n      <article class="item-transacao ${t.type === "entrada" ? "entrada" : "saida"}">\n        <div class="item-info">\n          <h4>${U.escapeHTML(t.description)}</h4>\n          <small>${U.escapeHTML(t.category || (t.type === "entrada" ? "Entrada" : "Outros"))} · ${U.dataBR(t.date)}${agendada ? " · agendada" : ""}</small>\n        </div>\n        <div class="item-lado">\n          <strong class="${t.type === "entrada" ? "cor-verde" : "cor-vermelha"}">\n            ${t.type === "entrada" ? "+" : "−"} ${U.moeda(t.amount)}\n          </strong>\n          ${T.selo(t.amount, {
        classe: t.type === "entrada" ? "selo-tempo--entrada" : ""
      })}\n          ${PN.mostrarSeloSemConta(t, temContas) ? `<span class="selo-alocacao" title="Sem conta vinculada e sem declaração de que fica fora das contas.">sem conta</span>` : ""}\n          <button type="button" class="btn-excluir-item" data-estornar="${U.escapeHTML(t.id)}"\n                  aria-label="Estornar ${U.escapeHTML(t.description)}" title="Estornar">↺</button>\n        </div>\n      </article>`;
    }).join("");
    lista.querySelectorAll("[data-estornar]").forEach(b => b.addEventListener("click", () => estornar(b, ctx)));
  }

  async function estornar(botao, ctx) {
    const id = botao.dataset.estornar;
    const alvo = (ctx.transacoes || []).find(t => String(t.id) === String(id));
    const contexto = alvo?.goal_id ? "Ela está vinculada a uma meta: o progresso volta exatamente uma vez." : alvo?.source_occurrence_id ? "Ela veio de uma previsão confirmada: a previsão volta a ficar em aberto." : "O lançamento sai do saldo, mas continua no histórico.";
    const motivo = await U.perguntar(`Estornar "${alvo?.description || "movimentação"}"?`, contexto, {
      rotulo: "Motivo do estorno",
      valor: "Lançamento incorreto",
      placeholder: "Ex.: valor digitado errado",
      confirmar: "Estornar"
    });
    if (motivo === null) {
      return;
    }
    botao.disabled = true;
    try {
      const r = await F.estornarTransacao(id, {
        motivo: motivo.trim() || "Estorno solicitado pelo usuário",
        chave: S.chaveDeOperacao("estorno", id)
      });
      U.toast(r.repetida ? "Esta movimentação já estava estornada." : r.estornouMeta ? "Movimentação estornada e progresso da meta revertido." : "Movimentação estornada. O histórico foi preservado.", r.repetida ? "info" : "sucesso");
      render();
    } catch (err) {
      await S.registrarEvento({
        scope: "estorno",
        message: err.message,
        context: {
          transacao: id
        }
      });
      U.toast(err.message || "Não foi possível estornar.", "erro");
    } finally {
      botao.disabled = false;
    }
  }

  async function renderInterpretacao(ctx) {
    const resumo = R.resumoHistorico(ctx.analises);
    const game = await S.obterGamificacao();
    const nivel = G.nivelDe(game.xp);
    const dias = Number(ctx.perfil?.work_days_month) || cfg.PADRAO.work_days_month;
    const horas = Number(ctx.perfil?.work_hours_day) || cfg.PADRAO.work_hours_day;
    const valorDia = (Number(ctx.perfil?.income_monthly) || 0) / dias;
    const valorHora = valorDia / horas;
    const sobra = ctx.rendaLivre;
    $("prismaReais").textContent = U.moeda(sobra);
    $("prismaHoras").textContent = valorHora > 0 ? `${U.numero(sobra / valorHora, 0)} h` : "sem renda";
    $("prismaDias").textContent = valorDia > 0 ? `${U.numero(sobra / valorDia, 1)} dias` : "sem renda";
    const emAberto = (ctx.metas || []).filter(m => Number(m.current_amount || 0) < Number(m.target_amount || 0)).sort((a, b) => a.target_amount - a.current_amount - (b.target_amount - b.current_amount));
    if (emAberto.length) {
      const alvo = emAberto[0];
      const falta = Number(alvo.target_amount) - Number(alvo.current_amount);
      $("prismaMetaRotulo").textContent = "Na meta mais perto";
      $("prismaMeta").textContent = U.percentual(Math.min(100, sobra / falta * 100), 0);
      $("prismaMetaNota").textContent = `do que ainda falta para "${alvo.name}" (${U.moeda(falta)})`;
    } else if ((ctx.metas || []).length) {
      $("prismaMetaRotulo").textContent = "Suas metas";
      $("prismaMeta").textContent = "100%";
      $("prismaMetaNota").textContent = "todas as metas já foram alcançadas";
    } else {
      $("prismaMetaRotulo").textContent = "Na sua meta";
      $("prismaMeta").textContent = "sem meta";
      $("prismaMetaNota").textContent = "crie uma meta para ver esta face";
    }
    $("indEvitadas").textContent = resumo.evitadas;
    $("indEconomia").textContent = U.moeda(resumo.valor_potencial);
    $("indHoras").textContent = `${U.numero(resumo.horas_preservadas, 1)} h`;
    $("indNivel").textContent = nivel.level;
  }

  // ------------------------------------------------------------------
  // Registro rápido: valor e descrição à vista; o resto tem padrão.
  // ------------------------------------------------------------------
  const form = $("formTransacao");
  const campoValor = $("valor");
  const campoDescricao = $("descricao");
  const selCategoria = $("categoria");
  const selConta = $("contaSelecionada");
  const selMeta = $("metaSelecionada");
  const detalhes = $("maisDetalhes");
  const sugestao = $("sugestaoCategoria");
  const btnRegistrar = $("btnRegistrar");
  let tipoAtual = "saida";
  // Depois que a pessoa escolhe a categoria, a sugestão para de mexer nela.
  let categoriaEscolhida = false;
  let ultimoRegistro = null;
  selCategoria.innerHTML = cfg.CATEGORIAS.map(c => `<option value="${U.escapeHTML(c)}">${U.escapeHTML(c)}</option>`).join("");

  function temContasAtivas() {
    return (ctxAtual?.contas || []).some(c => c.active !== false);
  }
  function prepararRegistro(ctx) {
    const ativas = (ctx.contas || []).filter(c => c.active !== false);
    const escolhida = selConta.value;
    selConta.innerHTML = ativas.length ? `<option value="">Escolha a conta…</option>` + ativas.map(c => `<option value="${U.escapeHTML(c.id)}">${U.escapeHTML(c.name)}</option>`).join("") + `<option value="${PN.FORA_DAS_CONTAS}">Fora das contas, só no saldo geral</option>` : `<option value="">Sem contas: só no saldo geral</option>`;
    if (escolhida && [ ...selConta.options ].some(o => o.value === escolhida)) {
      selConta.value = escolhida;
    }
    $("campoConta").hidden = !ativas.length;
    const metaEscolhida = selMeta.value;
    selMeta.innerHTML = `<option value="">Nenhuma meta</option>` + (ctx.metas || []).map(m => `<option value="${U.escapeHTML(m.id)}">${U.escapeHTML(m.name)}</option>`).join("");
    if (metaEscolhida && [ ...selMeta.options ].some(o => o.value === metaEscolhida)) {
      selMeta.value = metaEscolhida;
    }
  }

  function definirTipo(tipo) {
    tipoAtual = tipo === "entrada" ? "entrada" : "saida";
    form.querySelectorAll('input[name="tipoLancamento"]').forEach(r => {
      r.checked = r.value === tipoAtual;
    });
    $("tituloModal").textContent = tipoAtual === "entrada" ? "Nova entrada" : "Nova saída";
    btnRegistrar.textContent = tipoAtual === "entrada" ? "Registrar entrada" : "Registrar saída";
    $("campoCategoria").hidden = tipoAtual === "entrada";
    campoDescricao.placeholder = tipoAtual === "entrada" ? "Ex.: Salário, freela" : "Ex.: Almoço";
    atualizarSugestao();
  }

  // A sugestão é do FinCK (regra de palavras), não da IA, e só vale quando a
  // pessoa toca em Registrar. Nada é gravado sozinho.
  // A região é aria-live: só é reescrita quando a frase muda, senão o leitor
  // de tela relia a sugestão a cada letra. "Sem sugestão" espera a pessoa
  // parar de digitar um instante.
  let chaveSugestao = "";
  let esperaSemSugestao = 0;
  function escreverSugestao(chaveNova, html) {
    if (chaveNova === chaveSugestao) {
      return;
    }
    chaveSugestao = chaveNova;
    sugestao.innerHTML = html;
    sugestao.hidden = !html;
  }
  function atualizarSugestao() {
    clearTimeout(esperaSemSugestao);
    if (tipoAtual === "entrada") {
      escreverSugestao("", "");
      atualizarResumoDetalhes();
      return;
    }
    const texto = campoDescricao.value.trim();
    let sugerida = null;
    if (!categoriaEscolhida) {
      sugerida = PN.sugerirCategoria(texto, {
        categorias: cfg.CATEGORIAS
      });
      selCategoria.value = sugerida || "Outros";
    }
    const atual = U.escapeHTML(selCategoria.value);
    // A frase vai num span só: no flex, cada pedaço solto virava um item e
    // o ponto final ficava separado da categoria.
    if (categoriaEscolhida) {
      escreverSugestao(`escolhida|${selCategoria.value}`, `<span>Categoria: <strong>${atual}</strong>, escolhida por você.</span> <button type="button" class="btn-texto" data-alterar-categoria>Alterar</button>`);
    } else if (sugerida) {
      escreverSugestao(`sugerida|${selCategoria.value}`, `<span>Sugestão do FinCK: <strong>${atual}</strong>.</span> <button type="button" class="btn-texto" data-alterar-categoria>Alterar</button>`);
    } else if (texto) {
      const html = `<span>Sem sugestão para essa descrição: fica em <strong>${atual}</strong>.</span> <button type="button" class="btn-texto" data-alterar-categoria>Escolher categoria</button>`;
      if (chaveSugestao.startsWith("sem|")) {
        escreverSugestao(`sem|${selCategoria.value}`, html);
      } else {
        // A sugestão anterior sai na hora: ela já não vale para o texto novo.
        escreverSugestao("", "");
        esperaSemSugestao = setTimeout(() => escreverSugestao(`sem|${selCategoria.value}`, html), 400);
      }
    } else {
      escreverSugestao("", "");
    }
    atualizarResumoDetalhes();
  }
  sugestao.addEventListener("click", e => {
    if (!e.target.closest("[data-alterar-categoria]")) {
      return;
    }
    detalhes.open = true;
    selCategoria.focus();
  });

  function atualizarResumoDetalhes() {
    const partes = [];
    const data = window.FinckData.ler("data");
    partes.push(`Data: ${!data || data === U.hojeISO() ? "hoje" : U.dataBR(data)}`);
    if (temContasAtivas()) {
      const opcao = selConta.selectedOptions[0];
      partes.push(!selConta.value ? "Conta: escolher" : selConta.value === PN.FORA_DAS_CONTAS ? "Fora das contas" : `Conta: ${opcao ? opcao.textContent : ""}`);
    }
    if (selMeta.value) {
      partes.push(`Meta: ${selMeta.selectedOptions[0]?.textContent || ""}`);
    }
    $("resumoDetalhes").textContent = partes.join(" · ");
  }

  function abrirRegistro(tipo = "saida") {
    form.reset();
    U.limparMoeda("valor");
    window.FinckData.escrever("data", U.hojeISO());
    categoriaEscolhida = false;
    detalhes.open = false;
    if (ctxAtual) {
      prepararRegistro(ctxAtual);
      selConta.value = PN.contaInicial(ctxAtual.contas, PN.lerLocal(chave("ultima-conta")));
    }
    definirTipo(tipo);
    U.abrirModal("modalTransacao");
    // abrirModal foca o primeiro controle (o tipo); o valor é o que importa.
    requestAnimationFrame(() => requestAnimationFrame(() => campoValor.focus()));
  }

  form.querySelectorAll('input[name="tipoLancamento"]').forEach(r => r.addEventListener("change", () => {
    if (r.checked) {
      definirTipo(r.value);
    }
  }));
  campoDescricao.addEventListener("input", atualizarSugestao);
  selCategoria.addEventListener("change", () => {
    categoriaEscolhida = true;
    atualizarSugestao();
  });
  selConta.addEventListener("change", atualizarResumoDetalhes);
  selMeta.addEventListener("change", atualizarResumoDetalhes);
  $("data").addEventListener("input", atualizarResumoDetalhes);
  $("btnEntrada").addEventListener("click", () => abrirRegistro("entrada"));
  $("btnSaida").addEventListener("click", () => abrirRegistro("saida"));
  $("btnPrimeiroLancamento").addEventListener("click", () => abrirRegistro("saida"));
  document.addEventListener("click", e => {
    const gatilho = e.target.closest("[data-novo-lancamento]");
    if (gatilho) {
      abrirRegistro(gatilho.dataset.novoLancamento);
    }
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (btnRegistrar.disabled) {
      return;
    }
    const type = tipoAtual;
    const amount = U.lerMoeda("valor");
    const description = campoDescricao.value.trim();
    const date = window.FinckData.ler("data");
    const category = type === "entrada" ? null : selCategoria.value || "Outros";
    const goal_id = selMeta.value || null;
    if (!(amount > 0)) {
      return U.erroCampo("valor", "Informe um valor maior que zero.");
    }
    if (!description) {
      return U.erroCampo("descricao", "Informe uma descrição, como \"Almoço\".");
    }
    if (!date) {
      detalhes.open = true;
      return U.erroCampo("data", "Informe a data no formato dd/mm/aaaa.");
    }
    const temContas = temContasAtivas();
    const semConta = selConta.value === PN.FORA_DAS_CONTAS;
    const account_id = temContas && !semConta ? selConta.value || null : null;
    if (temContas && !account_id && !semConta) {
      detalhes.open = true;
      return U.erroCampo("contaSelecionada", "Escolha a conta ou marque que a movimentação fica fora das contas.");
    }
    const dados = {
      type: type,
      amount: amount,
      description: description,
      date: date,
      category: category,
      goal_id: goal_id,
      account_id: account_id,
      unallocated: !account_id
    };
    btnRegistrar.disabled = true;
    btnRegistrar.textContent = "Registrando…";
    try {
      const mov = await F.registrarTransacao(dados);
      if (temContas) {
        PN.gravarLocal(chave("ultima-conta"), semConta ? PN.FORA_DAS_CONTAS : account_id);
      }
      const contaNome = account_id ? selConta.selectedOptions[0]?.textContent : null;
      U.fecharModal("modalTransacao");
      const texto = PN.textoRegistrado({
        tipo: type,
        valor: amount,
        descricao: description
      });
      // A confirmação fica no próprio painel (região de status), não num
      // aviso flutuante: o aviso cobria o botão Desfazer.
      mostrarRegistro(mov, {
        texto: texto,
        detalhes: [ category, date === U.hojeISO() ? "hoje" : U.dataBR(date), contaNome ].filter(Boolean).join(" · ")
      });
      // A confirmação vem primeiro. O XP é anunciado só quando foi ganho:
      // um aviso de limite logo depois de registrar parecia que o registro
      // tinha falhado. A conquista também não pode virar erro na tela.
      try {
        // XP, nível e conquistas viram uma linha curta só, dentro da
        // confirmação, sem cobrir nenhum botão.
        const nivelAntes = G.nivelDe ? G.nivelDe((await S.obterGamificacao()).xp).level : null;
        const premio = await G.premiar(type === "entrada" ? "entrada" : "saida", {
          motivo: type === "entrada" ? "entrada registrada" : "saída registrada",
          silencioso: true,
          avisoDeNivel: false
        });
        const conquistas = await G.sincronizarConquistas({
          avisar: false
        });
        const subiu = premio?.nivel && nivelAntes !== null && premio.nivel.level > nivelAntes && !/Nível/.test(conquistas?.aviso || "") ? ` Nível ${premio.nivel.level}: ${premio.nivel.titulo}.` : "";
        const partes = [ premio?.concedido > 0 ? `+${premio.concedido} XP.` : "", conquistas?.aviso || "", subiu ].filter(Boolean);
        const host = $("registroFeito");
        if (partes.length && ultimoRegistro === mov && host.firstElementChild) {
          const linha = document.createElement("p");
          linha.className = "registro-feito__xp";
          linha.textContent = partes.join(" ");
          host.firstElementChild.after(linha);
        }
      } catch {}
      render();
    } catch (err) {
      U.toast(err.message || "Não foi possível registrar. Nada foi gravado.", "erro");
    } finally {
      btnRegistrar.disabled = false;
      btnRegistrar.textContent = tipoAtual === "entrada" ? "Registrar entrada" : "Registrar saída";
    }
  });

  // Sem a etapa de confirmação, o engano se corrige aqui mesmo: "Desfazer"
  // estorna o lançamento recém-registrado e mantém o histórico.
  function mostrarRegistro(mov, {texto: texto, detalhes: detalhesTexto}) {
    ultimoRegistro = mov;
    const host = $("registroFeito");
    host.innerHTML = `<p><strong>${U.escapeHTML(texto)}</strong>${detalhesTexto ? ` <small>${U.escapeHTML(detalhesTexto)}</small>` : ""}</p>\n      <button type="button" class="btn-texto" data-desfazer>Desfazer</button>`;
    host.querySelector("[data-desfazer]").addEventListener("click", async ev => {
      const alvo = ultimoRegistro;
      if (!alvo) {
        return;
      }
      // Depois do await, ev.currentTarget já é null: o botão fica guardado antes.
      const botao = ev.currentTarget;
      botao.disabled = true;
      try {
        await F.estornarTransacao(alvo.id, {
          motivo: "Desfeito logo depois de registrar",
          chave: S.chaveDeOperacao("estorno", alvo.id)
        });
        ultimoRegistro = null;
        host.innerHTML = "<p><strong>Lançamento desfeito.</strong> <small>O histórico foi preservado.</small></p>";
        $("btnSaida").focus();
        render();
      } catch (err) {
        botao.disabled = false;
        U.toast(err.message || "Não foi possível desfazer.", "erro");
      }
    });
  }

  // home.html#novo-lancamento (link das outras telas) abre o registro rápido.
  function abrirPeloEndereco() {
    if (location.hash !== "#novo-lancamento") {
      return;
    }
    $("novo-lancamento").scrollIntoView({
      block: "center"
    });
    abrirRegistro("saida");
    // Recarregar a página não reabre o registro.
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch {}
  }
  window.addEventListener("hashchange", abrirPeloEndereco);

  await render();
  marcarPronto();
  abrirPeloEndereco();
});
