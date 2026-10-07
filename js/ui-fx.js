(() => {
  "use strict";
  // Além do prefers-reduced-motion do sistema, a pessoa escolhe no
  // Perfil: animações completas, reduzidas ou desligadas.
  const lerPreferencia = () => {
    try {
      return localStorage.getItem("finck-animacoes") || "completa";
    } catch {
      return "completa";
    }
  };
  let preferencia = lerPreferencia();
  document.documentElement.dataset.animacoes = preferencia;
  const sistemaReduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reduzido = sistemaReduz || preferencia === "desligada";
  const toque = window.matchMedia("(hover: none)").matches;
  const raf = window.requestAnimationFrame.bind(window);
  const TAU = Math.PI * 2;
  const sorteio = (a, b) => a + Math.random() * (b - a);
  // Em telas de formulário o fundo fica mais calmo (cerca de 35% menos
  // partículas): ali o conteúdo é a leitura. Login e o topo do Reality são
  // telas de apresentação e ficam com a versão mais expressiva.
  const PAGINAS_FORMULARIO = new Set([ "reality", "onboarding", "cadastro", "perfil", "metas", "contas", "recorrentes", "planejamento", "locais", "assistente", "cenarios", "decisoes", "relatorios", "analises" ]);
  const PAGINAS_COM_HEROI = new Set([ "reality" ]);
  function montarFundo() {
    if (document.querySelector(".fundo-finck")) {
      return null;
    }
    const fundo = document.createElement("div");
    fundo.className = "fundo-finck";
    fundo.setAttribute("aria-hidden", "true");
    fundo.innerHTML = `<canvas class="fundo-finck__tela"></canvas>`;
    document.body.appendChild(fundo);
    iniciarOrbita(fundo.querySelector(".fundo-finck__tela"));
    return fundo;
  }
  // "Órbita de decisões": três órbitas finas (dinheiro, tempo de trabalho e
  // metas) com pontos que dão uma volta a cada 35 a 60 segundos. Roxo é o
  // fluxo de análise, amarelo é decisão, e o verde só aparece quando a tela
  // sinaliza um resultado de equilíbrio (FinckFundo.tom("positivo")). Nada no
  // fundo brilha a ponto de parecer um botão.
  function iniciarOrbita(tela) {
    const ctx = tela && tela.getContext && tela.getContext("2d", {
      alpha: false
    });
    if (!ctx) {
      return;
    }
    const pagina = document.body?.dataset.page || "";
    let L = 0, A = 0, escala = 1;
    let pontos = [];
    let t = 0, anterior = 0, laco = 0;
    let parado = reduzido;
    let semPonteiro = preferencia === "reduzida";
    // 0 = neutro, 1 = positivo; transita devagar para não piscar.
    let verde = 0, verdeAlvo = 0;
    const ROXO = [ 180, 92, 240 ], ROXO_FUNDO = [ 147, 51, 196 ], AMARELO = [ 254, 200, 0 ], VERDE = [ 31, 209, 143 ];
    // Uma órbita para cada ideia: dinheiro (roxo), tempo de trabalho (amarelo)
    // e metas (roxo profundo). Raio relativo, achatamento e inclinação.
    const ORBITAS = [ {
      raio: .62,
      achatado: .4,
      giro: -.16,
      cor: ROXO
    }, {
      raio: .86,
      achatado: .42,
      giro: -.1,
      cor: AMARELO
    }, {
      raio: 1.1,
      achatado: .44,
      giro: -.05,
      cor: ROXO_FUNDO
    } ];
    const mira = {
      x: .5,
      y: .45,
      atualX: .5,
      atualY: .45,
      ativa: false
    };
    const novoPonto = (i, total) => {
      const orbita = i % ORBITAS.length;
      // Uma volta a cada 35 a 60 s; algumas no sentido contrário.
      const periodo = sorteio(35, 60);
      return {
        angulo: i / total * TAU + sorteio(-.2, .2),
        orbita: orbita,
        profundidade: sorteio(.94, 1.06),
        velocidade: TAU / periodo * (i % 5 === 0 ? -1 : 1),
        // Um ponto maior a cada 8 a 12 pequenos.
        tamanho: i % 10 === 0 ? sorteio(2.2, 2.8) : sorteio(.7, 1.4),
        fase: sorteio(0, TAU),
        // A cor do ponto segue a órbita; amarelo aparece também como
        // "decisão" em alguns pontos das outras órbitas.
        cor: orbita === 1 || i % 7 === 0 ? AMARELO : i % 2 ? ROXO : ROXO_FUNDO,
        podeVerde: i % 3 === 0
      };
    };
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
      // Menos pontos em telas pequenas: a densidade acompanha a área.
      const total = Math.max(18, Math.min(54, Math.round(L * A / 26e3)));
      pontos = Array.from({
        length: total
      }, (_, i) => novoPonto(i, total));
    }
    // Quantos pontos desenhar agora. No Reality, a versão expressiva vale
    // enquanto o herói está na tela; ao descer para o formulário, acalma.
    function visiveis() {
      const leve = preferencia === "reduzida" || PAGINAS_FORMULARIO.has(pagina) && !(PAGINAS_COM_HEROI.has(pagina) && window.scrollY < 220);
      return leve ? Math.round(pontos.length * .65) : pontos.length;
    }
    function luz(x, y, raio, cor, opacidade) {
      if (opacidade <= .001) {
        return;
      }
      const gradiente = ctx.createRadialGradient(x, y, 0, x, y, raio);
      gradiente.addColorStop(0, `rgba(${cor[0]},${cor[1]},${cor[2]},${opacidade})`);
      gradiente.addColorStop(.42, `rgba(${cor[0]},${cor[1]},${cor[2]},${opacidade * .34})`);
      gradiente.addColorStop(1, `rgba(${cor[0]},${cor[1]},${cor[2]},0)`);
      ctx.fillStyle = gradiente;
      ctx.fillRect(x - raio, y - raio, raio * 2, raio * 2);
    }
    const misturar = (a, b, k) => [ 0, 1, 2 ].map(i => Math.round(a[i] + (b[i] - a[i]) * k));
    function quadro(dt) {
      verde += (verdeAlvo - verde) * Math.min(1, dt * 1.2 + (parado ? 1 : 0));
      const alvoX = mira.ativa ? mira.x : .5;
      const alvoY = mira.ativa ? mira.y : .45;
      mira.atualX += (alvoX - mira.atualX) * Math.min(1, dt * 2.5 + .02);
      mira.atualY += (alvoY - mira.atualY) * Math.min(1, dt * 2.5 + .02);
      // O ponteiro desloca a órbita em no máximo 6 px: o fundo responde, mas
      // nunca parece estar por cima do conteúdo.
      const centroX = L * .5 + (mira.atualX - .5) * 12;
      const centroY = A * .53 + (mira.atualY - .5) * 10;
      const base = ctx.createLinearGradient(0, 0, L, A);
      base.addColorStop(0, "#09050f");
      base.addColorStop(.52, "#07060a");
      base.addColorStop(1, "#040307");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, L, A);
      // Halo roxo no canto superior esquerdo e amarelo, mais discreto, no
      // inferior direito. Oscilam em intensidade, não em posição.
      const respiro = .5 + .5 * Math.sin(t * .2);
      luz(L * .14, A * .1, Math.max(L, A) * .68, ROXO, .18 + respiro * .04);
      luz(L * .9, A * .9, Math.max(L, A) * .5, AMARELO, .05 + respiro * .015);
      luz(centroX, centroY, Math.min(L, A) * .6, VERDE, .06 * verde);
      const raioBase = Math.min(L * .5, A * .56);
      ORBITAS.forEach((o, i) => {
        // Opacidade entre 0,06 e 0,14, pulsando devagar.
        const pulso = .5 + .5 * Math.sin(t * .18 + i * 2.1);
        ctx.save();
        ctx.translate(centroX, centroY);
        ctx.rotate(o.giro);
        ctx.beginPath();
        ctx.ellipse(0, 0, raioBase * o.raio * 1.45, raioBase * o.raio * o.achatado * 1.45, 0, 0, TAU);
        ctx.lineWidth = .8;
        ctx.strokeStyle = `rgba(${o.cor[0]},${o.cor[1]},${o.cor[2]},${(.06 + pulso * .08).toFixed(3)})`;
        ctx.stroke();
        ctx.restore();
      });
      ctx.globalCompositeOperation = "lighter";
      const ponteiroX = mira.atualX * L;
      const ponteiroY = mira.atualY * A;
      const quantos = visiveis();
      for (let n = 0; n < quantos; n++) {
        const p = pontos[n];
        const o = ORBITAS[p.orbita];
        p.angulo += p.velocidade * dt;
        const rx = raioBase * o.raio * 1.45 * p.profundidade;
        const ry = raioBase * o.raio * o.achatado * 1.45 * p.profundidade;
        const posicao = ang => {
          const ex = Math.cos(ang) * rx;
          const ey = Math.sin(ang) * ry;
          return [ centroX + ex * Math.cos(o.giro) - ey * Math.sin(o.giro), centroY + ex * Math.sin(o.giro) + ey * Math.cos(o.giro) ];
        };
        let [x, y] = posicao(p.angulo);
        if (mira.ativa) {
          const dx = x - ponteiroX;
          const dy = y - ponteiroY;
          const distancia = Math.hypot(dx, dy) || 1;
          const alcance = Math.min(L, A) * .2;
          if (distancia < alcance) {
            const forca = (1 - distancia / alcance) * 6;
            x += dx / distancia * forca;
            y += dy / distancia * forca;
          }
        }
        const brilho = .4 + .2 * Math.sin(t * .6 + p.fase);
        const tamanho = p.tamanho * escala;
        const [r, g, b] = p.podeVerde && verde > .01 ? misturar(p.cor, VERDE, verde) : p.cor;
        // Trilha curta: um trecho fixo de arco, sem rastro longo.
        const [tx, ty] = posicao(p.angulo - Math.sign(p.velocidade) * .07);
        const trilha = ctx.createLinearGradient(tx, ty, x, y);
        trilha.addColorStop(0, `rgba(${r},${g},${b},0)`);
        trilha.addColorStop(1, `rgba(${r},${g},${b},${(brilho * .28).toFixed(3)})`);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.lineWidth = Math.max(.5, tamanho * .45);
        ctx.strokeStyle = trilha;
        ctx.stroke();
        const halo = ctx.createRadialGradient(x, y, 0, x, y, tamanho * 5);
        halo.addColorStop(0, `rgba(${r},${g},${b},${(brilho * .4).toFixed(3)})`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, tamanho * 5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(${r},${g},${b},${(.4 + brilho * .45).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, tamanho, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      // Zona de leitura: vinheta escura na coluna do conteúdo e no rodapé,
      // para que nenhum ponto pareça estar por cima de texto.
      const coluna = Math.min(L, 1180);
      const leituraX = ctx.createLinearGradient((L - coluna) / 2, 0, (L + coluna) / 2, 0);
      leituraX.addColorStop(0, "rgba(4,3,7,0)");
      leituraX.addColorStop(.18, "rgba(4,3,7,.22)");
      leituraX.addColorStop(.82, "rgba(4,3,7,.22)");
      leituraX.addColorStop(1, "rgba(4,3,7,0)");
      ctx.fillStyle = leituraX;
      ctx.fillRect(0, 0, L, A);
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
      if (laco || parado || document.hidden) {
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
    tocar();
    // Pausa quando a aba some; nada roda em segundo plano.
    document.addEventListener("visibilitychange", () => document.hidden ? parar() : tocar());
    const mover = e => {
      // Toque não move o fundo: no celular o dedo está lendo, não apontando.
      if (parado || semPonteiro || e.pointerType === "touch") {
        return;
      }
      mira.x = Math.max(0, Math.min(1, e.clientX / Math.max(1, window.innerWidth)));
      mira.y = Math.max(0, Math.min(1, e.clientY / Math.max(1, window.innerHeight)));
      mira.ativa = true;
    };
    window.addEventListener("pointermove", mover, {
      passive: true
    });
    document.addEventListener("pointerleave", () => {
      mira.ativa = false;
    }, {
      passive: true
    });
    let aguardando;
    window.addEventListener("resize", () => {
      clearTimeout(aguardando);
      aguardando = setTimeout(() => {
        medir();
        povoar();
        if (parado) {
          quadro(0);
        }
      }, 160);
    }, {
      passive: true
    });
    window.FinckFundo = {
      // Troca de preferência no Perfil vale na hora, sem recarregar.
      preferencia(nova) {
        preferencia = nova;
        semPonteiro = nova === "reduzida";
        mira.ativa = false;
        parado = sistemaReduz || nova === "desligada";
        if (parado) {
          parar();
          quadro(0);
        } else {
          tocar();
        }
      },
      // "positivo" acende o verde de equilíbrio; qualquer outro valor apaga.
      tom(nome) {
        verdeAlvo = nome === "positivo" ? 1 : 0;
        if (parado) {
          verde = verdeAlvo;
          quadro(0);
        }
      }
    };
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
