

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
    alvo();
    marcaReality();
  }

  function alvo() {
    const cena = document.querySelector("[data-alvo]");
    if (!cena || reduzido || toque) return;

    const corpo = cena.querySelector(".alvo");
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

    cena.addEventListener("pointermove", (e) => {
      const r = cena.getBoundingClientRect();
      if (!r.width || !r.height) return;
      px = (e.clientX - r.left) / r.width - 0.5;
      py = ((e.clientY - r.top) / r.height - 0.5) * -1;
      agendar();
    }, { passive: true });

    cena.addEventListener("pointerleave", () => { px = 0; py = 0; agendar(); });
  }

  function marcaReality() {
    const marca = document.querySelector("[data-marca3d]");
    if (!marca || reduzido || toque) return;

    const palco = marca.querySelector(".marca3d__palco");
    const lustro = marca.querySelector(".marca3d__lustro");
    if (!palco) return;

    const area = marca.closest(".reality-cta") || marca;
    let agendado = false;
    let mx = 0, my = 0;

    const aplicar = () => {
      const sx = mx.toFixed(3);
      const sy = my.toFixed(3);
      palco.style.setProperty("--mx", sx);
      palco.style.setProperty("--my", sy);
      if (lustro) {
        lustro.style.setProperty("--mx", sx);
        lustro.style.setProperty("--my", sy);
      }
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
  }

  window.FinckFX = { ligarMedalha: medalha };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
