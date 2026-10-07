(() => {
  const PAINEIS = {
    calculo: "painelCalculo",
    calculos: "painelCalculos"
  };
  function trocar(aba) {
    if (!PAINEIS[aba]) {
      aba = "calculo";
    }
    Object.entries(PAINEIS).forEach(([id, painelId]) => {
      const painel = document.getElementById(painelId);
      const botao = document.querySelector(`.aba[data-aba="${id}"]`);
      if (painel) {
        painel.hidden = id !== aba;
      }
      if (botao) {
        botao.classList.toggle("ativa", id === aba);
        botao.setAttribute("aria-selected", String(id === aba));
        botao.tabIndex = id === aba ? 0 : -1;
      }
    });
    if (history.replaceState) {
      history.replaceState(null, "", aba === "calculos" ? "#calculos" : "#calculo");
    }
    if (aba === "calculos") {
      window.FinckCalculos?.recarregar?.();
    }
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    const abas = [ ...document.querySelectorAll(".aba[data-aba]") ];
    abas.forEach(b => b.addEventListener("click", () => trocar(b.dataset.aba)));
    // Padrão de abas do WAI-ARIA: setas trocam de aba, Home e End
    // vão para a primeira e a última, e só a aba ativa entra no Tab.
    abas.forEach((b, i) => {
      b.tabIndex = b.classList.contains("ativa") ? 0 : -1;
      b.addEventListener("keydown", e => {
        const destino = {
          ArrowRight: (i + 1) % abas.length,
          ArrowLeft: (i - 1 + abas.length) % abas.length,
          Home: 0,
          End: abas.length - 1
        }[e.key];
        if (destino === undefined) {
          return;
        }
        e.preventDefault();
        trocar(abas[destino].dataset.aba);
        abas[destino].focus();
      });
    });
    document.addEventListener("click", e => {
      const alvo = e.target.closest("[data-ir-aba]");
      if (!alvo) {
        return;
      }
      e.preventDefault();
      trocar(alvo.dataset.irAba);
    });
    if (location.hash === "#calculos") {
      trocar("calculos");
    }
  });
  window.FinckAbasReality = {
    trocar: trocar
  };
})();
