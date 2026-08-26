(() => {
  "use strict";
  const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toque = window.matchMedia("(hover: none)").matches;
  const raf = window.requestAnimationFrame.bind(window);
  const TAU = Math.PI * 2;
  const sorteio = (a, b) => a + Math.random() * (b - a);
  function montarFundo() {
    if (document.querySelector(".fundo-finck")) {
      return null;
    }
    const fundo = document.createElement("div");
    fundo.className = "fundo-finck";
    fundo.setAttribute("aria-hidden", "true");
    fundo.innerHTML = `<canvas class="fundo-finck__tela"></canvas>`;
    document.body.appendChild(fundo);
    iniciarCofre(fundo.querySelector(".fundo-finck__tela"));
    return fundo;
  }
  function iniciarCofre(tela) {
    const ctx = tela && tela.getContext && tela.getContext("2d", {
      alpha: false
    });
    if (!ctx) {
      return;
    }
    let L = 0, A = 0, escala = 1;
    let pontos = [];
    let t = 0, anterior = 0, laco = 0;
    const cores = [ [ 180, 92, 240 ], [ 254, 200, 0 ], [ 31, 209, 143 ], [ 147, 51, 196 ] ];
    const mira = {
      x: .5,
      y: .45,
      atualX: .5,
      atualY: .45,
      ativa: false
    };
    const novoPonto = (i, total) => ({
      angulo: i / total * TAU + sorteio(-.18, .18),
      faixa: i % 4,
      profundidade: sorteio(.58, 1.16),
      velocidade: sorteio(.035, .095) * (i % 3 === 0 ? -1 : 1),
      tamanho: sorteio(.8, 2.5),
      fase: sorteio(0, TAU),
      cor: cores[i % cores.length]
    });
    function medir() {
      L = window.innerWidth;
      A = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, L < 700 ? 1.5 : 2);
      tela.width = Math.max(1, Math.round(L * dpr));
      tela.height = Math.max(1, Math.round(A * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      escala = Math.max(.68, Math.min(1.18, Math.min(L / 900, A / 720)));
    }
    function povoar() {
      const total = Math.max(20, Math.min(54, Math.round(L * A / 26e3)));
      pontos = Array.from({
        length: total
      }, (_, i) => novoPonto(i, total));
    }
    function luz(x, y, raio, cor, opacidade) {
      const gradiente = ctx.createRadialGradient(x, y, 0, x, y, raio);
      gradiente.addColorStop(0, `rgba(${cor[0]},${cor[1]},${cor[2]},${opacidade})`);
      gradiente.addColorStop(.42, `rgba(${cor[0]},${cor[1]},${cor[2]},${opacidade * .34})`);
      gradiente.addColorStop(1, `rgba(${cor[0]},${cor[1]},${cor[2]},0)`);
      ctx.fillStyle = gradiente;
      ctx.fillRect(x - raio, y - raio, raio * 2, raio * 2);
    }
    function quadro(dt) {
      const repousoX = .5 + Math.sin(t * .12) * .12;
      const repousoY = .46 + Math.cos(t * .09) * .08;
      const alvoX = mira.ativa ? mira.x : repousoX;
      const alvoY = mira.ativa ? mira.y : repousoY;
      mira.atualX += (alvoX - mira.atualX) * Math.min(1, dt * 3.8 + .025);
      mira.atualY += (alvoY - mira.atualY) * Math.min(1, dt * 3.8 + .025);
      const centroX = L * (.5 + (mira.atualX - .5) * .16);
      const centroY = A * (.53 + (mira.atualY - .5) * .12);
      const base = ctx.createLinearGradient(0, 0, L, A);
      base.addColorStop(0, "#09050f");
      base.addColorStop(.52, "#07060a");
      base.addColorStop(1, "#040307");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, L, A);
      luz(L * (.12 + mira.atualX * .18), A * .08, Math.max(L, A) * .68, cores[0], .22);
      luz(L * (.9 - mira.atualX * .12), A * (.82 + mira.atualY * .08), Math.max(L, A) * .54, cores[1], .075);
      luz(centroX, centroY, Math.min(L, A) * .62, cores[2], .055);
      const raioBase = Math.min(L * .58, A * .62);
      ctx.save();
      ctx.translate(centroX, centroY);
      ctx.rotate(-.14 + (mira.atualX - .5) * .12);
      for (let i = 0; i < 5; i++) {
        const raio = raioBase * (.54 + i * .16);
        const pulso = .5 + .5 * Math.sin(t * .24 + i * 1.2);
        ctx.beginPath();
        ctx.ellipse(0, 0, raio * 1.42, raio * .58, 0, -2.72 + i * .38, 1.42 + i * .5);
        ctx.lineWidth = .65 + i * .16;
        ctx.strokeStyle = `rgba(${i % 2 ? "254,200,0" : "180,92,240"},${.035 + pulso * .045})`;
        ctx.stroke();
      }
      ctx.restore();
      const ponteiroX = mira.atualX * L;
      const ponteiroY = mira.atualY * A;
      ctx.globalCompositeOperation = "lighter";
      for (const p of pontos) {
        p.angulo += p.velocidade * dt;
        const faixa = .48 + p.faixa * .17;
        const raio = raioBase * faixa * p.profundidade;
        const angulo = p.angulo + Math.sin(t * .07 + p.fase) * .12;
        let x = centroX + Math.cos(angulo) * raio * 1.48;
        let y = centroY + Math.sin(angulo) * raio * .62;
        const dx = x - ponteiroX;
        const dy = y - ponteiroY;
        const distancia = Math.hypot(dx, dy) || 1;
        const alcance = Math.min(L, A) * .24;
        if (mira.ativa && distancia < alcance) {
          const forca = (1 - distancia / alcance) * 26 * escala;
          x += dx / distancia * forca;
          y += dy / distancia * forca;
        }
        const brilho = .38 + .28 * Math.sin(t * .8 + p.fase);
        const tamanho = p.tamanho * escala;
        const [r, g, b] = p.cor;
        const trilhaX = centroX + Math.cos(angulo - p.velocidade * 8) * raio * 1.48;
        const trilhaY = centroY + Math.sin(angulo - p.velocidade * 8) * raio * .62;
        const trilha = ctx.createLinearGradient(trilhaX, trilhaY, x, y);
        trilha.addColorStop(0, `rgba(${r},${g},${b},0)`);
        trilha.addColorStop(1, `rgba(${r},${g},${b},${brilho * .34})`);
        ctx.beginPath();
        ctx.moveTo(trilhaX, trilhaY);
        ctx.lineTo(x, y);
        ctx.lineWidth = Math.max(.55, tamanho * .48);
        ctx.strokeStyle = trilha;
        ctx.stroke();
        const halo = ctx.createRadialGradient(x, y, 0, x, y, tamanho * 7);
        halo.addColorStop(0, `rgba(${r},${g},${b},${brilho * .7})`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, tamanho * 7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(${r},${g},${b},${.5 + brilho * .5})`;
        ctx.beginPath();
        ctx.arc(x, y, tamanho, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      const leitura = ctx.createLinearGradient(0, 0, 0, A);
      leitura.addColorStop(0, "rgba(4,3,7,.04)");
      leitura.addColorStop(.42, "rgba(4,3,7,.18)");
      leitura.addColorStop(1, "rgba(4,3,7,.52)");
      ctx.fillStyle = leitura;
      ctx.fillRect(0, 0, L, A);
    }
    function passo(agora) {
      const dt = Math.min((agora - anterior) / 1e3, .05);
      anterior = agora;
      t += dt;
      quadro(dt);
      laco = raf(passo);
    }
    function tocar() {
      if (laco || reduzido || document.hidden) {
        return;
      }
      anterior = performance.now();
      laco = raf(passo);
    }
    function parar() {
      if (!laco) {
        return;
      }
      cancelAnimationFrame(laco);
      laco = 0;
    }
    medir();
    povoar();
    quadro(0);
    if (!reduzido) {
      tocar();
      document.addEventListener("visibilitychange", () => document.hidden ? parar() : tocar());
    }
    if (!reduzido) {
      const mover = e => {
        if (e.pointerType === "touch" && e.buttons === 0 && e.pressure === 0) {
          return;
        }
        mira.x = Math.max(0, Math.min(1, e.clientX / Math.max(1, window.innerWidth)));
        mira.y = Math.max(0, Math.min(1, e.clientY / Math.max(1, window.innerHeight)));
        mira.ativa = true;
      };
      window.addEventListener("pointermove", mover, {
        passive: true
      });
      window.addEventListener("pointerdown", mover, {
        passive: true
      });
      window.addEventListener("pointerleave", () => {
        mira.ativa = false;
      }, {
        passive: true
      });
      window.addEventListener("pointerup", e => {
        if (e.pointerType === "touch") {
          mira.ativa = false;
        }
      }, {
        passive: true
      });
    }
    let aguardando;
    window.addEventListener("resize", () => {
      clearTimeout(aguardando);
      aguardando = setTimeout(() => {
        medir();
        povoar();
        if (reduzido) {
          quadro(0);
        }
      }, 160);
    }, {
      passive: true
    });
  }
  const SELETOR_REVELAR = [ ".hero", ".bloco", ".balance-card", ".reality-cta", ".cards-indicadores", ".acoes-rapidas", ".card-nivel", ".filtros", ".etapa", ".link-rodape" ].join(",");
  function revelar() {
    if (reduzido || !("IntersectionObserver" in window)) {
      return;
    }
    const obs = new IntersectionObserver(entradas => {
      entradas.forEach(e => {
        if (!e.isIntersecting) {
          return;
        }
        e.target.classList.add("revelado");
        obs.unobserve(e.target);
      });
    }, {
      rootMargin: "0px 0px -8% 0px",
      threshold: .06
    });
    const marcar = () => {
      document.querySelectorAll(SELETOR_REVELAR).forEach((el, i) => {
        if (el.dataset.revelar) {
          return;
        }
        el.dataset.revelar = "";
        el.style.transitionDelay = `${Math.min(i, 6) * 55}ms`;
        obs.observe(el);
      });
    };
    marcar();
    setTimeout(marcar, 350);
    setTimeout(marcar, 1200);
  }
  const SELETOR_VALOR = [ "#saldoAtual", "#entradasMes", "#saidasMes", "#rendaLivre", "#valorHora", "#valorDia", "#totalDespesas" ].join(",");
  const lerNumero = txt => {
    const limpo = String(txt).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(limpo);
    return Number.isFinite(n) ? n : null;
  };
  function contar(el, destino, molde) {
    const dur = 900;
    const inicio = performance.now();
    const de = Number(el.dataset.fxValor || 0);
    const casasBR = molde.includes(",");
    const fmt = v => {
      const s = casasBR ? v.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) : String(Math.round(v));
      return molde.replace(/[\d.,]+/, s);
    };
    const passo = agora => {
      const p = Math.min(1, (agora - inicio) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(de + (destino - de) * e);
      if (p < 1) {
        raf(passo);
      } else {
        el.textContent = molde;
        el.dataset.fxValor = String(destino);
      }
    };
    raf(passo);
  }
  function animarValores() {
    if (reduzido) {
      return;
    }
    const alvos = [ ...document.querySelectorAll(SELETOR_VALOR) ];
    if (!alvos.length) {
      return;
    }
    const obs = new MutationObserver(muts => {
      muts.forEach(m => {
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (!el || el.dataset.fxAnimando === "1") {
          return;
        }
        const texto = el.textContent.trim();
        const n = lerNumero(texto);
        if (n === null) {
          return;
        }
        const anterior = Number(el.dataset.fxValor || 0);
        if (Math.abs(n - anterior) < .005) {
          return;
        }
        el.dataset.fxAnimando = "1";
        el.classList.remove("valor-atualizado");
        void el.offsetWidth;
        el.classList.add("valor-atualizado");
        contar(el, n, texto);
        setTimeout(() => {
          el.dataset.fxAnimando = "0";
        }, 950);
      });
    });
    alvos.forEach(el => {
      el.dataset.fxValor = "0";
      obs.observe(el, {
        childList: true,
        characterData: true,
        subtree: true
      });
    });
  }
  const CLICAVEIS = ".btn-primario,.btn-secundario,.btn-salvar,.btn-acao,.btn-perigo," + ".card-opcao,.botao-decisao,.nav-item,.btn-mini";
  function ondas() {
    if (reduzido) {
      return;
    }
    document.addEventListener("pointerdown", e => {
      const alvo = e.target.closest(CLICAVEIS);
      if (!alvo || alvo.disabled) {
        return;
      }
      const r = alvo.getBoundingClientRect();
      const d = Math.max(r.width, r.height) * 2;
      const onda = document.createElement("span");
      onda.className = "fx-onda";
      onda.style.width = onda.style.height = `${d}px`;
      onda.style.left = `${e.clientX - r.left}px`;
      onda.style.top = `${e.clientY - r.top}px`;
      if (getComputedStyle(alvo).position === "static") {
        alvo.style.position = "relative";
      }
      alvo.appendChild(onda);
      setTimeout(() => onda.remove(), 640);
    }, {
      passive: true
    });
  }
  function cartaoChip() {
    const cartao = document.querySelector(".balance-card");
    if (!cartao || cartao.querySelector(".balance-card__chip")) {
      return;
    }
    const chip = document.createElement("div");
    chip.className = "balance-card__chip";
    chip.setAttribute("aria-hidden", "true");
    cartao.prepend(chip);
  }
  function cartaoVivo() {
    if (reduzido || toque) {
      return;
    }
    const cartao = document.querySelector(".balance-card");
    if (!cartao) {
      return;
    }
    const limite = 5;
    let dentro = false;
    cartao.addEventListener("pointermove", e => {
      const r = cartao.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - .5) * -limite;
      const ry = ((e.clientX - r.left) / r.width - .5) * limite;
      cartao.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-3px)`;
      dentro = true;
    }, {
      passive: true
    });
    cartao.addEventListener("pointerleave", () => {
      if (!dentro) {
        return;
      }
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
      if (ticking) {
        return;
      }
      ticking = true;
      raf(atualizar);
    }, {
      passive: true
    });
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
    document.addEventListener("DOMContentLoaded", iniciar, {
      once: true
    });
  } else {
    iniciar();
  }
})();
