// Livro-razão das metas.
//
// O relatório de conclusão pede que o progresso de uma meta seja recalculável
// a partir do histórico de movimentos, e não uma verdade independente guardada
// em current_amount. Este módulo é a aritmética desse livro: soma assinada,
// sem filtro e sem caso especial.
//
//   aporte   → valor positivo
//   retirada → valor negativo
//   estorno  → sinal oposto ao do movimento que ele reverte
//
// Somar a coluna inteira devolve o progresso. É essa propriedade que permite
// dizer "o progresso mudou exatamente uma vez" e provar isso depois.
window.FinckMetas = (() => {
  const num = (v) => Number(v || 0);
  const TOLERANCIA = 0.005;

  const KINDS = ["aporte", "retirada", "estorno", "ajuste"];

  // Uma saída vinculada à meta guarda dinheiro (progresso sobe); uma entrada
  // vinculada tira dinheiro de lá (progresso desce).
  const sinalDoTipo = (tipo) => (tipo === "saida" ? 1 : -1);

  const valorAssinado = (tipo, valor) => sinalDoTipo(tipo) * Math.abs(num(valor));

  const kindDoTipo = (tipo) => (tipo === "saida" ? "aporte" : "retirada");

  function progresso(movimentos = []) {
    return (movimentos || []).reduce((s, m) => s + num(m.amount), 0);
  }

  function progressoPorMeta(movimentos = []) {
    const mapa = new Map();
    (movimentos || []).forEach((m) => {
      const chave = String(m.goal_id);
      mapa.set(chave, (mapa.get(chave) || 0) + num(m.amount));
    });
    return mapa;
  }

  const daMeta = (movimentos, goalId) =>
    (movimentos || []).filter((m) => String(m.goal_id) === String(goalId));

  function historico(movimentos, goalId) {
    return daMeta(movimentos, goalId)
      .slice()
      .sort((a, b) => {
        const d = String(b.date || "").localeCompare(String(a.date || ""));
        return d !== 0 ? d : String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });
  }

  // Progresso derivado, nunca abaixo de zero: uma meta não fica devendo.
  // O valor bruto continua acessível para a reconciliação enxergar o erro.
  const progressoExibido = (movimentos) => Math.max(0, progresso(movimentos));

  function paraRegistro({ goal_id, transaction_id = null, kind, amount, date, note = null, reverses_id = null }) {
    return {
      goal_id,
      transaction_id,
      kind,
      amount: num(amount),
      date: String(date || "").slice(0, 10),
      note,
      reverses_id,
    };
  }

  const movimentoDoAporte = (goal_id, valor, { transaction_id = null, date, note = null } = {}) =>
    paraRegistro({
      goal_id, transaction_id, kind: "aporte",
      amount: Math.abs(num(valor)), date, note,
    });

  const movimentoDaRetirada = (goal_id, valor, { transaction_id = null, date, note = null } = {}) =>
    paraRegistro({
      goal_id, transaction_id, kind: "retirada",
      amount: -Math.abs(num(valor)), date, note,
    });

  // O estorno não apaga: acrescenta a contrapartida. O movimento original
  // continua no histórico, marcado, para a auditoria não perder o fato.
  const movimentoDoEstorno = (original, { date, note = null } = {}) =>
    paraRegistro({
      goal_id: original.goal_id,
      transaction_id: original.transaction_id || null,
      kind: "estorno",
      amount: -num(original.amount),
      date,
      note,
      reverses_id: original.id || null,
    });

  // Estorno de um lançamento antigo, anterior ao livro-razão: não há linha
  // original para reverter, então a contrapartida sai do próprio lançamento.
  const estornoSemHistorico = (transacao, { date, note = null } = {}) =>
    paraRegistro({
      goal_id: transacao.goal_id,
      transaction_id: transacao.id || null,
      kind: "estorno",
      amount: -valorAssinado(transacao.type, transacao.amount),
      date,
      note,
    });

  const originalDaTransacao = (movimentos, transactionId) =>
    (movimentos || []).find(
      (m) => String(m.transaction_id) === String(transactionId) && m.kind !== "estorno") || null;

  const jaEstornado = (movimentos, movimentoId) =>
    (movimentos || []).some((m) => String(m.reverses_id) === String(movimentoId));

  // Comparação entre o cache e o histórico. É o que o reconciliador mostra:
  // divergência declarada em vez de dois números diferentes na tela.
  function divergencias(metas = [], movimentos = []) {
    const soma = progressoPorMeta(movimentos);
    return (metas || [])
      .map((m) => {
        const historicoValor = soma.get(String(m.id)) ?? 0;
        const cache = num(m.current_amount);
        return {
          id: m.id,
          nome: m.name,
          cache,
          historico: historicoValor,
          diferenca: cache - historicoValor,
          temHistorico: soma.has(String(m.id)),
        };
      })
      .filter((d) => Math.abs(d.diferenca) > TOLERANCIA);
  }

  // Metas que nunca receberam um movimento: o cache é tudo o que existe.
  // Não é erro — é dado de antes do livro-razão — mas precisa ser visível.
  function semHistorico(metas = [], movimentos = []) {
    const soma = progressoPorMeta(movimentos);
    return (metas || []).filter(
      (m) => num(m.current_amount) !== 0 && !soma.has(String(m.id)));
  }

  const conferem = (metas, movimentos) => divergencias(metas, movimentos).length === 0;

  function resumo(movimentos = []) {
    const conta = (k) => (movimentos || []).filter((m) => m.kind === k).length;
    return {
      total: (movimentos || []).length,
      aportes: conta("aporte"),
      retiradas: conta("retirada"),
      estornos: conta("estorno"),
      ajustes: conta("ajuste"),
      progresso: progresso(movimentos),
    };
  }

  return {
    KINDS, TOLERANCIA,
    sinalDoTipo, valorAssinado, kindDoTipo,
    progresso, progressoPorMeta, progressoExibido, historico, daMeta,
    paraRegistro, movimentoDoAporte, movimentoDaRetirada,
    movimentoDoEstorno, estornoSemHistorico,
    originalDaTransacao, jaEstornado,
    divergencias, semHistorico, conferem, resumo,
  };
})();
