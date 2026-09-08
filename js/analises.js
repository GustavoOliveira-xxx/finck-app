document.addEventListener("DOMContentLoaded", async () => {
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const R = window.FinckReality;
  const C = window.FinckCharts;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "Análises",
    subtitulo: "Para onde vai seu dinheiro"
  });
  if (user && window.FinckGame) {
    await window.FinckGame.premiar("analise", {
      chave: window.FinckUtils.hojeISO(),
      motivo: "análises consultadas",
      silencioso: true
    });
  }
  if (!user) {
    return;
  }
  const ctx = await F.carregarContexto();
  const regime = () => document.getElementById("filtroRegime").value;
  const baseDoRegime = () => regime() === "ambos" ? ctx.transacoes : ctx.transacoesRealizadas;
  function noPeriodo(lista) {
    const modo = document.getElementById("filtroPeriodo").value;
    if (modo === "tudo") {
      return lista;
    }
    if (modo === "mes") {
      return lista.filter(t => F.doMes(t));
    }
    const meses = Number(modo);
    const limite = new Date;
    limite.setMonth(limite.getMonth() - (meses - 1));
    limite.setDate(1);
    return lista.filter(t => new Date(`${String(t.date).slice(0, 10)}T12:00:00`) >= limite);
  }
  const filtrar = () => noPeriodo(baseDoRegime());
  function render() {
    const transacoes = filtrar();
    const previstas = noPeriodo(ctx.transacoesFuturas);
    const entradas = F.soma(transacoes.filter(F.ehEntrada));
    const saidas = F.soma(transacoes.filter(F.ehSaida));
    document.getElementById("notaRegime").textContent = regime() === "ambos" ? `Os números abaixo somam realizado e previsto. O previsto (${previstas.length} lançamento(s), ${U.moeda(F.soma(previstas.filter(F.ehSaida)))} em saídas) ainda não saiu do caixa.` : previstas.length ? `Os números abaixo contam apenas o que já aconteceu. Há ${previstas.length} lançamento(s) previsto(s) no período, somando ${U.moeda(F.soma(previstas.filter(F.ehSaida)))} em saídas, que não entram neste total.` : "Os números abaixo contam apenas o que já aconteceu.";
    const dias = Number(ctx.perfil?.work_days_month || 22);
    const horas = Number(ctx.perfil?.work_hours_day || 8);
    const valorHora = Number(ctx.perfil?.income_monthly || 0) / dias / horas;
    const horasGastas = valorHora > 0 ? saidas / valorHora : 0;
    document.getElementById("resumoAnalises").innerHTML = `\n      <article class="card-indicador"><span>Entradas</span><strong class="cor-verde">${U.moeda(entradas)}</strong></article>\n      <article class="card-indicador"><span>Saídas</span><strong class="cor-vermelha">${U.moeda(saidas)}</strong></article>\n      <article class="card-indicador"><span>Resultado</span><strong>${U.moeda(entradas - saidas)}</strong></article>\n      <article class="card-indicador"><span>Tempo gasto</span><strong>${U.numero(horasGastas, 1)} h de trabalho</strong></article>`;
    const categorias = F.porCategoria(transacoes);
    C.rosca(document.getElementById("graficoCategorias"), categorias);
    C.tabelaEquivalente(document.getElementById("graficoCategorias"), {
      colunas: [ "Categoria", "Total", "% das saídas" ],
      linhas: categorias.map(c => [ c.categoria, U.moeda(c.valor), U.percentual(saidas > 0 ? c.valor / saidas * 100 : 0, 1) ]),
      resumo: `Gastos por categoria no período: ${categorias.length} categoria(s), total de ${U.moeda(saidas)}.`
    });
    document.getElementById("listaCategorias").innerHTML = categorias.length ? categorias.map((c, i) => {
      const pct = saidas > 0 ? c.valor / saidas * 100 : 0;
      const cor = C.cores(categorias.length)[i];
      return `\n            <li class="linha-categoria">\n              <span class="ponto" style="background:${cor}"></span>\n              <span class="cat-nome">${U.escapeHTML(c.categoria)}</span>\n              <span class="cat-valor">${U.moeda(c.valor)}</span>\n              <span class="cat-pct">${U.percentual(pct, 1)}</span>\n              <small>${U.numero(valorHora > 0 ? c.valor / valorHora : 0, 1)} h</small>\n            </li>`;
    }).join("") : `<li class="vazio">Nenhuma saída registrada no período.</li>`;
    const serie = F.serieMensal(baseDoRegime(), 6);
    C.barras(document.getElementById("graficoMensal"), serie);
    C.tabelaEquivalente(document.getElementById("graficoMensal"), {
      colunas: [ "Mês", "Entradas", "Saídas", "Resultado" ],
      linhas: serie.map(m => [ m.rotulo, U.moeda(m.entradas), U.moeda(m.saidas), U.moeda(m.resultado) ]),
      resumo: `Entradas e saídas dos últimos ${serie.length} meses.`
    });
    const resumo = R.resumoHistorico(ctx.analises);
    const G = R.GLOSSARIO;
    const linha = (chave, valor, classe = "") => `\n      <li title="${U.escapeHTML(G[chave].definicao)}">\n        <span>${U.escapeHTML(G[chave].rotulo)}\n          <small class="indicador-quando">${U.escapeHTML(G[chave].referencia)}</small>\n        </span>\n        <strong class="${classe}">${valor}</strong>\n      </li>`;
    document.getElementById("blocoConsciente").innerHTML = `\n      <ul class="lista-resumo lista-resumo--glossario">\n        ${linha("analises_registradas", resumo.total)}\n        <li title="Análises em que a decisão foi comprar."><span>Compras concluídas</span><strong>${resumo.compras}</strong></li>\n        ${linha("decisoes_conscientes", resumo.evitadas, "cor-verde")}\n        ${linha("valor_potencial", U.moeda(resumo.valor_potencial), "cor-verde")}\n        ${linha("economia_confirmada", U.moeda(resumo.economia_confirmada), "cor-verde")}\n        ${linha("horas_equivalentes", `${U.numero(resumo.horas_preservadas, 1)} h`)}\n        ${resumo.indicador_medio !== null ? linha("indicador_responsavel", `${resumo.indicador_medio}/100`) : ""}\n        <li title="Fatia das análises decididas em que a escolha foi consciente."><span>Taxa de decisões conscientes</span><strong>${U.percentual(resumo.taxa_consciente, 0)}</strong></li>\n      </ul>\n      ${resumo.a_acompanhar ? `<p class="nota">${resumo.a_acompanhar} decisão(ões) consciente(s) ainda sem acompanhamento. <a href="decisoes.html">Dizer o que aconteceu depois</a> transforma valor potencial em economia confirmada.</p>` : ""}\n      <p class="nota">Uma compra adiada ou substituída <em>pode</em> reduzir a demanda por um item novo. O FinCK registra a decisão e a sua reflexão — ele não mede o impacto ambiental real e não prova que um produto deixou de ser fabricado, transportado ou descartado.</p>`;
  }
  document.getElementById("filtroPeriodo").addEventListener("change", render);
  window.addEventListener("resize", () => render());
  render();
});
