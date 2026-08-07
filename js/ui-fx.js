/* ============================================================
   FinCK v2 — ui-fx.js
   Camada de vida da interface. Não altera regra de negócio:
   só desenha o fundo dinâmico e reage ao que o usuário faz.

   Monta:
     • fundo em camadas (grade, orbes, holofote, grão, fio)
     • canvas com linhas de mercado em movimento lento
     • holofote que segue o ponteiro (com inércia)
     • revelação dos blocos em scroll
     • contagem animada dos valores em dinheiro
     • pulso quando um número muda
     • ondinha nos cliques de botão
     • paralaxe leve no cartão de saldo
     • header compacto ao rolar

   Respeita prefers-reduced-motion e pausa quando a aba some.
   ============================================================ */

(() => {
  "use strict";

  const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toque = window.matchMedia("(hover: none)").matches;
  const raf = window.requestAnimationFrame.bind(window);

  /* ---------------------------------------------------------
     1. Camadas do fundo
     --------------------------------------------------------- */
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
      <canvas class="fundo-finck__canvas"></canvas>
      <div class="fundo-finck__holofote"></div>
      <div class="fundo-finck__grao"></div>
      <div class="fundo-finck__fio"></div>`;
    document.body.appendChild(fundo);
    return fundo;
  }

  /* ---------------------------------------------------------
     2. Linhas de mercado no canvas
     Três séries de ruído suave, desenhadas como uma cotação
     que anda devagar. Nada de partículas genéricas.
     --------------------------------------------------------- */
  function linhasDeMercado(canvas) {
    if (!canvas || reduzido) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const SERIES = [
      { cor: "147,51,196", amp: 0.10, base: 0.42, vel: 0.00022, passo: 0.0055, largura: 1.6, alpha: 0.5, preenche: true },
      { cor: "180,92,240", amp: 0.07, base: 0.58, vel: 0.00031, passo: 0.0080, largura: 1.2, alpha: 0.34, preenche: false },
      { cor: "254,200,0",  amp: 0.05, base: 0.72, vel: 0.00017, passo: 0.0110, largura: 1.1, alpha: 0.22, preenche: false },
    ];

    let L = 0, A = 0, dpr = 1, rodando = true;

    const medir = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      L = canvas.clientWidth || window.innerWidth;
      A = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.floor(L * dpr);
      canvas.height = Math.floor(A * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // ruído de valor: soma de senos com períodos incomensuráveis,
    // dá um traçado orgânico sem parecer uma onda perfeita
    const valor = (x, t, s) =>
      Math.sin(x * s.passo + t * 1.0) * 0.55 +
      Math.sin(x * s.passo * 2.31 + t * 1.7) * 0.27 +
      Math.sin(x * s.passo * 0.47 - t * 0.6) * 0.18;

    function desenhar(agora) {
      if (!rodando) return;
      ctx.clearRect(0, 0, L, A);

      SERIES.forEach((s) => {
        const t = agora * s.vel;
        const y0 = A * s.base;
        ctx.beginPath();
        for (let x = 0; x <= L; x += 6) {
          const y = y0 + valor(x, t, s) * A * s.amp;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }

        if (s.preenche) {
          ctx.save();
          ctx.lineTo(L, A);
          ctx.lineTo(0, A);
          ctx.closePath();
          const g = ctx.createLinearGradient(0, y0 - A * s.amp, 0, A);
          g.addColorStop(0, `rgba(${s.cor},0.10)`);
          g.addColorStop(1, `rgba(${s.cor},0)`);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.restore();
          // redesenha só a linha por cima do preenchimento
          ctx.beginPath();
          for (let x = 0; x <= L; x += 6) {
            const y = y0 + valor(x, t, s) * A * s.amp;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
        }

        ctx.strokeStyle = `rgba(${s.cor},${s.alpha})`;
        ctx.lineWidth = s.largura;
        ctx.lineJoin = "round";
        ctx.shadowColor = `rgba(${s.cor},0.6)`;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      raf(desenhar);
    }

    medir();
    raf(desenhar);

    let debounce;
    window.addEventListener("resize", () => {
      clearTimeout(debounce);
      debounce = setTimeout(medir, 160);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { rodando = false; }
      else if (!rodando) { rodando = true; raf(desenhar); }
    });
  }

  /* ---------------------------------------------------------
     3. Holofote com inércia
     --------------------------------------------------------- */
  function holofote(el) {
    if (!el || reduzido || toque) return;
    let alvoX = 50, alvoY = 32, x = 50, y = 32, ativo = false;

    window.addEventListener("pointermove", (e) => {
      alvoX = (e.clientX / window.innerWidth) * 100;
      alvoY = (e.clientY / window.innerHeight) * 100;
      if (!ativo) { ativo = true; raf(seguir); }
    }, { passive: true });

    function seguir() {
      x += (alvoX - x) * 0.055;
      y += (alvoY - y) * 0.055;
      el.style.setProperty("--px", `${x.toFixed(2)}%`);
      el.style.setProperty("--py", `${y.toFixed(2)}%`);
      if (Math.abs(alvoX - x) > 0.05 || Math.abs(alvoY - y) > 0.05) raf(seguir);
      else ativo = false;
    }
  }

  /* ---------------------------------------------------------
     4. Revelação em scroll
     --------------------------------------------------------- */
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
    // conteúdo montado pelo JS das páginas entra depois
    setTimeout(marcar, 350);
    setTimeout(marcar, 1200);
  }

  /* ---------------------------------------------------------
     5. Valores: contagem na primeira pintura e pulso na troca
     --------------------------------------------------------- */
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
      // devolve o número formatado no mesmo molde do texto original
      return molde.replace(/[\d.,]+/, s);
    };

    const passo = (agora) => {
      const p = Math.min(1, (agora - inicio) / dur);
      const e = 1 - Math.pow(1 - p, 3); // ease-out cúbico
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

  /* ---------------------------------------------------------
     6. Ondinha de clique
     --------------------------------------------------------- */
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

  /* ---------------------------------------------------------
     7. Paralaxe do cartão de saldo
     --------------------------------------------------------- */
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

  /* ---------------------------------------------------------
     8. Header compacto ao rolar
     --------------------------------------------------------- */
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

  /* ---------------------------------------------------------
     Bootstrap
     --------------------------------------------------------- */
  function iniciar() {
    const fundo = montarFundo();
    if (fundo) {
      linhasDeMercado(fundo.querySelector(".fundo-finck__canvas"));
      holofote(fundo.querySelector(".fundo-finck__holofote"));
    }
    revelar();
    animarValores();
    ondas();
    cartaoVivo();
    headerVivo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
