/* ============================================================
   FinCK of Reality — Cabeçalho e navegação compartilhados
   Injeta o header em [data-finck-header] e marca o item ativo
   da navegação inferior a partir de data-page no <body>.
   ============================================================ */

window.FinckNav = (() => {
  const S = window.FinckStore;
  const U = window.FinckUtils;

  const ICONES = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"/></svg>',
    metas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
    gamificacao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5.5"/><path d="M9 13.5 7 21l5-2.5L17 21l-2-7.5"/></svg>',
    perfil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6"/></svg>',
  };

  const ITENS = [
    { id: "home", href: "home.html", rotulo: "Início", icone: ICONES.home },
    { id: "reality", href: "reality.html", rotulo: "Reality", icone: '<img src="assets/logo-reality-transparente.png" alt="">', destaque: true },
    { id: "metas", href: "metas.html", rotulo: "Metas", icone: ICONES.metas },
    { id: "gamificacao", href: "gamificacao.html", rotulo: "Jornada", icone: ICONES.gamificacao },
    { id: "perfil", href: "perfil.html", rotulo: "Perfil", icone: ICONES.perfil },
  ];

  function montarHeader(titulo, subtitulo) {
    const host = document.querySelector("[data-finck-header]");
    if (!host) return;
    host.innerHTML = `
      <div class="logo">
        <a class="logo-mark logo-mark--marca" href="home.html" aria-label="FinCK — início">
          <img src="assets/logo-ck-256.png" alt="Financial CK" width="256" height="256" loading="eager" decoding="async">
        </a>
        <div class="logo-text">
          <h1>${U.escapeHTML(titulo || "FinCK of Reality")}</h1>
          <span>${U.escapeHTML(subtitulo || "Consumo consciente")}</span>
        </div>
      </div>
      <div class="header-actions">
        <span class="modo-dados" title="${S.ONLINE ? "Conectado ao banco de dados" : "Modo offline (localStorage)"}">
          <span class="modo-dados-icone" aria-hidden="true">${S.ONLINE
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18h10a4 4 0 0 0 .6-7.96 5.5 5.5 0 0 0-10.6 1.63A3.5 3.5 0 0 0 7 18Z"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><path d="M7 14h10v6H7z"/></svg>'
          }</span> ${S.ONLINE ? "Online" : "Offline"}
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
