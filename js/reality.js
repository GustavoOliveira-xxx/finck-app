window.FinckReality = (() => {
  const cfg = window.FINCK_CONFIG;

  function calcular(price, perfil, ctx = {}) {
    const preco = Number(price) || 0;
    const renda = Number(perfil?.income_monthly) || 0;
    const dias = Number(perfil?.work_days_month) || cfg.PADRAO.work_days_month;
    const horas = Number(perfil?.work_hours_day) || cfg.PADRAO.work_hours_day;

    const valorDia = renda > 0 ? renda / dias : 0;
    const valorHora = valorDia > 0 ? valorDia / horas : 0;

    const income_percent = renda > 0 ? (preco / renda) * 100 : 0;
    const work_days = valorDia > 0 ? preco / valorDia : 0;
    const work_hours = valorHora > 0 ? preco / valorHora : 0;

    const saldo = Number(ctx.saldo) || 0;
    const saldoDepois = saldo - preco;
    const despesasFixas = Number(ctx.despesasFixas) || 0;
    const rendaLivre = Math.max(0, renda - despesasFixas);
    const percentualRendaLivre = rendaLivre > 0 ? (preco / rendaLivre) * 100 : 0;

    return {
      price: preco,
      income_monthly: renda,
      valor_dia: valorDia,
      valor_hora: valorHora,
      income_percent,
      work_days,
      work_hours,
      saldo_antes: saldo,
      saldo_depois: saldoDepois,
      compromete_saldo: saldoDepois < 0,
      renda_livre: rendaLivre,
      percentual_renda_livre: percentualRendaLivre,
      impacto_metas: impactoMetas(preco, ctx.metas || [], valorDia),
      semaforo: semaforo(income_percent, saldoDepois, percentualRendaLivre),
      alternativas: alternativas(preco),
    };
  }

  function impactoMetas(preco, metas, valorDia) {
    return metas.map((m) => {
      const alvo = Number(m.target_amount) || 0;
      const atual = Number(m.current_amount) || 0;
      const falta = Math.max(0, alvo - atual);
      const percentualDaMeta = alvo > 0 ? (preco / alvo) * 100 : 0;
      const diasAtraso = valorDia > 0 ? preco / valorDia : 0;
      return {
        id: m.id,
        nome: m.name,
        falta,
        percentual_da_meta: percentualDaMeta,
        dias_trabalho_extra: diasAtraso,
        cobre_a_meta: preco >= falta && falta > 0,
      };
    });
  }

  function semaforo(incomePercent, saldoDepois, percentualRendaLivre) {

    if (saldoDepois < 0 || incomePercent >= 30 || percentualRendaLivre >= 60) {
      return {
        nivel: "alerta",
        titulo: "Peso alto no mês",
        texto: "Nesta faixa a compra ocupa boa parte do que entra no mês. Se ela for importante para você, esticar o prazo ou comparar alternativas costuma abrir espaço sem abrir mão do item.",
      };
    }
    if (incomePercent >= 10 || percentualRendaLivre >= 25) {
      return {
        nivel: "atencao",
        titulo: "Peso médio no mês",
        texto: "A compra cabe no orçamento e reduz parte da folga do mês. Vale olhar ao lado das suas metas para decidir com o quadro completo.",
      };
    }
    return {
      nivel: "verde",
      titulo: "Peso baixo no mês",
      texto: "A compra ocupa uma fatia pequena da sua renda. Se quiser, dá para comparar durabilidade e uso antes de fechar.",
    };
  }

  function alternativas(preco) {
    return [
      { id: "usado", titulo: "Comprar usado ou recondicionado", economia: preco * 0.4, texto: "Mercados de segunda mão costumam custar cerca de 40% menos e evitam a produção de um novo item." },
      { id: "reparar", titulo: "Reparar ou reaproveitar o que você já tem", economia: preco * 0.8, texto: "O reparo prolonga a vida útil do produto e evita descarte prematuro." },
      { id: "compartilhar", titulo: "Alugar, emprestar ou compartilhar", economia: preco * 0.7, texto: "Indicado para itens de uso pouco frequente." },
      { id: "adiar", titulo: "Adiar 30 dias e reavaliar", economia: 0, texto: "A regra dos 30 dias ajuda a separar necessidade real de impulso." },
    ];
  }

  function paraRegistro({ item_name, price, category, resultado, perfil, decision, reflections, note, item_link }) {
    return {
      item_name,
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
      analyzed_at: new Date().toISOString(),
    };
  }

  function resumoHistorico(analises) {
    const conscientes = new Set(cfg.DECISOES.filter((d) => d.consciente).map((d) => d.id));
    const decididas = analises.filter((a) => a.decision);
    const evitadas = decididas.filter((a) => conscientes.has(a.decision));
    const economia = evitadas.reduce((s, a) => s + Number(a.price || 0), 0);
    const horas = evitadas.reduce((s, a) => s + Number(a.work_hours || 0), 0);
    return {
      total: analises.length,
      decididas: decididas.length,
      compras: decididas.length - evitadas.length,
      evitadas: evitadas.length,
      economia,
      horas_preservadas: horas,
      taxa_consciente: decididas.length ? (evitadas.length / decididas.length) * 100 : 0,
    };
  }

  return { calcular, paraRegistro, resumoHistorico, alternativas };
})();
