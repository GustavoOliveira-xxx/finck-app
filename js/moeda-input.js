window.FinckMoeda = (() => {
  const cfg = window.FINCK_CONFIG;
  const formatar = centavos => (centavos / 100).toLocaleString(cfg.LOCALE, {
    style: "currency",
    currency: cfg.MOEDA,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const soDigitos = texto => String(texto || "").replace(/\D/g, "").slice(0, 13);
  const AJUDA = "Digite os centavos: 8 vira R$ 0,08 e 80000 vira R$ 800,00. Colar um preço pronto (800 ou R$ 800,00) também funciona.";
  // PROD-002 — digitar é dígito a dígito, da direita para a esquerda, porque é
  // assim que o teclado numérico do celular funciona. Colar é outra intenção: o
  // usuário traz um preço inteiro da loja. "800" colado é R$ 800,00, não R$ 8,00.
  function centavosDeColagem(texto) {
    const limpo = String(texto || "").replace(/[^\d.,]/g, "");
    if (!limpo) {
      return null;
    }
    const ultimo = Math.max(limpo.lastIndexOf(","), limpo.lastIndexOf("."));
    if (ultimo === -1) {
      return Math.round(Number(limpo) * 100);
    }
    const decimais = limpo.slice(ultimo + 1).replace(/\D/g, "");
    const inteiros = limpo.slice(0, ultimo).replace(/\D/g, "");
    // Três casas depois do separador é milhar ("1.500"), não centavo.
    if (decimais.length === 3 || decimais.length === 0) {
      return Math.round(Number(inteiros + decimais) * 100);
    }
    const centavos = decimais.slice(0, 2).padEnd(2, "0");
    return Math.round(Number(inteiros || "0") * 100) + Number(centavos);
  }
  const centavosDe = el => Number(el.dataset.centavos || 0);
  const valorDe = el => centavosDe(el) / 100;
  function pintar(el) {
    const c = centavosDe(el);
    el.value = c === 0 && !el.dataset.tocado ? "" : formatar(c);
    el.dataset.valor = String(c / 100);
  }
  function definir(el, reais) {
    const c = Math.round(Math.abs(Number(reais) || 0) * 100);
    el.dataset.centavos = String(c);
    if (c > 0) {
      el.dataset.tocado = "1";
    } else {
      delete el.dataset.tocado;
    }
    pintar(el);
  }
  function ligar(el) {
    if (!el || el.dataset.moedaLigado) {
      return;
    }
    el.dataset.moedaLigado = "1";
    if (el.type === "number") {
      el.type = "text";
    }
    el.setAttribute("inputmode", "numeric");
    el.setAttribute("autocomplete", "off");
    if (!el.placeholder) {
      el.placeholder = formatar(0);
    }
    if (!el.title) {
      el.title = AJUDA;
    }
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
        try {
          el.setSelectionRange(fim, fim);
        } catch {}
      });
    });
    el.addEventListener("keydown", e => {
      if (e.key !== "Backspace" && e.key !== "Delete") {
        return;
      }
      e.preventDefault();
      el.dataset.tocado = "1";
      el.dataset.centavos = String(Math.floor(centavosDe(el) / 10));
      pintar(el);
    });
    el.addEventListener("paste", e => {
      e.preventDefault();
      const texto = (e.clipboardData || window.clipboardData).getData("text");
      const interpretado = centavosDeColagem(texto);
      el.dataset.tocado = "1";
      el.dataset.centavos = String(Number.isFinite(interpretado) && interpretado !== null ? Math.max(0, Math.min(interpretado, 1e13)) : Number(soDigitos(texto) || 0));
      pintar(el);
    });
    el.addEventListener("focus", () => {
      requestAnimationFrame(() => {
        const fim = el.value.length;
        try {
          el.setSelectionRange(fim, fim);
        } catch {}
      });
    });
  }
  function ligarTodos(raiz = document) {
    raiz.querySelectorAll("input[data-moeda]").forEach(ligar);
  }
  const elemento = alvo => typeof alvo === "string" ? document.getElementById(alvo) : alvo;
  return {
    ligar: ligar,
    ligarTodos: ligarTodos,
    formatar: formatar,
    AJUDA: AJUDA,
    centavosDeColagem: centavosDeColagem,
    ler: alvo => {
      const el = elemento(alvo);
      return el ? valorDe(el) : 0;
    },
    escrever: (alvo, reais) => {
      const el = elemento(alvo);
      if (el) {
        definir(el, reais);
      }
    },
    limpar: alvo => {
      const el = elemento(alvo);
      if (el) {
        delete el.dataset.tocado;
        definir(el, 0);
        el.value = "";
      }
    }
  };
})();

document.addEventListener("DOMContentLoaded", () => window.FinckMoeda.ligarTodos());
