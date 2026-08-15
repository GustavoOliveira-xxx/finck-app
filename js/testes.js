window.FinckTestes = (() => {
  const suites = [];
  let suiteAtual = null;

  const descrever = (nome, fn) => {
    suiteAtual = { nome, casos: [] };
    suites.push(suiteAtual);
    fn();
    suiteAtual = null;
  };

  const teste = (nome, fn) => {
    if (!suiteAtual) throw new Error("teste() fora de descrever()");
    suiteAtual.casos.push({ nome, fn });
  };

  class FalhaDeTeste extends Error {}

  const falhar = (msg) => { throw new FalhaDeTeste(msg); };

  const esperar = (valor) => ({
    aSer(esperado) {
      if (!Object.is(valor, esperado)) falhar(`esperava ${JSON.stringify(esperado)}, veio ${JSON.stringify(valor)}`);
    },
    aSerPerto(esperado, casas = 2) {
      const tol = Math.pow(10, -casas) / 2;
      if (Math.abs(valor - esperado) > tol) {
        falhar(`esperava ~${esperado} (±${tol}), veio ${valor}`);
      }
    },
    aSerVerdadeiro() { if (!valor) falhar(`esperava verdadeiro, veio ${JSON.stringify(valor)}`); },
    aSerFalso() { if (valor) falhar(`esperava falso, veio ${JSON.stringify(valor)}`); },
    aTerTamanho(n) {
      const t = valor?.length;
      if (t !== n) falhar(`esperava tamanho ${n}, veio ${t}`);
    },
    aConter(trecho) {
      if (!String(valor).includes(trecho)) falhar(`esperava conter "${trecho}", veio "${valor}"`);
    },
    async aFalharCom(trecho) {
      try {
        await valor();
      } catch (e) {
        if (e instanceof FalhaDeTeste) throw e;
        if (trecho && !String(e.message).includes(trecho)) {
          falhar(`erro deveria conter "${trecho}", veio "${e.message}"`);
        }
        return;
      }
      falhar("esperava que lançasse erro, mas não lançou");
    },
  });

  descrever("Motor de cálculo (FinckReality)", () => {
    const perfilBase = { income_monthly: 3500, work_days_month: 22, work_hours_day: 8 };

    teste("cenário documentado: R$ 800 com renda 3500, 22 dias, 8h", () => {
      const r = window.FinckReality.calcular(800, perfilBase);
      esperar(r.income_percent).aSerPerto(22.86, 2);
      esperar(r.work_days).aSerPerto(5.03, 2);
      esperar(r.work_hours).aSerPerto(40.23, 1);
    });

    teste("valor da hora e do dia saem da jornada declarada", () => {
      const r = window.FinckReality.calcular(100, perfilBase);
      esperar(r.valor_dia).aSerPerto(159.09, 2);
      esperar(r.valor_hora).aSerPerto(19.89, 2);
    });

    teste("renda zero não gera divisão por zero", () => {
      const r = window.FinckReality.calcular(800, { income_monthly: 0 });
      esperar(r.work_hours).aSer(0);
      esperar(r.work_days).aSer(0);
      esperar(r.income_percent).aSer(0);
    });

    teste("preço inválido vira zero em vez de NaN", () => {
      const r = window.FinckReality.calcular("abc", perfilBase);
      esperar(r.price).aSer(0);
      esperar(Number.isNaN(r.work_hours)).aSerFalso();
    });

    teste("semáforo verde abaixo de 10% da renda", () => {
      const r = window.FinckReality.calcular(200, perfilBase, { saldo: 10000 });
      esperar(r.semaforo.nivel).aSer("verde");
    });

    teste("semáforo atenção entre 10% e 30% da renda", () => {
      const r = window.FinckReality.calcular(800, perfilBase, { saldo: 10000 });
      esperar(r.semaforo.nivel).aSer("atencao");
    });

    teste("semáforo alerta acima de 30% da renda", () => {
      const r = window.FinckReality.calcular(1500, perfilBase, { saldo: 10000 });
      esperar(r.semaforo.nivel).aSer("alerta");
    });

    teste("saldo insuficiente é alerta mesmo com preço baixo", () => {
      const r = window.FinckReality.calcular(50, perfilBase, { saldo: 10 });
      esperar(r.semaforo.nivel).aSer("alerta");
      esperar(r.compromete_saldo).aSerVerdadeiro();
    });

    teste("renda livre desconta as despesas fixas", () => {
      const r = window.FinckReality.calcular(100, perfilBase, { saldo: 5000, despesasFixas: 1500 });
      esperar(r.renda_livre).aSer(2000);
      esperar(r.percentual_renda_livre).aSerPerto(5, 2);
    });

    teste("renda livre nunca fica negativa", () => {
      const r = window.FinckReality.calcular(100, perfilBase, { despesasFixas: 99999 });
      esperar(r.renda_livre).aSer(0);
    });

    teste("impacto nas metas mede a fatia e o atraso", () => {
      const r = window.FinckReality.calcular(800, perfilBase, {
        saldo: 5000,
        metas: [{ id: 1, name: "Notebook", target_amount: 3200, current_amount: 400 }],
      });
      const m = r.impacto_metas[0];
      esperar(m.falta).aSer(2800);
      esperar(m.percentual_da_meta).aSerPerto(25, 2);
      esperar(m.dias_trabalho_extra).aSerPerto(5.03, 2);
      esperar(m.cobre_a_meta).aSerFalso();
    });

    teste("compra maior que o restante da meta cobre a meta", () => {
      const r = window.FinckReality.calcular(3000, perfilBase, {
        metas: [{ id: 1, name: "Reserva", target_amount: 6000, current_amount: 5000 }],
      });
      esperar(r.impacto_metas[0].cobre_a_meta).aSerVerdadeiro();
    });

    teste("registro guarda o retrato da realidade na data", () => {
      const resultado = window.FinckReality.calcular(800, perfilBase, { saldo: 2000 });
      const reg = window.FinckReality.paraRegistro({
        item_name: "Fone", price: 800, category: "Eletrônicos",
        resultado, perfil: perfilBase, decision: "adiar",
      });
      esperar(reg.income_base).aSer(3500);
      esperar(reg.hour_value).aSerPerto(19.89, 2);
      esperar(reg.work_days_month).aSer(22);
      esperar(reg.impact_level).aSer("atencao");
      esperar(reg.decision).aSer("adiar");
    });
  });

  descrever("Regras financeiras (FinckFinance)", () => {
    const F = window.FinckFinance;

    teste("soma ignora valores ausentes ou inválidos", () => {
      esperar(F.soma([{ amount: 10 }, { amount: "5" }, {}, { amount: null }])).aSer(15);
    });

    teste("classificação de entrada e saída", () => {
      esperar(F.ehEntrada({ type: "entrada" })).aSerVerdadeiro();
      esperar(F.ehSaida({ type: "saida" })).aSerVerdadeiro();
      esperar(F.ehEntrada({ type: "saida" })).aSerFalso();
    });

    teste("doMes compara ano e mês da data", () => {
      esperar(F.doMes({ date: "2026-08-15" }, "2026-08")).aSerVerdadeiro();
      esperar(F.doMes({ date: "2026-07-31" }, "2026-08")).aSerFalso();
    });

    teste("porCategoria agrupa somente as saídas", () => {
      const linhas = F.porCategoria([
        { type: "saida", amount: 100, category: "Moradia" },
        { type: "saida", amount: 50, category: "Moradia" },
        { type: "saida", amount: 30, category: "Lazer" },
        { type: "entrada", amount: 900, category: "Salário" },
      ]);
      const moradia = linhas.find((l) => l.categoria === "Moradia");
      esperar(moradia.valor).aSer(150);
      esperar(linhas.some((l) => l.categoria === "Salário")).aSerFalso();
    });

    teste("porCategoria ordena da maior saída para a menor", () => {
      const linhas = F.porCategoria([
        { type: "saida", amount: 30, category: "Lazer" },
        { type: "saida", amount: 300, category: "Moradia" },
        { type: "saida", amount: 80, category: "Transporte" },
      ]);
      esperar(linhas[0].categoria).aSer("Moradia");
      esperar(linhas[linhas.length - 1].categoria).aSer("Lazer");
    });

    teste("saída sem categoria cai em Outros", () => {
      const linhas = F.porCategoria([{ type: "saida", amount: 10 }]);
      esperar(linhas[0].categoria).aSer("Outros");
    });
  });

  descrever("Gamificação (FinckGame)", () => {
    const G = window.FinckGame;
    const cfg = window.FINCK_CONFIG;

    teste("nível 1 no começo", () => {
      esperar(G.nivelDe(0).level).aSer(1);
    });

    teste("XP acumulado sobe de nível conforme a trilha", () => {
      const n = G.nivelDe(cfg.NIVEIS[1].xp);
      esperar(n.level).aSer(2);
    });

    teste("XP altíssimo não passa do último nível", () => {
      const ultimo = cfg.NIVEIS[cfg.NIVEIS.length - 1];
      esperar(G.nivelDe(999999).level).aSer(ultimo.level);
    });

    teste("nível nunca regride com XP intermediário", () => {
      let anterior = 0;
      for (let xp = 0; xp <= 20000; xp += 250) {
        const atual = G.nivelDe(xp).level;
        esperar(atual >= anterior).aSerVerdadeiro();
        anterior = atual;
      }
    });

    teste("toda ação premiada tem limite diário definido", () => {
      Object.entries(cfg.XP.ACOES).forEach(([tipo, r]) => {
        if (!(r.limiteDia >= 1)) falhar(`ação "${tipo}" sem limiteDia`);
        if (!(r.xp >= 0)) falhar(`ação "${tipo}" com xp inválido`);
      });
    });

    teste("teto diário é menor que a soma de todas as ações no limite", () => {

      const somaMaxima = Object.values(cfg.XP.ACOES)
        .reduce((s, r) => s + r.xp * r.limiteDia, 0);
      esperar(cfg.XP.TETO_DIARIO < somaMaxima).aSerVerdadeiro();
    });

    teste("intervalo mínimo entre ganhos está configurado", () => {
      esperar(cfg.XP.INTERVALO_MIN_MS > 0).aSerVerdadeiro();
    });

    teste("cálculo abaixo do valor mínimo não paga XP", () => {
      esperar(cfg.XP.VALOR_MINIMO_CALCULO > 0).aSerVerdadeiro();
    });
  });

  descrever("Camada de dados (FinckStore)", () => {
    const S = window.FinckStore;

    teste("assinatura ignora id e created_at", () => {
      const a = S.assinar("transactions", {
        id: "1", created_at: "2026-01-01", type: "saida",
        description: "Mercado", amount: 100, date: "2026-08-08",
      });
      const b = S.assinar("transactions", {
        id: "2", created_at: "2026-05-05", type: "saida",
        description: "Mercado", amount: 100, date: "2026-08-08",
      });
      esperar(a).aSer(b);
    });

    teste("assinatura separa lançamentos de valores diferentes", () => {
      const a = S.assinar("transactions", { type: "saida", description: "X", amount: 100, date: "2026-08-08" });
      const b = S.assinar("transactions", { type: "saida", description: "X", amount: 101, date: "2026-08-08" });
      esperar(a === b).aSerFalso();
    });

    teste("assinatura de cálculo usa analyzed_at, não created_at", () => {

      const novo = S.assinar("purchase_analyses", {
        item_name: "Fone", price: 800, analyzed_at: "2026-08-12T12:00:00.000Z",
      });
      const salvo = S.assinar("purchase_analyses", {
        item_name: "Fone", price: 800, analyzed_at: "2026-08-12T12:00:00.000Z",
        created_at: "2026-08-12T15:33:10.000Z", id: "abc",
      });
      esperar(novo).aSer(salvo);
    });

    teste("arquivo sem dados reconhecíveis é recusado", async () => {
      await esperar(() => S.importarTudo({ qualquer: "coisa" })).aFalharCom("Arquivo inválido");
    });

    teste("arquivo que não é objeto é recusado", async () => {
      await esperar(() => S.importarTudo([1, 2, 3])).aFalharCom("Arquivo inválido");
      await esperar(() => S.importarTudo(null)).aFalharCom("Arquivo inválido");
    });

    teste("modo de importação desconhecido é recusado", async () => {
      await esperar(() =>
        S.importarTudo({ transactions: [] }, { modo: "apagar-tudo" })
      ).aFalharCom("Modo de importação");
    });
  });

  descrever("Importação e demonstração (integração)", () => {
    const S = window.FinckStore;
    const F = window.FinckFinance;

    const comSessaoLimpa = async (fn) => {
      const antes = {};
      Object.entries(S.KEYS).forEach(([k, v]) => { antes[v] = localStorage.getItem(v); });
      Object.values(S.KEYS).forEach((v) => localStorage.removeItem(v));
      await S.entrarDemo();
      try {
        await fn();
      } finally {
        Object.values(S.KEYS).forEach((v) => localStorage.removeItem(v));
        Object.entries(antes).forEach(([k, v]) => { if (v !== null) localStorage.setItem(k, v); });
      }
    };

    teste("demonstração entra sem conta e sem servidor", async () => {
      await comSessaoLimpa(async () => {
        esperar(S.MODO).aSer("demo");
        const u = await S.usuarioAtual();
        esperar(u.id).aSer("demo-local");
      });
    });

    teste("carregar demo duas vezes não duplica nada", async () => {
      await comSessaoLimpa(async () => {
        const r1 = await F.carregarDemo();
        const ctx1 = await F.carregarContexto();
        const r2 = await F.carregarDemo();
        const ctx2 = await F.carregarContexto();
        esperar(r2.inseridos).aSer(0);
        esperar(ctx2.transacoes.length).aSer(ctx1.transacoes.length);
        esperar(ctx2.saldo).aSer(ctx1.saldo);
      });
    });

    teste("importar mesclando ignora o que já existe", async () => {
      await comSessaoLimpa(async () => {
        const backup = {
          transactions: [
            { type: "saida", description: "Padaria", amount: 20, date: "2026-08-01" },
            { type: "saida", description: "Padaria", amount: 20, date: "2026-08-01" },
            { type: "entrada", description: "Freela", amount: 500, date: "2026-08-02" },
          ],
        };
        const r1 = await S.importarTudo(backup, { modo: "mesclar" });
        esperar(r1.inseridos).aSer(2);
        esperar(r1.ignorados).aSer(1);

        const r2 = await S.importarTudo(backup, { modo: "mesclar" });
        esperar(r2.inseridos).aSer(0);
        esperar((await S.listar("transactions")).length).aSer(2);
      });
    });

    teste("importar substituindo troca os dados atuais", async () => {
      await comSessaoLimpa(async () => {
        await S.inserir("transactions", { type: "saida", description: "Antiga", amount: 9, date: "2026-01-01" });
        const r = await S.importarTudo(
          { transactions: [{ type: "entrada", description: "Nova", amount: 100, date: "2026-08-02" }] },
          { modo: "substituir" }
        );
        esperar(r.inseridos).aSer(1);
        const linhas = await S.listar("transactions");
        esperar(linhas).aTerTamanho(1);
        esperar(linhas[0].description).aSer("Nova");
      });
    });

    teste("relatório de importação detalha por tabela", async () => {
      await comSessaoLimpa(async () => {
        const r = await S.importarTudo({
          transactions: [{ type: "saida", description: "A", amount: 1, date: "2026-08-01" }],
          goals: [{ name: "Viagem", target_amount: 5000, current_amount: 0 }],
        }, { modo: "mesclar" });
        esperar(r.porTabela.transactions.inseridos).aSer(1);
        esperar(r.porTabela.goals.inseridos).aSer(1);
        esperar(r.inseridos).aSer(2);
      });
    });

    teste("exportar e reimportar preserva o conjunto", async () => {
      await comSessaoLimpa(async () => {
        await F.carregarDemo();
        const backup = await S.exportarTudo();
        const antes = (await S.listar("transactions")).length;
        await S.limparDados();
        esperar((await S.listar("transactions")).length).aSer(0);
        await S.importarTudo(backup, { modo: "substituir" });
        esperar((await S.listar("transactions")).length).aSer(antes);
      });
    });

    teste("contexto financeiro calcula saldo e renda livre", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({ income_monthly: 3000, work_days_month: 20, work_hours_day: 8, initial_balance: 500 });
        await S.inserir("transactions", { type: "entrada", description: "Salário", amount: 3000, date: "2026-08-05" });
        await S.inserir("transactions", { type: "saida", description: "Aluguel", amount: 1000, date: "2026-08-06" });
        await S.inserir("recurring_transactions", { description: "Aluguel", type: "saida", amount: 1000, day_of_month: 6, active: true });

        const ctx = await F.carregarContexto();
        esperar(ctx.saldo).aSer(2500);
        esperar(ctx.despesasFixas).aSer(1000);
        esperar(ctx.rendaLivre).aSer(2000);
      });
    });

    teste("recorrente inativo não entra nas despesas fixas", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({ income_monthly: 3000 });
        await S.inserir("recurring_transactions", { description: "Cancelado", type: "saida", amount: 500, day_of_month: 3, active: false });
        const ctx = await F.carregarContexto();
        esperar(ctx.despesasFixas).aSer(0);
      });
    });
  });

  descrever("Planejamento (FinckPlano)", () => {
    const P = window.FinckPlano;

    teste("divisão de parcelas não perde nem cria centavo", () => {
      [[100, 3], [2400, 12], [999.99, 7], [0.03, 2]].forEach(([total, q]) => {
        const partes = P.dividirParcelas(total, q);
        esperar(partes).aTerTamanho(q);
        const soma = partes.reduce((s, v) => s + v, 0);
        esperar(Math.round(soma * 100)).aSer(Math.round(total * 100));
      });
    });

    teste("a diferença de arredondamento fica na última parcela", () => {
      const p = P.dividirParcelas(100, 3);
      esperar(p[0]).aSerPerto(33.33, 2);
      esperar(p[1]).aSerPerto(33.33, 2);
      esperar(p[2]).aSerPerto(33.34, 2);
    });

    teste("divisão exata mantém todas as parcelas iguais", () => {
      const p = P.dividirParcelas(1200, 12);
      esperar(new Set(p).size).aSer(1);
      esperar(p[0]).aSer(100);
    });

    teste("cronograma avança um mês por parcela", () => {
      const c = P.cronograma({
        total_amount: 300, installments_count: 3,
        first_due_date: "2026-01-10", paid_count: 0,
      });
      esperar(c).aTerTamanho(3);
      esperar(c[0].mes).aSer("2026-01");
      esperar(c[1].mes).aSer("2026-02");
      esperar(c[2].mes).aSer("2026-03");
    });

    teste("vencimento no dia 31 recua em mês curto", () => {
      const c = P.cronograma({
        total_amount: 300, installments_count: 2,
        first_due_date: "2026-01-31", paid_count: 0,
      });
      esperar(c[1].vencimento.getMonth()).aSer(1);
      esperar(c[1].vencimento.getDate()).aSer(28);
    });

    teste("saldo devedor ignora as parcelas já pagas", () => {
      const p = { total_amount: 1000, installments_count: 10, first_due_date: "2026-01-05", paid_count: 4 };
      esperar(P.saldoDevedor(p)).aSerPerto(600, 2);
    });

    teste("parcelamento quitado não deve mais nada", () => {
      const p = { total_amount: 500, installments_count: 5, first_due_date: "2026-01-05", paid_count: 5 };
      esperar(P.saldoDevedor(p)).aSer(0);
    });

    teste("parcelas somam por mês e ignoram inativos", () => {
      const base = new Date(2026, 0, 1);
      const mapa = P.parcelasPorMes([
        { total_amount: 300, installments_count: 3, first_due_date: "2026-01-10", paid_count: 0, active: true },
        { total_amount: 600, installments_count: 3, first_due_date: "2026-01-20", paid_count: 0, active: false },
      ], 3, base);
      esperar(mapa["2026-01"]).aSerPerto(100, 2);
      esperar(mapa["2026-02"]).aSerPerto(100, 2);
    });

    teste("orçamento classifica tranquilo, atenção e estourado", () => {
      const tetos = [
        { id: 1, category: "Alimentação", limit_amount: 1000 },
        { id: 2, category: "Lazer", limit_amount: 100 },
        { id: 3, category: "Transporte", limit_amount: 200 },
      ];
      const transacoes = [
        { type: "saida", amount: 200, category: "Alimentação", date: "2026-08-03" },
        { type: "saida", amount: 80, category: "Lazer", date: "2026-08-04" },
        { type: "saida", amount: 260, category: "Transporte", date: "2026-08-05" },
      ];
      const r = P.situacaoOrcamento(tetos, transacoes, "2026-08");
      const porCat = Object.fromEntries(r.map((x) => [x.categoria, x]));
      esperar(porCat["Alimentação"].situacao).aSer("tranquilo");
      esperar(porCat["Lazer"].situacao).aSer("atencao");
      esperar(porCat["Transporte"].situacao).aSer("estourado");
      esperar(porCat["Transporte"].restante).aSer(-60);
    });

    teste("orçamento ignora gasto de outro mês", () => {
      const r = P.situacaoOrcamento(
        [{ id: 1, category: "Lazer", limit_amount: 100 }],
        [{ type: "saida", amount: 500, category: "Lazer", date: "2026-07-15" }],
        "2026-08"
      );
      esperar(r[0].gasto).aSer(0);
    });

    teste("orçamento ignora entradas", () => {
      const r = P.situacaoOrcamento(
        [{ id: 1, category: "Salário", limit_amount: 100 }],
        [{ type: "entrada", amount: 5000, category: "Salário", date: "2026-08-05" }],
        "2026-08"
      );
      esperar(r[0].gasto).aSer(0);
    });

    teste("aponta categorias com gasto e sem teto", () => {
      const semTeto = P.categoriasSemTeto(
        [{ category: "Lazer" }],
        [
          { type: "saida", amount: 10, category: "Lazer", date: "2026-08-01" },
          { type: "saida", amount: 10, category: "Moradia", date: "2026-08-02" },
        ],
        "2026-08"
      );
      esperar(semTeto).aTerTamanho(1);
      esperar(semTeto[0]).aSer("Moradia");
    });

    teste("calendário posiciona recorrentes e parcelas no dia certo", () => {
      const eventos = P.eventosDoMes({
        recorrentes: [{ description: "Salário", type: "entrada", amount: 3000, day_of_month: 5, active: true }],
        parcelamentos: [{ description: "TV", total_amount: 300, installments_count: 3, first_due_date: "2026-08-12", paid_count: 0, active: true }],
        transacoes: [{ description: "Mercado", type: "saida", amount: 120, date: "2026-08-20" }],
      }, "2026-08");

      esperar(eventos.get(5)[0].titulo).aSer("Salário");
      esperar(eventos.get(5)[0].sinal).aSer(1);
      esperar(eventos.get(12)[0].tipo).aSer("parcela");
      esperar(eventos.get(20)[0].titulo).aSer("Mercado");
    });

    teste("dia fora do mês é encaixado no último dia", () => {

      const eventos = P.eventosDoMes({
        recorrentes: [{ description: "Conta", type: "saida", amount: 90, day_of_month: 31, active: true }],
      }, "2026-09");
      esperar(eventos.has(30)).aSerVerdadeiro();
      esperar(eventos.has(31)).aSerFalso();
    });

    teste("projeção acumula o resultado mês a mês", () => {
      const base = new Date(2026, 0, 1);
      const linhas = P.projecaoSaldo({
        saldo: 1000,
        recorrentes: [
          { description: "Salário", type: "entrada", amount: 3000, day_of_month: 5, active: true },
          { description: "Aluguel", type: "saida", amount: 1000, day_of_month: 10, active: true },
        ],
        parcelamentos: [],
        meses: 3,
      }, base);

      esperar(linhas).aTerTamanho(3);
      esperar(linhas[0].saldoFim).aSer(3000);
      esperar(linhas[1].saldoFim).aSer(5000);
      esperar(linhas[2].saldoFim).aSer(7000);
    });

    teste("projeção soma as parcelas às saídas do mês", () => {
      const base = new Date(2026, 0, 1);
      const linhas = P.projecaoSaldo({
        saldo: 0,
        recorrentes: [{ description: "Salário", type: "entrada", amount: 1000, day_of_month: 1, active: true }],
        parcelamentos: [{ total_amount: 300, installments_count: 3, first_due_date: "2026-01-15", paid_count: 0, active: true }],
        meses: 2,
      }, base);
      esperar(linhas[0].parcelas).aSerPerto(100, 2);
      esperar(linhas[0].saldoFim).aSerPerto(900, 2);
    });

    teste("aponta o primeiro mês em que o saldo fura", () => {
      const base = new Date(2026, 0, 1);
      const linhas = P.projecaoSaldo({
        saldo: 500,
        recorrentes: [{ description: "Aluguel", type: "saida", amount: 400, day_of_month: 5, active: true }],
        parcelamentos: [],
        meses: 4,
      }, base);
      const furo = P.primeiroMesNegativo(linhas);
      esperar(furo === null).aSerFalso();

      esperar(furo.mes).aSer("2026-02");
      esperar(linhas[0].saldoFim).aSer(100);
      esperar(furo.saldoFim).aSer(-300);
    });

    teste("saldo saudável não acusa mês negativo", () => {
      const base = new Date(2026, 0, 1);
      const linhas = P.projecaoSaldo({
        saldo: 5000,
        recorrentes: [{ description: "Salário", type: "entrada", amount: 100, day_of_month: 1, active: true }],
        parcelamentos: [],
        meses: 4,
      }, base);
      esperar(P.primeiroMesNegativo(linhas)).aSer(null);
    });

    teste("plano da meta divide o que falta pelos meses restantes", () => {
      const hoje = new Date(2026, 0, 15);
      const plano = P.planoDaMeta(
        { target_amount: 6000, current_amount: 1200, deadline: "2026-07-01" },
        2000, hoje
      );
      esperar(plano.meses).aSer(6);
      esperar(plano.porMes).aSerPerto(800, 2);
      esperar(plano.cabe).aSerVerdadeiro();
      esperar(plano.fatiaDaRenda).aSerPerto(40, 1);
    });

    teste("plano marca a meta que não cabe na renda livre", () => {
      const hoje = new Date(2026, 0, 15);
      const plano = P.planoDaMeta(
        { target_amount: 12000, current_amount: 0, deadline: "2026-03-01" },
        1000, hoje
      );
      esperar(plano.cabe).aSerFalso();
    });

    teste("meta com prazo vencido é sinalizada", () => {
      const hoje = new Date(2026, 5, 1);
      const plano = P.planoDaMeta(
        { target_amount: 1000, current_amount: 0, deadline: "2026-01-01" },
        5000, hoje
      );
      esperar(plano.vencida).aSerVerdadeiro();
    });

    teste("meta já atingida não gera plano", () => {
      esperar(P.planoDaMeta({ target_amount: 1000, current_amount: 1000, deadline: "2027-01-01" }, 500)).aSer(null);
    });

    teste("atraso na meta converte gasto em meses de espera", () => {
      const a = P.atrasoNaMeta({}, 1600, 800);
      esperar(a.mesesExtras).aSerPerto(2, 2);
    });

    teste("atraso não calcula sem aporte definido", () => {
      esperar(P.atrasoNaMeta({}, 1000, 0)).aSer(null);
    });
  });

  descrever("Contas (FinckContas)", () => {
    const CT = window.FinckContas;

    const conta = (id, saldoInicial, extra = {}) => ({
      id, name: `Conta ${id}`, institution_name: "inter",
      account_type: "corrente", initial_balance: saldoInicial,
      active: true, ...extra,
    });

    teste("saldo inicial aparece sozinho quando não há movimento", () => {
      esperar(CT.saldoDaConta(conta("a", 500), {})).aSer(500);
    });

    teste("entrada aumenta só a conta vinculada", () => {
      const mov = { transacoes: [{ account_id: "a", type: "entrada", amount: 200 }] };
      esperar(CT.saldoDaConta(conta("a", 500), mov)).aSer(700);
      esperar(CT.saldoDaConta(conta("b", 500), mov)).aSer(500);
    });

    teste("saída reduz só a conta vinculada", () => {
      const mov = { transacoes: [{ account_id: "a", type: "saida", amount: 150 }] };
      esperar(CT.saldoDaConta(conta("a", 500), mov)).aSer(350);
      esperar(CT.saldoDaConta(conta("b", 500), mov)).aSer(500);
    });

    teste("lançamento sem conta não entra em conta nenhuma", () => {
      const mov = { transacoes: [{ account_id: null, type: "saida", amount: 999 }] };
      esperar(CT.saldoDaConta(conta("a", 500), mov)).aSer(500);
    });

    teste("transferência reduz a origem e aumenta o destino", () => {
      const mov = { transferencias: [{ from_account_id: "a", to_account_id: "b", amount: 200 }] };
      esperar(CT.saldoDaConta(conta("a", 1000), mov)).aSer(800);
      esperar(CT.saldoDaConta(conta("b", 500), mov)).aSer(700);
    });

    teste("transferência NÃO altera o patrimônio consolidado", () => {
      const contas = [conta("a", 1000), conta("b", 500)];
      const antes = CT.consolidado(contas, {});
      const depois = CT.consolidado(contas, {
        transferencias: [{ from_account_id: "a", to_account_id: "b", amount: 300 }],
      });
      esperar(antes.disponivel).aSer(1500);
      esperar(depois.disponivel).aSer(1500);
    });

    teste("ajuste de saldo entra na conta certa", () => {
      const mov = { ajustes: [{ account_id: "a", amount: -45 }] };
      esperar(CT.saldoDaConta(conta("a", 500), mov)).aSer(455);
    });

    teste("consolidado ignora contas arquivadas", () => {
      const r = CT.consolidado([conta("a", 1000), conta("b", 500, { active: false })], {});
      esperar(r.disponivel).aSer(1000);
      esperar(r.quantidade).aSer(1);
    });

    teste("conta arquivada mantém o histórico dela", () => {
      const mov = { transacoes: [{ account_id: "b", type: "entrada", amount: 200 }] };
      esperar(CT.saldoDaConta(conta("b", 500, { active: false }), mov)).aSer(700);
    });

    teste("saldo devedor é aceito e marcado", () => {
      const r = CT.consolidado([conta("a", -300)], {});
      esperar(r.disponivel).aSer(-300);
      esperar(r.negativas).aTerTamanho(1);
    });

    teste("total por instituição soma as contas de cada banco", () => {
      const contas = [
        conta("a", 100, { institution_name: "inter" }),
        conta("b", 250, { institution_name: "inter" }),
        conta("c", 400, { institution_name: "nubank" }),
      ];
      const linhas = CT.porInstituicao(CT.saldos(contas, {}));
      const inter = linhas.find((l) => l.instituicao.id === "inter");
      esperar(inter.total).aSer(350);
      esperar(inter.contas).aSer(2);
    });

    teste("instituição desconhecida cai em Outro sem quebrar", () => {
      esperar(CT.instituicao("banco-que-nao-existe").id).aSer("outro");
    });

    teste("transferência para a mesma conta é recusada", () => {
      esperar(CT.validarTransferencia({ origem: "a", destino: "a", valor: 100 })).aConter("diferente");
    });

    teste("transferência sem valor é recusada", () => {
      esperar(CT.validarTransferencia({ origem: "a", destino: "b", valor: 0 })).aConter("maior que zero");
    });

    teste("transferência válida passa", () => {
      esperar(CT.validarTransferencia({ origem: "a", destino: "b", valor: 100 })).aSer(null);
    });

    teste("ajuste calcula a diferença até o saldo real", () => {
      esperar(CT.diferencaDoAjuste(500, 480)).aSer(-20);
      esperar(CT.diferencaDoAjuste(500, 530)).aSer(30);
      esperar(CT.diferencaDoAjuste(500, 500)).aSer(0);
    });

    teste("conta quantos lançamentos ainda estão sem conta", () => {
      esperar(CT.semConta([{ account_id: "a" }, {}, { account_id: null }])).aSer(2);
    });
  });

  descrever("Campo de dinheiro (FinckMoeda)", () => {
    const M = window.FinckMoeda;

    const comCampo = (fn) => {
      const el = document.createElement("input");
      el.type = "text";
      el.setAttribute("data-moeda", "");
      document.body.appendChild(el);
      M.ligar(el);
      try { return fn(el); } finally { el.remove(); }
    };

    const digitar = (el, seq) => {
      el.dataset.centavos = "0";
      el.value = "";
      for (const ch of seq) {
        el.value += ch;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return M.ler(el);
    };

    teste("um dígito vira centavo", () => {
      comCampo((el) => esperar(digitar(el, "3")).aSerPerto(0.03, 2));
    });

    teste("dois dígitos ainda são centavos", () => {
      comCampo((el) => esperar(digitar(el, "32")).aSerPerto(0.32, 2));
    });

    teste("quatro dígitos viram reais com centavos zerados", () => {
      comCampo((el) => esperar(digitar(el, "3200")).aSer(32));
    });

    teste("valor grande mantém a separação de milhar", () => {
      comCampo((el) => {
        esperar(digitar(el, "123456")).aSerPerto(1234.56, 2);
        esperar(el.value).aConter("1.234,56");
      });
    });

    teste("texto colado aproveita só os dígitos", () => {
      comCampo((el) => {
        el.dataset.centavos = "0";
        el.value = "R$ 1.500,90 aprox";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        esperar(M.ler(el)).aSerPerto(1500.90, 2);
      });
    });

    teste("backspace remove um dígito, não a formatação", () => {
      comCampo((el) => {
        digitar(el, "3200");
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
        esperar(M.ler(el)).aSerPerto(3.20, 2);
      });
    });

    teste("escrever de código formata e é lido de volta igual", () => {
      comCampo((el) => {
        M.escrever(el, 1234.5);
        esperar(M.ler(el)).aSerPerto(1234.5, 2);
        esperar(el.value).aConter("1.234,50");
      });
    });

    teste("campo vazio vale zero", () => {
      comCampo((el) => esperar(M.ler(el)).aSer(0));
    });

    teste("limpar zera o campo", () => {
      comCampo((el) => {
        digitar(el, "5000");
        M.limpar(el);
        esperar(M.ler(el)).aSer(0);
        esperar(el.value).aSer("");
      });
    });

    teste("type=number vira text para caber o texto formatado", () => {
      const el = document.createElement("input");
      el.type = "number";
      document.body.appendChild(el);
      M.ligar(el);
      esperar(el.type).aSer("text");
      el.remove();
    });
  });

  descrever("Formatação (FinckUtils)", () => {
    const U = window.FinckUtils;

    teste("moeda formata em real com duas casas", () => {
      esperar(U.moeda(1234.5)).aConter("1.234,50");
    });

    teste("moeda trata nulo como zero", () => {
      esperar(U.moeda(null)).aConter("0,00");
    });

    teste("percentual usa as casas pedidas", () => {
      esperar(U.percentual(22.857, 1)).aSer("22,9%");
    });

    teste("progresso é limitado a 100", () => {
      esperar(U.progresso(150, 100)).aSer(100);
      esperar(U.progresso(25, 100)).aSer(25);
    });

    teste("progresso com alvo zero não vira NaN", () => {
      esperar(Number.isNaN(U.progresso(10, 0))).aSerFalso();
    });

    teste("escapeHTML neutraliza marcação", () => {
      const saida = U.escapeHTML('<img src=x onerror="alert(1)">');
      esperar(saida.includes("<img")).aSerFalso();
    });
  });

  // Os dez cenários que a análise lógica de 15.08 apontou como descobertos.
  // Não são funções puras: cada um percorre o caminho inteiro do dado e checa
  // se as visões continuam concordando entre si depois da operação.
  descrever("Invariantes de contabilidade (ponta a ponta)", () => {
    const S = window.FinckStore;
    const F = window.FinckFinance;
    const R = window.FinckRevisao;
    const O = window.FinckOcorrencias;
    const P = window.FinckPlano;
    const CT = window.FinckContas;

    const comSessaoLimpa = async (fn) => {
      const antes = {};
      Object.values(S.KEYS).forEach((v) => { antes[v] = localStorage.getItem(v); });
      Object.values(S.KEYS).forEach((v) => localStorage.removeItem(v));
      await S.entrarDemo();
      try { await fn(); } finally {
        Object.values(S.KEYS).forEach((v) => localStorage.removeItem(v));
        Object.entries(antes).forEach(([k, v]) => { if (v !== null) localStorage.setItem(k, v); });
      }
    };

    const ocorrenciaDeTeste = async ({ category = "Moradia", account_id = null } = {}) => {
      const rec = await S.inserir("recurring_transactions", {
        description: "Aluguel", type: "saida", amount: 1200,
        day_of_month: 6, active: true, category, account_id,
      });
      const [linha] = O.gerar([rec], { ciclos: ["2026-08"] });
      return S.inserir("recurring_occurrences", linha);
    };

    // 1. Confirmar duas vezes, inclusive depois de uma gravação parcial.
    teste("confirmar a mesma ocorrência duas vezes não cria duas transações", async () => {
      await comSessaoLimpa(async () => {
        const oc = await ocorrenciaDeTeste();

        const a = await R.confirmar(oc, 1200);
        const atualizada = await S.obter("recurring_occurrences", oc.id);
        const b = await R.confirmar(atualizada, 1200);

        esperar(a.transaction_id).aSer(b.transaction_id);
        esperar((await S.listar("transactions")).length).aSer(1);
      });
    });

    teste("retry depois de falha entre as duas gravações reaproveita o lançamento", async () => {
      await comSessaoLimpa(async () => {
        const oc = await ocorrenciaDeTeste();

        // Simula a falha exata do relatório: a transação entrou, a ocorrência não.
        await S.inserir("transactions", O.movimentacaoDe(oc, 1200, null));
        esperar((await S.listar("transactions")).length).aSer(1);

        await R.confirmar(oc, 1200);
        esperar((await S.listar("transactions")).length).aSer(1);

        const depois = await S.obter("recurring_occurrences", oc.id);
        esperar(depois.status).aSer("confirmado");
        esperar(Boolean(depois.transaction_id)).aSerVerdadeiro();
      });
    });

    teste("transação órfã de ocorrência não confirmada é varrida na sincronização", async () => {
      await comSessaoLimpa(async () => {
        const oc = await ocorrenciaDeTeste();
        await S.inserir("transactions", O.movimentacaoDe(oc, 1200, null));

        const todas = await S.listar("recurring_occurrences");
        await R.reconciliar(todas);

        esperar((await S.listar("transactions")).length).aSer(0);
      });
    });

    // A varredura não pode confundir "previsão que não aconteceu" com
    // "dinheiro que se moveu e cuja previsão foi apagada depois".
    teste("apagar o recorrente não apaga o dinheiro que já se moveu", async () => {
      await comSessaoLimpa(async () => {
        const oc = await ocorrenciaDeTeste();
        await R.confirmar(oc, 1200);
        esperar((await S.listar("transactions")).length).aSer(1);

        // Simula o cascade do banco: a ocorrência some, o lançamento fica.
        await S.remover("recurring_occurrences", oc.id);
        await R.reconciliar(await S.listar("recurring_occurrences"));

        const restantes = await S.listar("transactions");
        esperar(restantes.length).aSer(1);
        esperar(restantes[0].source_occurrence_id).aSer(null);
        esperar(Number(restantes[0].amount)).aSer(1200);
      });
    });

    teste("varredura separa órfã de previsão e órfã de ocorrência apagada", () => {
      const ocorrencias = [{ id: "oc-viva", status: "pendente", transaction_id: null }];
      const transacoes = [
        { id: "t-sobra", source_occurrence_id: "oc-viva" },
        { id: "t-real", source_occurrence_id: "oc-apagada" },
      ];

      const r = O.orfas(ocorrencias, transacoes);
      esperar(r.excluir).aTerTamanho(1);
      esperar(r.excluir[0]).aSer("t-sobra");
      esperar(r.soltarVinculo).aTerTamanho(1);
      esperar(r.soltarVinculo[0]).aSer("t-real");
    });

    // 2 e 10. Conta, categoria, saldo global e saldo da conta ao mesmo tempo.
    teste("ocorrência confirmada com conta bate no saldo global e no saldo da conta", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({ income_monthly: 3500, work_days_month: 22, work_hours_day: 8 });
        const conta = await S.inserir("accounts", {
          name: "Conta corrente", institution_name: "nubank",
          account_type: "corrente", initial_balance: 5000, active: true,
        });
        const oc = await ocorrenciaDeTeste({ category: "Moradia", account_id: conta.id });

        await R.confirmar(oc, 1200);

        const ctx = await F.carregarContexto();
        const mov = ctx.transacoes[0];

        // Herdou conta e categoria da regra, como o relatório exige.
        esperar(String(mov.account_id)).aSer(String(conta.id));
        esperar(mov.category).aSer("Moradia");

        // As duas visões contam a mesma coisa.
        esperar(ctx.saldo).aSer(3800);
        const consolidado = CT.consolidado([conta], { transacoes: ctx.transacoes });
        esperar(consolidado.disponivel).aSer(3800);
        esperar(CT.semConta(ctx.transacoes)).aSer(0);
      });
    });

    teste("confirmação sem conta é declarada, não silenciosa", async () => {
      await comSessaoLimpa(async () => {
        const conta = await S.inserir("accounts", {
          name: "Carteira", institution_name: "outro",
          account_type: "corrente", initial_balance: 0, active: true,
        });
        const oc = await ocorrenciaDeTeste({ account_id: null });
        await R.confirmar(oc, 1200, { account_id: null });

        const ctx = await F.carregarContexto();
        esperar(CT.semConta(ctx.transacoes)).aSer(1);

        // A divergência entre as visões é mensurável em vez de invisível.
        const consolidado = CT.consolidado([conta], { transacoes: ctx.transacoes });
        esperar(ctx.saldo - consolidado.disponivel).aSer(-1200);
      });
    });

    // 3. Excluir uma saída vinculada a meta reverte o progresso.
    teste("excluir aporte devolve o valor à meta exatamente uma vez", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva", target_amount: 6000, current_amount: 1000,
        });
        await F.aportarMeta(meta.id, 500, "Aporte — Reserva");

        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1500);

        const mov = (await S.listar("transactions"))[0];
        await F.estornarTransacao(mov.id, { motivo: "Aporte indevido" });

        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1000);

        // O relatório pede estorno que preserva o histórico: a linha continua
        // na tabela, marcada e com motivo, mas fora de todo cálculo de saldo.
        const todas = await S.listar("transactions");
        esperar(todas).aTerTamanho(1);
        esperar(Boolean(todas[0].reversed_at)).aSerVerdadeiro();
        esperar(todas[0].reversal_reason).aSer("Aporte indevido");
        esperar(F.vigentes(todas)).aTerTamanho(0);
        esperar((await F.carregarContexto()).saldo).aSer(0);
      });
    });

    teste("estornar duas vezes não reverte a meta duas vezes", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", { name: "Reserva", target_amount: 6000, current_amount: 1000 });
        await F.aportarMeta(meta.id, 500, "Aporte");
        const mov = (await S.listar("transactions"))[0];

        await F.estornarTransacao(mov.id);
        const r = await F.estornarTransacao(mov.id);

        esperar(r.repetida).aSerVerdadeiro();
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1000);

        // Um estorno, um movimento de contrapartida — nunca dois.
        const livro = await S.listar("goal_movements", { filtro: { goal_id: meta.id } });
        esperar(livro.filter((m) => m.kind === "estorno")).aTerTamanho(1);
      });
    });

    // 4. Aporte com falha na segunda persistência não deixa caixa reduzido.
    teste("aporte que falha ao atualizar a meta não deixa a saída no caixa", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", { name: "Reserva", target_amount: 6000, current_amount: 1000 });

        const original = S.atualizar;
        let falhou = false;
        S.atualizar = async (tabela, id, campos) => {
          if (tabela === "goals") { falhou = true; throw new Error("timeout simulado"); }
          return original(tabela, id, campos);
        };

        try {
          await esperar(() => F.aportarMeta(meta.id, 500, "Aporte")).aFalharCom("timeout simulado");
        } finally { S.atualizar = original; }

        esperar(falhou).aSerVerdadeiro();
        // Compensação: nem a saída ficou, nem a meta subiu.
        esperar((await S.listar("transactions")).length).aSer(0);
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1000);
      });
    });

    // 5. Saldo inicial do perfil e da conta não podem somar duas vezes.
    teste("cadastrar conta com o mesmo saldo do perfil não duplica patrimônio", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({ income_monthly: 3000, work_days_month: 22, work_hours_day: 8, initial_balance: 2000 });

        const semContas = await F.carregarContexto();
        esperar(semContas.saldo).aSer(2000);
        esperar(semContas.origemSaldo.fonte).aSer("perfil");

        await S.inserir("accounts", {
          name: "Conta", institution_name: "nubank", account_type: "corrente",
          initial_balance: 2000, active: true,
        });

        const comConta = await F.carregarContexto();
        esperar(comConta.saldo).aSer(2000);
        esperar(comConta.origemSaldo.fonte).aSer("contas");
        esperar(comConta.origemSaldo.duplicaria).aSer(2000);
      });
    });

    // 6. Parcela paga vira lançamento e deixa de ser compromisso.
    teste("parcela paga sai da projeção e entra no saldo uma única vez", async () => {
      await comSessaoLimpa(async () => {
        const compra = await S.inserir("installment_purchases", {
          description: "Notebook", total_amount: 3000, installments_count: 3,
          first_due_date: "2026-08-10", paid_count: 0, category: "Eletrônicos", active: true,
        });

        const antes = await F.carregarContexto();
        esperar(antes.compromissosAbertos).aSer(3000);

        await F.pagarParcela(compra, 1);

        const depois = await F.carregarContexto();
        esperar(depois.compromissosAbertos).aSer(2000);
        esperar(depois.transacoes.length).aSer(1);
        esperar(Number(depois.transacoes[0].amount)).aSer(1000);

        // Pagar de novo é inofensivo: não duplica o lançamento.
        const compraAtual = await S.obter("installment_purchases", compra.id);
        const r = await F.pagarParcela(compraAtual, 1);
        esperar(r.jaPaga).aSerVerdadeiro();
        esperar((await S.listar("transactions")).length).aSer(1);
      });
    });

    teste("desfazer pagamento devolve a parcela ao compromisso e remove o lançamento", async () => {
      await comSessaoLimpa(async () => {
        const compra = await S.inserir("installment_purchases", {
          description: "Notebook", total_amount: 3000, installments_count: 3,
          first_due_date: "2026-08-10", paid_count: 0, category: "Eletrônicos", active: true,
        });
        await F.pagarParcela(compra, 1);
        await F.desfazerPagamentoParcela(await S.obter("installment_purchases", compra.id), 1);

        const ctx = await F.carregarContexto();
        esperar(ctx.compromissosAbertos).aSer(3000);
        esperar(ctx.transacoes.length).aSer(0);
        esperar(ctx.saldo).aSer(0);

        // O pagamento existiu: ele fica no histórico, estornado.
        esperar(ctx.transacoesEstornadas).aTerTamanho(1);
      });
    });

    teste("parcela em aberto não aparece como previsto e realizado ao mesmo tempo", async () => {
      const compra = {
        id: "c1", description: "Notebook", total_amount: 3000, installments_count: 3,
        first_due_date: "2026-08-10", paid_count: 0, active: true,
      };
      const pagamentos = [{ purchase_id: "c1", installment_no: 1, status: "paga", transaction_id: "t1" }];
      const transacoes = [{ description: "Notebook (1/3)", amount: 1000, type: "saida", date: "2026-08-10" }];

      const eventos = P.eventosDoMes({ parcelamentos: [compra], pagamentos, transacoes }, "2026-08");
      const doDia = eventos.get(10) || [];

      esperar(doDia.filter((e) => e.tipo === "parcela").length).aSer(0);
      esperar(doDia.filter((e) => e.tipo === "lancamento").length).aSer(1);
      esperar(doDia[0].estado).aSer("realizado");
    });

    // 7. Editar a regra depois do ciclo gerado.
    teste("editar recorrente não reescreve ciclo já confirmado", async () => {
      await comSessaoLimpa(async () => {
        const rec = await S.inserir("recurring_transactions", {
          description: "Aluguel", type: "saida", amount: 1200,
          day_of_month: 6, active: true, category: "Moradia",
        });
        const [linha] = O.gerar([rec], { ciclos: ["2026-08"] });
        const oc = await S.inserir("recurring_occurrences", linha);
        await R.confirmar(oc, 1200);

        await S.atualizar("recurring_transactions", rec.id, { amount: 1300 });

        const congelada = await S.obter("recurring_occurrences", oc.id);
        esperar(Number(congelada.planned_amount)).aSer(1200);
        esperar(Number(congelada.actual_amount)).aSer(1200);
      });
    });

    teste("ocorrência gerada herda categoria e conta da regra", () => {
      const rec = {
        id: "r1", description: "Internet", type: "saida", amount: 99,
        day_of_month: 10, active: true, category: "Casa", account_id: "conta-1",
      };
      const [linha] = O.gerar([rec], { ciclos: ["2026-08"] });
      esperar(linha.category).aSer("Casa");
      esperar(linha.account_id).aSer("conta-1");

      const mov = O.movimentacaoDe({ ...linha, id: "oc-1" }, 99);
      esperar(mov.category).aSer("Casa");
      esperar(mov.account_id).aSer("conta-1");
      esperar(mov.source_occurrence_id).aSer("oc-1");
    });

    // 8. Importar arquivo com vínculos inconsistentes.
    teste("importação recusa valores inválidos e limpa vínculos órfãos", async () => {
      await comSessaoLimpa(async () => {
        const exame = S.validarImportacao({
          goals: [
            { id: "g1", name: "Viagem", target_amount: 5000, current_amount: 0 },
            { id: "g2", name: "Zerada", target_amount: 0, current_amount: 0 },
            { id: "g3", name: "Negativa", target_amount: 100, current_amount: -50 },
          ],
          transactions: [
            { id: "t1", type: "saida", description: "Aporte", amount: 100, date: "2026-08-01", goal_id: "g1" },
            { id: "t2", type: "saida", description: "Órfã", amount: 100, date: "2026-08-01", goal_id: "inexistente" },
            { id: "t3", type: "saida", description: "Negativa", amount: -5, date: "2026-08-01" },
            { id: "t4", type: "compra", description: "Tipo errado", amount: 10, date: "2026-08-01" },
          ],
          transfers: [
            { id: "x1", from_account_id: "a1", to_account_id: "a1", amount: 50, date: "2026-08-01" },
            { id: "x2", from_account_id: "a1", to_account_id: "a2", amount: 50, date: "2026-08-01" },
          ],
        });

        esperar(exame.linhas.goals).aTerTamanho(1);
        esperar(exame.linhas.transactions).aTerTamanho(2);
        esperar(exame.linhas.transfers).aTerTamanho(0);
      });
    });

    teste("importação reaponta o vínculo com a meta para o novo ID", async () => {
      await comSessaoLimpa(async () => {
        await S.importarTudo({
          goals: [{ id: "antigo-g1", name: "Viagem", target_amount: 5000, current_amount: 0 }],
          transactions: [{
            id: "antigo-t1", type: "saida", description: "Aporte",
            amount: 100, date: "2026-08-01", goal_id: "antigo-g1",
          }],
        }, { modo: "substituir" });

        const meta = (await S.listar("goals"))[0];
        const mov = (await S.listar("transactions"))[0];

        esperar(String(mov.goal_id)).aSer(String(meta.id));
        esperar(mov.goal_id === "antigo-g1").aSerFalso();
      });
    });

    teste("importação não deixa user_id de outra pessoa passar", async () => {
      await comSessaoLimpa(async () => {
        await S.importarTudo({
          transactions: [{
            id: "t1", user_id: "outro-usuario", type: "saida",
            description: "Alheia", amount: 10, date: "2026-08-01",
          }],
        }, { modo: "substituir" });

        const eu = await S.usuarioAtual();
        const mov = (await S.listar("transactions"))[0];
        esperar(mov.user_id).aSer(eu.id);
      });
    });

    // 9. Renda comprometida: caixa, orçamento e projeção não se confundem.
    teste("renda totalmente comprometida aparece como déficit, não como folga", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({ income_monthly: 3500, work_days_month: 22, work_hours_day: 8, initial_balance: 4000 });
        await S.inserir("recurring_transactions", {
          description: "Fixas", type: "saida", amount: 3500, day_of_month: 5, active: true,
        });

        const ctx = await F.carregarContexto();
        esperar(ctx.rendaLivre).aSer(0);
        esperar(ctx.sobraAposFixos).aSer(0);
        esperar(ctx.semFolga).aSerVerdadeiro();

        // O caixa ainda tem dinheiro antigo, mas isso não é folga de renda.
        esperar(ctx.saldo).aSer(4000);
      });
    });

    teste("compra pequena sem folga não recebe semáforo verde", () => {
      const perfil = { income_monthly: 3500, work_days_month: 22, work_hours_day: 8 };
      const r = window.FinckReality.calcular(100, perfil, { saldo: 4000, despesasFixas: 3500 });

      esperar(r.income_percent).aSerPerto(2.86, 2);
      esperar(r.sem_folga).aSerVerdadeiro();
      esperar(r.semaforo.nivel).aSer("alerta");
    });

    teste("déficit de renda fixa aparece com sinal, não zerado", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({ income_monthly: 3000, work_days_month: 22, work_hours_day: 8 });
        await S.inserir("recurring_transactions", {
          description: "Fixas", type: "saida", amount: 3800, day_of_month: 5, active: true,
        });

        const ctx = await F.carregarContexto();
        esperar(ctx.sobraAposFixos).aSer(-800);
        esperar(ctx.deficitFixos).aSer(800);
        esperar(ctx.rendaLivre).aSer(0);
      });
    });

    teste("lançamento com data futura não conta como caixa de hoje", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({ income_monthly: 3000, work_days_month: 22, work_hours_day: 8, initial_balance: 1000 });
        const hoje = new Date();
        const daquiATresMeses = new Date(hoje.getFullYear(), hoje.getMonth() + 3, 10)
          .toISOString().slice(0, 10);

        await S.inserir("transactions", { type: "saida", description: "Seguro anual", amount: 600, date: daquiATresMeses });

        const ctx = await F.carregarContexto();
        esperar(ctx.saldo).aSer(1000);
        esperar(ctx.transacoesFuturas).aTerTamanho(1);
        esperar(ctx.agendado).aSer(-600);

        // Mas ele aparece no mês dele na projeção.
        const linhas = P.projecaoSaldo({
          saldo: ctx.saldo, recorrentes: [], transacoesFuturas: ctx.transacoesFuturas, meses: 6,
        });
        esperar(linhas[3].saidas).aSer(600);
        esperar(linhas[5].saldoFim).aSer(400);
      });
    });

    teste("ciclo já decidido não volta como previsão na projeção", () => {
      const recorrentes = [{ id: "r1", description: "Aluguel", type: "saida", amount: 1200, day_of_month: 6, active: true }];
      const mesAtual = P.chaveMes(new Date());

      const semDecisao = P.projecaoSaldo({ saldo: 5000, recorrentes, meses: 1 }, new Date(`${mesAtual}-01T12:00:00`));
      esperar(semDecisao[0].saidas).aSer(1200);

      const comDecisao = P.projecaoSaldo({
        saldo: 5000, recorrentes, meses: 1,
        ocorrencias: [{ recurring_id: "r1", cycle: mesAtual, status: "confirmado" }],
      }, new Date(`${mesAtual}-01T12:00:00`));
      esperar(comDecisao[0].saidas).aSer(0);
    });

    teste("ocorrência não realizada continua prevista na projeção", () => {
      const recorrentes = [{ id: "r1", type: "saida", amount: 1200, day_of_month: 6, active: true }];
      const mesAtual = P.chaveMes(new Date());
      const linhas = P.projecaoSaldo({
        saldo: 5000, recorrentes, meses: 1,
        ocorrencias: [{ recurring_id: "r1", cycle: mesAtual, status: "pendente" }],
      }, new Date(`${mesAtual}-01T12:00:00`));
      esperar(linhas[0].saidas).aSer(1200);
    });

    teste("disponível projetado desconta parcelas em aberto do saldo", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({ income_monthly: 3000, work_days_month: 22, work_hours_day: 8, initial_balance: 5000 });
        await S.inserir("installment_purchases", {
          description: "Notebook", total_amount: 3000, installments_count: 3,
          first_due_date: "2026-08-10", paid_count: 0, active: true,
        });

        const ctx = await F.carregarContexto();
        esperar(ctx.saldo).aSer(5000);
        esperar(ctx.disponivelProjetado).aSer(2000);
      });
    });

    // Com a migration aplicada, a operação tem que ir para o banco em vez de
    // ser montada no cliente. Sem ela, tem que continuar funcionando.
    teste("confirmação usa a função do banco quando ela existe", async () => {
      await comSessaoLimpa(async () => {
        const oc = await ocorrenciaDeTeste();
        const original = S.rpc;
        const chamadas = [];

        S.rpc = async (nome, params) => {
          chamadas.push({ nome, params });
          return { suportado: true, dados: { status: "confirmado", transaction_id: "tx-do-banco" } };
        };

        try {
          const r = await R.confirmar(oc, 1200, { account_id: null });
          esperar(r.atomica).aSerVerdadeiro();
          esperar(r.transaction_id).aSer("tx-do-banco");
        } finally { S.rpc = original; }

        esperar(chamadas).aTerTamanho(1);
        esperar(chamadas[0].nome).aSer("confirmar_ocorrencia");
        esperar(chamadas[0].params.p_amount).aSer(1200);

        // O cliente não duplicou o trabalho do banco.
        esperar((await S.listar("transactions")).length).aSer(0);
      });
    });

    teste("confirmação cai para o caminho local quando a função não existe", async () => {
      await comSessaoLimpa(async () => {
        const oc = await ocorrenciaDeTeste();
        const original = S.rpc;
        S.rpc = async () => ({ suportado: false, dados: null });

        try {
          const r = await R.confirmar(oc, 1200, { account_id: null });
          esperar(r.atomica).aSer(undefined);
          esperar(Boolean(r.transaction_id)).aSerVerdadeiro();
        } finally { S.rpc = original; }

        esperar((await S.listar("transactions")).length).aSer(1);
      });
    });

    teste("estorno usa a função do banco quando ela existe", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", { name: "Reserva", target_amount: 6000, current_amount: 1000 });
        await F.aportarMeta(meta.id, 500, "Aporte");
        const mov = (await S.listar("transactions"))[0];

        const original = S.rpc;
        const chamadas = [];
        S.rpc = async (nome, params) => { chamadas.push({ nome, params }); return { suportado: true, dados: null }; };

        try {
          const r = await F.estornarTransacao(mov.id);
          esperar(r.atomica).aSerVerdadeiro();
          esperar(r.estornouMeta).aSerVerdadeiro();
        } finally { S.rpc = original; }

        esperar(chamadas[0].nome).aSer("estornar_transacao");
        esperar(chamadas[0].params.p_transaction_id).aSer(mov.id);
      });
    });

    // Isolamento do modo local (P2).
    teste("mutação local não alcança registro de outro usuário", async () => {
      await comSessaoLimpa(async () => {
        const minha = await S.inserir("transactions", {
          type: "saida", description: "Minha", amount: 10, date: "2026-08-01",
        });

        const linhas = JSON.parse(localStorage.getItem(S.KEYS.transactions));
        linhas.push({ id: "alheia", user_id: "outro-usuario", type: "saida",
                      description: "Alheia", amount: 99, date: "2026-08-01" });
        localStorage.setItem(S.KEYS.transactions, JSON.stringify(linhas));

        esperar(await S.atualizar("transactions", "alheia", { amount: 1 })).aSer(null);
        esperar(await S.remover("transactions", "alheia")).aSerFalso();

        const depois = JSON.parse(localStorage.getItem(S.KEYS.transactions));
        const alheia = depois.find((r) => r.id === "alheia");
        esperar(Number(alheia.amount)).aSer(99);
        esperar(depois.some((r) => String(r.id) === String(minha.id))).aSerVerdadeiro();
      });
    });
  });

  // ==========================================================================
  // Testes obrigatórios do relatório de conclusão (seção 6)
  // ==========================================================================

  descrever("Livro-razão das metas (6.1)", () => {
    const M = window.FinckMetas;

    teste("progresso é a soma assinada dos movimentos", () => {
      const livro = [
        { goal_id: "g", kind: "aporte", amount: 500 },
        { goal_id: "g", kind: "aporte", amount: 300 },
        { goal_id: "g", kind: "retirada", amount: -200 },
      ];
      esperar(M.progresso(livro)).aSer(600);
    });

    teste("estorno entra com o sinal oposto ao do movimento original", () => {
      const original = { id: "m1", goal_id: "g", amount: 500, transaction_id: "t1" };
      const estorno = M.movimentoDoEstorno(original, { date: "2026-08-16" });
      esperar(estorno.amount).aSer(-500);
      esperar(estorno.reverses_id).aSer("m1");
      esperar(M.progresso([original, estorno])).aSer(0);
    });

    teste("saída vinculada guarda dinheiro; entrada vinculada devolve", () => {
      esperar(M.valorAssinado("saida", 100)).aSer(100);
      esperar(M.valorAssinado("entrada", 100)).aSer(-100);
      esperar(M.kindDoTipo("saida")).aSer("aporte");
      esperar(M.kindDoTipo("entrada")).aSer("retirada");
    });

    teste("divergência entre cache e histórico é medida, não escondida", () => {
      const metas = [{ id: "g", name: "Reserva", current_amount: 1500 }];
      const livro = [{ goal_id: "g", kind: "aporte", amount: 1000 }];
      const [d] = M.divergencias(metas, livro);
      esperar(d.cache).aSer(1500);
      esperar(d.historico).aSer(1000);
      esperar(d.diferenca).aSer(500);
    });

    teste("cache igual ao histórico não vira divergência", () => {
      const metas = [{ id: "g", name: "Reserva", current_amount: 1000 }];
      const livro = [{ goal_id: "g", kind: "aporte", amount: 1000 }];
      esperar(M.conferem(metas, livro)).aSerVerdadeiro();
    });

    teste("progresso exibido nunca fica negativo", () => {
      esperar(M.progressoExibido([{ goal_id: "g", amount: -50 }])).aSer(0);
    });

    teste("estorno duas vezes é barrado pelo próprio livro", () => {
      const original = { id: "m1", goal_id: "g", amount: 500 };
      const estorno = { id: "m2", goal_id: "g", amount: -500, kind: "estorno", reverses_id: "m1" };
      esperar(M.jaEstornado([original, estorno], "m1")).aSerVerdadeiro();
      esperar(M.jaEstornado([original], "m1")).aSerFalso();
    });
  });

  descrever("Invariantes contábeis do relatório (6.1)", () => {
    const S = window.FinckStore;
    const F = window.FinckFinance;
    const CT = window.FinckContas;

    const comSessaoLimpa = async (fn) => {
      const antes = {};
      Object.entries(S.KEYS).forEach(([, v]) => { antes[v] = localStorage.getItem(v); });
      Object.values(S.KEYS).forEach((v) => localStorage.removeItem(v));
      await S.entrarDemo();
      try { await fn(); } finally {
        Object.values(S.KEYS).forEach((v) => localStorage.removeItem(v));
        Object.entries(antes).forEach(([k, v]) => { if (v !== null) localStorage.setItem(k, v); });
      }
    };

    teste("aporte move o progresso exatamente uma vez", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", { name: "Reserva", target_amount: 6000, current_amount: 0 });
        await F.aportarMeta(meta.id, 500, "Aporte");

        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(500);
        esperar(await S.listar("goal_movements", { filtro: { goal_id: meta.id } })).aTerTamanho(1);
      });
    });

    teste("aporte repetido com a mesma chave não lança duas vezes", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", { name: "Reserva", target_amount: 6000, current_amount: 0 });
        const chave = "aporte-idem-1";

        await F.aportarMeta(meta.id, 500, "Aporte", { chave });
        await F.aportarMeta(meta.id, 500, "Aporte", { chave });

        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(500);
        esperar(await S.listar("transactions")).aTerTamanho(1);
      });
    });

    teste("retirada devolve o dinheiro da meta ao caixa", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", { name: "Reserva", target_amount: 6000, current_amount: 0 });
        await F.aportarMeta(meta.id, 800, "Aporte");
        await F.retirarMeta(meta.id, 300, "Retirada");

        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(500);
        esperar((await F.carregarContexto()).saldo).aSer(-500);
      });
    });

    teste("progresso da meta é recalculável a partir do histórico", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", { name: "Reserva", target_amount: 6000, current_amount: 0 });
        await F.aportarMeta(meta.id, 500, "Aporte");
        await F.aportarMeta(meta.id, 250, "Aporte");

        // Corrompe o cache de propósito: o recálculo tem de consertar sozinho.
        await S.atualizar("goals", meta.id, { current_amount: 99999 });
        await F.recalcularMeta(meta.id);

        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(750);
      });
    });

    // Regressão: o recálculo não pode apagar o que ele ainda não sabe explicar.
    teste("meta antiga não perde o progresso no primeiro aporte", async () => {
      await comSessaoLimpa(async () => {
        // Meta de antes do livro-razão: valor guardado, zero movimentos.
        const meta = await S.inserir("goals", {
          name: "Reserva", target_amount: 6000, current_amount: 1000,
        });
        esperar(await S.listar("goal_movements", { filtro: { goal_id: meta.id } })).aTerTamanho(0);

        await F.aportarMeta(meta.id, 500, "Aporte");

        // O valor antigo virou histórico em vez de sumir no recálculo.
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1500);
        const livro = await S.listar("goal_movements", { filtro: { goal_id: meta.id } });
        esperar(livro).aTerTamanho(2);
        esperar(livro.filter((m) => m.kind === "ajuste")).aTerTamanho(1);
      });
    });

    teste("semear o histórico duas vezes não duplica o valor antigo", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva", target_amount: 6000, current_amount: 1000,
        });
        await F.garantirHistorico(meta.id);
        await F.garantirHistorico(meta.id);

        esperar(await S.listar("goal_movements", { filtro: { goal_id: meta.id } })).aTerTamanho(1);

        await F.recalcularMeta(meta.id);
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1000);
      });
    });

    teste("meta criada com valor guardado nasce com histórico", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", { name: "Reserva", target_amount: 6000, current_amount: 0 });
        await F.ajustarMeta(meta.id, 1500, "Saldo informado na criação");

        const livro = await S.listar("goal_movements", { filtro: { goal_id: meta.id } });
        esperar(livro).aTerTamanho(1);
        esperar(livro[0].kind).aSer("ajuste");
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1500);
      });
    });

    teste("transferência não muda o patrimônio total", async () => {
      await comSessaoLimpa(async () => {
        const a = await S.inserir("accounts", { name: "Corrente", initial_balance: 1000, active: true });
        const b = await S.inserir("accounts", { name: "Poupança", initial_balance: 0, active: true });

        const antes = await F.carregarContexto();
        await F.transferir({ from_account_id: a.id, to_account_id: b.id, amount: 300, date: "2026-08-16" });
        const depois = await F.carregarContexto();

        esperar(depois.saldo).aSer(antes.saldo);

        const mov = { transacoes: depois.transacoes, transferencias: depois.transferencias, ajustes: depois.ajustes };
        esperar(CT.saldoDaConta(a, mov)).aSer(700);
        esperar(CT.saldoDaConta(b, mov)).aSer(300);
      });
    });

    teste("transferência repetida com a mesma chave não duplica", async () => {
      await comSessaoLimpa(async () => {
        const a = await S.inserir("accounts", { name: "Corrente", initial_balance: 1000, active: true });
        const b = await S.inserir("accounts", { name: "Poupança", initial_balance: 0, active: true });

        await F.transferir({ from_account_id: a.id, to_account_id: b.id, amount: 300, chave: "t-1" });
        await F.transferir({ from_account_id: a.id, to_account_id: b.id, amount: 300, chave: "t-1" });

        esperar(await S.listar("transfers")).aTerTamanho(1);
      });
    });

    teste("confirmar com conta muda saldo global e saldo da conta juntos", async () => {
      await comSessaoLimpa(async () => {
        const conta = await S.inserir("accounts", { name: "Corrente", initial_balance: 0, active: true });
        await F.registrarTransacao({
          type: "saida", description: "Mercado", amount: 200,
          date: "2026-08-10", category: "Alimentação", account_id: conta.id,
        });

        const ctx = await F.carregarContexto();
        esperar(ctx.saldo).aSer(-200);
        esperar(CT.saldoDaConta(conta, { transacoes: ctx.transacoes })).aSer(-200);
        esperar(ctx.naoAlocado).aSer(0);
      });
    });

    teste("confirmar sem conta é declarado e aparece como não alocado", async () => {
      await comSessaoLimpa(async () => {
        await S.inserir("accounts", { name: "Corrente", initial_balance: 0, active: true });
        await F.registrarTransacao({
          type: "saida", description: "Feira", amount: 80,
          date: "2026-08-10", category: "Alimentação", account_id: null, unallocated: true,
        });

        const ctx = await F.carregarContexto();
        esperar(ctx.naoAlocado).aSer(-80);
        esperar(ctx.semContaVinculada).aSer(1);
      });
    });

    teste("ajuste de conta entra no saldo global, senão as duas visões divergem", async () => {
      await comSessaoLimpa(async () => {
        const conta = await S.inserir("accounts", { name: "Corrente", initial_balance: 100, active: true });
        await S.inserir("balance_adjustments", {
          account_id: conta.id, amount: 50, new_balance: 150, date: "2026-08-10", reason: "Conferência",
        });

        const ctx = await F.carregarContexto();
        esperar(ctx.saldo).aSer(150);
        esperar(CT.saldoDaConta(conta, { transacoes: ctx.transacoes, ajustes: ctx.ajustes })).aSer(150);
      });
    });
  });

  descrever("Reconciliador financeiro (fase 3)", () => {
    const RC = window.FinckReconciliador;

    const base = {
      perfil: { id: "u", initial_balance: 0 },
      contas: [], transacoes: [], transferencias: [], ajustes: [],
      metas: [], movimentosMeta: [], parcelamentos: [], pagamentos: [], ocorrencias: [],
      hoje: "2026-08-16",
    };

    teste("identidade fecha quando tudo está alocado", () => {
      const r = RC.conferir({
        ...base,
        contas: [{ id: "a", name: "Corrente", initial_balance: 1000, active: true }],
        transacoes: [
          { id: "t1", type: "saida", amount: 200, date: "2026-08-10", account_id: "a", category: "Casa" },
        ],
      });
      esperar(r.caixa.saldoGlobal).aSer(800);
      esperar(r.caixa.somaContas).aSer(800);
      esperar(r.caixa.naoAlocado).aSer(0);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });

    teste("saldo global = contas + não alocado, mesmo com lançamento fora das contas", () => {
      const r = RC.conferir({
        ...base,
        contas: [{ id: "a", name: "Corrente", initial_balance: 1000, active: true }],
        transacoes: [
          { id: "t1", type: "saida", amount: 200, date: "2026-08-10", account_id: "a", category: "Casa" },
          { id: "t2", type: "saida", amount: 50, date: "2026-08-11", account_id: null, unallocated: true, category: "Outros" },
        ],
      });
      esperar(r.caixa.somaContas).aSer(800);
      esperar(r.caixa.naoAlocado).aSer(-50);
      esperar(r.caixa.saldoGlobal).aSer(750);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });

    teste("sem conta cadastrada o saldo inicial do perfil é não alocado", () => {
      const r = RC.conferir({
        ...base,
        perfil: { id: "u", initial_balance: 500 },
        transacoes: [{ id: "t1", type: "entrada", amount: 100, date: "2026-08-10" }],
      });
      esperar(r.caixa.somaContas).aSer(0);
      esperar(r.caixa.naoAlocado).aSer(600);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });

    teste("movimentação estornada sai do saldo e continua no histórico", () => {
      const r = RC.conferir({
        ...base,
        contas: [{ id: "a", name: "Corrente", initial_balance: 1000, active: true }],
        transacoes: [
          { id: "t1", type: "saida", amount: 200, date: "2026-08-10", account_id: "a",
            reversed_at: "2026-08-12T10:00:00Z", category: "Casa" },
        ],
      });
      esperar(r.caixa.saldoGlobal).aSer(1000);
      esperar(r.historico.estornadas).aSer(1);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });

    teste("lançamento sem conta e sem declaração vira pendência", () => {
      const r = RC.conferir({
        ...base,
        contas: [{ id: "a", name: "Corrente", initial_balance: 0, active: true }],
        transacoes: [
          { id: "t1", type: "saida", amount: 50, date: "2026-08-10", account_id: null, description: "Feira" },
        ],
      });
      const check = r.checagens.find((c) => c.id === "nao_alocado");
      esperar(check.ok).aSerFalso();
      esperar(r.pendencias.some((p) => p.kind === "transacao_sem_conta")).aSerVerdadeiro();
    });

    teste("declarar fora das contas resolve a ambiguidade", () => {
      const r = RC.conferir({
        ...base,
        contas: [{ id: "a", name: "Corrente", initial_balance: 0, active: true }],
        transacoes: [
          { id: "t1", type: "saida", amount: 50, date: "2026-08-10", account_id: null, unallocated: true, description: "Feira" },
        ],
      });
      esperar(r.checagens.find((c) => c.id === "nao_alocado").ok).aSerVerdadeiro();
    });

    teste("meta com cache fora do histórico é acusada", () => {
      const r = RC.conferir({
        ...base,
        metas: [{ id: "g", name: "Reserva", current_amount: 1500 }],
        movimentosMeta: [{ goal_id: "g", kind: "aporte", amount: 1000 }],
      });
      const check = r.checagens.find((c) => c.id === "metas");
      esperar(check.ok).aSerFalso();
      esperar(check.diferenca).aSer(500);
    });

    teste("previsão em aberto com movimentação viva é divergência", () => {
      const r = RC.conferir({
        ...base,
        transacoes: [{ id: "t1", type: "saida", amount: 100, date: "2026-08-10", unallocated: true, category: "Casa" }],
        ocorrencias: [
          { id: "o1", status: "pendente", type: "saida", planned_amount: 100,
            transaction_id: "t1", description: "Aluguel", cycle: "2026-08", category: "Casa" },
        ],
      });
      esperar(r.checagens.find((c) => c.id === "compromissos").ok).aSerFalso();
      esperar(r.pendencias.some((p) => p.kind === "previsao_com_movimento")).aSerVerdadeiro();
    });

    teste("totais por categoria reproduzem o total de saídas", () => {
      const r = RC.conferir({
        ...base,
        transacoes: [
          { id: "t1", type: "saida", amount: 100, date: "2026-08-10", category: "Casa", unallocated: true },
          { id: "t2", type: "saida", amount: 60, date: "2026-08-11", category: "Lazer", unallocated: true },
          { id: "t3", type: "entrada", amount: 500, date: "2026-08-05", unallocated: true },
        ],
      });
      const check = r.checagens.find((c) => c.id === "categorias");
      esperar(check.ok).aSerVerdadeiro();
      esperar(check.encontrado).aSer(160);
    });

    // Arquivar uma conta some com ela da visão consolidada, mas o dinheiro que
    // passou por ali continua no saldo global. Sem o terceiro balde, isso
    // viraria um alarme falso permanente.
    teste("conta arquivada com movimentação não quebra a identidade", () => {
      const r = RC.conferir({
        ...base,
        contas: [
          { id: "a", name: "Corrente", initial_balance: 1000, active: true },
          { id: "b", name: "Antiga", initial_balance: 0, active: false },
        ],
        transacoes: [
          { id: "t1", type: "saida", amount: 200, date: "2026-08-10", account_id: "a", category: "Casa" },
          { id: "t2", type: "saida", amount: 100, date: "2026-08-11", account_id: "b", category: "Casa" },
        ],
      });
      esperar(r.caixa.saldoGlobal).aSer(700);
      esperar(r.caixa.somaContas).aSer(800);
      esperar(r.caixa.somaArquivadas).aSer(-100);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });

    teste("transferência para conta arquivada não vira divergência", () => {
      const r = RC.conferir({
        ...base,
        contas: [
          { id: "a", name: "Corrente", initial_balance: 1000, active: true },
          { id: "b", name: "Antiga", initial_balance: 0, active: false },
        ],
        transferencias: [{ id: "tr1", from_account_id: "a", to_account_id: "b", amount: 300, date: "2026-08-12" }],
      });
      esperar(r.caixa.somaContas).aSer(700);
      esperar(r.caixa.somaArquivadas).aSer(300);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });

    teste("lançamentos idênticos no mesmo dia viram pendência de duplicata", () => {
      const linha = (id) => ({ id, type: "saida", amount: 40, date: "2026-08-10",
                               description: "Café", unallocated: true, category: "Alimentação" });
      const r = RC.conferir({ ...base, transacoes: [linha("t1"), linha("t2")] });

      esperar(r.duplicatas.grupos).aSer(1);
      esperar(r.duplicatas.lancamentos).aSer(2);
      esperar(r.pendencias.some((p) => p.kind === "possivel_duplicata")).aSerVerdadeiro();
      // Duplicata é decisão do usuário, não erro contábil: o caixa continua fechando.
      esperar(r.contabilOk).aSerVerdadeiro();
    });

    teste("confirmações de ciclos diferentes não viram duplicata falsa", () => {
      const r = RC.conferir({
        ...base,
        transacoes: [
          { id: "t1", type: "saida", amount: 1200, date: "2026-08-06", description: "Aluguel",
            source_occurrence_id: "o1", unallocated: true, category: "Moradia" },
          { id: "t2", type: "saida", amount: 1200, date: "2026-08-06", description: "Aluguel",
            source_occurrence_id: "o2", unallocated: true, category: "Moradia" },
        ],
      });
      esperar(r.duplicatas.grupos).aSer(0);
    });

    teste("estado limpo passa em todas as checagens", () => {
      const r = RC.conferir(base);
      esperar(r.ok).aSerVerdadeiro();
      esperar(r.falhas).aTerTamanho(0);
    });
  });

  descrever("Recorrências e parcelas (6.2)", () => {
    const O = window.FinckOcorrencias;
    const P = window.FinckPlano;

    const regra = (dia) => ({
      id: "r1", description: "Assinatura", type: "saida", amount: 50,
      day_of_month: dia, active: true, category: "Lazer", account_id: "a1",
    });

    teste("dia 31 encaixa no último dia de fevereiro comum (28)", () => {
      const [oc] = O.gerar([regra(31)], { ciclos: ["2027-02"] });
      esperar(oc.due_date).aSer("2027-02-28");
    });

    teste("dia 31 encaixa no último dia de fevereiro bissexto (29)", () => {
      const [oc] = O.gerar([regra(31)], { ciclos: ["2028-02"] });
      esperar(oc.due_date).aSer("2028-02-29");
    });

    teste("dia 31 encaixa em mês de 30 dias", () => {
      const [oc] = O.gerar([regra(31)], { ciclos: ["2026-09"] });
      esperar(oc.due_date).aSer("2026-09-30");
    });

    teste("dia 31 se mantém em mês de 31 dias", () => {
      const [oc] = O.gerar([regra(31)], { ciclos: ["2026-08"] });
      esperar(oc.due_date).aSer("2026-08-31");
    });

    teste("gerar duas vezes o mesmo ciclo produz a mesma linha", () => {
      const a = O.gerar([regra(10)], { ciclos: ["2026-08"] });
      const b = O.gerar([regra(10)], { ciclos: ["2026-08"] });
      esperar(JSON.stringify(a)).aSer(JSON.stringify(b));
    });

    teste("ocorrência congela conta e categoria da regra", () => {
      const [oc] = O.gerar([regra(10)], { ciclos: ["2026-08"] });
      esperar(oc.account_id).aSer("a1");
      esperar(oc.category).aSer("Lazer");
    });

    teste("mudar a conta no ciclo não reescreve a regra", () => {
      const [oc] = O.gerar([regra(10)], { ciclos: ["2026-08"] });
      const mov = O.movimentacaoDe({ ...oc, id: "o1" }, 50, "a2");
      esperar(mov.account_id).aSer("a2");
      esperar(oc.account_id).aSer("a1");
    });

    teste("confirmar sem conta marca a movimentação como não alocada", () => {
      const [oc] = O.gerar([regra(10)], { ciclos: ["2026-08"] });
      const mov = O.movimentacaoDe({ ...oc, id: "o1" }, 50, null, { unallocated: true });
      esperar(mov.account_id).aSer(null);
      esperar(mov.unallocated).aSerVerdadeiro();
    });

    teste("movimentação estornada não é varrida como órfã", () => {
      const ocorrencias = [{ id: "o1", status: "pendente", transaction_id: null }];
      const transacoes = [
        { id: "t1", source_occurrence_id: "o1", reversed_at: "2026-08-12T10:00:00Z" },
      ];
      const r = O.orfas(ocorrencias, transacoes);
      esperar(r.excluir).aTerTamanho(0);
    });

    teste("ocorrência apontando para lançamento estornado volta a ficar aberta", () => {
      const ocorrencias = [{ id: "o1", status: "confirmado", transaction_id: "t1" }];
      const transacoes = [
        { id: "t1", source_occurrence_id: "o1", reversed_at: "2026-08-12T10:00:00Z" },
      ];
      const r = O.orfas(ocorrencias, transacoes);
      esperar(r.desvincular).aTerTamanho(1);
      esperar(r.desvincular[0]).aSer("o1");
    });

    teste("mudar a categoria da regra não reescreve o ciclo já gerado", () => {
      const [oc] = O.gerar([regra(10)], { ciclos: ["2026-08"] });
      esperar(oc.category).aSer("Lazer");

      // A regra muda depois que o ciclo já foi congelado.
      const nova = { ...regra(10), category: "Assinaturas" };
      const [proximo] = O.gerar([nova], { ciclos: ["2026-09"] });

      esperar(oc.category).aSer("Lazer");
      esperar(proximo.category).aSer("Assinaturas");
    });

    teste("a transação confirmada herda a categoria da ocorrência, não da regra", () => {
      const [oc] = O.gerar([regra(10)], { ciclos: ["2026-08"] });
      const mov = O.movimentacaoDe({ ...oc, id: "o1" }, 50, "a1");
      esperar(mov.category).aSer("Lazer");
    });

    teste("entrada não recebe categoria nem no ciclo nem na transação", () => {
      const entrada = { ...regra(5), type: "entrada", description: "Salário" };
      const [oc] = O.gerar([entrada], { ciclos: ["2026-08"] });
      esperar(oc.category).aSer(null);
      esperar(O.movimentacaoDe({ ...oc, id: "o1" }, 3000, "a1").category).aSer(null);
    });

    teste("cronograma soma só as parcelas em aberto", () => {
      const compra = {
        id: "c1", description: "Notebook", total_amount: 3000,
        installments_count: 3, first_due_date: "2026-08-10", paid_count: 0,
      };
      const pagas = [{ purchase_id: "c1", installment_no: 1, status: "paga", transaction_id: "t1" }];
      esperar(P.saldoDevedor(compra, pagas)).aSer(2000);
    });

    // Parcela lançada à mão: o usuário registra a saída direto, sem passar pelo
    // fluxo de pagamento. A parcela continua aberta — e é isso que o
    // reconciliador precisa apontar, em vez de fingir que foi quitada.
    teste("parcela lançada manualmente não quita a parcela sozinha", () => {
      const compra = {
        id: "c1", description: "Notebook", total_amount: 3000,
        installments_count: 3, first_due_date: "2026-08-10", paid_count: 0, active: true,
      };
      // Saída lançada à mão, com a mesma cara da parcela, mas sem vínculo.
      const manual = [{
        id: "t-manual", type: "saida", description: "Notebook (1/3)",
        amount: 1000, date: "2026-08-10", category: "Eletrônicos", unallocated: true,
      }];

      esperar(P.saldoDevedor(compra, [])).aSer(3000);

      const r = window.FinckReconciliador.conferir({
        perfil: { id: "u", initial_balance: 0 },
        contas: [], transacoes: manual, transferencias: [], ajustes: [],
        metas: [], movimentosMeta: [], parcelamentos: [compra], pagamentos: [],
        ocorrencias: [], hoje: "2026-08-16",
      });

      // O dinheiro saiu do caixa e o compromisso continua de pé: o produto
      // mostra os dois, em vez de esconder um deles.
      esperar(r.caixa.saldoGlobal).aSer(-1000);
      esperar(r.compromissos.parcelas).aSer(3000);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });

    teste("parcela lançada à mão e depois quitada não conta duas vezes", () => {
      const compra = {
        id: "c1", description: "Notebook", total_amount: 3000,
        installments_count: 3, first_due_date: "2026-08-10", paid_count: 0, active: true,
      };
      const manual = { id: "t-manual", type: "saida", description: "Notebook (1/3)",
                       amount: 1000, date: "2026-08-10", unallocated: true, category: "Eletrônicos" };
      const pelaParcela = { id: "t-parcela", type: "saida", description: "Notebook (1/3)",
                            amount: 1000, date: "2026-08-10", unallocated: true,
                            category: "Eletrônicos", source: "parcela" };

      const r = window.FinckReconciliador.conferir({
        perfil: { id: "u", initial_balance: 0 },
        contas: [], transacoes: [manual, pelaParcela], transferencias: [], ajustes: [],
        metas: [], movimentosMeta: [], parcelamentos: [compra],
        pagamentos: [{ id: "p1", purchase_id: "c1", installment_no: 1, status: "paga",
                       transaction_id: "t-parcela", amount: 1000 }],
        ocorrencias: [], hoje: "2026-08-16",
      });

      // O mesmo gasto aparece duas vezes: o reconciliador acusa em vez de somar calado.
      esperar(r.duplicatas.grupos).aSer(1);
      esperar(r.pendencias.some((p) => p.kind === "possivel_duplicata")).aSerVerdadeiro();
    });

    teste("parcela estornada volta a contar como compromisso", () => {
      const compra = {
        id: "c1", description: "Notebook", total_amount: 3000,
        installments_count: 3, first_due_date: "2026-08-10", paid_count: 1,
      };
      // O registro explícito vence o contador agregado: a parcela reaberta
      // volta para o saldo devedor mesmo com paid_count antigo.
      const pagos = [{ purchase_id: "c1", installment_no: 1, status: "aberta", transaction_id: null }];
      esperar(P.saldoDevedor(compra, pagos)).aSer(3000);
    });
  });

  descrever("Concorrência e falha (6.3)", () => {
    const S = window.FinckStore;
    const F = window.FinckFinance;

    const comSessaoLimpa = async (fn) => {
      const antes = {};
      Object.entries(S.KEYS).forEach(([, v]) => { antes[v] = localStorage.getItem(v); });
      Object.values(S.KEYS).forEach((v) => localStorage.removeItem(v));
      await S.entrarDemo();
      try { await fn(); } finally {
        Object.values(S.KEYS).forEach((v) => localStorage.removeItem(v));
        Object.entries(antes).forEach(([k, v]) => { if (v !== null) localStorage.setItem(k, v); });
      }
    };

    teste("dois cliques rápidos no mesmo aporte geram um lançamento só", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", { name: "Reserva", target_amount: 6000, current_amount: 0 });
        const chave = "clique-duplo";

        // Sequencial, como o navegador entrega dois cliques no mesmo botão.
        await F.aportarMeta(meta.id, 500, "Aporte", { chave });
        await F.aportarMeta(meta.id, 500, "Aporte", { chave });

        esperar(await S.listar("transactions")).aTerTamanho(1);
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(500);
      });
    });

    teste("retry depois de timeout devolve o resultado da primeira chamada", async () => {
      await comSessaoLimpa(async () => {
        let execucoes = 0;
        const primeiro = await S.operacao("k1", async () => { execucoes++; return { id: "abc" }; });
        const segundo = await S.operacao("k1", async () => { execucoes++; return { id: "xyz" }; });

        esperar(execucoes).aSer(1);
        esperar(segundo.id).aSer(primeiro.id);
      });
    });

    teste("operação sem chave nunca é deduplicada", async () => {
      await comSessaoLimpa(async () => {
        let execucoes = 0;
        await S.operacao(null, async () => { execucoes++; });
        await S.operacao(null, async () => { execucoes++; });
        esperar(execucoes).aSer(2);
      });
    });

    teste("falha ao gravar o movimento não deixa a saída no caixa", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", { name: "Reserva", target_amount: 6000, current_amount: 0 });

        const original = S.inserir;
        S.inserir = async (tabela, registro) => {
          if (tabela === "goal_movements") throw new Error("queda de rede simulada");
          return original(tabela, registro);
        };

        try {
          await esperar(() => F.aportarMeta(meta.id, 500, "Aporte")).aFalharCom("queda de rede simulada");
        } finally { S.inserir = original; }

        // Compensação: a operação não completou, então nada dela sobrou.
        esperar(await S.listar("transactions")).aTerTamanho(0);
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(0);
      });
    });

    // Duas abas compartilham o localStorage; a chave de operação é o que impede
    // a segunda de lançar de novo o que a primeira já lançou.
    teste("duas abas confirmando ao mesmo tempo geram um lançamento só", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", { name: "Reserva", target_amount: 6000, current_amount: 0 });
        const chave = "duas-abas";

        // Disparadas em paralelo, como duas abas realmente fariam.
        await Promise.all([
          F.aportarMeta(meta.id, 400, "Aporte", { chave }),
          F.aportarMeta(meta.id, 400, "Aporte", { chave }),
        ]).catch(() => {});

        const vivas = F.vigentes(await S.listar("transactions"));
        esperar(vivas.length <= 1).aSerVerdadeiro();
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(400);
      });
    });

    teste("refresh no meio da confirmação não duplica ao recarregar", async () => {
      await comSessaoLimpa(async () => {
        const rec = await S.inserir("recurring_transactions", {
          description: "Aluguel", type: "saida", amount: 1200,
          day_of_month: 6, active: true, category: "Moradia",
        });
        const [linha] = window.FinckOcorrencias.gerar([rec], { ciclos: ["2026-08"] });
        const oc = await S.inserir("recurring_occurrences", linha);

        await window.FinckRevisao.confirmar(oc, 1200, { unallocated: true });

        // O "refresh": a página recarrega e roda a sincronização de novo.
        await window.FinckRevisao.sincronizar([rec]);
        await window.FinckRevisao.sincronizar([rec]);

        esperar(F.vigentes(await S.listar("transactions"))).aTerTamanho(1);
        const depois = await S.obter("recurring_occurrences", oc.id);
        esperar(depois.status).aSer("confirmado");
      });
    });

    teste("resposta lenta do banco não vira lançamento duplicado", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", { name: "Reserva", target_amount: 6000, current_amount: 0 });

        const original = S.inserir;
        S.inserir = async (tabela, registro) => {
          if (tabela === "transactions") await new Promise((r) => setTimeout(r, 60));
          return original(tabela, registro);
        };

        try {
          await F.aportarMeta(meta.id, 300, "Aporte", { chave: "lento" });
          await F.aportarMeta(meta.id, 300, "Aporte", { chave: "lento" });
        } finally { S.inserir = original; }

        esperar(F.vigentes(await S.listar("transactions"))).aTerTamanho(1);
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(300);
      });
    });

    // Erro de RLS chega ao cliente como falha na gravação. O resultado esperado
    // não é sucesso: é um único estado válido, sem meio-lançamento no caixa.
    teste("erro de permissão não deixa meio-lançamento no caixa", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", { name: "Reserva", target_amount: 6000, current_amount: 0 });

        const original = S.inserir;
        S.inserir = async (tabela, registro) => {
          if (tabela === "goal_movements") {
            throw new Error('new row violates row-level security policy for table "goal_movements"');
          }
          return original(tabela, registro);
        };

        try {
          await esperar(() => F.aportarMeta(meta.id, 500, "Aporte")).aFalharCom("row-level security");
        } finally { S.inserir = original; }

        esperar(await S.listar("transactions")).aTerTamanho(0);
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(0);
      });
    });

    teste("erro de confirmação deixa rastro técnico com contexto", async () => {
      await comSessaoLimpa(async () => {
        await S.registrarEvento({
          scope: "confirmacao",
          message: "timeout simulado",
          context: { ocorrencia: "o1", ciclo: "2026-08" },
        });

        const eventos = await S.listarEventos({ limite: 5 });
        esperar(eventos.length >= 1).aSerVerdadeiro();
        esperar(eventos[0].scope).aSer("confirmacao");
        esperar(eventos[0].context.ciclo).aSer("2026-08");
      });
    });

    teste("registrar evento nunca derruba a operação observada", async () => {
      await comSessaoLimpa(async () => {
        const evento = await S.registrarEvento({ scope: "teste", message: null, context: undefined });
        esperar(typeof evento.created_at).aSer("string");
      });
    });
  });

  descrever("Importação hostil (6.4)", () => {
    const S = window.FinckStore;

    teste("movimento de meta apontando para meta ausente é descartado", () => {
      const r = S.validarImportacao({
        goals: [],
        goal_movements: [{ id: "m1", goal_id: "inexistente", kind: "aporte", amount: 100, date: "2026-08-10" }],
      });
      esperar(r.linhas.goal_movements).aTerTamanho(0);
      esperar(r.avisos.some((a) => a.includes("goal_id"))).aSerVerdadeiro();
    });

    teste("movimento de meta com valor zerado é descartado", () => {
      const r = S.validarImportacao({
        goals: [{ id: "g1", name: "Reserva", target_amount: 1000 }],
        goal_movements: [{ id: "m1", goal_id: "g1", kind: "aporte", amount: 0, date: "2026-08-10" }],
      });
      esperar(r.linhas.goal_movements).aTerTamanho(0);
    });

    teste("aporte com sinal invertido é recusado", () => {
      const r = S.validarImportacao({
        goals: [{ id: "g1", name: "Reserva", target_amount: 1000 }],
        goal_movements: [{ id: "m1", goal_id: "g1", kind: "aporte", amount: -100, date: "2026-08-10" }],
      });
      esperar(r.linhas.goal_movements).aTerTamanho(0);
    });

    teste("retirada com sinal positivo é recusada", () => {
      const r = S.validarImportacao({
        goals: [{ id: "g1", name: "Reserva", target_amount: 1000 }],
        goal_movements: [{ id: "m1", goal_id: "g1", kind: "retirada", amount: 100, date: "2026-08-10" }],
      });
      esperar(r.linhas.goal_movements).aTerTamanho(0);
    });

    teste("movimento de meta válido passa e mantém o vínculo", () => {
      const r = S.validarImportacao({
        goals: [{ id: "g1", name: "Reserva", target_amount: 1000 }],
        goal_movements: [{ id: "m1", goal_id: "g1", kind: "aporte", amount: 100, date: "2026-08-10" }],
      });
      esperar(r.linhas.goal_movements).aTerTamanho(1);
    });

    teste("parcela com estado desconhecido é descartada", () => {
      const r = S.validarImportacao({
        installment_purchases: [{ id: "c1", total_amount: 300, installments_count: 3, first_due_date: "2026-08-10" }],
        installment_payments: [{ id: "p1", purchase_id: "c1", installment_no: 1, amount: 100, status: "sei_la" }],
      });
      esperar(r.linhas.installment_payments).aTerTamanho(0);
    });

    teste("parcela estornada é estado válido", () => {
      const r = S.validarImportacao({
        installment_purchases: [{ id: "c1", total_amount: 300, installments_count: 3, first_due_date: "2026-08-10" }],
        installment_payments: [{ id: "p1", purchase_id: "c1", installment_no: 1, amount: 100, status: "estornada" }],
      });
      esperar(r.linhas.installment_payments).aTerTamanho(1);
    });

    teste("arquivo inválido é recusado antes de gravar qualquer coisa", async () => {
      await esperar(() => S.importarTudo({ lixo: true })).aFalharCom("Arquivo inválido");
    });
  });

  descrever("Semáforo por prioridade (4.2)", () => {
    const R = window.FinckReality;
    const perfil = { income_monthly: 3500, work_days_month: 22, work_hours_day: 8 };

    teste("déficit de fixos vem antes de qualquer percentual", () => {
      const r = R.calcular(10, perfil, { saldo: 50000, despesasFixas: 4000 });
      esperar(r.semaforo.motivo).aSer("deficit_fixos");
      esperar(r.semaforo.nivel).aSer("alerta");
    });

    teste("déficit aparece com sinal, não zerado", () => {
      const r = R.calcular(10, perfil, { despesasFixas: 4000 });
      esperar(r.sobra_apos_fixos).aSer(-500);
      esperar(r.deficit_fixos).aSer(500);
      esperar(r.renda_livre).aSer(0);
    });

    teste("saldo negativo vem antes do comprometimento da renda livre", () => {
      const r = R.calcular(50, perfil, { saldo: 10 });
      esperar(r.semaforo.motivo).aSer("sem_caixa");
    });

    teste("compra que cabe no caixa mas não no projetado é sinalizada", () => {
      const r = R.calcular(200, perfil, { saldo: 1000, compromissosAbertos: 900 });
      esperar(r.semaforo.motivo).aSer("sem_projetado");
      esperar(r.semaforo.titulo).aConter("déficit projetado");
      esperar(r.disponivel_projetado).aSer(100);
    });

    teste("comprometimento da renda livre vem antes do percentual da renda", () => {
      // 500 é 14% da renda, mas 71% da sobra depois dos fixos.
      const r = R.calcular(500, perfil, { saldo: 50000, despesasFixas: 2800 });
      esperar(r.semaforo.motivo).aSer("renda_livre");
      esperar(r.semaforo.nivel).aSer("alerta");
    });

    teste("percentual alto da renda ainda é alerta", () => {
      const r = R.calcular(1500, perfil, { saldo: 50000 });
      esperar(r.semaforo.motivo).aSer("percentual_renda");
      esperar(r.semaforo.nivel).aSer("alerta");
    });

    teste("compra pequena que pesa na meta recebe atenção, não verde", () => {
      const r = R.calcular(200, perfil, {
        saldo: 50000,
        metas: [{ id: "g", name: "Notebook", target_amount: 1000, current_amount: 500 }],
      });
      esperar(r.semaforo.motivo).aSer("impacto_meta");
      esperar(r.semaforo.nivel).aSer("atencao");
    });

    teste("compra leve sem impacto nenhum fica verde", () => {
      const r = R.calcular(100, perfil, { saldo: 50000 });
      esperar(r.semaforo.motivo).aSer("folga");
      esperar(r.semaforo.nivel).aSer("verde");
    });

    teste("cada indicador do glossário tem definição e referência", () => {
      Object.entries(R.GLOSSARIO).forEach(([chave, g]) => {
        if (!g.rotulo || !g.definicao || !g.referencia) {
          throw new Error(`indicador "${chave}" está sem rótulo, definição ou referência`);
        }
      });
      esperar(Object.keys(R.GLOSSARIO).length >= 8).aSerVerdadeiro();
    });

    teste("saldo, sobra e disponível têm nomes diferentes", () => {
      const nomes = Object.values(R.GLOSSARIO).map((g) => g.rotulo);
      esperar(new Set(nomes).size).aSer(nomes.length);
    });
  });

  async function rodar(aoAtualizar) {
    const resultado = { total: 0, passou: 0, falhou: 0, suites: [] };

    for (const suite of suites) {
      const r = { nome: suite.nome, casos: [] };
      for (const caso of suite.casos) {
        resultado.total++;
        try {
          await caso.fn();
          r.casos.push({ nome: caso.nome, ok: true });
          resultado.passou++;
        } catch (e) {
          r.casos.push({ nome: caso.nome, ok: false, erro: e.message });
          resultado.falhou++;
        }
        if (aoAtualizar) aoAtualizar(resultado);
      }
      resultado.suites.push(r);
    }
    return resultado;
  }

  return { rodar, suites };
})();
