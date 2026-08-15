// Reconciliador financeiro — Fase 3 do relatório de conclusão.
//
// Calcula e compara, lado a lado:
//   1. saldo global derivado;
//   2. soma das contas ativas;
//   3. saldo não alocado;
//   4. totais de transações por categoria;
//   5. progresso derivado das metas;
//   6. parcelas e ocorrências abertas.
//
// A identidade que precisa fechar é uma só:
//
//     saldo global = contas ativas + o que passou por contas arquivadas
//                                  + saldo não alocado
//
// (arquivar uma conta tira o saldo dela da visão consolidada, mas não apaga o
//  histórico do que passou por ela — por isso o balde do meio existe)
//
// Quando ela não fecha, o produto não mostra dois números diferentes e deixa o
// usuário adivinhar: mostra a divergência com nome, valor e causa provável.
//
// `conferir()` é função pura — recebe os dados e devolve o laudo. É ela que os
// testes exercitam. `executar()` só busca os dados e chama a pura.
window.FinckReconciliador = (() => {
  const S = window.FinckStore;
  const num = (v) => Number(v || 0);
  const TOLERANCIA = 0.005;

  const bate = (a, b) => Math.abs(num(a) - num(b)) <= TOLERANCIA;
  const vigente = (t) => !t.reversed_at;
  const realizada = (t, hoje) => String(t.date || "") <= hoje;

  // ---------------------------------------------------------------- laudo ---

  function conferir({
    perfil = null,
    contas = [],
    transacoes = [],
    transferencias = [],
    ajustes = [],
    metas = [],
    movimentosMeta = [],
    parcelamentos = [],
    pagamentos = [],
    ocorrencias = [],
    hoje = new Date().toISOString().slice(0, 10),
  } = {}) {
    const F = window.FinckFinance;
    const CT = window.FinckContas;
    const M = window.FinckMetas;
    const P = window.FinckPlano;

    const ativas = (contas || []).filter((c) => c.active !== false);

    // Só entra no caixa o que já aconteceu e não foi estornado.
    const noCaixa = (transacoes || []).filter((t) => vigente(t) && realizada(t, hoje));
    const estornadas = (transacoes || []).filter((t) => !vigente(t));

    const entradas = noCaixa.filter((t) => t.type === "entrada").reduce((s, t) => s + num(t.amount), 0);
    const saidas = noCaixa.filter((t) => t.type === "saida").reduce((s, t) => s + num(t.amount), 0);

    const origem = F.origemDoSaldo(perfil, contas);
    const somaAjustes = (ajustes || []).reduce((s, a) => s + num(a.amount), 0);

    // 1. Saldo global derivado ------------------------------------------------
    const saldoGlobal = origem.saldoInicial + entradas - saidas + somaAjustes;

    // 2. Soma das contas ativas -----------------------------------------------
    const comSaldo = CT.saldos(ativas, {
      transacoes: noCaixa, transferencias, ajustes,
    });
    const somaContas = comSaldo.reduce((s, c) => s + num(c.saldo), 0);

    // Conta arquivada some da visão consolidada, mas o que passou por ela
    // continua no saldo global — o histórico não é apagado ao arquivar. Sem
    // este terceiro balde a identidade acusaria uma divergência que não existe.
    // Só entra a movimentação: o saldo inicial da arquivada nunca foi somado
    // ao global (origemDoSaldo só olha contas ativas).
    const arquivadas = (contas || []).filter((c) => c.active === false);
    const comSaldoArquivadas = CT.saldos(arquivadas, {
      transacoes: noCaixa, transferencias, ajustes,
    });
    const somaArquivadas = comSaldoArquivadas.reduce(
      (s, c) => s + num(c.saldo) - num(c.initial_balance), 0);

    // 3. Saldo não alocado ----------------------------------------------------
    const semConta = noCaixa.filter((t) => !t.account_id);
    const naoAlocadoMovimento =
      semConta.filter((t) => t.type === "entrada").reduce((s, t) => s + num(t.amount), 0) -
      semConta.filter((t) => t.type === "saida").reduce((s, t) => s + num(t.amount), 0);

    // Sem conta cadastrada, o saldo inicial do perfil também é dinheiro que não
    // está em conta nenhuma — ele pertence ao não alocado, não ao consolidado.
    const naoAlocado = naoAlocadoMovimento + (origem.fonte === "perfil" ? origem.saldoInicial : 0);

    // Ambíguas: sem conta e sem o usuário ter declarado que não têm conta.
    const ambiguas = ativas.length
      ? semConta.filter((t) => !t.unallocated)
      : [];

    const identidade = somaContas + somaArquivadas + naoAlocado;
    const diferencaCaixa = saldoGlobal - identidade;

    // 4. Totais por categoria -------------------------------------------------
    const porCategoria = F.porCategoria(noCaixa);
    const somaCategorias = porCategoria.reduce((s, c) => s + num(c.valor), 0);
    const semCategoria = noCaixa.filter((t) => t.type === "saida" && !t.category).length;

    // 5. Progresso derivado das metas ----------------------------------------
    const divergentes = M.divergencias(metas, movimentosMeta);
    const metasSemHistorico = M.semHistorico(metas, movimentosMeta);
    const somaCache = (metas || []).reduce((s, m) => s + num(m.current_amount), 0);
    const somaLivro = M.progresso(movimentosMeta);

    // 6. Parcelas e ocorrências abertas --------------------------------------
    const porCompra = P.pagamentosPorCompra(pagamentos);
    const parcelasAbertas = (parcelamentos || [])
      .filter((p) => p.active !== false)
      .flatMap((p) => P.cronograma(p, porCompra.get(String(p.id)) || []).filter((c) => !c.paga));
    const compromissoParcelas = parcelasAbertas.reduce((s, c) => s + num(c.valor), 0);

    const ABERTAS = ["previsto", "pendente"];
    const ocorrenciasAbertas = (ocorrencias || []).filter((o) => ABERTAS.includes(o.status));
    const compromissoOcorrencias = ocorrenciasAbertas
      .filter((o) => o.type === "saida")
      .reduce((s, o) => s + num(o.planned_amount), 0);

    // Invariante dura: previsão não move saldo. Uma ocorrência ainda aberta não
    // pode ter movimentação viva vinculada a ela.
    const idsVivos = new Set(noCaixa.map((t) => String(t.id)));
    const previsoesComDinheiro = ocorrenciasAbertas.filter(
      (o) => o.transaction_id && idsVivos.has(String(o.transaction_id)));

    const parcelasAbertasComMovimento = (pagamentos || []).filter(
      (pg) => pg.status === "aberta" && pg.transaction_id);

    // 7. Possíveis duplicidades ----------------------------------------------
    // Dois lançamentos iguais no mesmo dia podem ser legítimos (dois cafés) ou
    // podem ser o mesmo fato gravado duas vezes. O sistema não decide isso: ele
    // aponta e deixa a decisão com quem sabe o que aconteceu.
    const grupos = new Map();
    noCaixa.forEach((t) => {
      const chave = [t.type, Number(t.amount).toFixed(2),
                     String(t.date).slice(0, 10),
                     String(t.description || "").trim().toLowerCase()].join("|");
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(t);
    });

    const duplicatas = [...grupos.values()]
      .filter((lista) => lista.length > 1)
      // Confirmações de ciclos diferentes coincidem em valor e descrição sem
      // serem duplicata: o vínculo com a previsão prova que são fatos distintos.
      .filter((lista) => {
        const origens = new Set(lista.map((t) => t.source_occurrence_id || null));
        return !(origens.size === lista.length && !origens.has(null));
      });

    // ------------------------------------------------------------ checagens --

    const checagens = [
      {
        id: "caixa",
        titulo: "Saldo global fecha com contas e não alocado",
        ok: bate(saldoGlobal, identidade),
        esperado: identidade,
        encontrado: saldoGlobal,
        diferenca: diferencaCaixa,
        formato: "moeda",
        explicacao: bate(saldoGlobal, identidade)
          ? somaArquivadas
            ? `O saldo que aparece na tela é a soma das contas ativas, mais ${window.FinckUtils.moeda(somaArquivadas)} que passou por contas arquivadas, mais o que está fora das contas.`
            : "O saldo que aparece na tela é exatamente a soma das contas mais o que está fora delas."
          : "O saldo global não corresponde à soma das contas com o não alocado. Enquanto isso não fechar, os dois números na tela contam histórias diferentes.",
      },
      {
        id: "contas",
        titulo: "Contas ativas reconciliam",
        ok: comSaldo.every((c) => Number.isFinite(c.saldo)),
        esperado: somaContas,
        encontrado: somaContas,
        diferenca: 0,
        formato: "moeda",
        detalhe: `${comSaldo.length} conta(s) ativa(s)`,
        alerta: comSaldo.filter((c) => c.saldo < 0).length,
        explicacao: comSaldo.some((c) => c.saldo < 0)
          ? `${comSaldo.filter((c) => c.saldo < 0).length} conta(s) com saldo negativo. Pode ser cheque especial legítimo — só precisa ser uma escolha, não uma surpresa.`
          : "Cada conta soma saldo inicial, movimentações vinculadas, transferências e ajustes.",
      },
      {
        id: "nao_alocado",
        titulo: "Não alocado é declarado, não esquecido",
        ok: ambiguas.length === 0,
        esperado: 0,
        encontrado: ambiguas.length,
        diferenca: ambiguas.length,
        formato: "quantidade",
        valorMoeda: naoAlocado,
        explicacao: ambiguas.length
          ? `${ambiguas.length} movimentação(ões) sem conta e sem você ter dito que ficam fora das contas. Elas entram no saldo geral mas não aparecem em conta nenhuma.`
          : "Tudo que está fora das contas está fora por decisão declarada.",
      },
      {
        id: "categorias",
        titulo: "Saídas somam por categoria sem perder valor",
        ok: bate(somaCategorias, saidas),
        esperado: saidas,
        encontrado: somaCategorias,
        diferenca: somaCategorias - saidas,
        formato: "moeda",
        detalhe: `${porCategoria.length} categoria(s)`,
        alerta: semCategoria,
        explicacao: semCategoria
          ? `${semCategoria} saída(s) sem categoria caem em "Outros" nos relatórios.`
          : "O total por categoria reproduz o total de saídas.",
      },
      {
        id: "metas",
        titulo: "Progresso das metas sai do histórico",
        ok: divergentes.length === 0,
        esperado: somaLivro,
        encontrado: somaCache,
        diferenca: somaCache - somaLivro,
        formato: "moeda",
        detalhe: `${(metas || []).length} meta(s), ${(movimentosMeta || []).length} movimento(s)`,
        alerta: metasSemHistorico.length,
        explicacao: divergentes.length
          ? `${divergentes.length} meta(s) com progresso diferente da soma dos movimentos: ${divergentes.map((d) => d.nome).join(", ")}.`
          : metasSemHistorico.length
            ? `${metasSemHistorico.length} meta(s) ainda sem histórico de movimentos — o valor veio de antes do livro-razão.`
            : "O valor guardado em cada meta é exatamente a soma dos aportes, retiradas e estornos.",
      },
      {
        id: "compromissos",
        titulo: "Previsão não vira saldo antes da hora",
        ok: previsoesComDinheiro.length === 0 && parcelasAbertasComMovimento.length === 0,
        esperado: 0,
        encontrado: previsoesComDinheiro.length + parcelasAbertasComMovimento.length,
        diferenca: previsoesComDinheiro.length + parcelasAbertasComMovimento.length,
        formato: "quantidade",
        valorMoeda: compromissoParcelas + compromissoOcorrencias,
        detalhe: `${parcelasAbertas.length} parcela(s) e ${ocorrenciasAbertas.length} ocorrência(s) em aberto`,
        explicacao: previsoesComDinheiro.length || parcelasAbertasComMovimento.length
          ? "Existe previsão em aberto com movimentação vinculada. O mesmo dinheiro está sendo contado como previsto e como realizado."
          : "Nada em aberto está movimentando saldo. Previsto é previsto; realizado é realizado.",
      },
    ];

    // ----------------------------------------------------------- pendências --
    // Nada aqui é corrigido por adivinhação: são itens para decisão do usuário.

    const pendencias = [];

    ambiguas.slice(0, 50).forEach((t) => pendencias.push({
      kind: "transacao_sem_conta",
      entity_table: "transactions",
      entity_id: t.id,
      titulo: t.description,
      detalhe: `${window.FinckUtils.moeda(t.amount)} · ${window.FinckUtils.dataBR(t.date)}`,
      texto: "Sem conta vinculada e sem declaração de que fica fora das contas.",
    }));

    divergentes.forEach((d) => pendencias.push({
      kind: "meta_sem_historico",
      entity_table: "goals",
      entity_id: d.id,
      titulo: d.nome,
      detalhe: `guardado ${window.FinckUtils.moeda(d.cache)} · histórico ${window.FinckUtils.moeda(d.historico)}`,
      texto: "O progresso guardado não bate com a soma dos movimentos.",
    }));

    previsoesComDinheiro.forEach((o) => pendencias.push({
      kind: "previsao_com_movimento",
      entity_table: "recurring_occurrences",
      entity_id: o.id,
      titulo: o.description,
      detalhe: `${o.cycle} · ${o.status}`,
      texto: "Ocorrência em aberto com movimentação vinculada.",
    }));

    parcelasAbertasComMovimento.forEach((pg) => pendencias.push({
      kind: "parcela_aberta_com_movimento",
      entity_table: "installment_payments",
      entity_id: pg.id,
      titulo: `Parcela ${pg.installment_no}`,
      detalhe: window.FinckUtils.moeda(pg.amount),
      texto: "Parcela em aberto com movimentação vinculada.",
    }));

    (parcelamentos || [])
      .filter((p) => num(p.paid_count) > 0 &&
        !(porCompra.get(String(p.id)) || []).some((pg) => pg.status === "paga"))
      .forEach((p) => pendencias.push({
        kind: "parcela_por_contador",
        entity_table: "installment_purchases",
        entity_id: p.id,
        titulo: p.description,
        detalhe: `${p.paid_count} parcela(s) pagas só pelo contador`,
        texto: "Sem registro individual, a parcela paga não tem movimentação rastreável.",
      }));

    (ocorrencias || [])
      .filter((o) => o.type === "saida" && !o.category)
      .slice(0, 25)
      .forEach((o) => pendencias.push({
        kind: "ocorrencia_sem_categoria",
        entity_table: "recurring_occurrences",
        entity_id: o.id,
        titulo: o.description,
        detalhe: o.cycle,
        texto: "Saída prevista sem categoria: o gasto não será comparado a nenhum teto.",
      }));

    duplicatas.slice(0, 25).forEach((lista) => {
      const [primeira] = lista;
      pendencias.push({
        kind: "possivel_duplicata",
        entity_table: "transactions",
        entity_id: primeira.id,
        titulo: primeira.description,
        detalhe: `${lista.length}× ${window.FinckUtils.moeda(primeira.amount)} · ${window.FinckUtils.dataBR(primeira.date)}`,
        texto: "Lançamentos idênticos no mesmo dia. Pode ser repetição legítima ou o mesmo fato gravado duas vezes.",
        ids: lista.map((t) => t.id),
      });
    });

    if (perfil && num(perfil.initial_balance) !== 0 &&
        !perfil.initial_balance_migrated_at && ativas.length) {
      pendencias.push({
        kind: "saldo_inicial_duplicado",
        entity_table: "profiles",
        entity_id: perfil.id,
        titulo: "Saldo inicial do perfil",
        detalhe: window.FinckUtils.moeda(perfil.initial_balance),
        texto: "Com contas cadastradas, este valor deixou de ser somado. Leve-o para uma conta para a composição do saldo ficar explícita.",
      });
    }

    const falhas = checagens.filter((c) => !c.ok);

    return {
      geradoEm: new Date().toISOString(),
      ok: falhas.length === 0 && pendencias.length === 0,
      contabilOk: falhas.length === 0,
      checagens,
      falhas,
      pendencias,
      caixa: {
        saldoGlobal,
        somaContas,
        somaArquivadas,
        contasArquivadas: arquivadas.length,
        naoAlocado,
        naoAlocadoMovimento,
        saldoInicial: origem.saldoInicial,
        origem: origem.fonte,
        ajustes: somaAjustes,
        diferenca: diferencaCaixa,
        fecha: bate(saldoGlobal, identidade),
      },
      metas: { somaCache, somaLivro, divergentes, semHistorico: metasSemHistorico },
      compromissos: {
        parcelas: compromissoParcelas,
        ocorrencias: compromissoOcorrencias,
        total: compromissoParcelas + compromissoOcorrencias,
        parcelasAbertas: parcelasAbertas.length,
        ocorrenciasAbertas: ocorrenciasAbertas.length,
      },
      historico: {
        estornadas: estornadas.length,
        valorEstornado: estornadas.reduce((s, t) => s + num(t.amount), 0),
      },
      duplicatas: {
        grupos: duplicatas.length,
        lancamentos: duplicatas.reduce((s, l) => s + l.length, 0),
      },
      categorias: porCategoria,
    };
  }

  // --------------------------------------------------------------- carga ---

  async function carregar() {
    const [
      perfil, contas, transacoes, transferencias, ajustes,
      metas, movimentosMeta, parcelamentos, pagamentos, ocorrencias,
    ] = await Promise.all([
      S.obterPerfil(),
      S.listar("accounts"),
      S.listar("transactions", { ordem: "date", asc: false }),
      S.listar("transfers"),
      S.listar("balance_adjustments"),
      S.listar("goals"),
      S.listar("goal_movements", { ordem: "date", asc: false }),
      S.listar("installment_purchases"),
      S.listar("installment_payments"),
      S.listar("recurring_occurrences", { ordem: "due_date", asc: true }),
    ]);

    return {
      perfil, contas, transacoes, transferencias, ajustes,
      metas, movimentosMeta, parcelamentos, pagamentos, ocorrencias,
    };
  }

  async function executar() {
    try {
      const dados = await carregar();
      const laudo = conferir(dados);

      if (!laudo.contabilOk) {
        await S.registrarEvento({
          level: "erro",
          scope: "reconciliacao",
          message: `Reconciliação encontrou ${laudo.falhas.length} divergência(s) contábil(is).`,
          context: {
            falhas: laudo.falhas.map((f) => ({ id: f.id, diferenca: f.diferenca })),
            caixa: laudo.caixa,
          },
        });
      }

      return laudo;
    } catch (err) {
      await S.registrarEvento({
        level: "erro",
        scope: "reconciliacao",
        message: `Não foi possível reconciliar: ${err.message}`,
        context: { stack: String(err.stack || "").slice(0, 800) },
      });
      throw err;
    }
  }

  // Fila de reconciliação: grava as pendências para decisão posterior sem
  // tocar em nenhum dado original.
  async function registrarPendencias(pendencias = []) {
    const existentes = await S.listar("reconciliation_queue");
    const chave = (p) => `${p.kind}|${p.entity_table}|${p.entity_id}`;
    const abertas = new Set(
      existentes.filter((e) => e.status !== "resolvido").map(chave));

    let novas = 0;
    for (const p of pendencias) {
      if (abertas.has(chave(p))) continue;
      await S.inserir("reconciliation_queue", {
        kind: p.kind,
        entity_table: p.entity_table,
        entity_id: p.entity_id,
        detail: { titulo: p.titulo, detalhe: p.detalhe, texto: p.texto },
        status: "aberto",
      });
      novas++;
    }
    return novas;
  }

  async function resolverPendencia(id, status = "resolvido") {
    return S.atualizar("reconciliation_queue", id, {
      status, resolved_at: new Date().toISOString(),
    });
  }

  return { conferir, carregar, executar, registrarPendencias, resolverPendencia, TOLERANCIA };
})();
