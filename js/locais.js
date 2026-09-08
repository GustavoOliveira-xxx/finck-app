document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "Ações locais",
    subtitulo: "Onde a decisão vira ação"
  });
  if (!user) {
    return;
  }
  const $ = id => document.getElementById(id);
  const TIPOS = cfg.TIPOS_ACAO_LOCAL;
  const tipo = id => TIPOS.find(t => t.id === id) || TIPOS[0];
  let locais = [];
  let paraExcluir = null;
  $("localTipo").innerHTML = TIPOS.map(t => `<option value="${t.id}">${U.escapeHTML(t.rotulo)}</option>`).join("");
  $("filtroLocal").innerHTML = `<option value="">Todos os tipos</option>` + TIPOS.map(t => `<option value="${t.id}">${U.escapeHTML(t.rotulo)}</option>`).join("");
  async function carregar() {
    locais = await S.listar("local_actions", {
      ordem: "created_at",
      asc: false
    });
    render();
  }
  function render() {
    const filtro = $("filtroLocal").value;
    const lista = filtro ? locais.filter(l => l.kind === filtro) : locais;
    $("chipLocais").textContent = `${locais.length} ponto${locais.length === 1 ? "" : "s"}`;
    $("vazioLocais").hidden = lista.length > 0;
    $("listaLocais").innerHTML = lista.map(l => {
      const t = tipo(l.kind);
      return `
      <article class="item-transacao">
        <div class="item-info">
          <h4><span aria-hidden="true">${t.icone}</span> ${U.escapeHTML(l.name)}</h4>
          <small>${U.escapeHTML(t.rotulo)}${l.address ? ` · ${U.escapeHTML(l.address)}` : ""}</small>
          ${l.contact ? `<small class="cartao-conta__extra">${U.escapeHTML(l.contact)}</small>` : ""}
          ${l.notes ? `<small class="cartao-conta__extra">${U.escapeHTML(l.notes)}</small>` : ""}
        </div>
        <div class="item-lado">
          <small class="item-dia">${l.verified_at ? `conferido em ${U.dataBR(l.verified_at)}` : "sem data de conferência"}</small>
          <div class="acoes-card">
            <button type="button" class="btn-secundario btn-mini" data-editar="${l.id}">Editar</button>
            <button type="button" class="btn-excluir-item" data-excluir="${l.id}" aria-label="Excluir ${U.escapeHTML(l.name)}">✕</button>
          </div>
        </div>
      </article>`;
    }).join("");
    $("listaLocais").querySelectorAll("[data-editar]").forEach(b => b.addEventListener("click", () => abrir(b.dataset.editar)));
    $("listaLocais").querySelectorAll("[data-excluir]").forEach(b => b.addEventListener("click", () => pedirExclusao(b.dataset.excluir)));
  }
  function abrir(id) {
    const l = id ? locais.find(x => String(x.id) === String(id)) : null;
    $("tituloLocal").textContent = l ? "Editar ponto" : "Cadastrar um ponto";
    $("localId").value = l?.id || "";
    $("localNome").value = l?.name || "";
    $("localTipo").value = l?.kind || "reparo";
    $("localEndereco").value = l?.address || "";
    $("localContato").value = l?.contact || "";
    $("localNota").value = l?.notes || "";
    window.FinckData.escrever("localData", l?.verified_at ? String(l.verified_at).slice(0, 10) : U.hojeISO());
    U.abrirModal("modalLocal");
  }
  function pedirExclusao(id) {
    const l = locais.find(x => String(x.id) === String(id));
    if (!l) {
      return;
    }
    paraExcluir = l;
    $("textoConfirmarLocal").textContent = `"${l.name}" sai da sua rede. Isso não afeta nenhuma análise ou lançamento — é só o contato que deixa de ficar guardado.`;
    U.abrirModal("modalConfirmarLocal");
  }
  $("btnConfirmarExcluirLocal").addEventListener("click", async () => {
    if (!paraExcluir) {
      return;
    }
    await S.remover("local_actions", paraExcluir.id);
    paraExcluir = null;
    U.fecharModal("modalConfirmarLocal");
    U.toast("Ponto removido.", "info");
    carregar();
  });
  $("btnNovoLocal").addEventListener("click", () => abrir(null));
  $("filtroLocal").addEventListener("change", render);
  $("formLocal").addEventListener("submit", async e => {
    e.preventDefault();
    const nome = $("localNome").value.trim();
    if (!nome) {
      return U.toast("Dê um nome ao ponto.", "erro");
    }
    const campos = {
      name: nome,
      kind: $("localTipo").value,
      address: $("localEndereco").value.trim() || null,
      contact: $("localContato").value.trim() || null,
      notes: $("localNota").value.trim() || null,
      verified_at: window.FinckData.ler("localData") || null
    };
    const id = $("localId").value;
    if (id) {
      await S.atualizar("local_actions", id, campos);
    } else {
      await S.inserir("local_actions", campos);
    }
    U.fecharModal("modalLocal");
    U.toast(id ? "Ponto atualizado." : "Ponto cadastrado.", "sucesso");
    carregar();
  });
  carregar();
});
