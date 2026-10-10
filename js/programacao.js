window.FinckProgramacao = (() => {
  const U = window.FinckUtils;
  const diasNoMes = (ano, mes) => new Date(ano, mes + 1, 0).getDate();
  const dataDoDia = (ano, mes, dia) => new Date(ano, mes, Math.min(dia, diasNoMes(ano, mes)), 12, 0, 0);
  function proximaData(diaDoMes, referencia = new Date) {
    const ano = referencia.getFullYear();
    const mes = referencia.getMonth();
    const desteMes = dataDoDia(ano, mes, diaDoMes);
    const hoje = new Date(ano, mes, referencia.getDate(), 0, 0, 0);
    if (desteMes >= hoje) {
      return desteMes;
    }
    return dataDoDia(mes === 11 ? ano + 1 : ano, (mes + 1) % 12, diaDoMes);
  }
  const O = () => window.FinckOcorrencias;
  const daISO = texto => {
    const [ano, mes, dia] = String(texto).split("-").map(Number);
    return new Date(ano, (mes || 1) - 1, dia || 1, 12, 0, 0);
  };
  const paraISO = d => {
    const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  function montarItem(id, descricao, valor, isoData, referencia) {
    const quando = daISO(isoData);
    const emDias = Math.round((quando - referencia) / 864e5);
    return {
      id: id,
      descricao: descricao,
      valor: Number(valor) || 0,
      data: quando,
      iso: isoData,
      emDias: emDias,
      vencido: emDias < 0
    };
  }
  function ciclosNaJanela(referencia, limite) {
    const lista = [];
    const passo = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
    const fim = new Date(limite.getFullYear(), limite.getMonth(), 1);
    while (passo <= fim) {
      lista.push(paraISO(passo).slice(0, 7));
      passo.setMonth(passo.getMonth() + 1);
    }
    return lista;
  }
  // Uma conta agendada no extrato e a previsão do recorrente no mesmo dia, com
  // o mesmo nome e o mesmo valor, são a mesma saída: entra uma vez só.
  const chaveDoItem = c => `${String(c.descricao || "").trim().toLowerCase()}|${Math.round(c.valor * 100)}|${c.iso}`;
  // Parcelas em aberto também são saídas previstas. As atrasadas continuam
  // contando, como as previsões vencidas, até a pessoa registrar o pagamento.
  function parcelasEmAberto(parcelamentos, pagamentos, referencia) {
    const P = window.FinckPlano;
    if (!P || !(parcelamentos || []).length) {
      return [];
    }
    const porCompra = P.pagamentosPorCompra(pagamentos || []);
    const itens = [];
    for (const p of parcelamentos.filter(x => x.active !== false)) {
      const total = Math.max(1, Number(p.installments_count) || 1);
      for (const c of P.cronograma(p, porCompra.get(String(p.id)) || [])) {
        if (c.paga) {
          continue;
        }
        itens.push({
          ...montarItem(`pa:${p.id}|${c.numero}`, `${p.description || "Compra parcelada"} (parcela ${c.numero}/${total})`, c.valor, paraISO(c.vencimento), referencia),
          origem: "parcela"
        });
      }
    }
    return itens;
  }
  // Previsão em aberto de um recorrente que já foi apagado não é mais
  // compromisso. As já decididas ficam: são histórico.
  function ocorrenciasVigentes(ocorrencias, recorrentes) {
    if (!Array.isArray(recorrentes)) {
      return ocorrencias || [];
    }
    const abertos = O() ? O().ABERTOS : [ "previsto", "pendente" ];
    const ids = new Set(recorrentes.map(r => String(r.id)));
    return (ocorrencias || []).filter(o => ids.has(String(o.recurring_id)) || !abertos.includes(o.status));
  }
  // tipo "saida" (padrão) lista o que vai sair; "entrada", o que deve entrar.
  // Saídas somam recorrentes, parcelas e lançamentos agendados com data futura.
  function compromissos({ocorrencias: ocorrencias, recorrentes: recorrentes, parcelamentos: parcelamentos, pagamentos: pagamentos, agendadas: agendadas} = {}, {dias: dias = 60, referencia: referencia = new Date, tipo: tipo = "saida"} = {}) {
    const limite = new Date(referencia);
    limite.setDate(limite.getDate() + dias);
    const isoHoje = paraISO(referencia);
    const isoLimite = paraISO(limite);
    const abertos = O() ? O().ABERTOS : [ "previsto", "pendente" ];
    const vigentes = ocorrenciasVigentes(ocorrencias, recorrentes);
    const daOcorrencia = vigentes.filter(o => o.type === tipo && abertos.includes(o.status)).map(o => ({
      ...montarItem(`oc:${o.id || `${o.recurring_id}|${o.cycle}`}`, o.description, o.planned_amount, String(o.due_date), referencia),
      origem: "recorrente"
    }));
    // Cada recorrente responde pelo próprio ciclo: a ocorrência de um não
    // esconde a previsão de outro criado depois.
    const cobertos = new Set(vigentes.map(o => `${o.recurring_id}|${o.cycle}`));
    const ativos = (recorrentes || []).filter(r => r.active !== false && r.type === tipo);
    const projetados = [];
    for (const ciclo of ciclosNaJanela(referencia, limite)) {
      for (const r of ativos) {
        if (cobertos.has(`${r.id}|${ciclo}`)) {
          continue;
        }
        const criadoEm = r.created_at ? String(r.created_at).slice(0, 7) : null;
        if (criadoEm && ciclo < criadoEm) {
          continue;
        }
        const [ano, mes] = ciclo.split("-").map(Number);
        const ultimo = new Date(ano, mes, 0).getDate();
        const dia = Math.min(Number(r.day_of_month) || 1, ultimo);
        const isoData = `${ciclo}-${String(dia).padStart(2, "0")}`;
        if (isoData < isoHoje) {
          continue;
        }
        projetados.push({
          ...montarItem(`re:${r.id}|${ciclo}`, r.description, r.amount, isoData, referencia),
          origem: "recorrente"
        });
      }
    }
    const previstos = [ ...daOcorrencia, ...projetados ];
    const jaPrevistos = new Set(previstos.map(chaveDoItem));
    const daAgenda = (agendadas || []).filter(t => t.type === tipo && !t.reversed_at && String(t.date || "").slice(0, 10) > isoHoje).map(t => ({
      ...montarItem(`ag:${t.id}`, t.description, t.amount, String(t.date).slice(0, 10), referencia),
      origem: "agendada"
    })).filter(c => !jaPrevistos.has(chaveDoItem(c)));
    const daParcela = tipo === "saida" ? parcelasEmAberto(parcelamentos, pagamentos, referencia) : [];
    return [ ...previstos, ...daAgenda, ...daParcela ].filter(c => c.valor > 0 && c.iso <= isoLimite).sort((a, b) => a.iso.localeCompare(b.iso));
  }
  function acumular(lista) {
    let soma = 0;
    return lista.map(c => {
      soma += c.valor;
      return {
        ...c,
        acumulado: soma
      };
    });
  }
  function marcos(lista) {
    const porData = new Map;
    for (const c of acumular(lista)) {
      porData.set(c.iso, {
        iso: c.iso,
        data: c.data,
        acumulado: c.acumulado
      });
    }
    return [ ...porData.values() ];
  }
  function panorama(fonte, saldo, opcoes = {}) {
    const lista = acumular(compromissos(fonte, {
      ...opcoes,
      tipo: "saida"
    }));
    const total = lista.length ? lista[lista.length - 1].acumulado : 0;
    const vencidos = lista.filter(c => c.vencido);
    const totalVencido = vencidos.reduce((s, c) => s + c.valor, 0);
    const proximo = lista.find(c => !c.vencido) || null;
    const ateProximo = proximo ? totalVencido + lista.filter(c => c.iso === proximo.iso).reduce((s, c) => s + c.valor, 0) : totalVencido;
    // As entradas previstas não entram no caixa abaixo (ele responde "o saldo
    // de hoje cobre o que vai sair?"), mas aparecem ao lado, para ninguém
    // achar que o próximo salário foi esquecido.
    const entradas = compromissos(fonte, {
      ...opcoes,
      tipo: "entrada"
    });
    const dias = Number(opcoes.dias) || 60;
    const limite = new Date(opcoes.referencia || new Date);
    limite.setDate(limite.getDate() + dias);
    // Primeira data em que a soma das saídas passa o saldo de hoje.
    const rompe = lista.find(c => c.acumulado > (Number(saldo) || 0)) || null;
    // Caixa corrido: saldo de hoje com entradas e saídas na ordem das datas (no
    // mesmo dia, a entrada antes). Só ele diz se o dinheiro falta de verdade.
    // Entrada vencida e ainda não confirmada não conta: pode não ter chegado.
    const corrida = [ ...entradas.filter(c => !c.vencido).map(c => ({
      iso: c.iso,
      data: c.data,
      valor: c.valor
    })), ...lista.map(c => ({
      iso: c.iso,
      data: c.data,
      valor: -c.valor
    })) ].sort((a, b) => a.iso.localeCompare(b.iso) || b.valor - a.valor);
    let corrido = Number(saldo) || 0;
    let menorCaixa = corrido;
    let faltaEm = null;
    for (const e of corrida) {
      corrido += e.valor;
      menorCaixa = Math.min(menorCaixa, corrido);
      if (!faltaEm && corrido < 0) {
        faltaEm = e.data;
      }
    }
    return {
      compromissos: lista,
      marcos: marcos(lista),
      proximo: proximo,
      vencidos: vencidos,
      totalVencido: totalVencido,
      comprometidoAteProximo: ateProximo,
      comprometidoTotal: total,
      saldo: Number(saldo) || 0,
      naoComprometido: (Number(saldo) || 0) - total,
      entradasPrevistas: entradas.reduce((s, c) => s + c.valor, 0),
      janelaDias: dias,
      limite: limite,
      descobertoEm: rompe ? rompe.data : null,
      menorCaixaComEntradas: menorCaixa,
      descobertoComEntradasEm: faltaEm
    };
  }
  const rotuloData = d => d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  });
  const rotuloLongo = d => d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long"
  });
  function quandoTexto(emDias) {
    if (emDias < 0) {
      return emDias === -1 ? "venceu ontem" : `venceu há ${-emDias} dias`;
    }
    if (emDias === 0) {
      return "hoje";
    }
    if (emDias === 1) {
      return "amanhã";
    }
    if (emDias <= 30) {
      return `em ${emDias} dias`;
    }
    const meses = Math.round(emDias / 30);
    return `em ${meses} ${meses === 1 ? "mês" : "meses"}`;
  }
  return {
    proximaData: proximaData,
    ocorrenciasVigentes: ocorrenciasVigentes,
    compromissos: compromissos,
    acumular: acumular,
    marcos: marcos,
    panorama: panorama,
    rotuloData: rotuloData,
    rotuloLongo: rotuloLongo,
    quandoTexto: quandoTexto
  };
})();
