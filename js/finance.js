/* ============================================================
   FinCK v2 — Regras financeiras compartilhadas
   Saldo, totais, orçamento, previsões de recorrentes e metas.
   ============================================================ */

window.FinckFinance = (() => {
  const U = window.FinckUtils;
  const S = window.FinckStore;

  const soma = (arr, campo = "amount") => arr.reduce((s, r) => s + Number(r[campo] || 0), 0);

  const ehEntrada = (t) => t.type === "entrada";
  const ehSaida = (t) => t.type === "saida";
  const doMes = (t, mes = U.mesAtual()) => String(t.date || "").slice(0, 7) === mes;

  /** Carrega tudo que o dashboard e o FinCK of Reality precisam. */
  async function carregarContexto() {
    const [perfil, transacoes, metas, recorrentes, analises] = await Promise.all([
      S.obterPerfil(),
      S.listar("transactions", { ordem: "date", asc: false }),
      S.listar("goals", { ordem: "created_at", asc: false }),
      S.listar("recurring_transactions", { ordem: "day_of_month", asc: true }),
      S.listar("purchase_analyses", { ordem: "created_at", asc: false }),
    ]);

    const saldoInicial = Number(perfil?.initial_balance || 0);
    const entradas = soma(transacoes.filter(ehEntrada));
    const saidas = soma(transacoes.filter(ehSaida));
    const saldo = saldoInicial + entradas - saidas;

    const mes = U.mesAtual();
    const doMesAtual = transacoes.filter((t) => doMes(t, mes));
    const entradasMes = soma(doMesAtual.filter(ehEntrada));
    const saidasMes = soma(doMesAtual.filter(ehSaida));

    const ativos = recorrentes.filter((r) => r.active !== false);
    const previstoEntradas = soma(ativos.filter((r) => r.type === "entrada"));
    const despesasFixas = soma(ativos.filter((r) => r.type === "saida"));

    return {
      perfil, transacoes, metas, recorrentes, analises,
      saldoInicial, entradas, saidas, saldo,
      entradasMes, saidasMes, doMesAtual,
      previstoEntradas, despesasFixas,
      rendaLivre: Math.max(0, Number(perfil?.income_monthly || 0) - despesasFixas),
      totalGuardado: soma(metas, "current_amount"),
    };
  }

  /** Agrupa saídas por categoria (usado em análises e relatórios). */
  function porCategoria(transacoes) {
    const mapa = {};
    transacoes.filter(ehSaida).forEach((t) => {
      const c = t.category || "Outros";
      mapa[c] = (mapa[c] || 0) + Number(t.amount || 0);
    });
    return Object.entries(mapa)
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor);
  }

  /** Série dos últimos N meses: entradas, saídas e saldo do mês. */
  function serieMensal(transacoes, meses = 6) {
    const hoje = new Date();
    const saida = [];
    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const chave = d.toISOString().slice(0, 7);
      const doPeriodo = transacoes.filter((t) => String(t.date || "").slice(0, 7) === chave);
      const e = soma(doPeriodo.filter(ehEntrada));
      const s = soma(doPeriodo.filter(ehSaida));
      saida.push({
        mes: chave,
        rotulo: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        entradas: e, saidas: s, resultado: e - s,
      });
    }
    return saida;
  }

  /** Aporte em meta: cria a transação e atualiza o acumulado. */
  async function aportarMeta(metaId, valor, descricao = "Aporte em meta") {
    const metas = await S.listar("goals");
    const meta = metas.find((m) => String(m.id) === String(metaId));
    if (!meta) throw new Error("Meta não encontrada.");
    await S.inserir("transactions", {
      type: "saida", description: descricao, amount: Number(valor),
      date: U.hojeISO(), category: "Reserva", goal_id: meta.id,
    });
    return S.atualizar("goals", meta.id, {
      current_amount: Number(meta.current_amount || 0) + Number(valor),
    });
  }

  /** Dados demonstrativos (item 6 — Modo Demonstrativo). */
  async function carregarDemo() {
    const hoje = new Date();
    const dia = (n) => new Date(hoje.getFullYear(), hoje.getMonth(), n).toISOString().slice(0, 10);

    await S.salvarPerfil({
      name: "Usuário Demonstração",
      income_monthly: 3500,
      income_type: "fixa",
      payday: 5,
      work_days_month: 22,
      work_hours_day: 8,
      initial_balance: 1200,
      setup_mode: "demo",
      onboarded_at: new Date().toISOString(),
    });

    const transacoes = [
      { type: "entrada", description: "Salário", amount: 3500, date: dia(5), category: "Salário" },
      { type: "saida", description: "Aluguel", amount: 1200, date: dia(6), category: "Moradia" },
      { type: "saida", description: "Mercado", amount: 620, date: dia(8), category: "Alimentação" },
      { type: "saida", description: "Transporte", amount: 240, date: dia(9), category: "Transporte" },
      { type: "saida", description: "Streaming", amount: 55, date: dia(10), category: "Lazer" },
      { type: "saida", description: "Tênis novo", amount: 380, date: dia(12), category: "Vestuário" },
    ];
    for (const t of transacoes) await S.inserir("transactions", t);

    const recorrentes = [
      { description: "Salário", type: "entrada", amount: 3500, day_of_month: 5, active: true },
      { description: "Aluguel", type: "saida", amount: 1200, day_of_month: 6, active: true },
      { description: "Internet", type: "saida", amount: 99, day_of_month: 10, active: true },
      { description: "Streaming", type: "saida", amount: 55, day_of_month: 10, active: true },
    ];
    for (const r of recorrentes) await S.inserir("recurring_transactions", r);

    await S.inserir("goals", {
      name: "Reserva de emergência", target_amount: 6000, current_amount: 1500,
      deadline: new Date(hoje.getFullYear(), hoje.getMonth() + 8, 1).toISOString().slice(0, 10), rate: 0,
    });
    await S.inserir("goals", {
      name: "Notebook para estudos", target_amount: 3200, current_amount: 400,
      deadline: new Date(hoje.getFullYear() + 1, 2, 1).toISOString().slice(0, 10), rate: 0,
    });

    await S.inserir("purchase_analyses", {
      item_name: "Fone de ouvido premium", price: 800, category: "Eletrônicos",
      work_days: 5.03, work_hours: 40.22, income_percent: 22.86,
      impact_level: "atencao", decision: "adiar",
      reflections: { necessidade: "impulso", uso: "raro" },
      note: "Vou reavaliar em 30 dias.", analyzed_at: new Date().toISOString(),
    });
  }

  return { soma, ehEntrada, ehSaida, doMes, carregarContexto, porCategoria, serieMensal, aportarMeta, carregarDemo };
})();
