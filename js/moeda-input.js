/* ============================================================
   FinCK — moeda-input.js
   Campo de dinheiro no estilo dos apps de banco.

   O usuário digita só dígitos e eles entram pela direita, sempre
   preenchendo os centavos primeiro:

       3   -> R$ 0,03
       32  -> R$ 0,32
       320 -> R$ 3,20
       3200-> R$ 32,00

   Por que assim, e não um <input type="number"> comum:

     • no celular, type=number abre um teclado que ainda mostra
       vírgula, ponto, "e" e sinal — e cada aparelho aceita um
       separador diferente, o que gera valor perdido no envio;
     • digitar "32" num campo comum significa trinta e dois reais
       para quem escreveu e trinta e dois para o app, mas ninguém
       sabe onde ficaram os centavos até salvar;
     • aqui não existe estado inválido intermediário: qualquer
       sequência de dígitos é um valor de dinheiro legítimo.

   Uso:
       <input type="text" inputmode="numeric" data-moeda id="valor">

   Leitura em qualquer lugar do app:
       U.lerMoeda("valor")     -> Number (em reais)
       U.escreverMoeda("valor", 32.5)
   ============================================================ */

window.FinckMoeda = (() => {
  const cfg = window.FINCK_CONFIG;

  const formatar = (centavos) =>
    (centavos / 100).toLocaleString(cfg.LOCALE, {
      style: "currency",
      currency: cfg.MOEDA,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  /** Só os dígitos do que foi digitado, limitado para não estourar. */
  const soDigitos = (texto) => String(texto || "").replace(/\D/g, "").slice(0, 13);

  /** Centavos guardados no campo (fonte da verdade). */
  const centavosDe = (el) => Number(el.dataset.centavos || 0);

  /** Valor em reais. É isto que o resto do app lê. */
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

    // type=number recusa "R$ 1.234,56"; o campo passa a ser texto
    if (el.type === "number") el.type = "text";
    el.setAttribute("inputmode", "numeric");
    el.setAttribute("autocomplete", "off");
    if (!el.placeholder) el.placeholder = formatar(0);

    if (el.dataset.centavos === undefined) {
      // aproveita um valor que já viesse no HTML
      const inicial = soDigitos(el.value) ? Number(el.value.replace(",", ".")) : 0;
      definir(el, Number.isFinite(inicial) ? inicial : 0);
      delete el.dataset.tocado;
      el.value = "";
    }

    el.addEventListener("input", () => {
      el.dataset.tocado = "1";
      el.dataset.centavos = String(Number(soDigitos(el.value) || 0));
      pintar(el);
      // o cursor sempre no fim: o valor cresce pela direita
      requestAnimationFrame(() => {
        const fim = el.value.length;
        try { el.setSelectionRange(fim, fim); } catch { /* campo sem seleção */ }
      });
    });

    /* Backspace apaga o último dígito, não o caractere sob o cursor.
       Sem isto, apagar dentro de "R$ 1.234,56" removeria a vírgula
       ou o ponto e o valor daria um salto sem explicação. */
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      e.preventDefault();
      el.dataset.tocado = "1";
      el.dataset.centavos = String(Math.floor(centavosDe(el) / 10));
      pintar(el);
    });

    // colar: aproveita só os dígitos
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
        try { el.setSelectionRange(fim, fim); } catch { /* ignora */ }
      });
    });
  }

  /** Liga todos os campos marcados com data-moeda que ainda não foram ligados. */
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
