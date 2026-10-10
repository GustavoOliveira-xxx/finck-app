window.FinckReality = (() => {
  const cfg = window.FINCK_CONFIG;
  // Preço sozinho não separa o barato descartável do caro durável.
  // Quantidade e vida útil são opcionais; quando informadas, viram custo por mês
  // de uso, que é o número que muda a conversa sobre consumo.
  function custoDeUso(preco, {quantidade: quantidade = null, mesesDeUso: mesesDeUso = null} = {}) {
    const qtd = Number(quantidade) > 0 ? Math.floor(Number(quantidade)) : null;
    const meses = Number(mesesDeUso) > 0 ? Number(mesesDeUso) : null;
    const total = qtd ? preco * qtd : preco;
    return {
      quantidade: qtd,
      meses_de_uso: meses,
      total: total,
      por_mes: meses ? total / meses : null,
      por_unidade: qtd ? preco : null,
      informado: Boolean(qtd || meses)
    };
  }
  // "price" é o preço de uma unidade. Com quantidade, todo o impacto (horas,
  // % da renda, saldo depois, metas e semáforo) é sobre o total, que é o que
  // sai do bolso; "price" continua sendo o unitário e "total" é o da compra.
  function calcular(price, perfil, ctx = {}) {
    const unitario = Number(price) || 0;
    const custo = custoDeUso(unitario, ctx);
    const preco = custo.total;
    const renda = Number(perfil?.income_monthly) || 0;
    const dias = Number(perfil?.work_days_month) || cfg.PADRAO.work_days_month;
    const horas = Number(perfil?.work_hours_day) || cfg.PADRAO.work_hours_day;
    const valorDia = renda > 0 ? renda / dias : 0;
    const valorHora = valorDia > 0 ? valorDia / horas : 0;
    const income_percent = renda > 0 ? preco / renda * 100 : 0;
    const work_days = valorDia > 0 ? preco / valorDia : 0;
    const work_hours = valorHora > 0 ? preco / valorHora : 0;
    const saldo = Number(ctx.saldo) || 0;
    const saldoDepois = saldo - preco;
    const despesasFixas = Number(ctx.despesasFixas) || 0;
    const sobraAposFixos = renda - despesasFixas;
    const rendaLivre = Math.max(0, sobraAposFixos);
    const semFolga = renda > 0 && sobraAposFixos <= 0;
    const percentualRendaLivre = rendaLivre > 0 ? preco / rendaLivre * 100 : 0;
    const compromissos = Number(ctx.compromissosAbertos) || 0;
    // Saldo depois das parcelas: o mesmo número da página inicial
    // (ctx.projecoes.saldoAposParcelas).
    const disponivelProjetado = saldo - compromissos;
    const disponivelDepois = disponivelProjetado - preco;
    // Próximos 60 dias, quando a tela carrega a programação: o caixa depois
    // das saídas previstas (o número da página inicial) e o ponto mais baixo
    // do caixa contando também as entradas previstas, na ordem das datas.
    // É o ponto mais baixo que diz se a compra cabe nas contas já previstas.
    const finito = v => v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);
    const caixa60 = finito(ctx.caixa60);
    const menorCaixa60 = finito(ctx.menorCaixa60) ?? caixa60;
    const menorCaixa60Depois = menorCaixa60 === null ? null : menorCaixa60 - preco;
    // Gastos do dia a dia (estimados pelo histórico) saem da sobra antes das
    // metas: o que sobra disso é a sobra livre do mês.
    const diaADia = Math.max(0, Number(ctx.diaADia) || 0);
    const sobraLivre = Math.max(0, rendaLivre - diaADia);
    const metasCalc = impactoMetas(preco, ctx.metas || [], valorDia, {
      movimentos: ctx.movimentosMeta || [],
      hoje: ctx.hoje instanceof Date ? ctx.hoje : new Date,
      sobraLivre: sobraLivre,
      saldoAposParcelas: disponivelProjetado,
      despesasFixas: despesasFixas
    });
    const impacto_metas = metasCalc.lista;
    return {
      price: unitario,
      total: preco,
      income_monthly: renda,
      valor_dia: valorDia,
      valor_hora: valorHora,
      income_percent: income_percent,
      work_days: work_days,
      work_hours: work_hours,
      saldo_antes: saldo,
      saldo_depois: saldoDepois,
      compromete_saldo: saldoDepois < 0,
      compromissos_futuros: compromissos,
      disponivel_projetado: disponivelProjetado,
      disponivel_depois: disponivelDepois,
      compromete_projetado: disponivelDepois < 0,
      saldo_apos_parcelas: disponivelProjetado,
      caixa_60_dias: caixa60,
      saidas_60_dias: finito(ctx.saidas60),
      menor_caixa_60: menorCaixa60,
      menor_caixa_60_depois: menorCaixa60Depois,
      compromete_caixa60: menorCaixa60Depois !== null && menorCaixa60Depois < 0,
      dia_a_dia: diaADia,
      sobra_livre: sobraLivre,
      aportes_metas: metasCalc.aportes,
      base_aportes: metasCalc.base,
      sobra_fora_metas: metasCalc.sobraForaDasMetas,
      folga_fora_metas: metasCalc.folga,
      parte_das_metas: metasCalc.parte,
      renda_livre: rendaLivre,
      sobra_apos_fixos: sobraAposFixos,
      deficit_fixos: Math.max(0, -sobraAposFixos),
      sem_folga: semFolga,
      percentual_renda_livre: percentualRendaLivre,
      impacto_metas: impacto_metas,
      custo_de_uso: custo,
      semaforo: semaforo({
        incomePercent: income_percent,
        saldoDepois: saldoDepois,
        disponivelDepois: disponivelDepois,
        compromissos: compromissos,
        percentualRendaLivre: percentualRendaLivre,
        semFolga: semFolga,
        deficitFixos: Math.max(0, -sobraAposFixos),
        rendaLivre: rendaLivre,
        preco: preco,
        impactoMetas: impacto_metas,
        menorCaixa60Depois: menorCaixa60Depois
      }),
      alternativas: alternativas(preco)
    };
  }
  // A folga fora das metas hoje: o que o saldo tem acima de um mês de
  // despesas fixas, mais a sobra deste mês que não vai para as metas, sem
  // passar do saldo depois das parcelas. Gastar dentro dela não tira nada
  // do que iria para as metas.
  function folgaForaDasMetas({saldoAposParcelas: saldoAposParcelas = 0, despesasFixas: despesasFixas = 0, sobraForaDasMetas: sobraForaDasMetas = 0} = {}) {
    const saldo = Math.max(0, Number(saldoAposParcelas) || 0);
    const acimaDaReserva = Math.max(0, saldo - Math.max(0, Number(despesasFixas) || 0));
    return Math.min(saldo, acimaDaReserva + Math.max(0, Number(sobraForaDasMetas) || 0));
  }
  // A regra única do atraso nas metas, usada pela revelação, pelo bloco de
  // metas e pelos cenários. Cada pagamento (mês 0 = hoje) usa primeiro a
  // folga de hoje mais a sobra fora das metas dos meses até ele; o que passa
  // disso sai do que iria para as metas.
  function parteDasMetas(pagamentos, {folgaHoje: folgaHoje = 0, sobraExtra: sobraExtra = 0} = {}) {
    const folga = Math.max(0, Number(folgaHoje) || 0);
    const extra = Math.max(0, Number(sobraExtra) || 0);
    let pago = 0;
    let maior = 0;
    (pagamentos || []).slice().sort((a, b) => (Number(a.mes) || 0) - (Number(b.mes) || 0)).forEach(p => {
      pago += Math.max(0, Number(p.valor) || 0);
      maior = Math.max(maior, pago - folga - Math.max(0, Number(p.mes) || 0) * extra);
    });
    return Math.round(maior * 100) / 100;
  }
  // Essa parte vira tempo de calendário pelo ritmo da meta. Sem ritmo não há
  // atraso para mostrar: o FinCK não inventa um.
  function atrasoDias(parte, meta) {
    const falta = Number(meta?.falta) || 0;
    const ritmo = Number(meta?.aporte_mensal) || 0;
    return falta > 0 && ritmo > 0 ? Math.min(Math.max(0, Number(parte) || 0), falta) / ritmo * 30 : null;
  }
  // "o que eu deixo de fazer se comprar isso?". Além do peso em
  // reais, a compra vira atraso em tempo de calendário: pelo ritmo real de
  // aportes dos últimos 90 dias, ou, sem histórico, pelo ritmo que o prazo
  // da meta exige. Sem nenhum dos dois, fica o equivalente em dias de trabalho.
  function impactoMetas(preco, metas, valorDia, {movimentos: movimentos = [], hoje: hoje = new Date, sobraLivre: sobraLivre = 0, saldoAposParcelas: saldoAposParcelas = 0, despesasFixas: despesasFixas = 0} = {}) {
    const M = window.FinckMetas;
    const lista = metas.map(m => {
      const alvo = Number(m.target_amount) || 0;
      const atual = Number(m.current_amount) || 0;
      const falta = Math.max(0, alvo - atual);
      const percentualDaMeta = alvo > 0 ? preco / alvo * 100 : 0;
      const percentualDoRestante = falta > 0 ? preco / falta * 100 : 0;
      const diasAtraso = valorDia > 0 ? preco / valorDia : 0;
      const ritmo = M ? M.ritmoMensal(movimentos, m.id, {
        hoje: hoje
      }) : 0;
      const necessario = M ? M.necessarioPorMes(m, {
        hoje: hoje
      }) : null;
      const porMes = ritmo > 0 ? ritmo : necessario || 0;
      const base = ritmo > 0 ? "ritmo" : necessario ? "prazo" : "trabalho";
      return {
        id: m.id,
        nome: m.name,
        atual: atual,
        alvo: alvo,
        falta: falta,
        progresso: alvo > 0 ? Math.min(100, atual / alvo * 100) : 0,
        percentual_da_meta: percentualDaMeta,
        percentual_do_restante: percentualDoRestante,
        dias_trabalho_extra: diasAtraso,
        aporte_mensal: porMes,
        atraso_dias: null,
        base_atraso: base,
        cobre_a_meta: preco >= falta && falta > 0
      };
    });
    const ativas = lista.filter(m => m.falta > 0 && m.aporte_mensal > 0);
    const aportes = ativas.reduce((s, m) => s + m.aporte_mensal, 0);
    const bases = [ ...new Set(ativas.map(m => m.base_atraso)) ];
    const sobraForaDasMetas = Math.max(0, (Number(sobraLivre) || 0) - aportes);
    const folga = folgaForaDasMetas({
      saldoAposParcelas: saldoAposParcelas,
      despesasFixas: despesasFixas,
      sobraForaDasMetas: sobraForaDasMetas
    });
    const parte = parteDasMetas([ {
      mes: 0,
      valor: preco
    } ], {
      folgaHoje: folga,
      sobraExtra: sobraForaDasMetas
    });
    lista.forEach(m => {
      m.atraso_dias = atrasoDias(parte, m);
    });
    return {
      lista: lista,
      aportes: aportes,
      // "ritmo": aportes reais; "prazo": o que os prazos pedem; "misto".
      base: bases.length > 1 ? "misto" : bases[0] || null,
      sobraForaDasMetas: sobraForaDasMetas,
      folga: folga,
      parte: parte
    };
  }
  // "37 h 20 min" e "4 dias e 5 h": o tempo de trabalho é o número que a
  // pessoa entende em três segundos, então ele vem sem casas decimais soltas.
  function formatarTempo(horas, horasPorDia = cfg.PADRAO.work_hours_day) {
    const totalMin = Math.max(0, Math.round((Number(horas) || 0) * 60));
    const h = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    const porDia = Number(horasPorDia) > 0 ? Number(horasPorDia) : cfg.PADRAO.work_hours_day;
    // "4.520 h 41 min": separador de milhar, como nos outros números.
    const inteiro = n => window.FinckUtils ? window.FinckUtils.numero(n, 0) : String(n);
    const textoHoras = h === 0 ? `${min} min` : min ? `${inteiro(h)} h ${min} min` : `${inteiro(h)} h`;
    const diasInteiros = Math.floor(totalMin / (porDia * 60));
    const restoH = Math.round((totalMin - diasInteiros * porDia * 60) / 60);
    const ajustado = restoH >= porDia ? [ diasInteiros + 1, 0 ] : [ diasInteiros, restoH ];
    const [d, r] = ajustado;
    const textoDias = d === 0 ? textoHoras : `${inteiro(d)} ${d === 1 ? "dia" : "dias"}${r ? ` e ${r} h` : ""}`;
    return {
      horas: textoHoras,
      dias: textoDias,
      horas_inteiras: h,
      minutos: min,
      dias_inteiros: d,
      resto_horas: r
    };
  }
  // O semáforo fala de impacto, não de certo ou errado.
  const ROTULO_IMPACTO = {
    verde: "Impacto baixo",
    atencao: "Impacto moderado",
    alerta: "Impacto alto"
  };
  // A frase que resume a análise, para ser dita em voz alta sem interpretar
  // os cartões: cabe ou não no saldo, e quanto da sobra do mês ela leva.
  function sintese(r) {
    const U = window.FinckUtils;
    const dinheiro = v => U ? U.moeda(v) : `R$ ${Number(v || 0).toFixed(2)}`;
    const pct = v => `${Math.round(v)}%`;
    let frase;
    if (r.compromete_saldo) {
      frase = `Não cabe no seu saldo atual: faltariam ${dinheiro(Math.abs(r.saldo_depois))}.`;
    } else if (r.compromete_caixa60) {
      frase = `Cabe no saldo de hoje, mas não nas contas já previstas: nos próximos 60 dias, contando as entradas e saídas previstas, faltariam até ${dinheiro(Math.abs(r.menor_caixa_60_depois))}.`;
    } else if (r.compromete_projetado) {
      frase = `Cabe no saldo de hoje, mas não no saldo depois das parcelas que faltam pagar: faltariam ${dinheiro(Math.abs(r.disponivel_depois))}.`;
    } else if (r.sem_folga) {
      frase = "Cabe no seu saldo atual, mas sai da reserva: as despesas fixas já consomem toda a renda do mês.";
    } else if (r.renda_livre > 0) {
      frase = `Cabe no seu saldo atual e consome ${pct(r.percentual_renda_livre)} do que sobra depois dos fixos.`;
    } else {
      frase = "Cabe no seu saldo atual.";
    }
    const sobraDepois = r.renda_livre - (r.total ?? r.price);
    return {
      frase: frase,
      rotulo_impacto: ROTULO_IMPACTO[r.semaforo.nivel] || "Impacto",
      sobra_depois: sobraDepois,
      frase_sobra: r.renda_livre > 0 ? sobraDepois >= 0 ? `Depois desta compra, ainda sobram ${dinheiro(sobraDepois)} da sua sobra mensal (renda menos despesas fixas).` : `A compra passa a sua sobra mensal em ${dinheiro(Math.abs(sobraDepois))}: a diferença sairia do saldo acumulado.` : "Você não tem sobra mensal depois dos fixos, então a compra sai do saldo acumulado."
    };
  }
  // Uma casa decimal só quando ela diz alguma coisa: "2,5" e "3", não "3,0".
  function numeroCurto(valor) {
    const U = window.FinckUtils;
    const v = Number(valor) || 0;
    const casas = v >= 10 || Math.abs(v - Math.round(v)) < .05 ? 0 : 1;
    return U ? U.numero(v, casas) : v.toFixed(casas).replace(".", ",");
  }
  // Prazo em linguagem de calendário: "12 dias", "2,5 meses".
  function textoDuracao(dias) {
    const d = Math.max(0, Number(dias) || 0);
    if (d < 45) {
      const n = Math.max(1, Math.round(d));
      return `${n} ${n === 1 ? "dia" : "dias"}`;
    }
    return `${numeroCurto(d / 30)} meses`;
  }
  // O atraso em um formato só, em qualquer lugar do app: "+12 dias",
  // "+2,5 meses", "sem atraso".
  function textoAtraso(dias) {
    if (dias === null || dias === undefined) {
      return "sem estimativa de prazo";
    }
    return Math.round(Number(dias) || 0) < 1 ? "sem atraso" : `+${textoDuracao(dias)}`;
  }
  // A meta que a compra mais empurra para frente, em dias de calendário,
  // pela regra única de impactoMetas. Menos de um dia não é atraso.
  function metaMaisAtrasada(impactoMetas) {
    return (impactoMetas || []).filter(m => Math.round(Number(m.atraso_dias) || 0) >= 1).map(m => ({
      id: m.id,
      nome: m.nome,
      atual: Number(m.atual) || 0,
      alvo: Number(m.alvo) || 0,
      base: m.base_atraso,
      dias: Number(m.atraso_dias)
    })).sort((a, b) => b.dias - a.dias)[0] || null;
  }
  // O momento em que o preço vira vida: reais, horas do seu trabalho, dias
  // de trabalho, o peso no mês e, quando existe, o atraso na meta mais
  // afetada. É tudo conta do FinCK sobre a renda e a jornada declaradas.
  // Com quantidade, a cadeia e o semáforo já vêm sobre o total (calcular).
  function cadeiaDoImpacto(r, {horasPorDia: horasPorDia = null} = {}) {
    const U = window.FinckUtils;
    const dinheiro = v => U ? U.moeda(v) : `R$ ${Number(v || 0).toFixed(2)}`;
    const numero = (v, c) => U ? U.numero(v, c) : Number(v || 0).toFixed(c).replace(".", ",");
    const unitario = Number(r.price) || 0;
    const qtd = Number(r.custo_de_uso?.quantidade) > 1 ? Number(r.custo_de_uso.quantidade) : 1;
    const total = Number(r.total) || Number(r.custo_de_uso?.total) || unitario * qtd;
    const porDia = Number(horasPorDia) > 0 ? Number(horasPorDia) : cfg.PADRAO.work_hours_day;
    const horas = Number(r.work_hours) || 0;
    const tempo = formatarTempo(horas, porDia);
    const renda = Number(r.income_monthly) || 0;
    const sobra = Number(r.renda_livre) || 0;
    const baseMes = sobra > 0 ? "sobra" : renda > 0 ? "renda" : null;
    const percentualMes = baseMes === "sobra" ? total / sobra * 100 : baseMes === "renda" ? total / renda * 100 : null;
    const meta = metaMaisAtrasada(r.impacto_metas);
    const nivel = r.semaforo?.nivel || "verde";
    const passos = [ {
      id: "preco",
      valor: dinheiro(total),
      rotulo: qtd > 1 ? `${qtd} unidades de ${dinheiro(unitario)}` : "o preço"
    } ];
    if (horas > 0) {
      passos.push({
        id: "horas",
        valor: tempo.horas,
        rotulo: "do seu trabalho"
      });
    }
    if (tempo.dias_inteiros >= 1) {
      passos.push({
        id: "dias",
        valor: tempo.dias,
        rotulo: `de trabalho, na sua jornada de ${numero(porDia, porDia % 1 ? 1 : 0)} h por dia`
      });
    }
    if (percentualMes !== null) {
      const nome = baseMes === "sobra" ? "sobra" : "renda";
      const explica = baseMes === "sobra" ? " (renda menos despesas fixas)" : "";
      // Acima de 100%, "meses" se entende melhor que "267%".
      const meses = numeroCurto(percentualMes / 100);
      passos.push(percentualMes >= 100 ? {
        id: "mes",
        valor: meses === "1" ? "1 mês" : `${meses} meses`,
        rotulo: `da sua ${nome}${explica}`
      } : {
        id: "mes",
        valor: `${numero(percentualMes, percentualMes < 10 ? 1 : 0)}%`,
        rotulo: `da sua ${nome} do mês${explica}`
      });
    }
    if (meta) {
      passos.push({
        id: "meta",
        valor: textoAtraso(meta.dias),
        rotulo: `no prazo da meta “${meta.nome}”`,
        estimativa: true
      });
    }
    return {
      total: total,
      quantidade: qtd,
      horas: horas,
      tempo: tempo,
      dias_trabalho: Number(r.work_days) || 0,
      base_mes: baseMes,
      percentual_mes: percentualMes,
      meta: meta ? {
        ...meta,
        texto: textoDuracao(meta.dias)
      } : null,
      nivel: nivel,
      rotulo_impacto: ROTULO_IMPACTO[nivel] || "Impacto",
      passos: passos
    };
  }
  // O que aconteceu de verdade ao salvar a decisão, dito sem exagero: só
  // "comprar" lança no extrato, e nenhuma decisão mexe no valor das metas.
  // Quem chama passa o que a gravação encontrou, não a intenção: "jaLancada"
  // quando a saída desta análise já estava no extrato, e "estornada" quando
  // ela foi estornada agora.
  function confirmacaoRegistro({decisao: decisao, total: total = 0, categoria: categoria = "", meta: meta = null, saidaAnterior: saidaAnterior = null} = {}) {
    const U = window.FinckUtils;
    const dinheiro = v => U ? U.moeda(v) : `R$ ${Number(v || 0).toFixed(2)}`;
    const d = cfg.DECISOES.find(x => x.id === decisao);
    if (decisao === "comprar") {
      const linhas = [ saidaAnterior?.jaLancada ? `A saída de ${dinheiro(saidaAnterior.valor ?? total)} desta análise já estava no seu extrato; nada foi lançado de novo.` : `${dinheiro(total)} ${total === 1 ? "adicionado" : "adicionados"} ao seu extrato como saída, com a data de hoje${categoria ? `, na categoria ${categoria}` : ""}.` ];
      if (meta) {
        linhas.push(`Sua meta “${meta.nome}” continua com ${dinheiro(meta.atual)} guardados; prazo estimado ${textoAtraso(meta.dias)}.`);
      }
      return {
        titulo: "Compra registrada.",
        linhas: linhas,
        lancou_no_extrato: true
      };
    }
    const linhas = [ saidaAnterior?.estornada ? `A saída de ${dinheiro(saidaAnterior.valor)} lançada antes foi estornada. O extrato guarda o lançamento e o estorno.` : "Nada foi lançado no extrato." ];
    if (d?.consciente) {
      linhas.push("Daqui a 30 dias o FinCK pergunta, em Decisões, o que aconteceu depois.");
    }
    if (decisao === "usado") {
      linhas.push("Se comprar o usado, registre a saída quando pagar.");
    }
    return {
      titulo: "Decisão salva.",
      linhas: linhas,
      lancou_no_extrato: false,
      estornou: Boolean(saidaAnterior?.estornada)
    };
  }
  // Duas opções lado a lado com os mesmos parâmetros (renda,
  // jornada, metas). A diferença aparece em reais, em horas de trabalho e,
  // quando as duas têm vida útil, em custo por mês de uso: é ali que o
  // barato às vezes perde para o durável.
  function comparar(a, b) {
    const ladoDe = x => ({
      nome: x.nome,
      preco: x.resultado.total ?? x.resultado.price,
      horas: x.resultado.work_hours,
      meses: x.resultado.custo_de_uso.meses_de_uso,
      por_mes: x.resultado.custo_de_uso.por_mes
    });
    const A = ladoDe(a), B = ladoDe(b);
    const maisBarata = A.preco <= B.preco ? A : B;
    const maisCara = maisBarata === A ? B : A;
    const comUso = A.por_mes && B.por_mes;
    const melhorPorMes = comUso ? A.por_mes <= B.por_mes ? A : B : null;
    return {
      a: A,
      b: B,
      mais_barata: maisBarata.nome,
      economia: maisCara.preco - maisBarata.preco,
      horas_economizadas: maisCara.horas - maisBarata.horas,
      empate: Math.abs(A.preco - B.preco) < .005,
      compara_uso: Boolean(comUso),
      melhor_por_mes: melhorPorMes ? melhorPorMes.nome : null,
      inverte: Boolean(melhorPorMes && melhorPorMes.nome !== maisBarata.nome)
    };
  }
  // Ao refazer a análise do mesmo item, o que mudou na conta.
  function oQueMudou(anterior, atual) {
    if (!anterior || !atual) {
      return [];
    }
    const mudancas = [];
    const diferente = (x, y) => Math.abs((Number(x) || 0) - (Number(y) || 0)) > .004;
    const valor = r => r.total ?? r.price;
    if (diferente(valor(anterior), valor(atual))) {
      mudancas.push({
        campo: "preco",
        antes: valor(anterior),
        agora: valor(atual)
      });
    }
    if (diferente(anterior.work_hours, atual.work_hours)) {
      mudancas.push({
        campo: "horas",
        antes: anterior.work_hours,
        agora: atual.work_hours
      });
    }
    const pa = anterior.custo_de_uso?.por_mes, pb = atual.custo_de_uso?.por_mes;
    if ((pa || pb) && diferente(pa, pb)) {
      mudancas.push({
        campo: "por_mes",
        antes: pa || null,
        agora: pb || null
      });
    }
    return mudancas;
  }
  // A categoria deixa de ser obrigação e vira confirmação:
  // o FinCK sugere pelo nome do item e a pessoa só altera se não for essa.
  const PISTAS_CATEGORIA = [ [ "Eletrônicos", /(?<![\p{L}\p{N}])(celular|smartphone|iphone|galaxy|xiaomi|motorola|redmi|fone|headset|airpods?|earbuds?|notebook|laptop|macbook|computador|pc(?![\p{L}\p{N}])|gamer|monitor|teclado|mouse|tablet|ipad|kindle|tv(?![\p{L}\p{N}])|televis|smart ?tv|console|playstation|ps[45]|xbox|nintendo|switch|caixa de som|jbl|carregador|cabo usb|power ?bank|smartwatch|rel[oó]gio inteligente|apple watch|c[aâ]mera|drone|impressora|roteador|ssd|hd externo|pendrive|placa de v[ií]deo|air ?fryer|fritadeira|liquidificador|micro-?ondas|geladeira|ventilador|ar[- ]condicionado|aspirador|cafeteira)/iu ], [ "Saúde", /(?<![\p{L}\p{N}])(rem[eé]dio|medicamento|farm[aá]cia|consulta|m[eé]dico|dentista|exame|academia|suplemento|whey|vitamina|[oó]culos de grau|lente de contato|plano de sa[uú]de|terapia|psic[oó]log)/iu ], [ "Vestuário", /(?<![\p{L}\p{N}])(t[eê]nis|sapato|sand[aá]lia|chinelo|bota|camis[ae]|camiseta|blusa|cal[cç]a|jeans|bermuda|short|vestido|saia|jaqueta|casaco|moletom|meia|cueca|calcinha|suti[aã]|bon[eé]|chap[eé]u|bolsa|mochila|carteira|cinto|[oó]culos|roupa|nike|adidas|puma)/iu ], [ "Alimentação", /(?<![\p{L}\p{N}])(mercado|supermercado|comida|lanche|pizza|hamb[uú]rguer|ifood|restaurante|caf[eé](?![\p{L}\p{N}])|padaria|a[cç]ougue|feira|chocolate|bebida|cerveja|vinho|refrigerante|marmita|delivery)/iu ], [ "Transporte", /(?<![\p{L}\p{N}])(carro|moto|bicicleta|bike|patinete|uber|99(?![\p{L}\p{N}])|t[aá]xi|gasolina|combust[ií]vel|[oô]nibus|metr[oô]|passagem|pneu|capacete|estacionamento|ped[aá]gio|seguro do carro)/iu ], [ "Moradia", /(?<![\p{L}\p{N}])(aluguel|condom[ií]nio|sof[aá]|cama|colch[aã]o|guarda-?roupa|arm[aá]rio|mesa|cadeira|estante|cortina|tapete|lumin[aá]ria|panela|reforma|tinta|ferramenta|furadeira|m[oó]vel|m[oó]veis|decora[cç][aã]o)/iu ], [ "Educação", /(?<![\p{L}\p{N}])(livro|curso|faculdade|mensalidade escolar|apostila|caderno|material escolar|idioma|ingl[eê]s|udemy|alura|certifica[cç][aã]o|vestibular|enem)/iu ], [ "Lazer", /(?<![\p{L}\p{N}])(jogo|game|steam|ingresso|show|cinema|teatro|viagem|hotel|passeio|netflix|spotify|streaming|assinatura|brinquedo|lego|bola|camping|festa|presente|instrumento|viol[aã]o|guitarra)/iu ] ];
  function inferirCategoria(nome) {
    const texto = String(nome || "").normalize("NFC");
    if (!texto.trim()) {
      return null;
    }
    const achada = PISTAS_CATEGORIA.find(([, padrao]) => padrao.test(texto));
    return achada ? achada[0] : null;
  }
  const MOTIVOS = [ "deficit_fixos", "sem_caixa", "sem_projetado", "renda_livre", "percentual_renda", "impacto_meta", "folga" ];
  function semaforo({incomePercent: incomePercent = 0, saldoDepois: saldoDepois = 0, disponivelDepois: disponivelDepois = 0, compromissos: compromissos = 0, percentualRendaLivre: percentualRendaLivre = 0, semFolga: semFolga = false, deficitFixos: deficitFixos = 0, rendaLivre: rendaLivre = 0, preco: preco = 0, impactoMetas: impactoMetas = [], menorCaixa60Depois: menorCaixa60Depois = null} = {}) {
    const U = window.FinckUtils;
    const dinheiro = v => U ? U.moeda(v) : `R$ ${Number(v || 0).toFixed(2)}`;
    if (semFolga) {
      return {
        nivel: "alerta",
        motivo: "deficit_fixos",
        titulo: saldoDepois < 0 ? "Aumenta o déficit e zera o caixa" : "Cabe no caixa atual, mas não na renda recorrente",
        texto: saldoDepois < 0 ? `Suas despesas fixas superam a renda em ${dinheiro(deficitFixos)} por mês e esta compra ainda deixaria o saldo negativo. Aqui não é questão de tamanho da compra: não há de onde tirar.` : `Suas despesas fixas já consomem toda a renda do mês (déficit de ${dinheiro(deficitFixos)}). Esta compra sairia do caixa acumulado, não do que entra agora: ela reduz reserva em vez de usar sobra.`
      };
    }
    if (saldoDepois < 0) {
      return {
        nivel: "alerta",
        motivo: "sem_caixa",
        titulo: "Não cabe no caixa atual",
        texto: `Depois desta compra o saldo ficaria em ${dinheiro(saldoDepois)}. O dinheiro para pagá-la ainda não entrou.`
      };
    }
    // As contas já previstas para os próximos 60 dias (com as entradas, na
    // ordem das datas) só entram quando a tela carrega a programação.
    if (menorCaixa60Depois !== null && menorCaixa60Depois < 0) {
      return {
        nivel: "alerta",
        motivo: "sem_caixa60",
        titulo: "Não cabe nas contas já previstas",
        texto: `Cabe no saldo de hoje, mas, somando as entradas e saídas já previstas para os próximos 60 dias, o caixa chegaria a ${dinheiro(menorCaixa60Depois)} no ponto mais baixo.`
      };
    }
    if (compromissos > 0 && disponivelDepois < 0) {
      return {
        nivel: "alerta",
        motivo: "sem_projetado",
        titulo: "Não cabe no saldo depois das parcelas",
        texto: `Cabe no saldo de hoje, mas você ainda tem ${dinheiro(compromissos)} em parcelas a pagar. Descontando as parcelas, o saldo fica em ${dinheiro(disponivelDepois)}.`
      };
    }
    if (percentualRendaLivre >= 60) {
      return {
        nivel: "alerta",
        motivo: "renda_livre",
        titulo: "Consome quase toda a sobra do mês",
        texto: `A compra ocupa ${Math.round(percentualRendaLivre)}% da sua sobra após os fixos (${dinheiro(rendaLivre)}). O que sobra precisa cobrir o resto do mês inteiro.`
      };
    }
    if (incomePercent >= 30) {
      return {
        nivel: "alerta",
        motivo: "percentual_renda",
        titulo: "Peso alto na renda do mês",
        texto: `Equivale a ${Math.round(incomePercent)}% da sua renda mensal. Se ela for importante para você, esticar o prazo ou comparar alternativas costuma abrir espaço sem abrir mão do item.`
      };
    }
    if (percentualRendaLivre >= 25) {
      return {
        nivel: "atencao",
        motivo: "renda_livre",
        titulo: "Ocupa parte relevante da sobra",
        texto: `A compra usa ${Math.round(percentualRendaLivre)}% da sua sobra após os fixos. Cabe, mas reduz a folga que você teria para o resto do mês.`
      };
    }
    if (incomePercent >= 10) {
      return {
        nivel: "atencao",
        motivo: "percentual_renda",
        titulo: "Peso médio na renda do mês",
        texto: `Equivale a ${Math.round(incomePercent)}% da sua renda. Cabe no orçamento e reduz parte da folga; vale olhar ao lado das suas metas para decidir com o quadro completo.`
      };
    }
    const metaAfetada = (impactoMetas || []).filter(m => m.falta > 0 && m.percentual_do_restante >= 20).sort((a, b) => b.percentual_do_restante - a.percentual_do_restante)[0];
    if (metaAfetada) {
      return {
        nivel: "atencao",
        motivo: "impacto_meta",
        titulo: "Pequena para a renda, grande para a meta",
        texto: `A compra é leve no mês, mas equivale a ${Math.round(metaAfetada.percentual_do_restante)}% do que ainda falta para "${metaAfetada.nome}". ${metaAfetada.atraso_dias === null ? "Com aportes registrados na meta, o FinCK estima quanto o prazo muda." : Math.round(metaAfetada.atraso_dias) >= 1 ? `Pela conta do FinCK, o prazo estimado dela fica ${textoAtraso(metaAfetada.atraso_dias)}.` : "Como cabe na folga fora das metas, o prazo estimado dela não muda."}`
      };
    }
    return {
      nivel: "verde",
      motivo: "folga",
      titulo: "Cabe com folga no mês",
      texto: "A compra ocupa uma fatia pequena da sua renda e cabe no saldo de hoje e na sobra do mês. Se quiser, dá para comparar durabilidade e uso antes de fechar."
    };
  }
  function alternativas(preco) {
    const H = cfg.HIPOTESES_ALTERNATIVAS;
    const daHipotese = id => {
      const h = H[id];
      return {
        id: id,
        titulo: h.rotulo,
        economia: preco * h.referencia,
        faixa: {
          min: preco * h.min,
          max: preco * h.max
        },
        percentual: h.referencia,
        hipotese: true,
        texto: h.texto
      };
    };
    return [ daHipotese("usado"), daHipotese("reparar"), daHipotese("compartilhar"), {
      id: "adiar",
      titulo: "Adiar 30 dias e reavaliar",
      economia: 0,
      faixa: null,
      hipotese: false,
      texto: "A regra dos 30 dias ajuda a separar necessidade real de impulso."
    } ];
  }
  // Os rótulos descrevem as respostas, não a pessoa: a reflexão é um retrato
  // da escolha, não uma nota de prova.
  const FAIXAS_RESPONSABILIDADE = [ {
    minimo: 70,
    nivel: "alta",
    rotulo: "Escolha bem fundamentada",
    texto: "Pelas suas respostas, esta compra tende a ser necessária, usada e duradoura."
  }, {
    minimo: 40,
    nivel: "media",
    rotulo: "Alguns pontos pedem atenção",
    texto: "Suas respostas apontam pelo menos um ponto fraco antes de concluir a compra."
  }, {
    minimo: 0,
    nivel: "baixa",
    rotulo: "Suas respostas apontam impulso",
    texto: "Suas respostas indicam pouca necessidade, pouco uso ou vida útil curta."
  } ];
  const LIMITE_RESPONSABILIDADE = "Este indicador resume apenas o que você declarou nas seis perguntas. Ele não mede impacto ambiental: o carbono e a água que o FinCK mostra na análise são estimativas feitas por IA, não medição.";
  function indicadorResponsavel(reflexoes = {}) {
    const pesos = cfg.PESOS_RESPONSABILIDADE;
    const criterios = cfg.REFLEXOES.map(q => {
      const resposta = (reflexoes || {})[q.id] || null;
      const tabela = pesos[q.id] || {};
      const ponto = resposta !== null && Object.prototype.hasOwnProperty.call(tabela, resposta) ? tabela[resposta] : null;
      return {
        id: q.id,
        dimensao: q.dimensao,
        resposta: resposta,
        pontos: ponto,
        maximo: 2,
        respondida: ponto !== null
      };
    });
    const respondidas = criterios.filter(c => c.respondida);
    const soma = respondidas.reduce((s, c) => s + c.pontos, 0);
    const maximo = respondidas.length * 2;
    const pontuacao = maximo > 0 ? Math.round(soma / maximo * 100) : null;
    const faixa = pontuacao === null ? null : FAIXAS_RESPONSABILIDADE.find(f => pontuacao >= f.minimo);
    const alertas = respondidas.filter(c => c.pontos === 0).map(c => ({
      id: c.id,
      dimensao: c.dimensao,
      texto: cfg.ALERTAS_RESPONSABILIDADE[c.id]
    }));
    return {
      pontuacao: pontuacao,
      nivel: faixa ? faixa.nivel : null,
      rotulo: faixa ? faixa.rotulo : "Sem respostas suficientes",
      sintese: faixa ? faixa.texto : "Toque nas respostas que combinam com você para ver aqui um resumo do que elas mostram.",
      criterios: criterios,
      respondidas: respondidas.length,
      total: criterios.length,
      alertas: alertas,
      limitacao: LIMITE_RESPONSABILIDADE
    };
  }
  // O que fica gravado em purchase_analyses: "price" é o preço de uma unidade
  // e "quantity" quantas unidades (vazio = 1); o valor da compra é
  // price × quantity (valorTotal). work_days, work_hours, income_percent,
  // balance_after e impact_level já são sobre esse total, como na tela.
  function paraRegistro({item_name: item_name, price: price, category: category, resultado: resultado, perfil: perfil, decision: decision, reflections: reflections, note: note, item_link: item_link, quantity: quantity, expected_months: expected_months, end_of_life: end_of_life}) {
    const indicador = indicadorResponsavel(reflections);
    return {
      item_name: item_name,
      price: Number(price),
      category: category || "Outros",
      work_days: Number(resultado.work_days.toFixed(2)),
      work_hours: Number(resultado.work_hours.toFixed(2)),
      income_percent: Number(resultado.income_percent.toFixed(2)),
      impact_level: resultado.semaforo.nivel,
      decision: decision || null,
      reflections: reflections || {},
      note: note || null,
      item_link: item_link || null,
      income_base: Number(resultado.income_monthly || perfil?.income_monthly || 0),
      hour_value: Number((resultado.valor_hora || 0).toFixed(2)),
      day_value: Number((resultado.valor_dia || 0).toFixed(2)),
      work_days_month: Number(perfil?.work_days_month || cfg.PADRAO.work_days_month),
      work_hours_day: Number(perfil?.work_hours_day || cfg.PADRAO.work_hours_day),
      income_type: perfil?.income_type || cfg.PADRAO.income_type,
      balance_before: Number((resultado.saldo_antes || 0).toFixed(2)),
      balance_after: Number((resultado.saldo_depois || 0).toFixed(2)),
      free_income: Number((resultado.renda_livre || 0).toFixed(2)),
      quantity: Number(quantity) > 0 ? Math.floor(Number(quantity)) : null,
      expected_months: Number(expected_months) > 0 ? Math.floor(Number(expected_months)) : null,
      end_of_life: end_of_life || null,
      responsibility_score: indicador.pontuacao,
      responsibility_label: indicador.nivel,
      analyzed_at: (new Date).toISOString()
    };
  }
  const valorTotal = a => Number(a?.price || 0) * (Number(a?.quantity) > 0 ? Math.floor(Number(a.quantity)) : 1);
  function resumoHistorico(analises) {
    const lista = analises || [];
    const conscientes = new Set(cfg.DECISOES.filter(d => d.consciente).map(d => d.id));
    const confirmam = new Set(cfg.ACOMPANHAMENTO.filter(a => a.confirma).map(a => a.id));
    const deAlternativa = new Set(cfg.DECISOES.filter(d => d.grupo === "alternativa").map(d => d.id));
    const decididas = lista.filter(a => a.decision);
    const comDecisao = id => decididas.filter(a => a.decision === id).length;
    const evitadas = decididas.filter(a => conscientes.has(a.decision));
    const potencial = evitadas.reduce((s, a) => s + valorTotal(a), 0);
    const horas = evitadas.reduce((s, a) => s + Number(a.work_hours || 0), 0);
    const acompanhadas = evitadas.filter(a => a.outcome);
    const confirmadas = acompanhadas.filter(a => confirmam.has(a.outcome));
    const somaIndicador = lista.filter(a => Number.isFinite(Number(a.responsibility_score)));
    return {
      total: lista.length,
      decididas: decididas.length,
      compras: decididas.length - evitadas.length,
      evitadas: evitadas.length,
      valor_potencial: potencial,
      economia_confirmada: confirmadas.reduce((s, a) => s + valorTotal(a), 0),
      acompanhadas: acompanhadas.length,
      confirmadas: confirmadas.length,
      a_acompanhar: evitadas.length - acompanhadas.length,
      horas_preservadas: horas,
      indicador_medio: somaIndicador.length ? Math.round(somaIndicador.reduce((s, a) => s + Number(a.responsibility_score), 0) / somaIndicador.length) : null,
      taxa_consciente: decididas.length ? evitadas.length / decididas.length * 100 : 0,
      // O histórico como aprendizado: quanto passou pela análise e o que
      // a pessoa decidiu em cada caso.
      valor_avaliado: lista.reduce((s, a) => s + valorTotal(a), 0),
      adiadas: comDecisao("adiar"),
      descartadas: comDecisao("desistir"),
      com_alternativa: decididas.filter(a => deAlternativa.has(a.decision)).length,
      realizadas: comDecisao("comprar"),
      sem_decisao: lista.length - decididas.length,
      diferentes_de_comprar: decididas.filter(a => a.decision !== "comprar").length
    };
  }
  // A frase do histórico conta só o que foi salvo: decisões registradas na
  // hora da análise, não o que aconteceu depois.
  function fraseHistorico(resumo) {
    const r = resumo || {};
    const n = Number(r.diferentes_de_comprar) || 0;
    if (!r.total) {
      return "Você ainda não analisou nenhuma compra.";
    }
    if (!r.decididas) {
      return "Nenhuma análise tem decisão salva ainda. A decisão fica no fim de cada análise.";
    }
    if (!n) {
      return "Até agora, as decisões salvas foram de comprar na hora. A análise serve para decidir sabendo o impacto, qualquer que seja a escolha.";
    }
    return `O FinCK ajudou você a tomar ${n} ${n === 1 ? "decisão diferente" : "decisões diferentes"} de comprar na hora.`;
  }
  // Uma leitura do histórico feita por regra, sem IA: a categoria em que a
  // pessoa mais adiou ou desistiu, com o valor e as horas de trabalho. Sem
  // decisões assim, a categoria que mais passou pela análise.
  function leituraHistorico(analises) {
    const U = window.FinckUtils;
    const dinheiro = v => U ? U.moeda(v) : `R$ ${Number(v || 0).toFixed(2)}`;
    const horasTexto = h => U ? `${U.numero(h, h >= 10 ? 0 : 1)} h` : `${Math.round(h)} h`;
    const lista = (analises || []).filter(a => a && Number(a.price) > 0);
    if (lista.length < 2) {
      return null;
    }
    const porCategoria = (itens, id) => {
      const grupos = new Map;
      itens.forEach(a => {
        const cat = a.category || "Outros";
        const g = grupos.get(cat) || {
          categoria: cat,
          n: 0,
          valor: 0,
          horas: 0
        };
        g.n += 1;
        g.valor += valorTotal(a);
        g.horas += Number(a.work_hours) || 0;
        grupos.set(cat, g);
      });
      return [ ...grupos.values() ].sort((a, b) => b.n - a.n || b.valor - a.valor).map(g => ({
        ...g,
        decisao: id
      }))[0] || null;
    };
    const verbo = {
      adiar: "adiou",
      desistir: "desistiu de"
    };
    const candidatos = [ "adiar", "desistir" ].map(id => porCategoria(lista.filter(a => a.decision === id), id)).filter(Boolean).sort((a, b) => b.n - a.n || b.valor - a.valor);
    const g = candidatos[0];
    if (g) {
      const compras = g.n === 1 ? "1 compra" : `${g.n} compras`;
      const horas = g.horas > 0 ? ` (${horasTexto(g.horas)} de trabalho)` : "";
      return `Você ${verbo[g.decisao]} ${compras} de ${g.categoria} que ${g.n === 1 ? "custava" : "somam"} ${dinheiro(g.valor)}${horas}.`;
    }
    const mais = porCategoria(lista, null);
    if (!mais || mais.n < 2) {
      return null;
    }
    return `A categoria que você mais analisou foi ${mais.categoria}: ${mais.n} compras, ${dinheiro(mais.valor)} no total.`;
  }
  function paraAcompanhar(analises, {dias: dias = 30, hoje: hoje = new Date} = {}) {
    const conscientes = new Set(cfg.DECISOES.filter(d => d.consciente).map(d => d.id));
    const limite = new Date(hoje.getTime() - dias * 864e5);
    return (analises || []).filter(a => a.decision && conscientes.has(a.decision) && !a.outcome).filter(a => new Date(a.analyzed_at || a.created_at || 0) <= limite);
  }
  const GLOSSARIO = {
    saldo_atual: {
      rotulo: "Saldo atual",
      definicao: "Caixa já realizado: saldo inicial mais o que entrou, menos o que saiu, até hoje.",
      referencia: "até hoje"
    },
    sobra_apos_fixos: {
      rotulo: "Sobra da renda após fixos",
      definicao: "Renda mensal menos as recorrências fixas de saída. É o que sobra por mês, não o que você tem.",
      referencia: "por mês"
    },
    deficit_fixos: {
      rotulo: "Déficit de fixos",
      definicao: "Quanto as despesas fixas superam a renda mensal. Aparece quando a sobra ficaria negativa.",
      referencia: "por mês"
    },
    parcelas_a_pagar: {
      rotulo: "Parcelas a pagar",
      definicao: "Parcelas registradas que ainda faltam pagar.",
      referencia: "até a última parcela"
    },
    saldo_apos_parcelas: {
      rotulo: "Saldo depois das parcelas",
      definicao: "Saldo atual menos as parcelas registradas que ainda faltam pagar.",
      referencia: "até a última parcela"
    },
    caixa_60_dias: {
      rotulo: "Caixa depois das saídas previstas",
      definicao: "Saldo atual menos as contas fixas, as parcelas e os lançamentos agendados do período. Não soma as entradas previstas.",
      referencia: "próximos 60 dias"
    },
    nao_alocado: {
      rotulo: "Não alocado",
      definicao: "Dinheiro que entra no saldo geral mas não está em nenhuma conta cadastrada.",
      referencia: "até hoje"
    },
    previsto: {
      rotulo: "Previsto",
      definicao: "O que a regra recorrente diz que deve acontecer no ciclo. Não move saldo.",
      referencia: "no ciclo"
    },
    realizado: {
      rotulo: "Realizado",
      definicao: "O que você confirmou que aconteceu de verdade. Move saldo.",
      referencia: "no ciclo"
    },
    analises_registradas: {
      rotulo: "Análises registradas",
      definicao: "Quantas compras você passou pelo FinCK of Reality antes de decidir.",
      referencia: "no período"
    },
    decisoes_conscientes: {
      rotulo: "Decisões conscientes",
      definicao: "Análises em que você escolheu adiar, buscar alternativa, comprar usado, reparar ou desistir. É a decisão registrada, não a prova de que ela se manteve.",
      referencia: "no período"
    },
    valor_potencial: {
      rotulo: "Valor potencial preservado",
      definicao: "Soma do preço das compras com decisão consciente. É o valor que deixou de sair naquele momento: você pode comprar depois, pagar outro preço ou gastar em um substituto.",
      referencia: "no período"
    },
    economia_confirmada: {
      rotulo: "Economia confirmada",
      definicao: "Parte do valor potencial em que você, no acompanhamento, disse que manteve a decisão ou resolveu com reparo/reuso.",
      referencia: "após o acompanhamento"
    },
    horas_equivalentes: {
      rotulo: "Horas de trabalho equivalentes",
      definicao: "Quanto tempo de trabalho o valor potencial representa, pela sua renda e jornada declaradas.",
      referencia: "no período"
    },
    indicador_responsavel: {
      rotulo: "Indicador de decisão responsável",
      definicao: "Resumo de 0 a 100 das suas respostas às seis perguntas de reflexão. Critérios e pesos são visíveis. Não mede impacto ambiental real.",
      referencia: "por análise"
    },
    resultado_ambiental: {
      rotulo: "Resultado ambiental",
      definicao: "Não medido pelo FinCK. O app registra decisões e reflexões e mostra, para cada item analisado, uma estimativa de carbono e água feita por IA; não mede o impacto real nem prova que um produto deixou de ser fabricado.",
      referencia: "fora do escopo"
    }
  };
  return {
    calcular: calcular,
    formatarTempo: formatarTempo,
    sintese: sintese,
    textoDuracao: textoDuracao,
    textoAtraso: textoAtraso,
    folgaForaDasMetas: folgaForaDasMetas,
    parteDasMetas: parteDasMetas,
    atrasoDias: atrasoDias,
    leituraHistorico: leituraHistorico,
    cadeiaDoImpacto: cadeiaDoImpacto,
    confirmacaoRegistro: confirmacaoRegistro,
    fraseHistorico: fraseHistorico,
    comparar: comparar,
    oQueMudou: oQueMudou,
    inferirCategoria: inferirCategoria,
    ROTULO_IMPACTO: ROTULO_IMPACTO,
    paraRegistro: paraRegistro,
    resumoHistorico: resumoHistorico,
    valorTotal: valorTotal,
    custoDeUso: custoDeUso,
    paraAcompanhar: paraAcompanhar,
    indicadorResponsavel: indicadorResponsavel,
    FAIXAS_RESPONSABILIDADE: FAIXAS_RESPONSABILIDADE,
    LIMITE_RESPONSABILIDADE: LIMITE_RESPONSABILIDADE,
    alternativas: alternativas,
    semaforo: semaforo,
    GLOSSARIO: GLOSSARIO,
    MOTIVOS: MOTIVOS
  };
})();
