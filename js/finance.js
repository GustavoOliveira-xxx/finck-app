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
  // Projeções com nome explícito: cada uma responde a uma pergunta só e leva a
  // base de cálculo no nome. Um campo genérico de "disponível" fazia a home
  // mostrar dois números que pareciam responder à mesma pergunta com valores
  // opostos. A janela de previsão é fixa em 60 dias, a mesma da programação.
  const JANELA_PREVISOES = 60;
  function projecoesDe({saldo: saldo = 0, renda: renda = 0, despesasFixas: despesasFixas = 0, parcelasAPagar: parcelasAPagar = 0, saidasPrevistas: saidasPrevistas = null, entradasPrevistas: entradasPrevistas = null, menorCaixaComEntradas: menorCaixaComEntradas = null, descobertoEm: descobertoEm = null} = {}) {
    const s = Number(saldo) || 0;
    const parcelas = Number(parcelasAPagar) || 0;
    const saidas = saidasPrevistas === null || saidasPrevistas === undefined ? null : Number(saidasPrevistas) || 0;
    const menor = Number(menorCaixaComEntradas);
    return {
      // Menor saldo do período contando entradas e saídas na ordem das datas.
      // Sem a programação dia a dia, fica a conta sem entradas, que é a mais
      // cautelosa. É ele que decide se a home avisa que vai faltar dinheiro.
      menorCaixaComEntradas60Dias: saidas === null ? null : menorCaixaComEntradas !== null && Number.isFinite(menor) ? menor : s - saidas,
      descobertoEm60Dias: saidas === null ? null : descobertoEm || null,
      janelaDias: JANELA_PREVISOES,
      saldoAtual: s,
      parcelasAPagar: parcelas,
      saldoAposParcelas: s - parcelas,
      sobraRendaAposFixos: (Number(renda) || 0) - (Number(despesasFixas) || 0),
      saidasPrevistas60Dias: saidas,
      entradasPrevistas60Dias: saidas === null ? null : Number(entradasPrevistas) || 0,
      // null quando a tela não carregou a programação (js/programacao.js).
      caixaAposPrevisoes60Dias: saidas === null ? null : s - saidas
    };
  }
  async function carregarContexto() {
    // A programação de 60 dias só é montada nas telas que carregam
    // js/programacao.js; as outras não pagam a leitura das ocorrências.
    const Prog = window.FinckProgramacao;
    const [perfil, todasTransacoes, metas, recorrentes, analises, contas, parcelamentos, pagamentos, transferencias, ajustes, movimentosMeta, ocorrencias] = await Promise.all([ S.obterPerfil(), S.listar("transactions", {
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
    }), Prog ? S.listar("recurring_occurrences", {
      ordem: "due_date",
      asc: true
    }).catch(() => []) : Promise.resolve([]) ]);
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
    const ocorrenciasVigentes = Prog ? Prog.ocorrenciasVigentes(ocorrencias, recorrentes) : ocorrencias;
    const programacao = Prog ? Prog.panorama({
      ocorrencias: ocorrenciasVigentes,
      recorrentes: recorrentes,
      parcelamentos: parcelamentos,
      pagamentos: pagamentos,
      agendadas: futuras
    }, saldo, {
      dias: JANELA_PREVISOES
    }) : null;
    const projecoes = projecoesDe({
      saldo: saldo,
      renda: orcamento.renda,
      despesasFixas: despesasFixas,
      parcelasAPagar: compromissos,
      saidasPrevistas: programacao ? programacao.comprometidoTotal : null,
      entradasPrevistas: programacao ? programacao.entradasPrevistas : null,
      menorCaixaComEntradas: programacao ? programacao.menorCaixaComEntradas : null,
      descobertoEm: programacao ? programacao.descobertoComEntradasEm : null
    });
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
      // Mantido para o Reality e o diagnóstico: é o mesmo que
      // projecoes.saldoAposParcelas (saldo menos parcelas ainda a pagar).
      disponivelProjetado: saldo - compromissos,
      projecoes: projecoes,
      programacao: programacao,
      // Só vem preenchido nas telas que carregam a programação.
      ocorrencias: ocorrenciasVigentes,
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
    // A semente da demonstração divide o saldo do perfil entre as duas contas
    // de exemplo; ali a nota técnica de migração não diz nada a quem visita.
    const demoDividida = perfil?.setup_mode === "demo" && Boolean(S.emDemo?.()) && ativas.length === 2 && Math.abs(saldoContas - saldoPerfil) < .005;
    return {
      fonte: "contas",
      saldoInicial: saldoContas,
      saldoPerfil: saldoPerfil,
      saldoContas: saldoContas,
      naoAlocado: 0,
      duplicaria: saldoPerfil,
      nota: demoDividida ? "Na demonstração, o saldo inicial de exemplo está dividido entre as duas contas." : saldoPerfil > 0 ? `O saldo inicial agora vem das suas contas (${U.moeda(saldoContas)}). Os ${U.moeda(saldoPerfil)} informados no perfil não são somados de novo.` : todas.length ? "O saldo inicial vem das contas ativas. Contas arquivadas permanecem no histórico, mas não voltam a ativar o saldo antigo do perfil." : "O saldo inicial já foi migrado para contas. O valor guardado no perfil é apenas histórico."
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
  // Fonte única dos dados de demonstração.
  //
  // As datas são deslocamentos em dias a partir de hoje, não dias fixos do mês:
  // assim o conjunto continua coerente em qualquer data do sistema, com sempre
  // três lançamentos já realizados e dois ainda previstos. Antes, os dias fixos
  // 9, 10 e 12 apareciam como realizados ou futuros dependendo do dia em que a
  // demo fosse aberta. O streaming é só recorrência: como lançamento previsto
  // também, confirmar a recorrência criava um segundo e a programação somava
  // os dois.
  //
  // Invariante da demonstração: saldo atual = 1200 + 3500 − 1200 − 620 = 2880
  // (o histórico dos meses anteriores soma zero), dividido entre Conta corrente 2580 e Carteira 300 (100 de saldo inicial
  // mais o saque de 200; js/store.js prepararContasDemo). O previsto (−620)
  // nunca entra nesse número.
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
      // A base da época, como o Reality grava: sem ela, o histórico mostrava
      // salário R$ 0,00 ao lado de 40 h de trabalho. O saldo é o de quatro
      // dias atrás, antes do salário de exemplo.
      income_base: 3500,
      income_type: "fixa",
      work_days_month: 22,
      work_hours_day: 8,
      hour_value: 19.89,
      day_value: 159.09,
      free_income: 2146,
      balance_before: 1200,
      balance_after: 400,
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
    },
    // Quatro meses anteriores, para a leitura de hábitos ter o que mostrar.
    // O salário e as contas fixas caem nos mesmos dias das recorrências; os
    // gastos do dia a dia são contados em dias para trás a partir de hoje
    // (de 1 a 120), então os três meses completos e os últimos 30 e 90 dias
    // sempre têm movimento, em qualquer data. Invariante: o histórico soma
    // zero. As entradas (4 × 3500 + 250) pagam exatamente as fixas (4 × 1354)
    // e o dia a dia (8834), e o saldo atual continua 2880.
    historico: {
      meses: 4,
      categoriasFixas: {
        Salário: "Salário",
        Aluguel: "Moradia",
        Internet: "Moradia",
        Streaming: "Lazer"
      },
      entradas: [ {
        mes: -2,
        dia: 20,
        description: "Freela de design",
        amount: 250,
        category: "Outros"
      } ],
      // [dias atrás, descrição, categoria, valor]. O consumo cresce nos
      // ciclos mais recentes: é o que a leitura de hábitos tem de mostrar.
      diaADia: [
        [ 1, "Delivery", "Alimentação", 42.9 ],
        [ 2, "Lanche", "Alimentação", 14.5 ],
        [ 3, "Café", "Alimentação", 9.5 ],
        [ 3, "Pizza com amigos", "Lazer", 151.3 ],
        [ 4, "Delivery", "Alimentação", 38.5 ],
        [ 5, "Transporte por aplicativo", "Transporte", 24.9 ],
        [ 6, "Lanche", "Alimentação", 12 ],
        [ 7, "Bar com amigos", "Lazer", 128 ],
        [ 8, "Delivery", "Alimentação", 45 ],
        [ 8, "Restaurante", "Alimentação", 96.4 ],
        [ 9, "Hortifruti", "Alimentação", 58.4 ],
        [ 9, "Transporte por aplicativo", "Transporte", 31.5 ],
        [ 10, "Café", "Alimentação", 11 ],
        [ 11, "Farmácia", "Saúde", 67.8 ],
        [ 11, "Lanche", "Alimentação", 18.9 ],
        [ 12, "Delivery", "Alimentação", 39.9 ],
        [ 13, "Cinema", "Lazer", 52 ],
        [ 14, "Conta de luz", "Moradia", 126.3 ],
        [ 14, "Ingresso de festa", "Lazer", 85 ],
        [ 14, "Transporte por aplicativo", "Transporte", 19.8 ],
        [ 15, "Lanche", "Alimentação", 16.5 ],
        [ 16, "Café", "Alimentação", 8.5 ],
        [ 17, "Delivery", "Alimentação", 47.5 ],
        [ 17, "Jogo no celular", "Lazer", 29.9 ],
        [ 18, "Mercado", "Alimentação", 412.6 ],
        [ 19, "Transporte por aplicativo", "Transporte", 27.4 ],
        [ 20, "Lanche", "Alimentação", 13 ],
        [ 20, "Restaurante", "Alimentação", 118.7 ],
        [ 21, "Bar com amigos", "Lazer", 96 ],
        [ 22, "Café", "Alimentação", 12 ],
        [ 22, "Calça", "Vestuário", 159 ],
        [ 23, "Delivery", "Alimentação", 36 ],
        [ 24, "Recarga do bilhete", "Transporte", 120 ],
        [ 25, "Lanche", "Alimentação", 21 ],
        [ 26, "Transporte por aplicativo", "Transporte", 22 ],
        [ 27, "Delivery", "Alimentação", 44.9 ],
        [ 27, "Show", "Lazer", 180 ],
        [ 28, "Lanche", "Alimentação", 15.5 ],
        [ 29, "Delivery", "Alimentação", 41 ],
        [ 31, "Delivery", "Alimentação", 39 ],
        [ 32, "Lanche", "Alimentação", 15 ],
        [ 33, "Café", "Alimentação", 10 ],
        [ 34, "Delivery", "Alimentação", 44 ],
        [ 35, "Transporte por aplicativo", "Transporte", 26 ],
        [ 37, "Bar com amigos", "Lazer", 85 ],
        [ 38, "Restaurante", "Alimentação", 102.3 ],
        [ 39, "Transporte por aplicativo", "Transporte", 21.5 ],
        [ 40, "Jaqueta", "Vestuário", 219 ],
        [ 41, "Farmácia", "Saúde", 54.3 ],
        [ 41, "Lanche", "Alimentação", 13.5 ],
        [ 42, "Delivery", "Alimentação", 41.5 ],
        [ 43, "Cinema", "Lazer", 48 ],
        [ 44, "Conta de luz", "Moradia", 118.4 ],
        [ 45, "Carregador", "Eletrônicos", 89.9 ],
        [ 45, "Lanche", "Alimentação", 17 ],
        [ 46, "Café", "Alimentação", 9 ],
        [ 47, "Delivery", "Alimentação", 37.9 ],
        [ 48, "Mercado", "Alimentação", 446.4 ],
        [ 49, "Presente de aniversário", "Outros", 120 ],
        [ 49, "Transporte por aplicativo", "Transporte", 29 ],
        [ 50, "Lanche", "Alimentação", 14 ],
        [ 50, "Restaurante", "Alimentação", 88.5 ],
        [ 51, "Bar com amigos", "Lazer", 79 ],
        [ 53, "Delivery", "Alimentação", 42 ],
        [ 54, "Recarga do bilhete", "Transporte", 120 ],
        [ 60, "Mercado", "Alimentação", 438.7 ],
        [ 61, "Delivery", "Alimentação", 40 ],
        [ 62, "Lanche", "Alimentação", 14 ],
        [ 63, "Café", "Alimentação", 9.5 ],
        [ 65, "Transporte por aplicativo", "Transporte", 23 ],
        [ 66, "Lanche", "Alimentação", 16 ],
        [ 67, "Bar com amigos", "Lazer", 72 ],
        [ 68, "Delivery", "Alimentação", 43.5 ],
        [ 70, "Café", "Alimentação", 10.5 ],
        [ 70, "Tênis de corrida", "Vestuário", 299 ],
        [ 71, "Farmácia", "Saúde", 61.2 ],
        [ 73, "Cinema", "Lazer", 46 ],
        [ 74, "Conta de luz", "Moradia", 104.9 ],
        [ 74, "Transporte por aplicativo", "Transporte", 25.5 ],
        [ 75, "Lanche", "Alimentação", 12.5 ],
        [ 76, "Curso online", "Educação", 49 ],
        [ 77, "Delivery", "Alimentação", 38 ],
        [ 78, "Mercado", "Alimentação", 455.8 ],
        [ 80, "Restaurante", "Alimentação", 92 ],
        [ 81, "Bar com amigos", "Lazer", 70 ],
        [ 84, "Camiseta", "Vestuário", 79 ],
        [ 84, "Recarga do bilhete", "Transporte", 120 ],
        [ 87, "Delivery", "Alimentação", 45 ],
        [ 90, "Mercado", "Alimentação", 431.3 ],
        [ 92, "Lanche", "Alimentação", 13 ],
        [ 93, "Café", "Alimentação", 8.5 ],
        [ 94, "Delivery", "Alimentação", 38 ],
        [ 95, "Transporte por aplicativo", "Transporte", 22.5 ],
        [ 96, "Livro", "Educação", 58 ],
        [ 97, "Bar com amigos", "Lazer", 64 ],
        [ 98, "Restaurante", "Alimentação", 100 ],
        [ 101, "Farmácia", "Saúde", 58.9 ],
        [ 101, "Lanche", "Alimentação", 15.5 ],
        [ 102, "Mochila", "Outros", 139 ],
        [ 103, "Cinema", "Lazer", 44 ],
        [ 104, "Conta de luz", "Moradia", 110.2 ],
        [ 104, "Transporte por aplicativo", "Transporte", 24 ],
        [ 107, "Delivery", "Alimentação", 41 ],
        [ 108, "Mercado", "Alimentação", 428.1 ],
        [ 110, "Lanche", "Alimentação", 12 ],
        [ 110, "Restaurante", "Alimentação", 85 ],
        [ 112, "Café", "Alimentação", 9 ],
        [ 114, "Recarga do bilhete", "Transporte", 120 ],
        [ 120, "Mercado", "Alimentação", 421.6 ]
      ],
      // Duas análises antigas: uma compra planejada (comprar depois de
      // analisar, com necessidade e orçamento marcados) e uma desistência com
      // mais de 30 dias, que aparece em "O que aconteceu depois?".
      analises: [ {
        diasAtras: 40,
        item_name: "Jaqueta",
        price: 219,
        category: "Vestuário",
        work_days: 1.38,
        work_hours: 11.01,
        income_percent: 6.26,
        income_base: 3500,
        income_type: "fixa",
        work_days_month: 22,
        work_hours_day: 8,
        hour_value: 19.89,
        day_value: 159.09,
        free_income: 2146,
        balance_before: 1510,
        balance_after: 1291,
        impact_level: "verde",
        decision: "comprar",
        reflections: {
          necessidade: "Preciso agora",
          uso: "Uso diário",
          durabilidade: "Média",
          alternativas: "Não há alternativa",
          orcamento: "Aperta um pouco",
          descarte: "Doo ou revendo depois"
        },
        note: "A jaqueta antiga rasgou."
      }, {
        diasAtras: 35,
        item_name: "Videogame",
        price: 2400,
        category: "Eletrônicos",
        work_days: 15.09,
        work_hours: 120.69,
        income_percent: 68.57,
        income_base: 3500,
        income_type: "fixa",
        work_days_month: 22,
        work_hours_day: 8,
        hour_value: 19.89,
        day_value: 159.09,
        free_income: 2146,
        balance_before: 1380,
        balance_after: -1020,
        impact_level: "alerta",
        decision: "desistir",
        reflections: {
          necessidade: "É impulso",
          uso: "Uso ocasional",
          durabilidade: "Alta, com garantia",
          alternativas: "Existe opção usada",
          orcamento: "Compromete o essencial",
          descarte: "Uso por muitos anos"
        },
        note: "Vi em promoção, mas apertaria o mês."
      } ]
    }
  };
  // Os lançamentos dos meses anteriores da demonstração, com as datas
  // calculadas a partir de hoje (FIXTURE_DEMO.historico).
  function historicoDaDemo(hoje = new Date) {
    const H = FIXTURE_DEMO.historico;
    const {base: base, emDias: emDias} = datasDaDemo(hoje);
    const noMes = (deslocamento, diaDoMes) => {
      const ultimo = new Date(base.getFullYear(), base.getMonth() + deslocamento + 1, 0).getDate();
      return U.dataISO(new Date(base.getFullYear(), base.getMonth() + deslocamento, Math.min(ultimo, diaDoMes)));
    };
    const lista = [];
    for (let m = H.meses; m >= 1; m--) {
      FIXTURE_DEMO.recorrentes.forEach(r => lista.push({
        type: r.type,
        description: r.description,
        amount: r.amount,
        category: H.categoriasFixas[r.description] || "Outros",
        date: noMes(-m, emDias(r.dias).getDate())
      }));
    }
    H.entradas.forEach(({mes: mes, dia: dia, ...campos}) => lista.push({
      type: "entrada",
      ...campos,
      date: noMes(mes, dia)
    }));
    H.diaADia.forEach(([dias, description, category, amount]) => {
      const d = new Date(base);
      d.setDate(d.getDate() - dias);
      lista.push({
        type: "saida",
        description: description,
        category: category,
        amount: amount,
        date: U.dataISO(d)
      });
    });
    return lista;
  }
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
    for (const t of historicoDaDemo(hoje)) {
      await registrar("transactions", t);
    }
    // A análise de exemplo mais recente e as duas antigas do histórico. As
    // antigas usam a data corrida (podem cair no mês anterior).
    const quando = dias => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      d.setDate(d.getDate() - dias);
      return U.dataISO(d);
    };
    const exemplos = [ {
      ...FIXTURE_DEMO.analise,
      data: iso(-FIXTURE_DEMO.analise.diasAtras)
    }, ...FIXTURE_DEMO.historico.analises.map(a => ({
      ...a,
      data: quando(a.diasAtras)
    })) ];
    for (const {diasAtras: diasAtras, data: data, ...analise} of exemplos) {
      await registrar("purchase_analyses", {
        ...analise,
        responsibility_score: window.FinckReality ? window.FinckReality.indicadorResponsavel(analise.reflections).pontuacao : null,
        responsibility_label: window.FinckReality ? window.FinckReality.indicadorResponsavel(analise.reflections).nivel : null,
        analyzed_at: `${data}T12:00:00.000Z`
      });
    }
    // Contas de exemplo, saque para a carteira e salário e aluguel já
    // confirmados (js/store.js) entram na mesma operação, sem esperar a
    // próxima tela. Fora da demonstração, não faz nada.
    resumo.contas = S.prepararContasDemo ? S.prepararContasDemo({
      forcar: true
    }) : null;
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
    projecoesDe: projecoesDe,
    JANELA_PREVISOES: JANELA_PREVISOES,
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
    historicoDaDemo: historicoDaDemo,
    FIXTURE_DEMO: FIXTURE_DEMO
  };
})();
