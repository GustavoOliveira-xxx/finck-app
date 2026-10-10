// Linha do tempo da compra: o que uma compra faz com os próximos meses.
//
// O FinCK of Reality mostra a compra como uma foto (horas de trabalho, peso
// no mês). Esta camada mostra o filme: mês a mês, com a renda, as despesas
// fixas, os gastos do dia a dia, as parcelas que a pessoa já tem e a parcela
// nova. E testa o imprevisto: se num mês faltar dinheiro, a diferença vira
// dívida no cartão, que cresce com juros compostos.
//
// Tudo aqui é conta determinística, sem IA: as mesmas entradas dão sempre o
// mesmo resultado, e cada fórmula está escrita em "Como calculamos" na tela.
// A IA só explica os números prontos (a pessoa escolhe pedir).
//
// Regra de cada mês i (i = 1 é o mês que vem):
//   sobra_i  = renda − fixos − dia a dia − parcelas existentes_i − parcela nova_i − imprevisto_i
//   caixa_i  = caixa_(i−1) + sobra_i − pagamento da dívida
//   Se o caixa ficaria negativo, a falta vira dívida no cartão.
//   Dívida: 1º mês com juros do rotativo, depois do parcelamento da fatura
//   (regra do Banco Central desde 2017), e o total de juros limitado a 100%
//   do valor devido (Lei 14.690/2023). Toda sobra seguinte quita a dívida.
// O mês 0 é hoje: só sai do saldo o que é pago na hora (compra à vista).

