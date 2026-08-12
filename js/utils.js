

window.FinckUtils = (() => {
  const cfg = window.FINCK_CONFIG;

  const moeda = (valor) =>
    Number(valor || 0).toLocaleString(cfg.LOCALE, {
      style: "currency",
      currency: cfg.MOEDA,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const numero = (valor, casas = 2) =>
    Number(valor || 0).toLocaleString(cfg.LOCALE, {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    });

  const percentual = (valor, casas = 2) => `${numero(valor, casas)}%`;

  const dataBR = (iso) => {
    if (!iso) return "—";
    const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(cfg.LOCALE);
  };

  const hojeISO = () => new Date().toISOString().slice(0, 10);

  const mesAtual = () => new Date().toISOString().slice(0, 7);

  const uid = () =>
    (crypto.randomUUID && crypto.randomUUID()) ||
    `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const escapeHTML = (txt) =>
    String(txt ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
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

  const abrirModal = (id) => {
    const el = document.getElementById(id);
    if (el) { el.hidden = false; document.body.classList.add("modal-aberto"); }
  };
  const fecharModal = (id) => {
    const el = document.getElementById(id);
    if (el) { el.hidden = true; document.body.classList.remove("modal-aberto"); }
  };

  function ligarModais() {
    document.querySelectorAll("[data-fechar]").forEach((btn) => {
      btn.addEventListener("click", () => fecharModal(btn.dataset.fechar));
    });
    document.querySelectorAll(".modal-overlay").forEach((ov) => {
      ov.addEventListener("click", (e) => { if (e.target === ov) fecharModal(ov.id); });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".modal-overlay:not([hidden])").forEach((m) => fecharModal(m.id));
    });
  }

  const saudacao = () => {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  };

  const progresso = (atual, alvo) =>
    !alvo || alvo <= 0 ? 0 : Math.max(0, Math.min(100, (Number(atual) / Number(alvo)) * 100));

  function baixarArquivo(nome, conteudo, mime = "application/json") {
    const blob = new Blob([conteudo], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  const lerMoeda = (alvo) => (window.FinckMoeda ? window.FinckMoeda.ler(alvo) : 0);
  const escreverMoeda = (alvo, valor) => window.FinckMoeda?.escrever(alvo, valor);
  const limparMoeda = (alvo) => window.FinckMoeda?.limpar(alvo);

  return {
    moeda, numero, percentual, dataBR, hojeISO, mesAtual, uid, escapeHTML,
    toast, abrirModal, fecharModal, ligarModais, saudacao, progresso, baixarArquivo,
    lerMoeda, escreverMoeda, limparMoeda,
  };
})();
