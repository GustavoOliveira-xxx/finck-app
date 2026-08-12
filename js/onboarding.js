

document.addEventListener("DOMContentLoaded", async () => {
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const G = window.FinckGame;

  const user = await window.FinckNav.iniciarPagina({
    titulo: "Configuração inicial",
    subtitulo: "Perfil financeiro",
    exigirPerfil: false,
  });
  if (!user) return;

  const etapas = [...document.querySelectorAll(".etapa")];
  const despesas = [];
  let fluxo = "perfil";

  const mostrar = (n) => {
    etapas.forEach((e) => { e.hidden = Number(e.dataset.etapa) !== Number(n); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  document.querySelectorAll("[data-voltar]").forEach((b) =>
    b.addEventListener("click", () => mostrar(b.dataset.voltar))
  );

  document.querySelectorAll("[data-fluxo]").forEach((card) => {
    card.addEventListener("click", async () => {
      fluxo = card.dataset.fluxo;

      if (fluxo === "demo") {
        card.disabled = true;
        try {
          await F.carregarDemo();
          await G.sincronizarConquistas();
          U.toast("Dados de demonstração carregados.", "sucesso");
          setTimeout(() => { location.href = "home.html"; }, 700);
        } catch (err) {
          U.toast(err.message, "erro");
          card.disabled = false;
        }
        return;
      }

      if (fluxo === "manual") {

        mostrar(1);
        return;
      }

      mostrar(1);
    });
  });

  const incomeEl = document.getElementById("incomeMonthly");
  const diasEl = document.getElementById("workDays");
  const horasEl = document.getElementById("workHours");
  const dicaEl = document.getElementById("dicaValorHora");

  function atualizarDica() {
    const renda = U.lerMoeda(incomeEl);
    const dias = Number(diasEl.value) || 22;
    const horas = Number(horasEl.value) || 8;
    if (renda <= 0) {
      dicaEl.textContent = "Informe a renda para ver quanto vale a sua hora.";
      return;
    }
    const valorDia = renda / dias;
    dicaEl.textContent = `Sua hora de trabalho vale cerca de ${U.moeda(valorDia / horas)} e seu dia, ${U.moeda(valorDia)}.`;
  }
  [incomeEl, diasEl, horasEl].forEach((el) => el.addEventListener("input", atualizarDica));

  document.getElementById("formRenda").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!(Number(incomeEl.value) > 0)) return U.toast("Informe uma renda maior que zero.", "erro");
    mostrar(fluxo === "manual" ? 3 : 2);
    renderResumo();
  });

  const listaDespesas = document.getElementById("listaDespesas");
  const totalDespesasEl = document.getElementById("totalDespesas");

  function renderDespesas() {
    listaDespesas.innerHTML = despesas.length
      ? despesas.map((d, i) => `
          <li class="item-lista">
            <span class="item-desc">${U.escapeHTML(d.description)}</span>
            <span class="item-dia">dia ${d.day_of_month}</span>
            <span class="item-valor cor-vermelha">${U.moeda(d.amount)}</span>
            <button type="button" class="btn-remover" data-remover="${i}" aria-label="Remover">✕</button>
          </li>`).join("")
      : `<li class="vazio">Nenhuma despesa fixa cadastrada ainda.</li>`;

    totalDespesasEl.textContent = U.moeda(despesas.reduce((s, d) => s + d.amount, 0));
    listaDespesas.querySelectorAll("[data-remover]").forEach((b) =>
      b.addEventListener("click", () => { despesas.splice(Number(b.dataset.remover), 1); renderDespesas(); })
    );
  }
  renderDespesas();

  document.getElementById("formDespesa").addEventListener("submit", (e) => {
    e.preventDefault();
    const description = document.getElementById("despesaDescricao").value.trim();
    const amount = U.lerMoeda("despesaValor");
    const day_of_month = Number(document.getElementById("despesaDia").value) || 10;
    if (!description || !(amount > 0)) return U.toast("Preencha descrição e valor.", "erro");
    despesas.push({ description, amount, day_of_month, type: "saida", active: true });
    e.target.reset();
    document.getElementById("despesaDia").value = 10;
    renderDespesas();
  });

  document.getElementById("btnIrSaldo").addEventListener("click", () => { mostrar(3); renderResumo(); });

  const saldoEl = document.getElementById("initialBalance");
  saldoEl.addEventListener("input", renderResumo);

  function renderResumo() {
    const renda = U.lerMoeda(incomeEl);
    const dias = Number(diasEl.value) || 22;
    const horas = Number(horasEl.value) || 8;
    const fixas = despesas.reduce((s, d) => s + d.amount, 0);
    const livre = Math.max(0, renda - fixas);
    const valorDia = renda / dias;

    document.getElementById("resumoOnboarding").innerHTML = `
      <h3>Resumo</h3>
      <ul class="lista-resumo">
        <li><span>Renda mensal</span><strong>${U.moeda(renda)}</strong></li>
        <li><span>Despesas fixas</span><strong class="cor-vermelha">${U.moeda(fixas)}</strong></li>
        <li><span>Renda livre estimada</span><strong class="cor-verde">${U.moeda(livre)}</strong></li>
        <li><span>Valor do seu dia de trabalho</span><strong>${U.moeda(valorDia)}</strong></li>
        <li><span>Valor da sua hora</span><strong>${U.moeda(valorDia / horas)}</strong></li>
        <li><span>Saldo inicial</span><strong>${U.moeda(U.lerMoeda(saldoEl) || 0)}</strong></li>
      </ul>
      <p class="nota">Com esses dados, o FinCK of Reality já consegue traduzir qualquer preço em tempo de trabalho.</p>`;
  }

  document.getElementById("formSaldo").addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = e.target.querySelector('button[type="submit"]');
    botao.disabled = true;
    try {
      await S.salvarPerfil({
        income_monthly: Number(incomeEl.value),
        income_type: document.getElementById("incomeType").value,
        payday: Number(document.getElementById("payday").value) || 5,
        work_days_month: Number(diasEl.value),
        work_hours_day: Number(horasEl.value),
        initial_balance: U.lerMoeda(saldoEl) || 0,
        setup_mode: fluxo,
        onboarded_at: new Date().toISOString(),
      });

      for (const d of despesas) await S.inserir("recurring_transactions", d);

      await G.premiar("onboarding", { chave: "perfil", motivo: "perfil financeiro configurado" });
      await G.sincronizarConquistas();
      U.toast("Configuração concluída!", "sucesso");
      setTimeout(() => { location.href = "home.html"; }, 700);
    } catch (err) {
      U.toast(err.message, "erro");
      botao.disabled = false;
    }
  });

  const perfil = await S.obterPerfil();
  if (perfil?.income_monthly) {
    incomeEl.value = perfil.income_monthly;
    diasEl.value = perfil.work_days_month || 22;
    horasEl.value = perfil.work_hours_day || 8;
    saldoEl.value = perfil.initial_balance || 0;
    document.getElementById("incomeType").value = perfil.income_type || "fixa";
    document.getElementById("payday").value = perfil.payday || 5;
  }
  atualizarDica();
});
