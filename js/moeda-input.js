window.FinckMoeda = (() => {
  const cfg = window.FINCK_CONFIG;
  const formatar = centavos => (centavos / 100).toLocaleString(cfg.LOCALE, {
    style: "currency",
    currency: cfg.MOEDA,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const TETO_CENTAVOS = 1e13;
  const AJUDA = "Digite como você vê o preço: 800, 800,50 ou R$ 800,00.";
  const ERRO = "Digite um valor válido, como R$ 800,00.";
  // UX-PRECO: o campo aceita o preço do jeito que a pessoa lê na loja.
  // Antes era centavo a centavo (PROD-002): digitar 800 dava R$ 8,00 e a tela
  // precisava de uma explicação longa antes de qualquer erro. As duas análises
  // de UX de 06/10/2026 pediram a troca: "800" agora é R$ 800,00, e a vírgula
  // (ou o ponto) separa os centavos. Três casas depois do separador são milhar.
  function centavosDeColagem(texto) {
    const limpo = String(texto || "").replace(/[^\d.,]/g, "");
    if (!/\d/.test(limpo)) {
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
  // Texto para editar: sem "R$" e sem ",00" sobrando, para que o próximo
  // dígito digitado continue o número em vez de virar casa decimal.
  const paraEdicao = c => c <= 0 ? "" : c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace(".", ",");
  function pintar(el) {
    const c = centavosDe(el);
    el.value = c === 0 && !el.dataset.tocado ? "" : formatar(c);
    el.dataset.valor = String(c / 100);
  }
  function definir(el, reais) {
    const c = Math.round(Math.abs(Number(reais) || 0) * 100);
    el.dataset.centavos = String(Math.min(c, TETO_CENTAVOS));
    if (c > 0) {
      el.dataset.tocado = "1";
    } else {
      delete el.dataset.tocado;
    }
    if (document.activeElement === el) {
      el.value = paraEdicao(c);
      el.dataset.valor = String(c / 100);
    } else {
      pintar(el);
    }
  }
  function ler(el) {
    const c = centavosDeColagem(el.value);
    el.dataset.centavos = String(c === null ? 0 : Math.max(0, Math.min(c, TETO_CENTAVOS)));
    el.dataset.valor = String(centavosDe(el) / 100);
    return c;
  }
  function ligar(el) {
    if (!el || el.dataset.moedaLigado) {
      return;
    }
    el.dataset.moedaLigado = "1";
    if (el.type === "number") {
      el.type = "text";
    }
    // "decimal" mostra a vírgula no teclado do celular; "numeric" não mostrava.
    el.setAttribute("inputmode", "decimal");
    el.setAttribute("autocomplete", "off");
    if (!el.placeholder) {
      el.placeholder = "Ex.: 800,00";
    }
    if (!el.title) {
      el.title = AJUDA;
    }
    if (el.dataset.centavos === undefined) {
      const inicial = centavosDeColagem(el.value);
      el.dataset.centavos = String(inicial || 0);
      el.value = "";
    }
    el.addEventListener("input", () => {
      delete el.dataset.manterSelecao;
      el.dataset.tocado = "1";
      // Só números, vírgula, ponto e o "R$" de quem cola da loja.
      const filtrado = el.value.replace(/[^\d.,R$\s]/g, "");
      if (filtrado !== el.value) {
        el.value = filtrado;
      }
      ler(el);
    });
    // Ao entrar no campo o valor fica selecionado: digitar substitui o preço
    // antigo em vez de emendar dígitos nele (3500 + 3500 virava 35.003.500).
    el.addEventListener("focus", () => {
      el.value = paraEdicao(centavosDe(el));
      try {
        el.select();
      } catch {}
      el.dataset.manterSelecao = "1";
    });
    // O clique que deu o foco termina num mouseup que, no Chrome, desfaz a
    // seleção e põe o cursor no lugar clicado. Só esse primeiro é ignorado.
    el.addEventListener("mouseup", e => {
      if (el.dataset.manterSelecao) {
        e.preventDefault();
        delete el.dataset.manterSelecao;
      }
    });
    el.addEventListener("blur", () => {
      const lido = ler(el);
      if (el.value.trim() && lido === null) {
        el.dataset.centavos = "0";
      }
      pintar(el);
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
    ERRO: ERRO,
    centavosDeColagem: centavosDeColagem,
    paraEdicao: paraEdicao,
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
        el.dataset.centavos = "0";
        el.dataset.valor = "0";
        el.value = "";
      }
    }
  };
})();

document.addEventListener("DOMContentLoaded", () => window.FinckMoeda.ligarTodos());
