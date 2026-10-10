// FinCK of Reality: a revelação (cadeia do preço ao impacto), o que a tela
// diz depois de salvar e o histórico como aprendizado. As contas do motor
// estão em js/testes.js; aqui ficam as funções que viram texto na tela.
(() => {
  const { descrever, teste, esperar } = window.FinckTestes;
  const R = window.FinckReality;
  const cfg = window.FINCK_CONFIG;
  const hoje = new Date(2026, 9, 8);
  // Renda 3.500 em 22 dias de 8 h: a hora vale cerca de R$ 19,89.
  const perfil = { income_monthly: 3500, work_days_month: 22, work_hours_day: 8 };
  const meta = { id: "m1", name: "PC novo", target_amount: 5000, current_amount: 2100, deadline: null };
  // Aporte de R$ 500 por mês nos últimos 90 dias.
  const movimentos = [ 1, 2, 3 ].map(i => ({ goal_id: "m1", type: "aporte", amount: 500, date: new Date(2026, 9, 8 - i * 25).toISOString().slice(0, 10) }));
  const calcular = (preco, extra = {}) => R.calcular(preco, perfil, { saldo: 5000, despesasFixas: 1500, hoje: hoje, ...extra });
  // Consultor, não juiz: nenhuma frase manda, proíbe ou elogia a compra.
  const JULGAMENTOS = [ "não compre", "não deve comprar", "compra ruim", "ótima compra", "boa compra", "compre agora" ];
  const semJulgamento = textos => textos.every(t => JULGAMENTOS.every(j => !String(t).toLowerCase().includes(j)));
  const semTravessao = textos => textos.every(t => !String(t).includes("\u2014"));

  descrever("Reality: a revelação, do preço ao impacto (UX)", () => {
    teste("a cadeia vai do preço às horas, aos dias e ao peso no mês", () => {
      const c = R.cadeiaDoImpacto(calcular(4000), { horasPorDia: 8 });
      esperar(c.passos.map(p => p.id).join(",")).aSer("preco,horas,dias,mes");
      esperar(c.passos[0].valor).aConter("4.000,00");
      esperar(c.passos[1].rotulo).aSer("do seu trabalho");
      esperar(c.horas).aSerPerto(4000 / (3500 / 22 / 8), 2);
      esperar(c.passos[2].rotulo).aConter("jornada de 8 h por dia");
      esperar(c.meta).aSer(null);
    });
    teste("o peso no mês usa a sobra depois dos fixos e vira meses acima de 100%", () => {
      const pouco = R.cadeiaDoImpacto(calcular(400), { horasPorDia: 8 });
      esperar(pouco.base_mes).aSer("sobra");
      esperar(pouco.percentual_mes).aSerPerto(20, 2);
      esperar(pouco.passos.find(p => p.id === "mes").valor).aSer("20%");
      esperar(pouco.passos.find(p => p.id === "mes").rotulo).aConter("renda menos despesas fixas");
      const muito = R.cadeiaDoImpacto(calcular(4000), { horasPorDia: 8 });
      esperar(muito.passos.find(p => p.id === "mes").valor).aSer("2 meses");
      const umMes = R.cadeiaDoImpacto(calcular(2000), { horasPorDia: 8 });
      esperar(umMes.passos.find(p => p.id === "mes").valor).aSer("1 mês");
    });
    teste("sem sobra depois dos fixos, o peso é sobre a renda do mês", () => {
      const r = R.calcular(700, perfil, { saldo: 5000, despesasFixas: 3600, hoje: hoje });
      const c = R.cadeiaDoImpacto(r, { horasPorDia: 8 });
      esperar(c.base_mes).aSer("renda");
      esperar(c.passos.find(p => p.id === "mes").rotulo).aSer("da sua renda do mês");
    });
    teste("compra de menos de um dia de trabalho não repete as horas como dias", () => {
      const c = R.cadeiaDoImpacto(calcular(50), { horasPorDia: 8 });
      esperar(c.passos.some(p => p.id === "dias")).aSerFalso();
      esperar(c.tempo.dias_inteiros).aSer(0);
    });
    teste("com quantidade, a cadeia usa o total e diz quantas unidades", () => {
      const c = R.cadeiaDoImpacto(calcular(300, { quantidade: 3 }), { horasPorDia: 8 });
      esperar(c.total).aSer(900);
      esperar(c.passos[0].valor).aConter("900,00");
      esperar(c.passos[0].rotulo).aConter("3 unidades de");
      esperar(c.horas).aSerPerto(900 / (3500 / 22 / 8), 2);
    });
    teste("com quantidade 3, semáforo, síntese e saldo depois também usam o total", () => {
      const tres = calcular(300, { quantidade: 3 });
      const um = calcular(900);
      esperar(tres.price).aSer(300);
      esperar(tres.total).aSer(900);
      esperar(tres.saldo_depois).aSer(5000 - 900);
      esperar(tres.work_hours).aSerPerto(um.work_hours, 6);
      esperar(tres.income_percent).aSerPerto(um.income_percent, 6);
      esperar(tres.semaforo.nivel).aSer(um.semaforo.nivel);
      esperar(R.sintese(tres).frase).aSer(R.sintese(um).frase);
      esperar(R.sintese(tres).sobra_depois).aSerPerto(R.sintese(um).sobra_depois, 2);
      // Gravado: preço da unidade e quantidade; horas e saldo sobre o total.
      const reg = R.paraRegistro({ item_name: "Pneu", price: 300, quantity: 3, resultado: tres, perfil: perfil });
      esperar(reg.price).aSer(300);
      esperar(reg.quantity).aSer(3);
      esperar(reg.balance_after).aSer(4100);
      esperar(reg.work_hours).aSerPerto(um.work_hours, 2);
      esperar(R.valorTotal(reg)).aSer(900);
    });
    // Sem folga fora das metas (o saldo é só um mês de fixos e a sobra do mês
    // vai toda para o dia a dia), a compra inteira sai do que iria para a meta.
    const semFolga = { saldo: 1500, diaADia: 2000 };
    teste("a meta entra pelo ritmo de aportes, marcada como estimativa", () => {
      const r = calcular(1500, { ...semFolga, metas: [ meta ], movimentosMeta: movimentos });
      const c = R.cadeiaDoImpacto(r, { horasPorDia: 8 });
      const passo = c.passos.find(p => p.id === "meta");
      esperar(Boolean(passo)).aSerVerdadeiro();
      esperar(passo.estimativa).aSer(true);
      esperar(passo.rotulo).aSer("no prazo da meta “PC novo”");
      esperar(c.meta.base).aSer("ritmo");
      // 1.500 / 500 por mês = 3 meses = 90 dias.
      esperar(c.meta.dias).aSerPerto(90, 1);
      esperar(passo.valor).aSer("+3 meses");
    });
    teste("sem ritmo nem prazo, a meta não ganha atraso inventado", () => {
      const r = calcular(1500, { metas: [ meta ], movimentosMeta: [] });
      const c = R.cadeiaDoImpacto(r, { horasPorDia: 8 });
      esperar(c.meta).aSer(null);
      esperar(c.passos.some(p => p.id === "meta")).aSerFalso();
    });
    teste("o selo de impacto é o mesmo rótulo da síntese", () => {
      const r = calcular(4000);
      esperar(R.cadeiaDoImpacto(r).rotulo_impacto).aSer(R.sintese(r).rotulo_impacto);
      esperar(R.cadeiaDoImpacto(calcular(50)).rotulo_impacto).aSer("Impacto baixo");
    });
    teste("prazos em calendário: dias até 45, depois meses", () => {
      esperar(R.textoDuracao(1)).aSer("1 dia");
      esperar(R.textoDuracao(18.4)).aSer("18 dias");
      esperar(R.textoDuracao(75)).aSer("2,5 meses");
      esperar(R.textoDuracao(630)).aSer("21 meses");
      esperar(R.textoDuracao(180)).aSer("6 meses");
    });
    teste("o que cabe na folga fora das metas não atrasa a meta", () => {
      const r = calcular(1500, { metas: [ meta ], movimentosMeta: movimentos });
      // Saldo 5.000, fixos 1.500: 3.500 acima da reserva cobrem a compra.
      esperar(r.folga_fora_metas >= 1500).aSerVerdadeiro();
      esperar(r.parte_das_metas).aSer(0);
      esperar(R.cadeiaDoImpacto(r, { horasPorDia: 8 }).meta).aSer(null);
      esperar(r.impacto_metas[0].atraso_dias).aSer(0);
      esperar(R.textoAtraso(r.impacto_metas[0].atraso_dias)).aSer("sem atraso");
    });
    teste("parte das metas: agora, depois de esperar e parcelado pela mesma conta", () => {
      const regra = { folgaHoje: 300, sobraExtra: 200 };
      esperar(R.parteDasMetas([ { mes: 0, valor: 1000 } ], regra)).aSer(700);
      esperar(R.parteDasMetas([ { mes: 2, valor: 1000 } ], regra)).aSer(300);
      // 4 parcelas de 250: a pior hora é a última (1.000 pagos, 300 + 3 × 200 de folga).
      const parcelas = [ 0, 1, 2, 3 ].map(m => ({ mes: m, valor: 250 }));
      esperar(R.parteDasMetas(parcelas, regra)).aSer(100);
      esperar(R.parteDasMetas(parcelas, { folgaHoje: 300, sobraExtra: 300 })).aSer(0);
      esperar(R.atrasoDias(300, { falta: 1000, aporte_mensal: 100 })).aSer(90);
      esperar(R.atrasoDias(300, { falta: 1000, aporte_mensal: 0 })).aSer(null);
      esperar(R.folgaForaDasMetas({ saldoAposParcelas: 2000, despesasFixas: 1500, sobraForaDasMetas: 400 })).aSer(900);
      esperar(R.folgaForaDasMetas({ saldoAposParcelas: 300, despesasFixas: 1500, sobraForaDasMetas: 400 })).aSer(300);
    });
    teste("o ritmo que o prazo pede é o mesmo do cartão em Metas", () => {
      // Prazo em 8/jun/2027, hoje 8/out/2026: 8 meses de calendário, como
      // em Metas ("R$ 562,50/mês por 8 meses"), não 243 dias / 30.
      const comPrazo = { ...meta, target_amount: 6600, current_amount: 2100, deadline: "2027-06-08" };
      esperar(window.FinckMetas.necessarioPorMes(comPrazo, { hoje: hoje })).aSer(562.5);
      const r = calcular(800, { metas: [ comPrazo ], movimentosMeta: [] });
      esperar(r.impacto_metas[0].aporte_mensal).aSer(562.5);
      esperar(r.impacto_metas[0].base_atraso).aSer("prazo");
      esperar(r.aportes_metas).aSer(562.5);
      // No mês do prazo já não há mês inteiro pela frente: sem valor a pedir.
      esperar(window.FinckMetas.necessarioPorMes({ ...comPrazo, deadline: "2026-10-30" }, { hoje: hoje })).aSer(null);
    });
    teste("horas de trabalho acima de mil com separador de milhar", () => {
      esperar(R.formatarTempo(4520 + 41 / 60, 8).horas).aSer("4.520 h 41 min");
      esperar(R.formatarTempo(8000, 8).dias).aSer("1.000 dias");
      esperar(R.formatarTempo(37 + 1 / 3, 8).horas).aSer("37 h 20 min");
    });
    teste("um formato só para o atraso, sem casa decimal à toa", () => {
      esperar(R.textoAtraso(null)).aSer("sem estimativa de prazo");
      esperar(R.textoAtraso(.3)).aSer("sem atraso");
      esperar(R.textoAtraso(12)).aSer("+12 dias");
      esperar(R.textoAtraso(540)).aSer("+18 meses");
      esperar(R.textoAtraso(462)).aSer("+15 meses");
      esperar(R.textoAtraso(75)).aSer("+2,5 meses");
    });
    teste("os textos da cadeia não julgam e não têm travessão", () => {
      const r = calcular(1500, { ...semFolga, metas: [ meta ], movimentosMeta: movimentos });
      const c = R.cadeiaDoImpacto(r, { horasPorDia: 8 });
      const textos = c.passos.flatMap(p => [ p.valor, p.rotulo ]).concat(R.sintese(r).frase, r.semaforo.titulo, r.semaforo.texto);
      esperar(semJulgamento(textos)).aSerVerdadeiro();
      esperar(semTravessao(textos)).aSerVerdadeiro();
    });
  });

  descrever("Reality: o que acontece ao salvar a decisão (UX)", () => {
    teste("comprar diz o valor que entrou no extrato e a categoria", () => {
      const c = R.confirmacaoRegistro({ decisao: "comprar", total: 3000, categoria: "Eletrônicos" });
      esperar(c.titulo).aSer("Compra registrada.");
      esperar(c.lancou_no_extrato).aSer(true);
      esperar(c.linhas[0]).aConter("3.000,00");
      esperar(c.linhas[0]).aConter("adicionados ao seu extrato como saída");
      esperar(c.linhas[0]).aConter("na categoria Eletrônicos");
    });
    teste("com meta afetada, diz que o valor guardado continua o mesmo", () => {
      const c = R.confirmacaoRegistro({ decisao: "comprar", total: 3000, meta: { nome: "PC novo", atual: 2100, dias: 23 } });
      esperar(c.linhas[1]).aConter("continua com");
      esperar(c.linhas[1]).aConter("2.100,00");
      esperar(c.linhas[1]).aConter("+23 dias");
      // O código não mexe nas metas: a tela não pode dizer que mexeu.
      esperar(c.linhas.join(" ").includes("atualizada")).aSerFalso();
    });
    teste("trocar a decisão depois da compra diz o que houve com a saída", () => {
      const estorno = R.confirmacaoRegistro({ decisao: "desistir", total: 800, saidaAnterior: { valor: 800, estornada: true } });
      esperar(estorno.linhas[0].includes("Nada foi lançado")).aSerFalso();
      esperar(estorno.linhas[0]).aConter("estornada");
      esperar(estorno.estornou).aSer(true);
      const deNovo = R.confirmacaoRegistro({ decisao: "comprar", total: 800, saidaAnterior: { valor: 800, jaLancada: true } });
      esperar(deNovo.linhas[0]).aConter("já estava no seu extrato");
      esperar(deNovo.linhas[0].includes("adicionados")).aSerFalso();
    });
    teste("esperar e não comprar não lançam nada no extrato", () => {
      [ "adiar", "desistir", "alternativa", "usado", "reparar" ].forEach(id => {
        const c = R.confirmacaoRegistro({ decisao: id, total: 500 });
        esperar(c.titulo).aSer("Decisão salva.");
        esperar(c.lancou_no_extrato).aSer(false);
        esperar(c.linhas[0]).aSer("Nada foi lançado no extrato.");
      });
      esperar(R.confirmacaoRegistro({ decisao: "adiar" }).linhas.join(" ")).aConter("30 dias");
    });
  });

  descrever("Reality: o histórico como aprendizado (UX)", () => {
    const analises = [
      { price: 1000, quantity: 2, decision: "comprar" },
      { price: 500, decision: "adiar" },
      { price: 800, decision: "adiar" },
      { price: 300, decision: "desistir" },
      { price: 200, decision: "usado" },
      { price: 150, decision: null }
    ];
    teste("conta compras, valor avaliado e cada tipo de decisão", () => {
      const r = R.resumoHistorico(analises);
      esperar(r.total).aSer(6);
      esperar(r.valor_avaliado).aSer(2000 + 500 + 800 + 300 + 200 + 150);
      esperar(r.adiadas).aSer(2);
      esperar(r.descartadas).aSer(1);
      esperar(r.com_alternativa).aSer(1);
      esperar(r.realizadas).aSer(1);
      esperar(r.sem_decisao).aSer(1);
      esperar(r.diferentes_de_comprar).aSer(4);
    });
    teste("os campos antigos do resumo continuam iguais", () => {
      const r = R.resumoHistorico(analises);
      esperar(r.decididas).aSer(5);
      esperar(r.evitadas).aSer(4);
      esperar(r.compras).aSer(1);
      esperar(r.valor_potencial).aSer(500 + 800 + 300 + 200);
    });
    teste("a frase conta só decisões salvas diferentes de comprar na hora", () => {
      esperar(R.fraseHistorico(R.resumoHistorico(analises))).aSer("O FinCK ajudou você a tomar 4 decisões diferentes de comprar na hora.");
      esperar(R.fraseHistorico(R.resumoHistorico([ { price: 10, decision: "adiar" } ]))).aConter("1 decisão diferente");
      esperar(R.fraseHistorico(R.resumoHistorico([]))).aSer("Você ainda não analisou nenhuma compra.");
      esperar(R.fraseHistorico(R.resumoHistorico([ { price: 10, decision: null } ]))).aConter("Nenhuma análise tem decisão salva");
      const soCompras = R.fraseHistorico(R.resumoHistorico([ { price: 10, decision: "comprar" } ]));
      esperar(soCompras).aConter("comprar na hora");
      esperar(semJulgamento([ soCompras ])).aSerVerdadeiro();
    });
    teste("a frase acompanha as decisões que existem no config", () => {
      const ids = cfg.DECISOES.map(d => d.id);
      esperar(ids.includes("comprar") && ids.includes("adiar") && ids.includes("desistir")).aSerVerdadeiro();
    });
  });

  descrever("Reality: os mesmos nomes da página inicial (UX)", () => {
    const PROIBIDAS = /disponível projetado|pode sobrar depois dos compromissos|déficit projetado/i;
    teste("nenhum texto do Reality usa \"disponível projetado\"", async () => {
      const casos = [
        calcular(800),
        calcular(6000),
        R.calcular(200, perfil, { saldo: 1000, compromissosAbertos: 900, hoje: hoje }),
        R.calcular(800, perfil, { saldo: 2880, despesasFixas: 1354, caixa60: -448, menorCaixa60: 600, hoje: hoje })
      ];
      const textos = casos.flatMap(r => [ R.sintese(r).frase, r.semaforo.titulo, r.semaforo.texto ]);
      Object.values(R.GLOSSARIO).forEach(g => textos.push(g.rotulo, g.definicao, g.referencia));
      esperar(textos.some(t => PROIBIDAS.test(t))).aSerFalso();
      const arquivos = [ "reality.html", "js/reality-page.js", "js/inteligencia-engine.js", "js/inteligencia.js", "js/linha-tempo.js" ];
      for (const arq of arquivos) {
        const fonte = await fetch(arq, { cache: "no-store" }).then(r => r.text());
        esperar(`${arq}: ${PROIBIDAS.test(fonte)}`).aSer(`${arq}: false`);
      }
    });
    teste("contas já previstas: cabe hoje, mas o caixa dos 60 dias ficaria negativo", () => {
      const r = R.calcular(800, perfil, { saldo: 2880, despesasFixas: 1354, caixa60: -448, menorCaixa60: 600, hoje: hoje });
      esperar(r.compromete_saldo).aSerFalso();
      esperar(r.compromete_caixa60).aSerVerdadeiro();
      esperar(r.menor_caixa_60_depois).aSer(-200);
      esperar(r.semaforo.motivo).aSer("sem_caixa60");
      esperar(R.sintese(r).frase).aConter("não nas contas já previstas");
      const folgado = R.calcular(400, perfil, { saldo: 2880, despesasFixas: 1354, caixa60: -448, menorCaixa60: 600, hoje: hoje });
      esperar(folgado.compromete_caixa60).aSerFalso();
      esperar(R.calcular(800, perfil, { saldo: 2880, hoje: hoje }).compromete_caixa60).aSerFalso();
    });
    teste("parcelas que passam do saldo usam o nome da página inicial", () => {
      const r = R.calcular(200, perfil, { saldo: 1000, compromissosAbertos: 900, hoje: hoje });
      esperar(r.saldo_apos_parcelas).aSer(100);
      esperar(R.sintese(r).frase).aConter("saldo depois das parcelas");
      esperar(R.GLOSSARIO.saldo_apos_parcelas.rotulo).aSer("Saldo depois das parcelas");
    });
  });

  descrever("Reality: leitura do histórico, feita por regra (UX)", () => {
    teste("a categoria mais adiada, com valor e horas de trabalho", () => {
      const lista = [
        { price: 800, category: "Eletrônicos", decision: "adiar", work_hours: 40 },
        { price: 1200, category: "Eletrônicos", decision: "adiar", work_hours: 60 },
        { price: 100, quantity: 2, category: "Eletrônicos", decision: "adiar", work_hours: 10 },
        { price: 300, category: "Roupas", decision: "desistir", work_hours: 15 },
        { price: 90, category: "Lazer", decision: "comprar", work_hours: 4 }
      ];
      const frase = String(R.leituraHistorico(lista)).replace(/[\u00a0\u202f]/g, " ");
      esperar(frase).aSer("Você adiou 3 compras de Eletrônicos que somam R$ 2.200,00 (110 h de trabalho).");
      esperar(semJulgamento([ frase ])).aSerVerdadeiro();
      esperar(R.leituraHistorico([ lista[0] ])).aSer(null);
      const semAdiar = R.leituraHistorico([ { price: 50, category: "Lazer", decision: "comprar" }, { price: 70, category: "Lazer", decision: null } ]);
      esperar(String(semAdiar).replace(/[\u00a0\u202f]/g, " ")).aSer("A categoria que você mais analisou foi Lazer: 2 compras, R$ 120,00 no total.");
    });
  });

  descrever("Reality: a reflexão é retrato, não prova (UX)", () => {
    teste("os rótulos descrevem as respostas sem julgar a pessoa", () => {
      const textos = R.FAIXAS_RESPONSABILIDADE.flatMap(f => [ f.rotulo, f.texto ]);
      esperar(semJulgamento(textos)).aSerVerdadeiro();
      esperar(semTravessao(textos)).aSerVerdadeiro();
      esperar(R.FAIXAS_RESPONSABILIDADE.find(f => f.nivel === "baixa").rotulo).aSer("Suas respostas apontam impulso");
    });
    teste("sem resposta, o convite não fala em responder perguntas", () => {
      const ind = R.indicadorResponsavel({});
      esperar(ind.pontuacao).aSer(null);
      esperar(ind.sintese.includes("Responda")).aSerFalso();
    });
  });
})();
