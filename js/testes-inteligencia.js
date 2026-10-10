// Testes da Análise FinCK (js/inteligencia-engine.js) e da tela dela
// (js/inteligencia.js, carregada aqui só para estes testes).
(() => {
  const { descrever, teste, esperar } = window.FinckTestes;
  const E = window.FinckInteligencia;
  const R = window.FinckReality;
  const L = window.FinckLinhaTempo;
  const HOJE = new Date(2026, 9, 8, 12);
  const PERFIL = { income_monthly: 3500, work_days_month: 22, work_hours_day: 8 };
  // Nomes de propósito estranhos: nenhum deles pode chegar ao contexto da IA.
  const METAS = [
    { id: "m1", name: "Viagem secreta da Ana", target_amount: 6000, current_amount: 1500, deadline: "2027-06-08" },
    { id: "m2", name: "Notebook do Pedro", target_amount: 3200, current_amount: 400, deadline: "2028-04-08" }
  ];
  const ITEM = "Fone Xyz misterioso";
  // Intl separa "R$" do número com espaço não separável; nos testes vale o comum.
  const t = s => String(s).replace(/[\u00a0\u202f]/g, " ");
  const PROIBIDO = /não compre|compre agora|ótima compra|boa compra|compra é ruim|você deve|não deveria|confiança:|de certeza/i;

  function cenario({ preco = 800, meses = null, metas = METAS, saldo = 2880, fixos = 1354, compromissos = 0, categoria = "Eletrônicos", quantidade = null, linha = true, forma = "parcelado", parcelas = 10, juros = 0, diaADia = 900, formaConfirmada = false, demo = false, renda = 3500 } = {}) {
    const perfil = { ...PERFIL, income_monthly: renda };
    const ctx = {
      perfil: perfil, saldo: saldo, despesasFixas: fixos, compromissosAbertos: compromissos, metas: metas, movimentosMeta: [],
      contas: [ { id: "c1", name: "Conta Banco Secreto" } ],
      transacoes: [ { type: "saida", description: "Farmácia do João", amount: 90, date: "2026-09-12" } ],
      parcelamentos: [], pagamentos: []
    };
    // O Reality passa ao cálculo o dia a dia estimado, o mesmo que abre a
    // linha do tempo.
    const resultado = R.calcular(preco, perfil, { saldo: saldo, despesasFixas: fixos, compromissosAbertos: compromissos, quantidade: quantidade, mesesDeUso: meses, metas: metas, movimentosMeta: [], hoje: HOJE, diaADia: diaADia });
    let linhaTempo = null;
    if (linha) {
      const b = L.base(ctx, { hoje: HOJE, horizonte: 12 });
      b.dia_a_dia = diaADia;
      linhaTempo = L.analisar(b, { preco: preco * (quantidade || 1), forma: forma, parcelas: parcelas, juros_am: juros, imprevisto: { valor: 0, mes: 3 } });
    }
    const entrada = { item_name: ITEM, price: preco, category: categoria, quantity: quantidade, expected_months: meses };
    const analise = E.analisar({ ctx: ctx, entrada: entrada, resultado: resultado, linhaTempo: linhaTempo, hoje: HOJE, formaConfirmada: formaConfirmada, demo: demo });
    return { ctx, entrada, resultado, linhaTempo, analise };
  }
  const textos = a => [ JSON.stringify(a), ...a.sugestoes.map(s => JSON.stringify(E.responder(a, s.id, { valor: s.valor }))), E.contexto(a) ].join("\n");
  const VARIOS = () => [
    cenario(),
    cenario({ preco: 30, metas: [], categoria: "Alimentação" }),
    cenario({ preco: 2900, meses: 12 }),
    cenario({ preco: 800, saldo: 100, fixos: 3000, diaADia: 600 }),
    cenario({ preco: 1200, fixos: 3600 }),
    cenario({ preco: 450, meses: 36, linha: false }),
    cenario({ preco: 400, quantidade: 2, compromissos: 2700 })
  ];

  descrever("Análise FinCK: pontos e relevância", () => {
    teste("no máximo 3 pontos, numerados, em ordem e sem repetir a revelação", () => {
      VARIOS().forEach(({ analise }) => {
        esperar(analise.pontos.length <= 3).aSerVerdadeiro();
        esperar(analise.pontos.some(p => p.id === "impacto")).aSerFalso();
        analise.pontos.forEach((p, i) => {
          esperar(p.numero).aSer(String(i + 1).padStart(2, "0"));
          esperar(p.na_revelacao).aSerFalso();
          if (i > 0) {
            esperar(analise.pontos[i - 1].relevancia >= p.relevancia).aSerVerdadeiro();
          }
        });
      });
      const pesado = cenario({ preco: 2900, meses: 12 }).analise;
      esperar(pesado.pontos.length >= 2).aSerVerdadeiro();
      esperar(pesado.cabecalho).aSer(`Além da revelação, ${pesado.pontos.length} pontos podem influenciar sua decisão.`);
    });

    teste("compra pequena, sem metas e sem aperto: nada além da revelação", () => {
      const { analise } = cenario({ preco: 30, metas: [], categoria: "Alimentação" });
      esperar(analise.pontos.length).aSer(0);
      esperar(analise.cabecalho).aSer("A revelação acima já mostra o que mais pesa nesta compra.");
      esperar(analise.leitura.texto).aConter("cabe com folga");
    });

    teste("saldo que não cobre a compra guia a leitura, mas fica só na revelação", () => {
      const { analise } = cenario({ preco: 2900, meses: 12 });
      esperar(analise.pontos.some(p => p.id === "saldo")).aSerFalso();
      esperar(analise.pontos_da_revelacao.some(p => p.titulo === "Saldo")).aSerVerdadeiro();
      esperar(analise.leitura.ponto).aSer("saldo");
      esperar(analise.leitura.texto).aConter("o saldo não cobre");
    });

    teste("compra que cabe na folga fora das metas não atrasa a meta em lugar nenhum", () => {
      const { analise, resultado } = cenario();
      esperar(resultado.parte_das_metas).aSer(0);
      esperar(analise.meta.atraso).aSerPerto(0, 6);
      esperar(R.cadeiaDoImpacto(resultado).passos.some(p => p.id === "meta")).aSerFalso();
      esperar(analise.pontos.some(p => p.id === "meta")).aSerFalso();
      esperar(analise.cenarios[0].meta).aSer("sem atraso");
      esperar(analise.leitura.ponto === "meta").aSerFalso();
      // 2% da sobra (um livro de R$ 45): nem atraso nem leitura de meta.
      const livro = cenario({ preco: 45, categoria: "Educação" });
      esperar(livro.resultado.parte_das_metas).aSer(0);
      esperar(R.cadeiaDoImpacto(livro.resultado).meta).aSer(null);
      esperar(livro.analise.leitura.texto.includes("meta")).aSerFalso();
    });

    teste("R$ 4.000 dá o mesmo atraso na cadeia, no bloco de metas, no ponto e no cenário Agora", () => {
      const { analise, resultado } = cenario({ preco: 4000 });
      const folga = Math.min(2880, 2880 - 1354 + resultado.sobra_fora_metas);
      esperar(resultado.folga_fora_metas).aSerPerto(folga, 6);
      esperar(resultado.parte_das_metas).aSerPerto(4000 - folga, 2);
      const cadeia = R.cadeiaDoImpacto(resultado);
      const passo = cadeia.passos.find(p => p.id === "meta");
      const bloco = resultado.impacto_metas.find(m => m.id === cadeia.meta.id);
      esperar(Boolean(passo)).aSerVerdadeiro();
      esperar(passo.valor).aSer(R.textoAtraso(bloco.atraso_dias));
      esperar(analise.meta.atraso).aSerPerto(bloco.atraso_dias, 6);
      esperar(analise.cenarios[0].atraso_dias).aSerPerto(bloco.atraso_dias, 6);
      esperar(analise.cenarios[0].meta).aSer(passo.valor);
      esperar(analise.leitura.texto.includes("Esperar pode preservar")).aSerFalso();
      // Nada de "18,0 meses": o formato é o de FinckReality.textoAtraso.
      esperar(/\d+,0 meses/.test(textos(analise))).aSerFalso();
    });

    teste("oportunidade: a compra perto do que já foi guardado nas metas", () => {
      const { analise } = cenario();
      const p = analise.pontos.find(x => x.id === "oportunidade");
      esperar(t(p.texto)).aConter("42% do que você já guardou nas suas metas (R$ 1.900,00)");
      const grande = cenario({ preco: 2900, meses: null, linha: false, saldo: 9000 }).analise;
      esperar(grande.numeros.pct_guardado > 100).aSerVerdadeiro();
    });

    teste("durabilidade só com vida útil, com custo por mês de uso", () => {
      esperar(cenario().analise.pontos.some(p => p.id === "durabilidade")).aSerFalso();
      const { analise } = cenario({ preco: 450, meses: 36, linha: false });
      const d = analise.pontos.find(p => p.id === "durabilidade");
      esperar(t(d.texto)).aConter("R$ 12,50 por mês de uso");
      esperar(d.texto).aConter("72 meses");
    });

    teste("quantidade entra no total: 2 x R$ 400 pesa como R$ 800", () => {
      const dois = cenario({ preco: 400, quantidade: 2 }).analise;
      const um = cenario({ preco: 800 }).analise;
      esperar(dois.numeros.total).aSer(800);
      esperar(dois.numeros.pct_sobra).aSerPerto(um.numeros.pct_sobra, 6);
      esperar(dois.nivel).aSer(um.nivel);
      esperar(dois.semaforo.pct_renda).aSerPerto(um.semaforo.pct_renda, 6);
      esperar(dois.semaforo.saldo_depois).aSerPerto(um.semaforo.saldo_depois, 2);
    });

    teste("aperto nos próximos meses vira ponto de parcelas, como estimativa", () => {
      const { analise } = cenario({ preco: 800, saldo: 100, fixos: 3000, diaADia: 600 });
      const p = analise.pontos.find(x => x.id === "parcelas");
      esperar(Boolean(p)).aSerVerdadeiro();
      esperar(p.certeza).aSer("estimativa");
      esperar(p.texto).aConter("cartão");
    });
  });

  descrever("Análise FinCK: confirmado, estimativa e explicação", () => {
    teste("selos: impacto, saldo e oportunidade confirmados; meta, durabilidade e parcelas estimados", () => {
      const esperado = { impacto: "confirmado", saldo: "confirmado", oportunidade: "confirmado", meta: "estimativa", durabilidade: "estimativa", parcelas: "estimativa" };
      VARIOS().forEach(({ analise }) => analise.pontos.forEach(p => esperar(p.certeza).aSer(esperado[p.id])));
    });

    teste("cada ponto diz o que considerou e mostra a cadeia da conta", () => {
      VARIOS().forEach(({ analise }) => analise.pontos.forEach(p => {
        esperar(p.fatores.length >= 2).aSerVerdadeiro();
        esperar(p.calculo.length >= 2).aSerVerdadeiro();
        p.calculo.forEach(c => esperar(Boolean(c.rotulo && c.valor)).aSerVerdadeiro());
      }));
      const impacto = cenario().analise.pontos_da_revelacao.find(p => p.id === "impacto");
      const rotulos = impacto.calculo.map(c => c.rotulo).join(" | ");
      esperar(rotulos).aConter("Renda considerada");
      esperar(rotulos).aConter("Valor da hora");
      esperar(rotulos).aConter("Horas de trabalho");
      esperar(t(impacto.calculo.find(c => c.rotulo === "Valor da hora").valor)).aConter("R$ 19,89");
    });

    teste("leitura de consultor termina sempre com a autonomia da pessoa", () => {
      VARIOS().forEach(({ analise }) => esperar(analise.leitura.texto.endsWith("A decisão continua sendo sua.")).aSerVerdadeiro());
    });

    teste("nenhum texto manda, vende ou inventa confiança", () => {
      VARIOS().forEach(({ analise }) => {
        const tudo = textos(analise);
        esperar(PROIBIDO.test(tudo)).aSerFalso();
      });
    });

    teste("nenhum travessão nos textos gerados", () => {
      VARIOS().forEach(({ analise }) => esperar(/[\u2014\u2013]/.test(textos(analise))).aSerFalso());
    });
  });

  descrever("Análise FinCK: perguntas de informação faltante", () => {
    teste("sem vida útil, pergunta por quanto tempo, com 12, 24 e 36 meses", () => {
      const q = cenario().analise.perguntas.find(p => p.id === "vida_util");
      esperar(q.pergunta).aSer("Você pretende usar por quanto tempo?");
      esperar(q.ajuda).aSer("Isso ajuda o FinCK a comparar o preço com a durabilidade.");
      esperar(q.campo).aSer("expected_months");
      esperar(q.opcoes.map(o => o.valor).join(",")).aSer("12,24,36");
    });

    teste("com vida útil, comida ou compra pequena, não pergunta vida útil", () => {
      esperar(cenario({ meses: 24 }).analise.perguntas.some(p => p.id === "vida_util")).aSerFalso();
      esperar(cenario({ preco: 300, categoria: "Alimentação" }).analise.perguntas.some(p => p.id === "vida_util")).aSerFalso();
      esperar(cenario({ preco: 40 }).analise.perguntas.some(p => p.id === "vida_util")).aSerFalso();
    });

    teste("a forma de pagamento é perguntada só na linha do tempo, não aqui de novo", () => {
      esperar(cenario().analise.perguntas.some(p => p.id === "forma")).aSerFalso();
      esperar(cenario({ preco: 2900 }).analise.perguntas.some(p => p.id === "forma")).aSerFalso();
    });
  });

  descrever("Análise FinCK: cenários E se...?", () => {
    teste("agora, daqui a 2 meses e parcelado pela mesma regra da revelação", () => {
      const { analise, resultado } = cenario({ preco: 3500, saldo: 1600, diaADia: 1100 });
      const [agora, esperarC, parc] = analise.cenarios;
      const aportes = resultado.impacto_metas.reduce((s, m) => s + m.aporte_mensal, 0);
      const extra = Math.max(0, (3500 - 1354 - 1100) - aportes);
      const folga = Math.min(1600, Math.max(0, 1600 - 1354) + extra);
      const meta = resultado.impacto_metas.find(m => m.nome === analise.meta.nome);
      const atraso = parte => Math.min(Math.max(0, parte), meta.falta) / meta.aporte_mensal * 30;
      esperar(resultado.sobra_fora_metas).aSerPerto(extra, 6);
      esperar(resultado.folga_fora_metas).aSerPerto(folga, 6);
      esperar(agora.titulo).aSer("Agora");
      esperar(esperarC.titulo).aSer("Daqui a 2 meses");
      esperar(parc.titulo).aSer("Parcelado");
      // Agora: um pagamento hoje, contra a folga de hoje.
      esperar(agora.atraso_dias).aSerPerto(atraso(3500 - folga), 2);
      esperar(agora.atraso_dias).aSerPerto(meta.atraso_dias, 6);
      // Esperar: o mesmo pagamento depois de dois meses de sobra fora das metas.
      esperar(esperarC.acumulado).aSerPerto(2 * extra, 6);
      esperar(esperarC.atraso_dias).aSerPerto(atraso(3500 - folga - 2 * extra), 2);
      // Parcelado: dez parcelas, cada uma contra a folga e a sobra até ela.
      esperar(parc.parcela).aSerPerto(350, 6);
      const parteParc = Math.max(0, 350 - folga, 10 * 350 - folga - 9 * extra);
      esperar(parc.atraso_dias).aSerPerto(atraso(parteParc), 2);
      esperar(t(esperarC.mes)).aConter("R$ 1.750,00 por mês para juntar");
      esperar(agora.atraso_dias >= esperarC.atraso_dias).aSerVerdadeiro();
      esperar(parc.custo).aConter("sem juros");
    });

    teste("parcelar com juros nunca parece de graça: total pago e juros à vista", () => {
      const { analise } = cenario({ preco: 4000, parcelas: 24, juros: 2.5, formaConfirmada: true });
      const parc = analise.cenarios.find(c => c.id === "parcelado");
      esperar(parc.juros > 0).aSerVerdadeiro();
      esperar(t(parc.custo)).aConter(`com ${t(window.FinckUtils.moeda(parc.juros))} de juros`);
      esperar(parc.sub).aConter("de juros");
      esperar(t(analise.resumo_cenarios)).aConter("de juros");
      esperar(parc.exemplo).aSerFalso();
      // Sem a pessoa escolher a forma, o parcelado é um exemplo e diz isso.
      esperar(cenario({ preco: 4000 }).analise.cenarios[2].exemplo).aSerVerdadeiro();
    });

    teste("parcelado usa as parcelas e os juros da linha do tempo", () => {
      const { analise, linhaTempo } = cenario({ preco: 1200, parcelas: 12, juros: 2, formaConfirmada: true });
      const parc = analise.cenarios.find(c => c.id === "parcelado");
      esperar(parc.parcelas).aSer(12);
      esperar(parc.parcela).aSerPerto(linhaTempo.escolhido.resumo.parcela, 6);
      esperar(parc.juros > 0).aSerVerdadeiro();
      esperar(parc.destaque).aConter("12x de");
      esperar(parc.exemplo).aSerFalso();
    });

    teste("sem linha do tempo, o parcelado é um exemplo sem juros e diz isso", () => {
      const parc = cenario({ linha: false }).analise.cenarios.find(c => c.id === "parcelado");
      esperar(parc.exemplo).aSerVerdadeiro();
      esperar(parc.nota).aConter("Exemplo em 10x sem juros");
      esperar(parc.parcela).aSerPerto(80, 6);
    });
  });

  descrever("Análise FinCK: respostas das sugestões", () => {
    teste("cada sugestão responde com números, conta e selo", () => {
      VARIOS().forEach(({ analise }) => analise.sugestoes.forEach(s => {
        const r = E.responder(analise, s.id, { valor: s.valor });
        esperar(Boolean(r && r.titulo && r.texto)).aSerVerdadeiro();
        esperar(/R\$|\d/.test(r.texto)).aSerVerdadeiro();
        esperar(r.calculo.length >= 3).aSerVerdadeiro();
        esperar([ "confirmado", "estimativa" ].includes(r.certeza)).aSerVerdadeiro();
      }));
      esperar(E.responder(cenario().analise, "qualquer_coisa")).aSer(null);
    });

    teste("compare com uma opção de cerca de 80% do preço, arredondada", () => {
      esperar(E.valorAlternativa(800)).aSer(640);
      esperar(E.valorAlternativa(2900)).aSer(2300);
      esperar(E.valorAlternativa(79)).aSer(63);
      const { analise } = cenario();
      esperar(t(analise.sugestoes.find(s => s.id === "comparar").rotulo)).aSer("Compare com uma opção de R$ 640,00");
      const r = E.responder(analise, "comparar", { valor: 500 });
      esperar(t(r.titulo)).aSer("Uma opção de R$ 500,00");
      esperar(r.texto).aConter("25 h 9 min");
    });

    teste("por que o impacto: cita a regra fixa que decidiu o nível", () => {
      const { analise } = cenario();
      esperar(analise.sugestoes.find(s => s.id === "porque").rotulo).aSer("Por que o impacto foi considerado moderado?");
      const r = E.responder(analise, "porque");
      esperar(r.certeza).aSer("confirmado");
      esperar(r.texto).aConter("de 25% a 60% da sobra do mês após os fixos");
      esperar(r.texto).aConter("não um julgamento da compra");
    });

    teste("economizar: meses com a sobra inteira e sem mexer nas metas", () => {
      const r = E.responder(cenario({ preco: 2900 }).analise, "economizar");
      esperar(r.texto).aConter("leva cerca de 3 meses");
      esperar(r.texto).aConter("Sem mexer nos aportes das metas");
      // Um pouco acima da sobra não vira "= 1,0, cerca de 2 meses".
      const quase = E.responder(cenario({ preco: 1250, metas: [] }).analise, "economizar");
      esperar(quase.texto).aConter("O valor cabe na sobra livre de um mês");
      esperar(t(quase.calculo.find(c => c.rotulo === "Meses guardando toda a sobra").valor)).aConter("= 1,00: cerca de 1 mês");
    });

    teste("o ritmo pelo prazo não se chama aporte, e o custo real diz que é sem imprevisto", () => {
      const { analise } = cenario({ preco: 2900 });
      const r = E.responder(analise, "economizar");
      esperar(r.calculo.some(c => c.rotulo === "Ritmo que os prazos das metas pedem")).aSerVerdadeiro();
      esperar(E.contexto(analise)).aConter("custo real sem imprevisto");
      const aperto = cenario({ preco: 800, saldo: 100, fixos: 3000, diaADia: 600 }).analise.pontos.find(p => p.id === "parcelas");
      esperar(aperto.calculo.some(c => c.rotulo.startsWith("Custo real sem imprevisto"))).aSerVerdadeiro();
      esperar(aperto.texto).aConter("sem contar o imprevisto testado");
      const pq = E.responder(analise, "porque");
      esperar(pq.titulo).aSer(`Por que o impacto é ${analise.nivel_texto}?`);
      esperar(pq.texto.includes(": impacto")).aSerVerdadeiro();
      esperar(pq.texto.includes("Aqui valeu esta:")).aSerFalso();
    });
  });

  descrever("Análise FinCK: contexto enviado à FINCK AI", () => {
    teste("sem nomes de item, metas, contas ou lançamentos", () => {
      VARIOS().forEach(({ analise }) => {
        const c = E.contexto(analise);
        [ ITEM, "Viagem secreta", "Notebook do Pedro", "Conta Banco Secreto", "Farmácia do João" ].forEach(nome => esperar(c.includes(nome)).aSerFalso());
      });
    });

    teste("cabe no limite de 4000 caracteres e leva os números principais", () => {
      VARIOS().forEach(({ analise }) => esperar(E.contexto(analise).length <= 4000).aSerVerdadeiro());
      const c = t(E.contexto(cenario().analise));
      esperar(c).aConter("total R$ 800,00");
      esperar(c).aConter("Renda mensal declarada R$ 3.500,00");
      esperar(c).aConter("37% da sobra do mês");
      esperar(c).aConter("A decisão continua sendo sua.");
    });

    teste("na demonstração, o contexto avisa que são dados de exemplo", () => {
      esperar(E.contexto(cenario({ demo: true }).analise)).aConter("dados de exemplo");
      esperar(E.contexto(cenario().analise).includes("dados de exemplo")).aSerFalso();
    });
  });

  // A tela não está na lista de scripts de testes.html; ela é carregada aqui,
  // montada num bloco escondido e removida no fim de cada teste.
  const carregarTela = () => window.FinckInteligenciaUI ? Promise.resolve() : new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "js/inteligencia.js";
    s.onload = ok;
    s.onerror = () => falha(new Error("não carregou js/inteligencia.js"));
    document.head.appendChild(s);
  });
  async function montar(opcoes = {}, aoEscolher = () => {}) {
    await carregarTela();
    const host = document.createElement("section");
    host.hidden = true;
    host.style.cssText = "position:absolute;left:-9999px;width:360px";
    document.body.appendChild(host);
    const c = cenario(opcoes);
    window.FinckInteligenciaUI.mostrar({ ctx: c.ctx, entrada: c.entrada, resultado: c.resultado, linhaTempo: c.linhaTempo, host: host, aoEscolher: aoEscolher });
    return { host, c, fim: () => { window.FinckInteligenciaUI.limpar(); host.remove(); } };
  }

  descrever("Análise FinCK: tela", () => {
    teste("desenha no host, tira o hidden e escapa os nomes das metas", async () => {
      const metas = [ { id: "x", name: '<img src=x onerror="window.__xss=1">', target_amount: 3000, current_amount: 200, deadline: "2027-10-08" } ];
      const { host, fim } = await montar({ metas: metas });
      try {
        esperar(host.hidden).aSerFalso();
        esperar(Boolean(host.querySelector("h4#tituloAnaliseFinck"))).aSerVerdadeiro();
        esperar(host.querySelector("img")).aSer(null);
        esperar(host.innerHTML).aConter("&lt;img");
        esperar(host.querySelectorAll(".ponto-finck").length >= 1).aSerVerdadeiro();
        esperar(host.querySelectorAll("button:not([type])").length).aSer(0);
      } finally {
        fim();
      }
    });

    teste("responder a vida útil avisa o Reality pelo aoEscolher; a forma não é perguntada aqui", async () => {
      const escolhas = [];
      const { host, fim } = await montar({}, e => escolhas.push(e));
      try {
        host.querySelector('[data-campo="expected_months"][data-valor="24"]').click();
        esperar(JSON.stringify(escolhas[0])).aSer('{"campo":"expected_months","valor":24}');
        esperar(Boolean(host.querySelector('[data-campo="forma"]'))).aSerFalso();
      } finally {
        fim();
      }
    });

    teste("sugestões viram respostas do cálculo do FinCK, e só as 3 últimas ficam", async () => {
      const { host, fim } = await montar();
      try {
        [ "linha", "comparar", "economizar", "porque" ].forEach(id => host.querySelector(`[data-af="sugestoes"] [data-sugestao="${id}"]`).click());
        const trocas = host.querySelectorAll('[data-af="historico"] .troca-finck');
        esperar(trocas.length).aSer(3);
        esperar(trocas[0].querySelector(".troca-finck__origem").textContent).aSer("Cálculo do FinCK");
        esperar(trocas[0].querySelector(".troca-finck__pergunta").textContent).aConter("Por que o impacto");
      } finally {
        fim();
      }
    });

    teste("atualizar mantém a conversa; limpar esvazia e esconde", async () => {
      const { host, c, fim } = await montar();
      try {
        host.querySelector('[data-sugestao="economizar"]').click();
        const b = L.base(c.ctx, { hoje: HOJE, horizonte: 12 });
        b.dia_a_dia = 900;
        window.FinckInteligenciaUI.atualizar({ linhaTempo: L.analisar(b, { preco: 800, forma: "avista", parcelas: 10, juros_am: 0 }) });
        esperar(host.querySelectorAll(".troca-finck").length).aSer(1);
        window.FinckInteligenciaUI.limpar();
        esperar(host.hidden).aSerVerdadeiro();
        esperar(host.innerHTML).aSer("");
      } finally {
        fim();
      }
    });
  });
})();
