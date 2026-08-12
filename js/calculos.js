

document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const R = window.FinckReality;

  const embutido = document.body.dataset.page === "reality";
  const user = embutido
    ? await S.usuarioAtual()
    : await window.FinckNav.iniciarPagina({ titulo: "Cálculos reais", subtitulo: "Registro do FinCK of Reality" });
  if (!user) return;

  const rotulo = (id) => cfg.DECISOES.find((d) => d.id === id)?.label || "Sem decisão";
  const perfilAtual = await S.obterPerfil();

  document.getElementById("filtroCalculo").innerHTML =
    `<option value="">Todas</option><option value="sem">Sem decisão</option>` +
    cfg.DECISOES.map((d) => `<option value="${d.id}">${d.label}</option>`).join("");

  let calculos = [];

  async function carregar() {
    calculos = await S.listar("purchase_analyses", { ordem: "created_at", asc: false });
    renderResumo();
    renderLista();
  }

  function renderResumo() {
    const r = R.resumoHistorico(calculos);
    const horas = calculos.reduce((s, a) => s + Number(a.work_hours || 0), 0);
    const total = calculos.reduce((s, a) => s + Number(a.price || 0), 0);
    document.getElementById("resumoCalculos").innerHTML = `
      <article class="card-indicador"><span>Cálculos cadastrados</span><strong data-contador="${calculos.length}">${calculos.length}</strong></article>
      <article class="card-indicador"><span>Valor analisado</span><strong>${U.moeda(total)}</strong></article>
      <article class="card-indicador"><span>Tempo de trabalho avaliado</span><strong>${U.numero(horas, 1)} h</strong></article>
      <article class="card-indicador"><span>Compras evitadas</span><strong class="cor-verde">${r.evitadas}</strong></article>
      <article class="card-indicador"><span>Economia consciente</span><strong class="cor-verde">${U.moeda(r.economia)}</strong></article>`;
  }

  function filtrar() {
    const busca = document.getElementById("buscaCalculo").value.trim().toLowerCase();
    const dec = document.getElementById("filtroCalculo").value;
    const ordem = document.getElementById("ordemCalculo").value;

    let itens = calculos.filter((a) => {
      const texto = `${a.item_name || ""} ${a.category || ""} ${a.note || ""}`.toLowerCase();
      const okBusca = !busca || texto.includes(busca);
      const okDec = !dec || (dec === "sem" ? !a.decision : a.decision === dec);
      return okBusca && okDec;
    });

    const data = (a) => new Date(a.analyzed_at || a.created_at).getTime() || 0;
    if (ordem === "antigos") itens = itens.sort((a, b) => data(a) - data(b));
    else if (ordem === "caros") itens = itens.sort((a, b) => Number(b.price) - Number(a.price));
    else if (ordem === "horas") itens = itens.sort((a, b) => Number(b.work_hours || 0) - Number(a.work_hours || 0));
    else itens = itens.sort((a, b) => data(b) - data(a));
    return itens;
  }

  function rendaMudou(a) {
    const base = Number(a.income_base || 0);
    const hoje = Number(perfilAtual?.income_monthly || 0);
    return base > 0 && hoje > 0 && Math.abs(base - hoje) > 0.01;
  }

  function renderLista() {
    const itens = filtrar();
    const host = document.getElementById("listaCalculos");
    document.getElementById("vazioCalculos").hidden = itens.length > 0;

    host.innerHTML = itens.map((a) => `
      <article class="item-decisao impacto--${a.impact_level || "verde"}">
        <div class="item-info">
          <h4>${U.escapeHTML(a.item_name)}${a.item_link ? ` <a class="link-item" href="${U.escapeHTML(a.item_link)}" target="_blank" rel="noopener noreferrer" title="Abrir link do item">🔗</a>` : ""}</h4>
          <small>${U.escapeHTML(a.category || "Outros")} · ${U.dataBR(a.analyzed_at || a.created_at)}</small>
          <p class="tag-decisao">${a.decision ? U.escapeHTML(rotulo(a.decision)) : "Cálculo sem decisão"}</p>
          <p class="tag-salario" title="Salário base usado neste cálculo">
            Salário base na época: <strong>${U.moeda(a.income_base)}</strong>
            ${rendaMudou(a) ? `<span class="selo-mudou">renda mudou</span>` : ""}
          </p>
        </div>
        <div class="item-lado">
          <strong>${U.moeda(a.price)}</strong>
          <small>${U.numero(a.work_hours, 1)} h de trabalho</small>
          <button type="button" class="btn-secundario btn-mini" data-detalhe="${a.id}">Detalhes</button>
          <button type="button" class="btn-excluir-item" data-excluir="${a.id}" aria-label="Excluir cálculo">✕</button>
        </div>
      </article>`).join("");

    host.querySelectorAll("[data-detalhe]").forEach((b) =>
      b.addEventListener("click", () => abrirDetalhe(b.dataset.detalhe))
    );
    host.querySelectorAll("[data-excluir]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Excluir este cálculo do seu registro?")) return;
        await S.remover("purchase_analyses", b.dataset.excluir);
        U.toast("Cálculo excluído.", "info");
        carregar();
      })
    );
  }

  function abrirDetalhe(id) {
    const a = calculos.find((x) => String(x.id) === String(id));
    if (!a) return;
    const refl = a.reflections || {};
    document.getElementById("conteudoCalculo").innerHTML = `
      <h4>Dados do cadastro</h4>
      <ul class="lista-resumo">
        <li><span>Item</span><strong>${U.escapeHTML(a.item_name)}</strong></li>
        <li><span>Preço</span><strong>${U.moeda(a.price)}</strong></li>
        <li><span>Categoria</span><strong>${U.escapeHTML(a.category || "Outros")}</strong></li>
        <li><span>Data do cálculo</span><strong>${U.dataBR(a.analyzed_at || a.created_at)}</strong></li>
        <li><span>Decisão</span><strong>${a.decision ? U.escapeHTML(rotulo(a.decision)) : "—"}</strong></li>
        <li><span>Impacto</span><strong>${U.escapeHTML(a.impact_level || "—")}</strong></li>
        ${a.item_link ? `<li><span>Link do item</span><strong><a href="${U.escapeHTML(a.item_link)}" target="_blank" rel="noopener noreferrer">Abrir link ↗</a></strong></li>` : ""}
      </ul>

      <h4>Realidade financeira usada</h4>
      <ul class="lista-resumo lista-resumo--destaque">
        <li><span>Salário base</span><strong>${U.moeda(a.income_base)}</strong></li>
        <li><span>Tipo de renda</span><strong>${U.escapeHTML(a.income_type || "—")}</strong></li>
        <li><span>Jornada</span><strong>${U.numero(a.work_days_month, 0)} dias · ${U.numero(a.work_hours_day, 1)} h/dia</strong></li>
        <li><span>Valor da hora</span><strong>${U.moeda(a.hour_value)}</strong></li>
        <li><span>Valor do dia</span><strong>${U.moeda(a.day_value)}</strong></li>
        <li><span>Renda livre na época</span><strong>${U.moeda(a.free_income)}</strong></li>
      </ul>
      ${rendaMudou(a) ? `<p class="nota">Hoje seu salário base é ${U.moeda(perfilAtual?.income_monthly)}. Este cálculo foi feito com ${U.moeda(a.income_base)}.</p>` : ""}

      <h4>Resultado</h4>
      <ul class="lista-resumo">
        <li><span>% da renda</span><strong>${U.percentual(a.income_percent)}</strong></li>
        <li><span>Dias de trabalho</span><strong>${U.numero(a.work_days)} dias</strong></li>
        <li><span>Horas de trabalho</span><strong>${U.numero(a.work_hours)} horas</strong></li>
        <li><span>Saldo antes</span><strong>${U.moeda(a.balance_before)}</strong></li>
        <li><span>Saldo depois</span><strong>${U.moeda(a.balance_after)}</strong></li>
      </ul>
      ${a.note ? `<p class="nota">Observação: ${U.escapeHTML(a.note)}</p>` : ""}

      <h4>Reflexões</h4>
      <ul class="lista-resumo">
        ${cfg.REFLEXOES.map((q) => `
          <li><span>${U.escapeHTML(q.dimensao)}</span><strong>${U.escapeHTML(refl[q.id] || "—")}</strong></li>`).join("")}
      </ul>`;
    U.abrirModal("modalCalculo");
  }

  function exportarCSV() {
    const linhas = [[
      "data", "item", "categoria", "preco", "salario_base", "tipo_renda",
      "dias_mes", "horas_dia", "valor_hora", "valor_dia",
      "percentual_renda", "dias_trabalho", "horas_trabalho", "impacto", "decisao", "observacao", "link",
    ]];
    filtrar().forEach((a) => linhas.push([
      (a.analyzed_at || a.created_at || "").slice(0, 10),
      a.item_name, a.category, a.price, a.income_base, a.income_type,
      a.work_days_month, a.work_hours_day, a.hour_value, a.day_value,
      a.income_percent, a.work_days, a.work_hours, a.impact_level,
      a.decision || "", (a.note || "").replace(/[\r\n;]+/g, " "), a.item_link || "",
    ]));
    const csv = linhas.map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `finck-calculos-${U.hojeISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    U.toast("CSV gerado.", "sucesso");
  }

  ["buscaCalculo", "filtroCalculo", "ordemCalculo"].forEach((id) =>
    document.getElementById(id).addEventListener("input", renderLista)
  );
  document.getElementById("btnExportarCalculos").addEventListener("click", exportarCSV);

  window.FinckCalculos = { recarregar: carregar };
  carregar();
});
