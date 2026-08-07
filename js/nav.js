/* ============================================================
   FinCK of Reality — Cabeçalho e navegação compartilhados
   Injeta o header em [data-finck-header] e marca o item ativo
   da navegação inferior a partir de data-page no <body>.
   ============================================================ */

window.FinckNav = (() => {
  const S = window.FinckStore;
  const U = window.FinckUtils;

  const ITENS = [
    { id: "home", href: "home.html", rotulo: "Início", icone: "🏠" },
    { id: "reality", href: "reality.html", rotulo: "Reality", icone: '<img src="assets/logo-reality-transparente.png" alt="">', destaque: true },
    { id: "metas", href: "metas.html", rotulo: "Metas", icone: "🎯" },
    { id: "gamificacao", href: "gamificacao.html", rotulo: "Jornada", icone: "🏅" },
    { id: "perfil", href: "perfil.html", rotulo: "Perfil", icone: "👤" },
  ];

  function montarHeader(titulo, subtitulo) {
    const host = document.querySelector("[data-finck-header]");
    if (!host) return;
    host.innerHTML = `
      <div class="logo">
        <a class="logo-mark logo-mark--marca" href="home.html" aria-label="Conscious Knowledge — início">
          <img src="assets/logo-ck.png" alt="Conscious Knowledge" loading="eager" decoding="async">
        </a>
        <div class="logo-text">
          <h1>${U.escapeHTML(titulo || "FinCK of Reality")}</h1>
          <span>${U.escapeHTML(subtitulo || "Consumo consciente")}</span>
        </div>
      </div>
      <div class="header-actions">
        <span class="modo-dados" title="${S.ONLINE ? "Conectado ao banco de dados" : "Modo offline (localStorage)"}">
          <span aria-hidden="true">${S.ONLINE ? "☁" : "💾"}</span> ${S.ONLINE ? "Online" : "Offline"}
        </span>
        <button type="button" id="btnSair" class="btn-sair">Sair</button>
      </div>`;
    const btn = document.getElementById("btnSair");
    if (btn) btn.addEventListener("click", async () => { await S.sair(); location.href = "index.html"; });
  }

  function montarNav() {
    const host = document.querySelector("[data-finck-nav]");
    if (!host) return;
    const atual = document.body.dataset.page;
    host.innerHTML = ITENS.map((i) => `
      <a class="nav-item${i.id === atual ? " ativo" : ""}${i.destaque ? " nav-item--destaque" : ""}"
         href="${i.href}" ${i.id === atual ? 'aria-current="page"' : ""}>
        <span class="nav-icone" aria-hidden="true">${i.icone}</span>
        <span class="nav-rotulo">${i.rotulo}</span>
      </a>`).join("");
  }

  /** Bootstrap padrão das páginas internas: sessão, onboarding, header, nav e modais. */
  async function iniciarPagina({ titulo, subtitulo, exigirPerfil = true } = {}) {
    const user = await S.exigirLogin();
    if (!user) return null;
    if (exigirPerfil && (await S.precisaOnboarding()) && !location.pathname.endsWith("onboarding.html")) {
      location.href = "onboarding.html";
      return null;
    }
    montarHeader(titulo, subtitulo);
    montarNav();
    // XP de presença: primeiro acesso do dia e manutenção da sequência
    const G = window.FinckGame;
    if (G) {
      const hoje = U.hojeISO();
      await G.premiar("primeiro_acesso", { chave: hoje, motivo: "primeiro acesso do dia", silencioso: true });
      const estado = await S.obterGamificacao();
      if (Number(estado.streak || 0) >= 2) {
        await G.premiar("streak", { chave: hoje, motivo: "sequência diária mantida", silencioso: true });
      }
    }
    U.ligarModais();
    return user;
  }

  return { ITENS, montarHeader, montarNav, iniciarPagina };
})();
