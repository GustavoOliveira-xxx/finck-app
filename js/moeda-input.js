

window.FinckMoeda = (() => {
  const cfg = window.FINCK_CONFIG;

  const formatar = (centavos) =>
    (centavos / 100).toLocaleString(cfg.LOCALE, {
      style: "currency",
      currency: cfg.MOEDA,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const soDigitos = (texto) => String(texto || "").replace(/\D/g, "").slice(0, 13);

  const centavosDe = (el) => Number(el.dataset.centavos || 0);

  const valorDe = (el) => centavosDe(el) / 100;

  function pintar(el) {
    const c = centavosDe(el);
    el.value = c === 0 && !el.dataset.tocado ? "" : formatar(c);
    el.dataset.valor = String(c / 100);
  }

  function definir(el, reais) {
    const c = Math.round(Math.abs(Number(reais) || 0) * 100);
    el.dataset.centavos = String(c);
    if (c > 0) el.dataset.tocado = "1";
    else delete el.dataset.tocado;
    pintar(el);
  }

  function ligar(el) {
    if (!el || el.dataset.moedaLigado) return;
    el.dataset.moedaLigado = "1";

    if (el.type === "number") el.type = "text";
    el.setAttribute("inputmode", "numeric");
    el.setAttribute("autocomplete", "off");
    if (!el.placeholder) el.placeholder = formatar(0);

    if (el.dataset.centavos === undefined) {

      const inicial = soDigitos(el.value) ? Number(el.value.replace(",", ".")) : 0;
      definir(el, Number.isFinite(inicial) ? inicial : 0);
      delete el.dataset.tocado;
      el.value = "";
    }

    el.addEventListener("input", () => {
      el.dataset.tocado = "1";
      el.dataset.centavos = String(Number(soDigitos(el.value) || 0));
      pintar(el);

      requestAnimationFrame(() => {
        const fim = el.value.length;
        try { el.setSelectionRange(fim, fim); } catch {  }
      });
    });

    el.addEventListener("keydown", (e) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      e.preventDefault();
      el.dataset.tocado = "1";
      el.dataset.centavos = String(Math.floor(centavosDe(el) / 10));
      pintar(el);
    });

    el.addEventListener("paste", (e) => {
      e.preventDefault();
      const texto = (e.clipboardData || window.clipboardData).getData("text");
      el.dataset.tocado = "1";
      el.dataset.centavos = String(Number(soDigitos(texto) || 0));
      pintar(el);
    });

    el.addEventListener("focus", () => {
      requestAnimationFrame(() => {
        const fim = el.value.length;
        try { el.setSelectionRange(fim, fim); } catch {  }
      });
    });
  }

  function ligarTodos(raiz = document) {
    raiz.querySelectorAll("input[data-moeda]").forEach(ligar);
  }

  const elemento = (alvo) => (typeof alvo === "string" ? document.getElementById(alvo) : alvo);

  return {
    ligar, ligarTodos, formatar,
    ler: (alvo) => { const el = elemento(alvo); return el ? valorDe(el) : 0; },
    escrever: (alvo, reais) => { const el = elemento(alvo); if (el) definir(el, reais); },
    limpar: (alvo) => { const el = elemento(alvo); if (el) { delete el.dataset.tocado; definir(el, 0); el.value = ""; } },
  };
})();

document.addEventListener("DOMContentLoaded", () => window.FinckMoeda.ligarTodos());
