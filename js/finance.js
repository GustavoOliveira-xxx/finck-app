window.FinckFinance = (() => {
  const U = window.FinckUtils;
  const S = window.FinckStore;
  const soma = (arr, campo = "amount") => arr.reduce((s, r) => s + Number(r[campo] || 0), 0);
  const ehEntrada = t => t.type === "entrada";
  const ehSaida = t => t.type === "saida";
  const doMes = (t, mes = U.mesAtual()) => String(t.date || "").slice(0, 7) === mes;
  const vigente = t => !t.reversed_at;
  const vigentes = (transacoes = []) => (transacoes || []).filter(vigente);
  const estornadas = (transacoes = []) => (transacoes || []).filter(t => !vigente(t));
  const realizadaAte = (t, hoje = U.hojeISO()) => String(t.date || "") <= hoje;
  const vigentesAteHoje = (transacoes = [], hoje = U.hojeISO()) => vigentes(transacoes).filter(t => realizadaAte(t, hoje));
  const vigentesFuturas = (transacoes = [], hoje = U.hojeISO()) => vigentes(transacoes).filter(t => !realizadaAte(t, hoje));
  const saldoDeMovimentos = (lista = []) => soma((lista || []).filter(ehEntrada)) - soma((lista || []).filter(ehSaida));
  function naoAlocadoDe(transacoes = [], origem = null, hoje = U.hojeISO()) {
    const semConta = vigentesAteHoje(transacoes, hoje).filter(t => !t.account_id);
    return saldoDeMovimentos(semConta) + (origem && origem.fonte === "perfil" ? Number(origem.saldoInicial || 0) : 0);
  }
  function alocacaoAmbigua(transacoes = [], contas = [], hoje = U.hojeISO()) {
    const ativas = (contas || []).filter(c => c.active !== false);
    if (!ativas.length) {
      return [];
    }
    return vigentesAteHoje(transacoes, hoje).filter(t => !t.account_id && !t.unallocated);
  }
  async function carregarContexto() {
    const [perfil, todasTransacoes, metas, recorrentes, analises, contas, parcelamentos, pagamentos, transferencias, ajustes, movimentosMeta] = await Promise.all([ S.obterPerfil(), S.listar("transactions", {
      ordem: "date",
      asc: false
    }), S.listar("goals", {
      ordem: "created_at",
      asc: false
    }), S.listar("recurring_transactions", {
      ordem: "day_of_month",
      asc: true
    }), S.listar("purchase_analyses", {
      ordem: "created_at",
      asc: false
    }), S.listar("accounts"), S.listar("installment_purchases"), S.listar("installment_payments"), S.listar("transfers"), S.listar("balance_adjustments"), S.listar("goal_movements", {
      ordem: "date",
      asc: false
    }) ]);
    const transacoes = vigentes(todasTransacoes);
    const hoje = U.hojeISO();
    const realizadas = vigentesAteHoje(todasTransacoes, hoje);
    const futuras = vigentesFuturas(todasTransacoes, hoje);
    const entradas = soma(realizadas.filter(ehEntrada));
    const saidas = soma(realizadas.filter(ehSaida));
    const origem = origemDoSaldo(perfil, contas);
    const saldoInicial = origem.saldoInicial;
    const ajusteContas = soma(ajustes);
    const saldo = saldoInicial + entradas - saidas + ajusteContas;
    const mes = U.mesAtual();
    const doMesAtual = realizadas.filter(t => doMes(t, mes));
    const entradasMes = soma(doMesAtual.filter(ehEntrada));
    const saidasMes = soma(doMesAtual.filter(ehSaida));
    const ativos = recorrentes.filter(r => r.active !== false);
    const previstoEntradas = soma(ativos.filter(r => r.type === "entrada"));
    const despesasFixas = soma(ativos.filter(r => r.type === "saida"));
    const orcamento = orcamentoMensal(perfil, despesasFixas);
    const compromissos = compromissosEmAberto(parcelamentos, pagamentos);
    const semConta = realizadas.filter(t => !t.account_id);
    const naoAlocado = naoAlocadoDe(todasTransacoes, origem, hoje);
    const ambiguas = alocacaoAmbigua(todasTransacoes, contas, hoje);
    return {
      perfil: perfil,
      transacoes: transacoes,
      metas: metas,
      recorrentes: recorrentes,
      analises: analises,
      contas: contas,
      parcelamentos: parcelamentos,
      pagamentos: pagamentos,
      transferencias: transferencias,
      ajustes: ajustes,
      movimentosMeta: movimentosMeta,
      todasTransacoes: todasTransacoes,
      transacoesEstornadas: estornadas(todasTransacoes),
      transacoesRealizadas: realizadas,
      transacoesFuturas: futuras,
      agendado: soma(futuras.filter(ehEntrada)) - soma(futuras.filter(ehSaida)),
      saldoInicial: saldoInicial,
      entradas: entradas,
      saidas: saidas,
      saldo: saldo,
      ajusteContas: ajusteContas,
      origemSaldo: origem,
      naoAlocado: naoAlocado,
      semContaVinculada: semConta.length,
      alocacaoAmbigua: ambiguas.length,
      hoje: hoje,
      entradasMes: entradasMes,
      saidasMes: saidasMes,
      doMesAtual: doMesAtual,
      previstoEntradas: previstoEntradas,
      despesasFixas: despesasFixas,
      ...orcamento,
      compromissosAbertos: compromissos,
      disponivelProjetado: saldo - compromissos,
      totalGuardado: soma(metas, "current_amount")
    };
  }
  function origemDoSaldo(perfil, contas = []) {
    const todas = contas || [];
    const ativas = todas.filter(c => c.active !== false);
    const saldoPerfil = Number(perfil?.initial_balance || 0);
    const saldoContas = ativas.reduce((s, c) => s + Number(c.initial_balance || 0), 0);
    const fonteContas = Boolean(todas.length || perfil?.initial_balance_source === "contas" || perfil?.initial_balance_migrated_at);
    if (!fonteContas) {
      return {
        fonte: "perfil",
        saldoInicial: saldoPerfil,
        saldoPerfil: saldoPerfil,
        saldoContas: 0,
        naoAlocado: saldoPerfil,
        duplicaria: 0,
        nota: "O saldo inicial veio do seu perfil. Ao cadastrar contas, ele passa a vir delas."
      };
    }
    return {
      fonte: "contas",
      saldoInicial: saldoContas,
      saldoPerfil: saldoPerfil,
      saldoContas: saldoContas,
      naoAlocado: 0,
      duplicaria: saldoPerfil,
      nota: saldoPerfil > 0 ? `O saldo inicial agora vem das suas contas (${U.moeda(saldoContas)}). Os ${U.moeda(saldoPerfil)} informados no perfil não são somados de novo.` : todas.length ? "O saldo inicial vem das contas ativas. Contas arquivadas permanecem no histórico, mas não voltam a ativar o saldo antigo do perfil." : "O saldo inicial já foi migrado para contas. O valor guardado no perfil é apenas histórico."
    };
  }
  function orcamentoMensal(perfil, despesasFixas) {
    const renda = Number(perfil?.income_monthly || 0);
    const fixas = Number(despesasFixas || 0);
    const sobraAposFixos = renda - fixas;
    const semFolga = renda > 0 && sobraAposFixos <= 0;
    return {
      renda: renda,
      sobraAposFixos: sobraAposFixos,
      deficitFixos: Math.max(0, -sobraAposFixos),
      semFolga: semFolga,
      rendaLivre: Math.max(0, sobraAposFixos),
      comprometidoPercent: renda > 0 ? fixas / renda * 100 : 0
    };
  }
  function compromissosEmAberto(parcelamentos = [], pagamentos = []) {
    const P = window.FinckPlano;
    if (!P) {
      return 0;
    }
    const porCompra = P.pagamentosPorCompra(pagamentos);
    return (parcelamentos || []).filter(p => p.active !== false).reduce((s, p) => s + P.saldoDevedor(p, porCompra.get(String(p.id)) || []), 0);
  }
  function porCategoria(transacoes) {
    const mapa = {};
    transacoes.filter(ehSaida).forEach(t => {
      const c = t.category || "Outros";
      mapa[c] = (mapa[c] || 0) + Number(t.amount || 0);
    });
    return Object.entries(mapa).map(([categoria, valor]) => ({
      categoria: categoria,
      valor: valor
    })).sort((a, b) => b.valor - a.valor);
  }
  function serieMensal(transacoes, meses = 6) {
    const hoje = new Date;
    const saida = [];
    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const chave = U.mesISO(d);
      const doPeriodo = transacoes.filter(t => String(t.date || "").slice(0, 7) === chave);
      const e = soma(doPeriodo.filter(ehEntrada));
      const s = soma(doPeriodo.filter(ehSaida));
      saida.push({
        mes: chave,
        rotulo: d.toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit"
        }),
        entradas: e,
        saidas: s,
        resultado: e - s
      });
    }
    return saida;
  }
  const deltaNaMeta = (tipo, valor) => (tipo === "saida" ? 1 : -1) * Number(valor || 0);
  const M = () => window.FinckMetas;
  async function recalcularMeta(goalId) {
    const movimentos = await S.listar("goal_movements", {
      filtro: {
        goal_id: goalId
      }
    });
    return S.atualizar("goals", goalId, {
      current_amount: M().progressoExibido(movimentos)
    });
  }
  async function garantirHistorico(goalId) {
    const movimentos = await S.listar("goal_movements", {
      filtro: {
        goal_id: goalId
      }
    });
    if (movimentos.length) {
      return movimentos;
    }
    const meta = await S.obter("goals", goalId);
    const guardado = Number(meta?.current_amount || 0);
    if (Math.abs(guardado) < M().TOLERANCIA) {
      return movimentos;
    }
    await S.inserir("goal_movements", M().paraRegistro({
      goal_id: goalId,
      kind: "ajuste",
      amount: guardado,
      date: U.hojeISO(),
      note: "Valor guardado antes do livro-razão"
    }));
    return S.listar("goal_movements", {
      filtro: {
        goal_id: goalId
      }
    });
  }
  async function registrarTransacao(dados) {
    if (dados.goal_id) {
      await garantirHistorico(dados.goal_id);
    }
    const mov = await S.inserir("transactions", dados);
    if (!dados.goal_id) {
      return mov;
    }
    let movimento = null;
    try {
      movimento = await S.inserir("goal_movements", M().paraRegistro({
        goal_id: dados.goal_id,
        transaction_id: mov.id,
        kind: M().kindDoTipo(dados.type),
        amount: M().valorAssinado(dados.type, dados.amount),
        date: dados.date,
        note: dados.description
      }));
      await recalcularMeta(dados.goal_id);
    } catch (err) {
      if (movimento) {
        await S.remover("goal_movements", movimento.id).catch(() => {});
      }
      await S.remover("transactions", mov.id).catch(() => {});
      throw err;
    }
    return mov;
  }
  async function estornarTransacao(id, {motivo: motivo = null, chave: chave = null} = {}) {
    const t = await S.obter("transactions", id);
    if (!t) {
      return {
        removida: false,
        estornada: false,
        meta: null
      };
    }
    if (t.reversed_at) {
      return {
        removida: false,
        estornada: true,
        repetida: true,
        meta: t.goal_id ? await S.obter("goals", t.goal_id) : null
      };
    }
    const noBanco = await S.rpc("estornar_transacao", {
      p_transaction_id: id,
      p_reason: motivo,
      p_idem_key: chave
    });
    if (noBanco.suportado) {
      const r = noBanco.dados || {};
      return {
        removida: false,
        estornada: Boolean(r.estornada),
        repetida: Boolean(r.repetida),
        estornouMeta: Boolean(t.goal_id),
        meta: r.goal || (t.goal_id ? await S.obter("goals", t.goal_id) : null),
        atomica: true
      };
    }
    return S.operacao(chave, async () => {
      await S.atualizar("transactions", id, {
        reversed_at: (new Date).toISOString(),
        reversal_reason: motivo
      });
      await soltarVinculos(id);
      let meta = null;
      if (t.goal_id) {
        try {
          const movimentos = await S.listar("goal_movements", {
            filtro: {
              goal_id: t.goal_id
            }
          });
          const original = M().originalDaTransacao(movimentos, id);
          if (original && !M().jaEstornado(movimentos, original.id)) {
            await S.inserir("goal_movements", M().movimentoDoEstorno(original, {
              date: U.hojeISO(),
              note: motivo || "Estorno"
            }));
            await S.atualizar("goal_movements", original.id, {
              reversed_at: (new Date).toISOString()
            });
          } else if (!original) {
            await S.inserir("goal_movements", M().estornoSemHistorico(t, {
              date: U.hojeISO(),
              note: motivo || "Estorno de lançamento sem histórico"
            }));
          }
          meta = await recalcularMeta(t.goal_id);
        } catch (err) {
          await S.atualizar("transactions", id, {
            reversed_at: null,
            reversal_reason: null
          }).catch(() => {});
          throw err;
        }
      }
      return {
        removida: false,
        estornada: true,
        repetida: false,
        meta: meta,
        estornouMeta: Boolean(t.goal_id)
      };
    }, {
      operacao: "estornar_transacao"
    });
  }
  async function soltarVinculos(transacaoId) {
    const ocorrencias = await S.listar("recurring_occurrences", {
      filtro: {
        transaction_id: transacaoId
      }
    });
    for (const oc of ocorrencias) {
      await S.atualizar("recurring_occurrences", oc.id, {
        status: "pendente",
        actual_amount: null,
        transaction_id: null,
        decided_at: (new Date).toISOString()
      });
    }
    const parcelas = await S.listar("installment_payments", {
      filtro: {
        transaction_id: transacaoId
      }
    });
    for (const pg of parcelas) {
      await S.atualizar("installment_payments", pg.id, {
        status: "aberta",
        transaction_id: null,
        paid_at: null
      });
    }
  }
  async function ajustarMeta(metaId, valorDesejado, nota = "Ajuste de saldo da meta") {
    const movimentos = await garantirHistorico(metaId);
    const atual = M().progresso(movimentos);
    const diferenca = Number(valorDesejado || 0) - atual;
    if (Math.abs(diferenca) < M().TOLERANCIA) {
      return recalcularMeta(metaId);
    }
    await S.inserir("goal_movements", M().paraRegistro({
      goal_id: metaId,
      kind: "ajuste",
      amount: diferenca,
      date: U.hojeISO(),
      note: nota
    }));
    return recalcularMeta(metaId);
  }
  async function aportarMeta(metaId, valor, descricao = "Aporte em meta", {account_id: account_id = null, unallocated: unallocated = false, date: date = null, chave: chave = null} = {}) {
    const montante = Number(valor);
    if (!(montante > 0)) {
      throw new Error("Informe um valor maior que zero.");
    }
    const quando = date || U.hojeISO();
    const noBanco = await S.rpc("aportar_meta", {
      p_goal_id: metaId,
      p_amount: montante,
      p_description: descricao,
      p_account_id: account_id,
      p_date: quando,
      p_unallocated: unallocated,
      p_idem_key: chave
    });
    if (noBanco.suportado) {
      return noBanco.dados?.goal || S.obter("goals", metaId);
    }
    const meta = await S.obter("goals", metaId);
    if (!meta) {
      throw new Error("Meta não encontrada.");
    }
    return S.operacao(chave, async () => {
      await registrarTransacao({
        type: "saida",
        description: descricao,
        amount: montante,
        date: quando,
        category: "Reserva",
        goal_id: meta.id,
        account_id: account_id,
        unallocated: !account_id && unallocated
      });
      return S.obter("goals", meta.id);
    }, {
      operacao: "aportar_meta"
    });
  }
  async function retirarMeta(metaId, valor, descricao = "Retirada da meta", {account_id: account_id = null, unallocated: unallocated = false, date: date = null, chave: chave = null} = {}) {
    const montante = Number(valor);
    if (!(montante > 0)) {
      throw new Error("Informe um valor maior que zero.");
    }
    const quando = date || U.hojeISO();
    const noBanco = await S.rpc("retirar_meta", {
      p_goal_id: metaId,
      p_amount: montante,
      p_description: descricao,
      p_account_id: account_id,
      p_date: quando,
      p_unallocated: unallocated,
      p_idem_key: chave
    });
    if (noBanco.suportado) {
      return noBanco.dados?.goal || S.obter("goals", metaId);
    }
    const meta = await S.obter("goals", metaId);
    if (!meta) {
      throw new Error("Meta não encontrada.");
    }
    return S.operacao(chave, async () => {
      await registrarTransacao({
        type: "entrada",
        description: descricao,
        amount: montante,
        date: quando,
        category: null,
        goal_id: meta.id,
        account_id: account_id,
        unallocated: !account_id && unallocated
      });
      return S.obter("goals", meta.id);
    }, {
      operacao: "retirar_meta"
    });
  }
  const pagasEmSequencia = crono => {
    let n = 0;
    for (const c of crono) {
      if (!c.paga) {
        break;
      }
      n++;
    }
    return n;
  };
  async function pagarParcela(parcelamento, numero, {account_id: account_id = null, unallocated: unallocated = false, date: date = null, chave: chave = null} = {}) {
    const P = window.FinckPlano;
    const pagamentos = await S.listar("installment_payments", {
      filtro: {
        purchase_id: parcelamento.id
      }
    });
    const parcela = P.cronograma(parcelamento, pagamentos).find(c => c.numero === Number(numero));
    if (!parcela) {
      throw new Error("Parcela não encontrada.");
    }
    if (parcela.paga) {
      return {
        jaPaga: true,
        transaction_id: parcela.transaction_id
      };
    }
    const vencimento = date || P.isoLocal(parcela.vencimento);
    const noBanco = await S.rpc("confirmar_parcela", {
      p_purchase_id: parcelamento.id,
      p_installment_no: parcela.numero,
      p_amount: parcela.valor,
      p_due_date: vencimento,
      p_description: null,
      p_account_id: account_id,
      p_unallocated: unallocated,
      p_idem_key: chave
    });
    if (noBanco.suportado) {
      const r = noBanco.dados || {};
      return {
        jaPaga: Boolean(r.ja_paga),
        transaction_id: r.transaction_id,
        atomica: true
      };
    }
    return S.operacao(chave, async () => {
      const campos = P.movimentacaoDaParcela(parcelamento, parcela, {
        account_id: account_id,
        date: date
      });
      const mov = await S.inserir("transactions", {
        ...campos,
        unallocated: !campos.account_id && unallocated
      });
      try {
        const registro = pagamentos.find(pg => Number(pg.installment_no) === parcela.numero);
        const estado = {
          status: "paga",
          transaction_id: mov.id,
          paid_at: (new Date).toISOString()
        };
        if (registro) {
          await S.atualizar("installment_payments", registro.id, estado);
        } else {
          await S.inserir("installment_payments", {
            purchase_id: parcelamento.id,
            installment_no: parcela.numero,
            due_date: P.isoLocal(parcela.vencimento),
            amount: parcela.valor,
            ...estado
          });
        }
        const atualizados = await S.listar("installment_payments", {
          filtro: {
            purchase_id: parcelamento.id
          }
        });
        await S.atualizar("installment_purchases", parcelamento.id, {
          paid_count: pagasEmSequencia(P.cronograma(parcelamento, atualizados))
        });
      } catch (err) {
        await S.remover("transactions", mov.id).catch(() => {});
        throw err;
      }
      return {
        jaPaga: false,
        transaction_id: mov.id
      };
    }, {
      operacao: "confirmar_parcela"
    });
  }
  async function desfazerPagamentoParcela(parcelamento, numero) {
    const P = window.FinckPlano;
    const noBanco = await S.rpc("desfazer_parcela", {
      p_purchase_id: parcelamento.id,
      p_installment_no: Number(numero)
    });
    if (noBanco.suportado) {
      return {
        desfeita: Boolean(noBanco.dados?.desfeita),
        atomica: true
      };
    }
    const pagamentos = await S.listar("installment_payments", {
      filtro: {
        purchase_id: parcelamento.id
      }
    });
    const registro = pagamentos.find(pg => Number(pg.installment_no) === Number(numero));
    if (!registro) {
      return {
        desfeita: false
      };
    }
    await S.atualizar("installment_payments", registro.id, {
      status: "aberta",
      transaction_id: null,
      paid_at: null
    });
    if (registro.transaction_id) {
      await S.atualizar("transactions", registro.transaction_id, {
        reversed_at: (new Date).toISOString(),
        reversal_reason: "Pagamento de parcela desfeito"
      });
    }
    const atualizados = await S.listar("installment_payments", {
      filtro: {
        purchase_id: parcelamento.id
      }
    });
    await S.atualizar("installment_purchases", parcelamento.id, {
      paid_count: pagasEmSequencia(P.cronograma(parcelamento, atualizados))
    });
    return {
      desfeita: true
    };
  }
  async function transferir({from_account_id: from_account_id, to_account_id: to_account_id, amount: amount, date: date = null, description: description = null, chave: chave = null}) {
    const valor = Number(amount);
    if (!(valor > 0)) {
      throw new Error("Informe um valor maior que zero.");
    }
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
      p_idem_key: chave
    });
    if (noBanco.suportado) {
      return noBanco.dados?.transfer || null;
    }
    return S.operacao(chave, () => S.inserir("transfers", {
      from_account_id: from_account_id,
      to_account_id: to_account_id,
      amount: valor,
      date: quando,
      description: description
    }), {
      operacao: "transferir_contas"
    });
  }
  // CODE-005 / PROD-003 — fonte única dos dados de demonstração.
  //
  // As datas são deslocamentos em dias a partir de hoje, não dias fixos do mês:
  // assim o conjunto continua coerente em qualquer data do sistema, com sempre
  // três lançamentos já realizados e três ainda previstos. Antes, os dias fixos
  // 9, 10 e 12 apareciam como realizados ou futuros dependendo do dia em que a
  // demo fosse aberta.
  //
  // Invariante da demonstração: saldo atual = 1200 + 3500 − 1200 − 620 = 2880,
  // e o previsto (−675) nunca entra nesse número.
  const FIXTURE_DEMO = {
    perfil: {
      name: "Usuário Demonstração",
      income_monthly: 3500,
      income_type: "fixa",
      payday: 5,
      work_days_month: 22,
      work_hours_day: 8,
      initial_balance: 1200,
      setup_mode: "demo"
    },
    transacoes: [ {
      dias: -3,
      regime: "realizado",
      type: "entrada",
      description: "Salário",
      amount: 3500,
      category: "Salário"
    }, {
      dias: -2,
      regime: "realizado",
      type: "saida",
      description: "Aluguel",
      amount: 1200,
      category: "Moradia"
    }, {
      dias: 0,
      regime: "realizado",
      type: "saida",
      description: "Mercado",
      amount: 620,
      category: "Alimentação"
    }, {
      dias: 1,
      regime: "previsto",
      type: "saida",
      description: "Transporte",
      amount: 240,
      category: "Transporte"
    }, {
      dias: 2,
      regime: "previsto",
      type: "saida",
      description: "Streaming",
      amount: 55,
      category: "Lazer"
    }, {
      dias: 4,
      regime: "previsto",
      type: "saida",
      description: "Tênis novo",
      amount: 380,
      category: "Vestuário"
    } ],
    recorrentes: [ {
      description: "Salário",
      type: "entrada",
      amount: 3500,
      dias: -3
    }, {
      description: "Aluguel",
      type: "saida",
      amount: 1200,
      dias: -2
    }, {
      description: "Internet",
      type: "saida",
      amount: 99,
      dias: 2
    }, {
      description: "Streaming",
      type: "saida",
      amount: 55,
      dias: 2
    } ],
    metas: [ {
      name: "Reserva de emergência",
      target_amount: 6e3,
      current_amount: 1500,
      mesesAteOPrazo: 8
    }, {
      name: "Notebook para estudos",
      target_amount: 3200,
      current_amount: 400,
      mesesAteOPrazo: 18
    } ],
    analise: {
      diasAtras: 4,
      item_name: "Fone de ouvido premium",
      price: 800,
      category: "Eletrônicos",
      work_days: 5.03,
      work_hours: 40.22,
      income_percent: 22.86,
      impact_level: "atencao",
      decision: "adiar",
      reflections: {
        necessidade: "É impulso",
        uso: "Uso ocasional",
        durabilidade: "Alta, com garantia",
        alternativas: "Existe opção usada",
        orcamento: "Aperta um pouco",
        descarte: "Uso por muitos anos"
      },
      note: "Vou reavaliar em 30 dias."
    }
  };
  function datasDaDemo(hoje = new Date) {
    const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    // Um recuo nunca atravessa para o mês anterior: se hoje é dia 2, o salário
    // cai no dia 1 em vez do dia 30 passado, e o mês da demo continua fechando.
    const emDias = n => {
      const d = new Date(base);
      d.setDate(n < 0 ? Math.max(1, base.getDate() + n) : base.getDate() + n);
      return d;
    };
    return {
      base: base,
      emDias: emDias,
      iso: n => U.dataISO(emDias(n))
    };
  }
  async function carregarDemo({substituir: substituir = false} = {}) {
    if (substituir) {
      await S.limparDados();
    }
    const hoje = new Date;
    const {emDias: emDias, iso: iso} = datasDaDemo(hoje);
    const resumo = {
      inseridos: 0,
      jaExistiam: 0
    };
    const cache = {};
    const registrar = async (tabela, linha) => {
      if (!cache[tabela]) {
        cache[tabela] = await S.listar(tabela);
      }
      const criado = await S.inserirSeNovo(tabela, linha, cache[tabela]);
      if (criado) {
        cache[tabela].push(criado);
        resumo.inseridos++;
      } else {
        resumo.jaExistiam++;
      }
      return criado;
    };
    await S.salvarPerfil({
      ...FIXTURE_DEMO.perfil,
      onboarded_at: (new Date).toISOString()
    });
    for (const t of FIXTURE_DEMO.transacoes) {
      const {dias: dias, regime: regime, ...campos} = t;
      await registrar("transactions", {
        ...campos,
        date: iso(dias)
      });
    }
    for (const r of FIXTURE_DEMO.recorrentes) {
      const {dias: dias, ...campos} = r;
      await registrar("recurring_transactions", {
        ...campos,
        day_of_month: emDias(dias).getDate(),
        active: true
      });
    }
    for (const m of FIXTURE_DEMO.metas) {
      const {mesesAteOPrazo: mesesAteOPrazo, ...campos} = m;
      const meta = await registrar("goals", {
        ...campos,
        deadline: U.dataISO(new Date(hoje.getFullYear(), hoje.getMonth() + mesesAteOPrazo, 1)),
        rate: 0
      });
      if (meta) {
        await ajustarMeta(meta.id, Number(campos.current_amount), "Saldo inicial da meta de exemplo");
      }
    }
    const {diasAtras: diasAtras, ...analise} = FIXTURE_DEMO.analise;
    await registrar("purchase_analyses", {
      ...analise,
      responsibility_score: window.FinckReality ? window.FinckReality.indicadorResponsavel(analise.reflections).pontuacao : null,
      responsibility_label: window.FinckReality ? window.FinckReality.indicadorResponsavel(analise.reflections).nivel : null,
      analyzed_at: `${iso(-diasAtras)}T12:00:00.000Z`
    });
    return resumo;
  }
  // Recarregar a demo por cima dela mesma não pode duplicar nada: inserirSeNovo
  // já compara por assinatura, e substituir: true limpa antes de semear.
  const resetarDemo = () => carregarDemo({
    substituir: true
  });
  return {
    soma: soma,
    ehEntrada: ehEntrada,
    ehSaida: ehSaida,
    doMes: doMes,
    vigente: vigente,
    vigentes: vigentes,
    estornadas: estornadas,
    realizadaAte: realizadaAte,
    vigentesAteHoje: vigentesAteHoje,
    vigentesFuturas: vigentesFuturas,
    saldoDeMovimentos: saldoDeMovimentos,
    naoAlocadoDe: naoAlocadoDe,
    alocacaoAmbigua: alocacaoAmbigua,
    carregarContexto: carregarContexto,
    origemDoSaldo: origemDoSaldo,
    orcamentoMensal: orcamentoMensal,
    compromissosEmAberto: compromissosEmAberto,
    porCategoria: porCategoria,
    serieMensal: serieMensal,
    registrarTransacao: registrarTransacao,
    estornarTransacao: estornarTransacao,
    soltarVinculos: soltarVinculos,
    garantirHistorico: garantirHistorico,
    aportarMeta: aportarMeta,
    retirarMeta: retirarMeta,
    ajustarMeta: ajustarMeta,
    recalcularMeta: recalcularMeta,
    deltaNaMeta: deltaNaMeta,
    pagarParcela: pagarParcela,
    desfazerPagamentoParcela: desfazerPagamentoParcela,
    transferir: transferir,
    carregarDemo: carregarDemo,
    resetarDemo: resetarDemo,
    datasDaDemo: datasDaDemo,
    FIXTURE_DEMO: FIXTURE_DEMO
  };
})();
