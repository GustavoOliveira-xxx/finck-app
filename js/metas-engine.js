window.FinckMetas = (() => {
  const num = v => Number(v || 0);
  const TOLERANCIA = .005;
  const KINDS = [ "aporte", "retirada", "estorno", "ajuste" ];
  const sinalDoTipo = tipo => tipo === "saida" ? 1 : -1;
  const valorAssinado = (tipo, valor) => sinalDoTipo(tipo) * Math.abs(num(valor));
  const kindDoTipo = tipo => tipo === "saida" ? "aporte" : "retirada";
  function progresso(movimentos = []) {
    return (movimentos || []).reduce((s, m) => s + num(m.amount), 0);
  }
  function progressoPorMeta(movimentos = []) {
    const mapa = new Map;
    (movimentos || []).forEach(m => {
      const chave = String(m.goal_id);
      mapa.set(chave, (mapa.get(chave) || 0) + num(m.amount));
    });
    return mapa;
  }
  const daMeta = (movimentos, goalId) => (movimentos || []).filter(m => String(m.goal_id) === String(goalId));
  function historico(movimentos, goalId) {
    return daMeta(movimentos, goalId).slice().sort((a, b) => {
      const d = String(b.date || "").localeCompare(String(a.date || ""));
      return d !== 0 ? d : String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
  }
  const progressoExibido = movimentos => Math.max(0, progresso(movimentos));
  function paraRegistro({goal_id: goal_id, transaction_id: transaction_id = null, kind: kind, amount: amount, date: date, note: note = null, reverses_id: reverses_id = null}) {
    return {
      goal_id: goal_id,
      transaction_id: transaction_id,
      kind: kind,
      amount: num(amount),
      date: String(date || "").slice(0, 10),
      note: note,
      reverses_id: reverses_id
    };
  }
  const movimentoDoAporte = (goal_id, valor, {transaction_id: transaction_id = null, date: date, note: note = null} = {}) => paraRegistro({
    goal_id: goal_id,
    transaction_id: transaction_id,
    kind: "aporte",
    amount: Math.abs(num(valor)),
    date: date,
    note: note
  });
  const movimentoDaRetirada = (goal_id, valor, {transaction_id: transaction_id = null, date: date, note: note = null} = {}) => paraRegistro({
    goal_id: goal_id,
    transaction_id: transaction_id,
    kind: "retirada",
    amount: -Math.abs(num(valor)),
    date: date,
    note: note
  });
  const movimentoDoEstorno = (original, {date: date, note: note = null} = {}) => paraRegistro({
    goal_id: original.goal_id,
    transaction_id: original.transaction_id || null,
    kind: "estorno",
    amount: -num(original.amount),
    date: date,
    note: note,
    reverses_id: original.id || null
  });
  const estornoSemHistorico = (transacao, {date: date, note: note = null} = {}) => paraRegistro({
    goal_id: transacao.goal_id,
    transaction_id: transacao.id || null,
    kind: "estorno",
    amount: -valorAssinado(transacao.type, transacao.amount),
    date: date,
    note: note
  });
  const originalDaTransacao = (movimentos, transactionId) => (movimentos || []).find(m => String(m.transaction_id) === String(transactionId) && m.kind !== "estorno") || null;
  const jaEstornado = (movimentos, movimentoId) => (movimentos || []).some(m => String(m.reverses_id) === String(movimentoId));
  function divergencias(metas = [], movimentos = []) {
    const soma = progressoPorMeta(movimentos);
    return (metas || []).map(m => {
      const historicoValor = soma.get(String(m.id)) ?? 0;
      const cache = num(m.current_amount);
      return {
        id: m.id,
        nome: m.name,
        cache: cache,
        historico: historicoValor,
        diferenca: cache - historicoValor,
        temHistorico: soma.has(String(m.id))
      };
    }).filter(d => Math.abs(d.diferenca) > TOLERANCIA);
  }
  function semHistorico(metas = [], movimentos = []) {
    const soma = progressoPorMeta(movimentos);
    return (metas || []).filter(m => num(m.current_amount) !== 0 && !soma.has(String(m.id)));
  }
  const conferem = (metas, movimentos) => divergencias(metas, movimentos).length === 0;
  function resumo(movimentos = []) {
    const conta = k => (movimentos || []).filter(m => m.kind === k).length;
    return {
      total: (movimentos || []).length,
      aportes: conta("aporte"),
      retiradas: conta("retirada"),
      estornos: conta("estorno"),
      ajustes: conta("ajuste"),
      progresso: progresso(movimentos)
    };
  }
  return {
    KINDS: KINDS,
    TOLERANCIA: TOLERANCIA,
    sinalDoTipo: sinalDoTipo,
    valorAssinado: valorAssinado,
    kindDoTipo: kindDoTipo,
    progresso: progresso,
    progressoPorMeta: progressoPorMeta,
    progressoExibido: progressoExibido,
    historico: historico,
    daMeta: daMeta,
    paraRegistro: paraRegistro,
    movimentoDoAporte: movimentoDoAporte,
    movimentoDaRetirada: movimentoDaRetirada,
    movimentoDoEstorno: movimentoDoEstorno,
    estornoSemHistorico: estornoSemHistorico,
    originalDaTransacao: originalDaTransacao,
    jaEstornado: jaEstornado,
    divergencias: divergencias,
    semHistorico: semHistorico,
    conferem: conferem,
    resumo: resumo
  };
})();
