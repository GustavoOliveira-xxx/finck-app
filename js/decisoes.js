

document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const R = window.FinckReality;

  const user = await window.FinckNav.iniciarPagina({ titulo: "Decisões", subtitulo: "Histórico consciente" });
  if (!user) return;

  const rotulo = (id) => cfg.DECISOES.find((d) => d.id === id)?.label || "Sem decisão";

  document.getElementById("filtroDecisao").innerHTML =
    `<option value="">Todas as decisões</option>` +
    cfg.DECISOES.map((d) => `<option value="${d.id}">${d.label}</option>`).join("");

  let analises = [];

  async function carregar() {
    analises = await S.listar("purchase_analyses", { ordem: "created_at", asc: false });
    renderResumo();
    renderLista();
  }

  function renderResumo() {
    const r = R.resumoHistorico(analises);
    document.getElementById("resumoDecisoes").innerHTML = `
      <article class="card-indicador"><span>Análises</span><strong>${r.total}</strong></article>
      <article class="card-indicador"><span>Compras evitadas</span><strong>${r.evitadas}</strong></article>
      <article class="card-indicador"><span>Economia consciente</span><strong class="cor-verde">${U.moeda(r.economia)}</strong></article>
      <article class="card-indicador"><span>Horas preservadas</span><strong>${U.numero(r.horas_preservadas, 1)} h</strong></article>
      <article class="card-indicador"><span>Taxa consciente</span><strong>${U.percentual(r.taxa_consciente, 0)}</strong></article>`;
  }

  function renderLista() {
    const filtro = document.getElementById("filtroDecisao").value;
    const itens = filtro ? analises.filter((a) => a.decision === filtro) : analises;
    const host = document.getElementById("listaDecisoes");
    document.getElementById("vazioDecisoes").hidden = itens.length > 0;

    host.innerHTML = itens.map((a) => `
      <article class="item-decisao impacto--${a.impact_level || "verde"}">
        <div class="item-info">
          <h4>${U.escapeHTML(a.item_name)}</h4>
          <small>${U.escapeHTML(a.category || "Outros")} · ${U.dataBR(a.analyzed_at || a.created_at)}</small>
          <p class="tag-decisao">${U.escapeHTML(rotulo(a.decision))}</p>
        </div>
        <div class="item-lado">
          <strong>${U.moeda(a.price)}</strong>
          <small>${U.numero(a.work_hours, 1)} h de trabalho</small>
          <button type="button" class="btn-secundario btn-mini" data-detalhe="${a.id}">Detalhes</button>
          <button type="button" class="btn-excluir-item" data-excluir="${a.id}" aria-label="Excluir análise">✕</button>
        </div>
      </article>`).join("");

    host.querySelectorAll("[data-detalhe]").forEach((b) =>
      b.addEventListener("click", () => abrirDetalhe(b.dataset.detalhe))
    );
    host.querySelectorAll("[data-excluir]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Excluir esta análise do histórico?")) return;
        await S.remover("purchase_analyses", b.dataset.excluir);
        U.toast("Análise excluída.", "info");
        carregar();
      })
    );
  }

  function abrirDetalhe(id) {
    const a = analises.find((x) => String(x.id) === String(id));
    if (!a) return;
    const refl = a.reflections || {};
    document.getElementById("conteudoDetalhe").innerHTML = `
      <ul class="lista-resumo">
        <li><span>Item</span><strong>${U.escapeHTML(a.item_name)}</strong></li>
        <li><span>Preço</span><strong>${U.moeda(a.price)}</strong></li>
        <li><span>Categoria</span><strong>${U.escapeHTML(a.category || "Outros")}</strong></li>
        <li><span>% da renda</span><strong>${U.percentual(a.income_percent)}</strong></li>
        <li><span>Dias de trabalho</span><strong>${U.numero(a.work_days)} dias</strong></li>
        <li><span>Horas de trabalho</span><strong>${U.numero(a.work_hours)} horas</strong></li>
        <li><span>Decisão</span><strong>${U.escapeHTML(rotulo(a.decision))}</strong></li>
        <li><span>Data</span><strong>${U.dataBR(a.analyzed_at || a.created_at)}</strong></li>
      </ul>
      ${a.note ? `<p class="nota">Observação: ${U.escapeHTML(a.note)}</p>` : ""}
      <h4>Reflexões</h4>
      <ul class="lista-resumo">
        ${cfg.REFLEXOES.map((q) => `
          <li><span>${U.escapeHTML(q.dimensao)}</span><strong>${U.escapeHTML(refl[q.id] || "—")}</strong></li>`).join("")}
      </ul>`;
    U.abrirModal("modalDetalhe");
  }

  document.getElementById("filtroDecisao").addEventListener("change", renderLista);
  carregar();
});
