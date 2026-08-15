(() => {
  "use strict";

  const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toque    = window.matchMedia("(hover: none)").matches;
  const raf      = window.requestAnimationFrame.bind(window);

  function criarAgendador(aplicar) {
    let pendente = 0;
    return () => {
      if (pendente) cancelAnimationFrame(pendente);
      pendente = raf(() => { pendente = 0; aplicar(); });
    };
  }

  function ligarPonteiro(alvo, aoMover, aoSair) {
    const mover = (e) => {
      const p = e.touches && e.touches[0] ? e.touches[0] : e;
      if (p && typeof p.clientX === "number") aoMover(p.clientX, p.clientY);
    };
    alvo.addEventListener("pointermove", mover, { passive: true });
    alvo.addEventListener("touchmove", mover, { passive: true });
    if (aoSair) {
      ["pointerleave", "pointercancel", "touchend", "touchcancel"].forEach((ev) =>
        alvo.addEventListener(ev, aoSair, { passive: true }));
    }
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && aoSair) aoSair();
    });
  }

  const MIN_EM_TELA = 1500;
  const TETO        = 5000;

  const COFRE_HTML = `
    <div class="cofre">
      <div class="cofre__folha cofre__folha--topo">
        <span class="cofre__grade"></span>
        <span class="cofre__borda"></span>
      </div>
      <div class="cofre__folha cofre__folha--base">
        <span class="cofre__grade"></span>
        <span class="cofre__borda"></span>
      </div>

      <div class="cofre__nucleo">
        <div class="cofre__selo">
          <svg class="cofre__anel" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="cofre__anel-base" cx="60" cy="60" r="52"></circle>
            <circle class="cofre__anel-arco" cx="60" cy="60" r="52"
                    stroke-dasharray="326.7" stroke-dashoffset="326.7"></circle>
          </svg>
          <img class="cofre__logo" src="assets/logo-ck-256.png" alt="" decoding="async">
        </div>
        <p class="cofre__marca">FinCK</p>
        <p class="cofre__pct" data-cofre-pct>0%</p>
      </div>

      <span class="cofre__fresta"></span>
    </div>`;

  function abertura() {
    const tela = document.querySelector("[data-finck-carga]");
    if (!tela) return;

    // o cofre já vem no HTML da página; só monta se faltar
    if (!tela.querySelector(".cofre")) tela.innerHTML = COFRE_HTML;
    tela.classList.add("finck-carga--cofre");
    document.body.classList.add("finck-carregando");

    const arco = tela.querySelector(".cofre__anel-arco");
    const rotulo = tela.querySelector("[data-cofre-pct]");
    const VOLTA = 326.7;

    const nasceu = performance.now();
    let saiu = false;
    let progresso = 0;
    let laco = 0;

    const pintar = (p) => {
      if (arco) arco.style.strokeDashoffset = (VOLTA * (1 - p)).toFixed(1);
      if (rotulo) rotulo.textContent = `${Math.round(p * 100)}%`;
      tela.style.setProperty("--carga", p.toFixed(3));
    };

    const correr = () => {
      const decorrido = performance.now() - nasceu;
      const alvo = document.readyState === "complete" ? 1 : 0.86;
      progresso += (alvo - progresso) * 0.06;
      if (decorrido > MIN_EM_TELA && alvo === 1) progresso += 0.02;
      pintar(Math.min(1, progresso));
      if (progresso < 0.999) laco = raf(correr);
    };

    const encerrar = () => {
      if (saiu) return;
      saiu = true;
      cancelAnimationFrame(laco);
      pintar(1);

      tela.classList.add("cofre--destravado");
      document.body.classList.remove("finck-carregando");

      setTimeout(() => {
        tela.classList.add("cofre--aberto");
        setTimeout(() => tela.remove(), reduzido ? 0 : 900);
      }, reduzido ? 0 : 320);
    };

    const agendarSaida = () => {
      const decorrido = performance.now() - nasceu;
      setTimeout(encerrar, Math.max(0, (reduzido ? 0 : MIN_EM_TELA) - decorrido));
    };

    if (reduzido) pintar(1);
    else laco = raf(correr);

    if (document.readyState === "complete") agendarSaida();
    else window.addEventListener("load", agendarSaida, { once: true });

    setTimeout(encerrar, TETO);
  }

  function cena3d() {
    const cena = document.querySelector("[data-cena3d]");
    if (!cena || reduzido) return;

    const ecos = [...document.querySelectorAll("[data-cena3d-eco]")];
    const alvos = [cena, ...ecos];
    const caixaLogo = cena.querySelector(".cena3d__logo-caixa");
    let mx = 0, my = 0;
    let gx = 50, gy = 50;

    const aplicar = () => {
      const sx = mx.toFixed(3);
      const sy = my.toFixed(3);
      alvos.forEach((el) => {
        el.style.setProperty("--mx", sx);
        el.style.setProperty("--my", sy);
      });
      if (caixaLogo) {
        caixaLogo.style.setProperty("--gx", gx.toFixed(1));
        caixaLogo.style.setProperty("--gy", gy.toFixed(1));
      }
    };

    const agendar = criarAgendador(aplicar);

    ligarPonteiro(window, (cx, cy) => {
      mx = (cx / window.innerWidth  - 0.5) * 2;
      my = (cy / window.innerHeight - 0.5) * 2;

      if (caixaLogo) {
        const r = caixaLogo.getBoundingClientRect();
        if (r.width && r.height) {
          gx = ((cx - r.left) / r.width)  * 100;
          gy = ((cy - r.top)  / r.height) * 100;
        }
      }

      agendar();
    }, () => { mx = 0; my = 0; agendar(); });
  }

  function prisma() {
    const cena = document.querySelector("[data-prisma]");
    if (!cena || reduzido) return;

    const corpo = cena.querySelector(".prisma");
    if (!corpo) return;
    let px = 0, py = 0;

    const aplicar = () => {
      corpo.style.setProperty("--px", px.toFixed(3));
      corpo.style.setProperty("--py", py.toFixed(3));
    };

    const agendar = criarAgendador(aplicar);

    if (!toque) {
      cena.addEventListener("pointermove", (e) => {
        const r = cena.getBoundingClientRect();
        if (!r.width || !r.height) return;
        px = (e.clientX - r.left) / r.width  - 0.5;
        py = ((e.clientY - r.top) / r.height - 0.5) * -1;
        agendar();
      }, { passive: true });

      cena.addEventListener("pointerleave", () => {
        px = 0; py = 0;
        agendar();
      });
      return;
    }

    let arrastando = false;
    let xInicial = 0;
    let pxInicial = 0;

    cena.addEventListener("pointerdown", (e) => {
      arrastando = true;
      xInicial = e.clientX;
      pxInicial = px;
      cena.classList.add("prisma-cena--conduzindo");
    }, { passive: true });

    cena.addEventListener("pointermove", (e) => {
      if (!arrastando) return;
      const r = cena.getBoundingClientRect();
      if (!r.width) return;

      px = pxInicial + (e.clientX - xInicial) / r.width;
      agendar();
    }, { passive: true });

    const soltar = () => {
      arrastando = false;
      cena.classList.remove("prisma-cena--conduzindo");
    };
    cena.addEventListener("pointerup", soltar, { passive: true });
    cena.addEventListener("pointercancel", soltar, { passive: true });
  }

  function medalha() {
    const cena = document.querySelector("[data-medalha]");
    if (!cena || reduzido) return;

    const corpo = cena.querySelector(".medalha");
    const brilhos = [...cena.querySelectorAll(".medalha__brilho")];
    if (!corpo) return;
    let gx = 0, gy = 0, lx = 50, ly = 50;

    const aplicar = () => {
      corpo.style.setProperty("--gx", gx.toFixed(3));
      corpo.style.setProperty("--gy", gy.toFixed(3));
      brilhos.forEach((b) => {
        b.style.setProperty("--lx", lx.toFixed(1));
        b.style.setProperty("--ly", ly.toFixed(1));
      });
    };
    const agendar = criarAgendador(aplicar);

    const luzDoPonteiro = (e) => {
      const r = corpo.getBoundingClientRect();
      if (!r.width || !r.height) return;

      lx = 100 - ((e.clientX - r.left) / r.width) * 100;
      ly = 100 - ((e.clientY - r.top) / r.height) * 100;
    };

    if (!toque) {
      cena.addEventListener("pointermove", (e) => {
        const r = cena.getBoundingClientRect();
        if (!r.width || !r.height) return;
        gx = (e.clientX - r.left) / r.width - 0.5;
        gy = ((e.clientY - r.top) / r.height - 0.5) * -1;
        luzDoPonteiro(e);
        agendar();
      }, { passive: true });

      cena.addEventListener("pointerleave", () => {
        gx = 0; gy = 0; lx = 50; ly = 50;
        agendar();
      });
      return;
    }

    let arrastando = false, xInicial = 0, gxInicial = 0;
    cena.addEventListener("pointerdown", (e) => {
      arrastando = true;
      xInicial = e.clientX;
      gxInicial = gx;
      cena.classList.add("medalha-cena--conduzindo");
    }, { passive: true });

    cena.addEventListener("pointermove", (e) => {
      if (!arrastando) return;
      const r = cena.getBoundingClientRect();
      if (!r.width) return;
      gx = gxInicial + (e.clientX - xInicial) / r.width;
      luzDoPonteiro(e);
      agendar();
    }, { passive: true });

    const soltar = () => {
      arrastando = false;
      cena.classList.remove("medalha-cena--conduzindo");
    };
    cena.addEventListener("pointerup", soltar, { passive: true });
    cena.addEventListener("pointercancel", soltar, { passive: true });
  }

  function iniciar() {
    abertura();
    cena3d();
    prisma();
    medalha();
    cristalMeta();
    marcaReality();
  }

  const RAIO_ARCO = 54;
  const VOLTA_ARCO = 2 * Math.PI * RAIO_ARCO;
  const FACES_CRISTAL = 6;

  function montarCristal(cena) {
    if (cena.dataset.montado) return;
    cena.dataset.montado = "1";

    const faces = (classe) => Array.from({ length: FACES_CRISTAL }, (_, i) =>
      `<span class="${classe}" style="--i:${i}"></span>`).join("");

    const repetir = (classe, quantas) => Array.from({ length: quantas }, (_, i) =>
      `<i class="${classe}" style="--i:${i}"></i>`).join("");

    cena.innerHTML = `
      <div class="cristal cristal--vazio">
        <div class="cristal__palco">
          <span class="cristal__halo"></span>
          <span class="cristal__aro cristal__aro--3"></span>
          <span class="cristal__aro cristal__aro--2"></span>

          <svg class="cristal__arco" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="cristal__arco-base" cx="60" cy="60" r="${RAIO_ARCO}"></circle>
            <circle class="cristal__arco-luz" cx="60" cy="60" r="${RAIO_ARCO}"
                    stroke-dasharray="${VOLTA_ARCO.toFixed(2)}"
                    stroke-dashoffset="${VOLTA_ARCO.toFixed(2)}"></circle>
          </svg>

          <span class="cristal__orbita">${repetir("cristal__fagulha", 4)}</span>

          <div class="cristal__flutua">
            <div class="cristal__prisma">
              ${faces("cristal__parede")}
              <span class="cristal__fundo"></span>
              <div class="cristal__nucleo">
                ${faces("cristal__onda")}
                ${repetir("cristal__bolha", 3)}
                <span class="cristal__superficie"></span>
              </div>
              <span class="cristal__tampa"></span>
            </div>
          </div>

          <span class="cristal__base"></span>
          <span class="cristal__sombra"></span>
        </div>

        <div class="cristal__rotulo">
          <strong class="cristal__pct" data-alvo-pct>—</strong>
          <span class="cristal__nome" data-alvo-nome>sem metas ainda</span>
          <span class="cristal__falta" data-alvo-falta></span>
        </div>
      </div>`;
  }

  function cristalMeta() {
    const cena = document.querySelector("[data-alvo]");
    if (!cena) return;

    montarCristal(cena);
    if (reduzido) return;

    const palco = cena.querySelector(".cristal__palco");
    if (!palco) return;
    let px = 0, py = 0;

    const aplicar = () => {
      palco.style.setProperty("--px", px.toFixed(3));
      palco.style.setProperty("--py", py.toFixed(3));
    };
    const agendar = criarAgendador(aplicar);

    ligarPonteiro(cena, (cx, cy) => {
      const r = cena.getBoundingClientRect();
      if (!r.width || !r.height) return;
      px = (cx - r.left) / r.width - 0.5;
      py = ((cy - r.top) / r.height - 0.5) * -1;
      agendar();
    }, () => { px = 0; py = 0; agendar(); });
  }

  function mirarAlvo(progresso, nome, nota) {
    const cena = document.querySelector("[data-alvo]");
    if (!cena) return;
    montarCristal(cena);

    const p = Math.max(0, Math.min(100, Number(progresso) || 0));
    const fracao = (p / 100).toFixed(4);
    const corpo = cena.querySelector(".cristal");
    const arco = cena.querySelector(".cristal__arco-luz");
    const pct = cena.querySelector("[data-alvo-pct]");
    const rotulo = cena.querySelector("[data-alvo-nome]");
    const falta = cena.querySelector("[data-alvo-falta]");

    if (corpo) {
      corpo.style.setProperty("--meta-p", fracao);
      corpo.style.setProperty("--meta-calor", fracao);
      corpo.classList.toggle("cristal--vazio", !nome);
      corpo.classList.toggle("cristal--cheio", Boolean(nome) && p >= 100);
    }

    if (arco) arco.style.strokeDashoffset = (VOLTA_ARCO * (1 - p / 100)).toFixed(2);
    if (pct) pct.textContent = nome ? `${Math.round(p)}%` : "—";
    if (rotulo) rotulo.textContent = nome || "sem metas ainda";
    if (falta) falta.textContent = nome ? (nota || "") : "";
  }

  const CAMADAS_EXTRUSAO = 26;

  function montarMarca(cena) {
    if (cena.dataset.montada) return;
    cena.dataset.montada = "1";

    const logo = cena.dataset.logo || "assets/logo-reality-transparente.png";
    const nome = cena.dataset.nome || "FinCK of Reality";
    const logoAbs = new URL(logo, document.baseURI).href;
    cena.style.setProperty("--marca-logo", `url("${logoAbs}")`);

    const extrusao = Array.from({ length: CAMADAS_EXTRUSAO }, (_, i) => {
      const t = i / (CAMADAS_EXTRUSAO - 1);
      const z = (i + 1) * 1.5;
      const forca = (1 - t) ** 1.25;
      const matiz = t < 0.45 ? "var(--marca-metal-claro)"
        : t < 0.8 ? "var(--marca-metal)" : "var(--marca-metal-fundo)";
      return `<span class="marca3d__borda marca3d__extrusao"
        style="--z:${z};--forca:${forca.toFixed(3)};--matiz:${matiz}"></span>`;
    }).join("");

    const faiscas = Array.from({ length: 6 }, (_, i) =>
      `<span class="marca3d__faisca marca3d__faisca--${i + 1}"></span>`).join("");

    cena.innerHTML = `
      <div class="marca3d">
        <span class="marca3d__halo"></span>
        <span class="marca3d__anel marca3d__anel--3"></span>
        <span class="marca3d__anel marca3d__anel--1"></span>
        <span class="marca3d__anel marca3d__anel--2"></span>
        <div class="marca3d__flutua">
          ${extrusao}
          <img class="marca3d__logo" src="${logo}" alt="${nome}" decoding="async">
          <span class="marca3d__borda marca3d__contorno"></span>
          <span class="marca3d__borda marca3d__bisel"></span>
          <span class="marca3d__borda marca3d__lustro"></span>
          <span class="marca3d__varredura"></span>
        </div>
        ${faiscas}
        <span class="marca3d__chao"></span>
      </div>`;
  }

  function marcaReality() {
    const cenas = [...document.querySelectorAll("[data-marca3d]")];
    if (!cenas.length) return;

    cenas.forEach(montarMarca);
    if (reduzido) return;

    cenas.forEach((cena) => {
      const corpo = cena.querySelector(".marca3d");
      const reativos = cena.querySelectorAll(".marca3d__lustro, .marca3d__contorno");
      if (!corpo) return;

      const area = cena.closest(".reality-cta") || cena.closest(".hero--reality") || cena;
      let mx = 0, my = 0;

      const aplicar = () => {
        const sx = mx.toFixed(3);
        const sy = my.toFixed(3);
        corpo.style.setProperty("--mx", sx);
        corpo.style.setProperty("--my", sy);
        reativos.forEach((el) => {
          el.style.setProperty("--mx", sx);
          el.style.setProperty("--my", sy);
        });
        };
      const agendar = criarAgendador(aplicar);

      area.addEventListener("pointermove", (e) => {
        const r = area.getBoundingClientRect();
        if (!r.width || !r.height) return;
        mx = (e.clientX - r.left) / r.width - 0.5;
        my = ((e.clientY - r.top) / r.height - 0.5) * -1;
        agendar();
      }, { passive: true });

      area.addEventListener("pointerleave", () => { mx = 0; my = 0; agendar(); });
    });
  }

  window.FinckFX = { ligarMedalha: medalha, mirarAlvo };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
