// UX-MOV: preferência de animação escolhida no Perfil. Fica neste aparelho
// (localStorage), como o próprio prefers-reduced-motion do sistema, e vale
// para todas as telas: ui-fx.js e finck-fx.js leem a mesma chave.
window.FinckPreferencias = (() => {
  const CHAVE = "finck-animacoes";
  const OPCOES = [ "completa", "reduzida", "desligada" ];
  function animacoes() {
    try {
      const v = localStorage.getItem(CHAVE);
      return OPCOES.includes(v) ? v : "completa";
    } catch {
      return "completa";
    }
  }
  function definirAnimacoes(valor) {
    const v = OPCOES.includes(valor) ? valor : "completa";
    try {
      localStorage.setItem(CHAVE, v);
    } catch {}
    document.documentElement.dataset.animacoes = v;
    window.FinckFundo?.preferencia?.(v);
    return v;
  }
  const sistemaReduz = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.addEventListener("DOMContentLoaded", () => {
    const grupo = document.getElementById("preferenciaAnimacao");
    if (!grupo) {
      return;
    }
    const nota = document.getElementById("notaAnimacao");
    const atual = animacoes();
    grupo.querySelectorAll('input[name="animacoes"]').forEach(r => {
      r.checked = r.value === atual;
      r.addEventListener("change", () => {
        const v = definirAnimacoes(r.value);
        if (nota) {
          nota.textContent = v === "completa" && sistemaReduz() ? "Salvo. Seu sistema pede movimento reduzido, então o FinCK continua mais calmo até você mudar isso no aparelho." : "Salvo neste aparelho.";
        }
      });
    });
    if (nota && sistemaReduz()) {
      nota.textContent = "Seu sistema já pede movimento reduzido; o FinCK respeita isso em qualquer opção.";
    }
  });
  return {
    animacoes: animacoes,
    definirAnimacoes: definirAnimacoes
  };
})();
