window.FinckUtils = (() => {
  const cfg = window.FINCK_CONFIG;
  const moeda = valor => Number(valor || 0).toLocaleString(cfg.LOCALE, {
    style: "currency",
    currency: cfg.MOEDA,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const numero = (valor, casas = 2) => Number(valor || 0).toLocaleString(cfg.LOCALE, {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
  const percentual = (valor, casas = 2) => `${numero(valor, casas)}%`;
  const dataBR = iso => {
    if (!iso) {
      return "—";
    }
    const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(cfg.LOCALE);
  };
  const doisDigitos = n => String(n).padStart(2, "0");
  const dataISO = (valor = new Date) => {
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) {
      return "";
    }
    return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
  };
  const mesISO = (valor = new Date) => dataISO(valor).slice(0, 7);
  const hojeISO = () => dataISO();
  const mesAtual = () => mesISO();
  const uid = () => crypto.randomUUID && crypto.randomUUID() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const escapeHTML = txt => String(txt ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
  function toast(mensagem, tipo = "info", ms = 3200) {
    let host = document.getElementById("finckToastHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "finckToastHost";
      host.className = "finck-toast-host";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = `finck-toast finck-toast--${tipo}`;
    el.setAttribute("role", "status");
    el.textContent = mensagem;
    host.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }
  const focoAnterior = new Map;
  // Pilha dos modais abertos. Esc fecha só o de cima, e o Tab fica
  // preso dentro dele: sem isso o teclado escapava para a página de trás.
  const pilhaModais = [];
  const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const focaveisDe = el => [ ...el.querySelectorAll(FOCAVEIS) ].filter(f => !f.closest("[hidden]") && f.offsetParent !== null);
  function prenderFoco(e) {
    if (e.key !== "Tab" || !pilhaModais.length) {
      return;
    }
    const topo = document.getElementById(pilhaModais[pilhaModais.length - 1]);
    if (!topo || topo.hidden) {
      return;
    }
    const lista = focaveisDe(topo);
    if (!lista.length) {
      e.preventDefault();
      return;
    }
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    if (!topo.contains(document.activeElement)) {
      e.preventDefault();
      primeiro.focus();
    } else if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }
  if (typeof document !== "undefined") {
    document.addEventListener("keydown", prenderFoco);
  }
  const modalDoTopo = () => pilhaModais.length ? pilhaModais[pilhaModais.length - 1] : null;
  const abrirModal = id => {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    focoAnterior.set(id, document.activeElement);
    el.hidden = false;
    const i = pilhaModais.indexOf(id);
    if (i >= 0) {
      pilhaModais.splice(i, 1);
    }
    pilhaModais.push(id);
    document.body.classList.add("modal-aberto");
    requestAnimationFrame(() => {
      const foco = el.querySelector('[autofocus]') || focaveisDe(el).find(f => !f.classList.contains("fechar")) || focaveisDe(el)[0];
      if (foco) {
        foco.focus();
      } else {
        el.setAttribute("tabindex", "-1");
        el.focus();
      }
    });
  };
  const fecharModal = id => {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    el.hidden = true;
    const i = pilhaModais.indexOf(id);
    if (i >= 0) {
      pilhaModais.splice(i, 1);
    }
    if (!document.querySelector(".modal-overlay:not([hidden])")) {
      document.body.classList.remove("modal-aberto");
    }
    const anterior = focoAnterior.get(id);
    if (anterior?.isConnected) {
      anterior.focus();
    }
    focoAnterior.delete(id);
  };
  // Erro de campo fica junto do campo, não só no toast: a mensagem é
  // ligada ao input por aria-describedby e o foco vai para quem precisa de ajuste.
  function erroCampo(alvo, mensagem) {
    const campo = typeof alvo === "string" ? document.getElementById(alvo) : alvo;
    if (!campo) {
      toast(mensagem, "erro");
      return false;
    }
    const idErro = `${campo.id || uid()}Erro`;
    let aviso = document.getElementById(idErro);
    if (!aviso) {
      aviso = document.createElement("small");
      aviso.id = idErro;
      aviso.className = "erro-campo";
      aviso.setAttribute("role", "alert");
      const ancora = campo.closest(".campo-com-icone") || campo;
      ancora.insertAdjacentElement("afterend", aviso);
    }
    aviso.textContent = mensagem;
    campo.setAttribute("aria-invalid", "true");
    const ligados = (campo.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
    if (!ligados.includes(idErro)) {
      campo.setAttribute("aria-describedby", [ idErro, ...ligados ].join(" "));
    }
    campo.focus();
    const limpar = () => {
      aviso.remove();
      campo.removeAttribute("aria-invalid");
      const resto = (campo.getAttribute("aria-describedby") || "").split(/\s+/).filter(x => x && x !== idErro);
      resto.length ? campo.setAttribute("aria-describedby", resto.join(" ")) : campo.removeAttribute("aria-describedby");
      campo.removeEventListener("input", limpar);
      campo.removeEventListener("change", limpar);
    };
    campo.addEventListener("input", limpar);
    campo.addEventListener("change", limpar);
    return false;
  }
  // Confirm/prompt nativos quebram a identidade visual e ficam ruins no
  // celular. Um único diálogo HTML, montado sob demanda, serve todas as telas.
  // Se o DOM não estiver disponível, cai no nativo em vez de travar o fluxo.
  const ID_DIALOGO = "finckDialogo";
  function montarDialogo() {
    let host = document.getElementById(ID_DIALOGO);
    if (host) {
      return host;
    }
    host = document.createElement("div");
    host.id = ID_DIALOGO;
    host.className = "modal-overlay";
    host.hidden = true;
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "true");
    host.setAttribute("aria-labelledby", `${ID_DIALOGO}Titulo`);
    host.innerHTML = `\n      <div class="modal modal--dialogo">\n        <h3 id="${ID_DIALOGO}Titulo"></h3>\n        <p class="descricao" data-dialogo-texto></p>\n        <label data-dialogo-campo hidden><span data-dialogo-rotulo></span>\n          <input type="text" data-dialogo-entrada maxlength="120">\n        </label>\n        <div class="acoes-etapa">\n          <button type="button" class="btn-secundario" data-dialogo-cancelar></button>\n          <button type="button" class="btn-primario" data-dialogo-confirmar></button>\n        </div>\n      </div>`;
    document.body.appendChild(host);
    return host;
  }
  function dialogo({titulo: titulo, texto: texto = "", confirmar: confirmar = "Confirmar", cancelar: cancelar = "Cancelar", perigo: perigo = false, campo: campo = null} = {}) {
    if (typeof document === "undefined" || !document.body) {
      const nativo = campo ? window.prompt(`${titulo}\n${texto}`, campo.valor || "") : window.confirm(`${titulo}\n${texto}`);
      return Promise.resolve(nativo);
    }
    const host = montarDialogo();
    const $ = sel => host.querySelector(sel);
    $(`#${ID_DIALOGO}Titulo`).textContent = titulo || "";
    const elTexto = $("[data-dialogo-texto]");
    elTexto.textContent = texto || "";
    elTexto.hidden = !texto;
    const elCampo = $("[data-dialogo-campo]");
    const elEntrada = $("[data-dialogo-entrada]");
    elCampo.hidden = !campo;
    if (campo) {
      $("[data-dialogo-rotulo]").textContent = campo.rotulo || "";
      elEntrada.value = campo.valor || "";
      elEntrada.placeholder = campo.placeholder || "";
    }
    const btnOk = $("[data-dialogo-confirmar]");
    const btnCancelar = $("[data-dialogo-cancelar]");
    btnOk.textContent = confirmar;
    btnCancelar.textContent = cancelar;
    btnOk.classList.toggle("btn-perigo", Boolean(perigo));
    return new Promise(resolver => {
      const encerrar = resposta => {
        btnOk.removeEventListener("click", aoConfirmar);
        btnCancelar.removeEventListener("click", aoCancelar);
        host.removeEventListener("click", aoFundo);
        document.removeEventListener("keydown", aoTeclado);
        fecharModal(ID_DIALOGO);
        resolver(resposta);
      };
      const aoConfirmar = () => encerrar(campo ? elEntrada.value.trim() : true);
      const aoCancelar = () => encerrar(campo ? null : false);
      const aoFundo = e => {
        if (e.target === host) {
          aoCancelar();
        }
      };
      const aoTeclado = e => {
        if (e.key === "Escape") {
          aoCancelar();
        }
        if (e.key === "Enter" && campo && document.activeElement === elEntrada) {
          aoConfirmar();
        }
      };
      btnOk.addEventListener("click", aoConfirmar);
      btnCancelar.addEventListener("click", aoCancelar);
      host.addEventListener("click", aoFundo);
      document.addEventListener("keydown", aoTeclado);
      abrirModal(ID_DIALOGO);
      if (campo) {
        requestAnimationFrame(() => elEntrada.focus());
      }
    });
  }
  const confirmar = (titulo, texto, opcoes = {}) => dialogo({
    titulo: titulo,
    texto: texto,
    confirmar: opcoes.confirmar || "Confirmar",
    cancelar: opcoes.cancelar || "Cancelar",
    perigo: opcoes.perigo !== false
  });
  const perguntar = (titulo, texto, campo = {}) => dialogo({
    titulo: titulo,
    texto: texto,
    confirmar: campo.confirmar || "Registrar",
    cancelar: "Cancelar",
    perigo: false,
    campo: {
      rotulo: campo.rotulo || "",
      valor: campo.valor || "",
      placeholder: campo.placeholder || ""
    }
  });
  function ligarModais() {
    document.querySelectorAll("[data-fechar]").forEach(btn => {
      btn.addEventListener("click", () => fecharModal(btn.dataset.fechar));
    });
    document.querySelectorAll(".modal-overlay").forEach(ov => {
      ov.addEventListener("click", e => {
        if (e.target === ov) {
          fecharModal(ov.id);
        }
      });
    });
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") {
        return;
      }
      // Só o modal de cima. O diálogo de confirmação tem o próprio Esc, que
      // também resolve a pergunta pendente.
      const topo = modalDoTopo() || [ ...document.querySelectorAll(".modal-overlay:not([hidden])") ].map(m => m.id).pop();
      if (topo && topo !== ID_DIALOGO) {
        fecharModal(topo);
      }
    });
  }
  // EscapeHTML protege a marcação, mas não impede um href
  // "javascript:" vindo de um backup antigo ou importado. Só http(s) vira link.
  function urlHttpSegura(bruta) {
    const texto = String(bruta || "").trim();
    if (!texto) {
      return null;
    }
    try {
      const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(texto) ? texto : `https://${texto}`);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  }
  const saudacao = () => {
    const h = (new Date).getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  };
  const progresso = (atual, alvo) => !alvo || alvo <= 0 ? 0 : Math.max(0, Math.min(100, Number(atual) / Number(alvo) * 100));
  function baixarArquivo(nome, conteudo, mime = "application/json") {
    const blob = new Blob([ conteudo ], {
      type: mime
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  }
  const lerMoeda = alvo => window.FinckMoeda ? window.FinckMoeda.ler(alvo) : 0;
  const escreverMoeda = (alvo, valor) => window.FinckMoeda?.escrever(alvo, valor);
  const limparMoeda = alvo => window.FinckMoeda?.limpar(alvo);
  return {
    moeda: moeda,
    numero: numero,
    percentual: percentual,
    dataBR: dataBR,
    dataISO: dataISO,
    mesISO: mesISO,
    hojeISO: hojeISO,
    mesAtual: mesAtual,
    uid: uid,
    escapeHTML: escapeHTML,
    toast: toast,
    urlHttpSegura: urlHttpSegura,
    abrirModal: abrirModal,
    dialogo: dialogo,
    confirmar: confirmar,
    perguntar: perguntar,
    fecharModal: fecharModal,
    erroCampo: erroCampo,
    ligarModais: ligarModais,
    saudacao: saudacao,
    progresso: progresso,
    baixarArquivo: baixarArquivo,
    lerMoeda: lerMoeda,
    escreverMoeda: escreverMoeda,
    limparMoeda: limparMoeda
  };
})();
