// Linha do tempo: a leitura em palavras, a origem de cada número, o resumo
// que vai para a ajuda opcional e a tela (js/linha-tempo.js, carregada aqui
// só para estes testes). As contas em si estão na suíte "Linha do tempo da
// compra (FinckLinhaTempo)", em js/testes.js.
(() => {
  const { descrever, teste, esperar } = window.FinckTestes;
  const L = window.FinckLinhaTempo;
  const hoje = new Date(2026, 9, 7);
  // O mesmo exemplo da geladeira: renda 2.500, fixos 1.600, dia a dia 500
  // pelo histórico, sobra livre de 400 por mês, saldo zero.
  const ctx = (extra = {}) => ({
    perfil: { income_monthly: 2500 },
    despesasFixas: 1600,
    saldo: 0,
    parcelamentos: [],
    pagamentos: [],
    transacoesRealizadas: [
      { type: "saida", amount: 500, date: "2026-09-10", category: "Mercado" },
      { type: "saida", amount: 500, date: "2026-08-10", category: "Mercado" },
      { type: "saida", amount: 500, date: "2026-07-10", category: "Mercado" },
      { type: "saida", amount: 1600, date: "2026-09-05", source: "recorrente" }
    ],
    ...extra
  });
  const analisar = (extraCtx, entrada) => L.analisar(L.base(ctx(extraCtx), { hoje: hoje }), { preco: 3000, forma: "parcelado", parcelas: 10, ...entrada });
  const textos = a => {
    const l = L.leitura(a);
    const u = L.numerosUsados(a);
    return [ l.conclusao, ...l.explicacao, ...a.alertas, ...u.confirmados.map(i => i.detalhe), ...u.estimativas.map(i => i.detalhe) ];
  };
  // Consultor, não juiz: nenhuma frase manda, proíbe ou elogia a compra.
  const JULGAMENTOS = [ "não compre", "não deve comprar", "compra ruim", "ótima compra", "boa compra", "mais caro do país" ];

  descrever("Linha do tempo: leitura, origem dos números e ajuda opcional (UX)", () => {
    teste("a conclusão curta vem do cenário e cabe numa frase", () => {
      const a = analisar({}, {});
      const l = L.leitura(a);
      esperar(l.situacao).aSer("cabe");
      esperar(l.conclusao.startsWith("Neste cenário")).aSerVerdadeiro();
      esperar(l.conclusao).aConter("10x de R$ 300.00");
      esperar(l.conclusao.length < 170).aSerVerdadeiro();
      esperar(l.explicacao.length >= 1).aSerVerdadeiro();
    });
    teste("cada cenário tem a sua conclusão", () => {
      esperar(L.leitura(analisar({}, { imprevisto: { valor: 400, mes: 1 } })).situacao).aSer("imprevisto-no-cartao");
      esperar(L.leitura(analisar({ saldo: 5000 }, { imprevisto: { valor: 400, mes: 1 } })).situacao).aSer("cabe-com-imprevisto");
      esperar(L.leitura(analisar({ despesasFixas: 2200 }, {})).situacao).aSer("nao-fecha");
      esperar(L.leitura(analisar({}, { forma: "avista" })).situacao).aSer("sem-saldo");
    });
    teste("o rotativo aparece como consequência do cenário, não como reprimenda", () => {
      const a = analisar({}, { forma: "avista" });
      const l = L.leitura(a);
      esperar(l.conclusao).aConter("Neste cenário, o saldo de hoje não cobre a compra à vista");
      esperar(l.explicacao[0]).aConter("Se a fatura não for paga integralmente, o valor pode entrar no crédito rotativo, que costuma ter juros muito altos.");
    });
    teste("imprevisto que não cabe explica a fatura e os juros, com o custo real", () => {
      const a = analisar({}, { imprevisto: { valor: 400, mes: 1 } });
      const texto = L.leitura(a).explicacao.join(" ");
      esperar(texto).aConter("não for paga integralmente");
      esperar(texto).aConter("passaria a custar R$ 3091.35");
    });
    teste("nenhum texto julga a compra nem usa travessão", () => {
      const cenarios = [
        analisar({}, {}),
        analisar({}, { forma: "avista" }),
        analisar({}, { imprevisto: { valor: 400, mes: 1 } }),
        analisar({ despesasFixas: 2200 }, { imprevisto: { valor: 400, mes: 2 } }),
        analisar({ saldo: 10000 }, { preco: 9000 })
      ];
      cenarios.forEach(a => textos(a).forEach(t => {
        const baixo = String(t).toLowerCase();
        JULGAMENTOS.forEach(j => esperar(baixo.includes(j)).aSerFalso());
        esperar(String(t).includes("\u2014")).aSerFalso();
      }));
    });
    teste("alerta de renda que não fecha descreve o cenário", () => {
      const a = analisar({ despesasFixas: 2200 }, {});
      esperar(a.alertas[0]).aConter("Neste cenário, mesmo sem esta compra");
      esperar(a.alertas[0]).aConter("poderia virar dívida no cartão");
    });
    teste("renda, fixos, parcelas e saldo são dado confirmado; dia a dia e imprevisto, estimativa", () => {
      const u = L.numerosUsados(analisar({}, { imprevisto: { valor: 400, mes: 2 } }));
      esperar(u.confirmados.map(i => i.chave).join(",")).aSer("renda,fixos,parcelas,saldo,preco");
      esperar(u.estimativas.map(i => i.chave).join(",")).aSer("dia_a_dia,imprevisto,juros_cartao");
      esperar(u.confirmados[0].valor).aSer(2500);
      esperar(u.confirmados[1].valor).aSer(1600);
      esperar(u.estimativas[0].detalhe).aConter("média dos últimos 3 meses");
      esperar(u.estimativas[1].detalhe).aConter("hipotético");
    });
    teste("dia a dia trocado pela pessoa deixa de ser média do histórico", () => {
      const b = L.base(ctx(), { hoje: hoje });
      esperar(b.dia_a_dia_historico).aSer(500);
      b.dia_a_dia = 650;
      const u = L.numerosUsados(L.analisar(b, { preco: 3000, forma: "parcelado", parcelas: 10 }));
      esperar(u.estimativas[0].valor).aSer(650);
      esperar(u.estimativas[0].detalhe).aSer("valor que você informou");
    });
    teste("parcelas registradas entram com o maior valor por mês", () => {
      const u = L.numerosUsados(analisar({
        parcelamentos: [ { id: "p1", total_amount: 600, installments_count: 3, first_due_date: "2026-11-10", paid_count: 0 } ]
      }, {}));
      const parcelas = u.confirmados.find(i => i.chave === "parcelas");
      esperar(parcelas.valor).aSer(200);
      esperar(parcelas.detalhe).aConter("em 3 dos próximos");
    });
    teste("juros do cartão só aparecem como estimativa quando o cenário usa o cartão", () => {
      const semCartao = L.numerosUsados(analisar({ saldo: 5000 }, {}));
      esperar(semCartao.estimativas.some(i => i.chave === "juros_cartao")).aSerFalso();
      const comCartao = L.numerosUsados(analisar({}, { forma: "avista" }));
      const juros = comCartao.estimativas.find(i => i.chave === "juros_cartao");
      esperar(juros.valor).aSer(null);
      esperar(juros.taxa_am * 100).aSerPerto(15.02, 2);
    });
    teste("o resumo para a ajuda opcional separa dado confirmado de estimativa e cabe no limite da rota", () => {
      const a = analisar({}, { imprevisto: { valor: 400, mes: 1 } });
      const texto = L.paraIA(a, { item: "geladeira" });
      esperar(texto).aConter("Conclusão calculada pelo FinCK: Neste cenário");
      esperar(texto).aConter("Dados confirmados: renda por mês R$ 2500.00");
      esperar(texto).aConter("Estimativas: gastos do dia a dia por mês R$ 500.00");
      esperar(texto).aConter("imprevisto R$ 400.00 (hipotético");
      // A rota aceita 3.000 caracteres; a pergunta curta usa cerca de 450.
      esperar(texto.length < 2400).aSerVerdadeiro();
    });
    teste("sem histórico de gastos, a leitura pergunta o dia a dia em vez de supor zero", () => {
      const semHistorico = L.analisar(L.base(ctx({ transacoesRealizadas: [] }), { hoje: hoje }), { preco: 3000, forma: "parcelado", parcelas: 10 });
      const l = L.leitura(semHistorico);
      esperar(l.perguntas.length).aSer(1);
      esperar(l.perguntas[0].chave).aSer("dia_a_dia");
      esperar(l.perguntas[0].texto).aConter("Quanto você gasta por mês no dia a dia");
      // Com histórico, ou depois que a pessoa informa um valor, não pergunta.
      esperar(L.leitura(analisar({}, {})).perguntas.length).aSer(0);
      const b = L.base(ctx({ transacoesRealizadas: [] }), { hoje: hoje });
      b.dia_a_dia = 700;
      esperar(L.leitura(L.analisar(b, { preco: 3000, forma: "parcelado", parcelas: 10 })).perguntas.length).aSer(0);
    });
    teste("sem o nome do item, o resumo para a ajuda opcional leva só números", () => {
      const a = analisar({}, { imprevisto: { valor: 400, mes: 1 } });
      const texto = L.paraIA(a);
      esperar(texto.startsWith("Compra de R$ 3000.00. Forma escolhida: em 10x de R$ 300.00")).aSerVerdadeiro();
      esperar(texto.includes("o item")).aSerFalso();
      esperar(texto.includes("\u2014")).aSerFalso();
      // Plural certo também no texto que vai para fora.
      esperar(/\b1 meses\b/.test(texto)).aSerFalso();
    });
  });

  // A tela da linha do tempo, montada com o bloco do reality.html de verdade,
  // fora da tela, dentro de um "Se quiser aprofundar" fechado.
  const carregar = (global, src) => window[global] ? Promise.resolve() : new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => falha(new Error(`não carregou ${src}`));
    document.head.appendChild(s);
  });
  const SEM_CARA_DE_IA = /\bIA\b|FINCK AI|✦/;

  descrever("Linha do tempo: tela sem cara de IA", () => {
    teste("conclusão primeiro, selos e aviso de simulação; o botão leva a \"Tirar uma dúvida\" e foca o campo", async () => {
      await carregar("FinckLinhaTempoUI", "js/linha-tempo.js");
      await carregar("FinckInteligenciaUI", "js/inteligencia.js");
      const html = await fetch("reality.html", { cache: "no-store" }).then(r => r.text());
      const bloco = new DOMParser().parseFromString(html, "text/html").getElementById("blocoLinhaTempo");
      esperar(Boolean(bloco)).aSerVerdadeiro();
      const caixa = document.createElement("div");
      caixa.style.cssText = "position:absolute;left:-9999px;top:0;width:360px";
      caixa.innerHTML = `<details id="tAprofundar"><summary>Se quiser aprofundar</summary>${bloco.outerHTML}<div id="duvidaCalculo"></div></details><section id="tAnalise" hidden></section>`;
      document.body.appendChild(caixa);
      const fetchOriginal = window.fetch;
      try {
        window.FinckMoeda?.ligarTodos?.(caixa);
        caixa.querySelector("#blocoLinhaTempo").open = true;
        const perfil = { income_monthly: 2500, work_days_month: 22, work_hours_day: 8 };
        const c = { ...ctx(), perfil: perfil, metas: [], movimentosMeta: [] };
        window.FinckLinhaTempoUI.mostrar({ ctx: c, item: "Geladeira", preco: 3000, nivel: "atencao" });
        const resultado = window.FinckReality.calcular(3000, perfil, { saldo: 0, despesasFixas: 1600, metas: [], movimentosMeta: [], hoje: hoje, diaADia: 500 });
        window.FinckInteligenciaUI.mostrar({
          ctx: c, entrada: { item_name: "Geladeira", price: 3000, category: "Eletrodomésticos" }, resultado: resultado,
          linhaTempo: window.FinckLinhaTempoUI.analiseAtual(), host: caixa.querySelector("#tAnalise"),
          hosts: { comparar: null, duvida: caixa.querySelector("#duvidaCalculo") }
        });
        const resumo = caixa.querySelector("#ltResumo");
        const conclusao = resumo.querySelector("#ltConclusao");
        esperar(conclusao.textContent.length > 20).aSerVerdadeiro();
        // A conclusão vem antes dos cartões e dos controles.
        esperar(Boolean(conclusao.compareDocumentPosition(resumo.querySelector("#ltCartoes")) & Node.DOCUMENT_POSITION_FOLLOWING)).aSerVerdadeiro();
        esperar(Boolean(resumo.compareDocumentPosition(caixa.querySelector("#formLinhaTempo")) & Node.DOCUMENT_POSITION_FOLLOWING)).aSerVerdadeiro();
        esperar(resumo.querySelector(".linha-tempo__simulacao").textContent).aConter("Cálculo do FinCK. É uma simulação");
        esperar(caixa.querySelectorAll("#blocoLinhaTempo .linha-tempo__tipo--estimativa").length >= 2).aSerVerdadeiro();
        esperar(caixa.querySelector("#linhaTempoResultado").textContent).aConter("Dado confirmado");
        esperar(caixa.querySelector('[data-lt-detalhe="formulas"] summary').textContent).aSer("Como foi calculado?");
        esperar(SEM_CARA_DE_IA.test(caixa.querySelector("#blocoLinhaTempo").textContent)).aSerFalso();
        const botao = resumo.querySelector("[data-lt-perguntar]");
        esperar(botao.textContent).aSer("Tirar uma dúvida sobre esta simulação");
        esperar(botao.getAttribute("type")).aSer("button");
        // A disponibilidade da ajuda opcional é conferida sem sair da página.
        window.fetch = () => Promise.resolve(new Response(JSON.stringify({ ok: true, ia: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
        const aprofundar = caixa.querySelector("#tAprofundar");
        aprofundar.open = false;
        botao.click();
        esperar(aprofundar.open).aSerVerdadeiro();
        esperar(caixa.querySelector('#duvidaCalculo [data-af="duvida-caixa"]').open).aSerVerdadeiro();
        esperar(caixa.querySelector('#duvidaCalculo [data-af="livre"]').open).aSerVerdadeiro();
        const foco = document.activeElement;
        esperar(foco && (foco.id === "perguntaFinck" || foco.dataset.af === "indisponivel")).aSerVerdadeiro();
        // Nada foi enviado: nenhuma resposta apareceu.
        esperar(caixa.querySelectorAll("#duvidaCalculo .troca-finck").length).aSer(0);
        await new Promise(ok => setTimeout(ok, 60));
      } finally {
        window.fetch = fetchOriginal;
        window.FinckInteligenciaUI.limpar();
        caixa.remove();
      }
    });
  });
})();
