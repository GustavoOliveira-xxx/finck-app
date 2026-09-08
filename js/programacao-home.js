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
    const rompe = grupos.find(g => g.acumulado > pan.saldo);
    const cobertura = pan.saldo <= 0 ? 0 : rompe ? posicao(rompe.emDias) : 1;
    const torres = grupos.map((g, i) => torreHTML(posicao(g.emDias), altura(g.valor), i, g.vencido ? "pf3d__torre--vencida" : g.acumulado > pan.saldo ? "pf3d__torre--fora" : "")).join("");
    const selo = pan.saldo <= 0 ? [ "pf3d__selo--risco", "sem saldo hoje" ] : rompe ? [ "pf3d__selo--risco", `descoberto em ${P.rotuloData(rompe.data)}` ] : [ "", `saldo cobre os ${JANELA} dias` ];
    return {
      grupos: grupos,
      html: `\n        <div class="pf3d" data-pf3d\n             style="--cobertura:${cobertura.toFixed(4)};--t0:${posicao(0).toFixed(4)}">\n          <div class="pf3d__janela">\n            <div class="pf3d__camera">\n              <div class="pf3d__pista">\n                ${chaoHTML()}\n                ${cobertura < 1 ? '<span class="pf3d__ruptura"></span>' : ""}\n                ${marcoHTML()}\n                ${torres}\n              </div>\n            </div>\n            <span class="pf3d__selo ${selo[0]}">${selo[1]}</span>\n            <p class="pf3d__foco" data-pf3d-foco></p>\n          </div>\n        </div>`
    };
  }
  function render(pan) {
    clearInterval(cicloFoco);
    const cena = montarCena(pan);
    if (!pan.compromissos.length) {
      host.innerHTML = `\n        <div class="prog-cabecalho">\n          <h3>Programação financeira</h3>\n        </div>\n        ${cena.html}\n        <p class="vazio">\n          Você ainda não tem saídas recorrentes cadastradas.\n          <a href="recorrentes.html">Cadastrar a primeira</a> para ver quanto do seu\n          saldo já está comprometido e até quando.\n        </p>`;
      ligarCena(cena.grupos, pan.saldo);
      return;
    }
    const p = pan.proximo;
    const proximos = pan.compromissos.slice(0, 4);
    const restantes = pan.compromissos.length - proximos.length;
    host.innerHTML = `\n      <div class="prog-cabecalho">\n        <h3>Programação financeira</h3>\n        <span class="prog-janela">próximos ${JANELA} dias</span>\n      </div>\n\n      ${cena.html}\n\n      <p class="prog-chamada">\n        ${p ? `Até <strong>${P.rotuloLongo(p.data)}</strong> você tem\n             <strong class="prog-chamada__valor">${U.moeda(pan.comprometidoAteProximo)}</strong>\n             em saídas previstas.` : `Você tem\n             <strong class="prog-chamada__valor">${U.moeda(pan.totalVencido)}</strong>\n             em saídas vencidas aguardando decisão.`}\n      </p>\n\n      ${pan.vencidos.length ? `\n        <p class="prog-vencidos">\n          ${pan.vencidos.length === 1 ? "1 saída venceu e ainda não foi decidida. Continua contando até você decidir." : `${pan.vencidos.length} saídas venceram e ainda não foram decididas. Continuam contando até você decidir.`}\n        </p>` : ""}\n\n      <ul class="prog-lista">\n        ${proximos.map(c => `\n          <li${c.vencido ? ' class="prog-lista--vencido"' : ""}>\n            <span class="prog-lista__data">${P.rotuloData(c.data)}</span>\n            <span class="prog-lista__nome">${U.escapeHTML(c.descricao)}</span>\n            <span class="prog-lista__quando">${P.quandoTexto(c.emDias)}</span>\n            <strong class="prog-lista__valor">${U.moeda(c.valor)}</strong>\n          </li>`).join("")}\n      </ul>\n      ${restantes > 0 ? `<p class="prog-mais">e mais ${restantes} até ${P.rotuloData(pan.compromissos[pan.compromissos.length - 1].data)}</p>` : ""}\n\n      <dl class="prog-contas">\n        <div><dt>Saldo atual</dt><dd>${U.moeda(pan.saldo)}</dd></div>\n        <div><dt>Comprometido em ${JANELA} dias</dt><dd class="prog-contas__preso">${U.moeda(pan.comprometidoTotal)}</dd></div>\n        <div class="prog-contas__sobra">\n          <dt>Não comprometido</dt>\n          <dd class="${pan.naoComprometido < 0 ? "cor-vermelha" : ""}">${U.moeda(pan.naoComprometido)}</dd>\n        </div>\n      </dl>\n\n      <p class="prog-nota">\n        ${pan.naoComprometido < 0 ? `Estas saídas somam mais que o seu saldo de hoje. O que fazer com isso é decisão sua.` : `${U.moeda(pan.naoComprometido)} não estão comprometidos por essas saídas programadas.`}\n      </p>\n\n      <button type="button" class="btn-secundario" id="btnVerProgramacao">Ver programação completa</button>`;
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
    alvo.innerHTML = `\n      <p class="prog-modal__intro">\n        Cada marco mostra quanto precisa permanecer disponível até aquela data,\n        somando tudo que vem antes.\n      </p>\n      <ol class="prog-linha">\n        <li class="prog-linha__hoje"><span class="prog-linha__ponto"></span><div><strong>Hoje</strong>\n          <span>${U.moeda(pan.saldo)} em conta</span></div></li>\n        ${pan.compromissos.map(c => `\n          <li${c.vencido ? ' class="prog-linha--vencido"' : ""}>\n            <span class="prog-linha__ponto"></span>\n            <div>\n              <strong>${P.rotuloData(c.data)} · ${U.escapeHTML(c.descricao)}</strong>\n              <span>${U.moeda(c.valor)} · acumulado ${U.moeda(c.acumulado)}${c.vencido ? " · vencido, aguardando decisão" : ""}</span>\n            </div>\n            <em class="${pan.saldo - c.acumulado < 0 ? "cor-vermelha" : ""}">\n              sobra ${U.moeda(pan.saldo - c.acumulado)}\n            </em>\n          </li>`).join("")}\n      </ol>`;
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
      const fora = !g.vencido && g.acumulado > saldo;
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
  async function carregar() {
    const ctx = await window.FinckFinance.carregarContexto();
    let ocorrencias = [];
    try {
      ocorrencias = await window.FinckStore.listar("recurring_occurrences", {
        ordem: "due_date",
        asc: true
      });
    } catch (e) {
      ocorrencias = [];
    }
    render(P.panorama({
      ocorrencias: ocorrencias,
      recorrentes: ctx.recorrentes
    }, ctx.saldo, {
      dias: JANELA
    }));
  }
  carregar();
  window.FinckProgramacaoHome = {
    recarregar: carregar
  };
});

