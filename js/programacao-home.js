document.addEventListener("DOMContentLoaded", () => {
  const U = window.FinckUtils;
  const P = window.FinckProgramacao;
  const host = document.getElementById("programacaoFinanceira");
  if (!host || !P) return;

  const JANELA = 60;
  const MAX_TORRES = 9;
  const ALTURA_MIN = 15;
  const ALTURA_MAX = 74;
  const MARGEM = 0.05;
  const PAUSA_FOCO = 3000;

  let cicloFoco = 0;

  function agrupar(compromissos) {
    const mapa = new Map();
    for (const c of compromissos) {
      const g = mapa.get(c.iso) || {
        iso: c.iso, data: c.data, emDias: c.emDias,
        descricao: c.descricao, itens: 0, valor: 0,
        vencido: c.vencido, acumulado: 0,
      };
      g.itens += 1;
      g.valor += c.valor;
      g.acumulado = Math.max(g.acumulado, c.acumulado);
      mapa.set(c.iso, g);
    }
    return [...mapa.values()];
  }

  const chaoHTML = () => `
    <div class="pf3d__chao">
      <span class="pf3d__grade"></span>
      <span class="pf3d__cobertura"></span>
      <span class="pf3d__descoberto"></span>
      <span class="pf3d__varredura"></span>
    </div>`;

  const marcoHTML = () => `
    <span class="pf3d__hoje"></span>
    <span class="pf3d__feixe"></span>`;

  const torreHTML = (t, altura, i, extra = "") => `
    <div class="pf3d__torre ${extra}"
         style="--t:${t.toFixed(4)};--h:${altura.toFixed(1)}px;--i:${i}">
      <span class="pf3d__brasa"></span>
      <span class="pf3d__face pf3d__face--n"></span>
      <span class="pf3d__face pf3d__face--s"></span>
      <span class="pf3d__face pf3d__face--o"></span>
      <span class="pf3d__face pf3d__face--l"></span>
      <span class="pf3d__face pf3d__face--topo"></span>
      <span class="pf3d__moeda"></span>
    </div>`;

  function cenaVazia() {
    const fantasmas = [0.2, 0.44, 0.67, 0.88]
      .map((t, i) => torreHTML(t, 20 + i * 10, i, "pf3d__torre--fantasma"))
      .join("");

    return {
      grupos: [],
      html: `
        <div class="pf3d pf3d--vazia" data-pf3d style="--cobertura:1;--t0:0.04">
          <div class="pf3d__janela">
            <div class="pf3d__camera">
              <div class="pf3d__pista">
                ${chaoHTML()}
                ${marcoHTML()}
                ${fantasmas}
              </div>
            </div>
            <span class="pf3d__selo pf3d__selo--neutro">pista livre</span>
            <p class="pf3d__foco">
              <span class="pf3d__foco-nome">Nada programado para os próximos ${JANELA} dias.</span>
            </p>
          </div>
        </div>`,
    };
  }

  function montarCena(pan) {
    const grupos = agrupar(pan.compromissos).slice(0, MAX_TORRES);
    if (!grupos.length) return cenaVazia();

    const menor = Math.min(0, ...grupos.map((g) => g.emDias));
    const alcance = Math.max(1, JANELA - menor);
    // margem nas pontas para nenhuma torre nascer fora da pista
    const posicao = (dias) =>
      MARGEM + (1 - MARGEM * 2) * Math.max(0, Math.min(1, (dias - menor) / alcance));

    const maior = Math.max(...grupos.map((g) => g.valor));
    const altura = (v) => ALTURA_MIN + (maior > 0 ? v / maior : 0) * (ALTURA_MAX - ALTURA_MIN);

    const rompe = grupos.find((g) => g.acumulado > pan.saldo);
    const cobertura = pan.saldo <= 0 ? 0 : rompe ? posicao(rompe.emDias) : 1;

    const torres = grupos.map((g, i) => torreHTML(
      posicao(g.emDias), altura(g.valor), i,
      g.vencido ? "pf3d__torre--vencida" : g.acumulado > pan.saldo ? "pf3d__torre--fora" : ""
    )).join("");

    const selo = pan.saldo <= 0
      ? ["pf3d__selo--risco", "sem saldo hoje"]
      : rompe
        ? ["pf3d__selo--risco", `descoberto em ${P.rotuloData(rompe.data)}`]
        : ["", `saldo cobre os ${JANELA} dias`];

    return {
      grupos,
      html: `
        <div class="pf3d" data-pf3d
             style="--cobertura:${cobertura.toFixed(4)};--t0:${posicao(0).toFixed(4)}">
          <div class="pf3d__janela">
            <div class="pf3d__camera">
              <div class="pf3d__pista">
                ${chaoHTML()}
                ${cobertura < 1 ? '<span class="pf3d__ruptura"></span>' : ""}
                ${marcoHTML()}
                ${torres}
              </div>
            </div>
            <span class="pf3d__selo ${selo[0]}">${selo[1]}</span>
            <p class="pf3d__foco" data-pf3d-foco></p>
          </div>
        </div>`,
    };
  }

  function render(pan) {
    clearInterval(cicloFoco);
    const cena = montarCena(pan);

    if (!pan.compromissos.length) {
      host.innerHTML = `
        <div class="prog-cabecalho">
          <h3>Programação financeira</h3>
        </div>
        ${cena.html}
        <p class="vazio">
          Você ainda não tem saídas recorrentes cadastradas.
          <a href="recorrentes.html">Cadastrar a primeira</a> para ver quanto do seu
          saldo já está comprometido e até quando.
        </p>`;
      ligarCena(cena.grupos, pan.saldo);
      return;
    }

    const p = pan.proximo;
    const proximos = pan.compromissos.slice(0, 4);
    const restantes = pan.compromissos.length - proximos.length;

    host.innerHTML = `
      <div class="prog-cabecalho">
        <h3>Programação financeira</h3>
        <span class="prog-janela">próximos ${JANELA} dias</span>
      </div>

      ${cena.html}

      <p class="prog-chamada">
        ${p
          ? `Até <strong>${P.rotuloLongo(p.data)}</strong> você tem
             <strong class="prog-chamada__valor">${U.moeda(pan.comprometidoAteProximo)}</strong>
             em saídas previstas.`
          : `Você tem
             <strong class="prog-chamada__valor">${U.moeda(pan.totalVencido)}</strong>
             em saídas vencidas aguardando decisão.`}
      </p>

      ${pan.vencidos.length ? `
        <p class="prog-vencidos">
          ${pan.vencidos.length === 1
            ? "1 saída venceu e ainda não foi decidida. Continua contando até você decidir."
            : `${pan.vencidos.length} saídas venceram e ainda não foram decididas. Continuam contando até você decidir.`}
        </p>` : ""}

      <ul class="prog-lista">
        ${proximos.map((c) => `
          <li${c.vencido ? ' class="prog-lista--vencido"' : ""}>
            <span class="prog-lista__data">${P.rotuloData(c.data)}</span>
            <span class="prog-lista__nome">${U.escapeHTML(c.descricao)}</span>
            <span class="prog-lista__quando">${P.quandoTexto(c.emDias)}</span>
            <strong class="prog-lista__valor">${U.moeda(c.valor)}</strong>
          </li>`).join("")}
      </ul>
      ${restantes > 0 ? `<p class="prog-mais">e mais ${restantes} até ${P.rotuloData(pan.compromissos[pan.compromissos.length - 1].data)}</p>` : ""}

      <dl class="prog-contas">
        <div><dt>Saldo atual</dt><dd>${U.moeda(pan.saldo)}</dd></div>
        <div><dt>Comprometido em ${JANELA} dias</dt><dd class="prog-contas__preso">${U.moeda(pan.comprometidoTotal)}</dd></div>
        <div class="prog-contas__sobra">
          <dt>Não comprometido</dt>
          <dd class="${pan.naoComprometido < 0 ? "cor-vermelha" : ""}">${U.moeda(pan.naoComprometido)}</dd>
        </div>
      </dl>

      <p class="prog-nota">
        ${pan.naoComprometido < 0
          ? `Estas saídas somam mais que o seu saldo de hoje. O que fazer com isso é decisão sua.`
          : `${U.moeda(pan.naoComprometido)} não estão comprometidos por essas saídas programadas.`}
      </p>

      <button type="button" class="btn-secundario" id="btnVerProgramacao">Ver programação completa</button>`;

    ligarCena(cena.grupos, pan.saldo);

    const botao = document.getElementById("btnVerProgramacao");
    if (botao) botao.addEventListener("click", () => abrirLinha(pan));
  }

  function abrirLinha(pan) {
    const alvo = document.getElementById("conteudoProgramacao");
    if (!alvo) return;

    alvo.innerHTML = `
      <p class="prog-modal__intro">
        Cada marco mostra quanto precisa permanecer disponível até aquela data,
        somando tudo que vem antes.
      </p>
      <ol class="prog-linha">
        <li class="prog-linha__hoje"><span class="prog-linha__ponto"></span><div><strong>Hoje</strong>
          <span>${U.moeda(pan.saldo)} em conta</span></div></li>
        ${pan.compromissos.map((c) => `
          <li${c.vencido ? ' class="prog-linha--vencido"' : ""}>
            <span class="prog-linha__ponto"></span>
            <div>
              <strong>${P.rotuloData(c.data)} · ${U.escapeHTML(c.descricao)}</strong>
              <span>${U.moeda(c.valor)} · acumulado ${U.moeda(c.acumulado)}${c.vencido ? " · vencido, aguardando decisão" : ""}</span>
            </div>
            <em class="${pan.saldo - c.acumulado < 0 ? "cor-vermelha" : ""}">
              sobra ${U.moeda(pan.saldo - c.acumulado)}
            </em>
          </li>`).join("")}
      </ol>`;
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
      if (pendente) cancelAnimationFrame(pendente);
      pendente = requestAnimationFrame(aplicar);
    };
    const mover = (e) => {
      const t = e.touches && e.touches[0] ? e.touches[0] : e;
      if (!t || typeof t.clientX !== "number") return;
      const r = cena.getBoundingClientRect();
      if (!r.width || !r.height) return;
      px = (t.clientX - r.left) / r.width - 0.5;
      py = ((t.clientY - r.top) / r.height - 0.5) * -1;
      agendar();
    };
    const sair = () => { px = 0; py = 0; agendar(); };

    cena.addEventListener("pointermove", mover, { passive: true });
    cena.addEventListener("touchmove", mover, { passive: true });
    ["pointerleave", "pointercancel", "touchend", "touchcancel"].forEach((ev) =>
      cena.addEventListener(ev, sair, { passive: true }));
  }

  function ligarCena(grupos, saldo) {
    const cena = host.querySelector("[data-pf3d]");
    if (!cena) return;

    ligarParallax(cena);

    const foco = cena.querySelector("[data-pf3d-foco]");
    const torres = [...cena.querySelectorAll(".pf3d__torre:not(.pf3d__torre--fantasma)")];
    if (!foco || !torres.length) return;

    let atual = -1;
    let pausado = false;

    const mostrar = (i) => {
      if (i === atual || !grupos[i]) return;
      atual = i;
      torres.forEach((t, n) => t.classList.toggle("pf3d__torre--foco", n === i));

      const g = grupos[i];
      const fora = !g.vencido && g.acumulado > saldo;
      const quando = P.quandoTexto(g.emDias);

      foco.className = "pf3d__foco" +
        (g.vencido ? " pf3d__foco--vencida" : fora ? " pf3d__foco--fora" : "");
      foco.innerHTML = `
        <span class="pf3d__foco-data">${P.rotuloData(g.data)}</span>
        <span class="pf3d__foco-nome">${g.itens > 1
          ? `${g.itens} saídas · ${quando}`
          : `${U.escapeHTML(g.descricao)} · ${quando}`}</span>
        <strong class="pf3d__foco-valor">${U.moeda(g.valor)}</strong>`;
    };

    mostrar(0);

    torres.forEach((t, n) => {
      const fixar = () => { pausado = true; mostrar(n); };
      t.addEventListener("pointerenter", fixar, { passive: true });
      t.addEventListener("pointerdown", fixar, { passive: true });
    });
    cena.addEventListener("pointerleave", () => { pausado = false; }, { passive: true });

    if (torres.length < 2) return;
    cicloFoco = setInterval(() => {
      if (document.hidden || pausado) return;
      mostrar((atual + 1) % torres.length);
    }, PAUSA_FOCO);
  }

  async function carregar() {
    const ctx = await window.FinckFinance.carregarContexto();
    let ocorrencias = [];
    try {
      ocorrencias = await window.FinckStore.listar("recurring_occurrences", {
        ordem: "due_date", asc: true,
      });
    } catch (e) {
      ocorrencias = [];
    }
    render(P.panorama(
      { ocorrencias, recorrentes: ctx.recorrentes }, ctx.saldo, { dias: JANELA }));
  }

  carregar();
  window.FinckProgramacaoHome = { recarregar: carregar };
});

