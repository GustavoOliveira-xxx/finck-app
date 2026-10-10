document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const R = window.FinckReality;
  const embutido = document.body.dataset.page === "reality";
  const user = embutido ? await S.usuarioAtual() : await window.FinckNav.iniciarPagina({
    titulo: "Minhas análises",
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
  // "Seu histórico" (FinckAbasReality.historicoHTML) conta o que passou
  // pela análise e o que foi decidido; os cartões trazem só o que ele não
  // mostra. O primeiro cartão leva o total em data-contador, que o CSS usa
  // para o estado sem análises.
  function renderResumo() {
    const r = R.resumoHistorico(calculos);
    const horas = calculos.reduce((s, a) => s + Number(a.work_hours || 0), 0);
    const host = document.getElementById("resumoDecisoes");
    if (host) {
      host.innerHTML = window.FinckAbasReality?.historicoHTML(calculos) || "";
    }
    document.getElementById("resumoCalculos").innerHTML = `
      <article class="card-indicador" data-contador="${calculos.length}"><span>Tempo de trabalho avaliado</span><strong>${U.numero(horas, 1)} h</strong></article>
      <article class="card-indicador"><span>Valor que você decidiu não gastar</span><strong class="cor-verde">${U.moeda(r.valor_potencial)}</strong></article>`;
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
      itens = itens.sort((a, b) => R.valorTotal(b) - R.valorTotal(a));
    } else if (ordem === "horas") {
      itens = itens.sort((a, b) => Number(b.work_hours || 0) - Number(a.work_hours || 0));
    } else {
      itens = itens.sort((a, b) => data(b) - data(a));
    }
    return itens;
  }
  // "Analisar de novo" preenche o formulário com item, preço e quantidade;
  // a pessoa confere e pede a análise com os números de hoje.
  function linkRepetir(a) {
    const p = new URLSearchParams({
      item: a.item_name || "",
      preco: String(Number(a.price) || "")
    });
    if (Number(a.quantity) > 1) {
      p.set("qtd", String(Math.floor(Number(a.quantity))));
    }
    return `reality.html?${p.toString()}`;
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
    host.innerHTML = itens.map(a => `\n      <article class="item-decisao impacto--${a.impact_level || "verde"}">\n        <div class="item-info">\n          <h4>${U.escapeHTML(a.item_name)}${U.urlHttpSegura(a.item_link) ? ` <a class="link-item" href="${U.escapeHTML(U.urlHttpSegura(a.item_link))}" target="_blank" rel="noopener noreferrer" title="Abrir link do item">🔗</a>` : ""}</h4>\n          <small>${U.escapeHTML(a.category || "Outros")} · ${U.dataBR(a.analyzed_at || a.created_at)}</small>\n          <p class="tag-decisao">${a.decision ? U.escapeHTML(rotulo(a.decision)) : "Análise sem decisão"}</p>\n          <p class="tag-salario" title="Salário base usado nesta análise">\n            Salário base na época: <strong>${U.moeda(a.income_base)}</strong>\n            ${rendaMudou(a) ? `<span class="selo-mudou">renda mudou</span>` : ""}\n          </p>\n        </div>\n        <div class="item-lado">\n          <strong>${U.moeda(R.valorTotal(a))}</strong>${Number(a.quantity) > 1 ? `\n          <small>${a.quantity} × ${U.moeda(a.price)}</small>` : ""}\n          <small>${U.numero(a.work_hours, 1)} h de trabalho</small>\n          <button type="button" class="btn-secundario btn-mini" data-detalhe="${a.id}">Detalhes</button>\n          <a class="btn-secundario btn-mini" href="${linkRepetir(a)}">Analisar de novo</a>\n          <button type="button" class="btn-excluir-item" data-excluir="${a.id}" aria-label="Excluir análise">✕</button>\n        </div>\n      </article>`).join("");
    host.querySelectorAll("[data-detalhe]").forEach(b => b.addEventListener("click", () => abrirDetalhe(b.dataset.detalhe)));
    host.querySelectorAll("[data-excluir]").forEach(b => b.addEventListener("click", async () => {
      if (!await U.confirmar("Excluir esta análise?", "Ela sai do seu registro de análises. Nenhum lançamento financeiro é afetado.", {
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
    const a = calculos.find(x => String(x.id) === String(id));
    if (!a) {
      return;
    }
    const refl = a.reflections || {};
    document.getElementById("conteudoCalculo").innerHTML = `\n      <h4>Dados da análise</h4>\n      <ul class="lista-resumo">\n        <li><span>Item</span><strong>${U.escapeHTML(a.item_name)}</strong></li>\n        <li><span>Preço</span><strong>${Number(a.quantity) > 1 ? `${a.quantity} × ${U.moeda(a.price)} = ${U.moeda(R.valorTotal(a))}` : U.moeda(a.price)}</strong></li>\n        <li><span>Categoria</span><strong>${U.escapeHTML(a.category || "Outros")}</strong></li>\n        <li><span>Data da análise</span><strong>${U.dataBR(a.analyzed_at || a.created_at)}</strong></li>\n        <li><span>Decisão</span><strong>${a.decision ? U.escapeHTML(rotulo(a.decision)) : "Sem decisão"}</strong></li>\n        <li><span>Impacto</span><strong>${U.escapeHTML(a.impact_level || "Não informado")}</strong></li>\n        ${a.item_link ? `<li><span>Link do item</span><strong>${U.urlHttpSegura(a.item_link) ? `<a href="${U.escapeHTML(U.urlHttpSegura(a.item_link))}" target="_blank" rel="noopener noreferrer">Abrir link ↗</a>` : `<span title="Endereço fora de http/https: não é aberto como link.">${U.escapeHTML(a.item_link)}</span>`}</strong></li>` : ""}\n      </ul>\n\n      <h4>Realidade financeira usada</h4>\n      <ul class="lista-resumo lista-resumo--destaque">\n        <li><span>Salário base</span><strong>${U.moeda(a.income_base)}</strong></li>\n        <li><span>Tipo de renda</span><strong>${U.escapeHTML(a.income_type || "Não informado")}</strong></li>\n        <li><span>Jornada</span><strong>${U.numero(a.work_days_month, 0)} dias · ${U.numero(a.work_hours_day, 1)} h/dia</strong></li>\n        <li><span>Valor da hora</span><strong>${U.moeda(a.hour_value)}</strong></li>\n        <li><span>Valor do dia</span><strong>${U.moeda(a.day_value)}</strong></li>\n        <li><span>Renda livre na época</span><strong>${U.moeda(a.free_income)}</strong></li>\n      </ul>\n      ${rendaMudou(a) ? `<p class="nota">Hoje seu salário base é ${U.moeda(perfilAtual?.income_monthly)}. Esta análise foi feita com ${U.moeda(a.income_base)}.</p>` : ""}\n\n      <h4>Resultado</h4>\n      <ul class="lista-resumo">\n        <li><span>% da renda</span><strong>${U.percentual(a.income_percent)}</strong></li>\n        <li><span>Dias de trabalho</span><strong>${U.numero(a.work_days)} dias</strong></li>\n        <li><span>Horas de trabalho</span><strong>${U.numero(a.work_hours)} horas</strong></li>\n        <li><span>Saldo antes</span><strong>${U.moeda(a.balance_before)}</strong></li>\n        <li><span>Saldo depois</span><strong>${U.moeda(a.balance_after)}</strong></li>\n      </ul>\n      ${a.note ? `<p class="nota">Observação: ${U.escapeHTML(a.note)}</p>` : ""}\n\n      <h4>Reflexões</h4>\n      <ul class="lista-resumo">\n        ${cfg.REFLEXOES.map(q => `\n          <li><span>${U.escapeHTML(q.dimensao)}</span><strong>${U.escapeHTML(refl[q.id] || "Sem resposta")}</strong></li>`).join("")}\n      </ul>`;
    U.abrirModal("modalCalculo");
  }
  function exportarCSV() {
    const linhas = [ [ "data", "item", "categoria", "preco", "quantidade", "salario_base", "tipo_renda", "dias_mes", "horas_dia", "valor_hora", "valor_dia", "percentual_renda", "dias_trabalho", "horas_trabalho", "impacto", "decisao", "observacao", "link" ] ];
    filtrar().forEach(a => linhas.push([ (a.analyzed_at || a.created_at || "").slice(0, 10), a.item_name, a.category, a.price, a.quantity || 1, a.income_base, a.income_type, a.work_days_month, a.work_hours_day, a.hour_value, a.day_value, a.income_percent, a.work_days, a.work_hours, a.impact_level, a.decision || "", (a.note || "").replace(/[\r\n;]+/g, " "), a.item_link || "" ]));
    const csv = linhas.map(l => l.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([ `\ufeff${csv}` ], {
      type: "text/csv;charset=utf-8"
    }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `finck-analises-${U.hojeISO()}.csv`;
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
