// Dados de exemplo e nomenclatura: a demonstração nasce com duas contas
// fictícias, toda movimentação de exemplo tem conta e o saldo geral fecha com a
// soma das contas. As contas vêm de FinckStore.prepararContasDemo (js/store.js);
// os lançamentos, de FinckFinance.carregarDemo (js/finance.js).
(() => {
  const { descrever, teste, esperar } = window.FinckTestes;
  const S = window.FinckStore;
  const F = window.FinckFinance;
  const CT = window.FinckContas;
  const cfg = window.FINCK_CONFIG;

  // Mesmo padrão das outras suítes: guarda o que havia no aparelho, entra na
  // demonstração vazia e devolve tudo no fim.
  const comSessaoLimpa = async fn => {
    const antes = {};
    Object.values(S.KEYS).forEach(v => {
      antes[v] = localStorage.getItem(v);
    });
    Object.values(S.KEYS).forEach(v => localStorage.removeItem(v));
    await S.entrarDemo();
    try {
      await fn();
    } finally {
      Object.values(S.KEYS).forEach(v => localStorage.removeItem(v));
      Object.entries(antes).forEach(([k, v]) => {
        if (v !== null) {
          localStorage.setItem(k, v);
        }
      });
    }
  };
  // carregarDemo já cria as contas de exemplo na mesma operação e devolve o
  // resultado em "contas".
  const semear = async () => (await F.carregarDemo()).contas;
  // A demonstração de antes das contas: a mesma semente, sem a etapa delas.
  const semearSemContas = async () => {
    const preparar = S.prepararContasDemo;
    S.prepararContasDemo = () => ({ criadas: 0, vinculadas: 0, confirmadas: 0 });
    try {
      await F.carregarDemo();
    } finally {
      S.prepararContasDemo = preparar;
    }
  };
  const somaDasContas = ctx => CT.consolidado(ctx.contas, {
    transacoes: ctx.transacoesRealizadas,
    transferencias: ctx.transferencias,
    ajustes: ctx.ajustes
  }).disponivel;
  const TRAVESSAO = String.fromCharCode(0x2014);

  descrever("Demonstração: contas de exemplo", () => {
    teste("a semente da demonstração tem Conta corrente e Carteira", async () => {
      await comSessaoLimpa(async () => {
        const r = await semear();
        esperar(r.criadas).aSer(2);
        const contas = await S.listar("accounts", { ordem: "created_at", asc: true });
        esperar(contas).aTerTamanho(2);
        const [corrente, carteira] = contas;
        esperar(corrente.name).aSer("Conta corrente");
        esperar(CT.instituicao(corrente.institution_name).nome).aSer("Banco exemplo");
        esperar(corrente.is_default).aSerVerdadeiro();
        esperar(carteira.name).aSer("Carteira");
        esperar(CT.instituicao(carteira.institution_name).nome).aSer("Dinheiro em espécie");
        esperar(contas.every(c => c.active !== false)).aSerVerdadeiro();
      });
    });

    teste("toda movimentação e recorrente de exemplo tem conta", async () => {
      await comSessaoLimpa(async () => {
        await semear();
        const ids = new Set((await S.listar("accounts")).map(c => String(c.id)));
        const transacoes = await S.listar("transactions");
        const recorrentes = await S.listar("recurring_transactions");
        esperar(transacoes.length > 0).aSerVerdadeiro();
        esperar(transacoes.every(t => ids.has(String(t.account_id)))).aSerVerdadeiro();
        esperar(recorrentes.every(r => ids.has(String(r.account_id)))).aSerVerdadeiro();
      });
    });

    teste("saldo geral é igual à soma das contas, sem nada fora delas", async () => {
      await comSessaoLimpa(async () => {
        await semear();
        const ctx = await F.carregarContexto();
        // Invariante da semente (js/finance.js): 1200 + 3500 - 1200 - 620.
        esperar(ctx.saldo).aSerPerto(2880);
        esperar(somaDasContas(ctx)).aSerPerto(ctx.saldo);
        esperar(ctx.naoAlocado).aSerPerto(0);
        esperar(ctx.semContaVinculada).aSer(0);
        esperar(ctx.alocacaoAmbigua).aSer(0);
        esperar(ctx.origemSaldo.fonte).aSer("contas");
      });
    });

    teste("o diagnóstico fecha o caixa e não acusa saldo inicial duplicado", async () => {
      await comSessaoLimpa(async () => {
        await semear();
        const ctx = await F.carregarContexto();
        const r = window.FinckReconciliador.conferir({
          perfil: ctx.perfil,
          contas: ctx.contas,
          transacoes: ctx.todasTransacoes,
          transferencias: ctx.transferencias,
          ajustes: ctx.ajustes,
          metas: ctx.metas,
          movimentosMeta: ctx.movimentosMeta,
          parcelamentos: ctx.parcelamentos,
          pagamentos: ctx.pagamentos
        });
        esperar(r.caixa.fecha).aSerVerdadeiro();
        esperar(r.pendencias.some(p => p.kind === "saldo_inicial_duplicado")).aSerFalso();
      });
    });

    teste("o saque para a carteira muda onde o dinheiro está, não o total", async () => {
      await comSessaoLimpa(async () => {
        await semear();
        const ctx = await F.carregarContexto();
        esperar(ctx.transferencias).aTerTamanho(1);
        const contas = CT.saldos(ctx.contas, {
          transacoes: ctx.transacoesRealizadas,
          transferencias: ctx.transferencias,
          ajustes: ctx.ajustes
        });
        esperar(contas.every(c => c.saldo >= 0)).aSerVerdadeiro();
        esperar(contas.find(c => c.name === "Carteira").saldo).aSerPerto(300);
      });
    });

    teste("repetir a semente não duplica contas nem transferências", async () => {
      await comSessaoLimpa(async () => {
        await semear();
        const ctx1 = await F.carregarContexto();
        esperar(S.prepararContasDemo().criadas).aSer(0);
        esperar(S.prepararContasDemo({ forcar: true }).criadas).aSer(0);
        const r = await F.carregarDemo();
        esperar(r.inseridos).aSer(0);
        const ctx2 = await F.carregarContexto();
        esperar(ctx2.contas).aTerTamanho(2);
        esperar(ctx2.transferencias).aTerTamanho(1);
        esperar(ctx2.saldo).aSerPerto(ctx1.saldo);
        esperar(somaDasContas(ctx2)).aSerPerto(ctx2.saldo);
      });
    });

    teste("demonstração antiga, sem contas, ganha as contas sem perder nada", async () => {
      await comSessaoLimpa(async () => {
        await semearSemContas();
        const antes = await F.carregarContexto();
        esperar(antes.contas).aTerTamanho(0);
        S.prepararContasDemo();
        const depois = await F.carregarContexto();
        esperar(depois.contas).aTerTamanho(2);
        esperar(depois.todasTransacoes.length).aSer(antes.todasTransacoes.length);
        esperar(depois.recorrentes.length).aSer(antes.recorrentes.length);
        esperar(depois.metas.length).aSer(antes.metas.length);
        esperar(depois.analises.length).aSer(antes.analises.length);
        esperar(depois.saldo).aSerPerto(antes.saldo);
        esperar(depois.totalGuardado).aSerPerto(antes.totalGuardado);
      });
    });

    teste("quem já cadastrou uma conta na demonstração não ganha contas fictícias", async () => {
      await comSessaoLimpa(async () => {
        await semearSemContas();
        await S.inserir("accounts", {
          name: "Minha conta",
          institution_name: "nubank",
          account_type: "digital",
          initial_balance: 0,
          active: true
        });
        esperar(S.prepararContasDemo().criadas).aSer(0);
        esperar(await S.listar("accounts")).aTerTamanho(1);
      });
    });

    teste("fora da demonstração nenhuma conta fictícia é criada", async () => {
      await comSessaoLimpa(async () => {
        await semearSemContas();
        localStorage.removeItem(S.KEYS.demo);
        esperar(S.prepararContasDemo({ forcar: true }).criadas).aSer(0);
        let contas = [];
        try {
          contas = JSON.parse(localStorage.getItem(S.KEYS.accounts)) || [];
        } catch {
          contas = [];
        }
        esperar(contas).aTerTamanho(0);
      });
    });

    teste("salário e aluguel de exemplo não voltam a pedir confirmação", async () => {
      await comSessaoLimpa(async () => {
        await semear();
        const antes = await F.carregarContexto();
        const recorrentes = await S.listar("recurring_transactions");
        const ocorrencias = await window.FinckRevisao.sincronizar(recorrentes);
        const vencidas = window.FinckOcorrencias.pendentes(ocorrencias);
        esperar(vencidas.some(o => [ "Salário", "Aluguel" ].includes(o.description))).aSerFalso();
        // Sincronizar não pode apagar nem duplicar as movimentações ligadas.
        const depois = await F.carregarContexto();
        esperar(depois.todasTransacoes.length).aSer(antes.todasTransacoes.length);
        esperar(depois.saldo).aSerPerto(antes.saldo);
        // Repetir a semente não cria uma segunda ocorrência para o mesmo ciclo.
        S.prepararContasDemo({ forcar: true });
        const todas = await S.listar("recurring_occurrences");
        const chaves = todas.map(o => `${o.recurring_id}|${o.cycle}`);
        esperar(new Set(chaves).size).aSer(chaves.length);
      });
    });

    teste("o streaming de exemplo é só recorrência, sem lançamento previsto repetido", async () => {
      esperar(F.FIXTURE_DEMO.transacoes.some(t => t.description === "Streaming")).aSerFalso();
      esperar(F.FIXTURE_DEMO.recorrentes.filter(r => r.description === "Streaming")).aTerTamanho(1);
      await comSessaoLimpa(async () => {
        await semear();
        const ctx = await F.carregarContexto();
        esperar(ctx.todasTransacoes.some(t => t.description === "Streaming")).aSerFalso();
        const datas = (ctx.programacao?.compromissos || []).filter(c => c.descricao === "Streaming").map(c => c.iso);
        esperar(datas.length > 0).aSerVerdadeiro();
        esperar(new Set(datas).size).aSer(datas.length);
      });
    });

    teste("a análise de exemplo guarda a base da época, coerente com as horas", async () => {
      const a = F.FIXTURE_DEMO.analise;
      const perfil = F.FIXTURE_DEMO.perfil;
      esperar(a.income_base).aSer(perfil.income_monthly);
      esperar(a.income_type).aSer(perfil.income_type);
      esperar(a.work_days_month).aSer(perfil.work_days_month);
      esperar(a.work_hours_day).aSer(perfil.work_hours_day);
      esperar(a.day_value).aSerPerto(perfil.income_monthly / perfil.work_days_month, 2);
      esperar(a.hour_value).aSerPerto(a.day_value / perfil.work_hours_day, 2);
      esperar(a.work_hours).aSerPerto(a.price / a.hour_value, 2);
      esperar(a.balance_before - a.balance_after).aSerPerto(a.price);
      esperar(a.free_income > 0).aSerVerdadeiro();
    });

    teste("na demonstração, a nota do saldo inicial fala das duas contas de exemplo", async () => {
      await comSessaoLimpa(async () => {
        await semear();
        const ctx = await F.carregarContexto();
        esperar(ctx.origemSaldo.nota).aSer("Na demonstração, o saldo inicial de exemplo está dividido entre as duas contas.");
      });
    });

    teste("a instituição de exemplo não é oferecida para contas reais", () => {
      const exemplo = cfg.INSTITUICOES.find(i => i.id === "exemplo");
      esperar(Boolean(exemplo && exemplo.demonstracao)).aSerVerdadeiro();
      esperar(cfg.INSTITUICOES.filter(i => !i.demonstracao).some(i => i.id === "exemplo")).aSerFalso();
    });
  });

  descrever("Nomenclatura: análise, não cálculo", () => {
    teste("a ação de XP do Reality fala em análise", () => {
      const rotulo = cfg.XP.ACOES.calculo.rotulo;
      esperar(rotulo.toLowerCase()).aConter("análise");
      esperar(/c[áa]lculo|\breal\b/i.test(rotulo)).aSerFalso();
    });

    teste("conquistas do Reality falam em compras analisadas", () => {
      const textos = window.FinckGame.CONQUISTAS.map(c => `${c.titulo} ${c.descricao}`);
      esperar(textos.some(t => /c[áa]lculos? rea(l|is)/i.test(t))).aSerFalso();
      esperar(textos.some(t => t.includes(TRAVESSAO))).aSerFalso();
      const primeira = window.FinckGame.CONQUISTAS.find(c => c.id === "primeira_analise");
      esperar(primeira.descricao).aConter("Analisou a primeira compra");
    });
  });
})();
