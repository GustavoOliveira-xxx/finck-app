document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const R = window.FinckReality;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "Decisões",
    subtitulo: "Histórico consciente"
  });
  if (!user) {
    return;
  }
  const rotulo = id => cfg.DECISOES.find(d => d.id === id)?.label || "Sem decisão";
  document.getElementById("filtroDecisao").innerHTML = `<option value="">Todas as decisões</option>` + cfg.DECISOES.map(d => `<option value="${d.id}">${d.label}</option>`).join("");
  let analises = [];
  async function carregar() {
    analises = await S.listar("purchase_analyses", {
      ordem: "created_at",
      asc: false
    });
    renderResumo();
    renderAcompanhar();
    renderLista();
  }
  const rotuloAcompanhamento = id => cfg.ACOMPANHAMENTO.find(a => a.id === id)?.label || null;
  function renderResumo() {
    const r = R.resumoHistorico(analises);
    document.getElementById("resumoDecisoes").innerHTML = `\n      <article class="card-indicador"><span>Análises registradas</span><strong>${r.total}</strong></article>\n      <article class="card-indicador"><span>Decisões conscientes</span><strong>${r.evitadas}</strong></article>\n      <article class="card-indicador"><span>Valor potencial preservado</span><strong class="cor-verde">${U.moeda(r.valor_potencial)}</strong></article>\n      <article class="card-indicador"><span>Economia confirmada</span><strong class="cor-verde">${U.moeda(r.economia_confirmada)}</strong></article>\n      <article class="card-indicador"><span>Horas de trabalho equivalentes</span><strong>${U.numero(r.horas_preservadas, 1)} h</strong></article>\n      ${r.indicador_medio !== null ? `<article class="card-indicador"><span>Indicador de decisão responsável</span><strong>${r.indicador_medio}/100</strong></article>` : ""}`;
    document.getElementById("notaDecisoes").innerHTML = `Valor potencial preservado é o preço que deixou de sair no momento da decisão — você pode comprar depois, pagar outro preço ou gastar em um substituto. Ele vira <strong>economia confirmada</strong> só quando você registra o acompanhamento. O FinCK não mede resultado ambiental: ele registra escolhas e reflexões.`;
  }
  function renderAcompanhar() {
    const pendentes = R.paraAcompanhar(analises);
    const bloco = document.getElementById("blocoAcompanhar");
    bloco.hidden = pendentes.length === 0;
    document.getElementById("chipAcompanhar").textContent = `${pendentes.length} para revisar`;
    const opcoes = cfg.ACOMPANHAMENTO.map(o => `<option value="${o.id}">${U.escapeHTML(o.label)}</option>`).join("");
    document.getElementById("listaAcompanhar").innerHTML = pendentes.map(a => `\n      <article class="item-decisao">\n        <div class="item-info">\n          <h4>${U.escapeHTML(a.item_name)}</h4>\n          <small>${U.escapeHTML(rotulo(a.decision))} · ${U.dataBR(a.analyzed_at || a.created_at)}</small>\n        </div>\n        <div class="item-lado">\n          <strong>${U.moeda(a.price)}</strong>\n          <select class="select-mini" data-acompanhar="${a.id}" aria-label="Resultado de ${U.escapeHTML(a.item_name)}">\n            <option value="">O que aconteceu?</option>${opcoes}\n          </select>\n        </div>\n      </article>`).join("");
    document.getElementById("listaAcompanhar").querySelectorAll("[data-acompanhar]").forEach(sel => sel.addEventListener("change", async () => {
      if (!sel.value) {
        return;
      }
      await S.atualizar("purchase_analyses", sel.dataset.acompanhar, {
        outcome: sel.value,
        outcome_at: (new Date).toISOString()
      });
      U.toast("Acompanhamento registrado. Obrigado pela honestidade.", "sucesso");
      carregar();
    }));
  }
  function renderLista() {
    const filtro = document.getElementById("filtroDecisao").value;
    const itens = filtro ? analises.filter(a => a.decision === filtro) : analises;
    const host = document.getElementById("listaDecisoes");
    document.getElementById("vazioDecisoes").hidden = itens.length > 0;
    host.innerHTML = itens.map(a => `\n      <article class="item-decisao impacto--${a.impact_level || "verde"}">\n        <div class="item-info">\n          <h4>${U.escapeHTML(a.item_name)}</h4>\n          <small>${U.escapeHTML(a.category || "Outros")} · ${U.dataBR(a.analyzed_at || a.created_at)}</small>\n          <p class="tag-decisao">${U.escapeHTML(rotulo(a.decision))}</p>\n          ${a.outcome ? `<p class="tag-acompanhamento">Depois: ${U.escapeHTML(rotuloAcompanhamento(a.outcome) || a.outcome)}</p>` : ""}\n        </div>\n        <div class="item-lado">\n          <strong>${U.moeda(a.price)}</strong>\n          <small>${U.numero(a.work_hours, 1)} h de trabalho</small>\n          <button type="button" class="btn-secundario btn-mini" data-detalhe="${a.id}">Detalhes</button>\n          <button type="button" class="btn-excluir-item" data-excluir="${a.id}" aria-label="Excluir análise">✕</button>\n        </div>\n      </article>`).join("");
    host.querySelectorAll("[data-detalhe]").forEach(b => b.addEventListener("click", () => abrirDetalhe(b.dataset.detalhe)));
    host.querySelectorAll("[data-excluir]").forEach(b => b.addEventListener("click", async () => {
      if (!await U.confirmar("Excluir esta análise?", "Ela sai do histórico de decisões conscientes e deixa de contar no valor potencial preservado.", {
        confirmar: "Excluir"
      })) {
        return;
      }
      await S.remover("purchase_analyses", b.dataset.excluir);
      U.toast("Análise excluída.", "info");
      carregar();
    }));
  }
  function abrirDetalhe(id) {
    const a = analises.find(x => String(x.id) === String(id));
    if (!a) {
      return;
    }
    const refl = a.reflections || {};
    const ind = R.indicadorResponsavel(refl);
    document.getElementById("conteudoDetalhe").innerHTML = `\n      <ul class="lista-resumo">\n        <li><span>Item</span><strong>${U.escapeHTML(a.item_name)}</strong></li>\n        <li><span>Preço</span><strong>${U.moeda(a.price)}</strong></li>\n        <li><span>Categoria</span><strong>${U.escapeHTML(a.category || "Outros")}</strong></li>\n        <li><span>% da renda</span><strong>${U.percentual(a.income_percent)}</strong></li>\n        <li><span>Dias de trabalho</span><strong>${U.numero(a.work_days)} dias</strong></li>\n        <li><span>Horas de trabalho</span><strong>${U.numero(a.work_hours)} horas</strong></li>\n        <li><span>Decisão</span><strong>${U.escapeHTML(rotulo(a.decision))}</strong></li>\n        <li><span>Data</span><strong>${U.dataBR(a.analyzed_at || a.created_at)}</strong></li>\n        ${a.outcome ? `<li><span>Resultado depois</span><strong>${U.escapeHTML(rotuloAcompanhamento(a.outcome) || a.outcome)}</strong></li>` : ""}\n      </ul>\n      ${a.note ? `<p class="nota">Observação: ${U.escapeHTML(a.note)}</p>` : ""}\n      <h4>Reflexões</h4>\n      <ul class="lista-resumo">\n        ${cfg.REFLEXOES.map(q => `\n          <li><span>${U.escapeHTML(q.dimensao)}</span><strong>${U.escapeHTML(refl[q.id] || "—")}</strong></li>`).join("")}\n      </ul>\n      ${ind.pontuacao !== null ? `\n        <h4>Indicador de decisão responsável</h4>\n        <p class="indicador-responsavel indicador-responsavel--${ind.nivel}">\n          <strong>${ind.pontuacao}/100 · ${U.escapeHTML(ind.rotulo)}</strong>\n        </p>\n        <p class="nota">${U.escapeHTML(ind.sintese)}</p>\n        <ul class="lista-resumo">\n          ${ind.criterios.filter(c => c.respondida).map(c => `<li><span>${U.escapeHTML(c.dimensao)}</span><strong>${c.pontos}/2</strong></li>`).join("")}\n        </ul>\n        ${ind.alertas.length ? `<ul class="lista-simples">${ind.alertas.map(al => `<li>${U.escapeHTML(al.texto)}</li>`).join("")}</ul>` : ""}\n        <p class="nota">${U.escapeHTML(ind.limitacao)}</p>` : ""}`;
    U.abrirModal("modalDetalhe");
  }
  document.getElementById("filtroDecisao").addEventListener("change", renderLista);
  carregar();
});