document.addEventListener("DOMContentLoaded", () => {
  const jaInstalado = window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (jaInstalado || sessionStorage.getItem("finck.instalar.oculto")) return;

  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let evento = null;

  const montar = (texto, aoTocar) => {
    if (document.querySelector(".finck-instalar")) return;
    const faixa = document.createElement("div");
    faixa.className = "finck-instalar";
    faixa.innerHTML = `
      <span class="finck-instalar__texto">${texto}</span>
      <button type="button" class="finck-instalar__acao">${aoTocar ? "Instalar" : "Entendi"}</button>
      <button type="button" class="finck-instalar__fechar" aria-label="Dispensar">✕</button>`;
    document.body.appendChild(faixa);
    requestAnimationFrame(() => faixa.classList.add("finck-instalar--visivel"));

    const sumir = () => {
      faixa.classList.remove("finck-instalar--visivel");
      sessionStorage.setItem("finck.instalar.oculto", "1");
      setTimeout(() => faixa.remove(), 400);
    };
    faixa.querySelector(".finck-instalar__fechar").addEventListener("click", sumir);
    faixa.querySelector(".finck-instalar__acao").addEventListener("click", async () => {
      if (aoTocar) await aoTocar();
      sumir();
    });
  };

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    evento = e;
    setTimeout(() => montar("Instale o FinCK na sua tela inicial.", async () => {
      evento.prompt();
      await evento.userChoice;
      evento = null;
    }), 2600);
  });

  if (iOS) {
    setTimeout(() => montar(
      "Para instalar: toque em Compartilhar e escolha “Adicionar à Tela de Início”.", null), 2600);
  }
});
