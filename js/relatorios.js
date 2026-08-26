document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const R = window.FinckReality;
  const T = window.FinckTempo;
  const H = window.FinckHistorico;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "Relatórios",
    subtitulo: "Consolidação mensal"
  });
  if (!user) {
    return;
  }
  const ctx = await F.carregarContexto();
  const filtroMes = document.getElementById("filtroMes");
  filtroMes.value = U.mesAtual();
  const rotuloDecisao = id => cfg.DECISOES.find(d => d.id === id)?.label || "Sem decisão";
  function dadosDoMes() {
    const mes = filtroMes.value || U.mesAtual();
    const transacoes = ctx.transacoes.filter(t => String(t.date || "").slice(0, 7) === mes);
    const analises = ctx.analises.filter(a => String(a.analyzed_at || a.created_at || "").slice(0, 7) === mes);
    return {
      mes: mes,
      transacoes: transacoes,
      analises: analises
    };
  }
  function renderHistorico() {
    const mes = filtroMes.value || U.mesAtual();
    const p = H.panorama(ctx.transacoes, mes, 6);
    const comHistorico = p.linhas.filter(l => l.temHistorico);
    document.getElementById("chipHistorico").textContent = `${comHistorico.length} de ${p.linhas.length} categoria(s)`;
    document.getElementById("vazioHistorico").hidden = comHistorico.length > 0;
    const destaque = document.getElementById("destaqueHistorico");
    if (!comHistorico.length) {
      destaque.innerHTML = "";
      document.getElementById("listaHistorico").innerHTML = "";
      return;
    }
    const topo = comHistorico[0];
    const obsGeral = H.observacao(p.geral);
    destaque.innerHTML = `\n      <article class="destaque-historico destaque-historico--${H.tendencia(topo)}">\n        <span class="destaque-historico__etiqueta">O que mais mudou</span>\n        <h4>${U.escapeHTML(topo.categoria)}</h4>\n        <p class="destaque-historico__valor">\n          ${U.moeda(topo.atual)} ${T.selo(topo.atual, {
      classe: "selo-tempo--destaque"
    })}\n        </p>\n        <p class="destaque-historico__obs">${U.escapeHTML(H.observacao(topo) || "")}</p>\n        ${obsGeral ? `<p class="destaque-historico__geral">No total do mês: ${U.escapeHTML(obsGeral)}</p>` : ""}\n      </article>`;
    document.getElementById("listaHistorico").innerHTML = comHistorico.map(l => `\n      <article class="linha-historico linha-historico--${H.tendencia(l)}">\n        <div class="linha-historico__topo">\n          <strong>${U.escapeHTML(l.categoria)}</strong>\n          <span class="linha-historico__atual">\n            ${U.moeda(l.atual)} ${T.selo(l.atual)}\n          </span>\n        </div>\n        <div class="linha-historico__barras" role="img"\n             aria-label="${U.escapeHTML(l.categoria)}: ${l.serie.map(s => `${s.rotulo} ${U.moeda(s.total)}`).join(", ")}">\n          ${l.serie.map(s => `\n            <span class="mini-barra${s.atual ? " mini-barra--atual" : ""}"\n                  style="--altura:${Math.max(3, s.total / l.maior * 100)}%"\n                  title="${U.escapeHTML(s.rotulo)}: ${U.moeda(s.total)}">\n              <em>${U.escapeHTML(s.rotulo)}</em>\n            </span>`).join("")}\n        </div>\n        <p class="linha-historico__obs">\n          ${U.escapeHTML(H.observacao(l) || "")}\n          <span class="linha-historico__fatia">${U.percentual(l.fatia, 0)} das saídas do mês</span>\n        </p>\n      </article>`).join("");
  }
  function render() {
    renderHistorico();
    const {transacoes: transacoes, analises: analises} = dadosDoMes();
    const entradas = F.soma(transacoes.filter(F.ehEntrada));
    const saidas = F.soma(transacoes.filter(F.ehSaida));
    const resumo = R.resumoHistorico(analises);
    document.getElementById("resumoMes").innerHTML = `\n      <article class="card-indicador"><span>Entradas</span><strong class="cor-verde">${U.moeda(entradas)}</strong></article>\n      <article class="card-indicador"><span>Saídas</span><strong class="cor-vermelha">${U.moeda(saidas)}</strong></article>\n      <article class="card-indicador"><span>Resultado</span><strong>${U.moeda(entradas - saidas)}</strong></article>\n      <article class="card-indicador"><span>Movimentações</span><strong>${transacoes.length}</strong></article>`;
    document.getElementById("decisoesMes").innerHTML = analises.length ? `<ul class="lista-resumo">\n           <li><span>Análises no mês</span><strong>${resumo.total}</strong></li>\n           <li><span>Compras evitadas</span><strong class="cor-verde">${resumo.evitadas}</strong></li>\n           <li><span>Economia consciente</span><strong class="cor-verde">${U.moeda(resumo.economia)}</strong></li>\n           <li><span>Horas preservadas</span><strong>${U.numero(resumo.horas_preservadas, 1)} h</strong></li>\n         </ul>\n         <ul class="lista-simples">\n           ${analises.map(a => `\n             <li class="item-lista">\n               <span>${U.escapeHTML(a.item_name)}</span>\n               <span>${U.escapeHTML(rotuloDecisao(a.decision))}</span>\n               <strong>${U.moeda(a.price)}</strong>\n             </li>`).join("")}\n         </ul>` : `<p class="vazio">Nenhuma análise registrada neste mês.</p>`;
    const corpo = document.querySelector("#tabelaTransacoes tbody");
    document.getElementById("vazioRelatorio").hidden = transacoes.length > 0;
    corpo.innerHTML = transacoes.map(t => `\n      <tr>\n        <td>${U.dataBR(t.date)}</td>\n        <td>${U.escapeHTML(t.description)}</td>\n        <td>${U.escapeHTML(t.category || "Outros")}</td>\n        <td>${t.type === "entrada" ? "Entrada" : "Saída"}</td>\n        <td class="${t.type === "entrada" ? "cor-verde" : "cor-vermelha"}">${U.moeda(t.amount)}</td>\n      </tr>`).join("");
    document.querySelector("#tabelaMetas tbody").innerHTML = ctx.metas.length ? ctx.metas.map(m => `\n          <tr>\n            <td>${U.escapeHTML(m.name)}</td>\n            <td>${U.moeda(m.current_amount)}</td>\n            <td>${U.moeda(m.target_amount)}</td>\n            <td>${U.percentual(U.progresso(m.current_amount, m.target_amount), 0)}</td>\n            <td>${m.deadline ? U.dataBR(m.deadline) : "—"}</td>\n          </tr>`).join("") : `<tr><td colspan="5" class="vazio">Nenhuma meta cadastrada.</td></tr>`;
  }
  document.getElementById("btnCSV").addEventListener("click", () => {
    const {mes: mes, transacoes: transacoes} = dadosDoMes();
    const linhas = [ [ "Data", "Descricao", "Categoria", "Tipo", "Valor" ] ].concat(transacoes.map(t => [ t.date, t.description, t.category || "Outros", t.type, String(t.amount).replace(".", ",") ]));
    const csv = "\ufeff" + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    U.baixarArquivo(`finck-relatorio-${mes}.csv`, csv, "text/csv;charset=utf-8");
    U.toast("CSV exportado.", "sucesso");
  });
  document.getElementById("btnJSON").addEventListener("click", async () => {
    const dados = await S.exportarTudo();
    U.baixarArquivo(`finck-backup-${U.hojeISO()}.json`, JSON.stringify(dados, null, 2));
    U.toast("Backup JSON gerado.", "sucesso");
  });
  document.getElementById("btnPDF").addEventListener("click", async () => {
    if (window.FinckGame) {
      await window.FinckGame.premiar("relatorio", {
        motivo: "relatório gerado",
        silencioso: true
      });
    }
    window.print();
  });
  filtroMes.addEventListener("change", render);
  render();
});
