window.FinckFinance = (() => {
  const U = window.FinckUtils;
  const S = window.FinckStore;

  const soma = (arr, campo = "amount") => arr.reduce((s, r) => s + Number(r[campo] || 0), 0);

  const ehEntrada = (t) => t.type === "entrada";
  const ehSaida = (t) => t.type === "saida";
  const doMes = (t, mes = U.mesAtual()) => String(t.date || "").slice(0, 7) === mes;

  // Estornada continua no histórico, mas fora de todo cálculo de saldo.
  // Todo lugar que soma dinheiro passa por aqui primeiro.
  const vigente = (t) => !t.reversed_at;
  const vigentes = (transacoes = []) => (transacoes || []).filter(vigente);
  const estornadas = (transacoes = []) => (transacoes || []).filter((t) => !vigente(t));

  async function carregarContexto() {
    const [
      perfil, todasTransacoes, metas, recorrentes, analises,
      contas, parcelamentos, pagamentos, transferencias, ajustes, movimentosMeta,
    ] = await Promise.all([
      S.obterPerfil(),
      S.listar("transactions", { ordem: "date", asc: false }),
      S.listar("goals", { ordem: "created_at", asc: false }),
      S.listar("recurring_transactions", { ordem: "day_of_month", asc: true }),
      S.listar("purchase_analyses", { ordem: "created_at", asc: false }),
      S.listar("accounts"),
      S.listar("installment_purchases"),
      S.listar("installment_payments"),
      S.listar("transfers"),
      S.listar("balance_adjustments"),
      S.listar("goal_movements", { ordem: "date", asc: false }),
    ]);

    const transacoes = vigentes(todasTransacoes);

    // Caixa é o que já aconteceu. Lançamento com data futura é compromisso
    // agendado: ele entra na projeção do mês dele, não no saldo de hoje.
    const hoje = U.hojeISO();
    const realizadas = transacoes.filter((t) => String(t.date || "") <= hoje);
    const futuras = transacoes.filter((t) => String(t.date || "") > hoje);

    const entradas = soma(realizadas.filter(ehEntrada));
    const saidas = soma(realizadas.filter(ehSaida));

    const origem = origemDoSaldo(perfil, contas);
    const saldoInicial = origem.saldoInicial;

    // Ajuste de conta muda o saldo sem passar por transação. Se ele não entrar
    // aqui, o saldo global deixa de bater com a soma das contas — que é
    // exatamente a divergência que o reconciliador acusaria.
    const ajusteContas = soma(ajustes);
    const saldo = saldoInicial + entradas - saidas + ajusteContas;

    const mes = U.mesAtual();
    const doMesAtual = realizadas.filter((t) => doMes(t, mes));
    const entradasMes = soma(doMesAtual.filter(ehEntrada));
    const saidasMes = soma(doMesAtual.filter(ehSaida));

    const ativos = recorrentes.filter((r) => r.active !== false);
    const previstoEntradas = soma(ativos.filter((r) => r.type === "entrada"));
    const despesasFixas = soma(ativos.filter((r) => r.type === "saida"));

    const orcamento = orcamentoMensal(perfil, despesasFixas);
    const compromissos = compromissosEmAberto(parcelamentos, pagamentos);

    // Composição do saldo: o usuário precisa conseguir conferir de onde ele vem,
    // não só ler o número final.
    const semConta = realizadas.filter((t) => !t.account_id);
    const naoAlocado =
      soma(semConta.filter(ehEntrada)) - soma(semConta.filter(ehSaida)) +
      (origem.fonte === "perfil" ? saldoInicial : 0);

    return {
      perfil, transacoes, metas, recorrentes, analises, contas, parcelamentos, pagamentos,
      transferencias, ajustes, movimentosMeta,
      todasTransacoes,
      transacoesEstornadas: estornadas(todasTransacoes),
      transacoesRealizadas: realizadas,
      transacoesFuturas: futuras,
      agendado: soma(futuras.filter(ehEntrada)) - soma(futuras.filter(ehSaida)),
      saldoInicial, entradas, saidas, saldo, ajusteContas,
      origemSaldo: origem,
      naoAlocado,
      semContaVinculada: semConta.length,
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
        : "",
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

  const M = () => window.FinckMetas;

  // O progresso da meta nunca é somado à mão: ele é sempre reescrito a partir
  // do livro-razão. É isso que garante "exatamente uma vez" mesmo se a mesma
  // operação for tentada de novo.
  async function recalcularMeta(goalId) {
    const movimentos = await S.listar("goal_movements", { filtro: { goal_id: goalId } });
    return S.atualizar("goals", goalId, {
      current_amount: M().progressoExibido(movimentos),
    });
  }

  // Meta que já tinha valor guardado e nenhum movimento é dado de antes do
  // livro-razão. Antes de escrever o primeiro movimento nela, o valor que já
  // estava lá vira um ajuste — senão o recálculo apagaria um progresso real
  // que o sistema simplesmente não sabe explicar ainda.
  async function garantirHistorico(goalId) {
    const movimentos = await S.listar("goal_movements", { filtro: { goal_id: goalId } });
    if (movimentos.length) return movimentos;

    const meta = await S.obter("goals", goalId);
    const guardado = Number(meta?.current_amount || 0);
    if (Math.abs(guardado) < M().TOLERANCIA) return movimentos;

    await S.inserir("goal_movements", M().paraRegistro({
      goal_id: goalId, kind: "ajuste", amount: guardado, date: U.hojeISO(),
      note: "Valor guardado antes do livro-razão",
    }));
    return S.listar("goal_movements", { filtro: { goal_id: goalId } });
  }

  // Grava a movimentação e o movimento de meta como um par. Se o segundo passo
  // falhar, o primeiro é desfeito: o caixa não fica reduzido por uma operação
  // que não completou.
  async function registrarTransacao(dados) {
    if (dados.goal_id) await garantirHistorico(dados.goal_id);

    const mov = await S.inserir("transactions", dados);
    if (!dados.goal_id) return mov;

    let movimento = null;
    try {
      movimento = await S.inserir("goal_movements", M().paraRegistro({
        goal_id: dados.goal_id,
        transaction_id: mov.id,
        kind: M().kindDoTipo(dados.type),
        amount: M().valorAssinado(dados.type, dados.amount),
        date: dados.date,
        note: dados.description,
      }));
      await recalcularMeta(dados.goal_id);
    } catch (err) {
      if (movimento) await S.remover("goal_movements", movimento.id).catch(() => {});
      await S.remover("transactions", mov.id).catch(() => {});
      throw err;
    }
    return mov;
  }

  // Estornar preserva o histórico: a movimentação continua na tabela, marcada,
  // fora do saldo, com data e motivo. O que reverte o progresso da meta é uma
  // linha nova de estorno, não a remoção da linha antiga.
  async function estornarTransacao(id, { motivo = null, chave = null } = {}) {
    const t = await S.obter("transactions", id);
    if (!t) return { removida: false, estornada: false, meta: null };

    if (t.reversed_at) {
      return {
        removida: false, estornada: true, repetida: true,
        meta: t.goal_id ? await S.obter("goals", t.goal_id) : null,
      };
    }

    // Caminho preferido: tudo numa transação de banco.
    const noBanco = await S.rpc("estornar_transacao", {
      p_transaction_id: id, p_reason: motivo, p_idem_key: chave,
    });
    if (noBanco.suportado) {
      const r = noBanco.dados || {};
      return {
        removida: false,
        estornada: Boolean(r.estornada),
        repetida: Boolean(r.repetida),
        estornouMeta: Boolean(t.goal_id),
        meta: r.goal || (t.goal_id ? await S.obter("goals", t.goal_id) : null),
        atomica: true,
      };
    }

    return S.operacao(chave, async () => {
      await S.atualizar("transactions", id, {
        reversed_at: new Date().toISOString(),
        reversal_reason: motivo,
      });

      // A previsão que gerou o lançamento volta a ficar em aberto, e a parcela
      // volta a ser compromisso. Nenhuma das duas pode continuar apontando
      // para dinheiro que não vale mais.
      await soltarVinculos(id);

      let meta = null;
      if (t.goal_id) {
        try {
          const movimentos = await S.listar("goal_movements", { filtro: { goal_id: t.goal_id } });
          const original = M().originalDaTransacao(movimentos, id);

          if (original && !M().jaEstornado(movimentos, original.id)) {
            await S.inserir("goal_movements", M().movimentoDoEstorno(original, {
              date: U.hojeISO(), note: motivo || "Estorno",
            }));
            await S.atualizar("goal_movements", original.id, { reversed_at: new Date().toISOString() });
          } else if (!original) {
            await S.inserir("goal_movements", M().estornoSemHistorico(t, {
              date: U.hojeISO(), note: motivo || "Estorno de lançamento sem histórico",
            }));
          }
          meta = await recalcularMeta(t.goal_id);
        } catch (err) {
          // Reverter o estorno é melhor do que deixar meta e caixa discordando.
          await S.atualizar("transactions", id, { reversed_at: null, reversal_reason: null }).catch(() => {});
          throw err;
        }
      }

      return { removida: false, estornada: true, repetida: false, meta, estornouMeta: Boolean(t.goal_id) };
    }, { operacao: "estornar_transacao" });
  }

  // Ocorrência e parcela que apontavam para o lançamento estornado voltam ao
  // estado aberto — o compromisso existe de novo.
  async function soltarVinculos(transacaoId) {
    const ocorrencias = await S.listar("recurring_occurrences", { filtro: { transaction_id: transacaoId } });
    for (const oc of ocorrencias) {
      await S.atualizar("recurring_occurrences", oc.id, {
        status: "pendente", actual_amount: null, transaction_id: null,
        decided_at: new Date().toISOString(),
      });
    }

    const parcelas = await S.listar("installment_payments", { filtro: { transaction_id: transacaoId } });
    for (const pg of parcelas) {
      await S.atualizar("installment_payments", pg.id, {
        status: "aberta", transaction_id: null, paid_at: null,
      });
    }
  }

  // Encosta o livro-razão no valor informado à mão. É o que permite criar uma
  // meta já com dinheiro guardado, ou regularizar uma meta antiga, sem abrir
  // exceção na regra de que o progresso vem do histórico.
  async function ajustarMeta(metaId, valorDesejado, nota = "Ajuste de saldo da meta") {
    const movimentos = await garantirHistorico(metaId);
    const atual = M().progresso(movimentos);
    const diferenca = Number(valorDesejado || 0) - atual;
    if (Math.abs(diferenca) < M().TOLERANCIA) return recalcularMeta(metaId);

    await S.inserir("goal_movements", M().paraRegistro({
      goal_id: metaId, kind: "ajuste", amount: diferenca, date: U.hojeISO(), note: nota,
    }));
    return recalcularMeta(metaId);
  }

  async function aportarMeta(metaId, valor, descricao = "Aporte em meta",
                             { account_id = null, unallocated = false, date = null, chave = null } = {}) {
    const montante = Number(valor);
    if (!(montante > 0)) throw new Error("Informe um valor maior que zero.");

    const quando = date || U.hojeISO();

    const noBanco = await S.rpc("aportar_meta", {
      p_goal_id: metaId, p_amount: montante, p_description: descricao,
      p_account_id: account_id, p_date: quando,
      p_unallocated: unallocated, p_idem_key: chave,
    });
    if (noBanco.suportado) return noBanco.dados?.goal || S.obter("goals", metaId);

    const meta = await S.obter("goals", metaId);
    if (!meta) throw new Error("Meta não encontrada.");

    return S.operacao(chave, async () => {
      await registrarTransacao({
        type: "saida", description: descricao, amount: montante,
        date: quando, category: "Reserva", goal_id: meta.id,
        account_id, unallocated: !account_id && unallocated,
      });
      return S.obter("goals", meta.id);
    }, { operacao: "aportar_meta" });
  }

  // Tirar dinheiro da meta é a mesma porta, com o sinal invertido. Sem isso, a
  // única forma de reduzir uma meta seria mexer no número direto — que é
  // exatamente o que o livro-razão existe para impedir.
  async function retirarMeta(metaId, valor, descricao = "Retirada da meta",
                             { account_id = null, unallocated = false, date = null, chave = null } = {}) {
    const montante = Number(valor);
    if (!(montante > 0)) throw new Error("Informe um valor maior que zero.");

    const quando = date || U.hojeISO();

    const noBanco = await S.rpc("retirar_meta", {
      p_goal_id: metaId, p_amount: montante, p_description: descricao,
      p_account_id: account_id, p_date: quando,
      p_unallocated: unallocated, p_idem_key: chave,
    });
    if (noBanco.suportado) return noBanco.dados?.goal || S.obter("goals", metaId);

    const meta = await S.obter("goals", metaId);
    if (!meta) throw new Error("Meta não encontrada.");

    return S.operacao(chave, async () => {
      await registrarTransacao({
        type: "entrada", description: descricao, amount: montante,
        date: quando, category: null, goal_id: meta.id,
        account_id, unallocated: !account_id && unallocated,
      });
      return S.obter("goals", meta.id);
    }, { operacao: "retirar_meta" });
  }

  // Quantas parcelas iniciais estão pagas em sequência. Mantém paid_count
  // honesto mesmo quando o usuário quita uma parcela fora de ordem.
  const pagasEmSequencia = (crono) => {
    let n = 0;
    for (const c of crono) { if (!c.paga) break; n++; }
    return n;
  };

  async function pagarParcela(parcelamento, numero,
                              { account_id = null, unallocated = false, date = null, chave = null } = {}) {
    const P = window.FinckPlano;
    const pagamentos = await S.listar("installment_payments", { filtro: { purchase_id: parcelamento.id } });
    const parcela = P.cronograma(parcelamento, pagamentos).find((c) => c.numero === Number(numero));
    if (!parcela) throw new Error("Parcela não encontrada.");

    // Idempotência: uma parcela já quitada não gera um segundo lançamento.
    if (parcela.paga) return { jaPaga: true, transaction_id: parcela.transaction_id };

    const vencimento = date || P.isoLocal(parcela.vencimento);

    const noBanco = await S.rpc("confirmar_parcela", {
      p_purchase_id: parcelamento.id,
      p_installment_no: parcela.numero,
      p_amount: parcela.valor,
      p_due_date: vencimento,
      p_description: null,
      p_account_id: account_id,
      p_unallocated: unallocated,
      p_idem_key: chave,
    });
    if (noBanco.suportado) {
      const r = noBanco.dados || {};
      return { jaPaga: Boolean(r.ja_paga), transaction_id: r.transaction_id, atomica: true };
    }

    return S.operacao(chave, async () => {
      const campos = P.movimentacaoDaParcela(parcelamento, parcela, { account_id, date });
      const mov = await S.inserir("transactions", {
        ...campos,
        unallocated: !campos.account_id && unallocated,
      });

      try {
        const registro = pagamentos.find((pg) => Number(pg.installment_no) === parcela.numero);
        const estado = { status: "paga", transaction_id: mov.id, paid_at: new Date().toISOString() };

        if (registro) await S.atualizar("installment_payments", registro.id, estado);
        else {
          await S.inserir("installment_payments", {
            purchase_id: parcelamento.id,
            installment_no: parcela.numero,
            due_date: P.isoLocal(parcela.vencimento),
            amount: parcela.valor,
            ...estado,
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
    }, { operacao: "confirmar_parcela" });
  }

  async function desfazerPagamentoParcela(parcelamento, numero) {
    const P = window.FinckPlano;

    const noBanco = await S.rpc("desfazer_parcela", {
      p_purchase_id: parcelamento.id, p_installment_no: Number(numero),
    });
    if (noBanco.suportado) {
      return { desfeita: Boolean(noBanco.dados?.desfeita), atomica: true };
    }

    const pagamentos = await S.listar("installment_payments", { filtro: { purchase_id: parcelamento.id } });
    const registro = pagamentos.find((pg) => Number(pg.installment_no) === Number(numero));
    if (!registro) return { desfeita: false };

    // Solta o vínculo antes de mexer no lançamento: a parcela nunca fica
    // apontando para dinheiro que já não conta.
    await S.atualizar("installment_payments", registro.id, {
      status: "aberta", transaction_id: null, paid_at: null,
    });

    // O pagamento existiu: ele é estornado, não apagado.
    if (registro.transaction_id) {
      await S.atualizar("transactions", registro.transaction_id, {
        reversed_at: new Date().toISOString(),
        reversal_reason: "Pagamento de parcela desfeito",
      });
    }

    const atualizados = await S.listar("installment_payments", { filtro: { purchase_id: parcelamento.id } });
    await S.atualizar("installment_purchases", parcelamento.id, {
      paid_count: pagasEmSequencia(P.cronograma(parcelamento, atualizados)),
    });

    return { desfeita: true };
  }

  // Transferência é a única operação que não muda o patrimônio: o que ela faz
  // é mover a alocação. Passa pela função do banco quando ela existe para que
  // as duas pontas mudem juntas ou não mudem.
  async function transferir({ from_account_id, to_account_id, amount, date = null, description = null, chave = null }) {
    const valor = Number(amount);
    if (!(valor > 0)) throw new Error("Informe um valor maior que zero.");
    if (String(from_account_id) === String(to_account_id)) {
      throw new Error("A conta de destino precisa ser diferente da origem.");
    }

    const quando = date || U.hojeISO();

    const noBanco = await S.rpc("transferir_contas", {
      p_from_account_id: from_account_id,
      p_to_account_id: to_account_id,
      p_amount: valor,
      p_date: quando,
      p_description: description,
      p_idem_key: chave,
    });
    if (noBanco.suportado) return noBanco.dados?.transfer || null;

    return S.operacao(chave, () => S.inserir("transfers", {
      from_account_id, to_account_id, amount: valor, date: quando, description,
    }), { operacao: "transferir_contas" });
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

    // A meta de exemplo nasce com o livro-razão em dia: o valor guardado é a
    // soma dos movimentos desde o primeiro dia, como em qualquer meta real.
    const metaReserva = await registrar("goals", {
      name: "Reserva de emergência", target_amount: 6000, current_amount: 1500,
      deadline: new Date(hoje.getFullYear(), hoje.getMonth() + 8, 1).toISOString().slice(0, 10), rate: 0,
    });
    if (metaReserva) await ajustarMeta(metaReserva.id, 1500, "Saldo inicial da meta de exemplo");

    const metaNotebook = await registrar("goals", {
      name: "Notebook para estudos", target_amount: 3200, current_amount: 400,
      deadline: new Date(hoje.getFullYear() + 1, 2, 1).toISOString().slice(0, 10), rate: 0,
    });
    if (metaNotebook) await ajustarMeta(metaNotebook.id, 400, "Saldo inicial da meta de exemplo");

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
    soma, ehEntrada, ehSaida, doMes, vigente, vigentes, estornadas,
    carregarContexto, origemDoSaldo, orcamentoMensal, compromissosEmAberto,
    porCategoria, serieMensal,
    registrarTransacao, estornarTransacao, soltarVinculos, garantirHistorico,
    aportarMeta, retirarMeta, ajustarMeta, recalcularMeta, deltaNaMeta,
    pagarParcela, desfazerPagamentoParcela, transferir,
    carregarDemo,
  };
})();
