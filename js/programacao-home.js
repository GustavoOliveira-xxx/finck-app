document.addEventListener("DOMContentLoaded", () => {
  const U = window.FinckUtils;
  const P = window.FinckProgramacao;
  const host = document.getElementById("programacaoFinanceira");
  if (!host || !P) return;

  const JANELA = 60;

  function montarCena() {
    return `
      <div class="prog3d" data-prog3d aria-hidden="true">
        <div class="prog3d__palco">
          <span class="prog3d__base"></span>
          <span class="prog3d__bloco prog3d__bloco--1"></span>
          <span class="prog3d__bloco prog3d__bloco--2"></span>
          <span class="prog3d__bloco prog3d__bloco--3"></span>
          <span class="prog3d__moeda"></span>
        </div>
      </div>`;
  }

  function render(pan) {
    if (!pan.compromissos.length) {
      host.innerHTML = `
        <div class="prog-cabecalho">
          <h3>Programação financeira</h3>
        </div>
        ${montarCena()}
        <p class="vazio">
          Você ainda não tem saídas recorrentes cadastradas.
          <a href="recorrentes.html">Cadastrar a primeira</a> para ver quanto do seu
          saldo já está comprometido e até quando.
        </p>`;
      ligarCena();
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

      ${montarCena()}

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

    ligarCena();

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

  function ligarCena() {
    const cena = host.querySelector("[data-prog3d]");
    const palco = cena && cena.querySelector(".prog3d__palco");
    if (!palco) return;

    let px = 0, py = 0, pendente = 0;
    const aplicar = () => {
      pendente = 0;
      palco.style.setProperty("--px", px.toFixed(3));
      palco.style.setProperty("--py", py.toFixed(3));
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
    document.addEventListener("visibilitychange", () => { if (!document.hidden) sair(); });
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
