window.FinckPlano = (() => {
  const cfg = window.FINCK_CONFIG;
  const num = v => Number(v || 0);
  const chaveMes = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const isoLocal = d => {
    const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const somarMeses = (data, n) => {
    const d = new Date(data.getFullYear(), data.getMonth() + n, 1);
    const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(data.getDate(), ultimoDia));
    return d;
  };
  const paraData = iso => new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  function dividirParcelas(total, quantidade) {
    const t = Math.round(num(total) * 100);
    const q = Math.max(1, Math.floor(num(quantidade)));
    const base = Math.floor(t / q);
    const sobra = t - base * q;
    return Array.from({
      length: q
    }, (_, i) => (base + (i === q - 1 ? sobra : 0)) / 100);
  }
  const valorParcela = (total, quantidade) => dividirParcelas(total, quantidade)[0];
  function pagamentosPorCompra(pagamentos = []) {
    const mapa = new Map;
    (pagamentos || []).forEach(pg => {
      const chave = String(pg.purchase_id);
      if (!mapa.has(chave)) {
        mapa.set(chave, []);
      }
      mapa.get(chave).push(pg);
    });
    return mapa;
  }
  function cronograma(parcelamento, pagamentos = []) {
    const q = Math.max(1, num(parcelamento.installments_count));
    const valores = dividirParcelas(parcelamento.total_amount, q);
    const inicio = paraData(parcelamento.first_due_date);
    const pagas = num(parcelamento.paid_count);
    const porNumero = new Map((pagamentos || []).map(pg => [ Number(pg.installment_no), pg ]));
    return valores.map((valor, i) => {
      const venc = somarMeses(inicio, i);
      const registro = porNumero.get(i + 1) || null;
      const paga = registro ? registro.status === "paga" : i < pagas;
      return {
        numero: i + 1,
        valor: valor,
        vencimento: venc,
        mes: chaveMes(venc),
        paga: paga,
        estado: paga ? "realizado" : "previsto",
        transaction_id: registro?.transaction_id || null,
        pagamento_id: registro?.id || null
      };
    });
  }
  function saldoDevedor(p, pagamentos = []) {
    return cronograma(p, pagamentos).filter(c => !c.paga).reduce((s, c) => s + c.valor, 0);
  }
  function parcelasPorMes(parcelamentos, meses = 12, hoje = new Date, pagamentos = []) {
    const mapa = {};
    for (let i = 0; i < meses; i++) {
      mapa[chaveMes(somarMeses(hoje, i))] = 0;
    }
    const porCompra = pagamentosPorCompra(pagamentos);
    parcelamentos.filter(p => p.active !== false).forEach(p => {
      cronograma(p, porCompra.get(String(p.id)) || []).forEach(c => {
        if (c.paga) {
          return;
        }
        if (mapa[c.mes] !== undefined) {
          mapa[c.mes] += c.valor;
        }
      });
    });
    return mapa;
  }
  function movimentacaoDaParcela(parcelamento, parcela, {account_id: account_id = null, date: date} = {}) {
    return {
      type: "saida",
      description: `${parcelamento.description} (${parcela.numero}/${parcelamento.installments_count})`,
      amount: parcela.valor,
      date: date || isoLocal(parcela.vencimento),
      category: parcelamento.category || "Outros",
      account_id: account_id || parcelamento.account_id || null,
      source: "parcela"
    };
  }
  function situacaoOrcamento(tetos, transacoes, mes = chaveMes(new Date)) {
    const gastoPorCategoria = {};
    transacoes.filter(t => t.type === "saida" && String(t.date || "").slice(0, 7) === mes).forEach(t => {
      const c = t.category || "Outros";
      gastoPorCategoria[c] = (gastoPorCategoria[c] || 0) + num(t.amount);
    });
    return tetos.map(t => {
      const limite = num(t.limit_amount);
      const gasto = gastoPorCategoria[t.category] || 0;
      const percentual = limite > 0 ? gasto / limite * 100 : 0;
      return {
        id: t.id,
        categoria: t.category,
        limite: limite,
        gasto: gasto,
        restante: limite - gasto,
        percentual: percentual,
        situacao: percentual > 100 ? "estourado" : percentual === 100 ? "no_limite" : percentual >= 75 ? "atencao" : "tranquilo"
      };
    }).sort((a, b) => b.percentual - a.percentual);
  }
  function categoriasSemTeto(tetos, transacoes, mes = chaveMes(new Date)) {
    const comTeto = new Set(tetos.map(t => t.category));
    const vistas = new Set(transacoes.filter(t => t.type === "saida" && String(t.date || "").slice(0, 7) === mes).map(t => t.category || "Outros"));
    return [ ...vistas ].filter(c => !comTeto.has(c));
  }
  function eventosDoMes({recorrentes: recorrentes = [], parcelamentos: parcelamentos = [], transacoes: transacoes = [], pagamentos: pagamentos = []}, mes = chaveMes(new Date)) {
    const porCompra = pagamentosPorCompra(pagamentos);
    const [ano, mesNum] = mes.split("-").map(Number);
    const diasNoMes = new Date(ano, mesNum, 0).getDate();
    const porDia = new Map;
    const add = (dia, evento) => {
      const d = Math.min(Math.max(1, dia), diasNoMes);
      if (!porDia.has(d)) {
        porDia.set(d, []);
      }
      porDia.get(d).push(evento);
    };
    recorrentes.filter(r => r.active !== false).forEach(r => add(num(r.day_of_month), {
      tipo: "recorrente",
      titulo: r.description,
      valor: num(r.amount),
      sinal: r.type === "entrada" ? 1 : -1,
      estado: "previsto"
    }));
    parcelamentos.filter(p => p.active !== false).forEach(p => cronograma(p, porCompra.get(String(p.id)) || []).filter(c => c.mes === mes && !c.paga).forEach(c => add(c.vencimento.getDate(), {
      tipo: "parcela",
      titulo: `${p.description} (${c.numero}/${p.installments_count})`,
      valor: c.valor,
      sinal: -1,
      estado: "previsto"
    })));
    transacoes.filter(t => String(t.date || "").slice(0, 7) === mes).forEach(t => add(Number(String(t.date).slice(8, 10)), {
      tipo: "lancamento",
      titulo: t.description,
      valor: num(t.amount),
      sinal: t.type === "entrada" ? 1 : -1,
      estado: "realizado"
    }));
    return porDia;
  }
  const ABERTA = status => status === "previsto" || status === "pendente";
  function projecaoSaldo({saldo: saldo = 0, recorrentes: recorrentes = [], parcelamentos: parcelamentos = [], pagamentos: pagamentos = [], ocorrencias: ocorrencias = [], transacoesFuturas: transacoesFuturas = [], meses: meses = 6}, hoje = new Date) {
    const ativos = recorrentes.filter(r => r.active !== false);
    const decididos = new Set((ocorrencias || []).filter(o => !ABERTA(o.status)).map(o => `${o.recurring_id}|${o.cycle}`));
    const porMes = parcelasPorMes(parcelamentos, meses, hoje, pagamentos);
    const linhas = [];
    let acumulado = num(saldo);
    for (let i = 0; i < meses; i++) {
      const d = somarMeses(new Date(hoje.getFullYear(), hoje.getMonth(), 1), i);
      const mes = chaveMes(d);
      const aindaVem = r => i > 0 || num(r.day_of_month) >= hoje.getDate();
      const conta = r => !decididos.has(`${r.id}|${mes}`) && aindaVem(r);
      const entradasRec = ativos.filter(r => r.type === "entrada" && conta(r)).reduce((s, r) => s + num(r.amount), 0);
      const saidasRec = ativos.filter(r => r.type === "saida" && conta(r)).reduce((s, r) => s + num(r.amount), 0);
      const doMes = (transacoesFuturas || []).filter(t => String(t.date || "").slice(0, 7) === mes);
      const agendadoEntrada = doMes.filter(t => t.type === "entrada").reduce((s, t) => s + num(t.amount), 0);
      const agendadoSaida = doMes.filter(t => t.type === "saida").reduce((s, t) => s + num(t.amount), 0);
      const parcelas = porMes[mes] || 0;
      const entradas = entradasRec + agendadoEntrada;
      const saidas = saidasRec + parcelas + agendadoSaida;
      const resultado = entradas - saidas;
      acumulado += resultado;
      linhas.push({
        mes: mes,
        rotulo: d.toLocaleDateString(cfg.LOCALE, {
          month: "short",
          year: "2-digit"
        }),
        entradas: entradas,
        saidas: saidas,
        parcelas: parcelas,
        agendados: agendadoEntrada - agendadoSaida,
        resultado: resultado,
        saldoFim: acumulado,
        negativo: acumulado < 0
      });
    }
    return linhas;
  }
  const primeiroMesNegativo = projecao => projecao.find(l => l.negativo) || null;
  function planoDaMeta(meta, rendaLivre = 0, hoje = new Date) {
    const alvo = num(meta.target_amount);
    const atual = num(meta.current_amount);
    const falta = Math.max(0, alvo - atual);
    if (falta <= 0) {
      return null;
    }
    if (!meta.deadline) {
      return {
        falta: falta,
        meses: null,
        porMes: null,
        cabe: null,
        vencida: false
      };
    }
    const prazo = paraData(meta.deadline);
    if (Number.isNaN(prazo.getTime())) {
      return null;
    }
    const meses = (prazo.getFullYear() - hoje.getFullYear()) * 12 + (prazo.getMonth() - hoje.getMonth());
    if (meses <= 0) {
      return {
        falta: falta,
        meses: 0,
        porMes: falta,
        cabe: false,
        vencida: true
      };
    }
    const porMes = falta / meses;
    const livre = num(rendaLivre);
    return {
      falta: falta,
      meses: meses,
      porMes: porMes,
      cabe: livre > 0 ? porMes <= livre : null,
      fatiaDaRenda: livre > 0 ? porMes / livre * 100 : 0,
      vencida: false
    };
  }
  function atrasoNaMeta(meta, valorGasto, aportePorMes) {
    const porMes = num(aportePorMes);
    if (porMes <= 0) {
      return null;
    }
    const mesesExtras = num(valorGasto) / porMes;
    return {
      mesesExtras: mesesExtras,
      diasExtras: mesesExtras * 30,
      aproximado: true
    };
  }
  return {
    dividirParcelas: dividirParcelas,
    valorParcela: valorParcela,
    cronograma: cronograma,
    saldoDevedor: saldoDevedor,
    parcelasPorMes: parcelasPorMes,
    pagamentosPorCompra: pagamentosPorCompra,
    movimentacaoDaParcela: movimentacaoDaParcela,
    situacaoOrcamento: situacaoOrcamento,
    categoriasSemTeto: categoriasSemTeto,
    eventosDoMes: eventosDoMes,
    projecaoSaldo: projecaoSaldo,
    primeiroMesNegativo: primeiroMesNegativo,
    planoDaMeta: planoDaMeta,
    atrasoNaMeta: atrasoNaMeta,
    chaveMes: chaveMes,
    somarMeses: somarMeses,
    isoLocal: isoLocal
  };
})();
