

document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const R = window.FinckReality;
  const T = window.FinckTempo;
  const H = window.FinckHistorico;

  const user = await window.FinckNav.iniciarPagina({ titulo: "Relatórios", subtitulo: "Consolidação mensal" });
  if (!user) return;

  const ctx = await F.carregarContexto();
  const filtroMes = document.getElementById("filtroMes");
  filtroMes.value = U.mesAtual();

  const rotuloDecisao = (id) => cfg.DECISOES.find((d) => d.id === id)?.label || "Sem decisão";

  function dadosDoMes() {
    const mes = filtroMes.value || U.mesAtual();
    const transacoes = ctx.transacoes.filter((t) => String(t.date || "").slice(0, 7) === mes);
    const analises = ctx.analises.filter((a) => String(a.analyzed_at || a.created_at || "").slice(0, 7) === mes);
    return { mes, transacoes, analises };
  }

  function renderHistorico() {
    const mes = filtroMes.value || U.mesAtual();
    const p = H.panorama(ctx.transacoes, mes, 6);
    const comHistorico = p.linhas.filter((l) => l.temHistorico);

    document.getElementById("chipHistorico").textContent =
      `${comHistorico.length} de ${p.linhas.length} categoria(s)`;
    document.getElementById("vazioHistorico").hidden = comHistorico.length > 0;

    const destaque = document.getElementById("destaqueHistorico");
    if (!comHistorico.length) {
      destaque.innerHTML = "";
      document.getElementById("listaHistorico").innerHTML = "";
      return;
    }

    const topo = comHistorico[0];
    const obsGeral = H.observacao(p.geral);
    destaque.innerHTML = `
      <article class="destaque-historico destaque-historico--${H.tendencia(topo)}">
        <span class="destaque-historico__etiqueta">O que mais mudou</span>
        <h4>${U.escapeHTML(topo.categoria)}</h4>
        <p class="destaque-historico__valor">
          ${U.moeda(topo.atual)} ${T.selo(topo.atual, { classe: "selo-tempo--destaque" })}
        </p>
        <p class="destaque-historico__obs">${U.escapeHTML(H.observacao(topo) || "")}</p>
        ${obsGeral ? `<p class="destaque-historico__geral">No total do mês: ${U.escapeHTML(obsGeral)}</p>` : ""}
      </article>`;

    document.getElementById("listaHistorico").innerHTML = comHistorico.map((l) => `
      <article class="linha-historico linha-historico--${H.tendencia(l)}">
        <div class="linha-historico__topo">
          <strong>${U.escapeHTML(l.categoria)}</strong>
          <span class="linha-historico__atual">
            ${U.moeda(l.atual)} ${T.selo(l.atual)}
          </span>
        </div>
        <div class="linha-historico__barras" role="img"
             aria-label="${U.escapeHTML(l.categoria)}: ${l.serie.map((s) => `${s.rotulo} ${U.moeda(s.total)}`).join(", ")}">
          ${l.serie.map((s) => `
            <span class="mini-barra${s.atual ? " mini-barra--atual" : ""}"
                  style="--altura:${Math.max(3, (s.total / l.maior) * 100)}%"
                  title="${U.escapeHTML(s.rotulo)}: ${U.moeda(s.total)}">
              <em>${U.escapeHTML(s.rotulo)}</em>
            </span>`).join("")}
        </div>
        <p class="linha-historico__obs">
          ${U.escapeHTML(H.observacao(l) || "")}
          <span class="linha-historico__fatia">${U.percentual(l.fatia, 0)} das saídas do mês</span>
        </p>
      </article>`).join("");
  }

  function render() {
    renderHistorico();
    const { transacoes, analises } = dadosDoMes();
    const entradas = F.soma(transacoes.filter(F.ehEntrada));
    const saidas = F.soma(transacoes.filter(F.ehSaida));
    const resumo = R.resumoHistorico(analises);

    document.getElementById("resumoMes").innerHTML = `
      <article class="card-indicador"><span>Entradas</span><strong class="cor-verde">${U.moeda(entradas)}</strong></article>
      <article class="card-indicador"><span>Saídas</span><strong class="cor-vermelha">${U.moeda(saidas)}</strong></article>
      <article class="card-indicador"><span>Resultado</span><strong>${U.moeda(entradas - saidas)}</strong></article>
      <article class="card-indicador"><span>Movimentações</span><strong>${transacoes.length}</strong></article>`;

    document.getElementById("decisoesMes").innerHTML = analises.length
      ? `<ul class="lista-resumo">
           <li><span>Análises no mês</span><strong>${resumo.total}</strong></li>
           <li><span>Compras evitadas</span><strong class="cor-verde">${resumo.evitadas}</strong></li>
           <li><span>Economia consciente</span><strong class="cor-verde">${U.moeda(resumo.economia)}</strong></li>
           <li><span>Horas preservadas</span><strong>${U.numero(resumo.horas_preservadas, 1)} h</strong></li>
         </ul>
         <ul class="lista-simples">
           ${analises.map((a) => `
             <li class="item-lista">
               <span>${U.escapeHTML(a.item_name)}</span>
               <span>${U.escapeHTML(rotuloDecisao(a.decision))}</span>
               <strong>${U.moeda(a.price)}</strong>
             </li>`).join("")}
         </ul>`
      : `<p class="vazio">Nenhuma análise registrada neste mês.</p>`;

    const corpo = document.querySelector("#tabelaTransacoes tbody");
    document.getElementById("vazioRelatorio").hidden = transacoes.length > 0;
    corpo.innerHTML = transacoes.map((t) => `
      <tr>
        <td>${U.dataBR(t.date)}</td>
        <td>${U.escapeHTML(t.description)}</td>
        <td>${U.escapeHTML(t.category || "Outros")}</td>
        <td>${t.type === "entrada" ? "Entrada" : "Saída"}</td>
        <td class="${t.type === "entrada" ? "cor-verde" : "cor-vermelha"}">${U.moeda(t.amount)}</td>
      </tr>`).join("");

    document.querySelector("#tabelaMetas tbody").innerHTML = ctx.metas.length
      ? ctx.metas.map((m) => `
          <tr>
            <td>${U.escapeHTML(m.name)}</td>
            <td>${U.moeda(m.current_amount)}</td>
            <td>${U.moeda(m.target_amount)}</td>
            <td>${U.percentual(U.progresso(m.current_amount, m.target_amount), 0)}</td>
            <td>${m.deadline ? U.dataBR(m.deadline) : "—"}</td>
          </tr>`).join("")
      : `<tr><td colspan="5" class="vazio">Nenhuma meta cadastrada.</td></tr>`;
  }

  document.getElementById("btnCSV").addEventListener("click", () => {
    const { mes, transacoes } = dadosDoMes();
    const linhas = [["Data", "Descricao", "Categoria", "Tipo", "Valor"]].concat(
      transacoes.map((t) => [t.date, t.description, t.category || "Outros", t.type, String(t.amount).replace(".", ",")])
    );
    const csv = "\uFEFF" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    U.baixarArquivo(`finck-relatorio-${mes}.csv`, csv, "text/csv;charset=utf-8");
    U.toast("CSV exportado.", "sucesso");
  });

  document.getElementById("btnJSON").addEventListener("click", async () => {
    const dados = await S.exportarTudo();
    U.baixarArquivo(`finck-backup-${U.hojeISO()}.json`, JSON.stringify(dados, null, 2));
    U.toast("Backup JSON gerado.", "sucesso");
  });

  document.getElementById("btnPDF").addEventListener("click", async () => {
    if (window.FinckGame) await window.FinckGame.premiar("relatorio", { motivo: "relatório gerado", silencioso: true });
    window.print();
  });

  filtroMes.addEventListener("change", render);
  render();
});
