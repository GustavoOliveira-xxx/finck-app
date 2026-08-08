/* ============================================================
   FinCK — finck-fx.js
   Controla a tela de abertura e a cena 3D da página de entrada.

   Segue a mesma disciplina do ui-fx.js: o JavaScript não anima
   nada quadro a quadro. Aqui ele só faz duas coisas:

     • decide QUANDO a tela de abertura sai (uma classe no DOM);
     • escreve a posição do ponteiro em duas variáveis CSS,
       no máximo uma vez por quadro.

   A suavização do movimento é feita pela `transition` do CSS,
   ou seja, roda no compositor — não no main thread. Quando o
   ponteiro para, não sobra nenhum loop rodando.
   ============================================================ */

(() => {
  "use strict";

  const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toque    = window.matchMedia("(hover: none)").matches;
  const raf      = window.requestAnimationFrame.bind(window);

  /* ---------------------------------------------------------
     1. Tela de abertura

     Regras de bom senso para não irritar quem já conhece o app:
       - tempo mínimo em tela, para a animação não "piscar" em
         cache quente;
       - tempo máximo absoluto, para um recurso lento (ou um
         erro de rede) nunca prender o usuário na abertura.
     --------------------------------------------------------- */
  const MIN_EM_TELA = 900;   // ms — evita o flash de 80ms
  const TETO        = 5000;  // ms — trava de segurança

  function abertura() {
    const tela = document.querySelector("[data-finck-carga]");
    if (!tela) return;

    document.body.classList.add("finck-carregando");
    const nasceu = performance.now();
    let saiu = false;

    const encerrar = () => {
      if (saiu) return;
      saiu = true;

      // completa a barra antes de dissolver a tela
      tela.classList.add("finck-carga--pronta");
      document.body.classList.remove("finck-carregando");

      setTimeout(() => {
        tela.classList.add("finck-carga--saiu");
        // só então tira do DOM, para a transição terminar inteira
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

  /* ---------------------------------------------------------
     2. Cena 3D

     O ponteiro vira duas coordenadas normalizadas (-1 a 1) que
     descrevem o quanto ele se afastou do centro da janela. O CSS
     converte isso em graus de rotação e em profundidade das
     camadas. Um único listener alimenta a cena inteira.
     --------------------------------------------------------- */
  function cena3d() {
    const cena = document.querySelector("[data-cena3d]");
    if (!cena || reduzido || toque) return;

    // elementos que reagem ao mesmo movimento, em intensidades diferentes
    const ecos = [...document.querySelectorAll("[data-cena3d-eco]")];
    const alvos = [cena, ...ecos];
    const caixaLogo = cena.querySelector(".cena3d__logo-caixa");

    let agendado = false;
    let mx = 0, my = 0;      // -1 .. 1 em relação à janela
    let gx = 50, gy = 50;    // 0 .. 100 em relação ao logo

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

    // ponteiro saiu da janela: a cena volta ao repouso sozinha
    document.addEventListener("pointerleave", () => {
      mx = 0; my = 0;
      if (agendado) return;
      agendado = true;
      raf(aplicar);
    });
  }

  /* ---------------------------------------------------------
     3. Prisma da home

     Aqui o ponteiro não "inclina" o objeto, ele o gira: a posição
     horizontal dentro da cena vira meia volta para cada lado, o
     que dá acesso às quatro faces só varrendo o mouse. A vertical
     inclina de leve, para revelar a tampa.

     Enquanto ninguém interage, quem gira é uma animação CSS — o
     JS nem toca no elemento.
     --------------------------------------------------------- */
  function prisma() {
    const cena = document.querySelector("[data-prisma]");
    if (!cena || reduzido || toque) return;

    const corpo = cena.querySelector(".prisma");
    if (!corpo) return;

    let agendado = false;
    let px = 0, py = 0;

    const aplicar = () => {
      corpo.style.setProperty("--px", px.toFixed(3));
      corpo.style.setProperty("--py", py.toFixed(3));
      agendado = false;
    };

    cena.addEventListener("pointermove", (e) => {
      const r = cena.getBoundingClientRect();
      if (!r.width || !r.height) return;
      px = (e.clientX - r.left) / r.width  - 0.5;   // -0.5 .. 0.5 => meia volta
      py = ((e.clientY - r.top) / r.height - 0.5) * -1;
      if (agendado) return;
      agendado = true;
      raf(aplicar);
    }, { passive: true });

    // ao sair, o prisma volta ao repouso e a animação assume de novo
    cena.addEventListener("pointerleave", () => {
      px = 0; py = 0;
      if (agendado) return;
      agendado = true;
      raf(aplicar);
    });
  }

  /* ---------------------------------------------------------
     Bootstrap
     --------------------------------------------------------- */
  function iniciar() {
    abertura();
    cena3d();
    prisma();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
