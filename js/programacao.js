window.FinckProgramacao = (() => {
  const U = window.FinckUtils;

  const diasNoMes = (ano, mes) => new Date(ano, mes + 1, 0).getDate();

  const dataDoDia = (ano, mes, dia) =>
    new Date(ano, mes, Math.min(dia, diasNoMes(ano, mes)), 12, 0, 0);

  function proximaData(diaDoMes, referencia = new Date()) {
    const ano = referencia.getFullYear();
    const mes = referencia.getMonth();
    const desteMes = dataDoDia(ano, mes, diaDoMes);
    const hoje = new Date(ano, mes, referencia.getDate(), 0, 0, 0);
    if (desteMes >= hoje) return desteMes;
    return dataDoDia(mes === 11 ? ano + 1 : ano, (mes + 1) % 12, diaDoMes);
  }

  const O = () => window.FinckOcorrencias;

  const daISO = (texto) => {
    const [ano, mes, dia] = String(texto).split("-").map(Number);
    return new Date(ano, (mes || 1) - 1, dia || 1, 12, 0, 0);
  };

  const paraISO = (d) => {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  function montarItem(id, descricao, valor, isoData, referencia) {
    const quando = daISO(isoData);
    const emDias = Math.round((quando - referencia) / 86400000);
    return {
      id,
      descricao,
      valor: Number(valor) || 0,
      data: quando,
      iso: isoData,
      emDias,
      vencido: emDias < 0,
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

  function compromissos({ ocorrencias, recorrentes } = {}, { dias = 60, referencia = new Date() } = {}) {
    const limite = new Date(referencia);
    limite.setDate(limite.getDate() + dias);
    const isoHoje = paraISO(referencia);
    const isoLimite = paraISO(limite);
    const abertos = O() ? O().ABERTOS : ["previsto", "pendente"];

    const daOcorrencia = (ocorrencias || [])
      .filter((o) => o.type === "saida" && abertos.includes(o.status))
      .map((o) => montarItem(
        `oc:${o.id || `${o.recurring_id}|${o.cycle}`}`,
        o.description, o.planned_amount, String(o.due_date), referencia));

    const cobertos = new Set((ocorrencias || []).map((o) => o.cycle));
    const ativos = (recorrentes || []).filter((r) => r.active !== false && r.type === "saida");
    const projetados = [];

    for (const ciclo of ciclosNaJanela(referencia, limite)) {
      if (cobertos.has(ciclo)) continue;
      for (const r of ativos) {
        const criadoEm = r.created_at ? String(r.created_at).slice(0, 7) : null;
        if (criadoEm && ciclo < criadoEm) continue;
        const [ano, mes] = ciclo.split("-").map(Number);
        const ultimo = new Date(ano, mes, 0).getDate();
        const dia = Math.min(Number(r.day_of_month) || 1, ultimo);
        const isoData = `${ciclo}-${String(dia).padStart(2, "0")}`;
        if (isoData < isoHoje) continue;
        projetados.push(montarItem(
          `re:${r.id}|${ciclo}`, r.description, r.amount, isoData, referencia));
      }
    }

    return [...daOcorrencia, ...projetados]
      .filter((c) => c.valor > 0 && c.iso <= isoLimite)
      .sort((a, b) => a.iso.localeCompare(b.iso));
  }

  function acumular(lista) {
    let soma = 0;
    return lista.map((c) => {
      soma += c.valor;
      return { ...c, acumulado: soma };
    });
  }

  function marcos(lista) {
    const porData = new Map();
    for (const c of acumular(lista)) {
      porData.set(c.iso, { iso: c.iso, data: c.data, acumulado: c.acumulado });
    }
    return [...porData.values()];
  }

  function panorama(fonte, saldo, opcoes = {}) {
    const lista = acumular(compromissos(fonte, opcoes));
    const total = lista.length ? lista[lista.length - 1].acumulado : 0;

    const vencidos = lista.filter((c) => c.vencido);
    const totalVencido = vencidos.reduce((s, c) => s + c.valor, 0);

    const proximo = lista.find((c) => !c.vencido) || null;
    const ateProximo = proximo
      ? totalVencido + lista.filter((c) => c.iso === proximo.iso).reduce((s, c) => s + c.valor, 0)
      : totalVencido;

    return {
      compromissos: lista,
      marcos: marcos(lista),
      proximo,
      vencidos,
      totalVencido,
      comprometidoAteProximo: ateProximo,
      comprometidoTotal: total,
      saldo: Number(saldo) || 0,
      naoComprometido: (Number(saldo) || 0) - total,
    };
  }

  const rotuloData = (d) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const rotuloLongo = (d) =>
    d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

  function quandoTexto(emDias) {
    if (emDias < 0) return emDias === -1 ? "venceu ontem" : `venceu há ${-emDias} dias`;
    if (emDias === 0) return "hoje";
    if (emDias === 1) return "amanhã";
    if (emDias <= 30) return `em ${emDias} dias`;
    const meses = Math.round(emDias / 30);
    return `em ${meses} ${meses === 1 ? "mês" : "meses"}`;
  }

  return { proximaData, compromissos, acumular, marcos, panorama, rotuloData, rotuloLongo, quandoTexto };
})();
