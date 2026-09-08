document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const R = window.FinckReality;
  const embutido = document.body.dataset.page === "reality";
  const user = embutido ? await S.usuarioAtual() : await window.FinckNav.iniciarPagina({
    titulo: "Cálculos reais",
    subtitulo: "Registro do FinCK of Reality"
  });
  if (!user) {
    return;
  }
  const rotulo = id => cfg.DECISOES.find(d => d.id === id)?.label || "Sem decisão";
  const perfilAtual = await S.obterPerfil();
  document.getElementById("filtroCalculo").innerHTML = `<option value="">Todas</option><option value="sem">Sem decisão</option>` + cfg.DECISOES.map(d => `<option value="${d.id}">${d.label}</option>`).join("");
  let calculos = [];
  async function carregar() {
    calculos = await S.listar("purchase_analyses", {
      ordem: "created_at",
      asc: false
    });
    renderResumo();
    renderLista();
  }
  function renderResumo() {
    const r = R.resumoHistorico(calculos);
    const horas = calculos.reduce((s, a) => s + Number(a.work_hours || 0), 0);
    const total = calculos.reduce((s, a) => s + Number(a.price || 0), 0);
    document.getElementById("resumoCalculos").innerHTML = `\n      <article class="card-indicador"><span>Cálculos cadastrados</span><strong data-contador="${calculos.length}">${calculos.length}</strong></article>\n      <article class="card-indicador"><span>Valor analisado</span><strong>${U.moeda(total)}</strong></article>\n      <article class="card-indicador"><span>Tempo de trabalho avaliado</span><strong>${U.numero(horas, 1)} h</strong></article>\n      <article class="card-indicador"><span>Decisões conscientes</span><strong class="cor-verde">${r.evitadas}</strong></article>\n      <article class="card-indicador"><span>Valor potencial preservado</span><strong class="cor-verde">${U.moeda(r.valor_potencial)}</strong></article>`;
  }
  function filtrar() {
    const busca = document.getElementById("buscaCalculo").value.trim().toLowerCase();
    const dec = document.getElementById("filtroCalculo").value;
    const ordem = document.getElementById("ordemCalculo").value;
    let itens = calculos.filter(a => {
      const texto = `${a.item_name || ""} ${a.category || ""} ${a.note || ""}`.toLowerCase();
      const okBusca = !busca || texto.includes(busca);
      const okDec = !dec || (dec === "sem" ? !a.decision : a.decision === dec);
      return okBusca && okDec;
    });
    const data = a => new Date(a.analyzed_at || a.created_at).getTime() || 0;
    if (ordem === "antigos") {
      itens = itens.sort((a, b) => data(a) - data(b));
    } else if (ordem === "caros") {
      itens = itens.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (ordem === "horas") {
      itens = itens.sort((a, b) => Number(b.work_hours || 0) - Number(a.work_hours || 0));
    } else {
      itens = itens.sort((a, b) => data(b) - data(a));
    }
    return itens;
  }
  function rendaMudou(a) {
    const base = Number(a.income_base || 0);
    const hoje = Number(perfilAtual?.income_monthly || 0);
    return base > 0 && hoje > 0 && Math.abs(base - hoje) > .01;
  }
  function renderLista() {
    const itens = filtrar();
    const host = document.getElementById("listaCalculos");
    document.getElementById("vazioCalculos").hidden = itens.length > 0;
    host.innerHTML = itens.map(a => `\n      <article class="item-decisao impacto--${a.impact_level || "verde"}">\n        <div class="item-info">\n          <h4>${U.escapeHTML(a.item_name)}${a.item_link ? ` <a class="link-item" href="${U.escapeHTML(a.item_link)}" target="_blank" rel="noopener noreferrer" title="Abrir link do item">🔗</a>` : ""}</h4>\n          <small>${U.escapeHTML(a.category || "Outros")} · ${U.dataBR(a.analyzed_at || a.created_at)}</small>\n          <p class="tag-decisao">${a.decision ? U.escapeHTML(rotulo(a.decision)) : "Cálculo sem decisão"}</p>\n          <p class="tag-salario" title="Salário base usado neste cálculo">\n            Salário base na época: <strong>${U.moeda(a.income_base)}</strong>\n            ${rendaMudou(a) ? `<span class="selo-mudou">renda mudou</span>` : ""}\n          </p>\n        </div>\n        <div class="item-lado">\n          <strong>${U.moeda(a.price)}</strong>\n          <small>${U.numero(a.work_hours, 1)} h de trabalho</small>\n          <button type="button" class="btn-secundario btn-mini" data-detalhe="${a.id}">Detalhes</button>\n          <button type="button" class="btn-excluir-item" data-excluir="${a.id}" aria-label="Excluir cálculo">✕</button>\n        </div>\n      </article>`).join("");
    host.querySelectorAll("[data-detalhe]").forEach(b => b.addEventListener("click", () => abrirDetalhe(b.dataset.detalhe)));
    host.querySelectorAll("[data-excluir]").forEach(b => b.addEventListener("click", async () => {
      if (!await U.confirmar("Excluir este cálculo?", "Ele sai do seu registro de análises. Nenhum lançamento financeiro é afetado.", {
        confirmar: "Excluir"
      })) {
        return;
      }
      await S.remover("purchase_analyses", b.dataset.excluir);
      U.toast("Cálculo excluído.", "info");
      carregar();
    }));
  }
  function abrirDetalhe(id) {
    const a = calculos.find(x => String(x.id) === String(id));
    if (!a) {
      return;
    }
    const refl = a.reflections || {};
    document.getElementById("conteudoCalculo").innerHTML = `\n      <h4>Dados do cadastro</h4>\n      <ul class="lista-resumo">\n        <li><span>Item</span><strong>${U.escapeHTML(a.item_name)}</strong></li>\n        <li><span>Preço</span><strong>${U.moeda(a.price)}</strong></li>\n        <li><span>Categoria</span><strong>${U.escapeHTML(a.category || "Outros")}</strong></li>\n        <li><span>Data do cálculo</span><strong>${U.dataBR(a.analyzed_at || a.created_at)}</strong></li>\n        <li><span>Decisão</span><strong>${a.decision ? U.escapeHTML(rotulo(a.decision)) : "—"}</strong></li>\n        <li><span>Impacto</span><strong>${U.escapeHTML(a.impact_level || "—")}</strong></li>\n        ${a.item_link ? `<li><span>Link do item</span><strong><a href="${U.escapeHTML(a.item_link)}" target="_blank" rel="noopener noreferrer">Abrir link ↗</a></strong></li>` : ""}\n      </ul>\n\n      <h4>Realidade financeira usada</h4>\n      <ul class="lista-resumo lista-resumo--destaque">\n        <li><span>Salário base</span><strong>${U.moeda(a.income_base)}</strong></li>\n        <li><span>Tipo de renda</span><strong>${U.escapeHTML(a.income_type || "—")}</strong></li>\n        <li><span>Jornada</span><strong>${U.numero(a.work_days_month, 0)} dias · ${U.numero(a.work_hours_day, 1)} h/dia</strong></li>\n        <li><span>Valor da hora</span><strong>${U.moeda(a.hour_value)}</strong></li>\n        <li><span>Valor do dia</span><strong>${U.moeda(a.day_value)}</strong></li>\n        <li><span>Renda livre na época</span><strong>${U.moeda(a.free_income)}</strong></li>\n      </ul>\n      ${rendaMudou(a) ? `<p class="nota">Hoje seu salário base é ${U.moeda(perfilAtual?.income_monthly)}. Este cálculo foi feito com ${U.moeda(a.income_base)}.</p>` : ""}\n\n      <h4>Resultado</h4>\n      <ul class="lista-resumo">\n        <li><span>% da renda</span><strong>${U.percentual(a.income_percent)}</strong></li>\n        <li><span>Dias de trabalho</span><strong>${U.numero(a.work_days)} dias</strong></li>\n        <li><span>Horas de trabalho</span><strong>${U.numero(a.work_hours)} horas</strong></li>\n        <li><span>Saldo antes</span><strong>${U.moeda(a.balance_before)}</strong></li>\n        <li><span>Saldo depois</span><strong>${U.moeda(a.balance_after)}</strong></li>\n      </ul>\n      ${a.note ? `<p class="nota">Observação: ${U.escapeHTML(a.note)}</p>` : ""}\n\n      <h4>Reflexões</h4>\n      <ul class="lista-resumo">\n        ${cfg.REFLEXOES.map(q => `\n          <li><span>${U.escapeHTML(q.dimensao)}</span><strong>${U.escapeHTML(refl[q.id] || "—")}</strong></li>`).join("")}\n      </ul>`;
    U.abrirModal("modalCalculo");
  }
  function exportarCSV() {
    const linhas = [ [ "data", "item", "categoria", "preco", "salario_base", "tipo_renda", "dias_mes", "horas_dia", "valor_hora", "valor_dia", "percentual_renda", "dias_trabalho", "horas_trabalho", "impacto", "decisao", "observacao", "link" ] ];
    filtrar().forEach(a => linhas.push([ (a.analyzed_at || a.created_at || "").slice(0, 10), a.item_name, a.category, a.price, a.income_base, a.income_type, a.work_days_month, a.work_hours_day, a.hour_value, a.day_value, a.income_percent, a.work_days, a.work_hours, a.impact_level, a.decision || "", (a.note || "").replace(/[\r\n;]+/g, " "), a.item_link || "" ]));
    const csv = linhas.map(l => l.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([ `\ufeff${csv}` ], {
      type: "text/csv;charset=utf-8"
    }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `finck-calculos-${U.hojeISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    U.toast("CSV gerado.", "sucesso");
  }
  [ "buscaCalculo", "filtroCalculo", "ordemCalculo" ].forEach(id => document.getElementById(id).addEventListener("input", renderLista));
  document.getElementById("btnExportarCalculos").addEventListener("click", exportarCSV);
  window.FinckCalculos = {
    recarregar: carregar
  };
  carregar();
});
