/* ============================================================
   FinCK of Reality — abas internas (novo cálculo / cadastrados)
   ============================================================ */
(() => {
  const PAINEIS = { calculo: "painelCalculo", calculos: "painelCalculos" };

  function trocar(aba) {
    if (!PAINEIS[aba]) aba = "calculo";
    Object.entries(PAINEIS).forEach(([id, painelId]) => {
      const painel = document.getElementById(painelId);
      const botao = document.querySelector(`.aba[data-aba="${id}"]`);
      if (painel) painel.hidden = id !== aba;
      if (botao) {
        botao.classList.toggle("ativa", id === aba);
        botao.setAttribute("aria-selected", String(id === aba));
      }
    });
    if (history.replaceState) history.replaceState(null, "", aba === "calculos" ? "#calculos" : "#calculo");
    if (aba === "calculos") window.FinckCalculos?.recarregar?.();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".aba[data-aba]").forEach((b) =>
      b.addEventListener("click", () => trocar(b.dataset.aba))
    );
    document.addEventListener("click", (e) => {
      const alvo = e.target.closest("[data-ir-aba]");
      if (!alvo) return;
      e.preventDefault();
      trocar(alvo.dataset.irAba);
    });
    if (location.hash === "#calculos") trocar("calculos");
  });

  window.FinckAbasReality = { trocar };
})();
