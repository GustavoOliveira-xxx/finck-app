/* ============================================================
   FinCK v2 — Análises (categorias, evolução, consciência)
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const R = window.FinckReality;
  const C = window.FinckCharts;

  const user = await window.FinckNav.iniciarPagina({ titulo: "Análises", subtitulo: "Para onde vai seu dinheiro" });
  if (user && window.FinckGame) {
    await window.FinckGame.premiar("analise", { chave: window.FinckUtils.hojeISO(), motivo: "análises consultadas", silencioso: true });
  }
  if (!user) return;

  const ctx = await F.carregarContexto();

  function filtrar() {
    const modo = document.getElementById("filtroPeriodo").value;
    if (modo === "tudo") return ctx.transacoes;
    if (modo === "mes") return ctx.transacoes.filter((t) => F.doMes(t));
    const meses = Number(modo);
    const limite = new Date();
    limite.setMonth(limite.getMonth() - (meses - 1));
    limite.setDate(1);
    return ctx.transacoes.filter((t) => new Date(`${String(t.date).slice(0, 10)}T12:00:00`) >= limite);
  }

  function render() {
    const transacoes = filtrar();
    const entradas = F.soma(transacoes.filter(F.ehEntrada));
    const saidas = F.soma(transacoes.filter(F.ehSaida));
    const dias = Number(ctx.perfil?.work_days_month || 22);
    const horas = Number(ctx.perfil?.work_hours_day || 8);
    const valorHora = (Number(ctx.perfil?.income_monthly || 0) / dias) / horas;
    const horasGastas = valorHora > 0 ? saidas / valorHora : 0;

    document.getElementById("resumoAnalises").innerHTML = `
      <article class="card-indicador"><span>Entradas</span><strong class="cor-verde">${U.moeda(entradas)}</strong></article>
      <article class="card-indicador"><span>Saídas</span><strong class="cor-vermelha">${U.moeda(saidas)}</strong></article>
      <article class="card-indicador"><span>Resultado</span><strong>${U.moeda(entradas - saidas)}</strong></article>
      <article class="card-indicador"><span>Tempo gasto</span><strong>${U.numero(horasGastas, 1)} h de trabalho</strong></article>`;

    const categorias = F.porCategoria(transacoes);
    C.rosca(document.getElementById("graficoCategorias"), categorias);
    // o canvas não é legível por leitor de tela: mesma informação em tabela
    C.tabelaEquivalente(document.getElementById("graficoCategorias"), {
      colunas: ["Categoria", "Total", "% das saídas"],
      linhas: categorias.map((c) => [
        c.categoria,
        U.moeda(c.valor),
        U.percentual(saidas > 0 ? (c.valor / saidas) * 100 : 0, 1),
      ]),
      resumo: `Gastos por categoria no período: ${categorias.length} categoria(s), total de ${U.moeda(saidas)}.`,
    });
    document.getElementById("listaCategorias").innerHTML = categorias.length
      ? categorias.map((c, i) => {
          const pct = saidas > 0 ? (c.valor / saidas) * 100 : 0;
          const cor = C.cores(categorias.length)[i];
          return `
            <li class="linha-categoria">
              <span class="ponto" style="background:${cor}"></span>
              <span class="cat-nome">${U.escapeHTML(c.categoria)}</span>
              <span class="cat-valor">${U.moeda(c.valor)}</span>
              <span class="cat-pct">${U.percentual(pct, 1)}</span>
              <small>${U.numero(valorHora > 0 ? c.valor / valorHora : 0, 1)} h</small>
            </li>`;
        }).join("")
      : `<li class="vazio">Nenhuma saída registrada no período.</li>`;

    const serie = F.serieMensal(ctx.transacoes, 6);
    C.barras(document.getElementById("graficoMensal"), serie);
    C.tabelaEquivalente(document.getElementById("graficoMensal"), {
      colunas: ["Mês", "Entradas", "Saídas", "Resultado"],
      linhas: serie.map((m) => [m.rotulo, U.moeda(m.entradas), U.moeda(m.saidas), U.moeda(m.resultado)]),
      resumo: `Entradas e saídas dos últimos ${serie.length} meses.`,
    });

    const resumo = R.resumoHistorico(ctx.analises);
    document.getElementById("blocoConsciente").innerHTML = `
      <ul class="lista-resumo">
        <li><span>Compras analisadas</span><strong>${resumo.total}</strong></li>
        <li><span>Compras concluídas</span><strong>${resumo.compras}</strong></li>
        <li><span>Compras evitadas ou substituídas</span><strong class="cor-verde">${resumo.evitadas}</strong></li>
        <li><span>Economia acumulada</span><strong class="cor-verde">${U.moeda(resumo.economia)}</strong></li>
        <li><span>Horas de trabalho preservadas</span><strong>${U.numero(resumo.horas_preservadas, 1)} h</strong></li>
        <li><span>Taxa de decisões conscientes</span><strong>${U.percentual(resumo.taxa_consciente, 0)}</strong></li>
      </ul>
      <p class="nota">Cada compra evitada representa também um produto a menos sendo fabricado, transportado e descartado.</p>`;
  }

  document.getElementById("filtroPeriodo").addEventListener("change", render);
  window.addEventListener("resize", () => render());
  render();
});