window.FinckLinhaTempo = (() => {
  const cfg = window.FINCK_CONFIG || {};
  const num = v => Number(v || 0);
  const centavos = v => Math.round(num(v) * 100) / 100;

  const PADRAO = {
    HORIZONTE_MESES: 12,
    HORIZONTE_MAX: 24,
    PARCELAS_PADRAO: 10,
    IMPREVISTO_PCT_RENDA: 15,
    IMPREVISTO_MES_PADRAO: 3,
    JANELA_MESES: 3,
    CARTAO: { ROTATIVO_AA: 436.2, PARCELADO_AA: 191.4, TETO_JUROS_PCT: 100, FONTE: "" }
  };
  const P = () => ({ ...PADRAO, ...(cfg.LINHA_DO_TEMPO || {}), CARTAO: { ...PADRAO.CARTAO, ...((cfg.LINHA_DO_TEMPO || {}).CARTAO || {}) } });

  // Taxa anual em % → taxa mensal equivalente (juros compostos):
  // (1 + a)^(1/12) − 1. Ex.: 436,2% ao ano ≈ 15,0% ao mês.
  const taxaMensal = anualPct => Math.pow(1 + num(anualPct) / 100, 1 / 12) - 1;

  // Parcela pela Tabela Price: PMT = V · i / (1 − (1 + i)^−n). Sem juros,
  // é só V / n.
  function parcelaPrice(valor, n, i) {
    const q = Math.max(1, Math.floor(num(n)));
    const taxa = num(i);
    if (taxa <= 0) return num(valor) / q;
    return num(valor) * taxa / (1 - Math.pow(1 + taxa, -q));
  }

  const chaveMes = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const mesMais = (hoje, n) => new Date(hoje.getFullYear(), hoje.getMonth() + n, 1);
  const rotuloMes = d => `${d.toLocaleDateString(cfg.LOCALE || "pt-BR", { month: "short" }).replace(".", "")}/${String(d.getFullYear()).slice(2)}`;

  // Gasto do dia a dia: saídas que não são despesa fixa, parcela nem
  // aporte em meta, na média dos últimos meses completos com movimento.
  const ehDiaADia = t => t.type === "saida" && !t.goal_id && !t.recurring_id &&
    t.source !== "recorrente" && t.source !== "parcela" && !t.reversed_at;

  function gastoDiaADiaTipico(transacoes = [], hoje = new Date(), quantos = P().JANELA_MESES) {
    const lista = (transacoes || []).filter(ehDiaADia);
    const porMes = new Map();
    lista.forEach(t => {
      const m = String(t.date || "").slice(0, 7);
      porMes.set(m, (porMes.get(m) || 0) + num(t.amount));
    });
    const comMovimento = new Set((transacoes || []).map(t => String(t.date || "").slice(0, 7)));
    const meses = [];
    for (let i = 1; i <= 12 && meses.length < quantos; i++) {
      const chave = chaveMes(mesMais(hoje, -i));
      if (comMovimento.has(chave)) meses.push(chave);
    }
    if (!meses.length) {
      // Ninguém com mês completo registrado ainda: vale o que já saiu neste
      // mês, sem extrapolar, marcado como parcial para a pessoa ajustar.
      const atual = porMes.get(chaveMes(hoje)) || 0;
      return { valor: centavos(atual), meses: 0, estimado: atual > 0, parcial: atual > 0 };
    }
    const total = meses.reduce((s, m) => s + (porMes.get(m) || 0), 0);
    return { valor: centavos(total / meses.length), meses: meses.length, estimado: true, parcial: false };
  }

  // Retrato de partida, a partir do contexto do app (FinckFinance).
  function base(ctx = {}, { hoje = new Date(), horizonte = P().HORIZONTE_MESES } = {}) {
    const H = Math.max(1, Math.min(P().HORIZONTE_MAX, Math.floor(horizonte)));
    const Plano = window.FinckPlano;
    // parcelasPorMes começa no mês de hoje: índice 0 = mês atual.
    const mapa = Plano ? Plano.parcelasPorMes(ctx.parcelamentos || [], H + 1, hoje, ctx.pagamentos || []) : {};
    const meses = [];
    const parcelas = [];
    for (let i = 0; i <= H; i++) {
      const d = mesMais(hoje, i);
      meses.push({ indice: i, chave: chaveMes(d), rotulo: rotuloMes(d) });
      parcelas.push(centavos(mapa[chaveMes(d)] || 0));
    }
    const diaADia = gastoDiaADiaTipico(ctx.transacoesRealizadas || ctx.transacoes || [], hoje);
    return {
      renda: num(ctx.perfil?.income_monthly ?? ctx.renda),
      fixos: num(ctx.despesasFixas),
      dia_a_dia: diaADia.valor,
      // Guardado à parte: a tela troca dia_a_dia pelo valor do campo, e
      // assim dá para saber se o número veio do histórico ou da pessoa.
      dia_a_dia_historico: diaADia.valor,
      dia_a_dia_meses: diaADia.meses,
      dia_a_dia_estimado: diaADia.estimado,
      dia_a_dia_parcial: Boolean(diaADia.parcial),
      saldo: num(ctx.saldo),
      parcelas_existentes: parcelas,
      meses: meses,
      horizonte: H
    };
  }

  // Detalhes da compra numa forma de pagamento.
  function detalharCompra(compra = {}) {
    const preco = num(compra.preco);
    const forma = compra.forma || "nenhuma";
    if (forma === "avista") {
      const desconto = Math.min(95, Math.max(0, num(compra.desconto_avista))) / 100;
      const total = centavos(preco * (1 - desconto));
      return { forma, preco, total, hoje: total, parcela: 0, parcelas: 0, juros_parcelamento: 0 };
    }
    if (forma === "parcelado") {
      const n = Math.max(1, Math.floor(num(compra.parcelas) || P().PARCELAS_PADRAO));
      const i = Math.max(0, num(compra.juros_am)) / 100;
      const parcela = centavos(parcelaPrice(preco, n, i));
      const total = centavos(parcela * n);
      return { forma, preco, total, hoje: 0, parcela, parcelas: n, juros_parcelamento: centavos(Math.max(0, total - preco)) };
    }
    return { forma: "nenhuma", preco: 0, total: 0, hoje: 0, parcela: 0, parcelas: 0, juros_parcelamento: 0 };
  }

  // O mês a mês de um cenário.
  function simular(b, compra = {}, { imprevisto = null, taxas = null } = {}) {
    const c = detalharCompra(compra);
    const cartao = P().CARTAO;
    const t = taxas || { rotativo: taxaMensal(cartao.ROTATIVO_AA), parcelado: taxaMensal(cartao.PARCELADO_AA) };
    const teto = num(cartao.TETO_JUROS_PCT) / 100;
    const imp = imprevisto && num(imprevisto.valor) > 0 ? { valor: num(imprevisto.valor), mes: Math.max(1, Math.floor(num(imprevisto.mes) || 1)) } : null;

    let caixa = num(b.saldo) - c.hoje;
    let divida = 0;
    let principal = 0;
    let jurosAcumulados = 0;
    let mesesDeJuros = 0;
    let jurosTotal = 0;
    if (caixa < 0) {
      divida = -caixa;
      principal = divida;
      caixa = 0;
    }
    const linhas = [ {
      indice: 0, chave: b.meses[0].chave, rotulo: b.meses[0].rotulo, hoje: true,
      pago_hoje: c.hoje, juros: 0, divida: centavos(divida), caixa: centavos(caixa)
    } ];

    for (let i = 1; i <= b.horizonte; i++) {
      const m = b.meses[i];
      const parcelaNova = c.forma === "parcelado" && i <= c.parcelas ? c.parcela : 0;
      const existentes = num(b.parcelas_existentes[i]);
      const imprevistoMes = imp && imp.mes === i ? imp.valor : 0;
      const sobra = b.renda - b.fixos - b.dia_a_dia - existentes - parcelaNova - imprevistoMes;

      // Juros sobre a dívida que veio do mês anterior.
      let juros = 0;
      if (divida > 0) {
        const taxa = mesesDeJuros === 0 ? t.rotativo : t.parcelado;
        juros = divida * taxa;
        const limite = Math.max(0, principal * teto - jurosAcumulados);
        juros = Math.min(juros, limite);
        divida += juros;
        jurosAcumulados += juros;
        jurosTotal += juros;
        mesesDeJuros += 1;
      }

      caixa += sobra;
      let pagamento = 0;
      if (caixa < 0) {
        if (divida <= 0.005) mesesDeJuros = 0;
        divida += -caixa;
        principal += -caixa;
        caixa = 0;
      } else if (divida > 0) {
        pagamento = Math.min(divida, caixa);
        divida -= pagamento;
        caixa -= pagamento;
        if (divida <= 0.005) {
          divida = 0;
          principal = 0;
          jurosAcumulados = 0;
          mesesDeJuros = 0;
        }
      }

      linhas.push({
        indice: i, chave: m.chave, rotulo: m.rotulo,
        renda: centavos(b.renda), fixos: centavos(b.fixos), dia_a_dia: centavos(b.dia_a_dia),
        parcelas_existentes: centavos(existentes), parcela_nova: centavos(parcelaNova),
        imprevisto: centavos(imprevistoMes), sobra: centavos(sobra),
        juros: centavos(juros), pagamento_divida: centavos(pagamento),
        divida: centavos(divida), caixa: centavos(caixa)
      });
    }

    const meses = linhas.slice(1);
    const comDivida = linhas.filter(l => l.divida > 0);
    const apertado = meses.reduce((pior, l) => (l.sobra < pior.sobra ? l : pior), meses[0]);
    return {
      compra: c,
      imprevisto: imp,
      linhas: linhas,
      resumo: {
        juros_cartao: centavos(jurosTotal),
        entra_no_cartao: comDivida.length > 0,
        primeiro_mes_divida: comDivida[0] || null,
        meses_com_divida: comDivida.length,
        maior_divida: centavos(Math.max(0, ...linhas.map(l => l.divida))),
        divida_final: centavos(linhas[linhas.length - 1].divida),
        caixa_final: centavos(linhas[linhas.length - 1].caixa),
        mes_mais_apertado: apertado,
        custo_total: centavos(c.total + jurosTotal)
      }
    };
  }

  // Maior imprevisto que cabe no mês k sem virar dívida: um gasto no mês k
  // tira o mesmo valor do caixa de todos os meses seguintes, então a margem
  // é o menor caixa de k em diante (num cenário que ainda não tem dívida).
  function margemDeSeguranca(cenario, mes = 1) {
    if (cenario.resumo.entra_no_cartao) return { valor: 0, mes: cenario.resumo.primeiro_mes_divida };
    const k = Math.max(1, Math.floor(num(mes) || 1));
    const seguintes = cenario.linhas.filter(l => l.indice >= k);
    if (!seguintes.length) return { valor: 0, mes: null };
    const pior = seguintes.reduce((a, l) => (l.caixa < a.caixa ? l : a), seguintes[0]);
    return { valor: centavos(Math.max(0, pior.caixa)), mes: pior };
  }

  // Juntar antes e comprar à vista: em quantos meses o caixa, sem a
  // compra, chega ao valor (e ainda sobra o que a pessoa tinha de folga).
  function juntarAntes(semCompra, alvo) {
    const valor = num(alvo);
    if (valor <= 0) return { meses: 0, linha: semCompra.linhas[0] };
    const linha = semCompra.linhas.find(l => l.caixa >= valor && !(l.divida > 0));
    if (linha) return { meses: linha.indice, linha: linha };
    const sobraMedia = semCompra.linhas.slice(1).reduce((s, l) => s + l.sobra, 0) / Math.max(1, semCompra.linhas.length - 1);
    if (sobraMedia <= 0) return { meses: null, linha: null };
    const falta = valor - semCompra.resumo.caixa_final;
    return { meses: semCompra.linhas.length - 1 + Math.ceil(falta / sobraMedia), linha: null, alem_do_horizonte: true };
  }

  // A análise completa que a tela mostra.
  function analisar(b, entrada = {}) {
    const forma = entrada.forma === "avista" ? "avista" : "parcelado";
    const compraAvista = { preco: entrada.preco, forma: "avista", desconto_avista: entrada.desconto_avista };
    const compraParcelada = { preco: entrada.preco, forma: "parcelado", parcelas: entrada.parcelas, juros_am: entrada.juros_am };
    const imp = entrada.imprevisto && num(entrada.imprevisto.valor) > 0 ? entrada.imprevisto : null;

    const cenario = compra => ({
      normal: simular(b, compra),
      imprevisto: imp ? simular(b, compra, { imprevisto: imp }) : null
    });
    const sem = cenario({ forma: "nenhuma" });
    const avista = cenario(compraAvista);
    const parcelado = cenario(compraParcelada);
    const escolhido = forma === "avista" ? avista : parcelado;
    const outro = forma === "avista" ? parcelado : avista;

    // Juros que só existem por causa da compra: a mesma vida (e o mesmo
    // imprevisto), com e sem a compra. Custo real = total pago + esses juros.
    const jurosExtras = (com, semC) => centavos(Math.max(0, com.resumo.juros_cartao - semC.resumo.juros_cartao));

    const limiteParcelas = num((cfg.DIAGNOSTICO || {}).PARCELAS_LIMITE_PCT || 30);
    const pesoParcelas = c => {
      if (b.renda <= 0) return 0;
      return Math.max(0, ...c.normal.linhas.slice(1).map(l => (l.parcelas_existentes + l.parcela_nova) / b.renda * 100));
    };

    const resumoDe = c => ({
      forma: c.normal.compra.forma,
      total: c.normal.compra.total,
      parcela: c.normal.compra.parcela,
      parcelas: c.normal.compra.parcelas,
      juros_parcelamento: c.normal.compra.juros_parcelamento,
      // À vista só é à vista de verdade se o saldo de hoje cobre o valor.
      cabe_hoje: c.normal.compra.forma !== "avista" || num(b.saldo) >= c.normal.compra.total,
      cabe_sem_imprevisto: !c.normal.resumo.entra_no_cartao,
      mes_mais_apertado: c.normal.resumo.mes_mais_apertado,
      margem_geral: margemDeSeguranca(c.normal, 1),
      margem_no_mes_do_imprevisto: imp ? margemDeSeguranca(c.normal, imp.mes) : null,
      com_imprevisto: c.imprevisto ? c.imprevisto.resumo : null,
      juros_da_compra_normal: jurosExtras(c.normal, sem.normal),
      custo_real_normal: centavos(c.normal.compra.total + jurosExtras(c.normal, sem.normal)),
      juros_da_compra: c.imprevisto ? jurosExtras(c.imprevisto, sem.imprevisto) : 0,
      custo_real: c.imprevisto ? centavos(c.normal.compra.total + jurosExtras(c.imprevisto, sem.imprevisto)) : centavos(c.normal.compra.total + jurosExtras(c.normal, sem.normal)),
      peso_parcelas_pct: pesoParcelas(c)
    });

    // Alertas descrevem o cenário simulado, sem reprimenda: o que acontece
    // com estes números, para a pessoa pesar na decisão dela.
    const sobraLivre = b.renda - b.fixos - b.dia_a_dia;
    const alertas = [];
    if (sobraLivre <= 0) {
      alertas.push("Neste cenário, mesmo sem esta compra, a renda não cobre as despesas fixas e os gastos do dia a dia informados. Qualquer compra sairia do saldo guardado ou poderia virar dívida no cartão.");
    }
    const r = resumoDe(escolhido);
    if (r.peso_parcelas_pct > limiteParcelas) {
      alertas.push(`No mês mais carregado, as parcelas somadas chegam a ${Math.round(r.peso_parcelas_pct)}% da renda, acima da referência de ${limiteParcelas}% usada pelo FinCK.`);
    }

    return {
      base: b,
      entrada: { ...entrada, forma, imprevisto: imp },
      taxas: { rotativo_am: taxaMensal(P().CARTAO.ROTATIVO_AA), parcelado_am: taxaMensal(P().CARTAO.PARCELADO_AA), ...P().CARTAO },
      sobra_livre: centavos(sobraLivre),
      sem_compra: sem,
      escolhido: { ...escolhido, resumo: r },
      outro: { ...outro, resumo: resumoDe(outro) },
      juntar_antes: juntarAntes(sem.normal, avista.normal.compra.total),
      alertas: alertas
    };
  }

  const moedaSimples = v => `R$ ${num(v).toFixed(2)}`;
  const meses = n => `${n} ${n === 1 ? "mês" : "meses"}`;
  const rotuloDoMes = (a, i) => a.base.meses[i]?.rotulo || `mês ${i}`;
  const usaCartao = a => a.escolhido.normal.resumo.entra_no_cartao || Boolean(a.escolhido.imprevisto?.resumo.entra_no_cartao);

  // A simulação em palavras: uma conclusão curta, que a tela mostra primeiro,
  // e a explicação logo depois. É a consequência do cenário simulado, nunca
  // conselho ou reprimenda: o FinCK mostra o que acontece com estes números e
  // a decisão continua sendo da pessoa.
  function leitura(a, { moeda = moedaSimples } = {}) {
    const e = a.escolhido.resumo;
    const imp = a.entrada.imprevisto;
    const ci = e.com_imprevisto;
    const ap = e.mes_mais_apertado;
    const comoFica = ap ? (ap.sobra < 0 ? `faltam ${moeda(-ap.sobra)}` : `sobram ${moeda(ap.sobra)}`) : "";
    const forma = e.forma === "avista" ? `pagando à vista ${moeda(e.total)}` : `parcelando em ${e.parcelas}x de ${moeda(e.parcela)}`;
    const semSaldo = e.forma === "avista" && !e.cabe_hoje;

    let situacao;
    let conclusao;
    if (semSaldo) {
      situacao = "sem-saldo";
      conclusao = `Neste cenário, o saldo de hoje não cobre a compra à vista de ${moeda(e.total)}.`;
    } else if (!e.cabe_sem_imprevisto) {
      situacao = "nao-fecha";
      conclusao = `Neste cenário, ${forma}, faltaria dinheiro nos próximos meses mesmo sem imprevisto.`;
    } else if (imp && ci && ci.entra_no_cartao) {
      situacao = "imprevisto-no-cartao";
      conclusao = `Neste cenário, ${forma}, a compra cabe nos próximos meses, mas o imprevisto testado levaria parte da conta para o cartão.`;
    } else if (imp && ci) {
      situacao = "cabe-com-imprevisto";
      conclusao = `Neste cenário, ${forma}, a compra cabe nos próximos meses, mesmo com o imprevisto testado.`;
    } else {
      situacao = "cabe";
      conclusao = `Neste cenário, ${forma}, a compra cabe nos próximos meses sem usar o cartão.`;
    }

    const explicacao = [];
    if (semSaldo) {
      explicacao.push(`O saldo de hoje (${moeda(a.base.saldo)}) não cobre a compra à vista de ${moeda(e.total)}. Se a fatura não for paga integralmente, o valor pode entrar no crédito rotativo, que costuma ter juros muito altos.`);
    } else if (e.forma === "avista") {
      explicacao.push(`Pagando à vista ${moeda(e.total)}, o dinheiro sai hoje e os próximos meses ficam livres desta compra. O mês mais apertado é ${ap.rotulo}, quando ${comoFica}.`);
    } else {
      explicacao.push(`Parcelando em ${e.parcelas}x de ${moeda(e.parcela)}${e.juros_parcelamento > 0 ? ` (total de ${moeda(e.total)}, com ${moeda(e.juros_parcelamento)} de juros do parcelamento)` : ""}, o mês mais apertado é ${ap.rotulo}, quando ${comoFica}.`);
    }

    if (!e.cabe_sem_imprevisto) {
      const normal = a.escolhido.normal.resumo;
      const p = normal.primeiro_mes_divida;
      if (!semSaldo) {
        explicacao.push(`Mesmo sem imprevisto, faltaria dinheiro a partir de ${p && !p.hoje ? p.rotulo : "agora"}. Se a diferença ficar na fatura do cartão sem ser paga integralmente, os juros somariam cerca de ${moeda(e.juros_da_compra_normal)}.`);
      } else if (e.juros_da_compra_normal > 0) {
        explicacao.push(`Nesse caso, mesmo sem imprevisto, a simulação soma cerca de ${moeda(e.juros_da_compra_normal)} de juros do cartão.`);
      }
      if (normal.divida_final > 0) {
        explicacao.push(`No fim da linha do tempo, ainda restariam ${moeda(normal.divida_final)} de dívida.`);
      }
    } else if (imp && ci) {
      if (ci.entra_no_cartao) {
        const soDaCompra = e.juros_da_compra < ci.juros_cartao - .01 ? ` (${moeda(e.juros_da_compra)} deles só existem por causa desta compra)` : "";
        explicacao.push(`Um imprevisto de ${moeda(imp.valor)} em ${rotuloDoMes(a, imp.mes)} não caberia: até ${moeda(ci.maior_divida)} ficariam na fatura do cartão. Se ela não for paga integralmente, os juros do rotativo e do parcelamento da fatura somariam ${moeda(ci.juros_cartao)}${soDaCompra}, com ${meses(ci.meses_com_divida)} pagando a dívida.`);
        if (e.juros_da_compra > 0) {
          explicacao.push(`Nesse cenário, esta compra de ${moeda(e.total)} passaria a custar ${moeda(e.custo_real)}.`);
        }
        if (ci.divida_final > 0) {
          explicacao.push(`No fim da linha do tempo, ainda restariam ${moeda(ci.divida_final)} de dívida.`);
        }
      } else {
        explicacao.push(`Um imprevisto de ${moeda(imp.valor)} em ${rotuloDoMes(a, imp.mes)} ainda caberia sem usar o cartão.`);
      }
    }

    // Sem histórico de gastos e sem valor informado, a conta usaria zero no
    // dia a dia e a folga sairia inflada. Em vez de supor, pergunta.
    const perguntas = [];
    if (!a.base.dia_a_dia_estimado && num(a.base.dia_a_dia) <= 0) {
      perguntas.push({
        chave: "dia_a_dia",
        texto: `Quanto você gasta por mês no dia a dia (mercado, transporte, lazer)? O FinCK ainda não tem esse histórico, e sem ele a simulação considera ${moeda(0)}.`
      });
    }
    return { situacao, conclusao, explicacao, perguntas };
  }

  // De onde vem cada número: o que está registrado no FinCK (dado
  // confirmado) e o que é estimativa ou hipótese de teste. A tela mostra os
  // dois grupos separados, e a FINCK AI recebe a mesma separação.
  function numerosUsados(a) {
    const b = a.base;
    const parcelas = (b.parcelas_existentes || []).slice(1, b.horizonte + 1);
    const maiorParcela = centavos(Math.max(0, ...parcelas));
    const mesesComParcela = parcelas.filter(v => v > 0).length;
    const historico = b.dia_a_dia_historico;
    const informado = historico !== undefined && Math.abs(num(b.dia_a_dia) - num(historico)) > .005;
    const confirmados = [
      { chave: "renda", rotulo: "Renda por mês", valor: centavos(b.renda), detalhe: "informada no seu perfil" },
      { chave: "fixos", rotulo: "Despesas fixas por mês", valor: centavos(b.fixos), detalhe: "contas recorrentes registradas no FinCK" },
      { chave: "parcelas", rotulo: "Parcelas que você já tem", valor: maiorParcela,
        detalhe: mesesComParcela ? `até este valor por mês, em ${mesesComParcela} dos próximos ${meses(b.horizonte)}` : "nenhuma registrada para os próximos meses" },
      { chave: "saldo", rotulo: "Saldo hoje", valor: centavos(b.saldo), detalhe: "registrado no FinCK" },
      { chave: "preco", rotulo: "Preço da compra", valor: centavos(a.entrada.preco), detalhe: "o que você informou nesta análise" }
    ];
    const estimativas = [ {
      chave: "dia_a_dia", rotulo: "Gastos do dia a dia por mês", valor: centavos(b.dia_a_dia),
      detalhe: informado ? "valor que você informou"
        : b.dia_a_dia_parcial ? "só o que saiu neste mês até agora"
          : b.dia_a_dia_estimado ? `média dos últimos ${meses(b.dia_a_dia_meses)} do seu histórico`
            : "ainda sem histórico de gastos"
    } ];
    if (a.entrada.imprevisto) {
      estimativas.push({ chave: "imprevisto", rotulo: "Imprevisto", valor: centavos(a.entrada.imprevisto.valor),
        detalhe: `hipotético, em ${rotuloDoMes(a, a.entrada.imprevisto.mes)}, só para testar a folga` });
    }
    if (usaCartao(a)) {
      estimativas.push({ chave: "juros_cartao", rotulo: "Juros do cartão", valor: null, taxa_am: a.taxas.rotativo_am,
        detalhe: "no rotativo, pela taxa média do Banco Central; a do seu cartão pode ser outra" });
    }
    return { confirmados, estimativas };
  }

  // Resumo em texto para a FINCK AI explicar. Só números já calculados:
  // a IA não refaz conta nenhuma, e cada número vai marcado como dado
  // confirmado ou estimativa. O nome do item só entra se quem chama passar;
  // a tela do Reality não passa, para ir só número para fora.
  function paraIA(a, { item = "", moeda = moedaSimples } = {}) {
    const e = a.escolhido.resumo;
    const o = a.outro.resumo;
    const u = numerosUsados(a);
    const valorDe = i => (i.valor !== null ? ` ${moeda(i.valor)}`
      : i.taxa_am ? ` de cerca de ${(i.taxa_am * 100).toFixed(1).replace(".", ",")}% ao mês` : "");
    const grupo = itens => itens.map(i => `${i.rotulo.toLowerCase()}${valorDe(i)} (${i.detalhe})`).join("; ");
    const forma = r => (r.forma === "avista" ? `à vista por ${moeda(r.total)}${r.cabe_hoje ? "" : " (o saldo de hoje não cobre)"}` : `em ${r.parcelas}x de ${moeda(r.parcela)} (total ${moeda(r.total)})`);
    const linhas = [
      `${item ? `Compra: ${item}, preço` : "Compra de"} ${moeda(a.entrada.preco)}. Forma escolhida: ${forma(e)}. Alternativa: ${forma(o)}.`,
      `Conclusão calculada pelo FinCK: ${leitura(a, { moeda }).conclusao}`,
      `Dados confirmados: ${grupo(u.confirmados.filter(i => i.chave !== "preco"))}.`,
      `Estimativas: ${grupo(u.estimativas)}. Sobra livre por mês: ${moeda(a.sobra_livre)}.`,
      `Mês mais apertado com a compra: ${e.mes_mais_apertado?.rotulo}, sobra de ${moeda(e.mes_mais_apertado?.sobra)}.`,
      e.cabe_sem_imprevisto
        ? `Sem imprevisto, a compra cabe sem dívida. Maior imprevisto que aguenta sem entrar no cartão: ${moeda(e.margem_geral.valor)} (pior mês: ${e.margem_geral.mes?.rotulo || "-"}).`
        : `Mesmo sem imprevisto, neste cenário falta dinheiro e a diferença ficaria na fatura do cartão: juros de ${moeda(a.escolhido.normal.resumo.juros_cartao)} se ela não for paga integralmente.`
    ];
    if (a.entrada.imprevisto && e.com_imprevisto) {
      const ci = e.com_imprevisto;
      linhas.push(ci.entra_no_cartao
        ? `Com um imprevisto de ${moeda(a.entrada.imprevisto.valor)} no mês ${a.entrada.imprevisto.mes}: entra no cartão, dívida máxima ${moeda(ci.maior_divida)}, ${meses(ci.meses_com_divida)} com dívida, juros de ${moeda(ci.juros_cartao)}. Juros que existem por causa da compra: ${moeda(e.juros_da_compra)}. Custo real da compra nesse cenário: ${moeda(e.custo_real)}.`
        : `Com um imprevisto de ${moeda(a.entrada.imprevisto.valor)} no mês ${a.entrada.imprevisto.mes}: ainda cabe sem dívida.`);
      if (o.com_imprevisto) {
        linhas.push(`Na alternativa (${o.forma === "avista" ? "à vista" : "parcelado"}), com o mesmo imprevisto: ${o.com_imprevisto.entra_no_cartao ? `juros de ${moeda(o.com_imprevisto.juros_cartao)}, custo real ${moeda(o.custo_real)}` : "cabe sem dívida"}.`);
      }
    }
    const j = a.juntar_antes;
    if (j.meses === 0) linhas.push("Juntar antes: o saldo de hoje já cobre a compra à vista.");
    else if (j.meses) linhas.push(`Juntar antes: com a sobra atual, dá para pagar à vista em cerca de ${j.meses} meses.`);
    a.alertas.forEach(t => linhas.push(`Alerta: ${t}`));
    return linhas.join("\n");
  }

  return {
    taxaMensal,
    parcelaPrice,
    gastoDiaADiaTipico,
    base,
    detalharCompra,
    simular,
    margemDeSeguranca,
    juntarAntes,
    analisar,
    leitura,
    numerosUsados,
    paraIA
  };
})();
