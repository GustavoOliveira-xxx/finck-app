document.addEventListener("DOMContentLoaded", async () => {
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const T = window.FinckTempo;
  const F = window.FinckFinance;

  const user = await window.FinckNav.iniciarPagina({ titulo: "Recorrentes", subtitulo: "Previsão do mês" });
  if (!user) return;

  let itens = [];

  async function carregar() {
    itens = await S.listar("recurring_transactions", { ordem: "day_of_month", asc: true });
    render();
  }

  function render() {
    const ativos = itens.filter((i) => i.active !== false);
    const entradas = F.soma(ativos.filter((i) => i.type === "entrada"));
    const saidas = F.soma(ativos.filter((i) => i.type === "saida"));

    document.getElementById("resumoRecorrentes").innerHTML = `
      <article class="card-indicador"><span>Entradas previstas</span><strong class="cor-verde">${U.moeda(entradas)}</strong></article>
      <article class="card-indicador"><span>Despesas fixas</span><strong class="cor-vermelha">${U.moeda(saidas)}</strong></article>
      <article class="card-indicador"><span>Sobra prevista</span><strong>${U.moeda(entradas - saidas)}</strong></article>
      <article class="card-indicador"><span>Itens ativos</span><strong>${ativos.length}</strong></article>`;

    document.getElementById("vazioRecorrentes").hidden = itens.length > 0;
    const host = document.getElementById("listaRecorrentes");
    host.innerHTML = itens.map((i) => `
      <li class="item-lista ${i.active === false ? "inativo" : ""}">
        <span class="item-desc">${U.escapeHTML(i.description)}</span>
        <span class="item-dia">dia ${i.day_of_month}</span>
        <strong class="${i.type === "entrada" ? "cor-verde" : "cor-vermelha"}">
          ${i.type === "entrada" ? "+" : "−"} ${U.moeda(i.amount)}
        </strong>
        ${T.selo(i.amount, { classe: i.type === "entrada" ? "selo-tempo--entrada" : "" })}
        <label class="switch">
          <input type="checkbox" data-ativo="${i.id}" ${i.active === false ? "" : "checked"}>
          <span>${i.active === false ? "Pausado" : "Ativo"}</span>
        </label>
        <button type="button" class="btn-excluir-item" data-excluir="${i.id}" aria-label="Excluir">✕</button>
      </li>`).join("");

    host.querySelectorAll("[data-ativo]").forEach((c) =>
      c.addEventListener("change", async () => {
        await S.atualizar("recurring_transactions", c.dataset.ativo, { active: c.checked });
        carregar();
      })
    );
    host.querySelectorAll("[data-excluir]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Excluir este lançamento recorrente?")) return;
        await S.remover("recurring_transactions", b.dataset.excluir);
        U.toast("Recorrente excluído.", "info");
        carregar();
      })
    );
  }

  document.getElementById("formRecorrente").addEventListener("submit", async (e) => {
    e.preventDefault();
    const description = document.getElementById("recDescricao").value.trim();
    const amount = U.lerMoeda("recValor");
    const type = document.getElementById("recTipo").value;
    const day_of_month = Number(document.getElementById("recDia").value) || 1;
    if (!description) return U.toast("Informe a descrição.", "erro");
    if (!(amount > 0)) return U.toast("Informe um valor maior que zero.", "erro");

    try {
      await S.inserir("recurring_transactions", { description, amount, type, day_of_month, active: true });
      e.target.reset();
      document.getElementById("recDia").value = 10;
      U.toast("Recorrente adicionado.", "sucesso");
      carregar();
    } catch (err) { U.toast(err.message, "erro"); }
  });

  carregar();
});
