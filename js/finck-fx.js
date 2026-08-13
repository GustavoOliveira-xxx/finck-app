

(() => {
  "use strict";

  const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toque    = window.matchMedia("(hover: none)").matches;
  const raf      = window.requestAnimationFrame.bind(window);

  const MIN_EM_TELA = 900;   
  const TETO        = 5000;  

  function abertura() {
    const tela = document.querySelector("[data-finck-carga]");
    if (!tela) return;

    document.body.classList.add("finck-carregando");
    const nasceu = performance.now();
    let saiu = false;

    const encerrar = () => {
      if (saiu) return;
      saiu = true;

      tela.classList.add("finck-carga--pronta");
      document.body.classList.remove("finck-carregando");

      setTimeout(() => {
        tela.classList.add("finck-carga--saiu");

        setTimeout(() => tela.remove(), 700);
      }, reduzido ? 0 : 240);
    };

    const agendarSaida = () => {
      const decorrido = performance.now() - nasceu;
      const falta = Math.max(0, (reduzido ? 0 : MIN_EM_TELA) - decorrido);
      setTimeout(encerrar, falta);
    };

    if (document.readyState === "complete") agendarSaida();
    else window.addEventListener("load", agendarSaida, { once: true });

    setTimeout(encerrar, TETO);
  }

  function cena3d() {
    const cena = document.querySelector("[data-cena3d]");
    if (!cena || reduzido || toque) return;

    const ecos = [...document.querySelectorAll("[data-cena3d-eco]")];
    const alvos = [cena, ...ecos];
    const caixaLogo = cena.querySelector(".cena3d__logo-caixa");

    let agendado = false;
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
      agendado = false;
    };

    window.addEventListener("pointermove", (e) => {
      mx = (e.clientX / window.innerWidth  - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;

      if (caixaLogo) {
        const r = caixaLogo.getBoundingClientRect();
        if (r.width && r.height) {
          gx = ((e.clientX - r.left) / r.width)  * 100;
          gy = ((e.clientY - r.top)  / r.height) * 100;
        }
      }

      if (agendado) return;
      agendado = true;
      raf(aplicar);
    }, { passive: true });

    document.addEventListener("pointerleave", () => {
      mx = 0; my = 0;
      if (agendado) return;
      agendado = true;
      raf(aplicar);
    });
  }

  function prisma() {
    const cena = document.querySelector("[data-prisma]");
    if (!cena || reduzido) return;

    const corpo = cena.querySelector(".prisma");
    if (!corpo) return;

    let agendado = false;
    let px = 0, py = 0;

    const aplicar = () => {
      corpo.style.setProperty("--px", px.toFixed(3));
      corpo.style.setProperty("--py", py.toFixed(3));
      agendado = false;
    };

    const agendar = () => {
      if (agendado) return;
      agendado = true;
      raf(aplicar);
    };

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

    let agendado = false;
    let gx = 0, gy = 0, lx = 50, ly = 50;

    const aplicar = () => {
      corpo.style.setProperty("--gx", gx.toFixed(3));
      corpo.style.setProperty("--gy", gy.toFixed(3));
      brilhos.forEach((b) => {
        b.style.setProperty("--lx", lx.toFixed(1));
        b.style.setProperty("--ly", ly.toFixed(1));
      });
      agendado = false;
    };
    const agendar = () => {
      if (agendado) return;
      agendado = true;
      raf(aplicar);
    };

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
    meta3d();
    marcaReality();
  }

  /* ------------------------------------------------------------------ *
   * Cena 3D de Metas
   *
   * A peça central é uma arte renderizada (assets/meta-3d.png). O que a faz
   * parecer 3D de verdade não é a imagem: é o palco em volta dela.
   *
   *   - o palco inteiro inclina conforme o ponteiro, com perspectiva
   *   - a arte flutua e fica à frente do anel, então há paralaxe entre elas
   *   - o anel de progresso mostra a meta mais perto de fechar
   *   - as fagulhas orbitam num plano deitado, passando por trás e por diante
   *   - a sombra acompanha a flutuação, que é o que assenta a peça no chão
   *
   * O anel não é enfeite: é o mesmo dado que o dardo mostrava antes — só que
   * legível como número, e não por dedução da posição.
   * ------------------------------------------------------------------ */

  const RAIO_ANEL = 46;
  const VOLTA_ANEL = 2 * Math.PI * RAIO_ANEL;

  function montarMeta3d(cena) {
    if (cena.dataset.montado) return;
    cena.dataset.montado = "1";

    cena.innerHTML = `
      <div class="meta3d">
        <div class="meta3d__palco">
          <span class="meta3d__brilho"></span>

          <svg class="meta3d__anel" viewBox="0 0 100 100" aria-hidden="true">
            <circle class="meta3d__anel-base" cx="50" cy="50" r="${RAIO_ANEL}"></circle>
            <circle class="meta3d__anel-arco" cx="50" cy="50" r="${RAIO_ANEL}"
                    stroke-dasharray="${VOLTA_ANEL.toFixed(2)}"
                    stroke-dashoffset="${VOLTA_ANEL.toFixed(2)}"></circle>
          </svg>

          <span class="meta3d__orbita">
            <i class="meta3d__fagulha"></i>
            <i class="meta3d__fagulha meta3d__fagulha--2"></i>
            <i class="meta3d__fagulha meta3d__fagulha--3"></i>
          </span>

          <img class="meta3d__arte" src="assets/meta-3d.png" alt="" decoding="async"
               onerror="this.closest('.meta3d').classList.add('meta3d--sem-arte')">

          <span class="meta3d__sombra"></span>
        </div>

        <div class="meta3d__rotulo">
          <strong class="meta3d__pct" data-alvo-pct>—</strong>
          <span class="meta3d__nome" data-alvo-nome>sem metas ainda</span>
        </div>
      </div>`;
  }

  function meta3d() {
    const cena = document.querySelector("[data-alvo]");
    if (!cena) return;

    montarMeta3d(cena);
    if (reduzido || toque) return;

    const palco = cena.querySelector(".meta3d__palco");
    if (!palco) return;

    let agendado = false;
    let px = 0, py = 0;

    const aplicar = () => {
      palco.style.setProperty("--px", px.toFixed(3));
      palco.style.setProperty("--py", py.toFixed(3));
      agendado = false;
    };
    const agendar = () => {
      if (agendado) return;
      agendado = true;
      raf(aplicar);
    };

    cena.addEventListener("pointermove", (e) => {
      const r = cena.getBoundingClientRect();
      if (!r.width || !r.height) return;
      px = (e.clientX - r.left) / r.width - 0.5;
      py = ((e.clientY - r.top) / r.height - 0.5) * -1;
      agendar();
    }, { passive: true });

    cena.addEventListener("pointerleave", () => { px = 0; py = 0; agendar(); });
  }

  /**
   * Recebe o progresso da meta mais perto de fechar.
   * Mantém o nome antigo porque é assim que js/metas.js chama.
   */
  function mirarAlvo(progresso, nome) {
    const cena = document.querySelector("[data-alvo]");
    if (!cena) return;
    montarMeta3d(cena);

    const p = Math.max(0, Math.min(100, Number(progresso) || 0));
    const arco = cena.querySelector(".meta3d__anel-arco");
    const pct = cena.querySelector("[data-alvo-pct]");
    const rotulo = cena.querySelector("[data-alvo-nome]");
    const meta = cena.querySelector(".meta3d");

    if (arco) {
      arco.style.strokeDashoffset = (VOLTA_ANEL * (1 - p / 100)).toFixed(2);
    }
    // quanto mais perto de fechar, mais acesa a cena
    if (meta) meta.style.setProperty("--calor", (p / 100).toFixed(3));

    if (pct) pct.textContent = nome ? `${Math.round(p)}%` : "—";
    if (rotulo) rotulo.textContent = nome || "sem metas ainda";
  }


  const CAMADAS_EXTRUSAO = 16;

  function montarMarca(cena) {
    if (cena.dataset.montada) return;
    cena.dataset.montada = "1";

    const logo = cena.dataset.logo || "assets/logo-reality-transparente.png";
    const nome = cena.dataset.nome || "FinCK of Reality";
    cena.style.setProperty("--marca-logo", `url("${logo}")`);

    const extrusao = Array.from({ length: CAMADAS_EXTRUSAO }, (_, i) => {
      const z = (i + 1) * 1.6;
      const forca = 1 - i / (CAMADAS_EXTRUSAO * 1.35);
      return `<span class="marca3d__borda marca3d__extrusao" style="--z:${z};--forca:${forca.toFixed(3)}"></span>`;
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
          <span class="marca3d__borda marca3d__lustro"></span>
        </div>
        ${faiscas}
        <span class="marca3d__chao"></span>
      </div>`;
  }

  function marcaReality() {
    const cenas = [...document.querySelectorAll("[data-marca3d]")];
    if (!cenas.length) return;

    cenas.forEach(montarMarca);
    if (reduzido || toque) return;

    cenas.forEach((cena) => {
      const corpo = cena.querySelector(".marca3d");
      const reativos = cena.querySelectorAll(".marca3d__lustro, .marca3d__contorno");
      if (!corpo) return;

      const area = cena.closest(".reality-cta") || cena.closest(".hero--reality") || cena;
      let agendado = false;
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
        agendado = false;
      };
      const agendar = () => {
        if (agendado) return;
        agendado = true;
        raf(aplicar);
      };

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
