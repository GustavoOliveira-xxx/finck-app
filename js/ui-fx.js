

(() => {
  "use strict";

  const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toque = window.matchMedia("(hover: none)").matches;
  const raf = window.requestAnimationFrame.bind(window);

  /* ------------------------------------------------------------------ *
   * Fundo "Cofre"
   *
   * Uma grade em perspectiva que corre em direção ao observador, com dois
   * elementos indo embora pelo horizonte: pulsos de luz percorrendo as
   * linhas e moedas girando sobre o piso.
   *
   * Tudo num único canvas. A versão anterior usava seis camadas de DOM com
   * blur e mix-blend-mode, que o navegador recompõe a cada quadro; aqui é
   * um desenho só, e o laço para quando a aba sai de foco.
   * ------------------------------------------------------------------ */
  const COLUNAS = 16;
  const TAU = Math.PI * 2;
  const sorteio = (a, b) => a + Math.random() * (b - a);

  function montarFundo() {
    if (document.querySelector(".fundo-finck")) return null;
    const fundo = document.createElement("div");
    fundo.className = "fundo-finck";
    fundo.setAttribute("aria-hidden", "true");
    fundo.innerHTML = `<canvas class="fundo-finck__tela"></canvas>`;
    document.body.appendChild(fundo);
    iniciarCofre(fundo.querySelector(".fundo-finck__tela"));
    return fundo;
  }

  function iniciarCofre(tela) {
    const ctx = tela && tela.getContext && tela.getContext("2d", { alpha: false });
    if (!ctx) return;

    let L = 0, A = 0, hz = 0;
    let pulsos = [], moedas = [];
    let t = 0, anterior = 0, laco = 0;

    // o ponto de fuga acompanha o ponteiro de leve, o que dá profundidade
    // sem que a pessoa perceba de onde vem a sensação
    const mira = { alvo: 0.5, atual: 0.5 };

    const emY = (prof) => hz + (A - hz) * prof;
    const emX = (faixa, prof, fuga) => {
      const base = (faixa / COLUNAS) * L * 2.4 - L * 0.7;
      return base + (fuga - base) * (1 - prof);
    };

    const novoPulso = (p) => ({
      col: Math.floor(sorteio(4, 13)),
      p,
      v: sorteio(0.1, 0.3),
    });

    // faixas fracionárias: as moedas não ficam presas às linhas da grade
    const novaMoeda = (p) => ({
      faixa: sorteio(3.4, 12.6),
      p,
      v: sorteio(0.1, 0.22),
      giro: sorteio(0, TAU),
      vGiro: sorteio(1.7, 3.6) * (Math.random() < 0.5 ? -1 : 1),
      alto: sorteio(0.05, 0.26),
    });

    function medir() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      L = window.innerWidth;
      A = window.innerHeight;
      tela.width = Math.max(1, Math.round(L * dpr));
      tela.height = Math.max(1, Math.round(A * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      hz = A * 0.34;
    }

    function povoar() {
      pulsos = Array.from({ length: 8 }, () => novoPulso(Math.random()));
      moedas = Array.from({ length: 7 }, () => novaMoeda(Math.random()));
    }

    /** Uma moeda de perfil variável: a largura oscila e ela parece girar. */
    function desenharMoeda(x, y, r, giro) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.8);
      halo.addColorStop(0, "rgba(254,200,0,.3)");
      halo.addColorStop(1, "rgba(254,200,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.8, 0, TAU);
      ctx.fill();

      // De perfil a moeda não pode virar um bastão: a largura mínima é maior
      // e a altura encolhe um pouco, o que lê como o rebordo da moeda.
      const frente = Math.abs(Math.cos(giro));
      const rx = Math.max(r * 0.22, frente * r);
      const ry = r * (0.86 + 0.14 * frente);

      const face = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
      face.addColorStop(0, "#ffe9a3");
      face.addColorStop(0.42, "#fec800");
      face.addColorStop(1, "#b8790a");
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
      ctx.fillStyle = face;
      ctx.fill();

      if (r > 2.2) {
        ctx.lineWidth = Math.max(0.5, r * 0.1);
        ctx.strokeStyle = "rgba(112,66,3,.75)";
        ctx.stroke();
      }

      // o cifrão só entra quando a moeda está de frente e grande o bastante
      // para ele não virar borrão
      if (r > 8 && rx > r * 0.55) {
        ctx.save();
        ctx.font = `700 ${(r * 1.2).toFixed(1)}px ${getComputedStyle(document.body).fontFamily || "sans-serif"}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(112,66,3,.72)";
        ctx.fillText("$", x, y + r * 0.05);
        ctx.restore();
      }
    }

    function quadro(dt) {
      mira.atual += (mira.alvo - mira.atual) * 0.05;
      const fuga = L * (0.5 + (mira.atual - 0.5) * 0.12);

      ctx.fillStyle = "#07060a";
      ctx.fillRect(0, 0, L, A);

      // O clarão do piso precisa nascer transparente. Começar a faixa já com
      // cor cria uma linha horizontal visível na altura em que o retângulo
      // começa — parece um defeito de renderização.
      const topo = hz - 150;
      const chao = ctx.createLinearGradient(0, topo, 0, A);
      chao.addColorStop(0, "rgba(104,12,144,0)");
      chao.addColorStop(0.32, "rgba(104,12,144,.34)");
      chao.addColorStop(1, "rgba(104,12,144,0)");
      ctx.fillStyle = chao;
      ctx.fillRect(0, topo, L, A - topo);

      ctx.lineWidth = 1;

      for (let i = 0; i <= COLUNAS; i++) {
        const x = (i / COLUNAS) * L * 2.4 - L * 0.7;
        ctx.strokeStyle = "rgba(147,51,196,.2)";
        ctx.beginPath();
        ctx.moveTo(x, A);
        ctx.lineTo(fuga, hz);
        ctx.stroke();
      }

      for (let i = 0; i < 22; i++) {
        const k = (i + ((t * 0.28) % 1)) / 22;
        const y = emY(k * k * k);
        if (y < hz || y > A) continue;
        ctx.strokeStyle = `rgba(180,92,240,${0.05 + 0.22 * k})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(L, y);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "lighter";
      for (const p of pulsos) {
        p.p += p.v * dt * 0.72;
        if (p.p > 1) Object.assign(p, novoPulso(0));
        const k = 1 - p.p;
        const prof = k * k * k;
        const y = emY(prof);
        const x = emX(p.col, prof, fuga);
        const raio = 15 * k + 3;
        const luz = ctx.createRadialGradient(x, y, 0, x, y, raio);
        luz.addColorStop(0, `rgba(254,200,0,${0.34 * k + 0.1})`);
        luz.addColorStop(1, "rgba(254,200,0,0)");
        ctx.fillStyle = luz;
        ctx.beginPath();
        ctx.arc(x, y, raio, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(255,236,170,${0.55 * k + 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.5 * k + 0.7, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // as moedas vêm depois e sem "lighter": ouro sólido, não translúcido
      for (const m of moedas) {
        // Em perspectiva pura o que se afasta desacelera, e as moedas se
        // amontoam no horizonte enquanto o primeiro plano fica vazio. Este
        // fator segura um pouco a chegada e apressa a saída, o que espalha
        // as moedas pela profundidade toda.
        m.p += m.v * dt * (0.5 + 1.2 * m.p);
        m.giro += m.vGiro * dt;
        if (m.p > 1) Object.assign(m, novaMoeda(0));
        const k = 1 - m.p;
        const prof = k * k * k;
        const y = emY(prof) - (A - hz) * prof * m.alto;
        const x = emX(m.faixa, prof, fuga);
        desenharMoeda(x, y, 19 * k + 1.2, m.giro);
      }

      // Névoa: é ela que faz pulsos e moedas sumirem no horizonte. Começa
      // acima de onde o clarão do piso nasce, senão o topo dela corta o
      // clarão e deixa outra linha horizontal à mostra.
      const nevoaTopo = hz - 170;
      const nevoa = ctx.createLinearGradient(0, nevoaTopo, 0, hz + 40);
      nevoa.addColorStop(0, "rgba(7,6,10,.95)");
      nevoa.addColorStop(0.46, "rgba(7,6,10,.95)");
      nevoa.addColorStop(1, "rgba(7,6,10,0)");
      ctx.fillStyle = nevoa;
      ctx.fillRect(0, nevoaTopo, L, hz + 40 - nevoaTopo);
    }

    function passo(agora) {
      const dt = Math.min((agora - anterior) / 1000, 0.05);
      anterior = agora;
      t += dt;
      quadro(dt);
      laco = raf(passo);
    }

    function tocar() {
      if (laco || reduzido || document.hidden) return;
      anterior = performance.now();
      laco = raf(passo);
    }
    function parar() {
      if (!laco) return;
      cancelAnimationFrame(laco);
      laco = 0;
    }

    medir();
    povoar();
    quadro(0);

    if (!reduzido) {
      tocar();
      document.addEventListener("visibilitychange", () => (document.hidden ? parar() : tocar()));
    }

    if (!reduzido && !toque) {
      window.addEventListener("pointermove", (e) => {
        mira.alvo = e.clientX / window.innerWidth;
      }, { passive: true });
    }

    let aguardando;
    window.addEventListener("resize", () => {
      clearTimeout(aguardando);
      aguardando = setTimeout(() => {
        medir();
        povoar();
        if (reduzido) quadro(0);
      }, 160);
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
    montarFundo();
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
