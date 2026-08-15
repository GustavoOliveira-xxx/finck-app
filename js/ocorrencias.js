window.FinckOcorrencias = (() => {

  const ESTADOS = ["previsto", "pendente", "confirmado", "ajustado", "nao_realizado", "nao_pago"];
  const ABERTOS = ["previsto", "pendente"];
  const REALIZADOS = ["confirmado", "ajustado"];

  const diasNoMes = (ano, mes) => new Date(ano, mes + 1, 0).getDate();

  const iso = (d) => {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  const cicloDe = (data) => iso(data).slice(0, 7);

  function dataDoCiclo(ciclo, diaDoMes) {
    const [ano, mes] = ciclo.split("-").map(Number);
    const dia = Math.min(Number(diaDoMes) || 1, diasNoMes(ano, mes - 1));
    return new Date(ano, mes - 1, dia, 12, 0, 0);
  }

  function ciclosAoRedor(referencia = new Date(), quantos = 2) {
    const lista = [];
    for (let i = 0; i < quantos; i++) {
      const d = new Date(referencia.getFullYear(), referencia.getMonth() + i, 1);
      lista.push(cicloDe(d));
    }
    return lista;
  }

  function gerar(recorrentes, { referencia = new Date(), ciclos } = {}) {
    const alvos = ciclos || ciclosAoRedor(referencia);
    const ativos = (recorrentes || []).filter((r) => r.active !== false);
    const linhas = [];

    for (const ciclo of alvos) {
      for (const r of ativos) {
        const criadoEm = r.created_at ? String(r.created_at).slice(0, 7) : null;
        if (criadoEm && ciclo < criadoEm) continue;

        const quando = dataDoCiclo(ciclo, r.day_of_month);
        linhas.push({
          recurring_id: r.id,
          cycle: ciclo,
          due_date: iso(quando),
          description: r.description,
          type: r.type,

          category: r.type === "saida" ? (r.category || "Outros") : null,
          account_id: r.account_id || null,
          planned_amount: Number(r.amount) || 0,
          status: "previsto",
        });
      }
    }
    return linhas.filter((l) => l.planned_amount > 0);
  }

  const venceu = (oc, referencia = new Date()) =>
    String(oc.due_date) <= iso(referencia);

  function paraPendente(ocorrencias, referencia = new Date()) {
    return (ocorrencias || []).filter(
      (o) => o.status === "previsto" && venceu(o, referencia));
  }

  function pendentes(ocorrencias, referencia = new Date()) {
    return (ocorrencias || [])
      .filter((o) => ABERTOS.includes(o.status) && venceu(o, referencia))
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  }

  function futuras(ocorrencias, referencia = new Date()) {
    return (ocorrencias || [])
      .filter((o) => ABERTOS.includes(o.status) && !venceu(o, referencia))
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  }

  function cicloPronto(ocorrencias, ciclo, referencia = new Date()) {
    const doCiclo = (ocorrencias || []).filter((o) => o.cycle === ciclo);
    if (!doCiclo.length) return false;
    const ultima = doCiclo
      .map((o) => String(o.due_date))
      .sort()
      .pop();
    return iso(referencia) > ultima;
  }

  function movimentacaoDe(oc, valorReal, contaEscolhida) {
    const conta = contaEscolhida !== undefined ? contaEscolhida : oc.account_id;
    return {
      type: oc.type,
      description: oc.description,
      amount: Number(valorReal),
      date: oc.due_date,
      category: oc.type === "saida" ? (oc.category || "Outros") : null,

      account_id: conta || null,
      source: "recorrente",
      source_occurrence_id: oc.id || null,
    };
  }

  const realizada = (oc) => REALIZADOS.includes(oc?.status);

  function orfas(ocorrencias, transacoes) {
    const porOcorrencia = new Map();
    (transacoes || []).forEach((t) => {
      if (!t.source_occurrence_id) return;
      const chave = String(t.source_occurrence_id);
      if (!porOcorrencia.has(chave)) porOcorrencia.set(chave, []);
      porOcorrencia.get(chave).push(t);
    });

    const porId = new Map((ocorrencias || []).map((o) => [String(o.id), o]));
    const excluir = [];
    const soltarVinculo = [];
    const desvincular = [];
    const revincular = [];

    porOcorrencia.forEach((lista, chave) => {
      const oc = porId.get(chave);

      // Ocorrência sumiu (o recorrente foi apagado e o banco fez cascade).
      // O dinheiro se moveu de verdade: o lançamento fica, só perde o ponteiro.
      if (!oc) { lista.forEach((t) => soltarVinculo.push(t.id)); return; }

      // Ocorrência existe mas não está realizada: previsão não move saldo,
      // então este lançamento é sobra de uma gravação parcial.
      if (!realizada(oc)) { lista.forEach((t) => excluir.push(t.id)); return; }

      const ordenadas = [...lista].sort((a, b) =>
        String(a.created_at || "").localeCompare(String(b.created_at || "")));
      const boa = ordenadas.find((t) => String(t.id) === String(oc.transaction_id)) || ordenadas[0];

      ordenadas.filter((t) => String(t.id) !== String(boa.id)).forEach((t) => excluir.push(t.id));
      if (String(oc.transaction_id) !== String(boa.id)) revincular.push({ id: oc.id, transaction_id: boa.id });
    });

    (ocorrencias || []).forEach((oc) => {
      if (!oc.transaction_id) return;
      const existe = (transacoes || []).some((t) => String(t.id) === String(oc.transaction_id));
      if (!existe) desvincular.push(oc.id);
    });

    return { excluir, soltarVinculo, desvincular, revincular };
  }

  function estadoAposValor(oc, valorReal) {
    const previsto = Number(oc.planned_amount) || 0;
    const real = Number(valorReal) || 0;
    return Math.abs(real - previsto) < 0.005 ? "confirmado" : "ajustado";
  }

  function resumoDecisoes(ocorrencias) {
    const conta = (s) => (ocorrencias || []).filter((o) => o.status === s).length;
    return {
      confirmadas: conta("confirmado"),
      ajustadas: conta("ajustado"),
      naoRealizadas: conta("nao_realizado"),
      naoPagas: conta("nao_pago"),
      pendentes: conta("previsto") + conta("pendente"),
    };
  }

  return {
    ESTADOS, ABERTOS, REALIZADOS,
    iso, cicloDe, dataDoCiclo, ciclosAoRedor,
    gerar, venceu, paraPendente, pendentes, futuras, cicloPronto,
    movimentacaoDe, estadoAposValor, resumoDecisoes, realizada, orfas,
  };
})();
