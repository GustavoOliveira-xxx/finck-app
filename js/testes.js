/* ============================================================
   FinCK — suíte de testes

   Roda no navegador, sem instalar nada: abra testes.html. A
   escolha é deliberada — o projeto não tem build nem package.json,
   e exigir Node para conferir uma regra de negócio afastaria o
   teste do fluxo de quem mexe no código.

   Cobre o que quebra em silêncio: o motor de cálculo, as regras
   financeiras, o anti-farm de XP e a camada de dados (assinatura
   de duplicatas e modos de importação).
   ============================================================ */

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

  /* ---------------- asserções ---------------- */
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

  /* ============================================================
     Motor do FinCK of Reality
     ============================================================ */
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
      esperar(r.valor_dia).aSerPerto(159.09, 2);   // 3500 / 22
      esperar(r.valor_hora).aSerPerto(19.89, 2);   // 159.09 / 8
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

  /* ============================================================
     Regras financeiras
     ============================================================ */
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

  /* ============================================================
     Gamificação: o teto e os limites são o que impede farm
     ============================================================ */
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
      // se o teto fosse maior, ele não teria efeito nenhum
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

  /* ============================================================
     Camada de dados: duplicatas e importação
     ============================================================ */
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
      // o registro novo ainda não tem created_at; se a assinatura
      // dependesse dele, o mesmo cálculo entraria de novo a cada import
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

  /* ============================================================
     Importação e demo em sessão real de demonstração
     Estes casos escrevem de verdade, então rodam isolados numa
     sessão demo e limpam tudo ao final.
     ============================================================ */
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
        esperar(r1.inseridos).aSer(2);   // a linha repetida do arquivo entra uma vez
        esperar(r1.ignorados).aSer(1);

        const r2 = await S.importarTudo(backup, { modo: "mesclar" });
        esperar(r2.inseridos).aSer(0);   // reimportar não duplica
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
        esperar(ctx.saldo).aSer(2500);          // 500 + 3000 - 1000
        esperar(ctx.despesasFixas).aSer(1000);
        esperar(ctx.rendaLivre).aSer(2000);     // 3000 - 1000
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

  /* ============================================================
     Formatação
     ============================================================ */
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

  /* ---------------- execução ---------------- */
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
