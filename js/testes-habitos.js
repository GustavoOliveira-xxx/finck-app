// Hábitos de consumo (js/habitos-engine.js): os padrões, a confiança pelo
// tamanho do histórico, a simulação, o histórico da categoria no Reality, o
// que vai para a IA e a demonstração com três meses de registros.
(() => {
  const { descrever, teste, esperar } = window.FinckTestes;
  const H = () => window.FinckHabitos;
  const U = window.FinckUtils;
  const S = window.FinckStore;
  const F = window.FinckFinance;
  const R = window.FinckReality;

  // Quinta-feira, 15 de outubro de 2026. Julho, agosto e setembro são os
  // meses completos; outubro está em andamento.
  const HOJE = new Date(2026, 9, 15, 12);
  const em = n => {
    const d = new Date(HOJE);
    d.setDate(d.getDate() + n);
    return U.dataISO(d);
  };
  const no = (mes, dia) => U.dataISO(new Date(2026, mes - 1, dia, 12));
  let seq = 0;
  const gasto = (date, description, category, amount, extra = {}) => ({ id: `g${++seq}`, type: "saida", date, description, category, amount, ...extra });
  const salario = (date, amount = 3000) => ({ id: `e${++seq}`, type: "entrada", date, description: "Salário", category: "Salário", amount });
  const ALUGUEL = { id: "r1", type: "saida", description: "Aluguel", amount: 1000, active: true };
  const contexto = ({ renda = 3000, transacoes = [], recorrentes = [ ALUGUEL ], analises = [], metas = [], movimentosMeta = [] } = {}) => ({
    perfil: { income_monthly: renda, payday: 5, work_days_month: 20, work_hours_day: 8 },
    transacoesRealizadas: transacoes,
    recorrentes,
    analises,
    metas,
    movimentosMeta,
    parcelamentos: []
  });
  const salarios = () => [ salario(no(7, 5)), salario(no(8, 5)), salario(no(9, 5)), salario(no(10, 5)) ];
  const alugueis = () => [ 7, 8, 9, 10 ].map(m => gasto(no(m, 10), "Aluguel", "Moradia", 1000));

  // O cenário completo: lazer que triplica em setembro, delivery frequente,
  // um conserto que deixa setembro no vermelho e três roupas em 90 dias.
  function cenarioCompleto() {
    return contexto({
      transacoes: [
        ...salarios(),
        ...alugueis(),
        gasto(no(7, 12), "Cinema", "Lazer", 100),
        gasto(no(8, 12), "Cinema", "Lazer", 100),
        gasto(no(9, 6), "Bar", "Lazer", 100),
        gasto(no(9, 13), "Show", "Lazer", 100),
        gasto(no(9, 20), "Parque", "Lazer", 100),
        ...[ -1, -3, -6, -9, -12, -20 ].map(n => gasto(em(n), "Delivery", "Alimentação", 30)),
        ...[ -2, -4, -8 ].map(n => gasto(em(n), "Café", "Alimentação", 10)),
        gasto(no(9, 25), "Conserto do carro", "Transporte", 2500),
        gasto(em(-15), "Camiseta", "Vestuário", 120),
        gasto(em(-40), "Bermuda", "Vestuário", 90),
        gasto(em(-70), "Tênis", "Vestuário", 150)
      ]
    });
  }

  const JULGAMENTOS = [ "não compre", "compre agora", "compra ruim", "boa compra", "ótima compra", "desperdício", "irresponsável", "gasta demais", "você errou" ];
  const FALA_DE_IA = /\bIA\b|✦|FINCK AI|[Ii]ntelig[êe]ncia|Gemini|Claude|OpenRouter/;
  const TRAVESSAO = String.fromCharCode(0x2014);
  const textosDoPadrao = q => [ q.titulo, q.texto, q.reflexao, ...(q.calculo || []).flatMap(l => [ l.rotulo, l.valor ]) ].filter(Boolean);

  descrever("Hábitos: padrões encontrados no histórico", () => {
    teste("o cenário completo traz a sobra negativa primeiro e o ODS 12 garantido", () => {
      const h = H().analisar(cenarioCompleto(), { hoje: HOJE });
      const ids = h.padroes.map(q => q.id);
      esperar(h.padroes.length).aSer(window.FINCK_CONFIG.HABITOS.MAX_PADROES);
      esperar(ids[0]).aSer("sobra");
      esperar(h.padroes[0].titulo).aSer("O último mês fechou no vermelho");
      esperar(ids.includes("duraveis")).aSerVerdadeiro();
      esperar(h.padroes.find(q => q.id === "duraveis").ods12).aSerVerdadeiro();
      // Ordem por relevância, com o ODS 12 no lugar do último quando não cabe.
      const semOds = h.padroes.filter(q => !q.ods12).map(q => q.relevancia);
      esperar(semOds.every((v, i) => i === 0 || semOds[i - 1] >= v)).aSerVerdadeiro();
    });

    teste("categoria em alta compara o último mês completo com a média dos anteriores", () => {
      const h = H().analisar(cenarioCompleto(), { hoje: HOJE });
      const alta = h.padroes.find(q => q.id === "alta");
      esperar(Boolean(alta)).aSerVerdadeiro();
      esperar(alta.categoria).aSer("Lazer");
      esperar(alta.base_mensal).aSer(300);
      esperar(alta.texto).aConter("setembro");
      esperar(alta.texto).aConter("+200%");
      esperar(alta.acumulado_12m).aSer(3600);
    });

    teste("pequenos gastos somam só o dia a dia, com o limite pela renda", () => {
      const h = H().analisar(cenarioCompleto(), { hoje: HOJE });
      const p = h.padroes.find(q => q.id === "pequenos");
      esperar(Boolean(p)).aSerVerdadeiro();
      // 1,5% de R$ 3.000 = R$ 45: seis deliveries de 30 e três cafés de 10.
      esperar(p.vezes).aSer(9);
      esperar(p.texto).aConter(U.moeda(45));
      esperar(p.texto).aConter(U.moeda(210));
      esperar(p.pct_renda).aSerPerto(7, 2);
      esperar(p.base_mensal).aSerPerto(210, 2);
      esperar(p.acumulado_12m).aSerPerto(2520, 2);
      // R$ 210 ÷ R$ 18,75 por hora.
      esperar(p.horas_mes).aSerPerto(11.2, 1);
    });

    teste("contas fixas, parcelas e aportes não entram no dia a dia", () => {
      const ctx = contexto({
        transacoes: [
          salario(em(-40)), salario(em(-10)),
          gasto(em(-9), "Aluguel", "Moradia", 1000),
          gasto(em(-8), "Parcela da geladeira", "Moradia", 400, { source: "parcela" }),
          gasto(em(-7), "Reserva", "Reserva", 500, { goal_id: "m1" }),
          ...[ -1, -2, -3, -4, -5 ].map(n => gasto(em(n), "Lanche", "Alimentação", 12))
        ]
      });
      const h = H().analisar(ctx, { hoje: HOJE });
      esperar(h.dia_a_dia_30).aSer(60);
      esperar(h.padroes.some(q => q.categoria === "Moradia")).aSerFalso();
      const outubro = h.meses.find(m => m.mes === "2026-10");
      esperar(outubro.aportes).aSer(500);
      esperar(outubro.gastos).aSer(1460);
      esperar(outubro.fixos).aSer(1000);
      esperar(outubro.parcelas).aSer(400);
    });

    teste("o gasto que se repete mostra a descrição na tela, mas não para a IA", () => {
      const ctx = contexto({
        transacoes: [
          salario(em(-40)),
          ...[ -1, -4, -7, -10, -13 ].map(n => gasto(em(n), "Padaria do Zé", "Alimentação", 25))
        ]
      });
      const h = H().analisar(ctx, { hoje: HOJE });
      const r = h.padroes.find(q => q.id === "repetido");
      esperar(Boolean(r)).aSerVerdadeiro();
      esperar(r.texto).aConter("Padaria do Zé");
      esperar(r.texto).aConter("5 vezes");
      const enviado = JSON.stringify(H().paraIA(h)) + H().contexto(h);
      esperar(enviado.includes("Padaria")).aSerFalso();
      esperar(enviado).aConter("Alimentação");
    });

    teste("troca frequente de itens duráveis aparece como ODS 12", () => {
      const ctx = contexto({
        transacoes: [ salario(em(-80)), gasto(em(-10), "Fone", "Eletrônicos", 150), gasto(em(-30), "Cabo", "Eletrônicos", 40), gasto(em(-60), "Mouse", "Eletrônicos", 90), gasto(em(-5), "Lanche", "Alimentação", 10), gasto(em(-6), "Lanche", "Alimentação", 11) ]
      });
      const d = H().analisar(ctx, { hoje: HOJE }).padroes.find(q => q.id === "duraveis");
      esperar(Boolean(d)).aSerVerdadeiro();
      esperar(d.texto).aConter("3 compras de Eletrônicos");
      esperar(d.acao.href).aSer("locais.html");
    });

    teste("o que melhorou: categoria em queda e análises antes de decidir", () => {
      const ctx = contexto({
        transacoes: [ ...salarios(), ...alugueis(), gasto(no(7, 15), "Uber", "Transporte", 300), gasto(no(8, 15), "Uber", "Transporte", 300), gasto(no(9, 15), "Uber", "Transporte", 100), ...[ -1, -2 ].map(n => gasto(em(n), "Lanche", "Alimentação", 10)) ],
        analises: [ { category: "Lazer", price: 200, decision: "adiar", analyzed_at: `${em(-20)}T12:00:00Z` } ]
      });
      const h = H().analisar(ctx, { hoje: HOJE });
      esperar(h.positivos.some(p => p.texto.startsWith("Transporte caiu"))).aSerVerdadeiro();
      esperar(h.positivos.some(p => p.id === "analises")).aSerVerdadeiro();
    });

    teste("o que mudou do penúltimo para o último mês completo", () => {
      const m = H().mudancas(H().analisar(cenarioCompleto(), { hoje: HOJE }));
      // Agosto: 1.250 de gastos; setembro: 3.920 (o conserto do carro).
      esperar(m.atencao.some(t => t.startsWith("Os gastos subiram") && t.includes("agosto") && t.includes("setembro"))).aSerVerdadeiro();
      esperar(m.atencao.some(t => t.startsWith("A sobra diminuiu"))).aSerVerdadeiro();
      esperar(m.atencao.some(t => t.includes("Transporte foi a categoria que mais subiu"))).aSerVerdadeiro();
      esperar(H().mudancas({ meses: [], categorias: [], positivos: [] }).atencao).aTerTamanho(0);
    });

    teste("os textos não julgam, não falam de IA e não usam travessão", () => {
      const h = H().analisar(cenarioCompleto(), { hoje: HOJE });
      const m = H().mudancas(h);
      const textos = [ ...h.padroes.flatMap(textosDoPadrao), ...h.positivos.map(p => p.texto), h.resumo, h.confianca.texto, ...m.atencao, ...m.melhorou ];
      textos.forEach(t => {
        esperar(t.includes(TRAVESSAO)).aSerFalso();
        esperar(FALA_DE_IA.test(t)).aSerFalso();
        JULGAMENTOS.forEach(j => esperar(t.toLowerCase().includes(j)).aSerFalso());
      });
      // Toda reflexão é uma pergunta, não uma ordem.
      h.padroes.forEach(q => esperar(q.reflexao.endsWith("?")).aSerVerdadeiro());
    });
  });

  descrever("Hábitos: a tela", () => {
    teste("a descrição digitada é escapada e o texto não fala de IA", () => {
      const ctx = contexto({
        transacoes: [ salario(em(-40)), ...[ -1, -4, -7, -10, -13 ].map(n => gasto(em(n), '<img src=x onerror="alert(1)">', "Lazer", 25)) ]
      });
      const h = H().analisar(ctx, { hoje: HOJE });
      const html = window.FinckHabitosUI.htmlPadroes(h) + window.FinckHabitosUI.htmlMeses(h) + window.FinckHabitosUI.htmlConfianca(h.confianca);
      esperar(html.includes("<img")).aSerFalso();
      esperar(html).aConter("&lt;img");
      const texto = new DOMParser().parseFromString(html, "text/html").body.textContent;
      esperar(FALA_DE_IA.test(texto)).aSerFalso();
      esperar(texto.includes(TRAVESSAO)).aSerFalso();
    });

    teste("a simulação diz que é possibilidade, não recomendação", () => {
      const [s] = H().simular(300, { pcts: [ 20 ], meta: { nome: "Viagem", falta: 600, ritmo: 60 } });
      const texto = window.FinckHabitosUI.textoSimulacao(s, "Lazer");
      esperar(texto).aConter("Com 20% a menos em Lazer");
      esperar(texto).aConter(U.moeda(720));
      esperar(texto).aConter("Viagem");
      const html = window.FinckHabitosUI.htmlPadroes(H().analisar(cenarioCompleto(), { hoje: HOJE }));
      esperar(html).aConter("possibilidade matemática, não uma recomendação");
    });
  });

  descrever("Hábitos: confiança pelo tamanho do histórico", () => {
    const lanches = (inicio, n) => Array.from({ length: n }, (_, i) => gasto(em(inicio + i), "Lanche", "Alimentação", 14 + i));
    teste("poucos gastos: sem padrões de hábito", () => {
      const h = H().analisar(contexto({ transacoes: lanches(-3, 3), recorrentes: [] }), { hoje: HOJE });
      esperar(h.confianca.nivel).aSer("insuficiente");
      esperar(h.padroes).aTerTamanho(0);
    });
    teste("dez dias de registro é leitura inicial, e tudo vira estimativa", () => {
      const h = H().analisar(contexto({ transacoes: lanches(-9, 10), recorrentes: [] }), { hoje: HOJE });
      esperar(h.confianca.nivel).aSer("inicial");
      esperar(h.confianca.texto).aConter("10 dias");
      esperar(h.padroes.length > 0).aSerVerdadeiro();
      esperar(h.padroes.every(q => q.certeza === "estimativa")).aSerVerdadeiro();
    });
    teste("45 dias é moderada e 100 dias é consistente", () => {
      esperar(H().analisar(contexto({ transacoes: [ ...lanches(-6, 6), gasto(em(-44), "Lanche", "Alimentação", 9) ], recorrentes: [] }), { hoje: HOJE }).confianca.nivel).aSer("moderada");
      esperar(H().analisar(contexto({ transacoes: [ ...lanches(-6, 6), gasto(em(-99), "Lanche", "Alimentação", 9) ], recorrentes: [] }), { hoje: HOJE }).confianca.nivel).aSer("consistente");
    });
  });

  descrever("Hábitos: simulação e histórico da categoria", () => {
    teste("10%, 15% e 20% a menos, em 6 e 12 meses e no prazo da meta", () => {
      const s = H().simular(400, { meta: { nome: "Viagem", falta: 1200, ritmo: 100 }, valorHora: 20 });
      esperar(s.map(x => x.pct).join(",")).aSer("10,15,20");
      esperar(s[0].mensal).aSer(40);
      esperar(s[0].seis_meses).aSer(240);
      esperar(s[0].doze_meses).aSer(480);
      esperar(s[0].horas_mes).aSer(2);
      // 1.200 ÷ 100 = 12 meses; 1.200 ÷ 140 = 8,6 meses.
      esperar(s[0].meta.meses_atual).aSer(12);
      esperar(s[0].meta.meses_novo).aSerPerto(8.6, 1);
      esperar(s[0].meta.meses_a_menos).aSerPerto(3.4, 1);
      esperar(s[2].mensal).aSer(80);
      // Sem ritmo de aportes, só o prazo novo.
      const semRitmo = H().simular(400, { meta: { nome: "Viagem", falta: 1200, ritmo: 0 } });
      esperar(semRitmo[0].meta.meses_atual).aSer(null);
      esperar(semRitmo[0].meta.meses_novo).aSer(30);
    });

    teste("a compra do Reality dentro do mês e da média da categoria", () => {
      const ctx = contexto({
        transacoes: [ ...salarios(), gasto(no(7, 20), "Cabo", "Eletrônicos", 100), gasto(no(9, 20), "Fone", "Eletrônicos", 200), gasto(no(10, 3), "Teclado", "Eletrônicos", 200), gasto(no(10, 8), "Monitor", "Eletrônicos", 400) ],
        analises: [ { category: "Eletrônicos", price: 900, decision: "adiar", analyzed_at: `${em(-20)}T12:00:00Z` }, { category: "Lazer", price: 50, decision: "comprar", analyzed_at: `${em(-5)}T12:00:00Z` } ]
      });
      const h = H().historicoDaCategoria(ctx, "Eletrônicos", 250, { hoje: HOJE });
      esperar(h.no_mes).aSer(600);
      esperar(h.registros_no_mes).aSer(2);
      esperar(h.com_compra).aSer(850);
      esperar(h.media_mensal).aSerPerto(100, 2);
      esperar(h.acima_da_media).aSerPerto(750, 2);
      esperar(h.analisadas).aSer(1);
      esperar(h.texto).aConter(U.moeda(600));
      esperar(h.texto).aConter(U.moeda(850));
      esperar(h.calculo.some(l => l.valor === "1 esperar")).aSerVerdadeiro();
      const nova = H().historicoDaCategoria(ctx, "Saúde", 80, { hoje: HOJE });
      esperar(nova.texto).aConter("primeira compra da categoria");
      // Eletrônicos é durável: as quatro compras dos últimos 90 dias (o cabo
      // de 20 de julho também conta) e esta somariam 5 (ODS 12).
      esperar(h.ods12).aConter("seriam 5 compras de Eletrônicos");
      esperar(nova.ods12).aSer(null);
    });

    teste("mesmo período do mês anterior, sem misturar mês inteiro com metade", () => {
      const ctx = contexto({ transacoes: [ gasto(no(9, 3), "A", "Lazer", 100), gasto(no(9, 20), "B", "Lazer", 500), gasto(no(10, 4), "C", "Lazer", 160) ] });
      const c = H().comparacaoMesAnterior(ctx, { hoje: HOJE });
      esperar(c.anterior).aSer(100);
      esperar(c.atual).aSer(160);
      esperar(c.texto).aConter("a mais");
      esperar(H().comparacaoMesAnterior(contexto({ transacoes: [ gasto(no(10, 4), "C", "Lazer", 160) ] }), { hoje: HOJE })).aSer(null);
    });
  });

  descrever("Decisões: comprar também pode ser consciente", () => {
    teste("compra planejada exige necessidade e orçamento marcados", () => {
      const base = { decision: "comprar", reflections: { necessidade: "Preciso agora", orcamento: "Aperta um pouco" } };
      esperar(R.compraPlanejada(base)).aSerVerdadeiro();
      esperar(R.compraPlanejada({ ...base, reflections: { necessidade: "É impulso", orcamento: "Não compromete nada" } })).aSerFalso();
      esperar(R.compraPlanejada({ ...base, reflections: { necessidade: "Preciso agora", orcamento: "Compromete o essencial" } })).aSerFalso();
      esperar(R.compraPlanejada({ decision: "comprar" })).aSerFalso();
      esperar(R.compraPlanejada({ ...base, decision: "adiar" })).aSerFalso();
      esperar(R.resumoHistorico([ base, { decision: "adiar" }, { decision: "comprar" } ]).planejadas).aSer(1);
    });

    teste("a retrospectiva separa as escolhas, sem ordem de mérito", () => {
      const r = R.retrospectiva([
        { decision: "comprar", price: 100, reflections: { necessidade: "Preciso agora", orcamento: "Não compromete nada" } },
        { decision: "comprar", price: 50 },
        { decision: "adiar", price: 300, outcome: "mantive" },
        { decision: "usado", price: 200 },
        { decision: "reparar", price: 80 },
        { decision: "desistir", price: 900 },
        { price: 30 }
      ]);
      const n = Object.fromEntries(r.grupos.map(g => [ g.id, g.n ]));
      esperar(r.total).aSer(7);
      esperar(JSON.stringify(n)).aSer(JSON.stringify({ planejada: 1, comprou: 1, esperou: 1, alternativa: 2, nao_comprou: 1, sem_decisao: 1 }));
      esperar(r.grupos.find(g => g.id === "alternativa").valor).aSer(280);
      esperar(r.depois.map(o => o.id).join()).aSer("mantive");
      esperar(r.grupos.map(g => g.rotulo).some(t => /errad|ruim|melhor|pior/i.test(t))).aSerFalso();
    });
  });

  descrever("Validação com usuários: indicadores", () => {
    const V = () => window.FinckValidacao;
    const sessoes = [
      { codigo: "P01", antes: { decisao: "comprar", fatores: [ "preco" ] }, depois: { decisao: "esperar", fatores: [ "preco", "horas", "acumulados" ], diferenca: "sim", acumulados: "sim" }, tarefa: { ajuda: "sem", tempo_s: 40 }, escalas: { clareza: 5, facilidade: 4 } },
      { codigo: "P02", antes: { decisao: "comprar", fatores: [ "preco", "renda" ] }, depois: { decisao: "comprar", fatores: [ "preco", "renda" ], diferenca: "parcialmente", acumulados: "nao" }, tarefa: { ajuda: "com", tempo_s: 80 }, escalas: { clareza: 3, facilidade: 0 } }
    ];
    teste("os indicadores da seção 6 saem das sessões salvas", () => {
      const r = V().indicadores(sessoes);
      esperar(r.participantes).aSer(2);
      esperar(r.compreenderam_impacto).aSer(50);
      esperar(r.identificaram_acumulados).aSer(50);
      esperar(r.explicaram_diferenca).aSer(50);
      esperar(r.explicaram_em_parte).aSer(50);
      esperar(r.fatores_antes).aSer(1.5);
      esperar(r.fatores_depois).aSer(2.5);
      esperar(r.mudaram_escolha).aSer(50);
      esperar(r.sem_ajuda).aSer(50);
      esperar(r.tempo_medio_s).aSer(60);
      esperar(r.escalas.clareza).aSer(4);
      // Fora da escala de 1 a 5 não entra na média.
      esperar(r.escalas.facilidade).aSer(4);
      esperar(V().indicadores([]).compreenderam_impacto).aSer(null);
    });
    teste("o CSV tem uma linha por sessão e escapa o texto", () => {
      const csv = V().paraCSV([ { ...sessoes[0], comentarios: { ajudou: 'As horas; "o mês"' } } ]);
      const linhas = csv.split("\n");
      esperar(linhas).aTerTamanho(2);
      esperar(linhas[0].startsWith("codigo;data;")).aSerVerdadeiro();
      esperar(linhas[1]).aConter('"As horas; ""o mês"""');
      esperar(linhas[1]).aConter("preco|horas|acumulados");
    });
    teste("o código do participante segue a sequência", () => {
      esperar(V().proximoCodigo([])).aSer("P01");
      esperar(V().proximoCodigo([ { codigo: "P01" }, { codigo: "P09" } ])).aSer("P10");
    });
  });

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

  descrever("Demonstração: quatro meses de histórico", () => {
    teste("o histórico de exemplo soma zero e fica todo no passado", () => {
      const lista = F.historicoDaDemo(new Date());
      const liquido = lista.reduce((s, t) => s + (t.type === "entrada" ? 1 : -1) * Number(t.amount), 0);
      esperar(liquido).aSerPerto(0, 2);
      esperar(lista.every(t => t.date < U.hojeISO())).aSerVerdadeiro();
      // Em qualquer dia do ano, o histórico continua somando zero.
      [ new Date(2026, 0, 1), new Date(2026, 2, 31), new Date(2026, 11, 15) ].forEach(d => {
        const outra = F.historicoDaDemo(d);
        esperar(outra.length).aSer(lista.length);
        esperar(outra.every(t => t.date < U.dataISO(d))).aSerVerdadeiro();
      });
    });

    teste("a demonstração mostra hábitos, o ODS 12 e uma compra planejada", async () => {
      await comSessaoLimpa(async () => {
        await F.carregarDemo();
        const ctx = await F.carregarContexto();
        esperar(ctx.saldo).aSerPerto(2880);
        const h = H().analisar(ctx);
        esperar([ "moderada", "consistente" ].includes(h.confianca.nivel)).aSerVerdadeiro();
        esperar(h.padroes.length >= 3).aSerVerdadeiro();
        esperar(h.padroes.some(q => q.ods12)).aSerVerdadeiro();
        esperar(h.padroes.some(q => q.id === "pequenos")).aSerVerdadeiro();
        esperar(R.resumoHistorico(ctx.analises).planejadas).aSer(1);
        // As análises de exemplo não contam como análises próprias.
        const exemplos = [ F.FIXTURE_DEMO.analise, ...F.FIXTURE_DEMO.historico.analises ];
        esperar(window.FinckPainel.analisesProprias(ctx.analises, { demo: true, exemplo: exemplos })).aSer(0);
        // Repetir a semente não duplica o histórico.
        const r = await F.carregarDemo();
        esperar(r.inseridos).aSer(0);
      });
    });
  });
})();
