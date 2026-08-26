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
  const abrirModal = id => {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    focoAnterior.set(id, document.activeElement);
    el.hidden = false;
    document.body.classList.add("modal-aberto");
    requestAnimationFrame(() => {
      const foco = el.querySelector('[autofocus], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
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
    if (!document.querySelector(".modal-overlay:not([hidden])")) {
      document.body.classList.remove("modal-aberto");
    }
    const anterior = focoAnterior.get(id);
    if (anterior?.isConnected) {
      anterior.focus();
    }
    focoAnterior.delete(id);
  };
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
      document.querySelectorAll(".modal-overlay:not([hidden])").forEach(m => fecharModal(m.id));
    });
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
    abrirModal: abrirModal,
    fecharModal: fecharModal,
    ligarModais: ligarModais,
    saudacao: saudacao,
    progresso: progresso,
    baixarArquivo: baixarArquivo,
    lerMoeda: lerMoeda,
    escreverMoeda: escreverMoeda,
    limparMoeda: limparMoeda
  };
})();
