document.addEventListener("DOMContentLoaded", () => {
  const U = window.FinckUtils;
  const P = window.FinckProgramacao;
  const host = document.getElementById("programacaoFinanceira");
  if (!host || !P) {
    return;
  }
  const JANELA = 60;
  const MAX_TORRES = 9;
  const ALTURA_MIN = 15;
  const ALTURA_MAX = 74;
  const MARGEM = .05;
  const PAUSA_FOCO = 3e3;
  let cicloFoco = 0;
  // Mesma regra de FinckPainel.faltaDeVerdade, sobre o panorama.
  const faltaDeVerdade = pan => {
    const menor = pan.menorCaixaComEntradas;
    return (menor === null || menor === undefined ? pan.naoComprometido : menor) < 0;
  };
  function agrupar(compromissos) {
    const mapa = new Map;
    for (const c of compromissos) {
      const g = mapa.get(c.iso) || {
        iso: c.iso,
        data: c.data,
        emDias: c.emDias,
        descricao: c.descricao,
        itens: 0,
        valor: 0,
        vencido: c.vencido,
        acumulado: 0
      };
      g.itens += 1;
      g.valor += c.valor;
      g.acumulado = Math.max(g.acumulado, c.acumulado);
      mapa.set(c.iso, g);
    }
    return [ ...mapa.values() ];
  }
  const chaoHTML = () => `\n    <div class="pf3d__chao">\n      <span class="pf3d__grade"></span>\n      <span class="pf3d__cobertura"></span>\n      <span class="pf3d__descoberto"></span>\n      <span class="pf3d__varredura"></span>\n    </div>`;
  const marcoHTML = () => `\n    <span class="pf3d__hoje"></span>\n    <span class="pf3d__feixe"></span>`;
  const torreHTML = (t, altura, i, extra = "") => `\n    <div class="pf3d__torre ${extra}"\n         style="--t:${t.toFixed(4)};--h:${altura.toFixed(1)}px;--i:${i}">\n      <span class="pf3d__brasa"></span>\n      <span class="pf3d__face pf3d__face--n"></span>\n      <span class="pf3d__face pf3d__face--s"></span>\n      <span class="pf3d__face pf3d__face--o"></span>\n      <span class="pf3d__face pf3d__face--l"></span>\n      <span class="pf3d__face pf3d__face--topo"></span>\n      <span class="pf3d__moeda"></span>\n    </div>`;
  function cenaVazia() {
    const fantasmas = [ .2, .44, .67, .88 ].map((t, i) => torreHTML(t, 20 + i * 10, i, "pf3d__torre--fantasma")).join("");
    return {
      grupos: [],
      html: `\n        <div class="pf3d pf3d--vazia" data-pf3d style="--cobertura:1;--t0:0.04">\n          <div class="pf3d__janela">\n            <div class="pf3d__camera">\n              <div class="pf3d__pista">\n                ${chaoHTML()}\n                ${marcoHTML()}\n                ${fantasmas}\n              </div>\n            </div>\n            <span class="pf3d__selo pf3d__selo--neutro">pista livre</span>\n            <p class="pf3d__foco">\n              <span class="pf3d__foco-nome">Nada programado para os próximos ${JANELA} dias.</span>\n            </p>\n          </div>\n        </div>`
    };
  }
  function montarCena(pan) {
    const grupos = agrupar(pan.compromissos).slice(0, MAX_TORRES);
    if (!grupos.length) {
      return cenaVazia();
    }
    const menor = Math.min(0, ...grupos.map(g => g.emDias));
    const alcance = Math.max(1, JANELA - menor);
    const posicao = dias => MARGEM + (1 - MARGEM * 2) * Math.max(0, Math.min(1, (dias - menor) / alcance));
    const maior = Math.max(...grupos.map(g => g.valor));
    const altura = v => ALTURA_MIN + (maior > 0 ? v / maior : 0) * (ALTURA_MAX - ALTURA_MIN);
    // "Descoberto" é o dia em que o caixa corrido (com as entradas previstas)
    // fica negativo, a mesma regra dos avisos da home.
    const soSaidas = grupos.find(g => g.acumulado > pan.saldo);
    const isoFalta = faltaDeVerdade(pan) ? pan.descobertoComEntradasEm ? U.dataISO(pan.descobertoComEntradasEm) : soSaidas?.iso || null : null;
    const rompe = isoFalta ? grupos.find(g => g.iso >= isoFalta) || null : null;
    const cobertura = pan.saldo <= 0 ? 0 : rompe ? posicao(rompe.emDias) : 1;
    const torres = grupos.map((g, i) => torreHTML(posicao(g.emDias), altura(g.valor), i, g.vencido ? "pf3d__torre--vencida" : isoFalta && g.iso >= isoFalta ? "pf3d__torre--fora" : "")).join("");
    const selo = pan.saldo <= 0 ? [ "pf3d__selo--risco", "sem saldo hoje" ] : isoFalta ? [ "pf3d__selo--risco", `descoberto em ${P.rotuloData(rompe ? rompe.data : pan.descobertoComEntradasEm)}` ] : soSaidas ? [ "", `entradas cobrem os ${JANELA} dias` ] : [ "", `saldo cobre os ${JANELA} dias` ];
    return {
      grupos: grupos,
      html: `\n        <div class="pf3d" data-pf3d\n             style="--cobertura:${cobertura.toFixed(4)};--t0:${posicao(0).toFixed(4)}">\n          <div class="pf3d__janela">\n            <div class="pf3d__camera">\n              <div class="pf3d__pista">\n                ${chaoHTML()}\n                ${cobertura < 1 ? '<span class="pf3d__ruptura"></span>' : ""}\n                ${marcoHTML()}\n                ${torres}\n              </div>\n            </div>\n            <span class="pf3d__selo ${selo[0]}">${selo[1]}</span>\n            <p class="pf3d__foco" data-pf3d-foco></p>\n          </div>\n        </div>`
    };
  }
  // Os nomes daqui são os mesmos dos cards de "Sua situação hoje": saldo
  // registrado, saídas previstas e caixa depois delas, todos da mesma conta
  // (ctx.programacao, montada em finance.js). Assim nenhum número da home
  // contradiz outro.
  function render(pan, {usuarioId: usuarioId = null} = {}) {
    clearInterval(cicloFoco);
    const cena = montarCena(pan);
    const ate = pan.limite ? P.rotuloData(pan.limite) : null;
    const janela = `próximos ${JANELA} dias${ate ? `, até ${ate}` : ""}`;
    if (!pan.compromissos.length) {
      host.innerHTML = `\n        <div class="prog-cabecalho">\n          <h3>Programação financeira</h3>\n          <span class="prog-janela">${janela}</span>\n        </div>\n        ${cena.html}\n        <p class="vazio">\n          Nenhuma saída prevista ${ate ? `até ${ate}` : "nos próximos dias"}.\n          <a href="recorrentes.html">Cadastre suas contas de todo mês</a> para ver quanto do seu\n          saldo já tem destino e até quando.\n        </p>`;
      ligarCena(cena.grupos, pan.saldo);
      return;
    }
    const p = pan.proximo;
    const proximos = pan.compromissos.slice(0, 4);
    const restantes = pan.compromissos.length - proximos.length;
    const caixa = pan.naoComprometido;
    const entradas = Number(pan.entradasPrevistas) || 0;
    const semEntradas = entradas > 0 ? `Entradas futuras (${U.moeda(entradas)} previstas no período) não entram nesta conta.` : "Entradas futuras não entram nesta conta.";
    const origem = c => c.origem === "agendada" ? " · agendada" : "";
    const falta = faltaDeVerdade(pan);
    host.innerHTML = `\n      <div class="prog-cabecalho">\n        <h3>Programação financeira</h3>\n        <span class="prog-janela">${janela}</span>\n      </div>\n\n      ${cena.html}\n\n      <p class="prog-chamada">\n        ${p ? `Até <strong>${P.rotuloLongo(p.data)}</strong> você tem\n             <strong class="prog-chamada__valor">${U.moeda(pan.comprometidoAteProximo)}</strong>\n             em saídas previstas.` : `Você tem\n             <strong class="prog-chamada__valor">${U.moeda(pan.totalVencido)}</strong>\n             em saídas vencidas aguardando decisão.`}\n      </p>\n\n      ${pan.vencidos.length ? `\n        <p class="prog-vencidos">\n          ${pan.vencidos.length === 1 ? "1 saída venceu e ainda não foi decidida. Continua contando até você decidir." : `${pan.vencidos.length} saídas venceram e ainda não foram decididas. Continuam contando até você decidir.`}\n        </p>` : ""}\n\n      <dl class="prog-contas">\n        <div><dt>Saldo atual <small>registrado hoje</small></dt><dd>${U.moeda(pan.saldo)}</dd></div>\n        <div><dt>Saídas previstas <small>${ate ? `até ${ate}` : `${JANELA} dias`}</small></dt><dd class="prog-contas__preso">${U.moeda(pan.comprometidoTotal)}</dd></div>\n        <div class="prog-contas__sobra">\n          <dt>Caixa depois das saídas previstas <small>se nada mudar</small></dt>\n          <dd class="${falta ? "cor-vermelha" : caixa < 0 ? "prog-contas__neutro" : ""}">${U.moeda(caixa)}</dd>\n        </div>\n      </dl>\n\n      <p class="prog-nota">\n        ${falta && entradas > 0 && pan.descobertoComEntradasEm ? `Se nada mudar, mesmo contando as entradas previstas (${U.moeda(entradas)}), o saldo fica negativo a partir de ${P.rotuloData(pan.descobertoComEntradasEm)}. Na programação completa dá para ver o que pode ser adiado; a decisão continua sua.` : falta ? `Se nada mudar, essas saídas passam o saldo de hoje em ${U.moeda(-caixa)}${pan.descobertoEm ? ` a partir de ${P.rotuloData(pan.descobertoEm)}` : ""}. ${semEntradas} Na programação completa dá para ver o que pode ser adiado; a decisão continua sua.` : caixa < 0 ? `Só com as saídas, o saldo de hoje ficaria em <span class="valor-junto">${U.moeda(caixa)}</span>${ate ? ` até ${ate}` : ""}. Contando as entradas previstas (${U.moeda(entradas)}) na ordem das datas, ele não fica negativo nesse período.` : `Depois das saídas previstas ${ate ? `até ${ate}` : ""}, ficam ${U.moeda(caixa)} do saldo de hoje. ${semEntradas}`}\n      </p>\n\n      <details class="prog-detalhes" data-recolhivel="programacao">\n        <summary>Ver as próximas saídas (${pan.compromissos.length})</summary>\n        <ul class="prog-lista">\n          ${proximos.map(c => `\n            <li${c.vencido ? ' class="prog-lista--vencido"' : ""}>\n              <span class="prog-lista__data">${P.rotuloData(c.data)}</span>\n              <span class="prog-lista__nome">${U.escapeHTML(c.descricao)}</span>\n              <span class="prog-lista__quando">${P.quandoTexto(c.emDias)}${origem(c)}</span>\n              <strong class="prog-lista__valor">${U.moeda(c.valor)}</strong>\n            </li>`).join("")}\n        </ul>\n        ${restantes > 0 ? `<p class="prog-mais">e mais ${restantes} até ${P.rotuloData(pan.compromissos[pan.compromissos.length - 1].data)}</p>` : ""}\n      </details>\n\n      <button type="button" class="btn-secundario" id="btnVerProgramacao">Ver programação completa</button>`;
    window.FinckPainel?.ligarRecolhiveis(host, usuarioId);
    ligarCena(cena.grupos, pan.saldo);
    const botao = document.getElementById("btnVerProgramacao");
    if (botao) {
      botao.addEventListener("click", () => abrirLinha(pan));
    }
  }
  function abrirLinha(pan) {
    const alvo = document.getElementById("conteudoProgramacao");
    if (!alvo) {
      return;
    }
    alvo.innerHTML = `\n      <p class="prog-modal__intro">\n        Cada marco soma tudo o que sai até aquela data e mostra quanto do saldo\n        de hoje fica depois. Entradas futuras não entram nesta conta.\n      </p>\n      <ol class="prog-linha">\n        <li class="prog-linha__hoje"><span class="prog-linha__ponto"></span><div><strong>Hoje</strong>\n          <span>${U.moeda(pan.saldo)} registrados</span></div></li>\n        ${pan.compromissos.map(c => `\n          <li${c.vencido ? ' class="prog-linha--vencido"' : ""}>\n            <span class="prog-linha__ponto"></span>\n            <div>\n              <strong>${P.rotuloData(c.data)} · ${U.escapeHTML(c.descricao)}</strong>\n              <span>${U.moeda(c.valor)} · acumulado ${U.moeda(c.acumulado)}${c.vencido ? " · vencido, aguardando decisão" : ""}${c.origem === "agendada" ? " · agendado" : ""}</span>\n            </div>\n            <em class="${pan.saldo - c.acumulado < 0 ? "cor-vermelha" : ""}">\n              fica ${U.moeda(pan.saldo - c.acumulado)}\n            </em>\n          </li>`).join("")}\n      </ol>`;
    U.abrirModal("modalProgramacao");
  }
  function ligarParallax(cena) {
    let px = 0, py = 0, pendente = 0;
    const aplicar = () => {
      pendente = 0;
      cena.style.setProperty("--px", px.toFixed(3));
      cena.style.setProperty("--py", py.toFixed(3));
    };
    const agendar = () => {
      if (pendente) {
        cancelAnimationFrame(pendente);
      }
      pendente = requestAnimationFrame(aplicar);
    };
    const mover = e => {
      const t = e.touches && e.touches[0] ? e.touches[0] : e;
      if (!t || typeof t.clientX !== "number") {
        return;
      }
      const r = cena.getBoundingClientRect();
      if (!r.width || !r.height) {
        return;
      }
      px = (t.clientX - r.left) / r.width - .5;
      py = ((t.clientY - r.top) / r.height - .5) * -1;
      agendar();
    };
    const sair = () => {
      px = 0;
      py = 0;
      agendar();
    };
    cena.addEventListener("pointermove", mover, {
      passive: true
    });
    cena.addEventListener("touchmove", mover, {
      passive: true
    });
    [ "pointerleave", "pointercancel", "touchend", "touchcancel" ].forEach(ev => cena.addEventListener(ev, sair, {
      passive: true
    }));
  }
  function ligarCena(grupos, saldo) {
    const cena = host.querySelector("[data-pf3d]");
    if (!cena) {
      return;
    }
    ligarParallax(cena);
    const foco = cena.querySelector("[data-pf3d-foco]");
    const torres = [ ...cena.querySelectorAll(".pf3d__torre:not(.pf3d__torre--fantasma)") ];
    if (!foco || !torres.length) {
      return;
    }
    let atual = -1;
    let pausado = false;
    const mostrar = i => {
      if (i === atual || !grupos[i]) {
        return;
      }
      atual = i;
      torres.forEach((t, n) => t.classList.toggle("pf3d__torre--foco", n === i));
      const g = grupos[i];
      const fora = !g.vencido && torres[i].classList.contains("pf3d__torre--fora");
      const quando = P.quandoTexto(g.emDias);
      foco.className = "pf3d__foco" + (g.vencido ? " pf3d__foco--vencida" : fora ? " pf3d__foco--fora" : "");
      foco.innerHTML = `\n        <span class="pf3d__foco-data">${P.rotuloData(g.data)}</span>\n        <span class="pf3d__foco-nome">${g.itens > 1 ? `${g.itens} saídas · ${quando}` : `${U.escapeHTML(g.descricao)} · ${quando}`}</span>\n        <strong class="pf3d__foco-valor">${U.moeda(g.valor)}</strong>`;
    };
    mostrar(0);
    torres.forEach((t, n) => {
      const fixar = () => {
        pausado = true;
        mostrar(n);
      };
      t.addEventListener("pointerenter", fixar, {
        passive: true
      });
      t.addEventListener("pointerdown", fixar, {
        passive: true
      });
    });
    cena.addEventListener("pointerleave", () => {
      pausado = false;
    }, {
      passive: true
    });
    if (torres.length < 2) {
      return;
    }
    cicloFoco = setInterval(() => {
      if (document.hidden || pausado) {
        return;
      }
      mostrar((atual + 1) % torres.length);
    }, PAUSA_FOCO);
  }
  // A home (js/home.js) desenha a programação junto com o resto, a partir do
  // mesmo contexto. Sem a home pronta, a programação se vira sozinha.
  async function carregar() {
    if (window.FinckHome && window.FinckHome.recarregar) {
      return window.FinckHome.recarregar();
    }
    const ctx = await window.FinckFinance.carregarContexto();
    render(ctx.programacao || P.panorama({
      recorrentes: ctx.recorrentes,
      parcelamentos: ctx.parcelamentos,
      pagamentos: ctx.pagamentos,
      agendadas: ctx.transacoesFuturas
    }, ctx.saldo, {
      dias: JANELA
    }));
  }
  host.innerHTML = `<p class="nota" role="status">Lendo suas saídas previstas…</p>`;
  window.FinckProgramacaoHome = {
    recarregar: carregar,
    desenhar: (pan, opcoes) => pan && render(pan, opcoes)
  };
});

