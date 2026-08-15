window.FinckContas = (() => {
  const cfg = window.FINCK_CONFIG;
  const num = (v) => Number(v || 0);

  function instituicao(id) {
    return cfg.INSTITUICOES.find((i) => i.id === id)
        || cfg.INSTITUICOES.find((i) => i.id === "outro");
  }

  const rotuloTipo = (id) =>
    (cfg.TIPOS_CONTA.find((t) => t.id === id) || { rotulo: "Conta" }).rotulo;

  function saldoDaConta(conta, { transacoes = [], transferencias = [], ajustes = [] } = {}) {
    const id = String(conta.id);
    let saldo = num(conta.initial_balance);

    transacoes.forEach((t) => {
      if (String(t.account_id) !== id) return;
      saldo += t.type === "entrada" ? num(t.amount) : -num(t.amount);
    });

    transferencias.forEach((t) => {
      if (String(t.from_account_id) === id) saldo -= num(t.amount);
      if (String(t.to_account_id) === id) saldo += num(t.amount);
    });

    ajustes.forEach((a) => {
      if (String(a.account_id) === id) saldo += num(a.amount);
    });

    return saldo;
  }

  function saldos(contas, movimentos) {
    return contas
      .map((c) => {
        const inst = instituicao(c.institution_name);
        return {
          ...c,
          saldo: saldoDaConta(c, movimentos),
          instituicao: inst,
          tipoRotulo: rotuloTipo(c.account_type),
          negativa: saldoDaConta(c, movimentos) < 0,
        };
      })
      .sort((a, b) => b.saldo - a.saldo);
  }

  function consolidado(contas, movimentos, compromissos = {}) {
    const ativas = contas.filter((c) => c.active !== false);
    const comSaldo = saldos(ativas, movimentos);
    const disponivel = comSaldo.reduce((s, c) => s + c.saldo, 0);

    const faturas = num(compromissos.faturas);
    const parcelas = num(compromissos.parcelas);
    const previstas = num(compromissos.despesasPrevistas);
    const totalCompromissos = faturas + parcelas + previstas;

    return {
      contas: comSaldo,
      quantidade: comSaldo.length,
      disponivel,
      faturas,
      parcelas,
      despesasPrevistas: previstas,
      compromissos: totalCompromissos,
      liquido: disponivel - totalCompromissos,
      negativas: comSaldo.filter((c) => c.saldo < 0),
    };
  }

  function porInstituicao(contasComSaldo) {
    const mapa = new Map();
    contasComSaldo.forEach((c) => {
      const chave = c.institution_name || "outro";
      if (!mapa.has(chave)) {
        mapa.set(chave, { instituicao: instituicao(chave), total: 0, contas: 0 });
      }
      const linha = mapa.get(chave);
      linha.total += c.saldo;
      linha.contas += 1;
    });
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }

  function validarTransferencia({ origem, destino, valor }) {
    if (!origem || !destino) return "Escolha a conta de origem e a de destino.";
    if (String(origem) === String(destino)) return "A conta de destino precisa ser diferente da origem.";
    if (!(num(valor) > 0)) return "Informe um valor maior que zero.";
    return null;
  }

  const diferencaDoAjuste = (saldoEsperado, saldoReal) => num(saldoReal) - num(saldoEsperado);

  const semConta = (transacoes) => transacoes.filter((t) => !t.account_id).length;

  return {
    instituicao, rotuloTipo,
    saldoDaConta, saldos, consolidado, porInstituicao,
    validarTransferencia, diferencaDoAjuste, semConta,
  };
})();
