document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const T = window.FinckTempo;
  const F = window.FinckFinance;
  const O = window.FinckOcorrencias;

  const user = await window.FinckNav.iniciarPagina({ titulo: "Recorrentes", subtitulo: "Previsão do mês" });
  if (!user) return;

  const OCORRENCIAS = "recurring_occurrences";
  const $ = (id) => document.getElementById(id);

  let itens = [];
  let contas = [];
  let editando = null;

  document.getElementById("recCategoria").innerHTML =
    cfg.CATEGORIAS.map((c) => `<option value="${c}">${c}</option>`).join("");

  async function carregar() {
    [itens, contas] = await Promise.all([
      S.listar("recurring_transactions", { ordem: "day_of_month", asc: true }),
      S.listar("accounts"),
    ]);

    $("recConta").innerHTML =
      `<option value="">Sem conta — só no saldo geral</option>` +
      contas.filter((c) => c.active !== false)
        .map((c) => `<option value="${c.id}">${U.escapeHTML(c.name)}</option>`).join("");

    render();
  }

  const nomeConta = (id) =>
    contas.find((c) => String(c.id) === String(id))?.name || null;

  function render() {
    const ativos = itens.filter((i) => i.active !== false);
    const entradas = F.soma(ativos.filter((i) => i.type === "entrada"));
    const saidas = F.soma(ativos.filter((i) => i.type === "saida"));

    $("resumoRecorrentes").innerHTML = `
      <article class="card-indicador"><span>Entradas previstas</span><strong class="cor-verde">${U.moeda(entradas)}</strong></article>
      <article class="card-indicador"><span>Despesas fixas</span><strong class="cor-vermelha">${U.moeda(saidas)}</strong></article>
      <article class="card-indicador"><span>Sobra prevista</span><strong class="${entradas - saidas < 0 ? "cor-vermelha" : ""}">${U.moeda(entradas - saidas)}</strong></article>
      <article class="card-indicador"><span>Itens ativos</span><strong>${ativos.length}</strong></article>`;

    $("vazioRecorrentes").hidden = itens.length > 0;
    const host = $("listaRecorrentes");
    host.innerHTML = itens.map((i) => {
      const conta = nomeConta(i.account_id);
      const detalhes = [
        `dia ${i.day_of_month}`,
        i.type === "saida" ? (i.category || "sem categoria") : null,
        conta || "sem conta",
      ].filter(Boolean).join(" · ");

      return `
      <li class="item-lista ${i.active === false ? "inativo" : ""}">
        <span class="item-desc">${U.escapeHTML(i.description)}</span>
        <span class="item-dia">${U.escapeHTML(detalhes)}</span>
        <strong class="${i.type === "entrada" ? "cor-verde" : "cor-vermelha"}">
          ${i.type === "entrada" ? "+" : "−"} ${U.moeda(i.amount)}
        </strong>
        ${T.selo(i.amount, { classe: i.type === "entrada" ? "selo-tempo--entrada" : "" })}
        <label class="switch">
          <input type="checkbox" data-ativo="${i.id}" ${i.active === false ? "" : "checked"}>
          <span>${i.active === false ? "Pausado" : "Ativo"}</span>
        </label>
        <button type="button" class="btn-secundario btn-mini" data-editar="${i.id}">Editar</button>
        <button type="button" class="btn-excluir-item" data-excluir="${i.id}" aria-label="Excluir">✕</button>
      </li>`;
    }).join("");

    host.querySelectorAll("[data-ativo]").forEach((c) =>
      c.addEventListener("change", async () => {
        await S.atualizar("recurring_transactions", c.dataset.ativo, { active: c.checked });
        carregar();
      })
    );
    host.querySelectorAll("[data-editar]").forEach((b) =>
      b.addEventListener("click", () => abrirEdicao(b.dataset.editar))
    );
    host.querySelectorAll("[data-excluir]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Excluir este lançamento recorrente? Os meses já confirmados continuam no histórico.")) return;
        await S.remover("recurring_transactions", b.dataset.excluir);
        await limparPrevisoes(b.dataset.excluir);
        U.toast("Recorrente excluído.", "info");
        carregar();
      })
    );
  }

  async function limparPrevisoes(recurringId) {
    const abertas = await ocorrenciasAbertas(recurringId);
    for (const oc of abertas) await S.remover(OCORRENCIAS, oc.id);
  }

  async function ocorrenciasAbertas(recurringId) {
    const todas = await S.listar(OCORRENCIAS, { filtro: { recurring_id: recurringId } });
    return todas.filter((o) => O.ABERTOS.includes(o.status));
  }

  const refletirCategoria = () => {
    $("campoRecCategoria").hidden = $("recTipo").value === "entrada";
  };
  $("recTipo").addEventListener("change", refletirCategoria);

  function limparFormulario() {
    editando = null;
    $("recId").value = "";
    $("formRecorrente").reset();
    U.limparMoeda("recValor");
    $("recDia").value = 10;
    $("tituloFormRecorrente").textContent = "Novo recorrente";
    $("btnSalvarRecorrente").textContent = "Adicionar";
    $("btnCancelarRecorrente").hidden = true;
    refletirCategoria();
  }

  function abrirEdicao(id) {
    const r = itens.find((x) => String(x.id) === String(id));
    if (!r) return;
    editando = r;
    $("recId").value = r.id;
    $("recDescricao").value = r.description || "";
    $("recTipo").value = r.type;
    U.escreverMoeda("recValor", r.amount || 0);
    $("recDia").value = r.day_of_month || 1;
    $("recCategoria").value = r.category || cfg.CATEGORIAS[0];
    $("recConta").value = r.account_id || "";
    $("tituloFormRecorrente").textContent = "Editar recorrente";
    $("btnSalvarRecorrente").textContent = "Salvar alterações";
    $("btnCancelarRecorrente").hidden = false;
    $("recDescricao").focus();
    refletirCategoria();
  }

  $("btnCancelarRecorrente").addEventListener("click", limparFormulario);

  function perguntarPropagacao(quantas, resumo) {
    return new Promise((resolver) => {
      $("textoPropagar").textContent =
        `${quantas} ${quantas === 1 ? "mês ainda não foi revisado" : "meses ainda não foram revisados"} e ${quantas === 1 ? "guarda" : "guardam"} o valor antigo (${resumo}).`;

      const modal = $("modalPropagar");
      let respondido = false;

      const escolher = (valor) => {
        if (respondido) return;
        respondido = true;
        modal.querySelectorAll("[data-propagar]").forEach((b) => b.replaceWith(b.cloneNode(true)));
        observador.disconnect();
        U.fecharModal("modalPropagar");
        resolver(valor);
      };

      // Fechar no ✕, no Esc ou clicando fora vale como "não propagar":
      // a regra já foi salva, o que fica em aberto é só o passado congelado.
      const observador = new MutationObserver(() => {
        if (modal.hidden) escolher("futuras");
      });
      observador.observe(modal, { attributes: true, attributeFilter: ["hidden"] });

      modal.querySelectorAll("[data-propagar]").forEach((b) =>
        b.addEventListener("click", () => escolher(b.dataset.propagar), { once: true })
      );
      U.abrirModal("modalPropagar");
    });
  }

  async function propagarParaAbertas(regra, abertas) {
    for (const oc of abertas) {
      await S.atualizar(OCORRENCIAS, oc.id, {
        description: regra.description,
        type: regra.type,
        planned_amount: Number(regra.amount),
        category: regra.type === "saida" ? (regra.category || "Outros") : null,
        account_id: regra.account_id || null,
        due_date: O.iso(O.dataDoCiclo(oc.cycle, regra.day_of_month)),
      });
    }
  }

  $("formRecorrente").addEventListener("submit", async (e) => {
    e.preventDefault();
    const description = $("recDescricao").value.trim();
    const amount = U.lerMoeda("recValor");
    const type = $("recTipo").value;
    const day_of_month = Number($("recDia").value) || 1;
    const category = type === "saida" ? $("recCategoria").value : null;
    const account_id = $("recConta").value || null;

    if (!description) return U.toast("Informe a descrição.", "erro");
    if (!(amount > 0)) return U.toast("Informe um valor maior que zero.", "erro");
    if (day_of_month < 1 || day_of_month > 31) return U.toast("O dia precisa estar entre 1 e 31.", "erro");

    const dados = { description, amount, type, day_of_month, category, account_id };

    try {
      if (editando) {
        const regra = { ...editando, ...dados };
        const abertas = await ocorrenciasAbertas(editando.id);
        await S.atualizar("recurring_transactions", editando.id, dados);

        if (abertas.length) {
          const escolha = await perguntarPropagacao(
            abertas.length, `previsto de ${U.moeda(editando.amount)}`);
          if (escolha === "abertas") await propagarParaAbertas(regra, abertas);
        }
        U.toast("Recorrente atualizado.", "sucesso");
      } else {
        await S.inserir("recurring_transactions", { ...dados, active: true });
        U.toast("Recorrente adicionado.", "sucesso");
      }
      limparFormulario();
      carregar();
    } catch (err) { U.toast(err.message, "erro"); }
  });

  refletirCategoria();
  carregar();
});
