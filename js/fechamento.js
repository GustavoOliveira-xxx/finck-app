window.FinckFechamento = (() => {
  const O = window.FinckOcorrencias;

  const soma = (lista, campo) =>
    (lista || []).reduce((s, r) => s + (Number(r[campo]) || 0), 0);

  const doCiclo = (lista, ciclo, campoData = "date") =>
    (lista || []).filter((r) => String(r[campoData] || "").slice(0, 7) === ciclo);

  function referencia(perfil, chave, receita) {
    const modo = perfil?.[`${chave}_mode`];
    const pct = Number(perfil?.[`${chave}_percent`]);
    const fixo = Number(perfil?.[`${chave}_amount`]);

    const temPct = Number.isFinite(pct) && pct > 0;
    const temFixo = Number.isFinite(fixo) && fixo > 0;
    if (!temPct && !temFixo) return { valor: 0, base: null };

    if (modo === "valor" && temFixo) return { valor: fixo, base: "valor" };
    if (modo === "percentual" && temPct) return { valor: (receita * pct) / 100, base: "percentual" };
    if (temPct) return { valor: (receita * pct) / 100, base: "percentual" };
    return { valor: fixo, base: "valor" };
  }

  function proporcional(perfil, chave, receitaEsperada, receitaRealizada) {
    const alvo = referencia(perfil, chave, receitaEsperada);
    if (!alvo.valor) return 0;
    if (alvo.base === "percentual") {
      const pct = Number(perfil?.[`${chave}_percent`]) || 0;
      return (receitaRealizada * pct) / 100;
    }
    if (!receitaEsperada) return alvo.valor;
    return alvo.valor * (receitaRealizada / receitaEsperada);
  }

  function resumo(ciclo, { ocorrencias, transacoes, perfil, categoriasLivres }) {
    const ocs = (ocorrencias || []).filter((o) => o.cycle === ciclo);
    const movs = doCiclo(transacoes, ciclo);

    const entradasPrevistas = ocs.filter((o) => o.type === "entrada");
    const saidasPrevistas = ocs.filter((o) => o.type === "saida");

    const receitaEsperada = soma(entradasPrevistas, "planned_amount");
    const despesaEsperada = soma(saidasPrevistas, "planned_amount");

    const receitaRealizada = soma(movs.filter((m) => m.type === "entrada"), "amount");
    const despesaRealizada = soma(movs.filter((m) => m.type === "saida"), "amount");

    const deRecorrentes = movs.filter((m) => m.source === "recorrente");
    const recorrentesRealizados = soma(deRecorrentes.filter((m) => m.type === "saida"), "amount");
    const outrasDespesas = despesaRealizada - recorrentesRealizados;

    const livres = categoriasLivres && categoriasLivres.length
      ? categoriasLivres
      : ["Lazer", "Vestuário", "Eletrônicos"];
    const rendaLivreUsada = soma(
      movs.filter((m) => m.type === "saida" && livres.includes(m.category)), "amount");

    const economiaRealizada = soma(
      movs.filter((m) => m.type === "saida" && m.goal_id), "amount");

    const abertas = ocs.filter((o) => O.ABERTOS.includes(o.status));

    return {
      ciclo,
      receitaEsperada,
      receitaRealizada,
      diferencaReceita: receitaRealizada - receitaEsperada,
      despesaEsperada,
      despesaRealizada,
      recorrentesRealizados,
      outrasDespesas,
      resultado: receitaRealizada - despesaRealizada,

      rendaLivrePlanejada: referencia(perfil, "free_income", receitaEsperada).valor,
      rendaLivreProporcional: proporcional(perfil, "free_income", receitaEsperada, receitaRealizada),
      rendaLivreUsada,

      economiaPlanejada: referencia(perfil, "savings", receitaEsperada).valor,
      economiaProporcional: proporcional(perfil, "savings", receitaEsperada, receitaRealizada),
      economiaRealizada,

      pendencias: abertas.length,
      completo: abertas.length === 0,
      decisoes: O.resumoDecisoes(ocs),
    };
  }

  function paraRegistro(r) {
    const n = (v) => Number((Number(v) || 0).toFixed(2));
    return {
      cycle: r.ciclo,
      expected_income: n(r.receitaEsperada),
      realized_income: n(r.receitaRealizada),
      expected_expense: n(r.despesaEsperada),
      realized_expense: n(r.despesaRealizada),
      free_income_planned: n(r.rendaLivrePlanejada),
      free_income_pro_rata: n(r.rendaLivreProporcional),
      free_income_used: n(r.rendaLivreUsada),
      savings_planned: n(r.economiaPlanejada),
      savings_pro_rata: n(r.economiaProporcional),
      savings_realized: n(r.economiaRealizada),
      pending_count: r.pendencias,
      complete: r.completo,
      closed_at: new Date().toISOString(),
      reopened_at: null,
    };
  }

  function cicloAnterior(referenciaData = new Date()) {
    const d = new Date(referenciaData.getFullYear(), referenciaData.getMonth() - 1, 1);
    return O.cicloDe(d);
  }

  return { referencia, proporcional, resumo, paraRegistro, cicloAnterior };
})();
