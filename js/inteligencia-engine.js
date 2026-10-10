// Análise FinCK: a leitura da compra dentro do resultado do FinCK of Reality.
//
// Este motor não é IA. Ele junta os números que o Reality, as metas e a linha
// do tempo já calcularam, escolhe só os pontos que podem mudar a decisão e
// guarda, para cada um, os fatores considerados e a cadeia da conta. Assim a
// tela consegue responder "por que o FinCK diz isso?" sem mágica.
//
// A FINCK AI entra só quando a pessoa faz uma pergunta livre, e recebe apenas
// o texto de contexto(): números, sem nome de item, meta, conta ou lançamento.
//
// Puro: sem DOM e sem rede. As mesmas entradas dão sempre a mesma análise.
window.FinckInteligencia = (() => {
  const cfg = window.FINCK_CONFIG || {};
  const LT = cfg.LINHA_DO_TEMPO || {};
  const DG = cfg.DIAGNOSTICO || {};
  const num = v => Number(v) || 0;

  // Critérios de relevância e de pergunta. São referências de design do
  // projeto, num lugar só para poderem ser lidas e discutidas; não são dados
  // de pesquisa. As que vêm do config usam a mesma régua do resto do app.
  const P = {
    // Se tudo vira destaque, nada é destaque: no máximo três pontos, só os
    // que passam da relevância mínima e não repetem a revelação (o peso no
    // mês, o saldo que não cobre e o atraso na meta já estão nela).
    MAX_PONTOS: 3,
    RELEVANCIA_MINIMA: 40,
    MESES_ESPERA: 2,
    // "Compare com uma opção de R$ X": uma opção 20% mais barata, arredondada.
    FRACAO_ALTERNATIVA: .8,
    VIDA_UTIL_OPCOES: [ 12, 24, 36 ],
    // Abaixo disso a vida útil quase não muda a conversa, então não se pergunta.
    VIDA_UTIL_MINIMO_REAIS: 100,
    VIDA_UTIL_MINIMO_PCT_RENDA: 3,
    CATEGORIAS_SEM_VIDA_UTIL: [ "Alimentação" ],
    // A forma de pagamento só é perguntada quando a compra pesa no mês.
    FORMA_MINIMO_PCT_RENDA: 5,
    // Saldo que sobra depois da compra menor que um mês de despesas fixas.
    SALDO_COLCHAO_MESES: 1,
    // Mesma referência do imprevisto de teste da linha do tempo.
    FOLGA_PCT_RENDA: num(LT.IMPREVISTO_PCT_RENDA) || 15,
    PARCELAS_ATENCAO_PCT: num(DG.PARCELAS_ATENCAO_PCT) || 15,
    PARCELAS_LIMITE_PCT: num(DG.PARCELAS_LIMITE_PCT) || 30,
    PARCELAS_PADRAO: num(LT.PARCELAS_PADRAO) || 10,
    LIMITE_CONTEXTO: 4000
  };

  // As mesmas faixas de FinckReality.semaforo (js/reality.js), na mesma
  // ordem: a primeira regra que se aplica decide o nível.
  const REGRAS_IMPACTO = {
    deficit_fixos: "as despesas fixas já superam a renda do mês, então qualquer compra sai do saldo guardado: impacto alto",
    sem_caixa: "o saldo depois da compra ficaria negativo: impacto alto",
    sem_caixa60: "com as entradas e saídas já previstas para os próximos 60 dias, o caixa ficaria negativo: impacto alto",
    sem_projetado: "descontando as parcelas que faltam pagar, o saldo ficaria negativo: impacto alto",
    renda_livre: {
      alerta: "60% ou mais da sobra do mês após os fixos: impacto alto",
      atencao: "de 25% a 60% da sobra do mês após os fixos: impacto moderado"
    },
    percentual_renda: {
      alerta: "30% ou mais da renda mensal: impacto alto",
      atencao: "de 10% a 30% da renda mensal: impacto moderado"
    },
    impacto_meta: "leve no mês, mas 20% ou mais do que falta para uma meta: impacto moderado",
    folga: "menos de 10% da renda e menos de 25% da sobra, sem pesar numa meta: impacto baixo"
  };
  const NIVEL_TEXTO = { verde: "baixo", atencao: "moderado", alerta: "alto" };
  const FECHO = "A decisão continua sendo sua.";

  // ------------------------------------------------------------ formatação

  const U = () => window.FinckUtils;
  const moeda = v => U() ? U().moeda(v) : `R$ ${num(v).toFixed(2).replace(".", ",")}`;
  const numero = (v, casas = 0) => U() ? U().numero(v, casas) : num(v).toFixed(casas).replace(".", ",");
  // 37%, 3,7%, 4%: casa decimal só quando ela muda a leitura.
  function pct(v) {
    const a = Math.abs(num(v));
    const casas = a < 10 && Math.abs(a - Math.round(a)) >= .05 ? 1 : 0;
    return `${numero(v, casas)}%`;
  }
  const tempo = (horas, horasDia) => window.FinckReality ? window.FinckReality.formatarTempo(horas, horasDia).horas : `${Math.round(num(horas))} h`;
  const meses = n => `${n} ${n === 1 ? "mês" : "meses"}`;
  const rotuloMes = d => `${d.toLocaleDateString(cfg.LOCALE || "pt-BR", { month: "short" }).replace(".", "")}/${String(d.getFullYear()).slice(2)}`;

  // O atraso tem um formato só no app inteiro (FinckReality.textoAtraso):
  // "+12 dias", "+2,5 meses", "sem atraso".
  const R = () => window.FinckReality;
  const textoAtraso = dias => R().textoAtraso(dias);
  // Para frases: "aumenta cerca de 4,5 meses", "não muda".
  function efeitoNoPrazo(dias) {
    if (dias === null || dias === undefined) {
      return "fica sem estimativa";
    }
    return Math.round(dias) < 1 ? "não muda" : `aumenta cerca de ${R().textoDuracao(dias)}`;
  }
  const ROTULO_APORTES = {
    ritmo: "Aportes nas metas (média dos últimos 90 dias)",
    prazo: "Ritmo que os prazos das metas pedem",
    misto: "Aportes e prazos das metas"
  };
  const rotuloAportes = base => ROTULO_APORTES[base] || "Ritmo das metas";

  // Valor redondo para a opção de comparação: de 50 em 50 acima de mil, de
  // 10 em 10 acima de cem, de 1 em 1 abaixo disso.
  function valorAlternativa(total) {
    const alvo = total * P.FRACAO_ALTERNATIVA;
    const passo = total >= 1000 ? 50 : total >= 100 ? 10 : 1;
    const redondo = Math.round(alvo / passo) * passo;
    return redondo > 0 && redondo < total ? redondo : Math.round(alvo * 100) / 100;
  }

  // ------------------------------------------------------- dados de entrada

  function resumoDaLinha(lt) {
    const e = lt && lt.escolhido && lt.escolhido.resumo;
    if (!e) {
      return null;
    }
    const o = lt.outro && lt.outro.resumo || null;
    const parcelado = e.forma === "parcelado" ? e : o && o.forma === "parcelado" ? o : null;
    const apertado = r => r && r.mes_mais_apertado ? { rotulo: String(r.mes_mais_apertado.rotulo || ""), sobra: num(r.mes_mais_apertado.sobra) } : null;
    const divida = lt.escolhido.normal && lt.escolhido.normal.resumo && lt.escolhido.normal.resumo.primeiro_mes_divida;
    return {
      forma: e.forma === "avista" ? "avista" : "parcelado",
      parcelas: num(e.parcelas),
      parcela: num(e.parcela),
      total: num(e.total),
      cabe_hoje: e.cabe_hoje !== false,
      cabe_sem_imprevisto: e.cabe_sem_imprevisto !== false,
      mes_apertado: apertado(e),
      folga: num(e.margem_geral && e.margem_geral.valor),
      custo_real: num(e.custo_real_normal !== undefined ? e.custo_real_normal : e.custo_real),
      juros_cartao: num(e.juros_da_compra_normal),
      peso_parcelas_pct: num(e.peso_parcelas_pct),
      primeiro_mes_divida: divida ? String(divida.rotulo || "") : null,
      juros_am: num(lt.entrada && lt.entrada.juros_am),
      parcelado: parcelado ? {
        n: num(parcelado.parcelas),
        parcela: num(parcelado.parcela),
        total: num(parcelado.total),
        juros: num(parcelado.juros_parcelamento),
        cabe_sem_imprevisto: parcelado.cabe_sem_imprevisto !== false,
        mes_apertado: apertado(parcelado)
      } : null,
      sobra_livre: lt.sobra_livre !== undefined ? num(lt.sobra_livre) : null,
      dia_a_dia: num(lt.base && lt.base.dia_a_dia),
      juntar_meses: lt.juntar_antes ? lt.juntar_antes.meses : null,
      leitura: lerLinha(lt)
    };
  }
  function lerLinha(lt) {
    const L = window.FinckLinhaTempo;
    try {
      const l = L && L.leitura ? L.leitura(lt, { moeda: moeda }) : null;
      return l ? { conclusao: String(l.conclusao || ""), explicacao: (l.explicacao || []).map(String) } : null;
    } catch {
      return null;
    }
  }

  // A meta que mais sente a compra: a de maior atraso (a regra única de
  // FinckReality, já calculada em impacto_metas); sem ritmo para estimar
  // prazo, a que perde a maior fatia do que ainda falta.
  function metaMaisAfetada(impacto, total) {
    const ativas = (impacto || []).filter(m => num(m.falta) > 0);
    if (!ativas.length) {
      return null;
    }
    const lista = ativas.map(m => {
      const aporte = num(m.aporte_mensal);
      return {
        nome: String(m.nome || "sua meta"),
        atual: num(m.atual),
        alvo: num(m.alvo),
        falta: num(m.falta),
        aporte_mensal: aporte,
        base: aporte > 0 ? m.base_atraso || "ritmo" : "trabalho",
        atraso: aporte > 0 && m.atraso_dias !== null && m.atraso_dias !== undefined ? num(m.atraso_dias) : null,
        pct_restante: total / num(m.falta) * 100,
        cobre: total >= num(m.falta)
      };
    });
    lista.sort((a, b) => (b.atraso ?? -1) - (a.atraso ?? -1) || b.pct_restante - a.pct_restante);
    return { ...lista[0], ativas: lista.length };
  }

  // ------------------------------------------------------------------ pontos

  function pontoImpacto(n, nivel) {
    const horas = n.horas > 0 ? ` e ${tempo(n.horas, n.horas_dia)} de trabalho` : "";
    let texto;
    if (n.renda <= 0) {
      texto = "Sem renda informada, o FinCK não consegue medir o peso desta compra no mês nem convertê-la em horas.";
    } else if (n.sem_folga) {
      texto = `As despesas fixas já consomem toda a renda do mês, então esta compra sairia do saldo guardado. Ela equivale a ${pct(n.pct_renda)} da renda mensal${horas}.`;
    } else {
      texto = `Essa compra representa ${pct(n.pct_sobra)} da sua sobra do mês (renda menos despesas fixas)${horas}.`;
    }
    const calculo = [
      { rotulo: "Renda considerada", valor: moeda(n.renda) },
      { rotulo: "Jornada", valor: `${numero(n.dias_mes, 0)} dias por mês, ${numero(n.horas_dia, n.horas_dia % 1 ? 1 : 0)} h por dia` },
      { rotulo: "Valor da hora", valor: `${moeda(n.renda)} ÷ ${numero(n.dias_mes, 0)} ÷ ${numero(n.horas_dia, n.horas_dia % 1 ? 1 : 0)} = ${moeda(n.valor_hora)}` },
      { rotulo: "Horas de trabalho", valor: `${moeda(n.total)} ÷ ${moeda(n.valor_hora)} = ${tempo(n.horas, n.horas_dia)}` },
      { rotulo: "Sobra do mês após os fixos", valor: `${moeda(n.renda)} − ${moeda(n.fixos)} = ${moeda(n.sobra_apos_fixos)}` }
    ];
    if (n.pct_sobra !== null) {
      calculo.push({ rotulo: "Peso na sobra do mês", valor: `${moeda(n.total)} ÷ ${moeda(n.sobra_mes)} = ${pct(n.pct_sobra)}` });
    }
    return {
      id: "impacto",
      titulo: "Impacto no mês",
      texto: texto,
      certeza: "confirmado",
      // O impacto ancora a análise: ele sempre aparece, com peso pelo nível.
      relevancia: { alerta: 88, atencao: 68 }[nivel] || 45,
      fatores: [
        `sua renda mensal declarada (${moeda(n.renda)})`,
        `as despesas fixas registradas (${moeda(n.fixos)})`,
        `o valor da compra (${moeda(n.total)})`,
        `a sua jornada (${numero(n.dias_mes, 0)} dias por mês, ${numero(n.horas_dia, n.horas_dia % 1 ? 1 : 0)} h por dia)`
      ],
      calculo: calculo
    };
  }

  function pontoSaldo(n) {
    const base = [
      { rotulo: "Saldo de hoje", valor: moeda(n.saldo) },
      { rotulo: "Saldo depois da compra", valor: `${moeda(n.saldo)} − ${moeda(n.total)} = ${moeda(n.saldo_depois)}` }
    ];
    const fatores = [ `o saldo registrado hoje (${moeda(n.saldo)})`, `o valor da compra (${moeda(n.total)})` ];
    if (n.saldo_depois < 0) {
      return {
        id: "saldo", titulo: "Saldo", certeza: "confirmado", relevancia: 95, motivo: "sem_caixa",
        texto: `Hoje o saldo não cobre a compra: faltariam ${moeda(-n.saldo_depois)}. O dinheiro para pagá-la ainda não entrou.`,
        fatores: fatores, calculo: base
      };
    }
    if (n.menor_caixa_depois !== null && n.menor_caixa_depois < 0) {
      return {
        id: "saldo", titulo: "Contas já previstas", certeza: "confirmado", relevancia: 88, motivo: "sem_caixa60",
        texto: `Cabe no saldo de hoje, mas, somando as entradas e saídas já previstas para os próximos 60 dias, o caixa chegaria a ${moeda(n.menor_caixa_depois)} no ponto mais baixo.`,
        fatores: [ ...fatores, "as entradas e saídas já previstas para os próximos 60 dias, na ordem das datas" ],
        calculo: [ ...base, { rotulo: "Ponto mais baixo do caixa, sem a compra", valor: moeda(n.menor_caixa) }, { rotulo: "Ponto mais baixo, com a compra", valor: `${moeda(n.menor_caixa)} − ${moeda(n.total)} = ${moeda(n.menor_caixa_depois)}` } ]
      };
    }
    if (n.compromissos > 0 && n.disponivel_depois < 0) {
      return {
        id: "saldo", titulo: "Saldo e parcelas", certeza: "confirmado", relevancia: 85, motivo: "sem_projetado",
        texto: `Cabe no saldo de hoje, mas você ainda tem ${moeda(n.compromissos)} em parcelas a pagar. Descontando as parcelas, faltariam ${moeda(-n.disponivel_depois)}.`,
        fatores: [ ...fatores, `as parcelas que faltam pagar (${moeda(n.compromissos)})` ],
        calculo: [ ...base, { rotulo: "Parcelas a pagar", valor: moeda(n.compromissos) }, { rotulo: "Saldo depois das parcelas e da compra", valor: `${moeda(n.saldo_depois)} − ${moeda(n.compromissos)} = ${moeda(n.disponivel_depois)}` } ]
      };
    }
    const colchao = n.fixos * P.SALDO_COLCHAO_MESES;
    if (colchao > 0 && n.saldo_depois < colchao) {
      return {
        id: "saldo", titulo: "Saldo que fica", certeza: "confirmado", relevancia: 62, motivo: "colchao",
        texto: `Depois da compra, o saldo fica em ${moeda(n.saldo_depois)}, menos que um mês das suas despesas fixas (${moeda(n.fixos)}).`,
        fatores: [ ...fatores, `as despesas fixas de um mês (${moeda(n.fixos)})` ],
        calculo: [ ...base, { rotulo: "Despesas fixas de um mês", valor: moeda(n.fixos) } ]
      };
    }
    return null;
  }

  function pontoMeta(n, meta) {
    if (!meta) {
      return null;
    }
    const guardado = `Meta “${meta.nome}”: ${moeda(meta.atual)} guardados → continua ${moeda(meta.atual)} se comprar agora.`;
    let texto;
    let relevancia;
    let motivo;
    if (meta.atraso === null) {
      texto = `${guardado} A compra equivale a ${pct(meta.pct_restante)} do que ainda falta (${moeda(meta.falta)}). Com aportes registrados na meta, o FinCK estima o prazo.`;
      relevancia = meta.pct_restante >= 50 ? 70 : meta.pct_restante >= 20 ? 55 : 35;
      motivo = "sem_ritmo";
    } else if (Math.round(meta.atraso) < 1) {
      texto = `${guardado} A compra cabe na folga fora das metas (${moeda(n.folga_hoje)} hoje), então o prazo estimado não muda.`;
      relevancia = 30;
      motivo = "sem_atraso";
    } else {
      const d = Math.round(meta.atraso);
      texto = `${guardado} Prazo estimado: ${textoAtraso(meta.atraso)}. O guardado não sai da meta; o que muda é o tempo até completá-la.`;
      relevancia = d >= 90 ? 84 : d >= 30 ? 74 : d >= 7 ? 58 : 35;
      motivo = "prazo";
      if (meta.pct_restante >= 50) {
        relevancia = Math.max(relevancia, 70);
      }
    }
    if (meta.cobre) {
      // O prazo a mais já está na revelação; aqui fica só o que é novo.
      texto = `${motivo === "prazo" ? guardado : texto} Esse valor seria suficiente para concluir a meta hoje (faltam ${moeda(meta.falta)}).`;
      relevancia = Math.max(relevancia, 78);
      motivo = "cobre";
    }
    const calculo = [
      { rotulo: "Guardado na meta", valor: moeda(meta.atual) },
      { rotulo: "Falta para a meta", valor: `${moeda(meta.alvo)} − ${moeda(meta.atual)} = ${moeda(meta.falta)}` }
    ];
    if (meta.atraso !== null) {
      const parte = Math.min(n.parte_metas, meta.falta);
      calculo.push({ rotulo: "Folga fora das metas hoje", valor: moeda(n.folga_hoje) });
      calculo.push({ rotulo: "Parte que sai das metas", valor: `${moeda(n.total)} − ${moeda(n.folga_hoje)} = ${moeda(n.parte_metas)}` });
      calculo.push({ rotulo: meta.base === "ritmo" ? "Seu ritmo de aportes (últimos 90 dias)" : "Ritmo que o prazo da meta pede", valor: `${moeda(meta.aporte_mensal)} por mês` });
      calculo.push({ rotulo: "Prazo estimado a mais", valor: `${moeda(parte)} ÷ ${moeda(meta.aporte_mensal)} por mês = ${textoAtraso(meta.atraso)}` });
    } else {
      calculo.push({ rotulo: "Parte do que falta", valor: `${moeda(n.total)} ÷ ${moeda(meta.falta)} = ${pct(meta.pct_restante)}` });
    }
    return {
      id: "meta",
      titulo: "Meta",
      texto: texto,
      certeza: "estimativa",
      relevancia: relevancia,
      motivo: motivo,
      fatores: [
        `quanto falta para a meta (${moeda(meta.falta)})`,
        meta.base === "ritmo" ? `o seu ritmo real de aportes nos últimos 90 dias (${moeda(meta.aporte_mensal)} por mês)` : meta.base === "prazo" ? `o ritmo que o prazo da meta pede (${moeda(meta.aporte_mensal)} por mês)` : "a meta ainda não tem aportes recentes nem prazo, então não há ritmo para estimar dias",
        `a folga fora das metas hoje (${moeda(n.folga_hoje)}): o saldo acima de um mês de despesas fixas mais a sobra deste mês que não vai para as metas`,
        `o valor da compra (${moeda(n.total)})`
      ],
      nao_considera: "rendimento do dinheiro guardado e mudanças futuras no seu ritmo de aportes.",
      calculo: calculo
    };
  }

  function pontoDurabilidade(n) {
    if (!(n.meses_uso > 0)) {
      return null;
    }
    const m = n.meses_uso;
    const dobro = m * 2;
    const caro = n.renda > 0 && n.total >= n.renda * .1;
    const pesoMes = n.sobra_mes > 0 ? n.por_mes_uso / n.sobra_mes * 100 : 0;
    return {
      id: "durabilidade",
      titulo: "Durabilidade",
      texto: `Com uso esperado de ${meses(m)}, o custo fica em ${moeda(n.por_mes_uso)} por mês de uso. Se durar o dobro (${meses(dobro)}), cairia para ${moeda(n.total / dobro)}.`,
      certeza: "estimativa",
      relevancia: m <= 12 && caro ? 72 : pesoMes >= 5 ? 60 : 46,
      fatores: [ `o preço total (${moeda(n.total)})`, `a vida útil que você informou (${meses(m)})` ],
      nao_considera: "manutenção, garantia e quanto o item vale numa revenda.",
      calculo: [
        { rotulo: "Preço total", valor: moeda(n.total) },
        { rotulo: "Uso esperado", valor: meses(m) },
        { rotulo: "Custo por mês de uso", valor: `${moeda(n.total)} ÷ ${m} = ${moeda(n.por_mes_uso)}` },
        { rotulo: "Se durar o dobro", valor: `${moeda(n.total)} ÷ ${dobro} = ${moeda(n.total / dobro)}` }
      ]
    };
  }

  function pontoOportunidade(n) {
    if (!(n.total_guardado > 0)) {
      return null;
    }
    const p = n.pct_guardado;
    const texto = p <= 100 ? `Essa compra equivale a ${pct(p)} do que você já guardou nas suas metas (${moeda(n.total_guardado)}).` : `Essa compra é maior que tudo o que você já guardou nas suas metas (${moeda(n.total_guardado)}): equivale a ${numero(p / 100, 1)} vezes esse valor.`;
    return {
      id: "oportunidade",
      titulo: "Oportunidade",
      texto: texto,
      certeza: "confirmado",
      relevancia: p >= 75 ? 66 : p >= 40 ? 52 : p >= 20 ? 42 : 25,
      fatores: [ `o que já está guardado nas suas metas (${moeda(n.total_guardado)})`, `o valor da compra (${moeda(n.total)})` ],
      calculo: [
        { rotulo: "Guardado nas metas", valor: moeda(n.total_guardado) },
        { rotulo: "Compra", valor: moeda(n.total) },
        { rotulo: "Proporção", valor: `${moeda(n.total)} ÷ ${moeda(n.total_guardado)} = ${pct(p)}` }
      ]
    };
  }

  // Só vira ponto quando a simulação dos próximos meses mostra aperto.
  function pontoParcelas(n, linha, jaFalouDoSaldo) {
    if (!linha) {
      return null;
    }
    const forma = linha.forma === "avista" ? `à vista por ${moeda(linha.total)}` : `em ${linha.parcelas}x de ${moeda(linha.parcela)}`;
    const ap = linha.mes_apertado;
    let texto = null;
    let relevancia = 0;
    let motivo = null;
    if (linha.forma === "avista" && !linha.cabe_hoje) {
      if (jaFalouDoSaldo) {
        return null;
      }
      texto = `Pagando ${forma}, o saldo de hoje não cobre o valor. Passar no cartão sem ter o dinheiro da fatura pode levar ao rotativo, que costuma ter juros muito altos.`;
      relevancia = 90;
      motivo = "avista";
    } else if (!linha.cabe_sem_imprevisto) {
      texto = `Pagando ${forma}, a simulação dos próximos meses não fecha sem usar o cartão${linha.primeiro_mes_divida ? ` a partir de ${linha.primeiro_mes_divida}` : ""}: seriam ${moeda(linha.juros_cartao)} de juros por causa desta compra, sem contar o imprevisto testado.`;
      relevancia = 92;
      motivo = "cartao";
    } else if (linha.peso_parcelas_pct > P.PARCELAS_LIMITE_PCT) {
      texto = `Pagando ${forma}, no mês mais carregado as parcelas somadas chegam a ${pct(linha.peso_parcelas_pct)} da renda, acima da referência de ${P.PARCELAS_LIMITE_PCT}%.`;
      relevancia = 80;
      motivo = "parcelas";
    } else if (ap && ap.sobra < 0) {
      texto = `Pagando ${forma}, em ${ap.rotulo} a sobra do mês fica negativa (faltam ${moeda(-ap.sobra)}); o saldo guardado cobre a diferença.`;
      relevancia = 70;
      motivo = "apertado";
    } else if (n.renda > 0 && linha.folga < n.renda * P.FOLGA_PCT_RENDA / 100) {
      texto = `Pagando ${forma}, a folga para imprevistos fica em ${moeda(linha.folga)} no pior mês, menos que um imprevisto de ${P.FOLGA_PCT_RENDA}% da renda (${moeda(n.renda * P.FOLGA_PCT_RENDA / 100)}).`;
      relevancia = 60;
      motivo = "folga";
    } else if (linha.peso_parcelas_pct > P.PARCELAS_ATENCAO_PCT) {
      texto = `Pagando ${forma}, no mês mais carregado as parcelas somadas chegam a ${pct(linha.peso_parcelas_pct)} da renda.`;
      relevancia = 50;
      motivo = "parcelas";
    }
    if (!texto) {
      return null;
    }
    const calculo = [ { rotulo: "Forma simulada", valor: forma } ];
    if (ap) {
      calculo.push({ rotulo: "Mês mais apertado", valor: `${ap.rotulo}: ${ap.sobra < 0 ? `faltam ${moeda(-ap.sobra)}` : `sobram ${moeda(ap.sobra)}`}` });
    }
    if (linha.peso_parcelas_pct > 0) {
      calculo.push({ rotulo: "Parcelas no mês mais carregado", valor: `${pct(linha.peso_parcelas_pct)} da renda` });
    }
    calculo.push({ rotulo: "Folga para imprevistos", valor: moeda(linha.cabe_sem_imprevisto ? linha.folga : 0) });
    calculo.push({ rotulo: "Custo real sem imprevisto (total mais juros da compra)", valor: moeda(linha.custo_real) });
    return {
      id: "parcelas",
      titulo: linha.forma === "parcelado" ? "Parcelas" : "Próximos meses",
      texto: texto,
      certeza: "estimativa",
      relevancia: relevancia,
      motivo: motivo,
      fatores: [
        "a forma de pagamento simulada na linha do tempo",
        "renda, despesas fixas e gastos do dia a dia iguais todo mês",
        "as parcelas que você já tem",
        "o saldo de hoje como ponto de partida"
      ],
      nao_considera: "entradas extras e lançamentos agendados.",
      calculo: calculo
    };
  }

  // ----------------------------------------------------------------- leitura

  // "Nossa leitura": uma frase de consultor sobre o maior ponto de atenção,
  // escrita por regra. Mostra o que pesa, nunca diz o que fazer.
  function leituraDe(ponto, n, nivel) {
    let texto;
    switch (ponto && ponto.id) {
      case "saldo":
        texto = ponto.motivo === "sem_caixa"
          ? "O maior ponto de atenção é o momento: hoje o saldo não cobre a compra, então ela dependeria de crédito ou da próxima entrada de dinheiro."
          : ponto.motivo === "sem_caixa60"
            ? "O maior ponto de atenção é o calendário: a compra cabe hoje, mas disputa espaço com contas que já estão marcadas para os próximos dias."
            : ponto.motivo === "sem_projetado"
            ? "O maior ponto de atenção são os compromissos que você já assumiu: a compra cabe hoje, mas disputa espaço com as parcelas que ainda vão vencer."
            : "O maior ponto de atenção é o que sobra de reserva: depois da compra, o saldo cobre menos de um mês das despesas fixas.";
        break;
      case "meta":
        texto = ponto.motivo === "cobre"
          ? "O valor desta compra seria suficiente para concluir uma das suas metas hoje: o ponto é qual das duas coisas você quer primeiro."
          : ponto.motivo === "prazo"
            ? `Financeiramente, o maior ponto de atenção não é o preço isolado, mas o tempo que ele tira da sua meta: pela conta do FinCK, o prazo estimado ${efeitoNoPrazo(n.meta_atraso)}.`
            : `O maior ponto de atenção é o tamanho da compra perto do que ainda falta para a sua meta: ela equivale a ${pct(n.meta_pct_restante)} desse valor.`;
        break;
      case "durabilidade":
        texto = "Financeiramente, o maior ponto de atenção não é o preço isolado, mas a relação entre custo e tempo de uso.";
        break;
      case "oportunidade":
        texto = `O maior ponto de atenção é o tamanho da compra perto do que você já guardou: ela equivale a ${pct(n.pct_guardado)} das suas economias para metas.`;
        break;
      case "parcelas":
        texto = {
          avista: "O maior ponto de atenção é o momento do pagamento: à vista, o saldo de hoje não cobre o valor.",
          cartao: "O maior ponto de atenção está nos próximos meses: na simulação, a conta não fecha sem usar o cartão, e o rotativo costuma ter juros muito altos.",
          parcelas: "O maior ponto de atenção está nos próximos meses: somadas, as parcelas ocupam uma parte grande da renda.",
          apertado: "O maior ponto de atenção está nos próximos meses: há um mês em que a sobra fica negativa.",
          folga: "O maior ponto de atenção é a folga para imprevistos, que fica pequena nos próximos meses."
        }[ponto.motivo] || "O maior ponto de atenção está nos próximos meses.";
        break;
      default:
        texto = n.renda <= 0
          ? "Sem a renda mensal, o FinCK não consegue dizer quanto esta compra pesa para você."
          : nivel === "alerta"
            ? n.sem_folga
              ? "O impacto financeiro é alto para o seu cenário atual: as despesas fixas já levam toda a renda, então a compra sairia do saldo guardado."
              : "O impacto financeiro é alto para o seu cenário atual: a compra ocupa uma parte grande do que sobra no mês."
            : nivel === "atencao"
              ? "A compra cabe no mês, mas reduz a folga que você teria para o resto dele."
              : "A compra cabe com folga no seu cenário atual. Se quiser, vale comparar durabilidade e uso antes de fechar.";
    }
    return { texto: `${texto} ${FECHO}`, ponto: ponto ? ponto.id : null };
  }

  // --------------------------------------------------------------- perguntas

  function perguntasDe(n, entrada, linha, formaConfirmada) {
    const lista = [];
    const categoria = String(entrada.category || "");
    const pesa = valorMinimo => n.total >= valorMinimo;
    if (!(n.meses_uso > 0) && !P.CATEGORIAS_SEM_VIDA_UTIL.includes(categoria) && pesa(Math.max(P.VIDA_UTIL_MINIMO_REAIS, n.renda * P.VIDA_UTIL_MINIMO_PCT_RENDA / 100))) {
      lista.push({
        id: "vida_util",
        campo: "expected_months",
        pergunta: "Você pretende usar por quanto tempo?",
        ajuda: "Isso ajuda o FinCK a comparar o preço com a durabilidade.",
        opcoes: P.VIDA_UTIL_OPCOES.map(m => ({ rotulo: meses(m), valor: m }))
      });
    }
    // A forma de pagamento é perguntada uma vez só, na linha do tempo
    // ("Como você pagaria?"), e não aqui de novo.
    return lista;
  }

  // ---------------------------------------------------------------- cenários

  // Os três cenários usam a regra única do atraso (FinckReality.parteDasMetas),
  // a mesma da revelação: cada pagamento usa primeiro a folga fora das metas
  // de hoje e a sobra fora das metas dos meses até ele; só o que passa disso
  // sai do que iria para a meta e vira atraso. Comprar agora é um pagamento
  // hoje; esperar, um pagamento daqui a dois meses; parcelar, uma parcela por
  // mês, com os juros dentro de cada parcela.
  function cenariosDe(n, meta, linha, hoje, formaConfirmada) {
    const regra = { folgaHoje: n.folga_hoje, sobraExtra: n.sobra_extra };
    const parteDe = pagamentos => R().parteDasMetas(pagamentos, regra);
    const atrasoDe = parte => meta && meta.aporte_mensal > 0 ? R().atrasoDias(parte, meta) : null;
    const naMeta = d => !meta ? "sem meta em andamento" : meta.aporte_mensal > 0 ? textoAtraso(d) : "sem ritmo de aportes para estimar";
    const noMes = (valor, quando) => `${moeda(valor)} ${quando}${n.sobra_mes > 0 ? ` (${pct(valor / n.sobra_mes * 100)} da sobra)` : ""}`;
    const extra = n.sobra_extra;

    const parteAgora = parteDe([ { mes: 0, valor: n.total } ]);
    const atrasoAgora = atrasoDe(parteAgora);
    const agora = {
      id: "agora",
      titulo: "Agora",
      destaque: moeda(n.total),
      sub: "sai de uma vez",
      meta: naMeta(atrasoAgora),
      mes: noMes(n.total, "de uma vez"),
      custo: moeda(n.total),
      nota: n.saldo_depois < 0 ? "O saldo de hoje não cobre." : null,
      atraso_dias: atrasoAgora,
      nao_coberto: parteAgora,
      mes_valor: n.total
    };

    const espera = P.MESES_ESPERA;
    const acumulado = extra * espera;
    const naoCobertoEspera = parteDe([ { mes: espera, valor: n.total } ]);
    const atrasoEspera = atrasoDe(naoCobertoEspera);
    const quando = hoje instanceof Date && !Number.isNaN(hoje.getTime()) ? rotuloMes(new Date(hoje.getFullYear(), hoje.getMonth() + espera, 1)) : null;
    const esperar = {
      id: "esperar",
      titulo: `Daqui a ${espera} meses`,
      destaque: moeda(n.total),
      sub: quando ? `em ${quando}, mesmo preço` : "mesmo preço",
      meta: naMeta(atrasoEspera),
      mes: noMes(n.total / espera, "por mês para juntar"),
      custo: `${moeda(n.total)}, se o preço não mudar`,
      nota: extra > 0 ? `Em ${espera} meses, a sobra fora das metas junta ${moeda(acumulado)}.` : "Hoje não sobra dinheiro fora das metas para juntar.",
      atraso_dias: atrasoEspera,
      acumulado: acumulado,
      nao_coberto: naoCobertoEspera,
      mes_valor: n.total / espera
    };

    const lp = linha && linha.parcelado;
    const parc = lp && lp.n > 0 ? { n: lp.n, parcela: lp.parcela, total: lp.total, juros: lp.juros, cabe: lp.cabe_sem_imprevisto } : { n: P.PARCELAS_PADRAO, parcela: n.total / P.PARCELAS_PADRAO, total: n.total, juros: 0, cabe: true };
    // Enquanto a pessoa não escolhe a forma na linha do tempo, o parcelado é
    // um exemplo, e a tela diz isso.
    parc.exemplo = !lp || !formaConfirmada;
    const naoCobertoParc = parteDe(Array.from({ length: parc.n }, (_, i) => ({ mes: i, valor: parc.parcela })));
    const atrasoParc = atrasoDe(naoCobertoParc);
    const notaParc = [
      parc.exemplo ? `Exemplo em ${parc.n}x${parc.juros > 0 ? "" : " sem juros"}; a forma se escolhe na linha do tempo.` : null,
      parc.cabe ? null : "Na simulação, a conta não fecha sem o cartão."
    ].filter(Boolean).join(" ");
    const parcelado = {
      id: "parcelado",
      titulo: "Parcelado",
      destaque: `${parc.n}x de ${moeda(parc.parcela)}`,
      sub: parc.juros > 0 ? `com ${moeda(parc.juros)} de juros` : "sem juros",
      meta: naMeta(atrasoParc),
      mes: noMes(parc.parcela, "por mês"),
      // Parcelar com juros nunca aparece de graça: o total pago fica à vista.
      custo: parc.juros > 0 ? `${moeda(parc.total)}, com ${moeda(parc.juros)} de juros` : `${moeda(parc.total)}, sem juros`,
      nota: notaParc || null,
      atraso_dias: atrasoParc,
      parcelas: parc.n,
      parcela: parc.parcela,
      total_pago: parc.total,
      juros: parc.juros,
      exemplo: parc.exemplo,
      nao_coberto: naoCobertoParc,
      mes_valor: parc.parcela
    };
    return [ agora, esperar, parcelado ];
  }

  // A linha que fica à vista com os cenários recolhidos.
  function resumoCenarios(cen, meta) {
    const [agora, esperar, parcelado] = cen;
    const juros = parcelado.juros > 0 ? ` Parcelado custa ${moeda(parcelado.juros)} de juros.` : "";
    if (meta && meta.aporte_mensal > 0) {
      return `Na meta: agora, ${agora.meta}; daqui a ${P.MESES_ESPERA} meses, ${esperar.meta}; parcelado, ${parcelado.meta}.${juros}`;
    }
    return `Agora ${agora.destaque} de uma vez; daqui a ${P.MESES_ESPERA} meses, ${moeda(esperar.mes_valor)} por mês para juntar; parcelado, ${parcelado.destaque}.${juros}`;
  }

  // ------------------------------------------------------------------ análise

  function analisar({ ctx = {}, entrada = {}, resultado = null, linhaTempo = null, hoje = new Date(), formaConfirmada = false, demo = false } = {}) {
    if (!resultado) {
      return null;
    }
    const perfil = ctx && ctx.perfil || {};
    const padrao = cfg.PADRAO || {};
    const qtd = num(entrada.quantity) > 0 ? Math.floor(num(entrada.quantity)) : 1;
    const total = num(resultado.custo_de_uso && resultado.custo_de_uso.total) || num(resultado.price) * qtd;
    const renda = num(resultado.income_monthly);
    const sobraAposFixos = num(resultado.sobra_apos_fixos);
    const fixos = Math.max(0, renda - sobraAposFixos) || num(ctx.despesasFixas);
    const sobraMes = num(resultado.renda_livre);
    const valorHora = num(resultado.valor_hora);
    const linha = resumoDaLinha(linhaTempo);
    const impacto = resultado.impacto_metas || [];
    const meta = metaMaisAfetada(impacto, total);
    const totalGuardado = impacto.reduce((s, m) => s + num(m.atual), 0);
    // Aportes, sobra livre e folga vêm do FinckReality.calcular: a mesma
    // conta que a revelação e o bloco de metas usam.
    const sobraLivre = resultado.sobra_livre !== undefined ? num(resultado.sobra_livre) : sobraMes;
    const diaADia = num(resultado.dia_a_dia);
    const finitoOuNulo = v => v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);
    const mesesUso = num(entrada.expected_months) || num(resultado.custo_de_uso && resultado.custo_de_uso.meses_de_uso) || null;

    const n = {
      total: total,
      preco_unitario: num(resultado.price),
      quantidade: qtd,
      renda: renda,
      fixos: fixos,
      sobra_apos_fixos: sobraAposFixos,
      sobra_mes: sobraMes,
      sem_folga: Boolean(resultado.sem_folga),
      saldo: num(resultado.saldo_antes),
      saldo_depois: num(resultado.saldo_antes) - total,
      compromissos: num(resultado.compromissos_futuros),
      disponivel_depois: num(resultado.disponivel_projetado) - total,
      menor_caixa: finitoOuNulo(resultado.menor_caixa_60),
      menor_caixa_depois: finitoOuNulo(resultado.menor_caixa_60_depois),
      valor_hora: valorHora,
      valor_dia: num(resultado.valor_dia),
      horas: valorHora > 0 ? total / valorHora : 0,
      horas_dia: num(perfil.work_hours_day) || num(padrao.work_hours_day) || 8,
      dias_mes: num(perfil.work_days_month) || num(padrao.work_days_month) || 22,
      pct_renda: renda > 0 ? total / renda * 100 : null,
      pct_sobra: sobraMes > 0 ? total / sobraMes * 100 : null,
      meses_uso: mesesUso,
      por_mes_uso: mesesUso ? total / mesesUso : null,
      total_guardado: totalGuardado,
      pct_guardado: totalGuardado > 0 ? total / totalGuardado * 100 : null,
      aportes_metas: num(resultado.aportes_metas),
      base_aportes: resultado.base_aportes || null,
      sobra_livre: sobraLivre,
      sobra_livre_com_dia_a_dia: diaADia > 0,
      dia_a_dia: diaADia > 0 ? diaADia : null,
      sobra_extra: num(resultado.sobra_fora_metas),
      folga_hoje: num(resultado.folga_fora_metas),
      parte_metas: num(resultado.parte_das_metas),
      meta_atraso: meta ? meta.atraso : null,
      meta_pct_restante: meta ? meta.pct_restante : null
    };

    const semaforo = resultado.semaforo || {};
    const nivel = semaforo.nivel || "verde";
    const pSaldo = pontoSaldo(n);
    const candidatos = [
      pontoImpacto(n, nivel),
      pSaldo,
      pontoMeta(n, meta),
      pontoDurabilidade(n),
      pontoOportunidade(n),
      pontoParcelas(n, linha, Boolean(pSaldo && pSaldo.motivo === "sem_caixa"))
    ].filter(Boolean).map(p => ({ ...p, na_revelacao: repeteRevelacao(p) }));
    const ordem = [ "saldo", "impacto", "meta", "parcelas", "durabilidade", "oportunidade" ];
    const porRelevancia = (a, b) => b.relevancia - a.relevancia || ordem.indexOf(a.id) - ordem.indexOf(b.id);
    const relevantes = candidatos.filter(p => p.relevancia >= P.RELEVANCIA_MINIMA).sort(porRelevancia);
    // Na tela, só o que é novo: o que a revelação já mostra fica de fora.
    const pontos = relevantes
      .filter(p => !p.na_revelacao)
      .slice(0, P.MAX_PONTOS)
      .map((p, i) => ({ ...p, numero: String(i + 1).padStart(2, "0") }));
    // A leitura olha para tudo, inclusive o que está na revelação.
    const principal = candidatos.slice().sort(porRelevancia)[0] || null;

    const alternativa = valorAlternativa(total);
    const rotuloNivel = NIVEL_TEXTO[nivel] || "baixo";
    const cenarios = cenariosDe(n, meta, linha, hoje, formaConfirmada);
    return {
      versao: 2,
      demo: Boolean(demo),
      forma_confirmada: Boolean(formaConfirmada),
      item: {
        nome: String(entrada.item_name || ""),
        categoria: String(entrada.category || "Outros"),
        quantidade: qtd,
        total: total
      },
      nivel: nivel,
      nivel_texto: rotuloNivel,
      semaforo: {
        nivel: nivel,
        motivo: semaforo.motivo || "folga",
        regra: REGRAS_IMPACTO[semaforo.motivo] ? typeof REGRAS_IMPACTO[semaforo.motivo] === "string" ? REGRAS_IMPACTO[semaforo.motivo] : REGRAS_IMPACTO[semaforo.motivo][nivel] || "" : "",
        // Os números que a régua do semáforo viu, já sobre o total da compra.
        pct_renda: num(resultado.income_percent),
        pct_sobra: num(resultado.percentual_renda_livre),
        saldo_depois: num(resultado.saldo_depois)
      },
      numeros: n,
      meta: meta,
      linha: linha,
      pontos: pontos,
      // Os pontos que a revelação já mostra: não aparecem no bloco, mas
      // contam para a leitura e para o contexto da FINCK AI.
      pontos_da_revelacao: relevantes.filter(p => p.na_revelacao),
      cabecalho: !pontos.length ? "A revelação acima já mostra o que mais pesa nesta compra." : pontos.length === 1 ? "Além da revelação, 1 ponto pode influenciar sua decisão." : `Além da revelação, ${pontos.length} pontos podem influenciar sua decisão.`,
      leitura: leituraDe(principal, n, nivel),
      perguntas: perguntasDe(n, entrada, linha, formaConfirmada),
      cenarios: cenarios,
      resumo_cenarios: resumoCenarios(cenarios, meta),
      alternativa_valor: alternativa,
      sugestoes: [
        linha ? { id: "linha", rotulo: "Explicar a simulação dos próximos meses" } : null,
        { id: "comparar", rotulo: `Compare com uma opção de ${moeda(alternativa)}`, valor: alternativa },
        { id: "economizar", rotulo: "Quanto tempo preciso economizar?" },
        { id: "porque", rotulo: `Por que o impacto foi considerado ${rotuloNivel}?` }
      ].filter(Boolean)
    };
  }

  // O que a revelação (a cadeia, o selo e a frase-síntese) já mostra com o
  // mesmo número: o peso no mês e as horas, o saldo que não cobre, as contas
  // previstas ou as parcelas que passam do saldo, e o atraso na meta.
  function repeteRevelacao(p) {
    if (p.id === "impacto") {
      return true;
    }
    if (p.id === "saldo") {
      return p.motivo !== "colchao";
    }
    return p.id === "meta" && p.motivo === "prazo";
  }

  // --------------------------------------------------------------- respostas

  // As sugestões da conversa são respondidas aqui, na hora, com a conta à
  // vista. É cálculo do FinCK, não texto de IA.
  function responder(analise, id, extra = {}) {
    if (!analise) {
      return null;
    }
    const n = analise.numeros;
    const meta = analise.meta;
    const cen = Object.fromEntries((analise.cenarios || []).map(c => [ c.id, c ]));
    const naMeta = (d, comparado) => meta ? meta.aporte_mensal > 0 ? ` Na meta “${meta.nome}”, o prazo estimado ${efeitoNoPrazo(d)}.${comparado !== undefined ? ` Comprando agora: ${textoAtraso(comparado, false)}.` : ""}` : ` A meta “${meta.nome}” ainda não tem ritmo de aportes para estimar prazo.` : "";
    const pesoSobra = v => n.sobra_mes > 0 ? pct(v / n.sobra_mes * 100) : "sem sobra mensal";
    const sobraLivreRotulo = n.sobra_livre_com_dia_a_dia ? "Sobra livre do mês (renda − fixos − dia a dia)" : "Sobra do mês após os fixos";

    if (id === "parcelar") {
      const c = cen.parcelado;
      const linha = analise.linha;
      const lp = linha && linha.parcelado;
      let texto = n.sobra_mes > 0 ? `Cada parcela usa ${pesoSobra(c.parcela)} da sua sobra do mês após os fixos, contra ${pesoSobra(n.total)} pagando tudo agora.` : `Sem sobra no mês depois dos fixos, cada parcela de ${moeda(c.parcela)} sairia do saldo guardado.`;
      texto += c.juros > 0 ? ` Com juros de ${numero(linha ? linha.juros_am : 0, 2)}% ao mês, o total vai para ${moeda(c.total_pago)} (${moeda(c.juros)} a mais).` : ` Sem juros, o total continua ${moeda(n.total)}.`;
      texto += naMeta(c.atraso_dias, cen.agora.atraso_dias);
      if (lp && lp.mes_apertado) {
        texto += ` Na simulação dos próximos meses, o mês mais apertado é ${lp.mes_apertado.rotulo}, quando ${lp.mes_apertado.sobra < 0 ? `faltam ${moeda(-lp.mes_apertado.sobra)}` : `sobram ${moeda(lp.mes_apertado.sobra)}`}.`;
      }
      if (lp && !lp.cabe_sem_imprevisto) {
        texto += " A conta não fecha sem usar o cartão, e o rotativo costuma ter juros muito altos.";
      }
      if (c.exemplo) {
        texto += ` As ${c.parcelas} parcelas são um exemplo: em “E nos próximos meses?” você escolhe a forma, o número de parcelas e os juros reais.`;
      }
      const calculo = [
        { rotulo: "Compra", valor: moeda(n.total) },
        { rotulo: "Parcelas", valor: `${c.parcelas}x de ${moeda(c.parcela)}` },
        { rotulo: "Total pago", valor: moeda(c.total_pago) },
        { rotulo: "Sobra do mês após os fixos", valor: moeda(n.sobra_mes) },
        { rotulo: "Peso de cada parcela", valor: n.sobra_mes > 0 ? `${moeda(c.parcela)} ÷ ${moeda(n.sobra_mes)} = ${pesoSobra(c.parcela)}` : "sem sobra após os fixos" }
      ];
      if (meta && meta.aporte_mensal > 0) {
        calculo.push({ rotulo: "Sobra fora das metas", valor: `${moeda(n.sobra_livre)} − ${moeda(n.aportes_metas)} = ${moeda(n.sobra_extra)} por mês` });
        calculo.push({ rotulo: "Folga fora das metas hoje", valor: moeda(n.folga_hoje) });
        calculo.push({ rotulo: "Parte que sai das metas", valor: moeda(c.nao_coberto) });
        calculo.push({ rotulo: "Prazo estimado da meta", valor: textoAtraso(c.atraso_dias) });
      }
      return { titulo: `Parcelando em ${c.parcelas}x de ${moeda(c.parcela)}`, texto: texto, calculo: calculo, certeza: "estimativa" };
    }

    if (id === "esperar") {
      const c = cen.esperar;
      const m = P.MESES_ESPERA;
      let texto;
      if (n.sobra_extra <= 0) {
        texto = `Hoje a sobra do mês já vai inteira para as metas e os gastos do dia a dia, ou não existe. Esperar ${m} meses não junta dinheiro extra, então o efeito na meta seria parecido com o de comprar agora.`;
      } else {
        texto = `Em ${m} meses, a sobra fora das metas soma cerca de ${moeda(c.acumulado)}, além da folga de hoje (${moeda(n.folga_hoje)}).`;
        texto += c.nao_coberto <= 0 ? " Isso cobre a compra sem mexer no ritmo das metas." : ` Isso cobre ${pct((n.total - c.nao_coberto) / n.total * 100)} da compra; o restante (${moeda(c.nao_coberto)}) ainda sairia do que iria para as metas.`;
      }
      texto += naMeta(c.atraso_dias, cen.agora.atraso_dias);
      texto += n.sobra_mes > 0 ? ` Separando ${moeda(n.total / m)} por mês, são ${pesoSobra(n.total / m)} da sobra de cada mês.` : ` Seriam ${moeda(n.total / m)} por mês, sem sobra após os fixos para cobrir.`;
      texto += " O preço pode mudar até lá.";
      return {
        titulo: `Esperando ${m} meses`,
        texto: texto,
        calculo: [
          { rotulo: sobraLivreRotulo, valor: moeda(n.sobra_livre) },
          { rotulo: rotuloAportes(n.base_aportes), valor: `${moeda(n.aportes_metas)} por mês` },
          { rotulo: "Sobra fora das metas", valor: `${moeda(n.sobra_livre)} − ${moeda(n.aportes_metas)} = ${moeda(n.sobra_extra)}` },
          { rotulo: `Juntado em ${m} meses`, valor: `${m} × ${moeda(n.sobra_extra)} = ${moeda(c.acumulado)}` },
          { rotulo: "Folga fora das metas hoje", valor: moeda(n.folga_hoje) },
          { rotulo: "Parte que ainda sairia das metas", valor: moeda(c.nao_coberto) },
          { rotulo: "Prazo estimado da meta", valor: meta ? textoAtraso(c.atraso_dias) : "sem meta em andamento" }
        ],
        certeza: "estimativa"
      };
    }

    if (id === "comparar") {
      const x = num(extra && extra.valor) > 0 ? num(extra.valor) : analise.alternativa_valor;
      const eco = n.total - x;
      const horasX = n.valor_hora > 0 ? x / n.valor_hora : 0;
      const horasEco = n.valor_hora > 0 ? Math.abs(eco) / n.valor_hora : 0;
      const atrasoX = meta && meta.aporte_mensal > 0 ? R().atrasoDias(R().parteDasMetas([ { mes: 0, valor: x } ], { folgaHoje: n.folga_hoje, sobraExtra: n.sobra_extra }), meta) : null;
      let texto = `Por ${moeda(x)}, a compra custaria ${tempo(horasX, n.horas_dia)} de trabalho, ${tempo(horasEco, n.horas_dia)} ${eco >= 0 ? "a menos" : "a mais"}`;
      texto += n.sobra_mes > 0 ? `, e ocuparia ${pesoSobra(x)} da sua sobra do mês após os fixos (contra ${pesoSobra(n.total)}).` : ". Sem sobra no mês depois dos fixos, ela também sairia do saldo guardado.";
      texto += naMeta(atrasoX, cen.agora.atraso_dias);
      if (n.meses_uso > 0) {
        texto += ` Com a mesma vida útil de ${meses(n.meses_uso)}, custaria ${moeda(x / n.meses_uso)} por mês de uso.`;
      }
      texto += " Para comparar com uma opção real, use “Comparar com outra opção” no fim do resultado.";
      return {
        titulo: `Uma opção de ${moeda(x)}`,
        texto: texto,
        calculo: [
          { rotulo: "Preço desta opção", valor: moeda(x) },
          { rotulo: "Valor da sua hora", valor: moeda(n.valor_hora) },
          { rotulo: "Horas de trabalho", valor: `${moeda(x)} ÷ ${moeda(n.valor_hora)} = ${tempo(horasX, n.horas_dia)}` },
          { rotulo: "Diferença para a compra analisada", valor: `${moeda(n.total)} − ${moeda(x)} = ${moeda(eco)}` },
          { rotulo: "Peso na sobra do mês", valor: pesoSobra(x) }
        ],
        certeza: "estimativa"
      };
    }

    if (id === "economizar") {
      const calculo = [ { rotulo: "Compra", valor: moeda(n.total) }, { rotulo: sobraLivreRotulo, valor: moeda(n.sobra_livre) } ];
      // Meses inteiros, com uma folga de 1%: R$ 800 numa sobra de R$ 796,95
      // é "cerca de 1 mês", não 2.
      const mesesPara = (valor, porMes) => Math.max(1, Math.ceil(valor / porMes - .01));
      const conta = (valor, porMes) => `${moeda(valor)} ÷ ${moeda(porMes)} = ${numero(valor / porMes, 2)}: cerca de ${meses(mesesPara(valor, porMes))}`;
      let texto;
      if (n.sobra_livre <= 0) {
        texto = "Hoje não sobra dinheiro no mês depois das despesas, então não dá para estimar um prazo só com a sobra.";
      } else {
        const mesesTudo = mesesPara(n.total, n.sobra_livre);
        texto = mesesTudo <= 1 ? `O valor cabe na sobra livre de um mês (${moeda(n.sobra_livre)}).` : `Guardando toda a sobra livre do mês (${moeda(n.sobra_livre)}), leva cerca de ${meses(mesesTudo)}.`;
        calculo.push({ rotulo: "Meses guardando toda a sobra", valor: conta(n.total, n.sobra_livre) });
        if (n.aportes_metas > 0) {
          calculo.push({ rotulo: rotuloAportes(n.base_aportes), valor: `${moeda(n.aportes_metas)} por mês` });
          if (n.sobra_extra > 0) {
            texto += ` Sem mexer nos aportes das metas (sobram ${moeda(n.sobra_extra)} por mês), leva cerca de ${meses(mesesPara(n.total, n.sobra_extra))}.`;
            calculo.push({ rotulo: "Meses sem mexer nas metas", valor: conta(n.total, n.sobra_extra) });
          } else {
            texto += " Sem mexer nos aportes das metas, não sobra dinheiro para juntar.";
          }
        }
      }
      const j = analise.linha ? analise.linha.juntar_meses : null;
      if (j === 0) {
        texto += " O saldo de hoje já cobre o valor à vista: a pergunta é de onde você prefere que o dinheiro saia.";
      } else if (j > 0) {
        texto += ` Pela linha do tempo, contando o saldo de hoje, dá para pagar à vista em cerca de ${meses(j)}.`;
      }
      if (n.horas > 0) {
        texto += ` Em tempo de trabalho, são ${tempo(n.horas, n.horas_dia)}.`;
        calculo.push({ rotulo: "Horas de trabalho", valor: tempo(n.horas, n.horas_dia) });
      }
      return { titulo: `Para juntar ${moeda(n.total)}`, texto: texto, calculo: calculo, certeza: "estimativa" };
    }

    if (id === "linha") {
      const l = analise.linha;
      if (!l) {
        return null;
      }
      const forma = l.forma === "avista" ? `à vista por ${moeda(l.total)}` : `em ${l.parcelas}x de ${moeda(l.parcela)}`;
      const leitura = l.leitura ? [ l.leitura.conclusao, ...l.leitura.explicacao ].filter(Boolean).join(" ") : "";
      const exemplo = analise.forma_confirmada ? "" : "Exemplo, até você escolher a forma de pagamento: ";
      const texto = `${exemplo}${leitura || `Pagando ${forma}, o mês mais apertado é ${l.mes_apertado ? l.mes_apertado.rotulo : "o primeiro"}.`} É uma simulação com renda e despesas iguais todo mês, não uma previsão garantida.`;
      const calculo = [ { rotulo: "Forma simulada", valor: `${forma}${analise.forma_confirmada ? "" : " (exemplo)"}` } ];
      if (l.mes_apertado) {
        calculo.push({ rotulo: "Mês mais apertado", valor: `${l.mes_apertado.rotulo}: ${l.mes_apertado.sobra < 0 ? `faltam ${moeda(-l.mes_apertado.sobra)}` : `sobram ${moeda(l.mes_apertado.sobra)}`}` });
      }
      calculo.push({ rotulo: "Folga para imprevistos", valor: moeda(l.cabe_sem_imprevisto ? l.folga : 0) });
      calculo.push({ rotulo: "Custo real sem imprevisto", valor: moeda(l.custo_real) });
      return { titulo: "A simulação dos próximos meses", texto: texto, calculo: calculo, certeza: "estimativa" };
    }

    if (id === "porque") {
      const s = analise.semaforo;
      const unidades = n.quantidade > 1 ? ` (${n.quantidade} unidades)` : "";
      const texto = `O FinCK classifica o impacto por regras fixas, sempre na mesma ordem, e para na primeira que se aplica. A regra que valeu aqui foi “${s.regra || "nenhuma regra de alerta"}”. A compra${unidades} equivale a ${pct(s.pct_renda)} da renda mensal e ${s.pct_sobra > 0 ? `${pct(s.pct_sobra)} da sobra após os fixos` : "não há sobra após os fixos para comparar"}; o saldo depois dela fica em ${moeda(s.saldo_depois)}. É uma régua de impacto no orçamento, não um julgamento da compra.`;
      return {
        titulo: `Por que o impacto é ${analise.nivel_texto}?`,
        texto: texto,
        calculo: [
          { rotulo: "Parte da renda mensal", valor: pct(s.pct_renda) },
          { rotulo: "Parte da sobra após os fixos", valor: s.pct_sobra > 0 ? pct(s.pct_sobra) : "sem sobra" },
          { rotulo: "Saldo depois da compra", valor: moeda(s.saldo_depois) },
          { rotulo: "Regra aplicada", valor: s.regra || "sem regra de alerta" }
        ],
        certeza: "confirmado"
      };
    }
    return null;
  }

  // ---------------------------------------------------------------- contexto

  // O que vai para a FINCK AI quando a pessoa faz uma pergunta livre: só
  // números e rótulos genéricos. Nada de nome do item, das metas, das contas
  // ou de lançamentos, mesmo que a tela mostre esses nomes.
  function contexto(analise) {
    if (!analise) {
      return "";
    }
    const n = analise.numeros;
    const meta = analise.meta;
    const linha = analise.linha;
    const cen = Object.fromEntries((analise.cenarios || []).map(c => [ c.id, c ]));
    const base = meta ? { ritmo: "ritmo real dos últimos 90 dias", prazo: "ritmo que o prazo da meta pede" }[meta.base] || "sem ritmo de aportes" : "";
    const linhas = [
      "Números da análise de compra feita pelo FinCK (valores em reais). Nomes do item, de metas, contas e lançamentos não são enviados.",
      analise.demo ? "Modo demonstração: são dados de exemplo, não de uma pessoa real." : null,
      `Compra: categoria ${analise.item.categoria}; ${n.quantidade > 1 ? `${n.quantidade} unidades de ${moeda(n.preco_unitario)}, ` : ""}total ${moeda(n.total)}.`,
      `Renda mensal declarada ${moeda(n.renda)}; despesas fixas ${moeda(n.fixos)}; sobra do mês após os fixos ${moeda(n.sobra_mes)}${n.sem_folga ? " (as despesas fixas já consomem toda a renda)" : ""}.`,
      `Saldo hoje ${moeda(n.saldo)}; saldo depois da compra ${moeda(n.saldo_depois)}.${n.compromissos > 0 ? ` Parcelas a pagar ${moeda(n.compromissos)}; saldo depois das parcelas e da compra ${moeda(n.disponivel_depois)}.` : ""}${n.menor_caixa !== null ? ` Ponto mais baixo do caixa nos próximos 60 dias, com entradas e saídas previstas: ${moeda(n.menor_caixa)} sem a compra, ${moeda(n.menor_caixa_depois)} com ela.` : ""}`,
      n.horas > 0 ? `Tempo de trabalho: ${tempo(n.horas, n.horas_dia)}; valor da hora ${moeda(n.valor_hora)} (jornada de ${numero(n.dias_mes, 0)} dias por mês e ${numero(n.horas_dia, n.horas_dia % 1 ? 1 : 0)} h por dia).` : "Tempo de trabalho: sem renda informada para calcular.",
      `Peso: ${n.pct_renda !== null ? `${pct(n.pct_renda)} da renda mensal` : "sem renda"}; ${n.pct_sobra !== null ? `${pct(n.pct_sobra)} da sobra do mês` : "sem sobra mensal para comparar"}. Nível pela régua do FinCK: impacto ${analise.nivel_texto}${analise.semaforo.regra ? ` (${analise.semaforo.regra})` : ""}.`,
      meta ? `Metas: ${meta.ativas} em andamento; total já guardado nelas ${moeda(n.total_guardado)}, e a compra equivale a ${pct(n.pct_guardado)} disso. Meta mais afetada: guardado ${moeda(meta.atual)} de ${moeda(meta.alvo)}, faltam ${moeda(meta.falta)}; ${meta.aporte_mensal > 0 ? `ritmo considerado ${moeda(meta.aporte_mensal)} por mês (${base}); prazo estimado se comprar agora: ${textoAtraso(meta.atraso)}.` : "sem ritmo de aportes para estimar prazo."}` : n.total_guardado > 0 ? `Metas: nenhuma em andamento; total guardado nelas ${moeda(n.total_guardado)}.` : "Metas: nenhuma meta em andamento.",
      n.meses_uso > 0 ? `Vida útil informada pela pessoa: ${meses(n.meses_uso)}; custo por mês de uso ${moeda(n.por_mes_uso)}.` : "Vida útil: não informada.",
      `Sobra livre por mês ${moeda(n.sobra_livre)}${n.sobra_livre_com_dia_a_dia ? ` (renda menos fixos menos gastos do dia a dia de ${moeda(n.dia_a_dia)})` : " (renda menos fixos)"}; ${rotuloAportes(n.base_aportes).toLowerCase()} ${moeda(n.aportes_metas)} por mês; sobra fora das metas ${moeda(n.sobra_extra)} por mês; folga fora das metas hoje ${moeda(n.folga_hoje)}.`,
      linha ? `Linha do tempo (simulação, renda e despesas iguais todo mês): forma ${linha.forma === "avista" ? `à vista por ${moeda(linha.total)}` : `parcelado em ${linha.parcelas}x de ${moeda(linha.parcela)}`}, ${analise.forma_confirmada ? "confirmada pela pessoa" : "ainda não confirmada pela pessoa"}; ${linha.mes_apertado ? `mês mais apertado ${linha.mes_apertado.rotulo} com sobra de ${moeda(linha.mes_apertado.sobra)}; ` : ""}${linha.cabe_sem_imprevisto ? `folga para imprevistos ${moeda(linha.folga)}` : `não fecha sem o cartão, juros de ${moeda(linha.juros_cartao)} por causa da compra`}; parcelas no mês mais carregado ${pct(linha.peso_parcelas_pct)} da renda; custo real sem imprevisto ${moeda(linha.custo_real)}.` : null,
      cen.agora ? `Cenários (simulação, mesmo preço, mesma regra de atraso): agora, meta ${cen.agora.meta}; daqui a ${P.MESES_ESPERA} meses, meta ${cen.esperar.meta}; parcelado em ${cen.parcelado.destaque}${cen.parcelado.juros > 0 ? ` (total ${moeda(cen.parcelado.total_pago)}, com ${moeda(cen.parcelado.juros)} de juros)` : ""}${cen.parcelado.exemplo ? " como exemplo" : ""}, meta ${cen.parcelado.meta}.` : null,
      `Pontos destacados pelo FinCK: ${[ ...(analise.pontos_da_revelacao || []), ...analise.pontos ].map(p => p.titulo).join(", ") || "nenhum além do impacto"}.`,
      `Leitura do FinCK, feita por regra: ${analise.leitura.texto}`
    ].filter(Boolean);
    const texto = linhas.join("\n");
    return texto.length > P.LIMITE_CONTEXTO ? texto.slice(0, P.LIMITE_CONTEXTO) : texto;
  }

  return {
    analisar: analisar,
    responder: responder,
    contexto: contexto,
    textoAtraso: textoAtraso,
    valorAlternativa: valorAlternativa,
    PARAMETROS: P,
    REGRAS_IMPACTO: REGRAS_IMPACTO
  };
})();
