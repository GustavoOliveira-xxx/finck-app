window.FinckFinance = (() => {
  const U = window.FinckUtils;
  const S = window.FinckStore;

  const soma = (arr, campo = "amount") => arr.reduce((s, r) => s + Number(r[campo] || 0), 0);

  const ehEntrada = (t) => t.type === "entrada";
  const ehSaida = (t) => t.type === "saida";
  const doMes = (t, mes = U.mesAtual()) => String(t.date || "").slice(0, 7) === mes;

  async function carregarContexto() {
    const [perfil, transacoes, metas, recorrentes, analises, contas, parcelamentos, pagamentos] = await Promise.all([
      S.obterPerfil(),
      S.listar("transactions", { ordem: "date", asc: false }),
      S.listar("goals", { ordem: "created_at", asc: false }),
      S.listar("recurring_transactions", { ordem: "day_of_month", asc: true }),
      S.listar("purchase_analyses", { ordem: "created_at", asc: false }),
      S.listar("accounts"),
      S.listar("installment_purchases"),
      S.listar("installment_payments"),
    ]);

    // Caixa é o que já aconteceu. Lançamento com data futura é compromisso
    // agendado: ele entra na projeção do mês dele, não no saldo de hoje.
    const hoje = U.hojeISO();
    const realizadas = transacoes.filter((t) => String(t.date || "") <= hoje);
    const futuras = transacoes.filter((t) => String(t.date || "") > hoje);

    const entradas = soma(realizadas.filter(ehEntrada));
    const saidas = soma(realizadas.filter(ehSaida));

    const origem = origemDoSaldo(perfil, contas);
    const saldoInicial = origem.saldoInicial;
    const saldo = saldoInicial + entradas - saidas;

    const mes = U.mesAtual();
    const doMesAtual = realizadas.filter((t) => doMes(t, mes));
    const entradasMes = soma(doMesAtual.filter(ehEntrada));
    const saidasMes = soma(doMesAtual.filter(ehSaida));

    const ativos = recorrentes.filter((r) => r.active !== false);
    const previstoEntradas = soma(ativos.filter((r) => r.type === "entrada"));
    const despesasFixas = soma(ativos.filter((r) => r.type === "saida"));

    const orcamento = orcamentoMensal(perfil, despesasFixas);
    const compromissos = compromissosEmAberto(parcelamentos, pagamentos);

    return {
      perfil, transacoes, metas, recorrentes, analises, contas, parcelamentos, pagamentos,
      transacoesRealizadas: realizadas,
      transacoesFuturas: futuras,
      agendado: soma(futuras.filter(ehEntrada)) - soma(futuras.filter(ehSaida)),
      saldoInicial, entradas, saidas, saldo,
      origemSaldo: origem,
      entradasMes, saidasMes, doMesAtual,
      previstoEntradas, despesasFixas,
      ...orcamento,
      compromissosAbertos: compromissos,
      disponivelProjetado: saldo - compromissos,
      totalGuardado: soma(metas, "current_amount"),
    };
  }

  function origemDoSaldo(perfil, contas = []) {
    const ativas = (contas || []).filter((c) => c.active !== false);
    const saldoPerfil = Number(perfil?.initial_balance || 0);
    const saldoContas = ativas.reduce((s, c) => s + Number(c.initial_balance || 0), 0);

    if (!ativas.length) {
      return {
        fonte: "perfil", saldoInicial: saldoPerfil, saldoPerfil, saldoContas: 0,
        naoAlocado: saldoPerfil, duplicaria: 0,
        nota: "O saldo inicial veio do seu perfil. Ao cadastrar contas, ele passa a vir delas.",
      };
    }

    return {
      fonte: "contas", saldoInicial: saldoContas, saldoPerfil, saldoContas,
      naoAlocado: 0, duplicaria: saldoPerfil,
      nota: saldoPerfil > 0
        ? `O saldo inicial agora vem das suas contas (${U.moeda(saldoContas)}). Os ${U.moeda(saldoPerfil)} informados no perfil não são somados de novo.`
        : "O saldo inicial vem das suas contas cadastradas.",
    };
  }

  function orcamentoMensal(perfil, despesasFixas) {
    const renda = Number(perfil?.income_monthly || 0);
    const fixas = Number(despesasFixas || 0);
    const sobraAposFixos = renda - fixas;
    const semFolga = renda > 0 && sobraAposFixos <= 0;

    return {
      renda,
      sobraAposFixos,
      deficitFixos: Math.max(0, -sobraAposFixos),
      semFolga,

      rendaLivre: Math.max(0, sobraAposFixos),
      comprometidoPercent: renda > 0 ? (fixas / renda) * 100 : 0,
    };
  }

  function compromissosEmAberto(parcelamentos = [], pagamentos = []) {
    const P = window.FinckPlano;
    if (!P) return 0;
    const porCompra = P.pagamentosPorCompra(pagamentos);
    return (parcelamentos || [])
      .filter((p) => p.active !== false)
      .reduce((s, p) => s + P.saldoDevedor(p, porCompra.get(String(p.id)) || []), 0);
  }

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

  const deltaNaMeta = (tipo, valor) =>
    (tipo === "saida" ? 1 : -1) * Number(valor || 0);

  async function aplicarNaMeta(goalId, delta) {
    const meta = await S.obter("goals", goalId);
    if (!meta) return null;
    return S.atualizar("goals", meta.id, {
      current_amount: Math.max(0, Number(meta.current_amount || 0) + delta),
    });
  }

  async function registrarTransacao(dados) {
    const mov = await S.inserir("transactions", dados);
    if (!dados.goal_id) return mov;

    try {
      await aplicarNaMeta(dados.goal_id, deltaNaMeta(dados.type, dados.amount));
    } catch (err) {

      await S.remover("transactions", mov.id).catch(() => {});
      throw err;
    }
    return mov;
  }

  async function estornarTransacao(id) {
    const t = await S.obter("transactions", id);
    if (!t) return { removida: false, meta: null };

    // Caminho preferido: remoção e estorno da meta na mesma transação de banco.
    const noBanco = await S.rpc("estornar_transacao", { p_transaction_id: id });
    if (noBanco.suportado) {
      return {
        removida: true,
        estornouMeta: Boolean(t.goal_id),
        meta: t.goal_id ? await S.obter("goals", t.goal_id) : null,
        atomica: true,
      };
    }

    let meta = null;
    if (t.goal_id) {

      await S.atualizar("transactions", id, { goal_id: null });
      try {
        meta = await aplicarNaMeta(t.goal_id, -deltaNaMeta(t.type, t.amount));
      } catch (err) {
        await S.atualizar("transactions", id, { goal_id: t.goal_id }).catch(() => {});
        throw err;
      }
    }

    await S.remover("transactions", id);
    return { removida: true, meta, estornouMeta: Boolean(t.goal_id) };
  }

  async function aportarMeta(metaId, valor, descricao = "Aporte em meta", { account_id = null } = {}) {
    const meta = await S.obter("goals", metaId);
    if (!meta) throw new Error("Meta não encontrada.");
    const montante = Number(valor);
    if (!(montante > 0)) throw new Error("Informe um valor maior que zero.");

    await registrarTransacao({
      type: "saida", description: descricao, amount: montante,
      date: U.hojeISO(), category: "Reserva", goal_id: meta.id, account_id,
    });

    return S.obter("goals", meta.id);
  }

  // Quantas parcelas iniciais estão pagas em sequência. Mantém paid_count
  // honesto mesmo quando o usuário quita uma parcela fora de ordem.
  const pagasEmSequencia = (crono) => {
    let n = 0;
    for (const c of crono) { if (!c.paga) break; n++; }
    return n;
  };

  async function pagarParcela(parcelamento, numero, { account_id = null, date = null } = {}) {
    const P = window.FinckPlano;
    const pagamentos = await S.listar("installment_payments", { filtro: { purchase_id: parcelamento.id } });
    const parcela = P.cronograma(parcelamento, pagamentos).find((c) => c.numero === Number(numero));
    if (!parcela) throw new Error("Parcela não encontrada.");

    // Idempotência: uma parcela já quitada não gera um segundo lançamento.
    if (parcela.paga) return { jaPaga: true, transaction_id: parcela.transaction_id };

    const mov = await S.inserir(
      "transactions", P.movimentacaoDaParcela(parcelamento, parcela, { account_id, date }));

    try {
      const registro = pagamentos.find((pg) => Number(pg.installment_no) === parcela.numero);
      const campos = { status: "paga", transaction_id: mov.id, paid_at: new Date().toISOString() };

      if (registro) await S.atualizar("installment_payments", registro.id, campos);
      else {
        await S.inserir("installment_payments", {
          purchase_id: parcelamento.id,
          installment_no: parcela.numero,
          due_date: P.isoLocal(parcela.vencimento),
          amount: parcela.valor,
          ...campos,
        });
      }

      const atualizados = await S.listar("installment_payments", { filtro: { purchase_id: parcelamento.id } });
      await S.atualizar("installment_purchases", parcelamento.id, {
        paid_count: pagasEmSequencia(P.cronograma(parcelamento, atualizados)),
      });
    } catch (err) {

      await S.remover("transactions", mov.id).catch(() => {});
      throw err;
    }

    return { jaPaga: false, transaction_id: mov.id };
  }

  async function desfazerPagamentoParcela(parcelamento, numero) {
    const P = window.FinckPlano;
    const pagamentos = await S.listar("installment_payments", { filtro: { purchase_id: parcelamento.id } });
    const registro = pagamentos.find((pg) => Number(pg.installment_no) === Number(numero));
    if (!registro) return { desfeita: false };

    // Solta o vínculo antes de apagar, para nunca apontar para o que não existe.
    await S.atualizar("installment_payments", registro.id, {
      status: "aberta", transaction_id: null, paid_at: null,
    });
    if (registro.transaction_id) await S.remover("transactions", registro.transaction_id);

    const atualizados = await S.listar("installment_payments", { filtro: { purchase_id: parcelamento.id } });
    await S.atualizar("installment_purchases", parcelamento.id, {
      paid_count: pagasEmSequencia(P.cronograma(parcelamento, atualizados)),
    });

    return { desfeita: true };
  }

  async function carregarDemo({ substituir = false } = {}) {
    if (substituir) await S.limparDados();

    const hoje = new Date();
    const dia = (n) => new Date(hoje.getFullYear(), hoje.getMonth(), n).toISOString().slice(0, 10);
    const resumo = { inseridos: 0, jaExistiam: 0 };

    const cache = {};
    const registrar = async (tabela, linha) => {
      if (!cache[tabela]) cache[tabela] = await S.listar(tabela);
      const criado = await S.inserirSeNovo(tabela, linha, cache[tabela]);
      if (criado) { cache[tabela].push(criado); resumo.inseridos++; }
      else resumo.jaExistiam++;
      return criado;
    };

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
    for (const t of transacoes) await registrar("transactions", t);

    const recorrentes = [
      { description: "Salário", type: "entrada", amount: 3500, day_of_month: 5, active: true },
      { description: "Aluguel", type: "saida", amount: 1200, day_of_month: 6, active: true },
      { description: "Internet", type: "saida", amount: 99, day_of_month: 10, active: true },
      { description: "Streaming", type: "saida", amount: 55, day_of_month: 10, active: true },
    ];
    for (const r of recorrentes) await registrar("recurring_transactions", r);

    await registrar("goals", {
      name: "Reserva de emergência", target_amount: 6000, current_amount: 1500,
      deadline: new Date(hoje.getFullYear(), hoje.getMonth() + 8, 1).toISOString().slice(0, 10), rate: 0,
    });
    await registrar("goals", {
      name: "Notebook para estudos", target_amount: 3200, current_amount: 400,
      deadline: new Date(hoje.getFullYear() + 1, 2, 1).toISOString().slice(0, 10), rate: 0,
    });

    await registrar("purchase_analyses", {
      item_name: "Fone de ouvido premium", price: 800, category: "Eletrônicos",
      work_days: 5.03, work_hours: 40.22, income_percent: 22.86,
      impact_level: "atencao", decision: "adiar",
      reflections: { necessidade: "impulso", uso: "raro" },

      note: "Vou reavaliar em 30 dias.", analyzed_at: `${dia(12)}T12:00:00.000Z`,
    });

    return resumo;
  }

  return {
    soma, ehEntrada, ehSaida, doMes,
    carregarContexto, origemDoSaldo, orcamentoMensal, compromissosEmAberto,
    porCategoria, serieMensal,
    registrarTransacao, estornarTransacao, aportarMeta, deltaNaMeta,
    pagarParcela, desfazerPagamentoParcela,
    carregarDemo,
  };
})();