// Convite para adicionar o FinCK à tela inicial. Não aparece na primeira
// visita: só depois de uma ação de valor (a primeira análise salva no Reality).
// Fica no fluxo da página, nunca por cima de botão, campo, aviso ou navegação,
// e, dispensado, espera 30 dias para voltar.
(() => {
  const CHAVE = "finck.painel.instalar-dispensado-em";
  const ler = () => {
    try {
      return localStorage.getItem(CHAVE);
    } catch {
      return null;
    }
  };
  const gravar = v => {
    try {
      localStorage.setItem(CHAVE, String(v));
    } catch {}
  };
  const instalado = () => {
    try {
      return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    } catch {
      return false;
    }
  };
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  let evento = null;
  let proprias = 0;
  // O navegador avisa cedo, antes de a home terminar de carregar: guarda o
  // aviso e decide depois.
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    evento = e;
    avaliar({
      proprias: proprias
    });
  });
  window.addEventListener("appinstalled", () => {
    evento = null;
    esconder();
  });
  function esconder() {
    const host = document.getElementById("conviteInstalar");
    if (host) {
      host.hidden = true;
      host.innerHTML = "";
    }
  }
  function dispensar() {
    gravar(Date.now());
    const host = document.getElementById("conviteInstalar");
    const voltar = host && host.contains(document.activeElement);
    esconder();
    // O foco volta para a ação principal, não some com o convite.
    if (voltar) {
      document.querySelector(".reality-cta__acoes .btn-primario")?.focus();
    }
  }
  function avaliar({proprias: n = 0} = {}) {
    proprias = Number(n) || 0;
    const host = document.getElementById("conviteInstalar");
    const PN = window.FinckPainel;
    if (!host || !PN) {
      return;
    }
    const mostrar = PN.deveConvidarInstalacao({
      instalado: instalado(),
      podeConvidar: Boolean(evento) || iOS,
      proprias: proprias,
      dispensadoEm: ler()
    });
    if (!mostrar) {
      esconder();
      return;
    }
    if (!host.hidden && host.innerHTML) {
      return;
    }
    host.innerHTML = `\n      <div class="convite-instalar__texto">\n        <strong>Adicionar o FinCK à tela inicial</strong>\n        <p>${evento ? "Ele abre em tela cheia, como um aplicativo, e continua precisando de internet." : "No iPhone: toque em Compartilhar e escolha “Adicionar à Tela de Início”. Ele abre em tela cheia e continua precisando de internet."}</p>\n      </div>\n      <div class="convite-instalar__acoes">\n        ${evento ? `<button type="button" class="btn-secundario btn-mini" data-instalar>Adicionar à tela inicial</button>` : ""}\n        <button type="button" class="btn-texto" data-dispensar>${evento ? "Agora não" : "Entendi"}</button>\n      </div>`;
    host.hidden = false;
    host.querySelector("[data-dispensar]").addEventListener("click", dispensar);
    host.querySelector("[data-instalar]")?.addEventListener("click", async () => {
      const pedido = evento;
      if (!pedido) {
        return esconder();
      }
      evento = null;
      try {
        pedido.prompt();
        const escolha = await pedido.userChoice;
        if (escolha && escolha.outcome !== "accepted") {
          gravar(Date.now());
        }
      } catch {}
      esconder();
    });
  }
  window.FinckInstalarHome = {
    avaliar: avaliar
  };
})();
