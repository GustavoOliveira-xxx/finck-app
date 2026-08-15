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

    const sobraAposFixos = renda - despesasFixas;
    const rendaLivre = Math.max(0, sobraAposFixos);
    const semFolga = renda > 0 && sobraAposFixos <= 0;
    const percentualRendaLivre = rendaLivre > 0 ? (preco / rendaLivre) * 100 : 0;

    // Compromissos futuros são parcelas em aberto e previsões ainda não pagas.
    // Saldo atual menos compromissos é o disponível projetado — nome diferente
    // porque é conceito diferente.
    const compromissos = Number(ctx.compromissosAbertos) || 0;
    const disponivelProjetado = saldo - compromissos;
    const disponivelDepois = disponivelProjetado - preco;

    const impacto_metas = impactoMetas(preco, ctx.metas || [], valorDia);

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
      compromissos_futuros: compromissos,
      disponivel_projetado: disponivelProjetado,
      disponivel_depois: disponivelDepois,
      compromete_projetado: disponivelDepois < 0,
      renda_livre: rendaLivre,
      sobra_apos_fixos: sobraAposFixos,
      deficit_fixos: Math.max(0, -sobraAposFixos),
      sem_folga: semFolga,
      percentual_renda_livre: percentualRendaLivre,
      impacto_metas,
      semaforo: semaforo({
        incomePercent: income_percent,
        saldoDepois,
        disponivelDepois,
        compromissos,
        percentualRendaLivre,
        semFolga,
        deficitFixos: Math.max(0, -sobraAposFixos),
        rendaLivre,
        preco,
        impactoMetas: impacto_metas,
      }),
      alternativas: alternativas(preco),
    };
  }

  function impactoMetas(preco, metas, valorDia) {
    return metas.map((m) => {
      const alvo = Number(m.target_amount) || 0;
      const atual = Number(m.current_amount) || 0;
      const falta = Math.max(0, alvo - atual);
      const percentualDaMeta = alvo > 0 ? (preco / alvo) * 100 : 0;
      const percentualDoRestante = falta > 0 ? (preco / falta) * 100 : 0;
      const diasAtraso = valorDia > 0 ? preco / valorDia : 0;
      return {
        id: m.id,
        nome: m.name,
        falta,
        percentual_da_meta: percentualDaMeta,

        percentual_do_restante: percentualDoRestante,
        dias_trabalho_extra: diasAtraso,
        cobre_a_meta: preco >= falta && falta > 0,
      };
    });
  }

  // O semáforo é orientação, não diagnóstico. Ele avalia as condições na ordem
  // de gravidade definida no relatório de conclusão e devolve a PRIMEIRA que
  // se aplica, dizendo qual é — em vez de misturar causas diferentes sob um
  // mesmo rótulo. A ordem existe para impedir a falsa segurança de um verde
  // baseado só em percentual quando a renda já está toda comprometida.
  //
  //   1. déficit de despesas fixas
  //   2. saldo projetado negativo
  //   3. comprometimento excessivo da renda livre
  //   4. percentual da renda
  //   5. impacto nas metas
  const MOTIVOS = [
    "deficit_fixos", "sem_caixa", "sem_projetado",
    "renda_livre", "percentual_renda", "impacto_meta", "folga",
  ];

  function semaforo({
    incomePercent = 0,
    saldoDepois = 0,
    disponivelDepois = 0,
    compromissos = 0,
    percentualRendaLivre = 0,
    semFolga = false,
    deficitFixos = 0,
    rendaLivre = 0,
    preco = 0,
    impactoMetas = [],
  } = {}) {
    const U = window.FinckUtils;
    const dinheiro = (v) => (U ? U.moeda(v) : `R$ ${Number(v || 0).toFixed(2)}`);

    // 1. Déficit de despesas fixas — a renda recorrente já acabou.
    if (semFolga) {
      return {
        nivel: "alerta",
        motivo: "deficit_fixos",
        titulo: saldoDepois < 0 ? "Aumenta o déficit e zera o caixa" : "Cabe no caixa atual, mas não na renda recorrente",
        texto: saldoDepois < 0
          ? `Suas despesas fixas superam a renda em ${dinheiro(deficitFixos)} por mês e esta compra ainda deixaria o saldo negativo. Aqui não é questão de tamanho da compra — não há de onde tirar.`
          : `Suas despesas fixas já consomem toda a renda do mês (déficit de ${dinheiro(deficitFixos)}). Esta compra sairia do caixa acumulado, não do que entra agora: ela reduz reserva em vez de usar sobra.`,
      };
    }

    // 2. Saldo projetado negativo — o caixa não cobre, ou não cobre depois dos
    //    compromissos já assumidos.
    if (saldoDepois < 0) {
      return {
        nivel: "alerta",
        motivo: "sem_caixa",
        titulo: "Não cabe no caixa atual",
        texto: `Depois desta compra o saldo ficaria em ${dinheiro(saldoDepois)}. O dinheiro para pagá-la ainda não entrou.`,
      };
    }

    if (compromissos > 0 && disponivelDepois < 0) {
      return {
        nivel: "alerta",
        motivo: "sem_projetado",
        titulo: "Esta compra aumenta o déficit projetado",
        texto: `Cabe no saldo de hoje, mas você já tem ${dinheiro(compromissos)} em parcelas e previsões em aberto. Descontando esses compromissos, o disponível projetado fica em ${dinheiro(disponivelDepois)}.`,
      };
    }

    // 3. Comprometimento excessivo da renda livre — a sobra depois dos fixos.
    if (percentualRendaLivre >= 60) {
      return {
        nivel: "alerta",
        motivo: "renda_livre",
        titulo: "Consome quase toda a sobra do mês",
        texto: `A compra ocupa ${Math.round(percentualRendaLivre)}% da sua sobra após os fixos (${dinheiro(rendaLivre)}). O que sobra precisa cobrir o resto do mês inteiro.`,
      };
    }

    // 4. Percentual da renda.
    if (incomePercent >= 30) {
      return {
        nivel: "alerta",
        motivo: "percentual_renda",
        titulo: "Peso alto na renda do mês",
        texto: `Equivale a ${Math.round(incomePercent)}% da sua renda mensal. Se ela for importante para você, esticar o prazo ou comparar alternativas costuma abrir espaço sem abrir mão do item.`,
      };
    }

    if (percentualRendaLivre >= 25) {
      return {
        nivel: "atencao",
        motivo: "renda_livre",
        titulo: "Ocupa parte relevante da sobra",
        texto: `A compra usa ${Math.round(percentualRendaLivre)}% da sua sobra após os fixos. Cabe, mas reduz a folga que você teria para o resto do mês.`,
      };
    }

    if (incomePercent >= 10) {
      return {
        nivel: "atencao",
        motivo: "percentual_renda",
        titulo: "Peso médio na renda do mês",
        texto: `Equivale a ${Math.round(incomePercent)}% da sua renda. Cabe no orçamento e reduz parte da folga — vale olhar ao lado das suas metas para decidir com o quadro completo.`,
      };
    }

    // 5. Impacto nas metas — pequeno para a renda, grande para o que falta.
    const metaAfetada = (impactoMetas || [])
      .filter((m) => m.falta > 0 && m.percentual_do_restante >= 20)
      .sort((a, b) => b.percentual_do_restante - a.percentual_do_restante)[0];

    if (metaAfetada) {
      return {
        nivel: "atencao",
        motivo: "impacto_meta",
        titulo: "Pequena para a renda, grande para a meta",
        texto: `A compra é leve no mês, mas equivale a ${Math.round(metaAfetada.percentual_do_restante)}% do que ainda falta para "${metaAfetada.nome}" — cerca de ${Math.round(metaAfetada.dias_trabalho_extra)} dia(s) de trabalho a mais até lá.`,
      };
    }

    return {
      nivel: "verde",
      motivo: "folga",
      titulo: "Cabe com folga no mês",
      texto: "A compra ocupa uma fatia pequena da sua renda e não compromete o disponível projetado nem as metas. Se quiser, dá para comparar durabilidade e uso antes de fechar.",
    };
  }

  function alternativas(preco) {
    return [
      { id: "usado", titulo: "Comprar usado ou recondicionado", economia: preco * 0.4, hipotese: true, texto: "Estimativa ilustrativa: mercados de segunda mão costumam custar cerca de 40% menos. Confira o preço real antes de decidir." },
      { id: "reparar", titulo: "Reparar ou reaproveitar o que você já tem", economia: preco * 0.8, hipotese: true, texto: "Estimativa ilustrativa: o reparo costuma custar uma fração do item novo e prolonga a vida útil dele." },
      { id: "compartilhar", titulo: "Alugar, emprestar ou compartilhar", economia: preco * 0.7, hipotese: true, texto: "Estimativa ilustrativa para itens de uso pouco frequente. O custo do aluguel varia bastante." },
      { id: "adiar", titulo: "Adiar 30 dias e reavaliar", economia: 0, hipotese: false, texto: "A regra dos 30 dias ajuda a separar necessidade real de impulso." },
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

  // Glossário dos indicadores. Cada nome tem uma definição curta e, quando faz
  // diferença, a data de referência — para "saldo", "renda livre" e "disponível"
  // deixarem de ser sinônimos na cabeça de quem lê.
  const GLOSSARIO = {
    saldo_atual: {
      rotulo: "Saldo atual",
      definicao: "Caixa já realizado: saldo inicial mais o que entrou, menos o que saiu, até hoje.",
      referencia: "até hoje",
    },
    sobra_apos_fixos: {
      rotulo: "Sobra após fixos",
      definicao: "Renda mensal menos as recorrências fixas de saída. É o que sobra por mês, não o que você tem.",
      referencia: "por mês",
    },
    deficit_fixos: {
      rotulo: "Déficit de fixos",
      definicao: "Quanto as despesas fixas superam a renda mensal. Aparece quando a sobra ficaria negativa.",
      referencia: "por mês",
    },
    compromissos_futuros: {
      rotulo: "Compromissos futuros",
      definicao: "Saídas previstas e parcelas em aberto que ainda vão acontecer.",
      referencia: "daqui para frente",
    },
    disponivel_projetado: {
      rotulo: "Disponível projetado",
      definicao: "Saldo atual menos os compromissos futuros já assumidos.",
      referencia: "até o fim dos compromissos",
    },
    nao_alocado: {
      rotulo: "Não alocado",
      definicao: "Dinheiro que entra no saldo geral mas não está em nenhuma conta cadastrada.",
      referencia: "até hoje",
    },
    previsto: {
      rotulo: "Previsto",
      definicao: "O que a regra recorrente diz que deve acontecer no ciclo. Não move saldo.",
      referencia: "no ciclo",
    },
    realizado: {
      rotulo: "Realizado",
      definicao: "O que você confirmou que aconteceu de verdade. Move saldo.",
      referencia: "no ciclo",
    },
  };

  return { calcular, paraRegistro, resumoHistorico, alternativas, semaforo, GLOSSARIO, MOTIVOS };
})();
