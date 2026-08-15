window.FinckData = (() => {

  const soDigitos = (t) => String(t || "").replace(/\D/g, "").slice(0, 8);

  const mascarar = (d) => {
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  };

  const paraISO = (texto) => {
    const d = soDigitos(texto);
    if (d.length !== 8) return "";
    const dia = Number(d.slice(0, 2));
    const mes = Number(d.slice(2, 4));
    const ano = Number(d.slice(4));
    if (mes < 1 || mes > 12 || dia < 1 || ano < 1900) return "";
    const ultimo = new Date(ano, mes, 0).getDate();
    if (dia > ultimo) return "";
    return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  };

  const deISO = (iso) => {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  };

  function pintar(el) {
    el.value = mascarar(soDigitos(el.value));
    el.dataset.iso = paraISO(el.value);
  }

  function ligar(el) {
    if (!el || el.dataset.dataLigado) return;
    el.dataset.dataLigado = "1";

    if (el.type === "date") {
      const iso = el.value;
      el.type = "text";
      if (iso) el.value = deISO(iso);
    }
    el.setAttribute("inputmode", "numeric");
    el.setAttribute("autocomplete", "off");
    el.setAttribute("maxlength", "10");
    if (!el.placeholder || /^\s*$/.test(el.placeholder)) el.placeholder = "dd/mm/aaaa";

    pintar(el);

    el.addEventListener("input", () => {
      const fimAntes = el.selectionStart === el.value.length;
      pintar(el);
      if (fimAntes) {
        requestAnimationFrame(() => {
          const f = el.value.length;
          try { el.setSelectionRange(f, f); } catch {  }
        });
      }
    });

    el.addEventListener("blur", () => {
      if (el.value && !paraISO(el.value)) {
        el.setCustomValidity("Data inválida. Use dd/mm/aaaa.");
      } else {
        el.setCustomValidity("");
      }
    });
  }

  const elemento = (alvo) => (typeof alvo === "string" ? document.getElementById(alvo) : alvo);

  return {
    ligar,
    ligarTodos: (raiz = document) =>
      raiz.querySelectorAll('input[type="date"], input[data-data]').forEach(ligar),
    paraISO,
    deISO,
    ler: (alvo) => { const el = elemento(alvo); return el ? paraISO(el.value) : ""; },
    escrever: (alvo, iso) => {
      const el = elemento(alvo);
      if (!el) return;
      el.value = deISO(iso);
      el.dataset.iso = iso || "";
    },
  };
})();

document.addEventListener("DOMContentLoaded", () => window.FinckData.ligarTodos());
