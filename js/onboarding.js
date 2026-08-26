document.addEventListener("DOMContentLoaded", async () => {
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const G = window.FinckGame;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "Configuração inicial",
    subtitulo: "Perfil financeiro",
    exigirPerfil: false
  });
  if (!user) {
    return;
  }
  const etapas = [ ...document.querySelectorAll(".etapa") ];
  const despesas = [];
  let fluxo = "perfil";
  const mostrar = n => {
    etapas.forEach(e => {
      e.hidden = Number(e.dataset.etapa) !== Number(n);
    });
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };
  document.querySelectorAll("[data-voltar]").forEach(b => b.addEventListener("click", () => mostrar(b.dataset.voltar)));
  document.querySelectorAll("[data-fluxo]").forEach(card => {
    card.addEventListener("click", async () => {
      fluxo = card.dataset.fluxo;
      if (fluxo === "demo") {
        card.disabled = true;
        try {
          await F.carregarDemo();
          await G.sincronizarConquistas();
          U.toast("Dados de demonstração carregados.", "sucesso");
          setTimeout(() => {
            location.href = "home.html";
          }, 700);
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
    const dias = Number(diasEl.value);
    const horas = Number(horasEl.value);
    if (renda <= 0) {
      dicaEl.textContent = "Sem renda no momento? Você pode seguir: os cálculos em tempo ficam indisponíveis até atualizar este valor.";
      return;
    }
    if (!(dias >= 1 && dias <= 31 && horas > 0 && horas <= 16)) {
      dicaEl.textContent = "Revise os dias e as horas da sua jornada.";
      return;
    }
    const valorDia = renda / dias;
    dicaEl.textContent = `Sua hora de trabalho vale cerca de ${U.moeda(valorDia / horas)} e seu dia, ${U.moeda(valorDia)}.`;
  }
  [ incomeEl, diasEl, horasEl ].forEach(el => el.addEventListener("input", atualizarDica));
  document.getElementById("formRenda").addEventListener("submit", e => {
    e.preventDefault();
    const renda = U.lerMoeda(incomeEl);
    const dias = Number(diasEl.value);
    const horas = Number(horasEl.value);
    const pagamento = Number(document.getElementById("payday").value);
    if (!(renda >= 0)) {
      return U.toast("A renda não pode ser negativa.", "erro");
    }
    if (!(Number.isInteger(dias) && dias >= 1 && dias <= 31)) {
      return U.toast("Informe de 1 a 31 dias trabalhados por mês.", "erro");
    }
    if (!(horas > 0 && horas <= 16)) {
      return U.toast("Informe de 0,5 a 16 horas por dia.", "erro");
    }
    if (!(Number.isInteger(pagamento) && pagamento >= 1 && pagamento <= 31)) {
      return U.toast("Informe um dia de recebimento entre 1 e 31.", "erro");
    }
    mostrar(fluxo === "manual" ? 3 : 2);
    renderResumo();
  });
  function modoDe(nome) {
    const m = document.querySelector(`input[name="${nome}"]:checked`);
    return m ? m.value : "percentual";
  }
  function trocarModo(nome, raiz) {
    const modo = modoDe(nome);
    raiz.querySelectorAll("[data-campo]").forEach(c => {
      c.hidden = c.dataset.campo !== modo;
    });
  }
  function planoRenda() {
    const modoLivre = modoDe("modoLivre");
    const modoEcon = modoDe("modoEconomia");
    const pctLivre = Number(document.getElementById("livrePercent")?.value) || null;
    const valLivre = U.lerMoeda("livreValor") || null;
    const pctEcon = Number(document.getElementById("economiaPercent")?.value) || null;
    const valEcon = U.lerMoeda("economiaValor") || null;
    return {
      free_income_mode: (modoLivre === "valor" ? valLivre : pctLivre) ? modoLivre : null,
      free_income_percent: modoLivre === "percentual" ? pctLivre : null,
      free_income_amount: modoLivre === "valor" ? valLivre : null,
      savings_mode: (modoEcon === "valor" ? valEcon : pctEcon) ? modoEcon : null,
      savings_percent: modoEcon === "percentual" ? pctEcon : null,
      savings_amount: modoEcon === "valor" ? valEcon : null
    };
  }
  function previaPlano() {
    const alvo = document.getElementById("previaPlano");
    if (!alvo) {
      return;
    }
    const renda = U.lerMoeda(incomeEl);
    const p = planoRenda();
    if (!renda || !p.free_income_mode && !p.savings_mode) {
      alvo.textContent = "";
      return;
    }
    const valor = (modo, pct, fixo) => modo === "valor" ? fixo || 0 : renda * (pct || 0) / 100;
    const livre = valor(p.free_income_mode, p.free_income_percent, p.free_income_amount);
    const econ = valor(p.savings_mode, p.savings_percent, p.savings_amount);
    const partes = [];
    if (livre) {
      partes.push(`renda livre de ${U.moeda(livre)}`);
    }
    if (econ) {
      partes.push(`economia de ${U.moeda(econ)}`);
    }
    alvo.textContent = partes.length ? `Sobre ${U.moeda(renda)} por mês: ${partes.join(" e ")}.` : "";
  }
  document.querySelectorAll(".plano-renda__item").forEach(item => {
    const nome = item.querySelector("input[type=radio]")?.name;
    if (!nome) {
      return;
    }
    item.querySelectorAll("input[type=radio]").forEach(r => r.addEventListener("change", () => {
      trocarModo(nome, item);
      previaPlano();
    }));
    item.querySelectorAll("input:not([type=radio])").forEach(c => c.addEventListener("input", previaPlano));
    trocarModo(nome, item);
  });
  const listaDespesas = document.getElementById("listaDespesas");
  const totalDespesasEl = document.getElementById("totalDespesas");
  function renderDespesas() {
    listaDespesas.innerHTML = despesas.length ? despesas.map((d, i) => `\n          <li class="item-lista">\n            <span class="item-desc">${U.escapeHTML(d.description)}</span>\n            <span class="item-dia">dia ${d.day_of_month}</span>\n            <span class="item-valor cor-vermelha">${U.moeda(d.amount)}</span>\n            <button type="button" class="btn-remover" data-remover="${i}" aria-label="Remover">✕</button>\n          </li>`).join("") : `<li class="vazio">Nenhuma despesa fixa cadastrada ainda.</li>`;
    totalDespesasEl.textContent = U.moeda(despesas.reduce((s, d) => s + d.amount, 0));
    listaDespesas.querySelectorAll("[data-remover]").forEach(b => b.addEventListener("click", () => {
      despesas.splice(Number(b.dataset.remover), 1);
      renderDespesas();
    }));
  }
  renderDespesas();
  document.getElementById("formDespesa").addEventListener("submit", e => {
    e.preventDefault();
    const description = document.getElementById("despesaDescricao").value.trim();
    const amount = U.lerMoeda("despesaValor");
    const day_of_month = Number(document.getElementById("despesaDia").value) || 10;
    if (!description || !(amount > 0)) {
      return U.toast("Preencha descrição e valor.", "erro");
    }
    if (!(Number.isInteger(day_of_month) && day_of_month >= 1 && day_of_month <= 31)) {
      return U.toast("O vencimento precisa estar entre os dias 1 e 31.", "erro");
    }
    despesas.push({
      description: description,
      amount: amount,
      day_of_month: day_of_month,
      type: "saida",
      active: true
    });
    e.target.reset();
    document.getElementById("despesaDia").value = 10;
    renderDespesas();
  });
  document.getElementById("btnIrSaldo").addEventListener("click", () => {
    mostrar(3);
    renderResumo();
  });
  const saldoEl = document.getElementById("initialBalance");
  saldoEl.addEventListener("input", renderResumo);
  function renderResumo() {
    const renda = U.lerMoeda(incomeEl);
    const dias = Number(diasEl.value) || 22;
    const horas = Number(horasEl.value) || 8;
    const fixas = despesas.reduce((s, d) => s + d.amount, 0);
    const livre = Math.max(0, renda - fixas);
    const valorDia = renda > 0 ? renda / dias : 0;
    const valorHora = renda > 0 ? valorDia / horas : 0;
    document.getElementById("resumoOnboarding").innerHTML = `\n      <h3>Resumo</h3>\n      <ul class="lista-resumo">\n        <li><span>Renda mensal</span><strong>${U.moeda(renda)}</strong></li>\n        <li><span>Despesas fixas</span><strong class="cor-vermelha">${U.moeda(fixas)}</strong></li>\n        <li><span>Renda livre estimada</span><strong class="cor-verde">${U.moeda(livre)}</strong></li>\n        <li><span>Valor do seu dia de trabalho</span><strong>${renda > 0 ? U.moeda(valorDia) : "Indisponível"}</strong></li>\n        <li><span>Valor da sua hora</span><strong>${renda > 0 ? U.moeda(valorHora) : "Indisponível"}</strong></li>\n        <li><span>Saldo inicial</span><strong>${U.moeda(U.lerMoeda(saldoEl) || 0)}</strong></li>\n      </ul>\n      <p class="nota">${renda > 0 ? "Com esses dados, o FinCK of Reality já consegue traduzir qualquer preço em tempo de trabalho." : "Você pode usar o restante do FinCK normalmente e informar uma renda depois no perfil."}</p>`;
  }
  document.getElementById("formSaldo").addEventListener("submit", async e => {
    e.preventDefault();
    const botao = e.target.querySelector('button[type="submit"]');
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.setAttribute("aria-busy", "true");
    botao.textContent = "Concluindo…";
    const criadas = [];
    try {
      const dias = Number(diasEl.value);
      const horas = Number(horasEl.value);
      const pagamento = Number(document.getElementById("payday").value);
      if (!(Number.isInteger(dias) && dias >= 1 && dias <= 31)) {
        throw new Error("Revise os dias trabalhados.");
      }
      if (!(horas > 0 && horas <= 16)) {
        throw new Error("Revise as horas trabalhadas por dia.");
      }
      if (!(Number.isInteger(pagamento) && pagamento >= 1 && pagamento <= 31)) {
        throw new Error("Revise o dia do recebimento.");
      }
      for (const d of despesas) {
        const criada = await S.inserir("recurring_transactions", d);
        if (criada?.id) {
          criadas.push(criada);
        }
      }
      await S.salvarPerfil({
        income_monthly: U.lerMoeda(incomeEl),
        income_type: document.getElementById("incomeType").value,
        payday: pagamento,
        work_days_month: dias,
        work_hours_day: horas,
        initial_balance: U.lerMoeda(saldoEl) || 0,
        ...planoRenda(),
        setup_mode: fluxo,
        onboarded_at: (new Date).toISOString()
      });
      try {
        await G.premiar("onboarding", {
          chave: "perfil",
          motivo: "perfil financeiro configurado"
        });
        await G.sincronizarConquistas();
      } catch (err) {
        await S.registrarEvento({
          scope: "gamificacao",
          message: err.message,
          context: {
            origem: "onboarding"
          }
        });
      }
      U.toast("Configuração concluída!", "sucesso");
      setTimeout(() => {
        location.href = "home.html";
      }, 700);
    } catch (err) {
      for (const criada of criadas.reverse()) {
        try {
          await S.remover("recurring_transactions", criada.id);
        } catch {}
      }
      U.toast(err.message, "erro");
      botao.disabled = false;
      botao.removeAttribute("aria-busy");
      botao.textContent = textoOriginal;
    }
  });
  const perfil = await S.obterPerfil();
  if (perfil) {
    U.escreverMoeda(incomeEl, perfil.income_monthly);
    diasEl.value = perfil.work_days_month || 22;
    horasEl.value = perfil.work_hours_day || 8;
    U.escreverMoeda(saldoEl, perfil.initial_balance || 0);
    document.getElementById("incomeType").value = perfil.income_type || "fixa";
    document.getElementById("payday").value = perfil.payday || 5;
  }
  atualizarDica();
});
