// Revisão financeira: tela do planejamento pessoal (arquivo assistente.html,
// mantido para os links antigos continuarem valendo).
//
// O FinCK calcula primeiro, a pessoa decide e a IA só entra se ela pedir:
//   1. FinckDiagnostico (js/diagnostico-engine.js) calcula o índice, as seis
//      dimensões, as próximas ações e as respostas das perguntas prontas, aqui
//      no aparelho, com os parâmetros de FINCK_CONFIG.DIAGNOSTICO.
//   2. A página abre direto com isso, sem botão e sem chamada de rede.
//   3. A ajuda opcional fica recolhida no fim: a pergunta livre e a explicação
//      escrita das ações chamam a IA só depois do clique, e a resposta sai
//      rotulada como escrita por IA. Se ela falhar, nada some: as ações pelas
//      regras continuam na tela.
document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const D = window.FinckDiagnostico;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "Revisão financeira",
    subtitulo: "Planejamento pessoal"
  });
  if (!user) {
    return;
  }
  const $ = id => document.getElementById(id);
  const esc = U.escapeHTML;
  const IA = cfg.ASSISTENTE_IA || {};
  const IA_ATIVA = IA.ATIVA === true && !!IA.ENDPOINT;
  // Pergunta livre sem a rota da revisão (demonstração, rota ausente): vai
  // pela rota geral (api/ia.js), com o retrato em texto, sem nomes.
  const ENDPOINT_LIVRE = "/api/ia";
  const MAX_PERGUNTA = 400;
  const P = cfg.DIAGNOSTICO || {};
  const JANELA = P.JANELA_MESES || 3;
  const ctx = await F.carregarContexto();
  const diag = D.diagnosticar(ctx);
  const retrato = D.paraIA(diag);
  const contextoConversa = D.contextoDaConversa(diag);
  const NOMES = Object.fromEntries(diag.dimensoes.map(d => [ d.id, d.nome ]));
  const DIMS = Object.fromEntries(diag.dimensoes.map(d => [ d.id, d ]));
  const chaveLocal = `finck-assistente-plano:${user.id || "local"}`;
  const assinatura = JSON.stringify(retrato);
  const demo = (() => {
    try {
      return S.emDemo();
    } catch {
      return false;
    }
  })();
  // A explicação escrita só existe com conta e com a rota configurada; na
  // demonstração o trecho nem aparece (nada de recurso desabilitado).
  const comExplicacao = !demo && IA_ATIVA;

  // Mensagens da ajuda opcional, sem jargão nem nome de serviço: o que
  // aconteceu e o que fazer. As mesmas palavras do Reality.
  const MSG = {
    indisponivel: "A ajuda opcional não está disponível agora.",
    limite: "A ajuda opcional atingiu o limite por agora. Tente de novo mais tarde.",
    demorou: "A ajuda opcional demorou demais para responder. Tente de novo em instantes.",
    conexao: "Não foi possível falar com a ajuda opcional. Confira a sua conexão e tente de novo.",
    falhou: "A ajuda opcional não conseguiu responder agora. Tente de novo em instantes.",
    sessao: "Sua sessão expirou. Entre de novo na sua conta e tente outra vez.",
    recusa: "A ajuda opcional não respondeu a este pedido. Tente escrever a pergunta de outro jeito."
  };
  const VALEM = "Os números e as próximas ações desta página continuam valendo.";
  const ROTULO_IA = "Resposta escrita por IA a partir dos números desta revisão.";
  const ROTULO_EXPLICACAO = "Explicação escrita por IA a partir dos números desta revisão.";
  const PROVEDORES = {
    anthropic: "o Claude, da Anthropic",
    openrouter: "modelos gratuitos do OpenRouter"
  };

  // Rolagem suave só com a animação completa e sem pedido do sistema.
  const movimentoLiberado = () => {
    const pref = window.FinckPreferencias?.animacoes?.() || "completa";
    return pref === "completa" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };
  const rolarAte = (el, bloco = "nearest") => el?.scrollIntoView({
    behavior: movimentoLiberado() ? "smooth" : "auto",
    block: bloco
  });

  const meses = n => `${n} ${n === 1 ? "mês" : "meses"}`;
  const minuscula = t => `${t.charAt(0).toLowerCase()}${t.slice(1)}`;
  const selo = tipo => tipo === "estimativa" ? '<span class="selo-certeza selo-certeza--estimativa">Estimativa</span>' : '<span class="selo-certeza selo-certeza--confirmado">Dado confirmado</span>';
  const htmlConta = linhas => linhas && linhas.length ? `<dl class="conta-revisao">${linhas.map(l => `<div><dt>${esc(l.rotulo)}</dt><dd>${esc(l.valor)}</dd></div>`).join("")}</dl>` : "";

  // ------------------------------------------------------------ certeza

  // Dado confirmado: sai direto do que a pessoa registrou. Estimativa: depende
  // de média de poucos meses, de mês em andamento ou de um valor substituto.
  function certeza(d) {
    if (!d || d.nivel === "sem_dados") {
      return null;
    }
    const r = diag.retrato;
    if (d.id === "poupanca") {
      if (r.mes_parcial) {
        return {
          tipo: "estimativa",
          motivo: "O mês ainda está em andamento: a conta é refeita quando ele fechar."
        };
      }
      if (r.meses_considerados < JANELA) {
        return {
          tipo: "estimativa",
          motivo: `Média de ${meses(r.meses_considerados)}; a referência usa ${meses(JANELA)}.`
        };
      }
    }
    if (d.id === "reserva" && !(r.despesas_fixas > 0)) {
      return {
        tipo: "estimativa",
        motivo: "Sem despesas fixas cadastradas, o custo do mês vem da média de gastos."
      };
    }
    return {
      tipo: "confirmado",
      motivo: null
    };
  }
  const gastosEstimados = diag.retrato.mes_parcial || diag.retrato.meses_considerados < JANELA;

  // ------------------------------------------------------------ índice

  function renderIndice() {
    const host = $("indiceFinck");
    if (diag.indice === null) {
      host.innerHTML = `<p class="raiox__resumo">${esc(diag.resumo)}</p>`;
      return;
    }
    const nivel = diag.indice >= 75 ? "saudavel" : diag.indice >= 50 ? "atencao" : "critico";
    const estimadas = diag.dimensoes.filter(d => certeza(d)?.tipo === "estimativa").map(d => d.nome.toLowerCase());
    const primeira = diag.prioridades[0];
    host.innerHTML = `
      <div class="indice-finck indice-finck--${nivel}">
        <span class="indice-finck__rotulo">Índice FinCK</span>
        <strong class="indice-finck__valor">${diag.indice}<small>/100</small></strong>
        <span class="indice-finck__nivel">vida financeira ${esc(diag.rotulo)}</span>
      </div>
      <p class="raiox__resumo">${primeira ? `Primeira das próximas ações: ${esc(minuscula(primeira.titulo))}.` : "Nenhuma ação pendente no momento."}</p>
      ${estimadas.length ? `<p class="nota">${selo("estimativa")} O índice inclui estimativa em ${esc(estimadas.join(" e "))}, então ele pode mudar conforme você registra mais meses.</p>` : ""}`;
    window.FinckFundo?.tom(nivel === "saudavel" ? "positivo" : "neutro");
  }

  // ------------------------------------------------------------ próximas ações

  // Cada ação diz o que fazer e por quê, com o número que a disparou. A conta
  // e o motivo de ela importar ficam recolhidos, um toque abaixo.
  function htmlAcao(x) {
    const d = DIMS[x.baseado_em || x.dimensao];
    const c = certeza(d);
    return `
      <li class="acao-revisao acao-revisao--${esc(x.nivel || "info")}">
        <div class="acao-revisao__topo">
          <h4 class="acao-revisao__titulo">${esc(x.titulo)}</h4>
          ${x.prazo ? `<span class="chip-prazo">${esc(x.prazo)}</span>` : ""}
        </div>
        <p class="acao-revisao__porque">${esc(x.porque)}</p>
        <div class="acao-revisao__detalhes">
          ${x.calculo && x.calculo.length ? `
          <details class="ponto-finck__detalhe">
            <summary>Como foi calculado?</summary>
            <div class="ponto-finck__corpo">
              ${d ? `<p>Regra do FinCK na dimensão <strong>${esc(d.nome)}</strong>:</p>` : ""}
              ${htmlConta(x.calculo)}
              ${c ? `<p class="acao-revisao__certeza">${selo(c.tipo)}${c.motivo ? ` ${esc(c.motivo)}` : ""}</p>` : ""}
            </div>
          </details>` : ""}
          ${x.importa ? `
          <details class="ponto-finck__detalhe">
            <summary>Por que isso importa?</summary>
            <div class="ponto-finck__corpo"><p>${esc(x.importa)}</p></div>
          </details>` : ""}
        </div>
        ${x.href ? `<a class="btn-secundario btn-mini acao-revisao__link" href="${esc(x.href)}">${esc(x.acao || "Ver no app")}</a>` : ""}
      </li>`;
  }

  function renderAcoes() {
    const p = D.planoLocal(diag);
    const extras = diag.prioridades.slice(p.prioridades.length);
    if (demo) {
      $("origemAcoes").textContent = "Montadas pelas regras do FinCK com os dados de exemplo, da mais urgente para a menos urgente.";
    }
    $("plano").innerHTML = `
      ${p.alerta ? `<p class="alerta">${esc(p.alerta)}</p>` : ""}
      ${p.prioridades.length ? `<ol class="acoes-revisao">${p.prioridades.map(htmlAcao).join("")}</ol>` : `<p class="acoes-revisao__vazio"><strong>Nenhuma ação pendente.</strong> Com os números de hoje, nenhuma regra do FinCK apontou algo a fazer. O FinCK of Reality ajuda a pesar as próximas compras.</p>`}
      ${extras.length ? `
      <details class="secao-finck acoes-revisao__mais">
        <summary>
          <span class="secao-finck__nome">Outros pontos, com menos urgência (${extras.length})</span>
        </summary>
        <div class="secao-finck__corpo"><ol class="acoes-revisao acoes-revisao--extras">${extras.map(htmlAcao).join("")}</ol></div>
      </details>` : ""}
      ${p.pontos_fortes.length ? `<div class="plano__fortes"><h4>O que já vai bem</h4><ul>${p.pontos_fortes.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
      ${p.metas_sugeridas.length ? `<div class="plano__metas"><h4>Meta sugerida</h4>${p.metas_sugeridas.map(m => `
        <div class="meta-sugerida">
          <strong>${esc(m.nome)}</strong>
          <span class="meta-sugerida__valor">${U.moeda(m.valor_mensal)}<small>/mês</small></span>
          <p>${esc(m.motivo || "")}</p>
          <a class="btn-secundario btn-mini" href="metas.html#nova">Criar esta meta</a>
        </div>`).join("")}<p class="nota">Uma sugestão não vira meta sozinha: ela só existe se você criar.</p></div>` : ""}
      ${p.habito_da_semana ? `<div class="plano__habito"><h4>Hábito sugerido</h4><p>${esc(p.habito_da_semana)}</p></div>` : ""}`;
  }

  // ------------------------------------------------------------ dimensões

  function renderDimensoes() {
    $("dimensoes").innerHTML = diag.dimensoes.map(d => {
      const c = certeza(d);
      return `
      <article class="dimensao dimensao--${d.nivel}">
        <header class="dimensao__topo">
          <h4>${esc(d.nome)}</h4>
          <span class="dimensao__nivel">${esc(D.NIVEIS[d.nivel])}</span>
        </header>
        <p class="dimensao__valor">${esc(d.valor_texto)}</p>
        ${c ? `<p class="dimensao__certeza">${selo(c.tipo)}${c.motivo ? ` <span>${esc(c.motivo)}</span>` : ""}</p>` : ""}
        ${d.nota !== null ? `<div class="barra" role="img" aria-label="Nota ${d.nota} de 100"><div class="barra-preenchida" style="width:${d.nota}%"></div></div>` : ""}
        ${d.referencia ? `<p class="dimensao__referencia">Referência: ${esc(d.referencia)}</p>` : ""}
        <p class="dimensao__explicacao">${esc(d.explicacao)}</p>
      </article>`;
    }).join("");
    $("comoCalcula").innerHTML = `
      <p class="descricao">Cada dimensão recebe uma nota de 0 a 100 pela distância até a referência. O índice é a média ponderada das dimensões que têm dados; as sem dados ficam fora da conta. Com o mês ainda em andamento, a poupança conta com metade do peso.</p>
      <ul class="lista-simples">
        ${diag.dimensoes.map(d => `<li>${esc(d.nome)}: peso ${Math.round((P.PESOS?.[d.id] || 0) * 100)}%${d.referencia ? `, referência ${esc(d.referencia)}` : ""}</li>`).join("")}
      </ul>
      <p class="nota">As referências são didáticas e ficam todas em um só lugar do código (FINCK_CONFIG.DIAGNOSTICO). A regra 50/30/20 vem de Warren e Tyagi (2005); a reserva de ${P.RESERVA_MINIMA_MESES} a ${P.RESERVA_IDEAL_MESES} meses e o teto de parcelas são parâmetros prudenciais adotados pelo projeto. O índice não é score de crédito.</p>`;
  }

  function renderNumeros() {
    const r = diag.retrato;
    const categorias = r.categorias.slice(0, 6);
    const metas = r.metas;
    const media = r.meses_considerados ? ` de ${meses(r.meses_considerados)}` : "";
    const marcaMedia = gastosEstimados ? ` ${selo("estimativa")}` : "";
    $("numeros").innerHTML = `
      <div class="numeros-assistente__grupo">
        <h4>Mês típico</h4>
        <ul class="lista-resumo">
          <li><span>Renda declarada</span><strong>${U.moeda(r.renda)}</strong></li>
          <li><span>Despesas fixas</span><strong class="cor-vermelha">${U.moeda(r.despesas_fixas)}</strong></li>
          <li><span>Gastos (média${media})${marcaMedia}</span><strong>${U.moeda(r.media_gastos)}</strong></li>
          <li><span>Guardado em metas por mês${marcaMedia}</span><strong class="cor-verde">${U.moeda(r.media_aportes)}</strong></li>
          <li><span>Parcelas por mês</span><strong>${U.moeda(r.parcelas_mensais)}</strong></li>
        </ul>
        ${r.mes_parcial ? `<p class="nota">Ainda não há um mês completo registrado: a média usa o mês atual, que está em andamento.</p>` : gastosEstimados ? `<p class="nota">As médias usam ${meses(r.meses_considerados)}; com ${meses(JANELA)} registrados, elas deixam de ser estimativa.</p>` : ""}
      </div>
      <div class="numeros-assistente__grupo">
        <h4>Para onde vai o dinheiro</h4>
        ${categorias.length ? `<ul class="lista-categorias">${categorias.map(c => `
          <li>
            <span class="lista-categorias__nome">${esc(c.nome)}</span>
            <span class="lista-categorias__barra"><span style="width:${Math.min(100, c.participacao)}%"></span></span>
            <strong>${U.moeda(c.media_mensal)}<small>/mês</small></strong>
            ${c.tendencia_pct !== null && Math.abs(c.tendencia_pct) >= 10 ? `<small class="lista-categorias__tendencia ${c.tendencia_pct > 0 ? "cor-vermelha" : "cor-verde"}">${c.tendencia_pct > 0 ? "▲" : "▼"} ${U.percentual(Math.abs(c.tendencia_pct), 0)} no último mês</small>` : ""}
          </li>`).join("")}</ul>` : `<p class="vazio">Nenhum gasto registrado ainda. <a href="home.html#novo-lancamento">Registrar o primeiro</a> e o FinCK mostra para onde vai o dinheiro.</p>`}
      </div>
      <div class="numeros-assistente__grupo">
        <h4>Metas</h4>
        ${metas.length ? `<ul class="lista-metas-assistente">${metas.map(m => `
          <li>
            <strong>${esc(m.nome)}</strong>
            <span>${U.moeda(m.atual)} de ${U.moeda(m.alvo)} (${U.percentual(m.progresso, 0)})</span>
            <small>${m.concluida ? "Concluída." : m.parada ? "Sem aportes nos últimos 3 meses." : m.meses_para_concluir ? `No ritmo atual (${U.moeda(m.ritmo_mensal)}/mês), conclui em cerca de ${U.numero(m.meses_para_concluir, 1)} meses (estimativa).` : ""}${!m.concluida && m.necessario_mensal ? ` O prazo pede ${U.moeda(m.necessario_mensal)}/mês.` : ""}</small>
          </li>`).join("")}</ul>` : `<p class="vazio">Nenhuma meta ainda. <a href="metas.html#nova">Criar a primeira</a>.</p>`}
      </div>`;
  }

  // ------------------------------------------------------------ dados e privacidade

  // Tudo sobre o que sai do aparelho num lugar só, recolhido no fim. O nome
  // do serviço e do modelo só aparece aqui, e só depois de a pessoa abrir
  // um trecho da ajuda (é quando a página pergunta ao servidor).
  const infoIA = {
    provedor: null,
    modelo: null
  };
  function quemEscreve() {
    if (infoIA.provedor && PROVEDORES[infoIA.provedor]) {
      return `Neste servidor, ${PROVEDORES[infoIA.provedor]}${infoIA.modelo ? ` (modelo ${infoIA.modelo})` : ""}, chamado pela função do FinCK na Vercel. A chave fica no servidor, nunca na página.`;
    }
    if (!comExplicacao) {
      return `Modelos gratuitos do OpenRouter${infoIA.modelo ? ` (neste servidor, ${infoIA.modelo})` : ""}, chamados pela função do FinCK na Vercel. A chave fica no servidor, nunca na página.`;
    }
    return "Um serviço de IA chamado pela função do FinCK na Vercel: o Claude, da Anthropic, quando o servidor tem essa chave; senão, modelos gratuitos do OpenRouter. A chave fica no servidor, nunca na página.";
  }
  function renderPrivacidade() {
    const linhas = comExplicacao ? [ [ "O que fica no aparelho", "Todos os cálculos desta página: índice, dimensões, próximas ações e as respostas do Cálculo do FinCK. Nada disso é enviado." ], [ "O que é enviado, e quando", "Só quando você pede a explicação escrita ou envia uma pergunta livre: o retrato agregado mostrado abaixo, com números arredondados e nomes de categoria e de meta. Nenhuma descrição de lançamento, conta, e-mail ou nome seu. Os dois pedidos exigem a sua conta." ], [ "Quem escreve o texto", quemEscreve() ], [ "Se a rota da revisão não responder", "A pergunta livre vai pela rota geral do FinCK, com o retrato em texto mostrado abaixo, sem nomes de metas, contas ou lançamentos." ], [ "Onde fica salvo", "A última explicação escrita fica só neste aparelho, no navegador. O servidor não grava o pedido nem a resposta em banco ou log; a mesma explicação fica até 10 minutos na memória da função. A conversa some quando você sai da página." ] ] : [ [ "O que fica no aparelho", "Todos os cálculos desta página: índice, dimensões, próximas ações e as respostas do Cálculo do FinCK. Nada disso é enviado." ], [ "O que é enviado, e quando", `Só quando você envia uma pergunta livre: a pergunta e o retrato em texto mostrado abaixo, ${demo ? "com os números de exemplo da demonstração" : "com os seus números agregados"}. Não vão nomes de metas, contas ou lançamentos.` ], [ "Quem escreve a resposta", quemEscreve() ], [ "Onde fica salvo", "Em nenhum lugar: a conversa some quando você sai da página. O registro do servidor guarda só o status, o modelo e o tempo da chamada, nunca o texto." ] ];
    $("fichaPrivacidade").innerHTML = linhas.map(([ t, v ]) => `<div><dt>${esc(t)}</dt><dd>${esc(v)}</dd></div>`).join("");
  }
  function renderPedidos() {
    const json = v => esc(JSON.stringify(v, null, 2));
    const livre = `${JSON.stringify({
      pergunta: "(a sua pergunta, até 400 caracteres)",
      contexto: "(o retrato em texto, logo abaixo)"
    }, null, 2)}`;
    $("pedidosEnviados").innerHTML = comExplicacao ? `
      <h4>Pedido da explicação escrita</h4>
      <pre class="json-enviado json-enviado--curto" tabindex="0">${json({
        planejamento: {
          modo: "plano",
          retrato: "(o retrato agregado abaixo)"
        }
      })}</pre>
      <h4>Pedido de uma pergunta livre</h4>
      <pre class="json-enviado json-enviado--curto" tabindex="0">${json({
        planejamento: {
          modo: "pergunta",
          retrato: "(o retrato agregado abaixo)",
          pergunta: "(a sua pergunta, até 400 caracteres)",
          historico: "(até 6 mensagens anteriores desta conversa)"
        }
      })}</pre>
      <h4>O retrato agregado, igual nos dois pedidos</h4>
      <pre class="json-enviado" id="jsonEnviado" tabindex="0">${json(retrato)}</pre>
      <h4>O retrato em texto, se a pergunta for pela rota geral</h4>
      <pre class="json-enviado" id="contextoEnviado" tabindex="0">${esc(contextoConversa)}</pre>` : `
      <h4>Pedido de uma pergunta livre</h4>
      <pre class="json-enviado json-enviado--curto" tabindex="0">${esc(livre)}</pre>
      <h4>O retrato em texto que vai junto</h4>
      <pre class="json-enviado" id="contextoEnviado" tabindex="0">${esc(contextoConversa)}</pre>`;
  }

  if (demo) {
    $("avisoDemo").hidden = false;
    $("avisoEnvioConversa").innerHTML = "<strong>O que é enviado:</strong> a sua pergunta e os números de exemplo desta revisão, em texto. Não vão nomes de metas, contas ou lançamentos.";
  }
  renderIndice();
  renderAcoes();
  renderDimensoes();
  renderNumeros();
  renderPrivacidade();
  renderPedidos();

  // ------------------------------------------------------------ rotas (sob pedido)

  // GET sem login e sem cota, feito só quando a pessoa abre um trecho da
  // ajuda opcional, nunca ao carregar a página. Diz se a rota existe e tem
  // chave; sem resposta, o próprio envio conta o motivo.
  const comPrazo = async (url, ms = 6000) => {
    const ctrl = new AbortController;
    const alarme = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: ctrl.signal
      });
    } finally {
      clearTimeout(alarme);
    }
  };
  let rotaMemo = null;
  function rotaAssistente() {
    if (!rotaMemo) {
      rotaMemo = (async () => {
        if (!comExplicacao) {
          return {
            tipo: "local",
            codigo: "DESLIGADA"
          };
        }
        try {
          const r = await comPrazo(IA.ENDPOINT);
          if (r.status === 404) {
            return {
              tipo: "local",
              codigo: "AUSENTE"
            };
          }
          const s = r.ok ? await r.json().catch(() => null) : null;
          if (!s || s.ok !== true) {
            return {
              tipo: "local",
              codigo: "FALHOU"
            };
          }
          if (!s.ia) {
            return {
              tipo: "local",
              codigo: "DESLIGADA"
            };
          }
          infoIA.provedor = s.provedor || null;
          infoIA.modelo = s.modelo || null;
          renderPrivacidade();
          return {
            tipo: "ia"
          };
        } catch {
          // Sem conexão agora: a próxima tentativa pergunta de novo.
          rotaMemo = null;
          return {
            tipo: "local",
            codigo: "CONEXAO"
          };
        }
      })();
    }
    return rotaMemo;
  }
  let livreMemo = null;
  function iaLivre() {
    if (!livreMemo) {
      livreMemo = (async () => {
        try {
          const r = await comPrazo(ENDPOINT_LIVRE);
          if (r.status === 404) {
            return {
              ok: false
            };
          }
          const j = await r.json().catch(() => null);
          if (j && j.ia === false) {
            return {
              ok: false
            };
          }
          if (j && j.modelo && !infoIA.provedor) {
            infoIA.modelo = String(j.modelo);
            renderPrivacidade();
          }
          return {
            ok: true
          };
        } catch {
          livreMemo = null;
          return null;
        }
      })();
    }
    return livreMemo;
  }

  // Erro da IA vira uma frase da própria tela: sem nome de serviço, sem
  // código e sem "servidor".
  function mensagemDoErro(r) {
    const c = r?.codigo;
    if (c === "SEM_LOGIN") {
      return MSG.sessao;
    }
    if (c === "LIMITE" || c === "OCUPADA") {
      return MSG.limite;
    }
    if (c === "REDE" || c === "DEMOROU") {
      return MSG.demorou;
    }
    if (c === "CONEXAO") {
      return MSG.conexao;
    }
    if (c === "IA_INDISPONIVEL" || c === "AUSENTE") {
      return MSG.indisponivel;
    }
    if (c === "RECUSA") {
      return MSG.recusa;
    }
    return MSG.falhou;
  }

  async function pedir(corpo, aoEtapa = () => {}) {
    aoEtapa(0);
    const token = await S.tokenAcesso();
    if (!token) {
      return {
        ok: false,
        codigo: "SEM_LOGIN"
      };
    }
    aoEtapa(1);
    try {
      const r = await fetch(IA.ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planejamento: corpo
        })
      });
      aoEtapa(2);
      if (r.status === 404) {
        return {
          ok: false,
          codigo: "AUSENTE"
        };
      }
      return await r.json().catch(() => null) || {
        ok: false,
        codigo: "FALHOU"
      };
    } catch {
      return {
        ok: false,
        codigo: "CONEXAO"
      };
    }
  }

  // Pela rota geral vão só a pergunta e o retrato em texto (sem nomes).
  async function perguntarLivre(pergunta) {
    try {
      const r = await fetch(ENDPOINT_LIVRE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pergunta: pergunta,
          contexto: contextoConversa
        })
      });
      if (r.status === 404) {
        return {
          ok: false,
          codigo: "AUSENTE"
        };
      }
      const j = await r.json().catch(() => null);
      if (r.ok && j && typeof j.resposta === "string" && j.resposta.trim()) {
        return {
          ok: true,
          resposta: j.resposta.trim()
        };
      }
      return {
        ok: false,
        codigo: r.status === 429 ? "LIMITE" : r.status === 504 ? "DEMOROU" : "FALHOU"
      };
    } catch {
      return {
        ok: false,
        codigo: "CONEXAO"
      };
    }
  }

  // ------------------------------------------------------------ perguntas

  const conversa = $("conversa");
  const campo = $("pergunta");
  const btnPerguntar = $("btnPerguntar");
  const perguntaLivre = $("perguntaLivre");
  const avisoConversa = $("avisoConversa");
  const historico = [];
  const prontas = D.perguntasProntas(diag);
  const htmlSugestoes = () => prontas.map(s => `<button type="button" class="chip chip-finck" data-sugestao="${esc(s.id)}">${esc(s.rotulo)}</button>`).join("");
  $("sugestoes").innerHTML = htmlSugestoes();
  if (!prontas.length) {
    $("rotuloSugestoes").hidden = true;
  }

  function novaTroca(pergunta) {
    const art = document.createElement("article");
    art.className = "troca-finck";
    art.innerHTML = `<p class="troca-finck__pergunta"><span class="visualmente-oculto">Você perguntou: </span>${esc(pergunta)}</p><div class="troca-finck__resposta"></div>`;
    conversa.appendChild(art);
    return art;
  }
  function preencherTroca(art, tipo, html) {
    art.className = `troca-finck troca-finck--${tipo}`;
    art.querySelector(".troca-finck__resposta").innerHTML = html;
  }
  const htmlErro = (r, {comPerguntas: comPerguntas = true} = {}) => `
    <p class="troca-finck__origem">Ajuda opcional</p>
    <p class="troca-finck__texto">${esc(mensagemDoErro(r))}</p>
    <p class="troca-finck__rodape">${esc(VALEM)}${comPerguntas && prontas.length ? " As perguntas acima têm resposta na hora, pelo cálculo do FinCK." : ""}</p>`;

  // Pergunta pronta: resposta calculada no aparelho, sem rede.
  $("conversa").parentElement.addEventListener("click", e => {
    const b = e.target.closest("[data-sugestao]");
    if (!b) {
      return;
    }
    const id = b.dataset.sugestao;
    const ja = conversa.querySelector(`[data-pronta="${CSS.escape(id)}"]`);
    if (ja) {
      rolarAte(ja);
      return;
    }
    const resp = D.responder(diag, id);
    if (!resp) {
      return;
    }
    const art = novaTroca(resp.rotulo || b.textContent);
    art.dataset.pronta = id;
    preencherTroca(art, "calculo", `
      <p class="troca-finck__origem">Cálculo do FinCK</p>
      <p class="troca-finck__texto">${esc(resp.texto)}</p>
      ${htmlConta(resp.calculo)}
      ${selo(resp.certeza)}`);
    rolarAte(art);
  });

  // Por onde a pergunta livre vai: com conta e a rota da revisão no ar, por
  // ela; senão pela rota geral. Descoberto só quando a pessoa abre o trecho,
  // foca o campo ou envia.
  let foraDoAr = false;
  async function canal() {
    if (foraDoAr) {
      return {
        canal: null
      };
    }
    if (comExplicacao) {
      const m = await rotaAssistente();
      if (m.tipo === "ia") {
        return {
          canal: "assistente"
        };
      }
    }
    const livre = await iaLivre();
    return livre && livre.ok === false ? {
      canal: null
    } : {
      canal: "livre"
    };
  }
  function mostrarIndisponivel() {
    foraDoAr = true;
    avisoConversa.textContent = `${MSG.indisponivel} ${VALEM}${prontas.length ? " As perguntas acima têm resposta na hora, pelo cálculo do FinCK." : ""}`;
    avisoConversa.hidden = false;
    $("camposConversa").hidden = true;
  }
  async function conferirConversa() {
    const c = await canal();
    if (!c.canal) {
      mostrarIndisponivel();
    }
    return c;
  }
  let abertaPeloCodigo = false;
  perguntaLivre.addEventListener("toggle", () => {
    if (perguntaLivre.open && !abertaPeloCodigo) {
      conferirConversa();
    }
    abertaPeloCodigo = false;
  });
  campo.addEventListener("focus", () => {
    conferirConversa();
  }, {
    once: true
  });
  const conta = $("perguntaConta");
  const atualizarConta = () => {
    conta.textContent = `${campo.value.length} de ${MAX_PERGUNTA} caracteres`;
  };
  campo.addEventListener("input", atualizarConta);

  document.querySelector("[data-abrir-envio]")?.addEventListener("click", e => {
    e.preventDefault();
    const det = $("dadosPrivacidade");
    det.open = true;
    rolarAte(det, "start");
    det.querySelector("summary").focus({
      preventScroll: true
    });
  });

  const ETAPAS_LIVRE = [ "Enviando a pergunta e os números desta revisão…" ];
  const ETAPAS_CONTA = [ "Conferindo a sua sessão…", "Enviando a pergunta e o retrato agregado…", "Conferindo a resposta…" ];
  let enviando = false;
  $("formPergunta").addEventListener("submit", async e => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (texto.length < 3) {
      return U.erroCampo("pergunta", "Escreva a sua pergunta.");
    }
    if (enviando) {
      return;
    }
    enviando = true;
    btnPerguntar.setAttribute("aria-busy", "true");
    btnPerguntar.disabled = true;
    try {
      const c = await conferirConversa();
      if (!c.canal) {
        avisoConversa.focus();
        return;
      }
      const livre = c.canal === "livre";
      const ETAPAS = livre ? ETAPAS_LIVRE : ETAPAS_CONTA;
      const art = novaTroca(texto);
      preencherTroca(art, "espera", `<p class="troca-finck__origem">Ajuda opcional</p><p class="troca-finck__espera"><span class="ponto-espera" aria-hidden="true"></span> <span data-etapa>${esc(ETAPAS[0])}</span></p>`);
      rolarAte(art);
      campo.value = "";
      atualizarConta();
      const etapa = art.querySelector("[data-etapa]");
      const r = livre ? await perguntarLivre(texto) : await pedir({
        modo: "pergunta",
        retrato: retrato,
        pergunta: texto,
        historico: historico.slice(-6)
      }, i => {
        etapa.textContent = ETAPAS[i];
      });
      if (!r || !r.ok) {
        preencherTroca(art, "erro", htmlErro(r));
        // A pergunta volta para o campo, para tentar de novo sem reescrever.
        if (!campo.value) {
          campo.value = texto;
          atualizarConta();
        }
        if (r?.codigo === "AUSENTE") {
          mostrarIndisponivel();
        }
        return;
      }
      if (livre) {
        preencherTroca(art, "ia", `
          <p class="troca-finck__origem">${esc(ROTULO_IA)}</p>
          <p class="troca-finck__texto">${esc(r.resposta)}</p>
          <p class="troca-finck__rodape">${demo ? "Com os números de exemplo da demonstração, sem" : "Sem"} nomes de metas, contas ou lançamentos.</p>`);
        return;
      }
      const baseado = Array.isArray(r.baseado_em) ? r.baseado_em : [];
      preencherTroca(art, "ia", `
        <p class="troca-finck__origem">${esc(ROTULO_IA)}</p>
        <p class="troca-finck__texto">${esc(r.resposta)}</p>
        ${r.proximo_passo ? `<p class="troca-finck__rodape"><strong>Uma sugestão:</strong> ${esc(r.proximo_passo)}</p>` : ""}
        ${baseado.length ? `<p class="troca-finck__rodape">Dimensões usadas: ${baseado.map(id => esc(NOMES[id] || id)).join(", ")}.</p>` : ""}
        ${r.fora_do_escopo ? `<p class="troca-finck__rodape">Essa pergunta foge desta revisão; a ajuda responde melhor sobre renda, gastos, reserva, parcelas, metas e decisões de compra.</p>` : ""}`);
      historico.push({
        papel: "pessoa",
        texto: texto
      }, {
        papel: "assistente",
        texto: r.resposta
      });
    } finally {
      enviando = false;
      btnPerguntar.disabled = false;
      btnPerguntar.removeAttribute("aria-busy");
    }
  });

  // ------------------------------------------------------------ explicação escrita

  const secaoExplicacao = $("secaoExplicacao");
  const btnExplicacao = $("btnExplicacao");
  const statusExplicacao = $("statusExplicacao");
  const listaEtapas = $("etapasExplicacao");
  const PRAZO_ORDEM = [ "esta semana", "este mês", "nos próximos 3 meses" ];

  function renderExplicacao(p, {em: em = null, aviso: aviso = null} = {}) {
    const prioridades = p.prioridades.slice().sort((a, b) => PRAZO_ORDEM.indexOf(a.prazo) - PRAZO_ORDEM.indexOf(b.prazo));
    $("explicacao").innerHTML = `
      ${aviso ? `<p class="nota plano__aviso">${esc(aviso)}</p>` : ""}
      <article class="troca-finck troca-finck--ia explicacao-escrita">
        <p class="troca-finck__origem">${esc(ROTULO_EXPLICACAO)}${em ? ` (${esc(U.dataBR(em))})` : ""}</p>
        <p class="troca-finck__texto">${esc(p.diagnostico)}</p>
        ${p.pontos_fortes && p.pontos_fortes.length ? `<div class="plano__fortes"><h4>O que já vai bem</h4><ul>${p.pontos_fortes.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
        <h4>As próximas ações, explicadas</h4>
        <ol class="explicacao-escrita__acoes">${prioridades.map(x => `
          <li>
            <div class="acao-revisao__topo"><strong>${esc(x.titulo)}</strong><span class="chip-prazo">${esc(x.prazo)}</span></div>
            <p>${esc(x.porque)}</p>
            ${x.passos && x.passos.length ? `<ul class="plano__passos">${x.passos.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
            <small class="prioridade__origem">Dimensão: ${esc(NOMES[x.baseado_em] || x.baseado_em)}</small>
          </li>`).join("")}</ol>
        ${p.metas_sugeridas && p.metas_sugeridas.length ? `<div class="plano__metas"><h4>Metas sugeridas</h4>${p.metas_sugeridas.map(m => `
          <div class="meta-sugerida">
            <strong>${esc(m.nome)}</strong>
            <span class="meta-sugerida__valor">${U.moeda(m.valor_mensal)}<small>/mês</small></span>
            <p>${esc(m.motivo || "")}</p>
          </div>`).join("")}<p class="nota">Uma sugestão não vira meta sozinha: ela só existe se você criar.</p></div>` : ""}
        ${p.habito_da_semana ? `<div class="plano__habito"><h4>Hábito sugerido</h4><p>${esc(p.habito_da_semana)}</p></div>` : ""}
        ${p.alerta ? `<p class="alerta">${esc(p.alerta)}</p>` : ""}
        ${p.faltam_dados && p.faltam_dados.length ? `<div class="plano__faltam"><h4>Para a revisão ficar mais precisa</h4><ul>${p.faltam_dados.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
        <p class="troca-finck__rodape">As contas são do FinCK. É educativo: não é recomendação de investimento nem consultoria financeira.</p>
      </article>`;
    btnExplicacao.textContent = "Pedir uma nova explicação (usa IA)";
  }

  function guardar(p) {
    try {
      localStorage.setItem(chaveLocal, JSON.stringify({
        plano: p,
        em: U.hojeISO(),
        assinatura: assinatura
      }));
    } catch {}
  }
  function lembrado() {
    try {
      return JSON.parse(localStorage.getItem(chaveLocal) || "null");
    } catch {
      return null;
    }
  }

  // Etapas reais do pedido: sessão, envio e espera, conferência da resposta.
  // Nada de progresso inventado; o aviso de demora só aparece se demorar.
  const ETAPAS_PLANO = [ "Conferindo a sua sessão…", "Enviando o retrato agregado e esperando a resposta…", "Conferindo a resposta antes de mostrar…" ];
  let alarmeDemora = null;
  function mostrarEtapa(i) {
    listaEtapas.hidden = false;
    listaEtapas.innerHTML = ETAPAS_PLANO.map((t, k) => `<li data-estado="${k < i ? "feita" : k === i ? "atual" : "proxima"}">${k < i ? '<span class="visualmente-oculto">Feito: </span>' : ""}${esc(t)}</li>`).join("");
    statusExplicacao.textContent = ETAPAS_PLANO[i];
    clearTimeout(alarmeDemora);
    if (i === 1) {
      alarmeDemora = setTimeout(() => {
        statusExplicacao.textContent = "A resposta está levando mais tempo que o normal. O limite é de cerca de um minuto.";
      }, 2e4);
    }
  }
  function esconderEtapas() {
    clearTimeout(alarmeDemora);
    listaEtapas.hidden = true;
    listaEtapas.innerHTML = "";
  }
  function explicacaoIndisponivel() {
    const aviso = $("explicacaoIndisponivel");
    aviso.textContent = `A explicação escrita não está disponível agora. ${VALEM}`;
    aviso.hidden = false;
    btnExplicacao.hidden = true;
    return aviso;
  }
  // Ao abrir o trecho, a página pergunta se a rota existe. Fora do ar, o
  // botão some e fica a frase; sem conexão, o botão fica e o envio explica.
  async function conferirExplicacao() {
    const m = await rotaAssistente();
    if (m.tipo !== "ia" && m.codigo !== "CONEXAO") {
      explicacaoIndisponivel();
      return false;
    }
    return true;
  }

  if (comExplicacao) {
    secaoExplicacao.hidden = false;
    secaoExplicacao.addEventListener("toggle", () => {
      if (secaoExplicacao.open) {
        conferirExplicacao();
      }
    });
    // A última explicação volta ao abrir a tela, já dentro do trecho; se os
    // números mudaram desde então, a tela avisa em vez de fingir que é de hoje.
    const salvo = lembrado();
    if (salvo?.plano?.origem === "ia" && Array.isArray(salvo.plano.prioridades)) {
      renderExplicacao(salvo.plano, {
        em: salvo.em,
        aviso: salvo.assinatura !== assinatura ? "Os seus números mudaram desde esta explicação. Peça de novo para considerar a situação de hoje." : null
      });
      $("resumoExplicacao").textContent = `Há uma explicação salva neste aparelho${salvo.em ? `, de ${U.dataBR(salvo.em)}` : ""}.`;
    }
    btnExplicacao.addEventListener("click", async () => {
      if (btnExplicacao.getAttribute("aria-busy") === "true") {
        return;
      }
      btnExplicacao.disabled = true;
      btnExplicacao.setAttribute("aria-busy", "true");
      const rotulo = btnExplicacao.textContent;
      btnExplicacao.textContent = "Pedindo a explicação…";
      try {
        if (!await conferirExplicacao()) {
          $("explicacaoIndisponivel").focus();
          return;
        }
        rolarAte(listaEtapas);
        const r = await pedir({
          modo: "plano",
          retrato: retrato
        }, mostrarEtapa);
        esconderEtapas();
        if (!r || !r.ok || !Array.isArray(r.prioridades)) {
          // O erro entra acima da última explicação salva, sem apagá-la.
          const host = $("explicacao");
          host.querySelector(":scope > .troca-finck--erro")?.remove();
          host.insertAdjacentHTML("afterbegin", `<article class="troca-finck troca-finck--erro">${htmlErro(r, {
            comPerguntas: false
          })}</article>`);
          statusExplicacao.textContent = "A explicação escrita não veio. As próximas ações desta página continuam valendo.";
          if (r?.codigo === "AUSENTE" || r?.codigo === "IA_INDISPONIVEL") {
            explicacaoIndisponivel();
          }
          return;
        }
        guardar(r);
        renderExplicacao(r, {
          em: U.hojeISO()
        });
        statusExplicacao.textContent = "Explicação escrita pronta, logo abaixo. Ela fica salva só neste aparelho.";
      } finally {
        esconderEtapas();
        btnExplicacao.disabled = false;
        btnExplicacao.removeAttribute("aria-busy");
        if (btnExplicacao.textContent === "Pedindo a explicação…") {
          btnExplicacao.textContent = $("explicacao").querySelector(".explicacao-escrita") ? "Pedir uma nova explicação (usa IA)" : rotulo;
        }
      }
    });
  }

  // ------------------------------------------------------------ vinda do Reality

  // "Ver esta compra na Revisão financeira": a pergunta neutra sobre a compra
  // chega escrita no campo da pergunta livre, com o trecho aberto. Nada é
  // enviado sem a pessoa pedir.
  const vinda = new URLSearchParams(location.search).get("pergunta");
  if (vinda) {
    campo.value = vinda.slice(0, MAX_PERGUNTA);
    atualizarConta();
    $("secaoConversa").open = true;
    abertaPeloCodigo = true;
    perguntaLivre.open = true;
    rolarAte(perguntaLivre, "start");
  }
});
