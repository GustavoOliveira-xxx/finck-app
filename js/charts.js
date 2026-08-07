/* ============================================================
   FinCK v2 — Gráficos em Canvas puro (sem bibliotecas)
   O CSS controla cores via variáveis --finck-chart-1..n; se
   não existirem, usa a paleta padrão abaixo.
   ============================================================ */

window.FinckCharts = (() => {
  const PALETA_PADRAO = ["#a78bfa", "#fbbf24", "#34d399", "#60a5fa", "#f87171", "#f472b6", "#22d3ee", "#c4b5fd", "#fcd34d"];

  function cores(qtd) {
    const raiz = getComputedStyle(document.documentElement);
    const lista = [];
    for (let i = 1; i <= qtd; i++) {
      const v = raiz.getPropertyValue(`--finck-chart-${i}`).trim();
      lista.push(v || PALETA_PADRAO[(i - 1) % PALETA_PADRAO.length]);
    }
    return lista;
  }

  const corTexto = () =>
    getComputedStyle(document.documentElement).getPropertyValue("--finck-chart-texto").trim() || "#e5e7eb";

  function preparar(canvas) {
    const ctx = canvas.getContext("2d");
    const escala = window.devicePixelRatio || 1;
    const largura = canvas.clientWidth || canvas.width;
    const altura = canvas.clientHeight || canvas.height;
    canvas.width = largura * escala;
    canvas.height = altura * escala;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.clearRect(0, 0, largura, altura);
    return { ctx, largura, altura };
  }

  /** Rosca de categorias. dados: [{ categoria, valor }] */
  function rosca(canvas, dados) {
    if (!canvas) return;
    const { ctx, largura, altura } = preparar(canvas);
    const total = dados.reduce((s, d) => s + d.valor, 0);
    if (!total) {
      ctx.fillStyle = corTexto();
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Sem dados no período", largura / 2, altura / 2);
      return;
    }
    const paleta = cores(dados.length);
    const cx = largura / 2;
    const cy = altura / 2;
    const raio = Math.min(largura, altura) / 2 - 10;
    let inicio = -Math.PI / 2;

    dados.forEach((d, i) => {
      const angulo = (d.valor / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, raio, inicio, inicio + angulo);
      ctx.closePath();
      ctx.fillStyle = paleta[i];
      ctx.fill();
      inicio += angulo;
    });

    // furo central
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, raio * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = corTexto();
    ctx.textAlign = "center";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), cx, cy + 5);
  }

  /** Barras agrupadas. serie: [{ rotulo, entradas, saidas }] */
  function barras(canvas, serie) {
    if (!canvas) return;
    const { ctx, largura, altura } = preparar(canvas);
    if (!serie.length) return;

    const margem = { top: 16, right: 12, bottom: 28, left: 12 };
    const larguraUtil = largura - margem.left - margem.right;
    const alturaUtil = altura - margem.top - margem.bottom;
    const max = Math.max(1, ...serie.flatMap((s) => [s.entradas, s.saidas]));
    const larguraGrupo = larguraUtil / serie.length;
    const larguraBarra = Math.min(22, larguraGrupo / 3);
    const [corE, corS] = cores(2);

    ctx.strokeStyle = corTexto();
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.moveTo(margem.left, margem.top + alturaUtil);
    ctx.lineTo(largura - margem.right, margem.top + alturaUtil);
    ctx.stroke();
    ctx.globalAlpha = 1;

    serie.forEach((s, i) => {
      const centro = margem.left + larguraGrupo * i + larguraGrupo / 2;
      const hE = (s.entradas / max) * alturaUtil;
      const hS = (s.saidas / max) * alturaUtil;

      ctx.fillStyle = corE;
      ctx.fillRect(centro - larguraBarra - 2, margem.top + alturaUtil - hE, larguraBarra, hE);
      ctx.fillStyle = corS;
      ctx.fillRect(centro + 2, margem.top + alturaUtil - hS, larguraBarra, hS);

      ctx.fillStyle = corTexto();
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(s.rotulo, centro, altura - 8);
    });
  }

  /** Barra de progresso horizontal simples (0–100). */
  function progresso(canvas, percentual) {
    if (!canvas) return;
    const { ctx, largura, altura } = preparar(canvas);
    const [cor] = cores(1);
    const h = Math.min(18, altura);
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = corTexto();
    ctx.fillRect(0, (altura - h) / 2, largura, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = cor;
    ctx.fillRect(0, (altura - h) / 2, (Math.max(0, Math.min(100, percentual)) / 100) * largura, h);
  }

  return { rosca, barras, progresso, cores };
})();
