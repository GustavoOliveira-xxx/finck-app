window.FinckTestes = (() => {
  const suites = [];
  let suiteAtual = null;
  const descrever = (nome, fn) => {
    suiteAtual = {
      nome: nome,
      casos: []
    };
    suites.push(suiteAtual);
    fn();
    suiteAtual = null;
  };
  const teste = (nome, fn) => {
    if (!suiteAtual) {
      throw new Error("teste() fora de descrever()");
    }
    suiteAtual.casos.push({
      nome: nome,
      fn: fn
    });
  };
  class FalhaDeTeste extends Error {}
  const falhar = msg => {
    throw new FalhaDeTeste(msg);
  };
  const esperar = valor => ({
    aSer(esperado) {
      if (!Object.is(valor, esperado)) {
        falhar(`esperava ${JSON.stringify(esperado)}, veio ${JSON.stringify(valor)}`);
      }
    },
    aSerPerto(esperado, casas = 2) {
      const tol = Math.pow(10, -casas) / 2;
      if (Math.abs(valor - esperado) > tol) {
        falhar(`esperava ~${esperado} (±${tol}), veio ${valor}`);
      }
    },
    aSerVerdadeiro() {
      if (!valor) {
        falhar(`esperava verdadeiro, veio ${JSON.stringify(valor)}`);
      }
    },
    aSerFalso() {
      if (valor) {
        falhar(`esperava falso, veio ${JSON.stringify(valor)}`);
      }
    },
    aTerTamanho(n) {
      const t = valor?.length;
      if (t !== n) {
        falhar(`esperava tamanho ${n}, veio ${t}`);
      }
    },
    aConter(trecho) {
      if (!String(valor).includes(trecho)) {
        falhar(`esperava conter "${trecho}", veio "${valor}"`);
      }
    },
    async aFalharCom(trecho) {
      try {
        await valor();
      } catch (e) {
        if (e instanceof FalhaDeTeste) {
          throw e;
        }
        if (trecho && !String(e.message).includes(trecho)) {
          falhar(`erro deveria conter "${trecho}", veio "${e.message}"`);
        }
        return;
      }
      falhar("esperava que lançasse erro, mas não lançou");
    }
  });
  descrever("Motor de cálculo (FinckReality)", () => {
    const perfilBase = {
      income_monthly: 3500,
      work_days_month: 22,
      work_hours_day: 8
    };
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
      const r = window.FinckReality.calcular(800, {
        income_monthly: 0
      });
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
      const r = window.FinckReality.calcular(200, perfilBase, {
        saldo: 1e4
      });
      esperar(r.semaforo.nivel).aSer("verde");
    });
    teste("semáforo atenção entre 10% e 30% da renda", () => {
      const r = window.FinckReality.calcular(800, perfilBase, {
        saldo: 1e4
      });
      esperar(r.semaforo.nivel).aSer("atencao");
    });
    teste("semáforo alerta acima de 30% da renda", () => {
      const r = window.FinckReality.calcular(1500, perfilBase, {
        saldo: 1e4
      });
      esperar(r.semaforo.nivel).aSer("alerta");
    });
    teste("saldo insuficiente é alerta mesmo com preço baixo", () => {
      const r = window.FinckReality.calcular(50, perfilBase, {
        saldo: 10
      });
      esperar(r.semaforo.nivel).aSer("alerta");
      esperar(r.compromete_saldo).aSerVerdadeiro();
    });
    teste("renda livre desconta as despesas fixas", () => {
      const r = window.FinckReality.calcular(100, perfilBase, {
        saldo: 5e3,
        despesasFixas: 1500
      });
      esperar(r.renda_livre).aSer(2e3);
      esperar(r.percentual_renda_livre).aSerPerto(5, 2);
    });
    teste("renda livre nunca fica negativa", () => {
      const r = window.FinckReality.calcular(100, perfilBase, {
        despesasFixas: 99999
      });
      esperar(r.renda_livre).aSer(0);
    });
    teste("impacto nas metas mede a fatia e o atraso", () => {
      const r = window.FinckReality.calcular(800, perfilBase, {
        saldo: 5e3,
        metas: [ {
          id: 1,
          name: "Notebook",
          target_amount: 3200,
          current_amount: 400
        } ]
      });
      const m = r.impacto_metas[0];
      esperar(m.falta).aSer(2800);
      esperar(m.percentual_da_meta).aSerPerto(25, 2);
      esperar(m.dias_trabalho_extra).aSerPerto(5.03, 2);
      esperar(m.cobre_a_meta).aSerFalso();
    });
    teste("compra maior que o restante da meta cobre a meta", () => {
      const r = window.FinckReality.calcular(3e3, perfilBase, {
        metas: [ {
          id: 1,
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 5e3
        } ]
      });
      esperar(r.impacto_metas[0].cobre_a_meta).aSerVerdadeiro();
    });
    teste("registro guarda o retrato da realidade na data", () => {
      const resultado = window.FinckReality.calcular(800, perfilBase, {
        saldo: 2e3
      });
      const reg = window.FinckReality.paraRegistro({
        item_name: "Fone",
        price: 800,
        category: "Eletrônicos",
        resultado: resultado,
        perfil: perfilBase,
        decision: "adiar"
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
      esperar(F.soma([ {
        amount: 10
      }, {
        amount: "5"
      }, {}, {
        amount: null
      } ])).aSer(15);
    });
    teste("classificação de entrada e saída", () => {
      esperar(F.ehEntrada({
        type: "entrada"
      })).aSerVerdadeiro();
      esperar(F.ehSaida({
        type: "saida"
      })).aSerVerdadeiro();
      esperar(F.ehEntrada({
        type: "saida"
      })).aSerFalso();
    });
    teste("doMes compara ano e mês da data", () => {
      esperar(F.doMes({
        date: "2026-08-15"
      }, "2026-08")).aSerVerdadeiro();
      esperar(F.doMes({
        date: "2026-07-31"
      }, "2026-08")).aSerFalso();
    });
    teste("porCategoria agrupa somente as saídas", () => {
      const linhas = F.porCategoria([ {
        type: "saida",
        amount: 100,
        category: "Moradia"
      }, {
        type: "saida",
        amount: 50,
        category: "Moradia"
      }, {
        type: "saida",
        amount: 30,
        category: "Lazer"
      }, {
        type: "entrada",
        amount: 900,
        category: "Salário"
      } ]);
      const moradia = linhas.find(l => l.categoria === "Moradia");
      esperar(moradia.valor).aSer(150);
      esperar(linhas.some(l => l.categoria === "Salário")).aSerFalso();
    });
    teste("porCategoria ordena da maior saída para a menor", () => {
      const linhas = F.porCategoria([ {
        type: "saida",
        amount: 30,
        category: "Lazer"
      }, {
        type: "saida",
        amount: 300,
        category: "Moradia"
      }, {
        type: "saida",
        amount: 80,
        category: "Transporte"
      } ]);
      esperar(linhas[0].categoria).aSer("Moradia");
      esperar(linhas[linhas.length - 1].categoria).aSer("Lazer");
    });
    teste("saída sem categoria cai em Outros", () => {
      const linhas = F.porCategoria([ {
        type: "saida",
        amount: 10
      } ]);
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
      for (let xp = 0; xp <= 2e4; xp += 250) {
        const atual = G.nivelDe(xp).level;
        esperar(atual >= anterior).aSerVerdadeiro();
        anterior = atual;
      }
    });
    teste("toda ação premiada tem limite diário definido", () => {
      Object.entries(cfg.XP.ACOES).forEach(([tipo, r]) => {
        if (!(r.limiteDia >= 1)) {
          falhar(`ação "${tipo}" sem limiteDia`);
        }
        if (!(r.xp >= 0)) {
          falhar(`ação "${tipo}" com xp inválido`);
        }
      });
    });
    teste("teto diário é menor que a soma de todas as ações no limite", () => {
      const somaMaxima = Object.values(cfg.XP.ACOES).reduce((s, r) => s + r.xp * r.limiteDia, 0);
      esperar(cfg.XP.TETO_DIARIO < somaMaxima).aSerVerdadeiro();
    });
    teste("intervalo mínimo entre ganhos está configurado", () => {
      esperar(cfg.XP.INTERVALO_MIN_MS > 0).aSerVerdadeiro();
    });
    teste("conquistas em lote ignoram só o intervalo, não a chave nem o teto", () => {
      const estado = {
        ledger: {
          dia: window.FinckUtils.hojeISO(),
          total: 50,
          acoes: {
            conquista: 1
          },
          ultimo: Date.now(),
          chaves: [ "conquista:ja-foi" ]
        }
      };
      esperar(G.podePremiar(estado, "conquista", "nova").ok).aSerFalso();
      esperar(G.podePremiar(estado, "conquista", "nova", {
        ignorarIntervalo: true
      }).ok).aSerVerdadeiro();
      esperar(G.podePremiar(estado, "conquista", "ja-foi", {
        ignorarIntervalo: true
      }).ok).aSerFalso();
    });
    teste("cálculo abaixo do valor mínimo não paga XP", () => {
      esperar(cfg.XP.VALOR_MINIMO_CALCULO > 0).aSerVerdadeiro();
    });
  });
  descrever("Camada de dados (FinckStore)", () => {
    const S = window.FinckStore;
    teste("assinatura ignora id e created_at", () => {
      const a = S.assinar("transactions", {
        id: "1",
        created_at: "2026-01-01",
        type: "saida",
        description: "Mercado",
        amount: 100,
        date: "2026-08-08"
      });
      const b = S.assinar("transactions", {
        id: "2",
        created_at: "2026-05-05",
        type: "saida",
        description: "Mercado",
        amount: 100,
        date: "2026-08-08"
      });
      esperar(a).aSer(b);
    });
    teste("assinatura separa lançamentos de valores diferentes", () => {
      const a = S.assinar("transactions", {
        type: "saida",
        description: "X",
        amount: 100,
        date: "2026-08-08"
      });
      const b = S.assinar("transactions", {
        type: "saida",
        description: "X",
        amount: 101,
        date: "2026-08-08"
      });
      esperar(a === b).aSerFalso();
    });
    teste("assinatura de cálculo usa analyzed_at, não created_at", () => {
      const novo = S.assinar("purchase_analyses", {
        item_name: "Fone",
        price: 800,
        analyzed_at: "2026-08-12T12:00:00.000Z"
      });
      const salvo = S.assinar("purchase_analyses", {
        item_name: "Fone",
        price: 800,
        analyzed_at: "2026-08-12T12:00:00.000Z",
        created_at: "2026-08-12T15:33:10.000Z",
        id: "abc"
      });
      esperar(novo).aSer(salvo);
    });
    teste("arquivo sem dados reconhecíveis é recusado", async () => {
      await esperar(() => S.importarTudo({
        qualquer: "coisa"
      })).aFalharCom("Arquivo inválido");
    });
    teste("arquivo que não é objeto é recusado", async () => {
      await esperar(() => S.importarTudo([ 1, 2, 3 ])).aFalharCom("Arquivo inválido");
      await esperar(() => S.importarTudo(null)).aFalharCom("Arquivo inválido");
    });
    teste("modo de importação desconhecido é recusado", async () => {
      await esperar(() => S.importarTudo({
        transactions: []
      }, {
        modo: "apagar-tudo"
      })).aFalharCom("Modo de importação");
    });
  });
  descrever("Importação e demonstração (integração)", () => {
    const S = window.FinckStore;
    const F = window.FinckFinance;
    const comSessaoLimpa = async fn => {
      const antes = {};
      Object.entries(S.KEYS).forEach(([k, v]) => {
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
          transactions: [ {
            type: "saida",
            description: "Padaria",
            amount: 20,
            date: "2026-08-01"
          }, {
            type: "saida",
            description: "Padaria",
            amount: 20,
            date: "2026-08-01"
          }, {
            type: "entrada",
            description: "Freela",
            amount: 500,
            date: "2026-08-02"
          } ]
        };
        const r1 = await S.importarTudo(backup, {
          modo: "mesclar"
        });
        esperar(r1.inseridos).aSer(2);
        esperar(r1.ignorados).aSer(1);
        const r2 = await S.importarTudo(backup, {
          modo: "mesclar"
        });
        esperar(r2.inseridos).aSer(0);
        esperar((await S.listar("transactions")).length).aSer(2);
      });
    });
    teste("importar substituindo troca os dados atuais", async () => {
      await comSessaoLimpa(async () => {
        await S.inserir("transactions", {
          type: "saida",
          description: "Antiga",
          amount: 9,
          date: "2026-01-01"
        });
        const r = await S.importarTudo({
          transactions: [ {
            type: "entrada",
            description: "Nova",
            amount: 100,
            date: "2026-08-02"
          } ]
        }, {
          modo: "substituir"
        });
        esperar(r.inseridos).aSer(1);
        const linhas = await S.listar("transactions");
        esperar(linhas).aTerTamanho(1);
        esperar(linhas[0].description).aSer("Nova");
      });
    });
    teste("relatório de importação detalha por tabela", async () => {
      await comSessaoLimpa(async () => {
        const r = await S.importarTudo({
          transactions: [ {
            type: "saida",
            description: "A",
            amount: 1,
            date: "2026-08-01"
          } ],
          goals: [ {
            name: "Viagem",
            target_amount: 5e3,
            current_amount: 0
          } ]
        }, {
          modo: "mesclar"
        });
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
        await S.importarTudo(backup, {
          modo: "substituir"
        });
        esperar((await S.listar("transactions")).length).aSer(antes);
      });
    });
    teste("contexto financeiro calcula saldo e renda livre", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({
          income_monthly: 3e3,
          work_days_month: 20,
          work_hours_day: 8,
          initial_balance: 500
        });
        await S.inserir("transactions", {
          type: "entrada",
          description: "Salário",
          amount: 3e3,
          date: "2026-08-05"
        });
        await S.inserir("transactions", {
          type: "saida",
          description: "Aluguel",
          amount: 1e3,
          date: "2026-08-06"
        });
        await S.inserir("recurring_transactions", {
          description: "Aluguel",
          type: "saida",
          amount: 1e3,
          day_of_month: 6,
          active: true
        });
        const ctx = await F.carregarContexto();
        esperar(ctx.saldo).aSer(2500);
        esperar(ctx.despesasFixas).aSer(1e3);
        esperar(ctx.rendaLivre).aSer(2e3);
      });
    });
    teste("recorrente inativo não entra nas despesas fixas", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({
          income_monthly: 3e3
        });
        await S.inserir("recurring_transactions", {
          description: "Cancelado",
          type: "saida",
          amount: 500,
          day_of_month: 3,
          active: false
        });
        const ctx = await F.carregarContexto();
        esperar(ctx.despesasFixas).aSer(0);
      });
    });
  });
  descrever("Planejamento (FinckPlano)", () => {
    const P = window.FinckPlano;
    teste("divisão de parcelas não perde nem cria centavo", () => {
      [ [ 100, 3 ], [ 2400, 12 ], [ 999.99, 7 ], [ .03, 2 ] ].forEach(([total, q]) => {
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
        total_amount: 300,
        installments_count: 3,
        first_due_date: "2026-01-10",
        paid_count: 0
      });
      esperar(c).aTerTamanho(3);
      esperar(c[0].mes).aSer("2026-01");
      esperar(c[1].mes).aSer("2026-02");
      esperar(c[2].mes).aSer("2026-03");
    });
    teste("vencimento no dia 31 recua em mês curto", () => {
      const c = P.cronograma({
        total_amount: 300,
        installments_count: 2,
        first_due_date: "2026-01-31",
        paid_count: 0
      });
      esperar(c[1].vencimento.getMonth()).aSer(1);
      esperar(c[1].vencimento.getDate()).aSer(28);
    });
    teste("saldo devedor ignora as parcelas já pagas", () => {
      const p = {
        total_amount: 1e3,
        installments_count: 10,
        first_due_date: "2026-01-05",
        paid_count: 4
      };
      esperar(P.saldoDevedor(p)).aSerPerto(600, 2);
    });
    teste("parcelamento quitado não deve mais nada", () => {
      const p = {
        total_amount: 500,
        installments_count: 5,
        first_due_date: "2026-01-05",
        paid_count: 5
      };
      esperar(P.saldoDevedor(p)).aSer(0);
    });
    teste("parcelas somam por mês e ignoram inativos", () => {
      const base = new Date(2026, 0, 1);
      const mapa = P.parcelasPorMes([ {
        total_amount: 300,
        installments_count: 3,
        first_due_date: "2026-01-10",
        paid_count: 0,
        active: true
      }, {
        total_amount: 600,
        installments_count: 3,
        first_due_date: "2026-01-20",
        paid_count: 0,
        active: false
      } ], 3, base);
      esperar(mapa["2026-01"]).aSerPerto(100, 2);
      esperar(mapa["2026-02"]).aSerPerto(100, 2);
    });
    teste("orçamento classifica tranquilo, atenção e estourado", () => {
      const tetos = [ {
        id: 1,
        category: "Alimentação",
        limit_amount: 1e3
      }, {
        id: 2,
        category: "Lazer",
        limit_amount: 100
      }, {
        id: 3,
        category: "Transporte",
        limit_amount: 200
      } ];
      const transacoes = [ {
        type: "saida",
        amount: 200,
        category: "Alimentação",
        date: "2026-08-03"
      }, {
        type: "saida",
        amount: 80,
        category: "Lazer",
        date: "2026-08-04"
      }, {
        type: "saida",
        amount: 260,
        category: "Transporte",
        date: "2026-08-05"
      } ];
      const r = P.situacaoOrcamento(tetos, transacoes, "2026-08");
      const porCat = Object.fromEntries(r.map(x => [ x.categoria, x ]));
      esperar(porCat["Alimentação"].situacao).aSer("tranquilo");
      esperar(porCat["Lazer"].situacao).aSer("atencao");
      esperar(porCat["Transporte"].situacao).aSer("estourado");
      esperar(porCat["Transporte"].restante).aSer(-60);
    });
    teste("orçamento ignora gasto de outro mês", () => {
      const r = P.situacaoOrcamento([ {
        id: 1,
        category: "Lazer",
        limit_amount: 100
      } ], [ {
        type: "saida",
        amount: 500,
        category: "Lazer",
        date: "2026-07-15"
      } ], "2026-08");
      esperar(r[0].gasto).aSer(0);
    });
    teste("orçamento ignora entradas", () => {
      const r = P.situacaoOrcamento([ {
        id: 1,
        category: "Salário",
        limit_amount: 100
      } ], [ {
        type: "entrada",
        amount: 5e3,
        category: "Salário",
        date: "2026-08-05"
      } ], "2026-08");
      esperar(r[0].gasto).aSer(0);
    });
    teste("aponta categorias com gasto e sem teto", () => {
      const semTeto = P.categoriasSemTeto([ {
        category: "Lazer"
      } ], [ {
        type: "saida",
        amount: 10,
        category: "Lazer",
        date: "2026-08-01"
      }, {
        type: "saida",
        amount: 10,
        category: "Moradia",
        date: "2026-08-02"
      } ], "2026-08");
      esperar(semTeto).aTerTamanho(1);
      esperar(semTeto[0]).aSer("Moradia");
    });
    teste("calendário posiciona recorrentes e parcelas no dia certo", () => {
      const eventos = P.eventosDoMes({
        recorrentes: [ {
          description: "Salário",
          type: "entrada",
          amount: 3e3,
          day_of_month: 5,
          active: true
        } ],
        parcelamentos: [ {
          description: "TV",
          total_amount: 300,
          installments_count: 3,
          first_due_date: "2026-08-12",
          paid_count: 0,
          active: true
        } ],
        transacoes: [ {
          description: "Mercado",
          type: "saida",
          amount: 120,
          date: "2026-08-20"
        } ]
      }, "2026-08");
      esperar(eventos.get(5)[0].titulo).aSer("Salário");
      esperar(eventos.get(5)[0].sinal).aSer(1);
      esperar(eventos.get(12)[0].tipo).aSer("parcela");
      esperar(eventos.get(20)[0].titulo).aSer("Mercado");
    });
    teste("dia fora do mês é encaixado no último dia", () => {
      const eventos = P.eventosDoMes({
        recorrentes: [ {
          description: "Conta",
          type: "saida",
          amount: 90,
          day_of_month: 31,
          active: true
        } ]
      }, "2026-09");
      esperar(eventos.has(30)).aSerVerdadeiro();
      esperar(eventos.has(31)).aSerFalso();
    });
    teste("projeção acumula o resultado mês a mês", () => {
      const base = new Date(2026, 0, 1);
      const linhas = P.projecaoSaldo({
        saldo: 1e3,
        recorrentes: [ {
          description: "Salário",
          type: "entrada",
          amount: 3e3,
          day_of_month: 5,
          active: true
        }, {
          description: "Aluguel",
          type: "saida",
          amount: 1e3,
          day_of_month: 10,
          active: true
        } ],
        parcelamentos: [],
        meses: 3
      }, base);
      esperar(linhas).aTerTamanho(3);
      esperar(linhas[0].saldoFim).aSer(3e3);
      esperar(linhas[1].saldoFim).aSer(5e3);
      esperar(linhas[2].saldoFim).aSer(7e3);
    });
    teste("projeção soma as parcelas às saídas do mês", () => {
      const base = new Date(2026, 0, 1);
      const linhas = P.projecaoSaldo({
        saldo: 0,
        recorrentes: [ {
          description: "Salário",
          type: "entrada",
          amount: 1e3,
          day_of_month: 1,
          active: true
        } ],
        parcelamentos: [ {
          total_amount: 300,
          installments_count: 3,
          first_due_date: "2026-01-15",
          paid_count: 0,
          active: true
        } ],
        meses: 2
      }, base);
      esperar(linhas[0].parcelas).aSerPerto(100, 2);
      esperar(linhas[0].saldoFim).aSerPerto(900, 2);
    });
    teste("aponta o primeiro mês em que o saldo fura", () => {
      const base = new Date(2026, 0, 1);
      const linhas = P.projecaoSaldo({
        saldo: 500,
        recorrentes: [ {
          description: "Aluguel",
          type: "saida",
          amount: 400,
          day_of_month: 5,
          active: true
        } ],
        parcelamentos: [],
        meses: 4
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
        saldo: 5e3,
        recorrentes: [ {
          description: "Salário",
          type: "entrada",
          amount: 100,
          day_of_month: 1,
          active: true
        } ],
        parcelamentos: [],
        meses: 4
      }, base);
      esperar(P.primeiroMesNegativo(linhas)).aSer(null);
    });
    teste("plano da meta divide o que falta pelos meses restantes", () => {
      const hoje = new Date(2026, 0, 15);
      const plano = P.planoDaMeta({
        target_amount: 6e3,
        current_amount: 1200,
        deadline: "2026-07-01"
      }, 2e3, hoje);
      esperar(plano.meses).aSer(6);
      esperar(plano.porMes).aSerPerto(800, 2);
      esperar(plano.cabe).aSerVerdadeiro();
      esperar(plano.fatiaDaRenda).aSerPerto(40, 1);
    });
    teste("plano marca a meta que não cabe na renda livre", () => {
      const hoje = new Date(2026, 0, 15);
      const plano = P.planoDaMeta({
        target_amount: 12e3,
        current_amount: 0,
        deadline: "2026-03-01"
      }, 1e3, hoje);
      esperar(plano.cabe).aSerFalso();
    });
    teste("meta com prazo vencido é sinalizada", () => {
      const hoje = new Date(2026, 5, 1);
      const plano = P.planoDaMeta({
        target_amount: 1e3,
        current_amount: 0,
        deadline: "2026-01-01"
      }, 5e3, hoje);
      esperar(plano.vencida).aSerVerdadeiro();
    });
    teste("meta já atingida não gera plano", () => {
      esperar(P.planoDaMeta({
        target_amount: 1e3,
        current_amount: 1e3,
        deadline: "2027-01-01"
      }, 500)).aSer(null);
    });
    teste("atraso na meta converte gasto em meses de espera", () => {
      const a = P.atrasoNaMeta({}, 1600, 800);
      esperar(a.mesesExtras).aSerPerto(2, 2);
    });
    teste("atraso não calcula sem aporte definido", () => {
      esperar(P.atrasoNaMeta({}, 1e3, 0)).aSer(null);
    });
  });
  descrever("Contas (FinckContas)", () => {
    const CT = window.FinckContas;
    const conta = (id, saldoInicial, extra = {}) => ({
      id: id,
      name: `Conta ${id}`,
      institution_name: "inter",
      account_type: "corrente",
      initial_balance: saldoInicial,
      active: true,
      ...extra
    });
    teste("saldo inicial aparece sozinho quando não há movimento", () => {
      esperar(CT.saldoDaConta(conta("a", 500), {})).aSer(500);
    });
    teste("entrada aumenta só a conta vinculada", () => {
      const mov = {
        transacoes: [ {
          account_id: "a",
          type: "entrada",
          amount: 200
        } ]
      };
      esperar(CT.saldoDaConta(conta("a", 500), mov)).aSer(700);
      esperar(CT.saldoDaConta(conta("b", 500), mov)).aSer(500);
    });
    teste("saída reduz só a conta vinculada", () => {
      const mov = {
        transacoes: [ {
          account_id: "a",
          type: "saida",
          amount: 150
        } ]
      };
      esperar(CT.saldoDaConta(conta("a", 500), mov)).aSer(350);
      esperar(CT.saldoDaConta(conta("b", 500), mov)).aSer(500);
    });
    teste("lançamento sem conta não entra em conta nenhuma", () => {
      const mov = {
        transacoes: [ {
          account_id: null,
          type: "saida",
          amount: 999
        } ]
      };
      esperar(CT.saldoDaConta(conta("a", 500), mov)).aSer(500);
    });
    teste("transferência reduz a origem e aumenta o destino", () => {
      const mov = {
        transferencias: [ {
          from_account_id: "a",
          to_account_id: "b",
          amount: 200
        } ]
      };
      esperar(CT.saldoDaConta(conta("a", 1e3), mov)).aSer(800);
      esperar(CT.saldoDaConta(conta("b", 500), mov)).aSer(700);
    });
    teste("transferência NÃO altera o patrimônio consolidado", () => {
      const contas = [ conta("a", 1e3), conta("b", 500) ];
      const antes = CT.consolidado(contas, {});
      const depois = CT.consolidado(contas, {
        transferencias: [ {
          from_account_id: "a",
          to_account_id: "b",
          amount: 300
        } ]
      });
      esperar(antes.disponivel).aSer(1500);
      esperar(depois.disponivel).aSer(1500);
    });
    teste("ajuste de saldo entra na conta certa", () => {
      const mov = {
        ajustes: [ {
          account_id: "a",
          amount: -45
        } ]
      };
      esperar(CT.saldoDaConta(conta("a", 500), mov)).aSer(455);
    });
    teste("consolidado ignora contas arquivadas", () => {
      const r = CT.consolidado([ conta("a", 1e3), conta("b", 500, {
        active: false
      }) ], {});
      esperar(r.disponivel).aSer(1e3);
      esperar(r.quantidade).aSer(1);
    });
    teste("conta arquivada mantém o histórico dela", () => {
      const mov = {
        transacoes: [ {
          account_id: "b",
          type: "entrada",
          amount: 200
        } ]
      };
      esperar(CT.saldoDaConta(conta("b", 500, {
        active: false
      }), mov)).aSer(700);
    });
    teste("saldo devedor é aceito e marcado", () => {
      const r = CT.consolidado([ conta("a", -300) ], {});
      esperar(r.disponivel).aSer(-300);
      esperar(r.negativas).aTerTamanho(1);
    });
    teste("total por instituição soma as contas de cada banco", () => {
      const contas = [ conta("a", 100, {
        institution_name: "inter"
      }), conta("b", 250, {
        institution_name: "inter"
      }), conta("c", 400, {
        institution_name: "nubank"
      }) ];
      const linhas = CT.porInstituicao(CT.saldos(contas, {}));
      const inter = linhas.find(l => l.instituicao.id === "inter");
      esperar(inter.total).aSer(350);
      esperar(inter.contas).aSer(2);
    });
    teste("instituição desconhecida cai em Outro sem quebrar", () => {
      esperar(CT.instituicao("banco-que-nao-existe").id).aSer("outro");
    });
    teste("transferência para a mesma conta é recusada", () => {
      esperar(CT.validarTransferencia({
        origem: "a",
        destino: "a",
        valor: 100
      })).aConter("diferente");
    });
    teste("transferência sem valor é recusada", () => {
      esperar(CT.validarTransferencia({
        origem: "a",
        destino: "b",
        valor: 0
      })).aConter("maior que zero");
    });
    teste("transferência válida passa", () => {
      esperar(CT.validarTransferencia({
        origem: "a",
        destino: "b",
        valor: 100
      })).aSer(null);
    });
    teste("ajuste calcula a diferença até o saldo real", () => {
      esperar(CT.diferencaDoAjuste(500, 480)).aSer(-20);
      esperar(CT.diferencaDoAjuste(500, 530)).aSer(30);
      esperar(CT.diferencaDoAjuste(500, 500)).aSer(0);
    });
    teste("conta quantos lançamentos ainda estão sem conta", () => {
      esperar(CT.semConta([ {
        account_id: "a"
      }, {}, {
        account_id: null
      } ])).aSer(2);
    });
  });
  descrever("Campo de dinheiro (FinckMoeda)", () => {
    const M = window.FinckMoeda;
    const comCampo = fn => {
      const el = document.createElement("input");
      el.type = "text";
      el.setAttribute("data-moeda", "");
      document.body.appendChild(el);
      M.ligar(el);
      try {
        return fn(el);
      } finally {
        el.remove();
      }
    };
    const digitar = (el, seq) => {
      el.dataset.centavos = "0";
      el.value = "";
      for (const ch of seq) {
        el.value += ch;
        el.dispatchEvent(new Event("input", {
          bubbles: true
        }));
      }
      return M.ler(el);
    };
    // UX-PRECO: o campo aceita o preço do jeito que a pessoa lê na loja.
    teste("digitar 800 vale R$ 800,00, não R$ 8,00", () => {
      comCampo(el => esperar(digitar(el, "800")).aSerPerto(800, 2));
    });
    teste("um dígito é um real", () => {
      comCampo(el => esperar(digitar(el, "3")).aSerPerto(3, 2));
    });
    teste("vírgula separa os centavos ao digitar", () => {
      comCampo(el => {
        esperar(digitar(el, "800,5")).aSerPerto(800.5, 2);
        esperar(digitar(el, "19,90")).aSerPerto(19.9, 2);
        esperar(digitar(el, "0,08")).aSerPerto(.08, 2);
      });
    });
    teste("ponto também separa centavos, e três casas são milhar", () => {
      comCampo(el => {
        esperar(digitar(el, "12.5")).aSerPerto(12.5, 2);
        esperar(digitar(el, "1.500")).aSerPerto(1500, 2);
        esperar(digitar(el, "1.234,56")).aSerPerto(1234.56, 2);
      });
    });
    teste("texto colado aproveita o preço da loja", () => {
      comCampo(el => {
        el.dataset.centavos = "0";
        el.value = "R$ 1.500,90 aprox";
        el.dispatchEvent(new Event("input", {
          bubbles: true
        }));
        esperar(M.ler(el)).aSerPerto(1500.9, 2);
      });
    });
    teste("colar um preço inteiro vale reais", () => {
      esperar(M.centavosDeColagem("800")).aSer(8e4);
      esperar(M.centavosDeColagem("800,00")).aSer(8e4);
      esperar(M.centavosDeColagem("R$ 800,00")).aSer(8e4);
      esperar(M.centavosDeColagem("R$ 1.234,56")).aSer(123456);
      esperar(M.centavosDeColagem("1.500")).aSer(15e4);
    });
    teste("separador de milhar colado não vira centavo", () => {
      esperar(M.centavosDeColagem("1.500")).aSer(15e4);
      esperar(M.centavosDeColagem("1.500,90")).aSer(150090);
      esperar(M.centavosDeColagem("1,500.90")).aSer(150090);
    });
    teste("texto sem número não vale preço", () => {
      esperar(M.centavosDeColagem("sem preço aqui")).aSer(null);
      esperar(M.centavosDeColagem("")).aSer(null);
      esperar(M.centavosDeColagem(",")).aSer(null);
    });
    teste("ao sair do campo o valor aparece formatado", () => {
      comCampo(el => {
        digitar(el, "1234,5");
        el.dispatchEvent(new Event("blur"));
        esperar(el.value).aConter("1.234,50");
        esperar(M.ler(el)).aSerPerto(1234.5, 2);
      });
    });
    teste("ao voltar ao campo dá para continuar digitando", () => {
      esperar(M.paraEdicao(8e4)).aSer("800");
      esperar(M.paraEdicao(80050)).aSer("800,50");
      esperar(M.paraEdicao(0)).aSer("");
    });
    teste("o campo explica o formato sem falar em centavos", () => {
      comCampo(el => {
        esperar(el.title).aConter("800");
        esperar(el.title).aConter("R$ 800,00");
        esperar(/centavo/i.test(el.title)).aSerFalso();
      });
    });
    teste("apagar um dígito recalcula o valor", () => {
      comCampo(el => {
        digitar(el, "3200");
        el.value = "320";
        el.dispatchEvent(new Event("input", {
          bubbles: true
        }));
        esperar(M.ler(el)).aSerPerto(320, 2);
      });
    });
    teste("letras digitadas são ignoradas", () => {
      comCampo(el => {
        esperar(digitar(el, "8a0b0")).aSerPerto(800, 2);
      });
    });
    teste("escrever de código formata e é lido de volta igual", () => {
      comCampo(el => {
        M.escrever(el, 1234.5);
        esperar(M.ler(el)).aSerPerto(1234.5, 2);
        esperar(el.value).aConter("1.234,50");
      });
    });
    teste("campo vazio vale zero", () => {
      comCampo(el => esperar(M.ler(el)).aSer(0));
    });
    teste("limpar zera o campo", () => {
      comCampo(el => {
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
    teste("data financeira preserva o dia do calendário local", () => {
      const fimDaNoite = new Date(2026, 7, 25, 23, 45);
      esperar(U.dataISO(fimDaNoite)).aSer("2026-08-25");
      esperar(U.mesISO(fimDaNoite)).aSer("2026-08");
    });
    teste("URL de autenticação preserva a pasta da publicação", () => {
      esperar(window.FinckStore.urlLocal("nova-senha.html", "https://exemplo.com/finck/index.html")).aSer("https://exemplo.com/finck/nova-senha.html");
    });
  });
  descrever("Invariantes de contabilidade (ponta a ponta)", () => {
    const S = window.FinckStore;
    const F = window.FinckFinance;
    const R = window.FinckRevisao;
    const O = window.FinckOcorrencias;
    const P = window.FinckPlano;
    const CT = window.FinckContas;
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
    const ocorrenciaDeTeste = async ({category: category = "Moradia", account_id: account_id = null} = {}) => {
      const rec = await S.inserir("recurring_transactions", {
        description: "Aluguel",
        type: "saida",
        amount: 1200,
        day_of_month: 6,
        active: true,
        category: category,
        account_id: account_id
      });
      const [linha] = O.gerar([ rec ], {
        ciclos: [ "2026-08" ]
      });
      return S.inserir("recurring_occurrences", linha);
    };
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
    teste("apagar o recorrente não apaga o dinheiro que já se moveu", async () => {
      await comSessaoLimpa(async () => {
        const oc = await ocorrenciaDeTeste();
        await R.confirmar(oc, 1200);
        esperar((await S.listar("transactions")).length).aSer(1);
        await S.remover("recurring_occurrences", oc.id);
        await R.reconciliar(await S.listar("recurring_occurrences"));
        const restantes = await S.listar("transactions");
        esperar(restantes.length).aSer(1);
        esperar(restantes[0].source_occurrence_id).aSer(null);
        esperar(Number(restantes[0].amount)).aSer(1200);
      });
    });
    teste("varredura separa órfã de previsão e órfã de ocorrência apagada", () => {
      const ocorrencias = [ {
        id: "oc-viva",
        status: "pendente",
        transaction_id: null
      } ];
      const transacoes = [ {
        id: "t-sobra",
        source_occurrence_id: "oc-viva"
      }, {
        id: "t-real",
        source_occurrence_id: "oc-apagada"
      } ];
      const r = O.orfas(ocorrencias, transacoes);
      esperar(r.excluir).aTerTamanho(1);
      esperar(r.excluir[0]).aSer("t-sobra");
      esperar(r.soltarVinculo).aTerTamanho(1);
      esperar(r.soltarVinculo[0]).aSer("t-real");
    });
    teste("ocorrência confirmada com conta bate no saldo global e no saldo da conta", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({
          income_monthly: 3500,
          work_days_month: 22,
          work_hours_day: 8
        });
        const conta = await S.inserir("accounts", {
          name: "Conta corrente",
          institution_name: "nubank",
          account_type: "corrente",
          initial_balance: 5e3,
          active: true
        });
        const oc = await ocorrenciaDeTeste({
          category: "Moradia",
          account_id: conta.id
        });
        await R.confirmar(oc, 1200);
        const ctx = await F.carregarContexto();
        const mov = ctx.transacoes[0];
        esperar(String(mov.account_id)).aSer(String(conta.id));
        esperar(mov.category).aSer("Moradia");
        esperar(ctx.saldo).aSer(3800);
        const consolidado = CT.consolidado([ conta ], {
          transacoes: ctx.transacoes
        });
        esperar(consolidado.disponivel).aSer(3800);
        esperar(CT.semConta(ctx.transacoes)).aSer(0);
      });
    });
    teste("confirmação sem conta é declarada, não silenciosa", async () => {
      await comSessaoLimpa(async () => {
        const conta = await S.inserir("accounts", {
          name: "Carteira",
          institution_name: "outro",
          account_type: "corrente",
          initial_balance: 0,
          active: true
        });
        const oc = await ocorrenciaDeTeste({
          account_id: null
        });
        await R.confirmar(oc, 1200, {
          account_id: null
        });
        const ctx = await F.carregarContexto();
        esperar(CT.semConta(ctx.transacoes)).aSer(1);
        const consolidado = CT.consolidado([ conta ], {
          transacoes: ctx.transacoes
        });
        esperar(ctx.saldo - consolidado.disponivel).aSer(-1200);
      });
    });
    teste("excluir aporte devolve o valor à meta exatamente uma vez", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 1e3
        });
        await F.aportarMeta(meta.id, 500, "Aporte — Reserva");
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1500);
        const mov = (await S.listar("transactions"))[0];
        await F.estornarTransacao(mov.id, {
          motivo: "Aporte indevido"
        });
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1e3);
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
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 1e3
        });
        await F.aportarMeta(meta.id, 500, "Aporte");
        const mov = (await S.listar("transactions"))[0];
        await F.estornarTransacao(mov.id);
        const r = await F.estornarTransacao(mov.id);
        esperar(r.repetida).aSerVerdadeiro();
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1e3);
        const livro = await S.listar("goal_movements", {
          filtro: {
            goal_id: meta.id
          }
        });
        esperar(livro.filter(m => m.kind === "estorno")).aTerTamanho(1);
      });
    });
    teste("aporte que falha ao atualizar a meta não deixa a saída no caixa", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 1e3
        });
        const original = S.atualizar;
        let falhou = false;
        S.atualizar = async (tabela, id, campos) => {
          if (tabela === "goals") {
            falhou = true;
            throw new Error("timeout simulado");
          }
          return original(tabela, id, campos);
        };
        try {
          await esperar(() => F.aportarMeta(meta.id, 500, "Aporte")).aFalharCom("timeout simulado");
        } finally {
          S.atualizar = original;
        }
        esperar(falhou).aSerVerdadeiro();
        esperar((await S.listar("transactions")).length).aSer(0);
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1e3);
      });
    });
    teste("cadastrar conta com o mesmo saldo do perfil não duplica patrimônio", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({
          income_monthly: 3e3,
          work_days_month: 22,
          work_hours_day: 8,
          initial_balance: 2e3
        });
        const semContas = await F.carregarContexto();
        esperar(semContas.saldo).aSer(2e3);
        esperar(semContas.origemSaldo.fonte).aSer("perfil");
        await S.inserir("accounts", {
          name: "Conta",
          institution_name: "nubank",
          account_type: "corrente",
          initial_balance: 2e3,
          active: true
        });
        const comConta = await F.carregarContexto();
        esperar(comConta.saldo).aSer(2e3);
        esperar(comConta.origemSaldo.fonte).aSer("contas");
        esperar(comConta.origemSaldo.duplicaria).aSer(2e3);
      });
    });
    teste("parcela paga sai da projeção e entra no saldo uma única vez", async () => {
      await comSessaoLimpa(async () => {
        const compra = await S.inserir("installment_purchases", {
          description: "Notebook",
          total_amount: 3e3,
          installments_count: 3,
          first_due_date: "2026-08-10",
          paid_count: 0,
          category: "Eletrônicos",
          active: true
        });
        const antes = await F.carregarContexto();
        esperar(antes.compromissosAbertos).aSer(3e3);
        await F.pagarParcela(compra, 1);
        const depois = await F.carregarContexto();
        esperar(depois.compromissosAbertos).aSer(2e3);
        esperar(depois.transacoes.length).aSer(1);
        esperar(Number(depois.transacoes[0].amount)).aSer(1e3);
        const compraAtual = await S.obter("installment_purchases", compra.id);
        const r = await F.pagarParcela(compraAtual, 1);
        esperar(r.jaPaga).aSerVerdadeiro();
        esperar((await S.listar("transactions")).length).aSer(1);
      });
    });
    teste("desfazer pagamento devolve a parcela ao compromisso e remove o lançamento", async () => {
      await comSessaoLimpa(async () => {
        const compra = await S.inserir("installment_purchases", {
          description: "Notebook",
          total_amount: 3e3,
          installments_count: 3,
          first_due_date: "2026-08-10",
          paid_count: 0,
          category: "Eletrônicos",
          active: true
        });
        await F.pagarParcela(compra, 1);
        await F.desfazerPagamentoParcela(await S.obter("installment_purchases", compra.id), 1);
        const ctx = await F.carregarContexto();
        esperar(ctx.compromissosAbertos).aSer(3e3);
        esperar(ctx.transacoes.length).aSer(0);
        esperar(ctx.saldo).aSer(0);
        esperar(ctx.transacoesEstornadas).aTerTamanho(1);
      });
    });
    teste("parcela em aberto não aparece como previsto e realizado ao mesmo tempo", async () => {
      const compra = {
        id: "c1",
        description: "Notebook",
        total_amount: 3e3,
        installments_count: 3,
        first_due_date: "2026-08-10",
        paid_count: 0,
        active: true
      };
      const pagamentos = [ {
        purchase_id: "c1",
        installment_no: 1,
        status: "paga",
        transaction_id: "t1"
      } ];
      const transacoes = [ {
        description: "Notebook (1/3)",
        amount: 1e3,
        type: "saida",
        date: "2026-08-10"
      } ];
      const eventos = P.eventosDoMes({
        parcelamentos: [ compra ],
        pagamentos: pagamentos,
        transacoes: transacoes
      }, "2026-08");
      const doDia = eventos.get(10) || [];
      esperar(doDia.filter(e => e.tipo === "parcela").length).aSer(0);
      esperar(doDia.filter(e => e.tipo === "lancamento").length).aSer(1);
      esperar(doDia[0].estado).aSer("realizado");
    });
    teste("editar recorrente não reescreve ciclo já confirmado", async () => {
      await comSessaoLimpa(async () => {
        const rec = await S.inserir("recurring_transactions", {
          description: "Aluguel",
          type: "saida",
          amount: 1200,
          day_of_month: 6,
          active: true,
          category: "Moradia"
        });
        const [linha] = O.gerar([ rec ], {
          ciclos: [ "2026-08" ]
        });
        const oc = await S.inserir("recurring_occurrences", linha);
        await R.confirmar(oc, 1200);
        await S.atualizar("recurring_transactions", rec.id, {
          amount: 1300
        });
        const congelada = await S.obter("recurring_occurrences", oc.id);
        esperar(Number(congelada.planned_amount)).aSer(1200);
        esperar(Number(congelada.actual_amount)).aSer(1200);
      });
    });
    teste("ocorrência gerada herda categoria e conta da regra", () => {
      const rec = {
        id: "r1",
        description: "Internet",
        type: "saida",
        amount: 99,
        day_of_month: 10,
        active: true,
        category: "Casa",
        account_id: "conta-1"
      };
      const [linha] = O.gerar([ rec ], {
        ciclos: [ "2026-08" ]
      });
      esperar(linha.category).aSer("Casa");
      esperar(linha.account_id).aSer("conta-1");
      const mov = O.movimentacaoDe({
        ...linha,
        id: "oc-1"
      }, 99);
      esperar(mov.category).aSer("Casa");
      esperar(mov.account_id).aSer("conta-1");
      esperar(mov.source_occurrence_id).aSer("oc-1");
    });
    teste("importação recusa valores inválidos e limpa vínculos órfãos", async () => {
      await comSessaoLimpa(async () => {
        const exame = S.validarImportacao({
          goals: [ {
            id: "g1",
            name: "Viagem",
            target_amount: 5e3,
            current_amount: 0
          }, {
            id: "g2",
            name: "Zerada",
            target_amount: 0,
            current_amount: 0
          }, {
            id: "g3",
            name: "Negativa",
            target_amount: 100,
            current_amount: -50
          } ],
          transactions: [ {
            id: "t1",
            type: "saida",
            description: "Aporte",
            amount: 100,
            date: "2026-08-01",
            goal_id: "g1"
          }, {
            id: "t2",
            type: "saida",
            description: "Órfã",
            amount: 100,
            date: "2026-08-01",
            goal_id: "inexistente"
          }, {
            id: "t3",
            type: "saida",
            description: "Negativa",
            amount: -5,
            date: "2026-08-01"
          }, {
            id: "t4",
            type: "compra",
            description: "Tipo errado",
            amount: 10,
            date: "2026-08-01"
          } ],
          transfers: [ {
            id: "x1",
            from_account_id: "a1",
            to_account_id: "a1",
            amount: 50,
            date: "2026-08-01"
          }, {
            id: "x2",
            from_account_id: "a1",
            to_account_id: "a2",
            amount: 50,
            date: "2026-08-01"
          } ]
        });
        esperar(exame.linhas.goals).aTerTamanho(1);
        esperar(exame.linhas.transactions).aTerTamanho(2);
        esperar(exame.linhas.transfers).aTerTamanho(0);
      });
    });
    teste("importação reaponta o vínculo com a meta para o novo ID", async () => {
      await comSessaoLimpa(async () => {
        await S.importarTudo({
          goals: [ {
            id: "antigo-g1",
            name: "Viagem",
            target_amount: 5e3,
            current_amount: 0
          } ],
          transactions: [ {
            id: "antigo-t1",
            type: "saida",
            description: "Aporte",
            amount: 100,
            date: "2026-08-01",
            goal_id: "antigo-g1"
          } ]
        }, {
          modo: "substituir"
        });
        const meta = (await S.listar("goals"))[0];
        const mov = (await S.listar("transactions"))[0];
        esperar(String(mov.goal_id)).aSer(String(meta.id));
        esperar(mov.goal_id === "antigo-g1").aSerFalso();
      });
    });
    teste("importação não deixa user_id de outra pessoa passar", async () => {
      await comSessaoLimpa(async () => {
        await S.importarTudo({
          transactions: [ {
            id: "t1",
            user_id: "outro-usuario",
            type: "saida",
            description: "Alheia",
            amount: 10,
            date: "2026-08-01"
          } ]
        }, {
          modo: "substituir"
        });
        const eu = await S.usuarioAtual();
        const mov = (await S.listar("transactions"))[0];
        esperar(mov.user_id).aSer(eu.id);
      });
    });
    teste("renda totalmente comprometida aparece como déficit, não como folga", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({
          income_monthly: 3500,
          work_days_month: 22,
          work_hours_day: 8,
          initial_balance: 4e3
        });
        await S.inserir("recurring_transactions", {
          description: "Fixas",
          type: "saida",
          amount: 3500,
          day_of_month: 5,
          active: true
        });
        const ctx = await F.carregarContexto();
        esperar(ctx.rendaLivre).aSer(0);
        esperar(ctx.sobraAposFixos).aSer(0);
        esperar(ctx.semFolga).aSerVerdadeiro();
        esperar(ctx.saldo).aSer(4e3);
      });
    });
    teste("compra pequena sem folga não recebe semáforo verde", () => {
      const perfil = {
        income_monthly: 3500,
        work_days_month: 22,
        work_hours_day: 8
      };
      const r = window.FinckReality.calcular(100, perfil, {
        saldo: 4e3,
        despesasFixas: 3500
      });
      esperar(r.income_percent).aSerPerto(2.86, 2);
      esperar(r.sem_folga).aSerVerdadeiro();
      esperar(r.semaforo.nivel).aSer("alerta");
    });
    teste("déficit de renda fixa aparece com sinal, não zerado", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({
          income_monthly: 3e3,
          work_days_month: 22,
          work_hours_day: 8
        });
        await S.inserir("recurring_transactions", {
          description: "Fixas",
          type: "saida",
          amount: 3800,
          day_of_month: 5,
          active: true
        });
        const ctx = await F.carregarContexto();
        esperar(ctx.sobraAposFixos).aSer(-800);
        esperar(ctx.deficitFixos).aSer(800);
        esperar(ctx.rendaLivre).aSer(0);
      });
    });
    teste("lançamento com data futura não conta como caixa de hoje", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({
          income_monthly: 3e3,
          work_days_month: 22,
          work_hours_day: 8,
          initial_balance: 1e3
        });
        const hoje = new Date;
        const daquiATresMeses = new Date(hoje.getFullYear(), hoje.getMonth() + 3, 10).toISOString().slice(0, 10);
        await S.inserir("transactions", {
          type: "saida",
          description: "Seguro anual",
          amount: 600,
          date: daquiATresMeses
        });
        const ctx = await F.carregarContexto();
        esperar(ctx.saldo).aSer(1e3);
        esperar(ctx.transacoesFuturas).aTerTamanho(1);
        esperar(ctx.agendado).aSer(-600);
        const linhas = P.projecaoSaldo({
          saldo: ctx.saldo,
          recorrentes: [],
          transacoesFuturas: ctx.transacoesFuturas,
          meses: 6
        });
        esperar(linhas[3].saidas).aSer(600);
        esperar(linhas[5].saldoFim).aSer(400);
      });
    });
    teste("ciclo já decidido não volta como previsão na projeção", () => {
      const recorrentes = [ {
        id: "r1",
        description: "Aluguel",
        type: "saida",
        amount: 1200,
        day_of_month: 6,
        active: true
      } ];
      const mesAtual = P.chaveMes(new Date);
      const semDecisao = P.projecaoSaldo({
        saldo: 5e3,
        recorrentes: recorrentes,
        meses: 1
      }, new Date(`${mesAtual}-01T12:00:00`));
      esperar(semDecisao[0].saidas).aSer(1200);
      const comDecisao = P.projecaoSaldo({
        saldo: 5e3,
        recorrentes: recorrentes,
        meses: 1,
        ocorrencias: [ {
          recurring_id: "r1",
          cycle: mesAtual,
          status: "confirmado"
        } ]
      }, new Date(`${mesAtual}-01T12:00:00`));
      esperar(comDecisao[0].saidas).aSer(0);
    });
    teste("ocorrência não realizada continua prevista na projeção", () => {
      const recorrentes = [ {
        id: "r1",
        type: "saida",
        amount: 1200,
        day_of_month: 6,
        active: true
      } ];
      const mesAtual = P.chaveMes(new Date);
      const linhas = P.projecaoSaldo({
        saldo: 5e3,
        recorrentes: recorrentes,
        meses: 1,
        ocorrencias: [ {
          recurring_id: "r1",
          cycle: mesAtual,
          status: "pendente"
        } ]
      }, new Date(`${mesAtual}-01T12:00:00`));
      esperar(linhas[0].saidas).aSer(1200);
    });
    teste("disponível projetado desconta parcelas em aberto do saldo", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({
          income_monthly: 3e3,
          work_days_month: 22,
          work_hours_day: 8,
          initial_balance: 5e3
        });
        await S.inserir("installment_purchases", {
          description: "Notebook",
          total_amount: 3e3,
          installments_count: 3,
          first_due_date: "2026-08-10",
          paid_count: 0,
          active: true
        });
        const ctx = await F.carregarContexto();
        esperar(ctx.saldo).aSer(5e3);
        esperar(ctx.disponivelProjetado).aSer(2e3);
      });
    });
    teste("confirmação usa a função do banco quando ela existe", async () => {
      await comSessaoLimpa(async () => {
        const oc = await ocorrenciaDeTeste();
        const original = S.rpc;
        const chamadas = [];
        S.rpc = async (nome, params) => {
          chamadas.push({
            nome: nome,
            params: params
          });
          return {
            suportado: true,
            dados: {
              status: "confirmado",
              transaction_id: "tx-do-banco"
            }
          };
        };
        try {
          const r = await R.confirmar(oc, 1200, {
            account_id: null
          });
          esperar(r.atomica).aSerVerdadeiro();
          esperar(r.transaction_id).aSer("tx-do-banco");
        } finally {
          S.rpc = original;
        }
        esperar(chamadas).aTerTamanho(1);
        esperar(chamadas[0].nome).aSer("confirmar_ocorrencia");
        esperar(chamadas[0].params.p_amount).aSer(1200);
        esperar((await S.listar("transactions")).length).aSer(0);
      });
    });
    teste("confirmação cai para o caminho local quando a função não existe", async () => {
      await comSessaoLimpa(async () => {
        const oc = await ocorrenciaDeTeste();
        const original = S.rpc;
        S.rpc = async () => ({
          suportado: false,
          dados: null
        });
        try {
          const r = await R.confirmar(oc, 1200, {
            account_id: null
          });
          esperar(r.atomica).aSer(undefined);
          esperar(Boolean(r.transaction_id)).aSerVerdadeiro();
        } finally {
          S.rpc = original;
        }
        esperar((await S.listar("transactions")).length).aSer(1);
      });
    });
    teste("estorno usa a função do banco quando ela existe", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 1e3
        });
        await F.aportarMeta(meta.id, 500, "Aporte");
        const mov = (await S.listar("transactions"))[0];
        const original = S.rpc;
        const chamadas = [];
        S.rpc = async (nome, params) => {
          chamadas.push({
            nome: nome,
            params: params
          });
          return {
            suportado: true,
            dados: null
          };
        };
        try {
          const r = await F.estornarTransacao(mov.id);
          esperar(r.atomica).aSerVerdadeiro();
          esperar(r.estornouMeta).aSerVerdadeiro();
        } finally {
          S.rpc = original;
        }
        esperar(chamadas[0].nome).aSer("estornar_transacao");
        esperar(chamadas[0].params.p_transaction_id).aSer(mov.id);
      });
    });
    teste("mutação local não alcança registro de outro usuário", async () => {
      await comSessaoLimpa(async () => {
        const minha = await S.inserir("transactions", {
          type: "saida",
          description: "Minha",
          amount: 10,
          date: "2026-08-01"
        });
        const linhas = JSON.parse(localStorage.getItem(S.KEYS.transactions));
        linhas.push({
          id: "alheia",
          user_id: "outro-usuario",
          type: "saida",
          description: "Alheia",
          amount: 99,
          date: "2026-08-01"
        });
        localStorage.setItem(S.KEYS.transactions, JSON.stringify(linhas));
        esperar(await S.atualizar("transactions", "alheia", {
          amount: 1
        })).aSer(null);
        esperar(await S.remover("transactions", "alheia")).aSerFalso();
        const depois = JSON.parse(localStorage.getItem(S.KEYS.transactions));
        const alheia = depois.find(r => r.id === "alheia");
        esperar(Number(alheia.amount)).aSer(99);
        esperar(depois.some(r => String(r.id) === String(minha.id))).aSerVerdadeiro();
      });
    });
  });
  descrever("Livro-razão das metas (6.1)", () => {
    const M = window.FinckMetas;
    teste("progresso é a soma assinada dos movimentos", () => {
      const livro = [ {
        goal_id: "g",
        kind: "aporte",
        amount: 500
      }, {
        goal_id: "g",
        kind: "aporte",
        amount: 300
      }, {
        goal_id: "g",
        kind: "retirada",
        amount: -200
      } ];
      esperar(M.progresso(livro)).aSer(600);
    });
    teste("estorno entra com o sinal oposto ao do movimento original", () => {
      const original = {
        id: "m1",
        goal_id: "g",
        amount: 500,
        transaction_id: "t1"
      };
      const estorno = M.movimentoDoEstorno(original, {
        date: "2026-08-16"
      });
      esperar(estorno.amount).aSer(-500);
      esperar(estorno.reverses_id).aSer("m1");
      esperar(M.progresso([ original, estorno ])).aSer(0);
    });
    teste("saída vinculada guarda dinheiro; entrada vinculada devolve", () => {
      esperar(M.valorAssinado("saida", 100)).aSer(100);
      esperar(M.valorAssinado("entrada", 100)).aSer(-100);
      esperar(M.kindDoTipo("saida")).aSer("aporte");
      esperar(M.kindDoTipo("entrada")).aSer("retirada");
    });
    teste("divergência entre cache e histórico é medida, não escondida", () => {
      const metas = [ {
        id: "g",
        name: "Reserva",
        current_amount: 1500
      } ];
      const livro = [ {
        goal_id: "g",
        kind: "aporte",
        amount: 1e3
      } ];
      const [d] = M.divergencias(metas, livro);
      esperar(d.cache).aSer(1500);
      esperar(d.historico).aSer(1e3);
      esperar(d.diferenca).aSer(500);
    });
    teste("cache igual ao histórico não vira divergência", () => {
      const metas = [ {
        id: "g",
        name: "Reserva",
        current_amount: 1e3
      } ];
      const livro = [ {
        goal_id: "g",
        kind: "aporte",
        amount: 1e3
      } ];
      esperar(M.conferem(metas, livro)).aSerVerdadeiro();
    });
    teste("progresso exibido nunca fica negativo", () => {
      esperar(M.progressoExibido([ {
        goal_id: "g",
        amount: -50
      } ])).aSer(0);
    });
    teste("estorno duas vezes é barrado pelo próprio livro", () => {
      const original = {
        id: "m1",
        goal_id: "g",
        amount: 500
      };
      const estorno = {
        id: "m2",
        goal_id: "g",
        amount: -500,
        kind: "estorno",
        reverses_id: "m1"
      };
      esperar(M.jaEstornado([ original, estorno ], "m1")).aSerVerdadeiro();
      esperar(M.jaEstornado([ original ], "m1")).aSerFalso();
    });
  });
  descrever("Invariantes contábeis do relatório (6.1)", () => {
    const S = window.FinckStore;
    const F = window.FinckFinance;
    const CT = window.FinckContas;
    const comSessaoLimpa = async fn => {
      const antes = {};
      Object.entries(S.KEYS).forEach(([, v]) => {
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
    teste("aporte move o progresso exatamente uma vez", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 0
        });
        await F.aportarMeta(meta.id, 500, "Aporte");
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(500);
        esperar(await S.listar("goal_movements", {
          filtro: {
            goal_id: meta.id
          }
        })).aTerTamanho(1);
      });
    });
    teste("aporte repetido com a mesma chave não lança duas vezes", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 0
        });
        const chave = "aporte-idem-1";
        await F.aportarMeta(meta.id, 500, "Aporte", {
          chave: chave
        });
        await F.aportarMeta(meta.id, 500, "Aporte", {
          chave: chave
        });
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(500);
        esperar(await S.listar("transactions")).aTerTamanho(1);
      });
    });
    teste("retirada devolve o dinheiro da meta ao caixa", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 0
        });
        await F.aportarMeta(meta.id, 800, "Aporte");
        await F.retirarMeta(meta.id, 300, "Retirada");
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(500);
        esperar((await F.carregarContexto()).saldo).aSer(-500);
      });
    });
    teste("progresso da meta é recalculável a partir do histórico", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 0
        });
        await F.aportarMeta(meta.id, 500, "Aporte");
        await F.aportarMeta(meta.id, 250, "Aporte");
        await S.atualizar("goals", meta.id, {
          current_amount: 99999
        });
        await F.recalcularMeta(meta.id);
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(750);
      });
    });
    teste("meta antiga não perde o progresso no primeiro aporte", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 1e3
        });
        esperar(await S.listar("goal_movements", {
          filtro: {
            goal_id: meta.id
          }
        })).aTerTamanho(0);
        await F.aportarMeta(meta.id, 500, "Aporte");
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1500);
        const livro = await S.listar("goal_movements", {
          filtro: {
            goal_id: meta.id
          }
        });
        esperar(livro).aTerTamanho(2);
        esperar(livro.filter(m => m.kind === "ajuste")).aTerTamanho(1);
      });
    });
    teste("semear o histórico duas vezes não duplica o valor antigo", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 1e3
        });
        await F.garantirHistorico(meta.id);
        await F.garantirHistorico(meta.id);
        esperar(await S.listar("goal_movements", {
          filtro: {
            goal_id: meta.id
          }
        })).aTerTamanho(1);
        await F.recalcularMeta(meta.id);
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1e3);
      });
    });
    teste("meta criada com valor guardado nasce com histórico", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 0
        });
        await F.ajustarMeta(meta.id, 1500, "Saldo informado na criação");
        const livro = await S.listar("goal_movements", {
          filtro: {
            goal_id: meta.id
          }
        });
        esperar(livro).aTerTamanho(1);
        esperar(livro[0].kind).aSer("ajuste");
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(1500);
      });
    });
    teste("transferência não muda o patrimônio total", async () => {
      await comSessaoLimpa(async () => {
        const a = await S.inserir("accounts", {
          name: "Corrente",
          initial_balance: 1e3,
          active: true
        });
        const b = await S.inserir("accounts", {
          name: "Poupança",
          initial_balance: 0,
          active: true
        });
        const antes = await F.carregarContexto();
        await F.transferir({
          from_account_id: a.id,
          to_account_id: b.id,
          amount: 300,
          date: "2026-08-16"
        });
        const depois = await F.carregarContexto();
        esperar(depois.saldo).aSer(antes.saldo);
        const mov = {
          transacoes: depois.transacoes,
          transferencias: depois.transferencias,
          ajustes: depois.ajustes
        };
        esperar(CT.saldoDaConta(a, mov)).aSer(700);
        esperar(CT.saldoDaConta(b, mov)).aSer(300);
      });
    });
    teste("transferência repetida com a mesma chave não duplica", async () => {
      await comSessaoLimpa(async () => {
        const a = await S.inserir("accounts", {
          name: "Corrente",
          initial_balance: 1e3,
          active: true
        });
        const b = await S.inserir("accounts", {
          name: "Poupança",
          initial_balance: 0,
          active: true
        });
        await F.transferir({
          from_account_id: a.id,
          to_account_id: b.id,
          amount: 300,
          chave: "t-1"
        });
        await F.transferir({
          from_account_id: a.id,
          to_account_id: b.id,
          amount: 300,
          chave: "t-1"
        });
        esperar(await S.listar("transfers")).aTerTamanho(1);
      });
    });
    teste("confirmar com conta muda saldo global e saldo da conta juntos", async () => {
      await comSessaoLimpa(async () => {
        const conta = await S.inserir("accounts", {
          name: "Corrente",
          initial_balance: 0,
          active: true
        });
        await F.registrarTransacao({
          type: "saida",
          description: "Mercado",
          amount: 200,
          date: "2026-08-10",
          category: "Alimentação",
          account_id: conta.id
        });
        const ctx = await F.carregarContexto();
        esperar(ctx.saldo).aSer(-200);
        esperar(CT.saldoDaConta(conta, {
          transacoes: ctx.transacoes
        })).aSer(-200);
        esperar(ctx.naoAlocado).aSer(0);
      });
    });
    teste("confirmar sem conta é declarado e aparece como não alocado", async () => {
      await comSessaoLimpa(async () => {
        await S.inserir("accounts", {
          name: "Corrente",
          initial_balance: 0,
          active: true
        });
        await F.registrarTransacao({
          type: "saida",
          description: "Feira",
          amount: 80,
          date: "2026-08-10",
          category: "Alimentação",
          account_id: null,
          unallocated: true
        });
        const ctx = await F.carregarContexto();
        esperar(ctx.naoAlocado).aSer(-80);
        esperar(ctx.semContaVinculada).aSer(1);
      });
    });
    teste("ajuste de conta entra no saldo global, senão as duas visões divergem", async () => {
      await comSessaoLimpa(async () => {
        const conta = await S.inserir("accounts", {
          name: "Corrente",
          initial_balance: 100,
          active: true
        });
        await S.inserir("balance_adjustments", {
          account_id: conta.id,
          amount: 50,
          new_balance: 150,
          date: "2026-08-10",
          reason: "Conferência"
        });
        const ctx = await F.carregarContexto();
        esperar(ctx.saldo).aSer(150);
        esperar(CT.saldoDaConta(conta, {
          transacoes: ctx.transacoes,
          ajustes: ctx.ajustes
        })).aSer(150);
      });
    });
    teste("mesclagem reaponta vínculos para um registro equivalente que já existe", async () => {
      await comSessaoLimpa(async () => {
        const metaExistente = await S.inserir("goals", {
          name: "Viagem",
          target_amount: 5e3,
          current_amount: 0
        });
        await S.importarTudo({
          goals: [ {
            id: "meta-do-backup",
            name: "Viagem",
            target_amount: 5e3,
            current_amount: 0
          } ],
          transactions: [ {
            id: "tx-do-backup",
            type: "saida",
            description: "Aporte",
            amount: 100,
            date: "2026-08-01",
            goal_id: "meta-do-backup"
          } ]
        }, {
          modo: "mesclar"
        });
        const [mov] = await S.listar("transactions");
        esperar(String(mov.goal_id)).aSer(String(metaExistente.id));
      });
    });
    teste("importação preserva o vínculo entre estorno e movimento original", async () => {
      await comSessaoLimpa(async () => {
        await S.importarTudo({
          goals: [ {
            id: "g1",
            name: "Reserva",
            target_amount: 1e3,
            current_amount: 0
          } ],
          goal_movements: [ {
            id: "m2",
            goal_id: "g1",
            kind: "estorno",
            amount: -100,
            date: "2026-08-02",
            reverses_id: "m1"
          }, {
            id: "m1",
            goal_id: "g1",
            kind: "aporte",
            amount: 100,
            date: "2026-08-01"
          } ]
        }, {
          modo: "substituir"
        });
        const movimentos = await S.listar("goal_movements");
        const original = movimentos.find(m => m.kind === "aporte");
        const estorno = movimentos.find(m => m.kind === "estorno");
        esperar(String(estorno.reverses_id)).aSer(String(original.id));
      });
    });
    teste("arquivar a última conta não ressuscita o saldo legado do perfil", () => {
      const origem = F.origemDoSaldo({
        initial_balance: 900,
        initial_balance_source: "contas",
        initial_balance_migrated_at: "2026-08-10T12:00:00Z"
      }, [ {
        id: "a",
        initial_balance: 900,
        active: false
      } ]);
      esperar(origem.fonte).aSer("contas");
      esperar(origem.saldoInicial).aSer(0);
    });
  });
  descrever("Reconciliador financeiro (fase 3)", () => {
    const RC = window.FinckReconciliador;
    const base = {
      perfil: {
        id: "u",
        initial_balance: 0
      },
      contas: [],
      transacoes: [],
      transferencias: [],
      ajustes: [],
      metas: [],
      movimentosMeta: [],
      parcelamentos: [],
      pagamentos: [],
      ocorrencias: [],
      hoje: "2026-08-16"
    };
    teste("identidade fecha quando tudo está alocado", () => {
      const r = RC.conferir({
        ...base,
        contas: [ {
          id: "a",
          name: "Corrente",
          initial_balance: 1e3,
          active: true
        } ],
        transacoes: [ {
          id: "t1",
          type: "saida",
          amount: 200,
          date: "2026-08-10",
          account_id: "a",
          category: "Casa"
        } ]
      });
      esperar(r.caixa.saldoGlobal).aSer(800);
      esperar(r.caixa.somaContas).aSer(800);
      esperar(r.caixa.naoAlocado).aSer(0);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });
    teste("saldo global = contas + não alocado, mesmo com lançamento fora das contas", () => {
      const r = RC.conferir({
        ...base,
        contas: [ {
          id: "a",
          name: "Corrente",
          initial_balance: 1e3,
          active: true
        } ],
        transacoes: [ {
          id: "t1",
          type: "saida",
          amount: 200,
          date: "2026-08-10",
          account_id: "a",
          category: "Casa"
        }, {
          id: "t2",
          type: "saida",
          amount: 50,
          date: "2026-08-11",
          account_id: null,
          unallocated: true,
          category: "Outros"
        } ]
      });
      esperar(r.caixa.somaContas).aSer(800);
      esperar(r.caixa.naoAlocado).aSer(-50);
      esperar(r.caixa.saldoGlobal).aSer(750);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });
    teste("sem conta cadastrada o saldo inicial do perfil é não alocado", () => {
      const r = RC.conferir({
        ...base,
        perfil: {
          id: "u",
          initial_balance: 500
        },
        transacoes: [ {
          id: "t1",
          type: "entrada",
          amount: 100,
          date: "2026-08-10"
        } ]
      });
      esperar(r.caixa.somaContas).aSer(0);
      esperar(r.caixa.naoAlocado).aSer(600);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });
    teste("movimentação estornada sai do saldo e continua no histórico", () => {
      const r = RC.conferir({
        ...base,
        contas: [ {
          id: "a",
          name: "Corrente",
          initial_balance: 1e3,
          active: true
        } ],
        transacoes: [ {
          id: "t1",
          type: "saida",
          amount: 200,
          date: "2026-08-10",
          account_id: "a",
          reversed_at: "2026-08-12T10:00:00Z",
          category: "Casa"
        } ]
      });
      esperar(r.caixa.saldoGlobal).aSer(1e3);
      esperar(r.historico.estornadas).aSer(1);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });
    teste("lançamento sem conta e sem declaração vira pendência", () => {
      const r = RC.conferir({
        ...base,
        contas: [ {
          id: "a",
          name: "Corrente",
          initial_balance: 0,
          active: true
        } ],
        transacoes: [ {
          id: "t1",
          type: "saida",
          amount: 50,
          date: "2026-08-10",
          account_id: null,
          description: "Feira"
        } ]
      });
      const check = r.checagens.find(c => c.id === "nao_alocado");
      esperar(check.ok).aSerFalso();
      esperar(r.pendencias.some(p => p.kind === "transacao_sem_conta")).aSerVerdadeiro();
    });
    teste("declarar fora das contas resolve a ambiguidade", () => {
      const r = RC.conferir({
        ...base,
        contas: [ {
          id: "a",
          name: "Corrente",
          initial_balance: 0,
          active: true
        } ],
        transacoes: [ {
          id: "t1",
          type: "saida",
          amount: 50,
          date: "2026-08-10",
          account_id: null,
          unallocated: true,
          description: "Feira"
        } ]
      });
      esperar(r.checagens.find(c => c.id === "nao_alocado").ok).aSerVerdadeiro();
    });
    teste("meta com cache fora do histórico é acusada", () => {
      const r = RC.conferir({
        ...base,
        metas: [ {
          id: "g",
          name: "Reserva",
          current_amount: 1500
        } ],
        movimentosMeta: [ {
          goal_id: "g",
          kind: "aporte",
          amount: 1e3
        } ]
      });
      const check = r.checagens.find(c => c.id === "metas");
      esperar(check.ok).aSerFalso();
      esperar(check.diferenca).aSer(500);
    });
    teste("previsão em aberto com movimentação viva é divergência", () => {
      const r = RC.conferir({
        ...base,
        transacoes: [ {
          id: "t1",
          type: "saida",
          amount: 100,
          date: "2026-08-10",
          unallocated: true,
          category: "Casa"
        } ],
        ocorrencias: [ {
          id: "o1",
          status: "pendente",
          type: "saida",
          planned_amount: 100,
          transaction_id: "t1",
          description: "Aluguel",
          cycle: "2026-08",
          category: "Casa"
        } ]
      });
      esperar(r.checagens.find(c => c.id === "compromissos").ok).aSerFalso();
      esperar(r.pendencias.some(p => p.kind === "previsao_com_movimento")).aSerVerdadeiro();
    });
    teste("totais por categoria reproduzem o total de saídas", () => {
      const r = RC.conferir({
        ...base,
        transacoes: [ {
          id: "t1",
          type: "saida",
          amount: 100,
          date: "2026-08-10",
          category: "Casa",
          unallocated: true
        }, {
          id: "t2",
          type: "saida",
          amount: 60,
          date: "2026-08-11",
          category: "Lazer",
          unallocated: true
        }, {
          id: "t3",
          type: "entrada",
          amount: 500,
          date: "2026-08-05",
          unallocated: true
        } ]
      });
      const check = r.checagens.find(c => c.id === "categorias");
      esperar(check.ok).aSerVerdadeiro();
      esperar(check.encontrado).aSer(160);
    });
    teste("conta arquivada com movimentação não quebra a identidade", () => {
      const r = RC.conferir({
        ...base,
        contas: [ {
          id: "a",
          name: "Corrente",
          initial_balance: 1e3,
          active: true
        }, {
          id: "b",
          name: "Antiga",
          initial_balance: 0,
          active: false
        } ],
        transacoes: [ {
          id: "t1",
          type: "saida",
          amount: 200,
          date: "2026-08-10",
          account_id: "a",
          category: "Casa"
        }, {
          id: "t2",
          type: "saida",
          amount: 100,
          date: "2026-08-11",
          account_id: "b",
          category: "Casa"
        } ]
      });
      esperar(r.caixa.saldoGlobal).aSer(700);
      esperar(r.caixa.somaContas).aSer(800);
      esperar(r.caixa.somaArquivadas).aSer(-100);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });
    teste("transferência para conta arquivada não vira divergência", () => {
      const r = RC.conferir({
        ...base,
        contas: [ {
          id: "a",
          name: "Corrente",
          initial_balance: 1e3,
          active: true
        }, {
          id: "b",
          name: "Antiga",
          initial_balance: 0,
          active: false
        } ],
        transferencias: [ {
          id: "tr1",
          from_account_id: "a",
          to_account_id: "b",
          amount: 300,
          date: "2026-08-12"
        } ]
      });
      esperar(r.caixa.somaContas).aSer(700);
      esperar(r.caixa.somaArquivadas).aSer(300);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });
    teste("lançamentos idênticos no mesmo dia viram pendência de duplicata", () => {
      const linha = id => ({
        id: id,
        type: "saida",
        amount: 40,
        date: "2026-08-10",
        description: "Café",
        unallocated: true,
        category: "Alimentação"
      });
      const r = RC.conferir({
        ...base,
        transacoes: [ linha("t1"), linha("t2") ]
      });
      esperar(r.duplicatas.grupos).aSer(1);
      esperar(r.duplicatas.lancamentos).aSer(2);
      esperar(r.pendencias.some(p => p.kind === "possivel_duplicata")).aSerVerdadeiro();
      esperar(r.contabilOk).aSerVerdadeiro();
    });
    teste("confirmações de ciclos diferentes não viram duplicata falsa", () => {
      const r = RC.conferir({
        ...base,
        transacoes: [ {
          id: "t1",
          type: "saida",
          amount: 1200,
          date: "2026-08-06",
          description: "Aluguel",
          source_occurrence_id: "o1",
          unallocated: true,
          category: "Moradia"
        }, {
          id: "t2",
          type: "saida",
          amount: 1200,
          date: "2026-08-06",
          description: "Aluguel",
          source_occurrence_id: "o2",
          unallocated: true,
          category: "Moradia"
        } ]
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
    const regra = dia => ({
      id: "r1",
      description: "Assinatura",
      type: "saida",
      amount: 50,
      day_of_month: dia,
      active: true,
      category: "Lazer",
      account_id: "a1"
    });
    teste("dia 31 encaixa no último dia de fevereiro comum (28)", () => {
      const [oc] = O.gerar([ regra(31) ], {
        ciclos: [ "2027-02" ]
      });
      esperar(oc.due_date).aSer("2027-02-28");
    });
    teste("dia 31 encaixa no último dia de fevereiro bissexto (29)", () => {
      const [oc] = O.gerar([ regra(31) ], {
        ciclos: [ "2028-02" ]
      });
      esperar(oc.due_date).aSer("2028-02-29");
    });
    teste("dia 31 encaixa em mês de 30 dias", () => {
      const [oc] = O.gerar([ regra(31) ], {
        ciclos: [ "2026-09" ]
      });
      esperar(oc.due_date).aSer("2026-09-30");
    });
    teste("dia 31 se mantém em mês de 31 dias", () => {
      const [oc] = O.gerar([ regra(31) ], {
        ciclos: [ "2026-08" ]
      });
      esperar(oc.due_date).aSer("2026-08-31");
    });
    teste("gerar duas vezes o mesmo ciclo produz a mesma linha", () => {
      const a = O.gerar([ regra(10) ], {
        ciclos: [ "2026-08" ]
      });
      const b = O.gerar([ regra(10) ], {
        ciclos: [ "2026-08" ]
      });
      esperar(JSON.stringify(a)).aSer(JSON.stringify(b));
    });
    teste("ocorrência congela conta e categoria da regra", () => {
      const [oc] = O.gerar([ regra(10) ], {
        ciclos: [ "2026-08" ]
      });
      esperar(oc.account_id).aSer("a1");
      esperar(oc.category).aSer("Lazer");
    });
    teste("mudar a conta no ciclo não reescreve a regra", () => {
      const [oc] = O.gerar([ regra(10) ], {
        ciclos: [ "2026-08" ]
      });
      const mov = O.movimentacaoDe({
        ...oc,
        id: "o1"
      }, 50, "a2");
      esperar(mov.account_id).aSer("a2");
      esperar(oc.account_id).aSer("a1");
    });
    teste("confirmar sem conta marca a movimentação como não alocada", () => {
      const [oc] = O.gerar([ regra(10) ], {
        ciclos: [ "2026-08" ]
      });
      const mov = O.movimentacaoDe({
        ...oc,
        id: "o1"
      }, 50, null, {
        unallocated: true
      });
      esperar(mov.account_id).aSer(null);
      esperar(mov.unallocated).aSerVerdadeiro();
    });
    teste("movimentação estornada não é varrida como órfã", () => {
      const ocorrencias = [ {
        id: "o1",
        status: "pendente",
        transaction_id: null
      } ];
      const transacoes = [ {
        id: "t1",
        source_occurrence_id: "o1",
        reversed_at: "2026-08-12T10:00:00Z"
      } ];
      const r = O.orfas(ocorrencias, transacoes);
      esperar(r.excluir).aTerTamanho(0);
    });
    teste("ocorrência apontando para lançamento estornado volta a ficar aberta", () => {
      const ocorrencias = [ {
        id: "o1",
        status: "confirmado",
        transaction_id: "t1"
      } ];
      const transacoes = [ {
        id: "t1",
        source_occurrence_id: "o1",
        reversed_at: "2026-08-12T10:00:00Z"
      } ];
      const r = O.orfas(ocorrencias, transacoes);
      esperar(r.desvincular).aTerTamanho(1);
      esperar(r.desvincular[0]).aSer("o1");
    });
    teste("mudar a categoria da regra não reescreve o ciclo já gerado", () => {
      const [oc] = O.gerar([ regra(10) ], {
        ciclos: [ "2026-08" ]
      });
      esperar(oc.category).aSer("Lazer");
      const nova = {
        ...regra(10),
        category: "Assinaturas"
      };
      const [proximo] = O.gerar([ nova ], {
        ciclos: [ "2026-09" ]
      });
      esperar(oc.category).aSer("Lazer");
      esperar(proximo.category).aSer("Assinaturas");
    });
    teste("a transação confirmada herda a categoria da ocorrência, não da regra", () => {
      const [oc] = O.gerar([ regra(10) ], {
        ciclos: [ "2026-08" ]
      });
      const mov = O.movimentacaoDe({
        ...oc,
        id: "o1"
      }, 50, "a1");
      esperar(mov.category).aSer("Lazer");
    });
    teste("entrada não recebe categoria nem no ciclo nem na transação", () => {
      const entrada = {
        ...regra(5),
        type: "entrada",
        description: "Salário"
      };
      const [oc] = O.gerar([ entrada ], {
        ciclos: [ "2026-08" ]
      });
      esperar(oc.category).aSer(null);
      esperar(O.movimentacaoDe({
        ...oc,
        id: "o1"
      }, 3e3, "a1").category).aSer(null);
    });
    teste("cronograma soma só as parcelas em aberto", () => {
      const compra = {
        id: "c1",
        description: "Notebook",
        total_amount: 3e3,
        installments_count: 3,
        first_due_date: "2026-08-10",
        paid_count: 0
      };
      const pagas = [ {
        purchase_id: "c1",
        installment_no: 1,
        status: "paga",
        transaction_id: "t1"
      } ];
      esperar(P.saldoDevedor(compra, pagas)).aSer(2e3);
    });
    teste("parcela lançada manualmente não quita a parcela sozinha", () => {
      const compra = {
        id: "c1",
        description: "Notebook",
        total_amount: 3e3,
        installments_count: 3,
        first_due_date: "2026-08-10",
        paid_count: 0,
        active: true
      };
      const manual = [ {
        id: "t-manual",
        type: "saida",
        description: "Notebook (1/3)",
        amount: 1e3,
        date: "2026-08-10",
        category: "Eletrônicos",
        unallocated: true
      } ];
      esperar(P.saldoDevedor(compra, [])).aSer(3e3);
      const r = window.FinckReconciliador.conferir({
        perfil: {
          id: "u",
          initial_balance: 0
        },
        contas: [],
        transacoes: manual,
        transferencias: [],
        ajustes: [],
        metas: [],
        movimentosMeta: [],
        parcelamentos: [ compra ],
        pagamentos: [],
        ocorrencias: [],
        hoje: "2026-08-16"
      });
      esperar(r.caixa.saldoGlobal).aSer(-1e3);
      esperar(r.compromissos.parcelas).aSer(3e3);
      esperar(r.caixa.fecha).aSerVerdadeiro();
    });
    teste("parcela lançada à mão e depois quitada não conta duas vezes", () => {
      const compra = {
        id: "c1",
        description: "Notebook",
        total_amount: 3e3,
        installments_count: 3,
        first_due_date: "2026-08-10",
        paid_count: 0,
        active: true
      };
      const manual = {
        id: "t-manual",
        type: "saida",
        description: "Notebook (1/3)",
        amount: 1e3,
        date: "2026-08-10",
        unallocated: true,
        category: "Eletrônicos"
      };
      const pelaParcela = {
        id: "t-parcela",
        type: "saida",
        description: "Notebook (1/3)",
        amount: 1e3,
        date: "2026-08-10",
        unallocated: true,
        category: "Eletrônicos",
        source: "parcela"
      };
      const r = window.FinckReconciliador.conferir({
        perfil: {
          id: "u",
          initial_balance: 0
        },
        contas: [],
        transacoes: [ manual, pelaParcela ],
        transferencias: [],
        ajustes: [],
        metas: [],
        movimentosMeta: [],
        parcelamentos: [ compra ],
        pagamentos: [ {
          id: "p1",
          purchase_id: "c1",
          installment_no: 1,
          status: "paga",
          transaction_id: "t-parcela",
          amount: 1e3
        } ],
        ocorrencias: [],
        hoje: "2026-08-16"
      });
      esperar(r.duplicatas.grupos).aSer(1);
      esperar(r.pendencias.some(p => p.kind === "possivel_duplicata")).aSerVerdadeiro();
    });
    teste("parcela estornada volta a contar como compromisso", () => {
      const compra = {
        id: "c1",
        description: "Notebook",
        total_amount: 3e3,
        installments_count: 3,
        first_due_date: "2026-08-10",
        paid_count: 1
      };
      const pagos = [ {
        purchase_id: "c1",
        installment_no: 1,
        status: "aberta",
        transaction_id: null
      } ];
      esperar(P.saldoDevedor(compra, pagos)).aSer(3e3);
    });
  });
  descrever("Concorrência e falha (6.3)", () => {
    const S = window.FinckStore;
    const F = window.FinckFinance;
    const comSessaoLimpa = async fn => {
      const antes = {};
      Object.entries(S.KEYS).forEach(([, v]) => {
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
    teste("dois cliques rápidos no mesmo aporte geram um lançamento só", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 0
        });
        const chave = "clique-duplo";
        await F.aportarMeta(meta.id, 500, "Aporte", {
          chave: chave
        });
        await F.aportarMeta(meta.id, 500, "Aporte", {
          chave: chave
        });
        esperar(await S.listar("transactions")).aTerTamanho(1);
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(500);
      });
    });
    teste("retry depois de timeout devolve o resultado da primeira chamada", async () => {
      await comSessaoLimpa(async () => {
        let execucoes = 0;
        const primeiro = await S.operacao("k1", async () => {
          execucoes++;
          return {
            id: "abc"
          };
        });
        const segundo = await S.operacao("k1", async () => {
          execucoes++;
          return {
            id: "xyz"
          };
        });
        esperar(execucoes).aSer(1);
        esperar(segundo.id).aSer(primeiro.id);
      });
    });
    teste("operação sem chave nunca é deduplicada", async () => {
      await comSessaoLimpa(async () => {
        let execucoes = 0;
        await S.operacao(null, async () => {
          execucoes++;
        });
        await S.operacao(null, async () => {
          execucoes++;
        });
        esperar(execucoes).aSer(2);
      });
    });
    teste("falha ao gravar o movimento não deixa a saída no caixa", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 0
        });
        const original = S.inserir;
        S.inserir = async (tabela, registro) => {
          if (tabela === "goal_movements") {
            throw new Error("queda de rede simulada");
          }
          return original(tabela, registro);
        };
        try {
          await esperar(() => F.aportarMeta(meta.id, 500, "Aporte")).aFalharCom("queda de rede simulada");
        } finally {
          S.inserir = original;
        }
        esperar(await S.listar("transactions")).aTerTamanho(0);
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(0);
      });
    });
    teste("duas abas confirmando ao mesmo tempo geram um lançamento só", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 0
        });
        const chave = "duas-abas";
        await Promise.all([ F.aportarMeta(meta.id, 400, "Aporte", {
          chave: chave
        }), F.aportarMeta(meta.id, 400, "Aporte", {
          chave: chave
        }) ]).catch(() => {});
        const vivas = F.vigentes(await S.listar("transactions"));
        esperar(vivas.length <= 1).aSerVerdadeiro();
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(400);
      });
    });
    teste("refresh no meio da confirmação não duplica ao recarregar", async () => {
      await comSessaoLimpa(async () => {
        const rec = await S.inserir("recurring_transactions", {
          description: "Aluguel",
          type: "saida",
          amount: 1200,
          day_of_month: 6,
          active: true,
          category: "Moradia"
        });
        const [linha] = window.FinckOcorrencias.gerar([ rec ], {
          ciclos: [ "2026-08" ]
        });
        const oc = await S.inserir("recurring_occurrences", linha);
        await window.FinckRevisao.confirmar(oc, 1200, {
          unallocated: true
        });
        await window.FinckRevisao.sincronizar([ rec ]);
        await window.FinckRevisao.sincronizar([ rec ]);
        esperar(F.vigentes(await S.listar("transactions"))).aTerTamanho(1);
        const depois = await S.obter("recurring_occurrences", oc.id);
        esperar(depois.status).aSer("confirmado");
      });
    });
    teste("resposta lenta do banco não vira lançamento duplicado", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 0
        });
        const original = S.inserir;
        S.inserir = async (tabela, registro) => {
          if (tabela === "transactions") {
            await new Promise(r => setTimeout(r, 60));
          }
          return original(tabela, registro);
        };
        try {
          await F.aportarMeta(meta.id, 300, "Aporte", {
            chave: "lento"
          });
          await F.aportarMeta(meta.id, 300, "Aporte", {
            chave: "lento"
          });
        } finally {
          S.inserir = original;
        }
        esperar(F.vigentes(await S.listar("transactions"))).aTerTamanho(1);
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(300);
      });
    });
    teste("erro de permissão não deixa meio-lançamento no caixa", async () => {
      await comSessaoLimpa(async () => {
        const meta = await S.inserir("goals", {
          name: "Reserva",
          target_amount: 6e3,
          current_amount: 0
        });
        const original = S.inserir;
        S.inserir = async (tabela, registro) => {
          if (tabela === "goal_movements") {
            throw new Error('new row violates row-level security policy for table "goal_movements"');
          }
          return original(tabela, registro);
        };
        try {
          await esperar(() => F.aportarMeta(meta.id, 500, "Aporte")).aFalharCom("row-level security");
        } finally {
          S.inserir = original;
        }
        esperar(await S.listar("transactions")).aTerTamanho(0);
        esperar(Number((await S.obter("goals", meta.id)).current_amount)).aSer(0);
      });
    });
    teste("erro de confirmação deixa rastro técnico com contexto", async () => {
      await comSessaoLimpa(async () => {
        await S.registrarEvento({
          scope: "confirmacao",
          message: "timeout simulado",
          context: {
            ocorrencia: "o1",
            ciclo: "2026-08"
          }
        });
        const eventos = await S.listarEventos({
          limite: 5
        });
        esperar(eventos.length >= 1).aSerVerdadeiro();
        esperar(eventos[0].scope).aSer("confirmacao");
        esperar(eventos[0].context.ciclo).aSer("2026-08");
      });
    });
    teste("registrar evento nunca derruba a operação observada", async () => {
      await comSessaoLimpa(async () => {
        const evento = await S.registrarEvento({
          scope: "teste",
          message: null,
          context: undefined
        });
        esperar(typeof evento.created_at).aSer("string");
      });
    });
  });
  descrever("Importação hostil (6.4)", () => {
    const S = window.FinckStore;
    teste("movimento de meta apontando para meta ausente é descartado", () => {
      const r = S.validarImportacao({
        goals: [],
        goal_movements: [ {
          id: "m1",
          goal_id: "inexistente",
          kind: "aporte",
          amount: 100,
          date: "2026-08-10"
        } ]
      });
      esperar(r.linhas.goal_movements).aTerTamanho(0);
      esperar(r.avisos.some(a => a.includes("goal_id"))).aSerVerdadeiro();
    });
    teste("movimento de meta com valor zerado é descartado", () => {
      const r = S.validarImportacao({
        goals: [ {
          id: "g1",
          name: "Reserva",
          target_amount: 1e3
        } ],
        goal_movements: [ {
          id: "m1",
          goal_id: "g1",
          kind: "aporte",
          amount: 0,
          date: "2026-08-10"
        } ]
      });
      esperar(r.linhas.goal_movements).aTerTamanho(0);
    });
    teste("aporte com sinal invertido é recusado", () => {
      const r = S.validarImportacao({
        goals: [ {
          id: "g1",
          name: "Reserva",
          target_amount: 1e3
        } ],
        goal_movements: [ {
          id: "m1",
          goal_id: "g1",
          kind: "aporte",
          amount: -100,
          date: "2026-08-10"
        } ]
      });
      esperar(r.linhas.goal_movements).aTerTamanho(0);
    });
    teste("retirada com sinal positivo é recusada", () => {
      const r = S.validarImportacao({
        goals: [ {
          id: "g1",
          name: "Reserva",
          target_amount: 1e3
        } ],
        goal_movements: [ {
          id: "m1",
          goal_id: "g1",
          kind: "retirada",
          amount: 100,
          date: "2026-08-10"
        } ]
      });
      esperar(r.linhas.goal_movements).aTerTamanho(0);
    });
    teste("movimento de meta válido passa e mantém o vínculo", () => {
      const r = S.validarImportacao({
        goals: [ {
          id: "g1",
          name: "Reserva",
          target_amount: 1e3
        } ],
        goal_movements: [ {
          id: "m1",
          goal_id: "g1",
          kind: "aporte",
          amount: 100,
          date: "2026-08-10"
        } ]
      });
      esperar(r.linhas.goal_movements).aTerTamanho(1);
    });
    teste("parcela com estado desconhecido é descartada", () => {
      const r = S.validarImportacao({
        installment_purchases: [ {
          id: "c1",
          description: "Curso",
          total_amount: 300,
          installments_count: 3,
          installment_amount: 100,
          first_due_date: "2026-08-10"
        } ],
        installment_payments: [ {
          id: "p1",
          purchase_id: "c1",
          installment_no: 1,
          due_date: "2026-08-10",
          amount: 100,
          status: "sei_la"
        } ]
      });
      esperar(r.linhas.installment_payments).aTerTamanho(0);
    });
    teste("parcela estornada é estado válido", () => {
      const r = S.validarImportacao({
        installment_purchases: [ {
          id: "c1",
          description: "Curso",
          total_amount: 300,
          installments_count: 3,
          installment_amount: 100,
          first_due_date: "2026-08-10"
        } ],
        installment_payments: [ {
          id: "p1",
          purchase_id: "c1",
          installment_no: 1,
          due_date: "2026-08-10",
          amount: 100,
          status: "estornada"
        } ]
      });
      esperar(r.linhas.installment_payments).aTerTamanho(1);
    });
    teste("arquivo inválido é recusado antes de gravar qualquer coisa", async () => {
      await esperar(() => S.importarTudo({
        lixo: true
      })).aFalharCom("Arquivo inválido");
    });
    teste("datas impossíveis são descartadas antes de chegar ao banco", () => {
      const r = S.validarImportacao({
        transactions: [ {
          id: "t1",
          type: "saida",
          description: "Impossível",
          amount: 10,
          date: "2026-02-31"
        } ]
      });
      esperar(r.linhas.transactions).aTerTamanho(0);
    });
    teste("campos inventados no backup são removidos", () => {
      const r = S.validarImportacao({
        goals: [ {
          id: "g1",
          name: "Reserva",
          target_amount: 1e3,
          current_amount: 0,
          administrador: true
        } ]
      });
      esperar(r.linhas.goals).aTerTamanho(1);
      esperar(Object.prototype.hasOwnProperty.call(r.linhas.goals[0], "administrador")).aSerFalso();
      esperar(r.avisos.some(a => a.includes("administrador"))).aSerVerdadeiro();
    });
  });
  descrever("Semáforo por prioridade (4.2)", () => {
    const R = window.FinckReality;
    const perfil = {
      income_monthly: 3500,
      work_days_month: 22,
      work_hours_day: 8
    };
    teste("déficit de fixos vem antes de qualquer percentual", () => {
      const r = R.calcular(10, perfil, {
        saldo: 5e4,
        despesasFixas: 4e3
      });
      esperar(r.semaforo.motivo).aSer("deficit_fixos");
      esperar(r.semaforo.nivel).aSer("alerta");
    });
    teste("déficit aparece com sinal, não zerado", () => {
      const r = R.calcular(10, perfil, {
        despesasFixas: 4e3
      });
      esperar(r.sobra_apos_fixos).aSer(-500);
      esperar(r.deficit_fixos).aSer(500);
      esperar(r.renda_livre).aSer(0);
    });
    teste("saldo negativo vem antes do comprometimento da renda livre", () => {
      const r = R.calcular(50, perfil, {
        saldo: 10
      });
      esperar(r.semaforo.motivo).aSer("sem_caixa");
    });
    teste("compra que cabe no caixa mas não no projetado é sinalizada", () => {
      const r = R.calcular(200, perfil, {
        saldo: 1e3,
        compromissosAbertos: 900
      });
      esperar(r.semaforo.motivo).aSer("sem_projetado");
      esperar(r.semaforo.titulo).aConter("déficit projetado");
      esperar(r.disponivel_projetado).aSer(100);
    });
    teste("comprometimento da renda livre vem antes do percentual da renda", () => {
      const r = R.calcular(500, perfil, {
        saldo: 5e4,
        despesasFixas: 2800
      });
      esperar(r.semaforo.motivo).aSer("renda_livre");
      esperar(r.semaforo.nivel).aSer("alerta");
    });
    teste("percentual alto da renda ainda é alerta", () => {
      const r = R.calcular(1500, perfil, {
        saldo: 5e4
      });
      esperar(r.semaforo.motivo).aSer("percentual_renda");
      esperar(r.semaforo.nivel).aSer("alerta");
    });
    teste("compra pequena que pesa na meta recebe atenção, não verde", () => {
      const r = R.calcular(200, perfil, {
        saldo: 5e4,
        metas: [ {
          id: "g",
          name: "Notebook",
          target_amount: 1e3,
          current_amount: 500
        } ]
      });
      esperar(r.semaforo.motivo).aSer("impacto_meta");
      esperar(r.semaforo.nivel).aSer("atencao");
    });
    teste("compra leve sem impacto nenhum fica verde", () => {
      const r = R.calcular(100, perfil, {
        saldo: 5e4
      });
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
      const nomes = Object.values(R.GLOSSARIO).map(g => g.rotulo);
      esperar(new Set(nomes).size).aSer(nomes.length);
    });
  });
  descrever("Leitura do print (FinckPrint)", () => {
    const P = window.FinckPrint;
    const arquivoFalso = (tipo, nome) => ({
      type: tipo,
      name: nome
    });
    teste("print pequeno mantém o tamanho", () => {
      const m = P.medidas(1080, 1920);
      esperar(m.largura).aSer(1080);
      esperar(m.altura).aSer(1920);
    });
    teste("print de celular reduz o lado maior para 2048 sem distorcer", () => {
      const m = P.medidas(1170, 2532);
      esperar(m.altura).aSer(2048);
      esperar(m.largura).aSer(946);
    });
    teste("print largo de computador reduz pela largura", () => {
      const m = P.medidas(3840, 2160);
      esperar(m.largura).aSer(2048);
      esperar(m.altura).aSer(1152);
    });
    teste("reconhece imagem pelo tipo ou pela extensão", () => {
      esperar(P.ehImagem(arquivoFalso("image/png", "print.png"))).aSerVerdadeiro();
      esperar(P.ehImagem(arquivoFalso("", "IMG_0001.HEIC"))).aSerVerdadeiro();
      esperar(P.ehImagem(arquivoFalso("application/pdf", "nota.pdf"))).aSerFalso();
      esperar(P.ehImagem(null)).aSerFalso();
    });
    teste("colar texto continua sendo texto, mesmo com imagem junto", () => {
      const colagem = {
        getData: () => "Fone de ouvido",
        items: [ {
          kind: "file",
          type: "image/png",
          getAsFile: () => "imagem-do-excel"
        } ]
      };
      esperar(P.imagemDaColagem(colagem)).aSer(null);
    });
    teste("colar só a imagem vira print", () => {
      const colagem = {
        getData: () => "",
        items: [ {
          kind: "string",
          type: "text/html"
        }, {
          kind: "file",
          type: "image/png",
          getAsFile: () => "print"
        } ]
      };
      esperar(P.imagemDaColagem(colagem)).aSer("print");
      esperar(P.imagemDaColagem({
        getData: () => "",
        items: []
      })).aSer(null);
    });
    teste("arrastar aceita só imagem", () => {
      const imagem = arquivoFalso("image/jpeg", "produto.jpg");
      esperar(P.imagemDoArraste({
        files: [ arquivoFalso("text/plain", "lista.txt"), imagem ]
      })).aSer(imagem);
      esperar(P.imagemDoArraste({
        files: [ arquivoFalso("text/plain", "lista.txt") ]
      })).aSer(null);
      esperar(P.temArquivo({
        types: [ "Files" ]
      })).aSerVerdadeiro();
      esperar(P.temArquivo({
        types: [ "text/plain" ]
      })).aSerFalso();
    });
    teste("prepara um print alto como JPEG de até 2048 px", async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 3000;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 1200, 3000);
      ctx.fillStyle = "#222";
      ctx.font = "bold 120px sans-serif";
      ctx.fillText("R$ 1.299,90", 80, 1500);
      const png = await new Promise(ok => canvas.toBlob(ok, "image/png"));
      const r = await P.preparar(new File([ png ], "print.png", {
        type: "image/png"
      }));
      esperar(r.altura).aSer(2048);
      esperar(r.largura).aSer(819);
      esperar(r.dataUrl.startsWith("data:image/jpeg;base64,")).aSerVerdadeiro();
      esperar(r.bytes < P.LIMITE_ENVIO_BYTES).aSerVerdadeiro();
    });
    teste("arquivo que não é imagem é recusado antes de enviar", async () => {
      await esperar(() => P.preparar(new File([ "oi" ], "nota.txt", {
        type: "text/plain"
      }))).aFalharCom("não é uma imagem");
    });
  });
  descrever("Impacto ambiental (FinckImpacto)", () => {
    const I = window.FinckImpacto;
    const celular = {
      carbono: {
        min: 50,
        max: 90
      },
      vidaUtilMeses: {
        min: 36,
        max: 60
      },
      fracaoFabricacao: .8
    };
    teste("por mês de uso, valem os meses que a pessoa espera", () => {
      const c = I.calcular(celular, {
        mesesDeUso: 24
      });
      esperar(c.porMes.valor).aSer(2.9);
      esperar(c.porMes.meses).aSer(24);
      esperar(c.porMes.daPessoa).aSerVerdadeiro();
    });
    teste("sem os meses da pessoa, vale a vida útil típica", () => {
      const c = I.calcular(celular);
      esperar(c.porMes.valor).aSer(1.5);
      esperar(c.porMes.meses).aSer(48);
      esperar(c.porMes.daPessoa).aSerFalso();
    });
    teste("a quantidade multiplica carbono e água", () => {
      const c = I.calcular({
        carbono: {
          min: 5,
          max: 15
        },
        agua: {
          min: 2e3,
          max: 4e3
        }
      }, {
        quantidade: 3
      });
      esperar(c.carbono.min).aSer(15);
      esperar(c.carbono.max).aSer(45);
      esperar(c.agua.max).aSer(12e3);
      esperar(c.quantidade).aSer(3);
    });
    teste("comprar usado evita a fração da fabricação", () => {
      const c = I.calcular(celular);
      esperar(c.evitavelUsado.min).aSer(40);
      esperar(c.evitavelUsado.max).aSer(72);
      esperar(c.evitavelUsado.percentual).aSer(80);
    });
    teste("sem fração de fabricação, a conta do usado não aparece", () => {
      esperar(I.calcular({
        carbono: {
          min: 1,
          max: 2
        }
      }).evitavelUsado).aSer(null);
    });
    teste("duração em meses abaixo de dois anos e em anos acima", () => {
      esperar(I.formatarDuracao({
        min: 6,
        max: 18
      })).aSer("6 a 18 meses");
      esperar(I.formatarDuracao({
        min: 36,
        max: 60
      })).aSer("3 a 5 anos");
      esperar(I.formatarDuracao({
        min: 8,
        max: 36
      })).aSer("8 meses a 3 anos");
      esperar(I.formatarDuracao({
        min: 18,
        max: 30
      })).aSer("1,5 a 2,5 anos");
    });
    teste("carbono em kg, e em toneladas a partir de mil kg", () => {
      esperar(I.formatarCarbono({
        min: 50,
        max: 90
      })).aSer("50 a 90 kg de CO₂e");
      esperar(I.formatarCarbono({
        min: .84,
        max: 1.3
      })).aSer("0,84 a 1,3 kg de CO₂e");
      esperar(I.formatarCarbono({
        min: 1500,
        max: 3e3
      })).aSer("1,5 a 3 t de CO₂e");
    });
  });
  descrever("Reality: categoria, tempo, síntese e comparação (UX)", () => {
    const R = window.FinckReality;
    const perfil = {
      income_monthly: 3520,
      work_days_month: 22,
      work_hours_day: 8
    };
    teste("categoria sugerida pelo nome do item", () => {
      esperar(R.inferirCategoria("iPhone 17")).aSer("Eletrônicos");
      esperar(R.inferirCategoria("Tênis de corrida")).aSer("Vestuário");
      esperar(R.inferirCategoria("Passagem de ônibus")).aSer("Transporte");
      esperar(R.inferirCategoria("Curso de inglês")).aSer("Educação");
    });
    teste("palavra com acento no começo também é reconhecida", () => {
      esperar(R.inferirCategoria("Óculos de grau")).aSer("Saúde");
      esperar(R.inferirCategoria("ônibus")).aSer("Transporte");
    });
    teste("item vago fica sem categoria sugerida", () => {
      esperar(R.inferirCategoria("coisa aleatória")).aSer(null);
      esperar(R.inferirCategoria("")).aSer(null);
      esperar(R.inferirCategoria("pcs")).aSer(null);
    });
    teste("tempo de trabalho em horas e minutos", () => {
      esperar(R.formatarTempo(37 + 1 / 3, 8).horas).aSer("37 h 20 min");
      esperar(R.formatarTempo(.5, 8).horas).aSer("30 min");
      esperar(R.formatarTempo(40, 8).horas).aSer("40 h");
    });
    teste("tempo de trabalho em dias da jornada da pessoa", () => {
      esperar(R.formatarTempo(37 + 1 / 3, 8).dias).aSer("4 dias e 5 h");
      esperar(R.formatarTempo(8, 8).dias).aSer("1 dia");
      esperar(R.formatarTempo(12, 6).dias).aSer("2 dias");
    });
    teste("síntese diz quando a compra não cabe no saldo", () => {
      const r = R.calcular(5e3, perfil, {
        saldo: 1e3,
        despesasFixas: 1500
      });
      esperar(R.sintese(r).frase).aConter("Não cabe no seu saldo atual");
      esperar(R.sintese(r).rotulo_impacto).aSer("Impacto alto");
    });
    teste("síntese diz quanto da sobra a compra consome", () => {
      const r = R.calcular(500, perfil, {
        saldo: 1e4,
        despesasFixas: 1520
      });
      const s = R.sintese(r);
      esperar(s.frase).aConter("25% do que sobra depois dos fixos");
      esperar(s.sobra_depois).aSerPerto(1500, 2);
      esperar(s.frase_sobra).aConter("ainda sobram");
    });
    teste("semáforo vira rótulo de impacto, não de certo ou errado", () => {
      esperar(R.ROTULO_IMPACTO.verde).aSer("Impacto baixo");
      esperar(R.ROTULO_IMPACTO.atencao).aSer("Impacto moderado");
      esperar(R.ROTULO_IMPACTO.alerta).aSer("Impacto alto");
    });
    teste("comparar: o barato pode custar mais por mês de uso", () => {
      const iphone = R.calcular(5e3, perfil, {
        saldo: 2e4,
        mesesDeUso: 36
      });
      const samsung = R.calcular(3500, perfil, {
        saldo: 2e4,
        mesesDeUso: 24
      });
      const c = R.comparar({
        nome: "iPhone",
        resultado: iphone
      }, {
        nome: "Samsung",
        resultado: samsung
      });
      esperar(c.mais_barata).aSer("Samsung");
      esperar(c.economia).aSerPerto(1500, 2);
      esperar(c.compara_uso).aSerVerdadeiro();
      esperar(c.melhor_por_mes).aSer("iPhone");
      esperar(c.inverte).aSerVerdadeiro();
    });
    teste("comparar sem vida útil não inventa custo por mês", () => {
      const a = R.calcular(100, perfil, {});
      const b = R.calcular(80, perfil, {});
      const c = R.comparar({
        nome: "A",
        resultado: a
      }, {
        nome: "B",
        resultado: b
      });
      esperar(c.compara_uso).aSerFalso();
      esperar(c.melhor_por_mes).aSer(null);
    });
    teste("o que mudou ao refazer a conta do mesmo item", () => {
      const antes = R.calcular(5499, perfil, {
        mesesDeUso: 36
      });
      const agora = R.calcular(4999, perfil, {
        mesesDeUso: 36
      });
      const m = R.oQueMudou(antes, agora);
      esperar(m.map(x => x.campo).join(",")).aSer("preco,horas,por_mes");
      esperar(R.oQueMudou(antes, antes)).aTerTamanho(0);
    });
  });
  descrever("Metas: ritmo de aportes e atraso de uma compra", () => {
    const M = window.FinckMetas;
    const R = window.FinckReality;
    const hoje = new Date("2026-10-15T12:00:00");
    const mov = (goal_id, date, amount) => ({
      goal_id: goal_id,
      date: date,
      amount: amount,
      kind: amount >= 0 ? "aporte" : "retirada"
    });
    const movimentos = [ mov("n", "2026-08-01", 300), mov("n", "2026-09-01", 300), mov("n", "2026-10-01", 300), mov("n", "2026-03-01", 5e3), mov("x", "2026-10-01", 999) ];
    teste("ritmo mensal usa só os últimos 90 dias e só a própria meta", () => {
      esperar(M.ritmoMensal(movimentos, "n", {
        hoje: hoje
      })).aSerPerto(300, 2);
    });
    teste("retirada desconta do ritmo", () => {
      esperar(M.ritmoMensal([ ...movimentos, mov("n", "2026-10-10", -600) ], "n", {
        hoje: hoje
      })).aSerPerto(100, 2);
    });
    teste("prazo da meta vira valor necessário por mês", () => {
      const meta = {
        target_amount: 3e3,
        current_amount: 1800,
        deadline: "2027-04-13"
      };
      esperar(M.necessarioPorMes(meta, {
        hoje: hoje
      })).aSerPerto(200, 0);
      esperar(M.necessarioPorMes({
        ...meta,
        deadline: null
      }, {
        hoje: hoje
      })).aSer(null);
    });
    teste("compra vira atraso em dias pelo ritmo real", () => {
      const r = R.calcular(600, {
        income_monthly: 3520,
        work_days_month: 22,
        work_hours_day: 8
      }, {
        metas: [ {
          id: "n",
          name: "Notebook",
          target_amount: 5e3,
          current_amount: 900
        } ],
        movimentosMeta: movimentos,
        hoje: hoje
      });
      const m = r.impacto_metas[0];
      esperar(m.base_atraso).aSer("ritmo");
      esperar(m.atraso_dias).aSerPerto(60, 0);
      esperar(m.progresso).aSerPerto(18, 0);
    });
    teste("sem aporte e sem prazo, o atraso fica em dias de trabalho", () => {
      const r = R.calcular(600, {
        income_monthly: 3520,
        work_days_month: 22,
        work_hours_day: 8
      }, {
        metas: [ {
          id: "z",
          name: "Viagem",
          target_amount: 5e3,
          current_amount: 0
        } ],
        movimentosMeta: [],
        hoje: hoje
      });
      esperar(r.impacto_metas[0].base_atraso).aSer("trabalho");
      esperar(r.impacto_metas[0].atraso_dias).aSer(null);
      esperar(r.impacto_metas[0].dias_trabalho_extra).aSerPerto(3.75, 2);
    });
  });
  descrever("Assistente: diagnóstico da vida financeira (FinckDiagnostico)", () => {
    const D = window.FinckDiagnostico;
    const hoje = new Date("2026-10-15T12:00:00");
    const t = (date, type, amount, extra = {}) => ({
      date: date,
      type: type,
      amount: amount,
      description: "Lançamento XPTO-PRIVADO",
      ...extra
    });
    const base = (extra = {}) => ({
      perfil: {
        income_monthly: 4e3,
        income_type: "fixa"
      },
      transacoesRealizadas: [ t("2026-09-05", "entrada", 4e3), t("2026-09-10", "saida", 1500, {
        category: "Moradia"
      }), t("2026-09-20", "saida", 800, {
        category: "Alimentação"
      }), t("2026-09-25", "saida", 400, {
        goal_id: "m1"
      }), t("2026-08-05", "entrada", 4e3), t("2026-08-10", "saida", 1500, {
        category: "Moradia"
      }), t("2026-08-20", "saida", 500, {
        category: "Alimentação"
      }) ],
      despesasFixas: 1500,
      saldo: 9e3,
      compromissosAbertos: 0,
      disponivelProjetado: 9e3,
      metas: [],
      movimentosMeta: [],
      parcelamentos: [],
      analises: [],
      ...extra
    });
    const dim = (d, id) => d.dimensoes.find(x => x.id === id);
    teste("janela usa os meses completos com movimento, do mais recente", () => {
      const j = D.janelaDeMeses(base().transacoesRealizadas, hoje, 3);
      esperar(j.meses.join(",")).aSer("2026-09,2026-08");
      esperar(j.parcial).aSerFalso();
    });
    teste("sem mês completo, vale o mês atual marcado como parcial", () => {
      const j = D.janelaDeMeses([ t("2026-10-02", "saida", 50) ], hoje, 3);
      esperar(j.meses.join(",")).aSer("2026-10");
      esperar(j.parcial).aSerVerdadeiro();
    });
    teste("dinheiro guardado em meta não conta como gasto", () => {
      const d = D.diagnosticar(base(), {
        hoje: hoje
      });
      esperar(d.retrato.media_gastos).aSerPerto(2150, 2);
      esperar(d.retrato.media_aportes).aSerPerto(200, 2);
      esperar(d.retrato.taxa_poupanca).aSerPerto(46.25, 2);
    });
    teste("tendência compara o último mês com a média dos anteriores", () => {
      const d = D.diagnosticar(base(), {
        hoje: hoje
      });
      const alim = d.retrato.categorias.find(c => c.nome === "Alimentação");
      esperar(alim.tendencia_pct).aSerPerto(60, 2);
    });
    teste("fluxo saudável até 50% da renda em fixos", () => {
      const f = dim(D.diagnosticar(base(), {
        hoje: hoje
      }), "fluxo");
      esperar(f.nivel).aSer("saudavel");
      esperar(f.nota).aSer(100);
    });
    teste("fixos acima da renda deixam o fluxo crítico", () => {
      const f = dim(D.diagnosticar(base({
        despesasFixas: 4200
      }), {
        hoje: hoje
      }), "fluxo");
      esperar(f.nivel).aSer("critico");
    });
    teste("reserva em meses de custo fixo, somando metas de reserva", () => {
      const d = D.diagnosticar(base({
        saldo: 1500,
        metas: [ {
          id: "r",
          name: "Reserva de emergência",
          target_amount: 9e3,
          current_amount: 3e3
        } ]
      }), {
        hoje: hoje
      });
      esperar(d.retrato.reserva_meses).aSerPerto(3, 2);
      esperar(dim(d, "reserva").nivel).aSer("atencao");
    });
    teste("parcelas acima de 30% da renda são críticas", () => {
      const parcelamentos = [ {
        active: true,
        paid_count: 1,
        installments_count: 10,
        installment_amount: 1400
      } ];
      esperar(dim(D.diagnosticar(base({
        parcelamentos: parcelamentos
      }), {
        hoje: hoje
      }), "compromissos").nivel).aSer("critico");
      parcelamentos[0].installment_amount = 800;
      esperar(dim(D.diagnosticar(base({
        parcelamentos: parcelamentos
      }), {
        hoje: hoje
      }), "compromissos").nivel).aSer("atencao");
    });
    teste("compromissos maiores que o saldo tornam a dimensão crítica", () => {
      esperar(dim(D.diagnosticar(base({
        compromissosAbertos: 12e3,
        disponivelProjetado: -3e3
      }), {
        hoje: hoje
      }), "compromissos").nivel).aSer("critico");
    });
    teste("sem renda: dimensão sem dados e prioridade de informar a renda", () => {
      const d = D.diagnosticar(base({
        perfil: {}
      }), {
        hoje: hoje
      });
      esperar(dim(d, "fluxo").nivel).aSer("sem_dados");
      esperar(d.prioridades[0].titulo).aSer("Informar a sua renda mensal");
    });
    teste("índice ignora as dimensões sem dados", () => {
      const d = D.diagnosticar(base(), {
        hoje: hoje
      });
      const p = window.FINCK_CONFIG.DIAGNOSTICO.PESOS;
      const com = d.dimensoes.filter(x => x.nota !== null);
      const esperado = com.reduce((s, x) => s + x.nota * p[x.id], 0) / com.reduce((s, x) => s + p[x.id], 0);
      esperar(d.indice).aSer(Math.round(esperado));
      esperar(dim(d, "metas").nivel).aSer("sem_dados");
    });
    teste("meta de reserva atrasada não repete a prioridade da reserva", () => {
      const d = D.diagnosticar(base({
        saldo: 0,
        metas: [ {
          id: "r",
          name: "Reserva de emergência",
          target_amount: 9e3,
          current_amount: 100,
          deadline: "2027-01-01"
        } ]
      }), {
        hoje: hoje
      });
      const sobreReserva = d.prioridades.filter(x => /reserva/i.test(x.titulo));
      esperar(sobreReserva).aTerTamanho(1);
    });
    teste("o retrato para a IA não leva descrição de lançamento", () => {
      const ia = JSON.stringify(D.paraIA(D.diagnosticar(base(), {
        hoje: hoje
      })));
      esperar(ia.includes("XPTO-PRIVADO")).aSerFalso();
      esperar(ia.includes("description")).aSerFalso();
      esperar(ia).aConter("\"renda_mensal\":4000");
    });
    teste("plano por regras: no máximo 4 passos e meta que cabe na sobra", () => {
      const d = D.diagnosticar(base({
        saldo: 1500
      }), {
        hoje: hoje
      });
      const p = D.planoLocal(d);
      esperar(p.origem).aSer("regras");
      esperar(p.prioridades.length <= 4).aSerVerdadeiro();
      const folga = d.retrato.base_renda - d.retrato.media_gastos;
      esperar(p.metas_sugeridas.every(m => m.valor_mensal <= folga)).aSerVerdadeiro();
    });
  });
  async function rodar(aoAtualizar) {
    const resultado = {
      total: 0,
      passou: 0,
      falhou: 0,
      suites: []
    };
    for (const suite of suites) {
      const r = {
        nome: suite.nome,
        casos: []
      };
      for (const caso of suite.casos) {
        resultado.total++;
        try {
          await caso.fn();
          r.casos.push({
            nome: caso.nome,
            ok: true
          });
          resultado.passou++;
        } catch (e) {
          r.casos.push({
            nome: caso.nome,
            ok: false,
            erro: e.message
          });
          resultado.falhou++;
        }
        if (aoAtualizar) {
          aoAtualizar(resultado);
        }
      }
      resultado.suites.push(r);
    }
    return resultado;
  }
  return {
    rodar: rodar,
    suites: suites
  };
})();