document.addEventListener("DOMContentLoaded", () => {
  const jaInstalado = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (jaInstalado || sessionStorage.getItem("finck.instalar.oculto")) {
    return;
  }
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let evento = null;
  const montar = (texto, aoTocar) => {
    if (document.querySelector(".finck-instalar")) {
      return;
    }
    const faixa = document.createElement("div");
    faixa.className = "finck-instalar";
    faixa.innerHTML = `\n      <span class="finck-instalar__texto">${texto}</span>\n      <button type="button" class="finck-instalar__acao">${aoTocar ? "Instalar" : "Entendi"}</button>\n      <button type="button" class="finck-instalar__fechar" aria-label="Dispensar">✕</button>`;
    document.body.appendChild(faixa);
    requestAnimationFrame(() => faixa.classList.add("finck-instalar--visivel"));
    const sumir = () => {
      faixa.classList.remove("finck-instalar--visivel");
      sessionStorage.setItem("finck.instalar.oculto", "1");
      setTimeout(() => faixa.remove(), 400);
    };
    faixa.querySelector(".finck-instalar__fechar").addEventListener("click", sumir);
    faixa.querySelector(".finck-instalar__acao").addEventListener("click", async () => {
      if (aoTocar) {
        await aoTocar();
      }
      sumir();
    });
  };
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    evento = e;
    setTimeout(() => montar("Instale o FinCK na sua tela inicial. Ele abre em tela cheia, mas ainda precisa de internet.", async () => {
      evento.prompt();
      await evento.userChoice;
      evento = null;
    }), 2600);
  });
  if (iOS) {
    setTimeout(() => montar("Para instalar: toque em Compartilhar e escolha “Adicionar à Tela de Início”. O app abre em tela cheia, mas ainda precisa de internet.", null), 2600);
  }
});
