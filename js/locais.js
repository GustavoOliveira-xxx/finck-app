document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const IA = window.FinckIA;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "Alternativas perto de você",
    subtitulo: "Onde a decisão vira ação"
  });
  if (!user) {
    return;
  }
  const $ = id => document.getElementById(id);
  const TIPOS = cfg.TIPOS_ACAO_LOCAL;
  const tipo = id => TIPOS.find(t => t.id === id) || TIPOS[0];
  const MARCA_MAPS = `<span class="marca-maps" translate="no">Google Maps</span>`;
  let locais = [];
  let paraExcluir = null;
  let achados = [];
  let buscaFeita = null;
  let buscando = false;
  let iaPronta = null;
  $("localTipo").innerHTML = TIPOS.map(t => `<option value="${t.id}">${U.escapeHTML(t.rotulo)}</option>`).join("");
  $("filtroLocal").innerHTML = `<option value="">Todos os tipos</option>` + TIPOS.map(t => `<option value="${t.id}">${U.escapeHTML(t.rotulo)}</option>`).join("");
  async function carregar() {
    locais = await S.listar("local_actions", {
      ordem: "created_at",
      asc: false
    });
    render();
    if (achados.length) {
      mostrarLugares();
    }
  }
  // O link do Maps que o "Salvar na minha rede" guarda na observação vira
  // clicável; o resto continua texto.
  function comLinks(texto) {
    return String(texto).split(/(https?:\/\/\S+)/).map((parte, i) => {
      const url = i % 2 ? U.urlHttpSegura(parte) : null;
      if (!url) {
        return U.escapeHTML(parte);
      }
      const rotulo = /^https:\/\/(www\.)?google\.[a-z.]+\/maps|^https:\/\/maps\.google\./.test(url) ? `Abrir no ${MARCA_MAPS}` : U.escapeHTML(new URL(url).hostname);
      return `<a class="link-guardado" href="${U.escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${rotulo}</a>`;
    }).join("");
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
          ${l.contact ? `<small class="cartao-conta__extra">${comLinks(l.contact)}</small>` : ""}
          ${l.notes ? `<small class="cartao-conta__extra">${comLinks(l.notes)}</small>` : ""}
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
  // Sem id é cadastro novo; o rascunho vem do "Salvar na minha rede" e chega
  // sem data de conferência, porque ninguém conferiu o lugar ainda.
  function abrir(id, rascunho = null) {
    const existente = id ? locais.find(x => String(x.id) === String(id)) : null;
    const l = existente || rascunho;
    $("tituloLocal").textContent = existente ? "Editar ponto" : "Cadastrar um ponto";
    $("origemLocal").hidden = !rascunho;
    $("localId").value = existente?.id || "";
    $("localNome").value = l?.name || "";
    $("localTipo").value = l?.kind || "reparo";
    $("localEndereco").value = l?.address || "";
    $("localContato").value = l?.contact || "";
    $("localNota").value = l?.notes || "";
    window.FinckData.escrever("localData", existente?.verified_at ? String(existente.verified_at).slice(0, 10) : rascunho ? "" : U.hojeISO());
    U.abrirModal("modalLocal");
  }
  function pedirExclusao(id) {
    const l = locais.find(x => String(x.id) === String(id));
    if (!l) {
      return;
    }
    paraExcluir = l;
    $("textoConfirmarLocal").textContent = `"${l.name}" sai da sua rede. Isso não afeta nenhuma análise ou lançamento: é só o contato que deixa de ficar guardado.`;
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
  // Procurar perto de você: a rota da IA consulta o Google Maps e devolve só
  // lugares que vieram das fontes dele (api/buscar-preco-ia.js). O resultado
  // fica só na tela; entra na rede o que a pessoa salvar, com o nome que ela
  // confirmar e o link do lugar.
  const CHAVE_ONDE = "finck.locais.onde";
  // A mesma busca, aberta no próprio Google Maps: funciona sem conta, sem IA e
  // sem cota, e é a saída quando a busca aqui não traz nada.
  const TERMOS_MAPS = {
    reparo: item => item ? `conserto de ${item}` : "conserto e assistência técnica",
    usado: item => item ? `${item} usado` : "brechó",
    troca: item => item ? `troca de ${item}` : "feira de trocas",
    aluguel: item => item ? `aluguel de ${item}` : "aluguel de equipamentos",
    doacao: item => item ? `doação de ${item}` : "doação de roupas e objetos",
    descarte: item => item ? `descarte de ${item}` : "ecoponto"
  };
  function lerOnde() {
    try {
      return localStorage.getItem(CHAVE_ONDE) || "";
    } catch {
      return "";
    }
  }
  function lembrarOnde(onde) {
    try {
      localStorage.setItem(CHAVE_ONDE, onde);
    } catch {}
  }
  function pedidoAtual() {
    const marcado = document.querySelector('input[name="tipoProcurar"]:checked');
    return {
      tipo: marcado ? marcado.value : TIPOS[0].id,
      item: $("procurarItem").value.trim(),
      onde: $("procurarOnde").value.trim()
    };
  }
  function linkMaps(pedido) {
    const termo = (TERMOS_MAPS[pedido.tipo] || TERMOS_MAPS.reparo)(pedido.item);
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${termo} perto de ${pedido.onde || "mim"}`)}`;
  }
  function atualizarLinkMaps() {
    $("linkProcurarMaps").href = linkMaps(pedidoAtual());
  }
  // O placeId é o único dado do Maps que os termos deixam guardar. O link no
  // formato documentado do Maps (nome e placeId) abre o lugar com o endereço
  // e o horário de hoje; o nome só vale se o Maps não achar o placeId.
  function linkGuardado(l) {
    return l.placeId ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.nome)}&query_place_id=${encodeURIComponent(l.placeId)}` : U.urlHttpSegura(l.mapa) || "";
  }
  const jaNaRede = nome => locais.some(l => String(l.name || "").trim().toLowerCase() === String(nome).trim().toLowerCase().slice(0, 60));
  function cartaoLugar(l, i) {
    const mapa = U.urlHttpSegura(l.mapa);
    const site = U.urlHttpSegura(l.site);
    const nome = U.escapeHTML(l.nome);
    const telefone = String(l.telefone || "").replace(/[^\d+]/g, "");
    const meta = [];
    if (typeof l.nota === "number" && l.nota > 0) {
      meta.push(`<span><span class="lugar__nota">★ ${U.numero(l.nota, 1)}</span>${l.avaliacoes ? ` (${U.numero(l.avaliacoes, 0)} ${l.avaliacoes === 1 ? "avaliação" : "avaliações"})` : ""}</span>`);
    }
    if (telefone) {
      meta.push(`<a href="tel:${telefone}">${U.escapeHTML(l.telefone)}</a>`);
    }
    if (site) {
      meta.push(`<a href="${U.escapeHTML(site)}" target="_blank" rel="noopener noreferrer">Site</a>`);
    }
    return `
        <li class="lugar">
          <h4 class="lugar__nome">${mapa ? `<a href="${U.escapeHTML(mapa)}" target="_blank" rel="noopener">${nome}</a>` : nome}</h4>
          ${l.endereco ? `<p class="lugar__endereco">${U.escapeHTML(l.endereco)}</p>` : ""}
          ${meta.length ? `<p class="lugar__meta">${meta.join("")}</p>` : ""}
          <div class="lugar__acoes">
            ${mapa ? `<a class="btn-secundario btn-mini" href="${U.escapeHTML(mapa)}" target="_blank" rel="noopener">Abrir no ${MARCA_MAPS}</a>` : ""}
            ${jaNaRede(l.nome) ? `<span class="lugar__salvo">Já está na sua rede</span>` : `<button type="button" class="btn-secundario btn-mini" data-salvar="${i}">Salvar na minha rede</button>`}
          </div>
        </li>`;
  }
  function mostrarLugares() {
    const n = achados.length;
    $("resultadoProcurar").innerHTML = `
      <p class="procurar__fonte">${n} ${n === 1 ? "lugar" : "lugares"} perto de ${U.escapeHTML(buscaFeita.onde)} · Resultados do ${MARCA_MAPS}</p>
      <ul class="lugares">${achados.map(cartaoLugar).join("")}</ul>
      <p class="nota">Antes de ir, confira o horário e se o lugar faz o que você precisa.</p>`;
    $("resultadoProcurar").querySelectorAll("[data-salvar]").forEach(b => b.addEventListener("click", () => salvarAchado(Number(b.dataset.salvar))));
  }
  function mostrarAviso(pedido, r) {
    const repetir = [ "SEM_LUGARES", "IA_OCUPADA", "IA_FALHOU", "REDE" ].includes(r.codigo);
    $("resultadoProcurar").innerHTML = `
      <div class="procurar__aviso">
        <p>${U.escapeHTML(r.motivo || IA.MSG.rede)}</p>
        <div class="procurar__aviso-acoes">
          <a class="btn-secundario btn-mini" href="${U.escapeHTML(linkMaps(pedido))}" target="_blank" rel="noopener">Abrir no ${MARCA_MAPS}</a>
          ${repetir ? `<button type="button" class="btn-texto" data-repetir>Tentar de novo</button>` : ""}
        </div>
      </div>`;
    const b = $("resultadoProcurar").querySelector("[data-repetir]");
    if (b) {
      b.addEventListener("click", () => procurar(pedido));
    }
  }
  function carregandoBusca(sim) {
    buscando = sim;
    $("btnProcurar").classList.toggle("procurar--carregando", sim);
    $("btnProcurar").setAttribute("aria-busy", String(sim));
    $("btnProcurar").querySelector(".procurar__rotulo").textContent = sim ? "Procurando…" : "Procurar aqui";
  }
  async function procurar(pedido) {
    if (buscando) {
      return;
    }
    if (pedido.onde.length < 3) {
      $("procurarOnde").focus();
      return U.toast("Diga onde procurar: bairro e cidade, por exemplo.", "erro");
    }
    lembrarOnde(pedido.onde);
    carregandoBusca(true);
    $("resultadoProcurar").innerHTML = `
      <p class="procurar__carregando"><span class="procurar__giro" aria-hidden="true"></span> Procurando no ${MARCA_MAPS}…</p>`;
    const r = await IA.pedir({
      locais: pedido
    }) || {};
    carregandoBusca(false);
    if (r.ok && Array.isArray(r.lugares) && r.lugares.length) {
      achados = r.lugares;
      buscaFeita = pedido;
      mostrarLugares();
    } else {
      achados = [];
      buscaFeita = null;
      mostrarAviso(pedido, r);
    }
  }
  function salvarAchado(i) {
    const l = achados[i];
    if (!l || !buscaFeita) {
      return;
    }
    abrir(null, {
      name: String(l.nome).slice(0, 60),
      kind: buscaFeita.tipo,
      notes: linkGuardado(l)
    });
  }
  $("tiposProcurar").innerHTML = TIPOS.map((t, i) => `
          <label class="chip"><input type="radio" name="tipoProcurar" value="${t.id}"${i === 0 ? " checked" : ""}><span aria-hidden="true">${t.icone}</span>${U.escapeHTML(t.rotulo)}</label>`).join("");
  // Vindo do FinCK of Reality: locais.html?tipo=reparo&item=celular#procurar
  const params = new URLSearchParams(location.search);
  const veioDoReality = TIPOS.some(t => t.id === params.get("tipo"));
  if (veioDoReality) {
    document.querySelector(`input[name="tipoProcurar"][value="${params.get("tipo")}"]`).checked = true;
    $("procurarItem").value = String(params.get("item") || "").trim().slice(0, 60);
  }
  $("procurarOnde").value = lerOnde();
  atualizarLinkMaps();
  $("formProcurar").addEventListener("input", atualizarLinkMaps);
  $("formProcurar").addEventListener("change", atualizarLinkMaps);
  $("linkProcurarMaps").addEventListener("click", () => {
    atualizarLinkMaps();
    const onde = $("procurarOnde").value.trim();
    if (onde.length >= 3) {
      lembrarOnde(onde);
    }
  });
  $("formProcurar").addEventListener("submit", e => {
    e.preventDefault();
    if (iaPronta === false) {
      $("linkProcurarMaps").click();
      return;
    }
    procurar(pedidoAtual());
  });
  // A rede falhar não pode levar a busca junto.
  await carregar().catch(() => U.toast("Não consegui carregar a sua rede agora. Recarregue a página para tentar de novo.", "erro"));
  // Sem IA aqui (demonstração, servidor sem chave), a busca segue pelo link
  // do Google Maps, que vira o botão principal.
  const disponivel = IA ? await IA.disponivel() : {
    ok: false,
    motivo: "Os recursos de IA não estão disponíveis neste servidor."
  };
  iaPronta = disponivel.ok;
  if (!disponivel.ok) {
    $("btnProcurar").hidden = true;
    $("linkProcurarMaps").className = "btn-primario";
    $("notaProcurar").innerHTML = `${U.escapeHTML(disponivel.motivo)} Enquanto isso, o botão abre a mesma busca direto no ${MARCA_MAPS}.`;
  }
  if (veioDoReality) {
    $("procurar").scrollIntoView({
      block: "start"
    });
    if (iaPronta && $("procurarOnde").value.trim().length >= 3) {
      procurar(pedidoAtual());
    } else {
      $("procurarOnde").focus({
        preventScroll: true
      });
    }
  }
});
