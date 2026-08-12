

(() => {
  "use strict";

  const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toque = window.matchMedia("(hover: none)").matches;
  const raf = window.requestAnimationFrame.bind(window);

  const TICKER_SVG = `
    <svg class="fundo-finck__ticker-trilho" viewBox="0 0 3200 220" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="finckTickerFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#b45cf0" stop-opacity=".16"/>
          <stop offset="100%" stop-color="#b45cf0" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <g id="finckTickerPeriodo">
        <path d="M0,123.2 L8,125.08 L16,126.95 L24,128.81 L32,130.63 L40,132.42 L48,134.16 L56,135.85 L64,137.48 L72,139.04 L80,140.53 L88,141.93 L96,143.24 L104,144.47 L112,145.59 L120,146.61 L128,147.53 L136,148.35 L144,149.05 L152,149.65 L160,150.14 L168,150.52 L176,150.8 L184,150.97 L192,151.04 L200,151.02 L208,150.9 L216,150.7 L224,150.41 L232,150.05 L240,149.62 L248,149.12 L256,148.57 L264,147.97 L272,147.33 L280,146.66 L288,145.95 L296,145.24 L304,144.51 L312,143.77 L320,143.04 L328,142.33 L336,141.62 L344,140.95 L352,140.3 L360,139.69 L368,139.11 L376,138.58 L384,138.1 L392,137.67 L400,137.29 L408,136.96 L416,136.69 L424,136.47 L432,136.31 L440,136.2 L448,136.14 L456,136.14 L464,136.17 L472,136.25 L480,136.37 L488,136.53 L496,136.71 L504,136.91 L512,137.13 L520,137.37 L528,137.6 L536,137.84 L544,138.06 L552,138.27 L560,138.46 L568,138.62 L576,138.74 L584,138.82 L592,138.85 L600,138.83 L608,138.75 L616,138.61 L624,138.4 L632,138.11 L640,137.76 L648,137.32 L656,136.8 L664,136.21 L672,135.53 L680,134.77 L688,133.93 L696,133.01 L704,132.02 L712,130.96 L720,129.82 L728,128.62 L736,127.36 L744,126.04 L752,124.68 L760,123.28 L768,121.84 L776,120.37 L784,118.89 L792,117.4 L800,115.9 L808,114.41 L816,112.94 L824,111.49 L832,110.07 L840,108.7 L848,107.38 L856,106.11 L864,104.91 L872,103.78 L880,102.74 L888,101.78 L896,100.92 L904,100.15 L912,99.49 L920,98.93 L928,98.49 L936,98.16 L944,97.94 L952,97.85 L960,97.87 L968,98.0 L976,98.25 L984,98.62 L992,99.1 L1000,99.68 L1008,100.37 L1016,101.15 L1024,102.03 L1032,102.99 L1040,104.04 L1048,105.15 L1056,106.34 L1064,107.58 L1072,108.86 L1080,110.19 L1088,111.56 L1096,112.94 L1104,114.34 L1112,115.74 L1120,117.15 L1128,118.54 L1136,119.91 L1144,121.25 L1152,122.56 L1160,123.82 L1168,125.04 L1176,126.2 L1184,127.3 L1192,128.33 L1200,129.29 L1208,130.18 L1216,130.99 L1224,131.72 L1232,132.37 L1240,132.94 L1248,133.42 L1256,133.82 L1264,134.14 L1272,134.39 L1280,134.55 L1288,134.65 L1296,134.67 L1304,134.63 L1312,134.53 L1320,134.38 L1328,134.17 L1336,133.93 L1344,133.64 L1352,133.33 L1360,133.0 L1368,132.65 L1376,132.29 L1384,131.92 L1392,131.57 L1400,131.22 L1408,130.89 L1416,130.58 L1424,130.3 L1432,130.06 L1440,129.85 L1448,129.69 L1456,129.57 L1464,129.51 L1472,129.5 L1480,129.54 L1488,129.64 L1496,129.79 L1504,130.0 L1512,130.27 L1520,130.59 L1528,130.96 L1536,131.38 L1544,131.85 L1552,132.36 L1560,132.91 L1568,133.49 L1576,134.09 L1584,134.72 L1592,135.35 L1600,136.0 L1600,220 L0,220 Z" fill="url(#finckTickerFill)"></path>
        <path class="fundo-finck__ticker-linha fundo-finck__ticker-linha--a" d="M0,123.2 L8,125.08 L16,126.95 L24,128.81 L32,130.63 L40,132.42 L48,134.16 L56,135.85 L64,137.48 L72,139.04 L80,140.53 L88,141.93 L96,143.24 L104,144.47 L112,145.59 L120,146.61 L128,147.53 L136,148.35 L144,149.05 L152,149.65 L160,150.14 L168,150.52 L176,150.8 L184,150.97 L192,151.04 L200,151.02 L208,150.9 L216,150.7 L224,150.41 L232,150.05 L240,149.62 L248,149.12 L256,148.57 L264,147.97 L272,147.33 L280,146.66 L288,145.95 L296,145.24 L304,144.51 L312,143.77 L320,143.04 L328,142.33 L336,141.62 L344,140.95 L352,140.3 L360,139.69 L368,139.11 L376,138.58 L384,138.1 L392,137.67 L400,137.29 L408,136.96 L416,136.69 L424,136.47 L432,136.31 L440,136.2 L448,136.14 L456,136.14 L464,136.17 L472,136.25 L480,136.37 L488,136.53 L496,136.71 L504,136.91 L512,137.13 L520,137.37 L528,137.6 L536,137.84 L544,138.06 L552,138.27 L560,138.46 L568,138.62 L576,138.74 L584,138.82 L592,138.85 L600,138.83 L608,138.75 L616,138.61 L624,138.4 L632,138.11 L640,137.76 L648,137.32 L656,136.8 L664,136.21 L672,135.53 L680,134.77 L688,133.93 L696,133.01 L704,132.02 L712,130.96 L720,129.82 L728,128.62 L736,127.36 L744,126.04 L752,124.68 L760,123.28 L768,121.84 L776,120.37 L784,118.89 L792,117.4 L800,115.9 L808,114.41 L816,112.94 L824,111.49 L832,110.07 L840,108.7 L848,107.38 L856,106.11 L864,104.91 L872,103.78 L880,102.74 L888,101.78 L896,100.92 L904,100.15 L912,99.49 L920,98.93 L928,98.49 L936,98.16 L944,97.94 L952,97.85 L960,97.87 L968,98.0 L976,98.25 L984,98.62 L992,99.1 L1000,99.68 L1008,100.37 L1016,101.15 L1024,102.03 L1032,102.99 L1040,104.04 L1048,105.15 L1056,106.34 L1064,107.58 L1072,108.86 L1080,110.19 L1088,111.56 L1096,112.94 L1104,114.34 L1112,115.74 L1120,117.15 L1128,118.54 L1136,119.91 L1144,121.25 L1152,122.56 L1160,123.82 L1168,125.04 L1176,126.2 L1184,127.3 L1192,128.33 L1200,129.29 L1208,130.18 L1216,130.99 L1224,131.72 L1232,132.37 L1240,132.94 L1248,133.42 L1256,133.82 L1264,134.14 L1272,134.39 L1280,134.55 L1288,134.65 L1296,134.67 L1304,134.63 L1312,134.53 L1320,134.38 L1328,134.17 L1336,133.93 L1344,133.64 L1352,133.33 L1360,133.0 L1368,132.65 L1376,132.29 L1384,131.92 L1392,131.57 L1400,131.22 L1408,130.89 L1416,130.58 L1424,130.3 L1432,130.06 L1440,129.85 L1448,129.69 L1456,129.57 L1464,129.51 L1472,129.5 L1480,129.54 L1488,129.64 L1496,129.79 L1504,130.0 L1512,130.27 L1520,130.59 L1528,130.96 L1536,131.38 L1544,131.85 L1552,132.36 L1560,132.91 L1568,133.49 L1576,134.09 L1584,134.72 L1592,135.35 L1600,136.0"></path>
        <path class="fundo-finck__ticker-linha fundo-finck__ticker-linha--b" d="M0,83.6 L8,85.32 L16,87.03 L24,88.69 L32,90.29 L40,91.81 L48,93.24 L56,94.55 L64,95.74 L72,96.8 L80,97.71 L88,98.46 L96,99.07 L104,99.52 L112,99.81 L120,99.96 L128,99.97 L136,99.84 L144,99.59 L152,99.24 L160,98.79 L168,98.26 L176,97.67 L184,97.04 L192,96.37 L200,95.7 L208,95.04 L216,94.39 L224,93.78 L232,93.21 L240,92.71 L248,92.27 L256,91.9 L264,91.61 L272,91.4 L280,91.27 L288,91.21 L296,91.22 L304,91.3 L312,91.42 L320,91.59 L328,91.79 L336,92.01 L344,92.22 L352,92.42 L360,92.6 L368,92.73 L376,92.8 L384,92.8 L392,92.72 L400,92.54 L408,92.26 L416,91.87 L424,91.37 L432,90.75 L440,90.02 L448,89.17 L456,88.21 L464,87.16 L472,86.02 L480,84.79 L488,83.51 L496,82.18 L504,80.82 L512,79.45 L520,78.08 L528,76.75 L536,75.46 L544,74.23 L552,73.09 L560,72.05 L568,71.13 L576,70.34 L584,69.7 L592,69.2 L600,68.87 L608,68.7 L616,68.7 L624,68.87 L632,69.2 L640,69.69 L648,70.33 L656,71.1 L664,72.0 L672,73.01 L680,74.11 L688,75.29 L696,76.52 L704,77.79 L712,79.08 L720,80.37 L728,81.63 L736,82.86 L744,84.03 L752,85.12 L760,86.14 L768,87.05 L776,87.86 L784,88.56 L792,89.15 L800,89.61 L808,89.96 L816,90.19 L824,90.32 L832,90.34 L840,90.28 L848,90.13 L856,89.92 L864,89.66 L872,89.36 L880,89.03 L888,88.7 L896,88.37 L904,88.07 L912,87.8 L920,87.58 L928,87.42 L936,87.33 L944,87.3 L952,87.36 L960,87.5 L968,87.72 L976,88.01 L984,88.38 L992,88.82 L1000,89.31 L1008,89.85 L1016,90.42 L1024,91.01 L1032,91.6 L1040,92.18 L1048,92.73 L1056,93.23 L1064,93.67 L1072,94.03 L1080,94.3 L1088,94.46 L1096,94.5 L1104,94.41 L1112,94.18 L1120,93.81 L1128,93.29 L1136,92.62 L1144,91.81 L1152,90.86 L1160,89.77 L1168,88.56 L1176,87.24 L1184,85.82 L1192,84.32 L1200,82.76 L1208,81.15 L1216,79.52 L1224,77.89 L1232,76.27 L1240,74.69 L1248,73.17 L1256,71.72 L1264,70.37 L1272,69.12 L1280,68.01 L1288,67.02 L1296,66.19 L1304,65.51 L1312,64.98 L1320,64.62 L1328,64.42 L1336,64.37 L1344,64.47 L1352,64.72 L1360,65.09 L1368,65.59 L1376,66.19 L1384,66.88 L1392,67.65 L1400,68.47 L1408,69.33 L1416,70.21 L1424,71.09 L1432,71.96 L1440,72.81 L1448,73.62 L1456,74.37 L1464,75.06 L1472,75.67 L1480,76.22 L1488,76.68 L1496,77.06 L1504,77.35 L1512,77.58 L1520,77.73 L1528,77.82 L1536,77.86 L1544,77.85 L1552,77.82 L1560,77.77 L1568,77.72 L1576,77.69 L1584,77.69 L1592,77.73 L1600,77.82"></path>
        <path class="fundo-finck__ticker-linha fundo-finck__ticker-linha--c" d="M0,154.0 L8,155.97 L16,157.9 L24,159.74 L32,161.46 L40,163.02 L48,164.39 L56,165.56 L64,166.5 L72,167.2 L80,167.66 L88,167.89 L96,167.9 L104,167.71 L112,167.34 L120,166.83 L128,166.2 L136,165.48 L144,164.73 L152,163.96 L160,163.21 L168,162.52 L176,161.9 L184,161.38 L192,160.97 L200,160.69 L208,160.52 L216,160.47 L224,160.52 L232,160.66 L240,160.86 L248,161.1 L256,161.34 L264,161.57 L272,161.74 L280,161.82 L288,161.8 L296,161.63 L304,161.32 L312,160.83 L320,160.16 L328,159.32 L336,158.31 L344,157.13 L352,155.82 L360,154.39 L368,152.88 L376,151.32 L384,149.75 L392,148.22 L400,146.75 L408,145.39 L416,144.18 L424,143.16 L432,142.34 L440,141.75 L448,141.41 L456,141.32 L464,141.5 L472,141.92 L480,142.58 L488,143.46 L496,144.53 L504,145.75 L512,147.1 L520,148.52 L528,149.99 L536,151.46 L544,152.89 L552,154.25 L560,155.5 L568,156.62 L576,157.57 L584,158.36 L592,158.97 L600,159.4 L608,159.65 L616,159.73 L624,159.68 L632,159.5 L640,159.22 L648,158.88 L656,158.51 L664,158.13 L672,157.78 L680,157.49 L688,157.27 L696,157.16 L704,157.16 L712,157.29 L720,157.53 L728,157.9 L736,158.37 L744,158.94 L752,159.57 L760,160.24 L768,160.92 L776,161.57 L784,162.16 L792,162.65 L800,163.02 L808,163.23 L816,163.25 L824,163.07 L832,162.68 L840,162.05 L848,161.2 L856,160.13 L864,158.86 L872,157.41 L880,155.79 L888,154.06 L896,152.24 L904,150.37 L912,148.51 L920,146.68 L928,144.94 L936,143.32 L944,141.85 L952,140.57 L960,139.51 L968,138.68 L976,138.09 L984,137.75 L992,137.65 L1000,137.79 L1008,138.13 L1016,138.67 L1024,139.38 L1032,140.21 L1040,141.14 L1048,142.13 L1056,143.14 L1064,144.14 L1072,145.1 L1080,145.99 L1088,146.78 L1096,147.47 L1104,148.03 L1112,148.47 L1120,148.79 L1128,148.99 L1136,149.09 L1144,149.12 L1152,149.09 L1160,149.04 L1168,148.99 L1176,148.97 L1184,149.02 L1192,149.16 L1200,149.42 L1208,149.83 L1216,150.38 L1224,151.1 L1232,151.99 L1240,153.04 L1248,154.25 L1256,155.59 L1264,157.05 L1272,158.59 L1280,160.17 L1288,161.78 L1296,163.35 L1304,164.86 L1312,166.26 L1320,167.52 L1328,168.6 L1336,169.47 L1344,170.11 L1352,170.5 L1360,170.63 L1368,170.49 L1376,170.1 L1384,169.46 L1392,168.59 L1400,167.52 L1408,166.28 L1416,164.9 L1424,163.43 L1432,161.9 L1440,160.35 L1448,158.83 L1456,157.36 L1464,156.0 L1472,154.76 L1480,153.67 L1488,152.75 L1496,152.01 L1504,151.45 L1512,151.07 L1520,150.86 L1528,150.81 L1536,150.88 L1544,151.06 L1552,151.32 L1560,151.62 L1568,151.94 L1576,152.24 L1584,152.49 L1592,152.67 L1600,152.75"></path>
      </g>
      <use href="#finckTickerPeriodo" x="1600" y="0"></use>
    </svg>`;

  function montarFundo() {
    if (document.querySelector(".fundo-finck")) return null;
    const fundo = document.createElement("div");
    fundo.className = "fundo-finck";
    fundo.setAttribute("aria-hidden", "true");
    fundo.innerHTML = `
      <div class="fundo-finck__grade"></div>
      <div class="fundo-finck__orbe fundo-finck__orbe--roxo"></div>
      <div class="fundo-finck__orbe fundo-finck__orbe--roxo2"></div>
      <div class="fundo-finck__orbe fundo-finck__orbe--amarelo"></div>
      ${reduzido ? "" : `<div class="fundo-finck__ticker">${TICKER_SVG}</div>`}
      <div class="fundo-finck__grao"></div>
      <div class="fundo-finck__brilho" data-brilho></div>`;
    document.body.appendChild(fundo);
    return fundo;
  }

  function brilhoSeguePonteiro(el) {
    if (!el || reduzido || toque) return;
    let agendado = false;
    let x = window.innerWidth / 2;
    let y = window.innerHeight * 0.32;

    window.addEventListener("pointermove", (e) => {
      x = e.clientX; y = e.clientY;
      if (agendado) return;
      agendado = true;
      raf(() => {
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        agendado = false;
      });
    }, { passive: true });
  }

  const SELETOR_REVELAR = [
    ".hero", ".bloco", ".balance-card", ".reality-cta",
    ".cards-indicadores", ".acoes-rapidas", ".card-nivel",
    ".filtros", ".etapa", ".link-rodape",
  ].join(",");

  function revelar() {
    if (reduzido || !("IntersectionObserver" in window)) return;

    const obs = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("revelado");
        obs.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });

    const marcar = () => {
      document.querySelectorAll(SELETOR_REVELAR).forEach((el, i) => {
        if (el.dataset.revelar) return;
        el.dataset.revelar = "";
        el.style.transitionDelay = `${Math.min(i, 6) * 55}ms`;
        obs.observe(el);
      });
    };

    marcar();

    setTimeout(marcar, 350);
    setTimeout(marcar, 1200);
  }

  const SELETOR_VALOR = [
    "#saldoAtual", "#entradasMes", "#saidasMes", "#rendaLivre",
    "#valorHora", "#valorDia", "#totalDespesas",
  ].join(",");

  const lerNumero = (txt) => {
    const limpo = String(txt).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(limpo);
    return Number.isFinite(n) ? n : null;
  };

  function contar(el, destino, molde) {
    const dur = 900;
    const inicio = performance.now();
    const de = Number(el.dataset.fxValor || 0);
    const casasBR = molde.includes(",");

    const fmt = (v) => {
      const s = casasBR
        ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : String(Math.round(v));

      return molde.replace(/[\d.,]+/, s);
    };

    const passo = (agora) => {
      const p = Math.min(1, (agora - inicio) / dur);
      const e = 1 - Math.pow(1 - p, 3); 
      el.textContent = fmt(de + (destino - de) * e);
      if (p < 1) raf(passo);
      else { el.textContent = molde; el.dataset.fxValor = String(destino); }
    };
    raf(passo);
  }

  function animarValores() {
    if (reduzido) return;
    const alvos = [...document.querySelectorAll(SELETOR_VALOR)];
    if (!alvos.length) return;

    const obs = new MutationObserver((muts) => {
      muts.forEach((m) => {
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (!el || el.dataset.fxAnimando === "1") return;
        const texto = el.textContent.trim();
        const n = lerNumero(texto);
        if (n === null) return;
        const anterior = Number(el.dataset.fxValor || 0);
        if (Math.abs(n - anterior) < 0.005) return;

        el.dataset.fxAnimando = "1";
        el.classList.remove("valor-atualizado");
        void el.offsetWidth;
        el.classList.add("valor-atualizado");
        contar(el, n, texto);
        setTimeout(() => { el.dataset.fxAnimando = "0"; }, 950);
      });
    });

    alvos.forEach((el) => {
      el.dataset.fxValor = "0";
      obs.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  const CLICAVEIS = ".btn-primario,.btn-secundario,.btn-salvar,.btn-acao,.btn-perigo," +
                    ".card-opcao,.botao-decisao,.nav-item,.btn-mini";

  function ondas() {
    if (reduzido) return;
    document.addEventListener("pointerdown", (e) => {
      const alvo = e.target.closest(CLICAVEIS);
      if (!alvo || alvo.disabled) return;
      const r = alvo.getBoundingClientRect();
      const d = Math.max(r.width, r.height) * 2;
      const onda = document.createElement("span");
      onda.className = "fx-onda";
      onda.style.width = onda.style.height = `${d}px`;
      onda.style.left = `${e.clientX - r.left}px`;
      onda.style.top = `${e.clientY - r.top}px`;
      if (getComputedStyle(alvo).position === "static") alvo.style.position = "relative";
      alvo.appendChild(onda);
      setTimeout(() => onda.remove(), 640);
    }, { passive: true });
  }

  function cartaoChip() {
    const cartao = document.querySelector(".balance-card");
    if (!cartao || cartao.querySelector(".balance-card__chip")) return;
    const chip = document.createElement("div");
    chip.className = "balance-card__chip";
    chip.setAttribute("aria-hidden", "true");
    cartao.prepend(chip);
  }

  function cartaoVivo() {
    if (reduzido || toque) return;
    const cartao = document.querySelector(".balance-card");
    if (!cartao) return;

    const limite = 5;
    let dentro = false;

    cartao.addEventListener("pointermove", (e) => {
      const r = cartao.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - 0.5) * -limite;
      const ry = ((e.clientX - r.left) / r.width - 0.5) * limite;
      cartao.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-3px)`;
      dentro = true;
    }, { passive: true });

    cartao.addEventListener("pointerleave", () => {
      if (!dentro) return;
      dentro = false;
      cartao.style.transform = "";
    });
  }

  function headerVivo() {
    let ticking = false;
    const atualizar = () => {
      document.body.classList.toggle("rolando", window.scrollY > 12);
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      raf(atualizar);
    }, { passive: true });
    atualizar();
  }

  function iniciar() {
    const fundo = montarFundo();
    if (fundo) brilhoSeguePonteiro(fundo.querySelector("[data-brilho]"));
    revelar();
    animarValores();
    ondas();
    cartaoChip();
    cartaoVivo();
    headerVivo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
