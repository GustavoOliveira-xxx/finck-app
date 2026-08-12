

window.FinckHistorico = (() => {
  const cfg = window.FINCK_CONFIG;
  const num = (v) => Number(v || 0);

  const chaveMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const rotuloMes = (chave) => {
    const [ano, mes] = String(chave).split("-").map(Number);
    return new Date(ano, mes - 1, 1)
      .toLocaleDateString(cfg.LOCALE, { month: "short", year: "2-digit" });
  };

  function mesesAte(mesRef, quantidade = 6) {
    const [ano, mes] = String(mesRef).split("-").map(Number);
    const saida = [];
    for (let i = quantidade - 1; i >= 0; i--) {
      saida.push(chaveMes(new Date(ano, mes - 1 - i, 1)));
    }
    return saida;
  }

  const saidasDoMes = (transacoes, mes, categoria = null) =>
    transacoes
      .filter((t) => t.type === "saida" && String(t.date || "").slice(0, 7) === mes)
      .filter((t) => (categoria ? (t.category || "Outros") === categoria : true))
      .reduce((s, t) => s + num(t.amount), 0);

  function serieDaCategoria(transacoes, categoria, mesRef, meses = 6) {
    const chaves = mesesAte(mesRef, meses);
    const serie = chaves.map((m) => ({
      mes: m,
      rotulo: rotuloMes(m),
      total: saidasDoMes(transacoes, m, categoria),
      atual: m === mesRef,
    }));

    const atual = serie[serie.length - 1].total;
    const anteriores = serie.slice(0, -1).filter((l) => l.total > 0);
    const mediaAnterior = anteriores.length
      ? anteriores.reduce((s, l) => s + l.total, 0) / anteriores.length
      : 0;

    const diferenca = atual - mediaAnterior;
    const variacao = mediaAnterior > 0 ? (diferenca / mediaAnterior) * 100 : 0;

    return {
      categoria,
      serie,
      atual,
      mediaAnterior,
      diferenca,
      variacao,
      temHistorico: anteriores.length > 0,
      maior: Math.max(...serie.map((l) => l.total), 1),
    };
  }

  function panorama(transacoes, mesRef, meses = 6) {
    const categorias = [...new Set(
      transacoes
        .filter((t) => t.type === "saida" && String(t.date || "").slice(0, 7) === mesRef)
        .map((t) => t.category || "Outros")
    )];

    const totalMes = saidasDoMes(transacoes, mesRef);

    const linhas = categorias
      .map((c) => {
        const s = serieDaCategoria(transacoes, c, mesRef, meses);
        return {
          ...s,
          fatia: totalMes > 0 ? (s.atual / totalMes) * 100 : 0,
        };
      })
      .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));

    const geral = serieDaCategoria(transacoes, null, mesRef, meses);

    return { mes: mesRef, totalMes, geral, linhas };
  }

  function observacao(linha) {
    if (!linha.temHistorico) return null;
    if (linha.atual === 0) return null;

    const abs = Math.abs(linha.diferenca);
    if (abs < 1) return null;

    const moeda = (v) => num(v).toLocaleString(cfg.LOCALE, { style: "currency", currency: cfg.MOEDA });

    if (linha.diferenca > 0) {
      return `${moeda(abs)} acima da sua média dos meses anteriores.`;
    }
    return `${moeda(abs)} abaixo da sua média dos meses anteriores.`;
  }

  const tendencia = (linha) => {
    if (!linha.temHistorico || Math.abs(linha.variacao) < 10) return "estavel";
    return linha.diferenca > 0 ? "acima" : "abaixo";
  };

  return { mesesAte, rotuloMes, serieDaCategoria, panorama, observacao, tendencia };
})();
