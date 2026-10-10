document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const R = window.FinckReality;
  const G = window.FinckGame;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "FinCK of Reality",
    subtitulo: "Antes de comprar, descubra o impacto"
  });
  if (!user) {
    return;
  }
  const $ = id => document.getElementById(id);
  const esc = U.escapeHTML;
  let ctx = await F.carregarContexto();
  let locais = await carregarLocais();
  let resultado = null;
  let entrada = null;
  let decisao = null;
  let registroId = null;
  // A opção guardada para comparar e a última
  // análise do mesmo item, para mostrar o que mudou ao refazer a conta.
  let comparando = null;
  let anterior = null;
  let analisando = false;
  // O que está gravado de verdade, lido de volta da base depois de cada
  // gravação: a decisão salva na análise e a saída que ela lançou no
  // extrato (id e valor). A tela confirma a partir daqui, não da intenção.
  let decisaoGravada = null;
  let totalGravado = null;
  let saida = null;
  let lancamentos = 0;
  const decisaoSalva = () => Boolean(decisaoGravada) && decisao === decisaoGravada;
  const campoCategoria = $("itemCategory");
  campoCategoria.innerHTML = cfg.CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join("");
  campoCategoria.value = "Outros";
  $("itemDestino").innerHTML = `<option value="">Prefiro não dizer</option>` + cfg.DESTINOS_ITEM.map(d => `<option value="${d.id}">${esc(d.rotulo)}</option>`).join("");
  const horasPorDia = () => Number(ctx.perfil?.work_hours_day) || cfg.PADRAO.work_hours_day;
  // Rolagem suave só quando a pessoa e o sistema deixam (Perfil e
  // prefers-reduced-motion).
  const movimentoLiberado = () => {
    const reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return !reduz && (document.documentElement.dataset.animacoes || "completa") === "completa";
  };
  // "instant", e não "auto": com "auto" vale o scroll-behavior:smooth do CSS.
  const comportamentoRolagem = () => movimentoLiberado() ? "smooth" : "instant";
  // Leva uma etapa ao topo, logo abaixo do header e das etapas presas
  // (scroll-padding do html) e da margem da própria seção. A conta é feita
  // aqui porque a rolagem suave do navegador erra o alvo quando a seção
  // acabou de aparecer e ainda está na animação de entrada.
  function rolarAte(el) {
    if (!el) {
      return;
    }
    const folga = (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) + (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    let topo = 0;
    for (let n = el; n; n = n.offsetParent) {
      topo += n.offsetTop;
    }
    rolarJanela(Math.max(0, topo - folga));
  }
  // Navegador antigo que não conhece "instant" recusa a opção; aí vale a
  // rolagem simples.
  function rolarJanela(top, {imediato: imediato = false} = {}) {
    try {
      window.scrollTo({
        top: top,
        behavior: imediato ? "instant" : comportamentoRolagem()
      });
    } catch {
      window.scrollTo(0, top);
    }
  }

  // A categoria é sugestão, não decisão: a pílula diz de onde ela veio
  // e a pessoa confirma ou troca. Pelo nome do item é regra do FinCK; pelo
  // print ou pelo link lido pela IA, é a IA do Google; lida direto na página
  // da loja, sem IA, é o leitor da página.
  const pilulaCategoria = $("categoriaInferida");
  const ORIGEM_CATEGORIA = {
    "ia-print": "Sugestão da IA do Google, lida no print",
    "ia-link": "Sugestão da IA do Google, lida no link",
    pagina: "Sugestão lida na página da loja"
  };
  function estadoCategoria() {
    if (campoCategoria.dataset.escolhida) {
      return "escolhida";
    }
    return campoCategoria.dataset.confirmada ? "confirmada" : "sugerida";
  }
  let pilulaAtual = "";
  function mostrarCategoria() {
    const nome = $("itemName").value.trim();
    if (!nome) {
      pilulaCategoria.hidden = true;
      pilulaAtual = "";
      return;
    }
    const estado = estadoCategoria();
    const origem = campoCategoria.dataset.origem;
    const reconhecida = Boolean(origem || campoCategoria.dataset.inferida);
    const chave = `${estado}|${origem || ""}|${reconhecida}|${campoCategoria.value}`;
    pilulaCategoria.hidden = false;
    // A pílula é aria-live: só muda o texto quando a categoria muda, não
    // a cada letra digitada no nome.
    if (chave === pilulaAtual) {
      return;
    }
    pilulaAtual = chave;
    const cat = esc(campoCategoria.value);
    if (estado !== "sugerida") {
      pilulaCategoria.innerHTML = `<span>Categoria: <strong>${cat}</strong> <span class="categoria-inferida__ok">✓ ${estado === "confirmada" ? "confirmada" : "escolhida por você"}</span></span>
        <button type="button" class="btn-texto" data-alterar-categoria>Alterar</button>`;
      return;
    }
    if (!reconhecida) {
      pilulaCategoria.innerHTML = `<span>O FinCK não reconheceu a categoria pelo nome. Ficou <strong>${cat}</strong>.</span>
        <button type="button" class="btn-texto" data-alterar-categoria>Escolher categoria</button>`;
      return;
    }
    pilulaCategoria.innerHTML = `<span>${esc(ORIGEM_CATEGORIA[origem] || "Sugestão do FinCK")}: <strong>${cat}</strong>.</span>
      <span class="categoria-inferida__acoes">
        <button type="button" class="btn-texto" data-confirmar-categoria>Confirmar</button>
        <button type="button" class="btn-texto" data-alterar-categoria>Alterar</button>
      </span>`;
  }
  function sugerirCategoria() {
    if (estadoCategoria() === "sugerida") {
      const inferida = R.inferirCategoria($("itemName").value);
      if (inferida) {
        // O nome aponta outra categoria: a sugestão passa a ser do FinCK.
        if (inferida !== campoCategoria.value) {
          delete campoCategoria.dataset.origem;
        }
        campoCategoria.value = inferida;
        campoCategoria.dataset.inferida = "1";
      } else if (!campoCategoria.dataset.origem) {
        // Sem pista no nome, a sugestão que veio do link ou do print fica.
        campoCategoria.value = "Outros";
        delete campoCategoria.dataset.inferida;
      }
    }
    mostrarCategoria();
  }
  function esquecerCategoria() {
    [ "escolhida", "confirmada", "origem", "inferida" ].forEach(k => delete campoCategoria.dataset[k]);
    campoCategoria.value = "Outros";
    pilulaCategoria.hidden = true;
    pilulaAtual = "";
  }
  $("itemName").addEventListener("input", sugerirCategoria);
  campoCategoria.addEventListener("change", () => {
    campoCategoria.dataset.escolhida = "1";
    mostrarCategoria();
    atualizarCategoriaNaResposta();
  });
  // A busca pelo link ou pelo print também pode trazer a categoria.
  campoCategoria.addEventListener("finck:categoria", mostrarCategoria);
  document.addEventListener("click", e => {
    if (e.target.closest("[data-confirmar-categoria]")) {
      campoCategoria.dataset.confirmada = "1";
      mostrarCategoria();
      atualizarCategoriaNaResposta();
      pilulaCategoria.querySelector("[data-alterar-categoria]")?.focus();
      return;
    }
    if (!e.target.closest("[data-alterar-categoria]")) {
      return;
    }
    const detalhes = $("detalhesVidaUtil");
    detalhes.open = true;
    campoCategoria.focus();
  });

  // O link fica guardado até a pessoa pedir: quem já sabe o preço não precisa
  // entender a busca automática para seguir.
  const botaoLink = $("btnMostrarLink");
  botaoLink.addEventListener("click", () => {
    const area = $("areaLink");
    area.hidden = !area.hidden;
    botaoLink.setAttribute("aria-expanded", String(!area.hidden));
    if (!area.hidden) {
      $("itemLink").focus();
    }
  });

  // Vida útil em linguagem comum: os atalhos só preenchem o campo, que
  // continua aceitando qualquer número.
  const campoMeses = $("itemMeses");
  const chipsMeses = [ ...document.querySelectorAll("[data-meses]") ];
  function marcarChipsMeses() {
    chipsMeses.forEach(b => b.setAttribute("aria-pressed", String(campoMeses.value === b.dataset.meses)));
  }
  chipsMeses.forEach(b => b.addEventListener("click", () => {
    campoMeses.value = b.dataset.meses;
    campoMeses.dispatchEvent(new Event("input", {
      bubbles: true
    }));
  }));
  campoMeses.addEventListener("input", marcarChipsMeses);

  // 1 Compra, 2 Revelação (com "Quer olhar mais fundo?"), 3 Reflexão, 4 Decisão.
  const ORDEM_ETAPAS = [ "passoDados", "passoResultado", "passoReflexao", "passoDecisao" ];
  function marcarEtapas() {
    const nav = $("etapasReality");
    if (!nav) {
      return;
    }
    const visiveis = ORDEM_ETAPAS.filter(id => !$(id).hidden);
    const linha = window.innerHeight * .4;
    let atual = visiveis[0];
    visiveis.forEach(id => {
      if ($(id).getBoundingClientRect().top < linha) {
        atual = id;
      }
    });
    const iAtual = ORDEM_ETAPAS.indexOf(atual);
    nav.querySelectorAll("[data-etapa-reality]").forEach(li => {
      const id = li.dataset.etapaReality;
      const i = ORDEM_ETAPAS.indexOf(id);
      const link = li.querySelector("a");
      const disponivel = !$(id).hidden;
      li.dataset.estado = !disponivel ? "bloqueada" : i < iAtual ? "feita" : i === iAtual ? "atual" : "proxima";
      link.setAttribute("aria-disabled", String(!disponivel));
      if (i === iAtual) {
        link.setAttribute("aria-current", "step");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }
  // Quando as etapas abrem, a 2 acende uma vez no indicador.
  function destacarLiberadas() {
    const li = document.querySelector('[data-etapa-reality="passoResultado"]');
    if (!li) {
      return;
    }
    li.classList.remove("etapas-reality__liberada");
    void li.offsetWidth;
    li.classList.add("etapas-reality__liberada");
    li.addEventListener("animationend", () => li.classList.remove("etapas-reality__liberada"), {
      once: true
    });
  }
  $("etapasReality")?.addEventListener("click", e => {
    const link = e.target.closest("a");
    if (!link) {
      return;
    }
    e.preventDefault();
    if (link.getAttribute("aria-disabled") === "true") {
      return;
    }
    rolarAte(document.querySelector(link.getAttribute("href")));
  });
  window.addEventListener("scroll", () => requestAnimationFrame(marcarEtapas), {
    passive: true
  });
  marcarEtapas();

  const form = $("formReality");
  const botaoVer = $("btnVerImpacto");
  const status = $("statusProcesso");
  const etapa = texto => {
    if (status.textContent !== texto) {
      status.textContent = texto;
    }
  };
  // Regiões vivas só mudam quando o texto muda: reescrever a mesma frase
  // faz o leitor de tela repetir.
  const escreverSeMudou = (el, texto) => {
    if (el && el.textContent !== texto) {
      el.textContent = texto;
    }
  };
  const TEXTO_BOTAO = {
    inicial: "Ver o impacto da compra",
    atualizar: "Atualizar o impacto"
  };
  function botaoOcupado(texto) {
    botaoVer.disabled = true;
    botaoVer.setAttribute("aria-busy", "true");
    botaoVer.textContent = texto;
  }
  function botaoLivre(texto) {
    botaoVer.disabled = false;
    botaoVer.removeAttribute("aria-busy");
    botaoVer.textContent = texto;
  }

  // As quatro etapas da análise, marcadas conforme cada parte da conta
  // termina de verdade. Entre uma e outra o navegador só desenha a tela.
  const progresso = $("progressoAnalise");
  const ETAPAS_ANALISE = [ "dados", "orcamento", "metas", "cenarios" ];
  const TEXTO_ESTADO = {
    feita: "Feito: ",
    atual: "Em andamento: ",
    proxima: "A fazer: "
  };
  function marcarProgresso(atual) {
    if (!progresso) {
      return;
    }
    progresso.hidden = atual === null;
    if (atual === null) {
      return;
    }
    progresso.querySelectorAll("[data-etapa-analise]").forEach(li => {
      const i = ETAPAS_ANALISE.indexOf(li.dataset.etapaAnalise);
      const estado = i < atual ? "feita" : i === atual ? "atual" : "proxima";
      li.dataset.estado = estado;
      const texto = li.querySelector("[data-estado-texto]");
      if (texto) {
        texto.textContent = TEXTO_ESTADO[estado];
      }
    });
    progresso.classList.toggle("progresso-analise--pronta", atual >= ETAPAS_ANALISE.length);
  }
  const deixarPintar = () => new Promise(resolver => {
    if (document.hidden) {
      resolver();
      return;
    }
    requestAnimationFrame(() => setTimeout(resolver, 0));
  });
  // O 3D do topo e o fundo reagem de leve enquanto a conta roda.
  const marcaHeroi = document.querySelector(".hero--reality .marca3d-cena");
  function sinalizarAnalise(ativa) {
    marcaHeroi?.classList.toggle("marca3d-cena--analisando", ativa);
    window.FinckFundo?.analisando?.(ativa);
  }

  // Mexeu em qualquer campo depois do resultado: o botão passa a atualizar.
  form.addEventListener("input", () => {
    if (resultado && !analisando) {
      botaoVer.textContent = TEXTO_BOTAO.atualizar;
      marcarProgresso(null);
    }
  });
  form.addEventListener("submit", e => {
    e.preventDefault();
    analisar();
  });

  // Uma análise inteira. rolar=false é a análise refeita de dentro do
  // resultado (uma resposta na Análise FinCK): a tela fica onde a pessoa
  // está e o foco fica com quem pediu.
  async function analisar({rolar: rolar = true} = {}) {
    if (analisando) {
      return;
    }
    const item_name = $("itemName").value.trim();
    const price = U.lerMoeda("itemPrice");
    const category = campoCategoria.value;
    const note = $("itemNote").value.trim();
    let item_link = $("itemLink").value.trim();
    $("alertaRenda").hidden = true;
    if (!item_name) {
      return U.erroCampo("itemName", "Diga o que você quer comprar.");
    }
    if (!(price > 0)) {
      return U.erroCampo("itemPrice", window.FinckMoeda?.ERRO || "Digite um valor válido, como R$ 800,00.");
    }
    if (item_link && !/^https?:\/\//i.test(item_link)) {
      item_link = `https://${item_link}`;
    }
    if (item_link) {
      try {
        new URL(item_link);
      } catch {
        $("areaLink").hidden = false;
        botaoLink.setAttribute("aria-expanded", "true");
        return U.erroCampo("itemLink", "Este link parece incompleto. Confira o endereço ou apague o campo.");
      }
    }
    const ancora = $("analiseFinck");
    const topoAntes = !rolar && ancora && !ancora.hidden ? ancora.getBoundingClientRect().top : null;
    const primeiraVez = $("passoResultado").hidden;
    analisando = true;
    let pronta = false;
    // Refeita de dentro da Análise FinCK (rolar=false), quem anuncia é o
    // próprio bloco; aqui as etapas ficam só na tela.
    const anunciar = texto => {
      if (rolar) {
        etapa(texto);
      }
    };
    botaoOcupado("Lendo seus dados…");
    marcarProgresso(0);
    anunciar("Lendo seus dados financeiros…");
    sinalizarAnalise(true);
    // A lista de etapas nasce logo abaixo do botão; se ele estava no pé da
    // tela, sobe o bastante para ela não ficar atrás da navegação.
    if (rolar && progresso) {
      const caixa = progresso.getBoundingClientRect();
      const limite = window.innerHeight - (parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) || 0);
      if (caixa.bottom > limite) {
        rolarJanela(window.scrollY + caixa.bottom - limite);
      }
    }
    try {
      ctx = await F.carregarContexto();
      locais = await carregarLocais();
      if (!(Number(ctx.perfil?.income_monthly) > 0)) {
        // Erro de operação importante: aviso persistente no fluxo, com saída.
        const alerta = $("alertaRenda");
        alerta.hidden = false;
        alerta.innerHTML = `<p><strong>Falta a sua renda mensal.</strong> É com ela que o preço vira horas de trabalho.</p>
          <a class="btn-secundario btn-mini" href="perfil.html">Informar minha renda no Perfil</a>`;
        marcarProgresso(null);
        etapa("");
        return;
      }
      botaoOcupado("Calculando o impacto…");
      marcarProgresso(1);
      anunciar("Calculando o impacto no orçamento…");
      await deixarPintar();
      const quantidade = Number($("itemQuantidade").value) || null;
      const mesesDeUso = Number(campoMeses.value) || null;
      const destino = $("itemDestino").value || null;
      const mesmoItem = Boolean(anterior && anterior.nome.toLowerCase() === item_name.toLowerCase());
      // Refazer a conta do mesmo item não apaga o que a pessoa já respondeu.
      const reflexoesAntes = mesmoItem ? coletarReflexoes() : {};
      const totalNovo = price * (quantidade || 1);
      // Com decisão já salva e outro valor, a análise salva fica como está
      // (com a saída, se houve) e esta passa a ser uma análise nova.
      const novaAposDecisao = Boolean(registroId && decisaoGravada && (!mesmoItem || Math.abs(totalNovo - (totalGravado ?? totalNovo)) > .004));
      const anteriorSalva = novaAposDecisao ? DECISAO(decisaoGravada)?.label : null;
      if (novaAposDecisao || !mesmoItem && registroId) {
        esquecerRegistro();
      }
      // A decisão da análise anterior não passa para a nova: escolher de novo
      // é da pessoa (e "Comprar agora" lançaria outra saída).
      const decisaoAntes = mesmoItem && !novaAposDecisao ? decisaoGravada || decisao : null;
      entrada = {
        item_name: item_name,
        price: price,
        category: category,
        note: note,
        item_link: item_link || null,
        quantity: quantidade,
        expected_months: mesesDeUso,
        end_of_life: destino
      };
      // Os nomes e os números da página inicial (ctx.projecoes): saldo
      // depois das parcelas e, com a programação carregada, as contas já
      // previstas para 60 dias. O dia a dia vem da mesma estimativa que abre
      // a linha do tempo.
      const proj = ctx.projecoes || {};
      let diaADia = 0;
      try {
        diaADia = window.FinckLinhaTempo ? window.FinckLinhaTempo.base(ctx).dia_a_dia : 0;
      } catch {}
      resultado = R.calcular(price, ctx.perfil, {
        saldo: ctx.saldo,
        despesasFixas: ctx.despesasFixas,
        compromissosAbertos: ctx.compromissosAbertos,
        quantidade: quantidade,
        mesesDeUso: mesesDeUso,
        metas: ctx.metas,
        movimentosMeta: ctx.movimentosMeta,
        diaADia: diaADia,
        caixa60: proj.caixaAposPrevisoes60Dias,
        menorCaixa60: proj.menorCaixaComEntradas60Dias,
        saidas60: proj.saidasPrevistas60Dias
      });
      const mudancas = mesmoItem && !comparando ? R.oQueMudou(anterior.resultado, resultado) : [];
      renderComparacao();
      renderResposta(mudancas);
      renderIndicadores();
      renderOrcamento();
      marcarProgresso(2);
      anunciar("Conferindo suas metas…");
      await deixarPintar();
      renderMetas();
      marcarProgresso(3);
      anunciar("Montando os cenários…");
      await deixarPintar();
      // O filme da compra: os próximos meses, parcelas e o teste do imprevisto.
      window.FinckLinhaTempoUI?.mostrar({
        ctx: ctx,
        item: item_name,
        preco: price * (quantidade || 1),
        nivel: resultado.semaforo.nivel
      });
      // A Análise FinCK lê os mesmos números e a linha do tempo recém-feita.
      window.FinckInteligenciaUI?.mostrar({
        ctx: ctx,
        entrada: entrada,
        resultado: resultado,
        linhaTempo: window.FinckLinhaTempoUI?.analiseAtual?.() || null,
        host: $("analiseFinck"),
        aoEscolher: aoEscolher
      });
      renderAlternativas();
      renderDestino();
      renderReflexoes(reflexoesAntes);
      renderDecisoes();
      if (decisaoAntes) {
        selecionarDecisao(decisaoAntes);
      }
      resumirMaisFundo();
      anterior = {
        nome: item_name,
        resultado: resultado
      };
      // ODS 12: o que a compra pesa para o planeta, estimado por IA. Carrega à
      // parte, depois do resultado, e não segura a análise financeira.
      window.FinckImpacto?.mostrar({
        item: item_name,
        categoria: category,
        preco: price,
        quantidade: quantidade,
        mesesDeUso: mesesDeUso
      }, $("impactoAmbiental"), {
        pontos: blocoPontos
      });
      [ "passoResultado", "passoReflexao", "passoDecisao" ].forEach(id => {
        $(id).hidden = false;
      });
      window.FinckFundo?.tom(resultado.semaforo.nivel === "verde" ? "positivo" : "neutro");
      marcarProgresso(ETAPAS_ANALISE.length);
      pronta = true;
      if (rolar) {
        rolarAte($("passoResultado"));
        $("respostaReality").focus({
          preventScroll: true
        });
      } else if (topoAntes !== null) {
        // O bloco de cima pode ter mudado de altura; a Análise FinCK fica
        // onde estava na tela.
        rolarJanela(window.scrollY + ancora.getBoundingClientRect().top - topoAntes, {
          imediato: true
        });
      }
      $("btnRegistrarCalculo").disabled = false;
      escreverSeMudou($("statusRegistro"), anteriorSalva ? `A análise anterior continua em Minhas análises, com a decisão ${anteriorSalva}. Esta é uma análise nova, ainda não salva.` : registroId ? "Análise salva antes desta mudança. Salve de novo para guardar a versão atualizada." : "Esta análise ainda não foi salva. Salve para guardar no seu histórico.");
      if (rolar) {
        etapa(primeiraVez ? "Análise pronta. Etapa 2 liberada: o que essa compra significa. As etapas 3 e 4 também estão abertas." : "Análise atualizada.");
      }
      if (primeiraVez) {
        destacarLiberadas();
      }
      marcarCiclo();
      marcarEtapas();
    } catch (err) {
      console.error(err);
      marcarProgresso(null);
      etapa("");
      const alerta = $("alertaRenda");
      alerta.hidden = false;
      alerta.innerHTML = `<p><strong>Não deu para analisar agora.</strong> ${esc(err?.message || "")} Confira a conexão e tente de novo.</p>`;
    } finally {
      analisando = false;
      sinalizarAnalise(false);
      botaoLivre(pronta ? "Análise pronta" : resultado ? TEXTO_BOTAO.atualizar : TEXTO_BOTAO.inicial);
    }
  }

  // Respostas da Análise FinCK (js/inteligencia.js) que mudam a conta.
  function aoEscolher({campo: campo, valor: valor} = {}) {
    if (campo === "expected_months") {
      const meses = Math.round(Number(valor) || 0);
      if (!(meses >= 1 && meses <= 600)) {
        return;
      }
      campoMeses.value = String(meses);
      marcarChipsMeses();
      analisar({
        rolar: false
      });
      return;
    }
    if (campo === "forma") {
      const forma = valor === "avista" ? "avista" : "parcelado";
      const radio = document.querySelector(`input[name="ltForma"][value="${forma}"]`);
      if (!radio) {
        return;
      }
      if (radio.checked) {
        agendarAtualizacaoAnalise();
        return;
      }
      radio.checked = true;
      // O change chega ao formulário da linha do tempo, que refaz a conta;
      // o ouvinte abaixo leva a nova linha do tempo para a Análise FinCK.
      radio.dispatchEvent(new Event("change", {
        bubbles: true
      }));
    }
  }
  let relogioAnalise = null;
  function agendarAtualizacaoAnalise() {
    clearTimeout(relogioAnalise);
    relogioAnalise = setTimeout(() => {
      window.FinckInteligenciaUI?.atualizar?.({
        linhaTempo: window.FinckLinhaTempoUI?.analiseAtual?.() || null
      });
    }, 250);
  }
  $("formLinhaTempo")?.addEventListener("input", agendarAtualizacaoAnalise);
  $("formLinhaTempo")?.addEventListener("change", agendarAtualizacaoAnalise);

  // Meses ou dias, do jeito que se fala: "12 dias", "2,5 meses".
  const duracao = dias => R.textoDuracao(dias);

  // A mesma origem da pílula: cada caminho diz quem leu de verdade.
  const ORIGEM_NA_RESPOSTA = {
    "ia-print": " (sugestão da IA do Google)",
    "ia-link": " (sugestão da IA do Google)",
    pagina: " (lida na página da loja)"
  };
  function textoCategoriaResposta() {
    const estado = estadoCategoria();
    const dataset = campoCategoria.dataset;
    const origem = estado !== "sugerida" ? "" : dataset.origem ? ORIGEM_NA_RESPOSTA[dataset.origem] || " (sugestão do FinCK)" : dataset.inferida ? " (sugestão do FinCK)" : "";
    return `Categoria: <strong>${esc(entrada.category)}</strong>${origem}
        <button type="button" class="btn-texto" data-alterar-categoria>Alterar</button>`;
  }
  // Trocar a categoria depois do resultado não muda a conta; só o que será
  // salvo. A linha da resposta acompanha na hora.
  function atualizarCategoriaNaResposta() {
    if (!entrada) {
      return;
    }
    entrada.category = campoCategoria.value;
    const linha = $("respostaReality").querySelector(".resposta-reality__categoria");
    if (linha) {
      linha.innerHTML = textoCategoriaResposta();
    }
  }

  // O texto do semáforo só aparece quando diz algo que a frase-síntese não
  // diz; nos outros casos ele repetiria o mesmo número.
  const TEXTO_SEMAFORO_NOVO = new Set([ "impacto_meta", "deficit_fixos" ]);
  // O link para o Assistente leva uma pergunta neutra, só com valores: sem o
  // nome do item e sem pedir veredito. A forma de pagamento entra quando a
  // pessoa escolheu uma na linha do tempo.
  function linkAssistente(total, forma = null) {
    const como = forma && forma.forma === "parcelado" ? ` em ${forma.parcelas}x de ${U.moeda(forma.parcela)}` : forma && forma.forma === "avista" ? " à vista" : "";
    return `assistente.html?pergunta=${encodeURIComponent(`Como uma compra de ${U.moeda(total)}${como} mexe no meu planejamento?`)}`;
  }
  // A revelação: o preço vira horas e dias do trabalho da pessoa, o peso no
  // mês e, se houver, o atraso na meta. O selo e a frase-síntese fecham.
  function renderResposta(mudancas = []) {
    const r = resultado;
    const sin = R.sintese(r);
    const cadeia = R.cadeiaDoImpacto(r, {
      horasPorDia: horasPorDia()
    });
    const textoMudanca = m => {
      const fmt = m.campo === "horas" ? v => R.formatarTempo(v, horasPorDia()).horas : v => v === null ? "sem vida útil" : U.moeda(v);
      const nome = {
        preco: "Preço",
        horas: "Tempo de trabalho",
        por_mes: "Custo por mês de uso"
      }[m.campo];
      return `<li><span>${nome}</span> antes <s>${fmt(m.antes)}</s> agora <strong>${fmt(m.agora)}</strong></li>`;
    };
    const passo = p => `
          <li class="cadeia-impacto__passo cadeia-impacto__passo--${p.id}">
            <strong class="cadeia-impacto__valor">${esc(p.valor)}</strong>
            <span class="cadeia-impacto__rotulo">${esc(p.rotulo).replace(/ \(([^)]+)\)$/, ' <span class="cadeia-impacto__explica">($1)</span>')}${p.estimativa ? ` <span class="cadeia-impacto__selo">Estimativa</span>` : ""}</span>
          </li>`;
    $("respostaReality").innerHTML = `
      <div class="revelacao">
        <div class="revelacao__marca" aria-hidden="true">
          <div class="marca3d-cena marca3d-cena--resultado" data-logo="assets/logo-reality-transparente.png"></div>
        </div>
        <p class="resposta-reality__item">${esc(entrada.item_name)}</p>
        <ol class="cadeia-impacto" aria-label="Do preço ao impacto">${cadeia.passos.map(passo).join("")}
        </ol>
      </div>
      <div class="revelacao__veredito">
        <span class="selo-impacto selo-impacto--${r.semaforo.nivel}">${esc(cadeia.rotulo_impacto)}</span>
        <p class="resposta-reality__sintese">${esc(sin.frase)}</p>
      </div>
      <div class="semaforo-card semaforo--${r.semaforo.nivel} impacto-nivel">
        <strong>${esc(r.semaforo.titulo)}</strong>
        ${TEXTO_SEMAFORO_NOVO.has(r.semaforo.motivo) ? `<p>${esc(r.semaforo.texto)}</p>` : ""}
        <p class="impacto-nivel__nao-julga">O selo mede o peso desta compra no seu dinheiro de agora, não se você deve comprar. A decisão continua sendo sua.</p>
      </div>
      ${mudancas.length ? `<div class="o-que-mudou"><p class="o-que-mudou__titulo">O que mudou desde a última análise</p><ul>${mudancas.map(textoMudanca).join("")}</ul></div>` : ""}
      <p class="resposta-reality__categoria">${textoCategoriaResposta()}</p>
      <div class="resposta-reality__links">
        <a class="link-mais resposta-reality__mais" href="#maisFundo" data-abrir-detalhe="detalhesAnalise">Ver todos os números</a>
        <a class="link-mais" data-link-assistente href="${linkAssistente(cadeia.total)}">Ver como esta compra cabe no seu planejamento</a>
      </div>`;
    const cena = $("respostaReality").querySelector(".marca3d-cena--resultado");
    if (cena) {
      window.FinckFX?.montarMarca?.(cena);
    }
  }

  // Os números exatos já estão na cadeia e no orçamento; aqui fica só o que
  // não aparece em outro lugar: o custo por mês de uso.
  function renderIndicadores() {
    const r = resultado;
    $("indicadores").innerHTML = r.custo_de_uso.por_mes ? `<article class="card-indicador">
        <span>Custo por mês de uso</span><strong>${U.moeda(r.custo_de_uso.por_mes)}</strong>
        <small class="explica-numero">Preço dividido pelos ${r.custo_de_uso.meses_de_uso} meses de uso que você espera. É estimativa sua.</small></article>` : "";
  }

  // Primeiro a conta concreta (compra, sobra, impacto e o que
  // fica); a lista completa de indicadores vem depois, com a definição de
  // cada um visível, sem depender de passar o mouse.
  function renderOrcamento() {
    const r = resultado;
    const sin = R.sintese(r);
    const GL = R.GLOSSARIO;
    const linha = (chave, valor, classe = "") => `
      <li>
        <span>${esc(GL[chave].rotulo)} <small class="indicador-quando">${esc(GL[chave].referencia)}</small>
          <small class="explica-numero">${esc(GL[chave].definicao)}</small></span>
        <strong class="${classe}">${valor}</strong>
      </li>`;
    $("impactoOrcamento").innerHTML = `
      <div class="orcamento-concreto">
        <div><span>Compra</span><strong>${U.moeda(r.total)}</strong></div>
        <div><span>Sobra do mês após os fixos</span><strong class="${r.renda_livre > 0 ? "" : "cor-vermelha"}">${r.renda_livre > 0 ? U.moeda(r.renda_livre) : "sem sobra"}</strong></div>
        <div><span>Impacto na sobra</span><strong>${r.renda_livre > 0 ? U.percentual(r.percentual_renda_livre, 0) : "não se aplica"}</strong></div>
      </div>
      <p class="orcamento-concreto__frase">${esc(sin.frase_sobra)}</p>
      <details class="detalhes-hipoteses">
        <summary>Ver todos os números do orçamento</summary>
        <ul class="lista-resumo lista-resumo--glossario">
          ${linha("saldo_atual", U.moeda(r.saldo_antes))}
          <li>
            <span>Saldo após a compra <small class="indicador-quando">se comprar hoje</small>
              <small class="explica-numero">Saldo atual menos o preço desta compra.</small></span>
            <strong class="${r.compromete_saldo ? "cor-vermelha" : ""}">${U.moeda(r.saldo_depois)}</strong>
          </li>
          ${r.deficit_fixos > 0 ? linha("deficit_fixos", `− ${U.moeda(r.deficit_fixos)}`, "cor-vermelha") : linha("sobra_apos_fixos", U.moeda(r.sobra_apos_fixos))}
          ${r.compromissos_futuros > 0 ? linha("parcelas_a_pagar", U.moeda(r.compromissos_futuros)) + linha("saldo_apos_parcelas", U.moeda(r.saldo_apos_parcelas), r.saldo_apos_parcelas < 0 ? "cor-vermelha" : "") : ""}
          ${r.caixa_60_dias !== null ? linha("caixa_60_dias", U.moeda(r.caixa_60_dias), r.caixa_60_dias < 0 ? "cor-vermelha" : "") : ""}
          ${r.menor_caixa_60 !== null && r.menor_caixa_60 !== r.caixa_60_dias ? `<li><span>Com as entradas previstas <small class="indicador-quando">próximos 60 dias</small>
            <small class="explica-numero">O ponto mais baixo do caixa contando também as entradas previstas, na ordem das datas: é ele que diz se a compra cabe nas contas já marcadas.</small></span><strong class="${r.menor_caixa_60_depois < 0 ? "cor-vermelha" : ""}"><span class="sem-quebra">${U.moeda(r.menor_caixa_60)}</span> <span class="sem-quebra">→ ${U.moeda(r.menor_caixa_60_depois)} com a compra</span></strong></li>` : ""}
          <li><span>Valor do seu dia / hora <small class="explica-numero">Renda mensal dividida pelos dias e horas da sua jornada.</small></span><strong><span class="sem-quebra">${U.moeda(r.valor_dia)}</span> <span class="sem-quebra">/ ${U.moeda(r.valor_hora)}</span></strong></li>
          <li><span>Sem arredondar <small class="explica-numero">Os mesmos números da revelação, com duas casas: % da renda mensal, dias e horas de trabalho.</small></span><strong><span class="sem-quebra">${U.percentual(r.income_percent)}</span> <span class="sem-quebra">· ${U.numero(r.work_days)} dias</span> <span class="sem-quebra">· ${U.numero(r.work_hours)} h</span></strong></li>
        </ul>
      </details>`;
  }

  // O atraso vem da regra única de FinckReality, no mesmo formato da
  // revelação e dos cenários.
  function textoAtraso(m) {
    if (m.falta <= 0) {
      return "esta meta já foi alcançada.";
    }
    if (m.atraso_dias !== null && m.atraso_dias !== undefined) {
      if (Math.round(m.atraso_dias) < 1) {
        return `o prazo dela não muda: a compra cabe na folga fora das metas (${U.moeda(resultado.folga_fora_metas)} hoje).`;
      }
      const ritmo = m.base_atraso === "ritmo" ? `no seu ritmo de ${U.moeda(m.aporte_mensal)} por mês (média dos últimos 3 meses)` : `no ritmo de ${U.moeda(m.aporte_mensal)} por mês que o prazo da meta pede`;
      return `o prazo estimado dela fica <strong>${esc(R.textoAtraso(m.atraso_dias))}</strong>, ${ritmo}: ${U.moeda(Math.min(resultado.parte_das_metas, m.falta))} da compra passariam da folga fora das metas.`;
    }
    return `equivale a <strong>${U.numero(m.dias_trabalho_extra, 1)} dias de trabalho</strong> a mais para alcançá-la. Registre aportes na meta para o FinCK estimar o atraso em semanas e meses.`;
  }
  function renderMetas() {
    const r = resultado;
    const host = $("impactoMetas");
    if (!r.impacto_metas.length) {
      host.innerHTML = `<div class="vazio vazio--guia"><p><strong>Você ainda não tem metas.</strong> Com uma meta, esta seção responde "o que eu deixo de fazer se comprar isso?", em dias e meses de atraso.</p>
        <a class="btn-secundario btn-mini" href="metas.html#nova">Criar uma meta</a></div>`;
      return;
    }
    const ordenadas = r.impacto_metas.slice().sort((a, b) => b.percentual_do_restante - a.percentual_do_restante).slice(0, 3);
    host.innerHTML = ordenadas.map(m => `
      <article class="card-impacto-meta">
        <h5>Sua meta: ${esc(m.nome)}</h5>
        <p>Progresso atual: <strong>${U.moeda(m.atual)} / ${U.moeda(m.alvo)}</strong> (${U.percentual(m.progresso, 0)})</p>
        <div class="barra" role="img" aria-label="${U.percentual(m.progresso, 0)} da meta"><div class="barra-preenchida" style="width:${m.progresso}%"></div></div>
        <p>Se comprar ${U.moeda(r.total)}, ${textoAtraso(m)}</p>
        ${m.cobre_a_meta ? `<p class="destaque">Com este valor você concluiria a meta hoje.</p>` : ""}
      </article>`).join("") + (r.impacto_metas.length > 3 ? `<p class="nota">Mostrando as 3 metas mais afetadas de ${r.impacto_metas.length}.</p>` : "");
  }

  // Uma linha por tema em "Quer olhar mais fundo?": o essencial à vista e o
  // resto a um toque.
  function resumirMaisFundo() {
    const r = resultado;
    const escrever = (chave, texto) => escreverSeMudou(document.querySelector(`[data-resumo="${chave}"]`), texto);
    const cadeia = R.cadeiaDoImpacto(r, {
      horasPorDia: horasPorDia()
    });
    const ativas = r.impacto_metas.filter(m => m.falta > 0);
    escrever("metas", !r.impacto_metas.length ? "Você ainda não tem metas." : cadeia.meta ? `Meta “${cadeia.meta.nome}”: prazo estimado ${R.textoAtraso(cadeia.meta.dias)}.` : ativas.some(m => m.atraso_dias !== null) ? "O prazo das suas metas não muda com esta compra." : "Suas metas ainda não têm ritmo de aportes para estimar o prazo.");
    escrever("orcamento", `${r.renda_livre > 0 ? `Sobra do mês após os fixos: ${U.moeda(r.renda_livre)}` : `Despesas fixas acima da renda em ${U.moeda(r.deficit_fixos)} por mês`}${r.compromete_saldo ? "" : `; saldo depois da compra: ${U.moeda(r.saldo_depois)}`}.${r.caixa_60_dias !== null ? " Inclui as contas previstas para 60 dias." : ""}`);
  }
  function renderAlternativas() {
    $("alternativas").innerHTML = resultado.alternativas.map(a => `
      <li class="alternativa">
        <h5>${esc(a.titulo)}</h5>
        <p>${esc(a.texto)}</p>
        ${a.faixa ? `<small>Hipótese de design do projeto: entre ${U.moeda(a.faixa.min)} e ${U.moeda(a.faixa.max)} a menos (referência de ${U.percentual(a.percentual * 100, 0)}). Não é dado de pesquisa: confirme com o preço real.</small>` : ""}
        ${blocoPontos(LOCAIS_POR_ALTERNATIVA[a.id])}
      </li>`).join("");
  }

  function renderComparacao() {
    const host = $("comparacao");
    if (!comparando) {
      host.innerHTML = "";
      return;
    }
    const c = R.comparar({
      nome: comparando.nome,
      resultado: comparando.resultado
    }, {
      nome: entrada.item_name,
      resultado: resultado
    });
    const h = v => R.formatarTempo(v, horasPorDia()).horas;
    const coluna = x => `
      <div class="comparacao__opcao${x.nome === c.mais_barata && !c.empate ? " comparacao__opcao--barata" : ""}">
        <h5>${esc(x.nome)}</h5>
        <dl>
          <div><dt>Preço</dt><dd>${U.moeda(x.preco)}</dd></div>
          <div><dt>Trabalho</dt><dd>${h(x.horas)}</dd></div>
          <div><dt>Uso esperado</dt><dd>${x.meses ? `${x.meses} meses` : "não informado"}</dd></div>
          <div><dt>Por mês de uso</dt><dd>${x.por_mes ? `${U.moeda(x.por_mes)}/mês` : "sem vida útil"}</dd></div>
        </dl>
      </div>`;
    host.innerHTML = `
      <section class="comparacao" aria-labelledby="tituloComparacao">
        <h4 id="tituloComparacao">Comparando as duas opções</h4>
        <div class="comparacao__grade">${coluna(c.a)}${coluna(c.b)}</div>
        <p class="comparacao__conclusao">${c.empate ? "As duas custam o mesmo." : `<strong>${esc(c.mais_barata)}</strong> custa ${U.moeda(c.economia)} a menos, ou ${h(c.horas_economizadas)} de trabalho.`}
          ${c.compara_uso ? c.inverte ? ` Mas, por mês de uso, <strong>${esc(c.melhor_por_mes)}</strong> custa menos: dura mais e o preço se dilui no tempo.` : ` E também custa menos por mês de uso.` : ` Informe a vida útil das duas para comparar o custo por mês de uso.`}</p>
        <button type="button" class="btn-texto" id="btnEncerrarComparacao">Encerrar comparação</button>
      </section>`;
    $("btnEncerrarComparacao").addEventListener("click", () => {
      comparando = null;
      host.innerHTML = "";
      $("faixaComparando").hidden = true;
    });
  }
  $("btnComparar").addEventListener("click", () => {
    if (!resultado) {
      return;
    }
    comparando = {
      nome: entrada.item_name,
      resultado: resultado
    };
    // Mantém categoria, quantidade, destino e todos os parâmetros financeiros;
    // troca só o que identifica a outra opção.
    $("itemName").value = "";
    U.limparMoeda("itemPrice");
    $("itemLink").value = "";
    campoMeses.value = "";
    marcarChipsMeses();
    $("itemNote").value = "";
    pilulaCategoria.hidden = true;
    pilulaAtual = "";
    resultado = null;
    entrada = null;
    decisao = null;
    esquecerRegistro();
    anterior = null;
    window.FinckInteligenciaUI?.limpar?.();
    [ "passoResultado", "passoReflexao", "passoDecisao" ].forEach(id => {
      $(id).hidden = true;
    });
    const faixa = $("faixaComparando");
    faixa.hidden = false;
    faixa.innerHTML = `<p>Comparando com <strong>${esc(comparando.nome)}</strong> · ${U.moeda(comparando.resultado.total)} · ${R.formatarTempo(comparando.resultado.work_hours, horasPorDia()).horas} de trabalho. Agora informe a outra opção.</p>
      <button type="button" class="btn-texto" id="btnCancelarComparacao">Cancelar comparação</button>`;
    $("btnCancelarComparacao").addEventListener("click", () => {
      comparando = null;
      faixa.hidden = true;
      $("comparacao").innerHTML = "";
    });
    botaoLivre(TEXTO_BOTAO.inicial);
    marcarProgresso(null);
    etapa("");
    marcarEtapas();
    rolarAte($("passoDados"));
    $("itemName").focus({
      preventScroll: true
    });
  });

  // Cada alternativa aponta para os pontos reais que o usuário salvou.
  // Não existe base pronta de parceiros: os endereços são os que a própria pessoa
  // guardou em Ações locais, cadastrados à mão ou achados no Google Maps. É isso
  // que fecha o ciclo dentro do app: preço vira tempo de trabalho, tempo vira
  // alternativa, e a alternativa vira um lugar concreto do bairro em vez de uma
  // recomendação genérica. Sem ponto salvo, o link leva à busca já preenchida.
  const LOCAIS_POR_ALTERNATIVA = {
    usado: {
      tipos: [ "usado", "troca" ],
      rotulo: "Onde comprar usado, perto de você",
      convite: "Você ainda não cadastrou nenhum brechó ou ponto de troca."
    },
    reparar: {
      tipos: [ "reparo" ],
      rotulo: "Quem conserta, perto de você",
      convite: "Você ainda não cadastrou nenhum ponto de reparo."
    },
    compartilhar: {
      tipos: [ "aluguel", "troca" ],
      rotulo: "Quem aluga ou empresta, perto de você",
      convite: "Você ainda não cadastrou ninguém que aluga ou empresta."
    }
  };
  // O destino declarado no formulário deixa de ser só um dado guardado
  // e passa a ter consequência na tela: é o elo com a meta 12.5 da ODS 12.
  const DESTINOS_LOCAIS = {
    doar_revender: {
      tipos: [ "doacao", "usado" ],
      titulo: "Você pretende doar ou revender depois",
      texto: "Isso mantém o item em uso por mais tempo e o tira da fila do descarte."
    },
    reciclar: {
      tipos: [ "descarte" ],
      titulo: "Você pretende levar para descarte correto",
      texto: "Eletrônico não vai no lixo comum: tem metal pesado e componente que contamina solo e água."
    },
    guardar: {
      tipos: [ "doacao", "usado", "troca" ],
      titulo: "Você pretende guardar mesmo sem usar",
      texto: "Item parado perde valor até virar descarte. Doar, trocar ou revender enquanto ele ainda funciona devolve o produto ao uso."
    },
    descartar: {
      tipos: [ "descarte", "doacao" ],
      titulo: "Você pretende jogar fora",
      texto: "É aqui que a compra vira resíduo. A meta 12.5 da ODS 12 trata exatamente disso: reduzir a geração de resíduo por prevenção, redução, reciclagem e reuso."
    }
  };
  async function carregarLocais() {
    try {
      return await S.listar("local_actions", {
        ordem: "created_at",
        asc: false
      });
    } catch {
      return [];
    }
  }
  function pontosPorTipo(tipos) {
    return locais.filter(l => tipos.indexOf(l.kind) >= 0);
  }
  // O item analisado vira o "para quê" da busca em Ações locais: as primeiras
  // palavras, sem modelo nem medida ("iPhone 15 Pro 256GB" vira "iPhone Pro").
  const LIGACOES = /^(a|o|as|os|de|da|do|das|dos|e|com|sem|para|pra|em)$/i;
  function itemParaBusca(nome) {
    const palavras = String(nome || "").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter(p => p && !/\d/.test(p)).slice(0, 3);
    while (palavras.length && LIGACOES.test(palavras[palavras.length - 1])) {
      palavras.pop();
    }
    return palavras.join(" ").slice(0, 60);
  }
  function linkProcurar(tipos) {
    const item = itemParaBusca(entrada && entrada.item_name);
    return `locais.html?tipo=${encodeURIComponent(tipos[0])}${item ? `&item=${encodeURIComponent(item)}` : ""}#procurar`;
  }
  function cartaoPonto(l) {
    const t = cfg.TIPOS_ACAO_LOCAL.find(x => x.id === l.kind) || {};
    const detalhe = [ l.address, l.contact ].filter(Boolean).map(esc).join(" · ");
    // Ponto salvo de uma busca no Maps: o link do lugar fica na observação.
    const achado = /https:\/\/(?:www\.)?google\.[a-z.]+\/maps\S*|https:\/\/maps\.google\.\S+/.exec(l.notes || "");
    const mapa = achado && U.urlHttpSegura(achado[0]);
    return `\n      <li class="ponto-local">\n        <span class="ponto-local__icone" aria-hidden="true">${t.icone || "📍"}</span>\n        <span class="ponto-local__corpo">\n          <b>${esc(l.name)}</b>\n          <small>${esc(t.rotulo || "")}${detalhe ? ` · ${detalhe}` : ""}</small>\n          ${mapa ? `<small><a class="ponto-local__mapa" href="${esc(mapa)}" target="_blank" rel="noopener">Abrir no <span class="marca-maps" translate="no">Google Maps</span></a></small>` : ""}\n          ${l.verified_at ? `<small class="ponto-local__data">conferido em ${U.dataBR(l.verified_at)}</small>` : `<small class="ponto-local__data">sem data de conferência</small>`}\n        </span>\n      </li>`;
  }
  function blocoPontos(mapa) {
    if (!mapa) {
      return "";
    }
    const achados = pontosPorTipo(mapa.tipos);
    if (!achados.length) {
      return `\n        <p class="alternativa__vazio">${esc(mapa.convite)}\n          <span class="alternativa__links"><a href="${linkProcurar(mapa.tipos)}">Procurar perto de você →</a>\n          <a href="locais.html">Cadastrar um ponto →</a></span></p>`;
    }
    return `\n        <div class="alternativa__pontos">\n          <p class="alternativa__pontos-rotulo">${esc(mapa.rotulo)}</p>\n          <ul class="lista-pontos">${achados.slice(0, 3).map(cartaoPonto).join("")}</ul>\n          <span class="alternativa__links"><a class="alternativa__local" href="locais.html">${achados.length > 3 ? `Ver os outros ${achados.length - 3} →` : "Gerenciar meus pontos →"}</a>\n          <a class="alternativa__local" href="${linkProcurar(mapa.tipos)}">Procurar mais perto de você →</a></span>\n        </div>`;
  }
  function renderDestino() {
    const host = document.getElementById("blocoDestino");
    const mapa = entrada && entrada.end_of_life ? DESTINOS_LOCAIS[entrada.end_of_life] : null;
    if (!mapa) {
      host.hidden = true;
      return;
    }
    const achados = pontosPorTipo(mapa.tipos);
    document.getElementById("destinoItem").innerHTML = `\n      <p class="destino-item__titulo">${esc(mapa.titulo)}</p>\n      <p class="destino-item__texto">${esc(mapa.texto)}</p>\n      ${achados.length ? `<ul class="lista-pontos">${achados.slice(0, 3).map(cartaoPonto).join("")}</ul>\n        <a class="alternativa__local" href="locais.html">Gerenciar meus pontos →</a>` : `<p class="alternativa__vazio">Você ainda não cadastrou nenhum ponto para isso.\n        <span class="alternativa__links"><a href="${linkProcurar(mapa.tipos)}">Procurar perto de você →</a>\n        <a href="locais.html">Cadastrar um ponto →</a></span></p>`}`;
    host.hidden = false;
  }
  const OPCOES = {
    necessidade: [ "Preciso agora", "Posso esperar", "É impulso" ],
    uso: [ "Uso diário", "Uso ocasional", "Uso raro" ],
    durabilidade: [ "Alta, com garantia", "Média", "Baixa ou descartável" ],
    alternativas: [ "Existe opção usada", "Posso emprestar/alugar", "Não há alternativa" ],
    orcamento: [ "Não compromete nada", "Aperta um pouco", "Compromete o essencial" ],
    descarte: [ "Uso por muitos anos", "Doo ou revendo depois", "Vai virar descarte rápido" ]
  };
  // Três perguntas rápidas primeiro; as outras três ficam a
  // um toque, para não virar formulário depois do formulário. Cada pergunta
  // é um cartão com o tema em cima: a pessoa pensa na compra, não responde
  // uma prova.
  const RAPIDAS = [ "necessidade", "uso", "durabilidade" ];
  // "Alternativas, orçamento e descarte".
  const listaFalada = nomes => {
    const l = nomes.map((n, i) => i ? n.toLowerCase() : n);
    return l.length > 1 ? `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}` : l[0] || "";
  };
  const perguntaHTML = q => `
      <fieldset class="reflexao reflexao--cartao" data-reflexao="${esc(q.id)}">
        <legend class="reflexao__pergunta"><span class="reflexao__tema">${esc(q.dimensao)}</span>${esc(q.pergunta)}</legend>
        <div class="opcoes-reflexao">
          ${OPCOES[q.id].map(op => `
            <label class="chip">
              <input type="radio" name="${q.id}" value="${esc(op)}">
              <span>${esc(op)}</span>
            </label>`).join("")}
        </div>
      </fieldset>`;
  function renderReflexoes(manter = {}) {
    const host = $("formReflexao");
    const rapidas = cfg.REFLEXOES.filter(q => RAPIDAS.includes(q.id));
    const outras = cfg.REFLEXOES.filter(q => !RAPIDAS.includes(q.id));
    host.innerHTML = rapidas.map(perguntaHTML).join("") + (outras.length ? `
      <details class="detalhes-hipoteses mais-reflexoes">
        <summary>Quer pensar em mais ${outras.length} pontos? ${esc(listaFalada(outras.map(q => q.dimensao)))}.</summary>
        ${outras.map(perguntaHTML).join("")}
      </details>` : "");
    Object.entries(manter || {}).forEach(([id, valor]) => {
      const opcao = [ ...host.querySelectorAll(`input[type="radio"]`) ].find(i => i.name === id && i.value === valor);
      if (opcao) {
        opcao.checked = true;
        if (!RAPIDAS.includes(id)) {
          host.querySelector(".mais-reflexoes").open = true;
        }
      }
    });
    renderSintese();
  }
  $("formReflexao").addEventListener("change", () => {
    renderSintese();
    marcarCiclo();
  });
  let sinteseEscrita = "";
  function renderSintese() {
    const respostas = coletarReflexoes();
    $("formReflexao").querySelectorAll("[data-reflexao]").forEach(f => f.classList.toggle("reflexao--respondida", Boolean(respostas[f.dataset.reflexao])));
    const ind = R.indicadorResponsavel(respostas);
    const host = document.getElementById("sinteseReflexao");
    if (!host) {
      return;
    }
    // Região viva: o mesmo texto não é reescrito (e não é lido de novo)
    // quando a análise é refeita sem mudar as respostas.
    const escrever = html => {
      if (sinteseEscrita !== html) {
        sinteseEscrita = html;
        host.innerHTML = html;
      }
    };
    if (ind.pontuacao === null) {
      escrever(`<p class="nota">${esc(ind.sintese)}</p>`);
      return;
    }
    escrever(`
      <article class="indicador-responsavel indicador-responsavel--${ind.nivel}">
        <span class="indicador-responsavel__etiqueta">O que suas respostas mostram</span>
        <p class="indicador-responsavel__rotulo">${esc(ind.rotulo)}</p>
        <p>${esc(ind.sintese)}</p>
        <p class="indicador-responsavel__cobertura">Indicador de decisão responsável: <strong>${ind.pontuacao} de 100</strong>, com ${ind.respondidas} de ${ind.total} perguntas respondidas. A decisão continua sendo sua.</p>
      </article>
      ${ind.alertas.length ? `<ul class="lista-alertas-reflexao">${ind.alertas.map(a => `<li><strong>${esc(a.dimensao)}:</strong> ${esc(a.texto)}</li>`).join("")}</ul>` : ""}
      <details class="detalhes-hipoteses">
        <summary>Como este número é calculado</summary>
        <ul class="lista-simples">
          ${ind.criterios.map(c => `<li>${esc(c.dimensao)}: ${c.respondida ? `${esc(c.resposta)}, ${c.pontos} de 2 pontos` : "sem resposta, fora da conta"}</li>`).join("")}
        </ul>
        <p class="nota">Cada pergunta vale de 0 a 2 pontos; o indicador é a soma dividida pelo máximo das perguntas respondidas.</p>
        <p class="nota">${esc(ind.limitacao)}</p>
      </details>`);
  }
  const coletarReflexoes = () => {
    const dados = {};
    new FormData(document.getElementById("formReflexao")).forEach((v, k) => {
      dados[k] = v;
    });
    return dados;
  };

  // O ciclo que a decisão fecha: quero comprar, analiso, entendo, reflito,
  // decido, registro. A reflexão só aparece como feita se houve resposta.
  function marcarCiclo({salva: salva = decisaoSalva()} = {}) {
    const ciclo = $("cicloDecisao");
    if (!ciclo) {
      return;
    }
    const refletiu = Object.keys(coletarReflexoes()).length > 0;
    const estados = {
      quero: "feito",
      analiso: "feito",
      entendo: "feito",
      reflito: refletiu ? "feito" : "opcional",
      decido: salva ? "feito" : "atual",
      registro: salva ? "feito" : "proximo"
    };
    ciclo.querySelectorAll("[data-ciclo]").forEach(li => {
      li.dataset.estado = estados[li.dataset.ciclo];
      if (li.dataset.estado === "atual") {
        li.setAttribute("aria-current", "step");
      } else {
        li.removeAttribute("aria-current");
      }
    });
  }

  // A decisão como conclusão da análise: quatro escolhas
  // principais, cada uma dizendo o que acontece ao salvar, e uma confirmação
  // visível antes de gravar.
  const DECISAO = id => cfg.DECISOES.find(d => d.id === id);
  const totalDaCompra = () => entrada.price * (entrada.quantity || 1);
  const botaoDecisao = d => `
      <button type="button" class="botao-decisao${d.consciente ? " botao-decisao--consciente" : ""}" data-decisao="${d.id}" role="radio" aria-checked="false">
        <strong>${esc(d.label)}</strong>
        <span class="botao-decisao__consequencia">${esc(d.consequencia || "")}</span>
        <small>+${d.xp} XP</small>
      </button>`;
  function renderDecisoes() {
    const principais = cfg.DECISOES.filter(d => d.grupo !== "alternativa");
    const alternativas = cfg.DECISOES.filter(d => d.grupo === "alternativa");
    $("opcoesDecisao").innerHTML = principais.map(botaoDecisao).join("") + (alternativas.length ? `
      <button type="button" class="botao-decisao botao-decisao--consciente botao-decisao--grupo" id="btnBuscarAlternativa" aria-expanded="false" aria-controls="alternativasDecisao">
        <strong>Buscar alternativa</strong>
        <span class="botao-decisao__consequencia">Usado, conserto ou aluguel em vez de comprar novo.</span>
      </button>
      <div class="opcoes-decisao opcoes-decisao--alternativas" id="alternativasDecisao" hidden>
        ${alternativas.map(botaoDecisao).join("")}
      </div>` : "");
    decisao = null;
    $("confirmacaoDecisao").hidden = true;
    const salvar = $("btnSalvarDecisao");
    salvar.disabled = true;
    salvar.textContent = "Salvar decisão";
    $("btnBuscarAlternativa")?.addEventListener("click", e => {
      const grupo = $("alternativasDecisao");
      grupo.hidden = !grupo.hidden;
      e.currentTarget.setAttribute("aria-expanded", String(!grupo.hidden));
    });
    document.querySelectorAll("[data-decisao]").forEach(b => b.addEventListener("click", () => selecionarDecisao(b.dataset.decisao)));
  }
  function selecionarDecisao(id) {
    const d = DECISAO(id);
    const botao = document.querySelector(`[data-decisao="${id}"]`);
    if (!d || !botao || !entrada) {
      return;
    }
    decisao = id;
    marcarCiclo();
    document.querySelectorAll("[data-decisao]").forEach(x => {
      x.classList.toggle("ativo", x === botao);
      x.setAttribute("aria-checked", String(x === botao));
    });
    if (botao.closest("#alternativasDecisao")) {
      $("alternativasDecisao").hidden = false;
      $("btnBuscarAlternativa")?.setAttribute("aria-expanded", "true");
    }
    const confirmacao = $("confirmacaoDecisao");
    const salvar = $("btnSalvarDecisao");
    confirmacao.hidden = false;
    confirmacao.className = `confirmacao-decisao confirmacao-decisao--${id === "comprar" ? "compra" : "consciente"}`;
    if (decisaoSalva()) {
      confirmacao.innerHTML = `<p>Esta é a decisão salva nesta análise: <strong>${esc(d.label)}</strong>.${saida ? ` A saída de <strong>${U.moeda(saida.valor)}</strong> está no seu extrato.` : ""}</p>`;
      salvar.disabled = true;
      salvar.textContent = "Decisão salva";
      return;
    }
    // O que vai acontecer de verdade ao salvar, a partir do que já está
    // gravado: com a saída desta análise no extrato, trocar a decisão pede
    // o estorno, e comprar de novo não lança outra saída.
    const ao = id === "comprar" ? saida ? `a saída de <strong>${U.moeda(saida.valor)}</strong> desta análise já está no seu extrato; nada é lançado de novo.` : `a saída de <strong>${U.moeda(totalDaCompra())}</strong> entra no seu extrato com a data de hoje, na categoria ${esc(entrada.category)}.` : saida ? `a compra de <strong>${U.moeda(saida.valor)}</strong> já está no seu extrato. O FinCK pergunta se você quer estornar essa saída antes de trocar a decisão.` : esc(d.consequencia.charAt(0).toLowerCase() + d.consequencia.slice(1));
    confirmacao.innerHTML = `<p>Você escolheu <strong>${esc(d.label)}</strong>.</p>
      <p>Ao salvar: ${ao}</p>`;
    salvar.disabled = false;
    salvar.textContent = `Salvar decisão: ${d.label}`;
  }
  // Esquece a análise gravada: a próxima gravação cria outra.
  function esquecerRegistro() {
    registroId = null;
    decisaoGravada = null;
    totalGravado = null;
    saida = null;
    lancamentos = 0;
  }
  // A saída lançada por esta análise, lida de volta do extrato: só conta se
  // ainda existe e não foi estornada.
  async function saidaNoExtrato() {
    if (!saida) {
      return null;
    }
    const t = await S.obter("transactions", saida.id).catch(() => null);
    if (!t || t.reversed_at) {
      saida = null;
      return null;
    }
    saida = {
      id: t.id,
      valor: Number(t.amount) || saida.valor
    };
    return saida;
  }
  // XP, nível e conquistas entram na própria confirmação, sem aviso
  // flutuante sobre os botões; o motivo de uma recusa (intervalo ou teto do
  // dia) não aparece depois de um salvamento que deu certo.
  async function premiarSemPilha(tipos) {
    let xp = 0;
    let aviso = "";
    try {
      const nivelAntes = G.nivelDe ? G.nivelDe((await S.obterGamificacao()).xp).level : null;
      let nivel = null;
      for (const [tipo, opcoes] of tipos) {
        const premio = await G.premiar(tipo, {
          ...opcoes,
          silencioso: true,
          avisoDeNivel: false
        });
        xp += Number(premio?.concedido) || 0;
        nivel = premio?.nivel || nivel;
      }
      const conquistas = await G.sincronizarConquistas({
        avisar: false
      });
      const subiu = nivel && nivelAntes !== null && nivel.level > nivelAntes && !/Nível/.test(conquistas?.aviso || "") ? ` Nível ${nivel.level}: ${nivel.titulo}.` : "";
      aviso = `${conquistas?.aviso || ""}${subiu}`.trim();
    } catch {}
    return {
      xp: xp,
      aviso: aviso
    };
  }
  const textoJornada = ({xp: xp, aviso: aviso}) => xp > 0 || aviso ? `${xp > 0 ? `+${xp} XP. ` : ""}${aviso ? `${esc(aviso)} ` : ""}<a href="gamificacao.html">Ver na Jornada</a>` : "";
  const chaveCalculo = () => `${(entrada.item_name || "").toLowerCase().trim()}|${Number(entrada.price).toFixed(2)}|${U.hojeISO()}`;
  function montarRegistro(extra = {}) {
    return R.paraRegistro({
      ...entrada,
      resultado: resultado,
      perfil: ctx.perfil,
      note: document.getElementById("decisaoNota").value.trim() || entrada.note,
      ...extra
    });
  }
  // Atualizar a análise sem dizer a decisão mantém a decisão gravada.
  async function cadastrarCalculo(extra = {}) {
    const registro = montarRegistro(extra);
    totalGravado = totalDaCompra();
    if (registroId) {
      const {analyzed_at: analyzed_at, ...campos} = registro;
      if (!("decision" in extra)) {
        delete campos.decision;
      }
      await S.atualizar("purchase_analyses", registroId, campos);
      return registroId;
    }
    const criado = await S.inserir("purchase_analyses", registro);
    registroId = criado.id;
    return registroId;
  }
  // O status de "Salvar esta análise", escrito a partir do que está gravado.
  async function statusDoRegistro(prefixo) {
    const gravado = registroId ? await S.obter("purchase_analyses", registroId).catch(() => null) : null;
    const viva = await saidaNoExtrato();
    if (!gravado) {
      return "";
    }
    decisaoGravada = gravado.decision || null;
    const d = DECISAO(gravado.decision);
    const partes = [ d ? `${prefixo}, com a decisão ${d.label}.` : `${prefixo}, ainda sem decisão.` ];
    partes.push(viva ? `A saída de ${U.moeda(viva.valor)} desta análise está no seu extrato.` : "Nada desta análise está no seu extrato.");
    return partes.join(" ");
  }
  $("btnRegistrarCalculo").addEventListener("click", async () => {
    if (!resultado) {
      return;
    }
    const botao = $("btnRegistrarCalculo");
    botao.disabled = true;
    try {
      const jaTinha = Boolean(registroId);
      await cadastrarCalculo({
        reflections: coletarReflexoes()
      });
      const premio = Number(entrada.price) >= cfg.XP.VALOR_MINIMO_CALCULO ? await premiarSemPilha([ [ "calculo", {
        chave: chaveCalculo(),
        motivo: "análise salva"
      } ] ]) : await premiarSemPilha([]);
      window.FinckCalculos?.recarregar?.();
      const texto = await statusDoRegistro(jaTinha ? "Análise atualizada em Minhas análises" : "Análise salva em Minhas análises");
      const jornada = textoJornada(premio);
      $("statusRegistro").innerHTML = `<span aria-hidden="true">✓</span> ${esc(texto)} <a href="#calculos" data-ir-aba="calculos">Ver minhas análises</a>${jornada ? `<br>${jornada}` : ""}`;
      // A decisão salva continua a mesma: os botões mostram isso.
      if (decisaoGravada && decisao !== decisaoGravada) {
        selecionarDecisao(decisaoGravada);
      }
    } catch (err) {
      $("statusRegistro").innerHTML = `<span class="cor-vermelha">Não deu para salvar agora: ${esc(err.message)} Tente de novo em instantes.</span>`;
      botao.disabled = false;
    }
  });
  $("btnSalvarDecisao").addEventListener("click", async () => {
    if (!resultado || !decisao || decisaoSalva()) {
      return;
    }
    const botao = $("btnSalvarDecisao");
    botao.disabled = true;
    const escolhida = decisao;
    const d = DECISAO(escolhida);
    try {
      const jaRegistrado = Boolean(registroId);
      const reflexoes = coletarReflexoes();
      let saidaAnterior = null;
      // Antes de gravar, o estado real: a saída desta análise ainda está no
      // extrato? Trocar "Comprar agora" por outra decisão não apaga essa
      // saída em silêncio: o FinCK oferece o estorno, que mantém o histórico.
      const viva = await saidaNoExtrato();
      if (escolhida !== "comprar" && viva) {
        const estornar = await U.confirmar("A compra já está no seu extrato", `A saída de ${U.moeda(viva.valor)} desta análise foi lançada quando você salvou "Comprar agora". Para salvar "${d.label}", o FinCK estorna essa saída: o extrato guarda o lançamento e o estorno. Se preferir manter a compra, nada muda.`, {
          confirmar: "Estornar a saída e salvar",
          cancelar: "Manter a compra",
          perigo: false
        });
        if (!estornar) {
          selecionarDecisao(decisaoGravada || "comprar");
          $("confirmacaoDecisao").innerHTML = decisaoGravada ? `<p>Nada mudou. A saída de <strong>${U.moeda(viva.valor)}</strong> continua no seu extrato e a decisão salva continua <strong>${esc(DECISAO(decisaoGravada).label)}</strong>.</p>` : `<p>Nada mudou. A saída de <strong>${U.moeda(viva.valor)}</strong> continua no seu extrato. Para registrar a compra nesta análise, salve “Comprar agora”.</p>`;
          return;
        }
        await F.estornarTransacao(viva.id, {
          motivo: `Decisão trocada para "${d.label}" no FinCK of Reality`,
          chave: S.chaveDeOperacao("estorno_reality", viva.id)
        });
        if (await saidaNoExtrato()) {
          throw new Error("O estorno não foi confirmado, então a decisão não foi trocada.");
        }
        saidaAnterior = {
          valor: viva.valor,
          estornada: true
        };
      }
      // A análise é gravada sem decisão, o lançamento vem antes (idempotente
      // pela chave da análise, então clicar duas vezes não duplica) e a
      // decisão só é registrada depois que o dinheiro se moveu de verdade.
      await cadastrarCalculo({
        decision: null,
        reflections: reflexoes
      });
      decisaoGravada = null;
      if (escolhida === "comprar") {
        if (viva) {
          saidaAnterior = {
            valor: viva.valor,
            jaLancada: true
          };
        } else {
          const mov = await S.operacao(S.chaveDeOperacao("compra_reality", registroId, lancamentos || null), () => S.inserir("transactions", {
            type: "saida",
            description: entrada.item_name,
            amount: totalDaCompra(),
            date: U.hojeISO(),
            category: entrada.category,
            source: "reality"
          }), {
            operacao: "compra_reality"
          });
          saida = mov?.id ? {
            id: mov.id,
            valor: Number(mov.amount) || totalDaCompra()
          } : null;
          lancamentos += 1;
          if (!await saidaNoExtrato()) {
            throw new Error("A saída não apareceu no extrato, então a decisão não foi salva.");
          }
        }
      }
      await S.atualizar("purchase_analyses", registroId, {
        decision: escolhida,
        reflections: reflexoes
      });
      const gravado = await S.obter("purchase_analyses", registroId);
      if (!gravado || gravado.decision !== escolhida) {
        throw new Error("A decisão não apareceu na sua análise.");
      }
      decisaoGravada = escolhida;
      // Mesmo toque que salvou a análise: o intervalo contra cliques
      // repetidos não vale aqui, e a chave da análise já impede repetir XP.
      const premios = [];
      if (!jaRegistrado && Number(entrada.price) >= cfg.XP.VALOR_MINIMO_CALCULO) {
        premios.push([ "calculo", {
          chave: chaveCalculo(),
          motivo: "análise salva"
        } ]);
      }
      premios.push([ "decisao", {
        chave: `${registroId}`,
        xp: d?.xp || 5,
        motivo: "decisão registrada",
        ignorarIntervalo: true
      } ]);
      const premio = await premiarSemPilha(premios);
      const jornada = textoJornada(premio);
      window.FinckCalculos?.recarregar?.();
      // O que aconteceu de verdade: só "comprar" lança no extrato e nenhuma
      // decisão mexe no valor guardado nas metas.
      const comprou = escolhida === "comprar";
      const meta = comprou ? R.cadeiaDoImpacto(resultado, {
        horasPorDia: horasPorDia()
      }).meta : null;
      const conf = R.confirmacaoRegistro({
        decisao: escolhida,
        total: comprou && saida ? saida.valor : totalDaCompra(),
        categoria: entrada.category,
        meta: meta,
        saidaAnterior: saidaAnterior
      });
      // Próximos passos à vista, sem trocar de tela por conta própria.
      const tipos = {
        alternativa: [ "usado", "troca", "aluguel" ],
        usado: [ "usado", "troca" ],
        reparar: [ "reparo" ]
      }[escolhida];
      const confirmacao = $("confirmacaoDecisao");
      confirmacao.hidden = false;
      confirmacao.className = "confirmacao-decisao confirmacao-decisao--salva";
      confirmacao.innerHTML = `<p class="confirmacao-decisao__titulo"><span aria-hidden="true">✓</span> ${esc(conf.titulo)} <span class="confirmacao-decisao__escolha">${esc(d.label)}</span></p>
        ${conf.linhas.map(l => `<p>${esc(l)}</p>`).join("")}
        ${jornada ? `<p>${jornada}</p>` : ""}
        <div class="acoes-etapa">
          ${tipos ? `<a class="btn-primario btn-mini" href="${linkProcurar(tipos)}">Procurar perto de você</a>` : ""}
          ${conf.lancou_no_extrato || conf.estornou ? `<a class="btn-secundario btn-mini" href="home.html#movimentacoes">Ver no extrato</a>` : ""}
          ${meta ? `<a class="btn-secundario btn-mini" href="metas.html">Ver minhas metas</a>` : ""}
          <a class="btn-secundario btn-mini" href="#calculos" data-ir-aba="calculos">Ver minhas análises</a>
        </div>`;
      botao.textContent = "Decisão salva";
      marcarCiclo();
      // A análise já está salva com a decisão: "Salvar esta análise" volta
      // quando algo mudar no formulário.
      $("statusRegistro").innerHTML = `<span aria-hidden="true">✓</span> Análise salva com a decisão ${esc(d.label)}. <a href="#calculos" data-ir-aba="calculos">Ver minhas análises</a>`;
      $("btnRegistrarCalculo").disabled = true;
    } catch (err) {
      const confirmacao = $("confirmacaoDecisao");
      confirmacao.hidden = false;
      confirmacao.className = "confirmacao-decisao confirmacao-decisao--erro";
      const extrato = await saidaNoExtrato().catch(() => null);
      confirmacao.innerHTML = `<p><strong>A decisão não foi salva.</strong> ${esc(err.message)} ${extrato ? `A saída de ${U.moeda(extrato.valor)} desta análise está no seu extrato.` : "Nada desta análise está no seu extrato."} Pode tentar de novo.</p>`;
      botao.disabled = false;
    }
  });
  $("btnNovaAnalise").addEventListener("click", () => {
    resultado = null;
    entrada = null;
    decisao = null;
    esquecerRegistro();
    comparando = null;
    anterior = null;
    window.FinckInteligenciaUI?.limpar?.();
    $("btnRegistrarCalculo").disabled = false;
    $("statusRegistro").textContent = "";
    form.reset();
    U.limparMoeda("itemPrice");
    esquecerCategoria();
    marcarChipsMeses();
    $("faixaComparando").hidden = true;
    $("comparacao").innerHTML = "";
    $("alertaRenda").hidden = true;
    [ "passoResultado", "passoReflexao", "passoDecisao" ].forEach(id => {
      $(id).hidden = true;
    });
    $("btnSalvarDecisao").disabled = true;
    $("btnSalvarDecisao").textContent = "Salvar decisão";
    botaoLivre(TEXTO_BOTAO.inicial);
    marcarProgresso(null);
    etapa("");
    window.FinckFundo?.tom("neutro");
    marcarEtapas();
    rolarJanela(0);
  });

  // "Ver todos os números" abre o tema recolhido e leva até ele.
  document.addEventListener("click", e => {
    const link = e.target.closest("[data-abrir-detalhe]");
    if (!link) {
      return;
    }
    const alvo = $(link.dataset.abrirDetalhe);
    if (!alvo) {
      return;
    }
    e.preventDefault();
    alvo.open = true;
    rolarAte(alvo);
    alvo.querySelector("summary")?.focus({
      preventScroll: true
    });
  });

  // Vindo de Cenários ou de "Analisar de novo" em Minhas análises: item,
  // preço e quantidade chegam pela URL e só preenchem o formulário. A pessoa
  // confere e toca em "Ver o impacto"; a URL volta limpa.
  (function preencherPelaUrl() {
    const params = new URLSearchParams(location.search);
    const item = (params.get("item") || "").trim().slice(0, 120);
    const preco = Number(String(params.get("preco") || "").replace(",", "."));
    const qtd = Math.floor(Number(params.get("qtd")) || 0);
    if (!item && !(preco > 0)) {
      return;
    }
    if (item) {
      $("itemName").value = item;
      sugerirCategoria();
    }
    if (preco > 0 && preco < 1e9) {
      U.escreverMoeda("itemPrice", Math.round(preco * 100) / 100);
    }
    if (qtd > 1 && qtd <= 999) {
      $("itemQuantidade").value = String(qtd);
    }
    try {
      history.replaceState(null, "", location.pathname + location.hash);
    } catch {}
    botaoVer.focus({
      preventScroll: true
    });
    escreverSeMudou($("statusProcesso"), "Item e preço preenchidos. Confira e toque em Ver o impacto da compra.");
  })();
});
