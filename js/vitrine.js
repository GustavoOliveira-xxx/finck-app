/* ============================================================
   FinCK — vitrine.js
   Exemplo interativo da tela de entrada.

   O visitante entendia a proposta do FinCK só depois de criar
   conta: a primeira tela era um formulário de login. Aqui ele
   mexe nos números e vê o cálculo real acontecer — usando o
   mesmo motor (FinckReality) que o app usa depois de logado,
   para o que ele vê agora bater com o que vai encontrar dentro.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const vitrine = document.getElementById("vitrine");
  if (!vitrine) return;

  const U = window.FinckUtils;
  const R = window.FinckReality;

  const campoPreco = document.getElementById("vitrinePreco");
  const campoRenda = document.getElementById("vitrineRenda");
  const resposta = document.getElementById("vitrineResposta");
  const barra = document.getElementById("vitrineBarra");
  const legenda = document.getElementById("vitrineLegenda");

  const DIAS = 22;
  const HORAS = 8;

  const plural = (n, um, muitos) => (Math.abs(n - 1) < 0.05 ? um : muitos);

  function calcular() {
    const preco = Math.max(0, Number(campoPreco.value) || 0);
    const renda = Math.max(0, Number(campoRenda.value) || 0);

    if (preco <= 0 || renda <= 0) {
      resposta.textContent = "Informe um preço e uma renda para ver a conta.";
      barra.style.width = "0%";
      legenda.textContent = "";
      return;
    }

    // mesmo motor da página de cálculo, com um perfil de exemplo
    const r = R.calcular(preco, {
      income_monthly: renda,
      work_days_month: DIAS,
      work_hours_day: HORAS,
    });

    const horas = r.work_hours;
    const dias = r.work_days;

    resposta.innerHTML =
      `<strong>${U.numero(horas, horas < 10 ? 1 : 0)} ${plural(horas, "hora", "horas")}</strong> de trabalho` +
      ` <span class="vitrine__ou">ou</span> ` +
      `<strong>${U.numero(dias, dias < 10 ? 1 : 0)} ${plural(dias, "dia", "dias")}</strong> inteiros`;

    const pct = Math.min(100, r.income_percent);
    barra.style.width = `${pct}%`;

    /* O semáforo do app pesa também saldo em conta e despesas fixas,
       que aqui não existem: sem eles o saldo entra como zero e todo
       preço cairia em "alerta". Nesta vitrine o nível vem só da
       fatia da renda, com os mesmos limiares de 10% e 30% usados
       pelo motor — assim a cor bate com o texto ao lado. */
    barra.dataset.nivel =
      r.income_percent >= 30 ? "alerta" : r.income_percent >= 10 ? "atencao" : "verde";

    legenda.textContent =
      `Isso é ${U.percentual(r.income_percent, 1)} da sua renda do mês.` +
      (r.income_percent >= 30
        ? " Uma fatia grande — vale comparar alternativas antes."
        : r.income_percent >= 10
        ? " Cabe, mas pesa no mês."
        : " Um impacto pequeno no mês.");
  }

  // entrada por teclado dispara a cada tecla; sem debounce porque
  // a conta é aritmética simples e não toca rede nem armazenamento
  [campoPreco, campoRenda].forEach((c) => {
    c.addEventListener("input", calcular);
    // impede que o campo fique vazio ao sair, deixando a conta muda
    c.addEventListener("blur", () => {
      if (!c.value || Number(c.value) <= 0) c.value = c.id === "vitrinePreco" ? "800" : "3500";
      calcular();
    });
  });

  calcular();
});
