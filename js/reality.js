window.FinckReality = (() => {
  const cfg = window.FINCK_CONFIG;
  // PROD-006 — preço sozinho não separa o barato descartável do caro durável.
  // Quantidade e vida útil são opcionais; quando informadas, viram custo por mês
  // de uso, que é o número que muda a conversa sobre consumo.
  function custoDeUso(preco, {quantidade: quantidade = null, mesesDeUso: mesesDeUso = null} = {}) {
    const qtd = Number(quantidade) > 0 ? Math.floor(Number(quantidade)) : null;
    const meses = Number(mesesDeUso) > 0 ? Number(mesesDeUso) : null;
    const total = qtd ? preco * qtd : preco;
    return {
      quantidade: qtd,
      meses_de_uso: meses,
      total: total,
      por_mes: meses ? total / meses : null,
      por_unidade: qtd ? preco : null,
      informado: Boolean(qtd || meses)
    };
  }
  function calcular(price, perfil, ctx = {}) {
    const preco = Number(price) || 0;
    const renda = Number(perfil?.income_monthly) || 0;
    const dias = Number(perfil?.work_days_month) || cfg.PADRAO.work_days_month;
    const horas = Number(perfil?.work_hours_day) || cfg.PADRAO.work_hours_day;
    const valorDia = renda > 0 ? renda / dias : 0;
    const valorHora = valorDia > 0 ? valorDia / horas : 0;
    const income_percent = renda > 0 ? preco / renda * 100 : 0;
    const work_days = valorDia > 0 ? preco / valorDia : 0;
    const work_hours = valorHora > 0 ? preco / valorHora : 0;
    const saldo = Number(ctx.saldo) || 0;
    const saldoDepois = saldo - preco;
    const despesasFixas = Number(ctx.despesasFixas) || 0;
    const sobraAposFixos = renda - despesasFixas;
    const rendaLivre = Math.max(0, sobraAposFixos);
    const semFolga = renda > 0 && sobraAposFixos <= 0;
    const percentualRendaLivre = rendaLivre > 0 ? preco / rendaLivre * 100 : 0;
    const compromissos = Number(ctx.compromissosAbertos) || 0;
    const disponivelProjetado = saldo - compromissos;
    const disponivelDepois = disponivelProjetado - preco;
    const impacto_metas = impactoMetas(preco, ctx.metas || [], valorDia);
    return {
      price: preco,
      income_monthly: renda,
      valor_dia: valorDia,
      valor_hora: valorHora,
      income_percent: income_percent,
      work_days: work_days,
      work_hours: work_hours,
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
      impacto_metas: impacto_metas,
      custo_de_uso: custoDeUso(preco, ctx),
      semaforo: semaforo({
        incomePercent: income_percent,
        saldoDepois: saldoDepois,
        disponivelDepois: disponivelDepois,
        compromissos: compromissos,
        percentualRendaLivre: percentualRendaLivre,
        semFolga: semFolga,
        deficitFixos: Math.max(0, -sobraAposFixos),
        rendaLivre: rendaLivre,
        preco: preco,
        impactoMetas: impacto_metas
      }),
      alternativas: alternativas(preco)
    };
  }
  function impactoMetas(preco, metas, valorDia) {
    return metas.map(m => {
      const alvo = Number(m.target_amount) || 0;
      const atual = Number(m.current_amount) || 0;
      const falta = Math.max(0, alvo - atual);
      const percentualDaMeta = alvo > 0 ? preco / alvo * 100 : 0;
      const percentualDoRestante = falta > 0 ? preco / falta * 100 : 0;
      const diasAtraso = valorDia > 0 ? preco / valorDia : 0;
      return {
        id: m.id,
        nome: m.name,
        falta: falta,
        percentual_da_meta: percentualDaMeta,
        percentual_do_restante: percentualDoRestante,
        dias_trabalho_extra: diasAtraso,
        cobre_a_meta: preco >= falta && falta > 0
      };
    });
  }
  const MOTIVOS = [ "deficit_fixos", "sem_caixa", "sem_projetado", "renda_livre", "percentual_renda", "impacto_meta", "folga" ];
  function semaforo({incomePercent: incomePercent = 0, saldoDepois: saldoDepois = 0, disponivelDepois: disponivelDepois = 0, compromissos: compromissos = 0, percentualRendaLivre: percentualRendaLivre = 0, semFolga: semFolga = false, deficitFixos: deficitFixos = 0, rendaLivre: rendaLivre = 0, preco: preco = 0, impactoMetas: impactoMetas = []} = {}) {
    const U = window.FinckUtils;
    const dinheiro = v => U ? U.moeda(v) : `R$ ${Number(v || 0).toFixed(2)}`;
    if (semFolga) {
      return {
        nivel: "alerta",
        motivo: "deficit_fixos",
        titulo: saldoDepois < 0 ? "Aumenta o déficit e zera o caixa" : "Cabe no caixa atual, mas não na renda recorrente",
        texto: saldoDepois < 0 ? `Suas despesas fixas superam a renda em ${dinheiro(deficitFixos)} por mês e esta compra ainda deixaria o saldo negativo. Aqui não é questão de tamanho da compra — não há de onde tirar.` : `Suas despesas fixas já consomem toda a renda do mês (déficit de ${dinheiro(deficitFixos)}). Esta compra sairia do caixa acumulado, não do que entra agora: ela reduz reserva em vez de usar sobra.`
      };
    }
    if (saldoDepois < 0) {
      return {
        nivel: "alerta",
        motivo: "sem_caixa",
        titulo: "Não cabe no caixa atual",
        texto: `Depois desta compra o saldo ficaria em ${dinheiro(saldoDepois)}. O dinheiro para pagá-la ainda não entrou.`
      };
    }
    if (compromissos > 0 && disponivelDepois < 0) {
      return {
        nivel: "alerta",
        motivo: "sem_projetado",
        titulo: "Esta compra aumenta o déficit projetado",
        texto: `Cabe no saldo de hoje, mas você já tem ${dinheiro(compromissos)} em parcelas e previsões em aberto. Descontando esses compromissos, o disponível projetado fica em ${dinheiro(disponivelDepois)}.`
      };
    }
    if (percentualRendaLivre >= 60) {
      return {
        nivel: "alerta",
        motivo: "renda_livre",
        titulo: "Consome quase toda a sobra do mês",
        texto: `A compra ocupa ${Math.round(percentualRendaLivre)}% da sua sobra após os fixos (${dinheiro(rendaLivre)}). O que sobra precisa cobrir o resto do mês inteiro.`
      };
    }
    if (incomePercent >= 30) {
      return {
        nivel: "alerta",
        motivo: "percentual_renda",
        titulo: "Peso alto na renda do mês",
        texto: `Equivale a ${Math.round(incomePercent)}% da sua renda mensal. Se ela for importante para você, esticar o prazo ou comparar alternativas costuma abrir espaço sem abrir mão do item.`
      };
    }
    if (percentualRendaLivre >= 25) {
      return {
        nivel: "atencao",
        motivo: "renda_livre",
        titulo: "Ocupa parte relevante da sobra",
        texto: `A compra usa ${Math.round(percentualRendaLivre)}% da sua sobra após os fixos. Cabe, mas reduz a folga que você teria para o resto do mês.`
      };
    }
    if (incomePercent >= 10) {
      return {
        nivel: "atencao",
        motivo: "percentual_renda",
        titulo: "Peso médio na renda do mês",
        texto: `Equivale a ${Math.round(incomePercent)}% da sua renda. Cabe no orçamento e reduz parte da folga — vale olhar ao lado das suas metas para decidir com o quadro completo.`
      };
    }
    const metaAfetada = (impactoMetas || []).filter(m => m.falta > 0 && m.percentual_do_restante >= 20).sort((a, b) => b.percentual_do_restante - a.percentual_do_restante)[0];
    if (metaAfetada) {
      return {
        nivel: "atencao",
        motivo: "impacto_meta",
        titulo: "Pequena para a renda, grande para a meta",
        texto: `A compra é leve no mês, mas equivale a ${Math.round(metaAfetada.percentual_do_restante)}% do que ainda falta para "${metaAfetada.nome}" — cerca de ${Math.round(metaAfetada.dias_trabalho_extra)} dia(s) de trabalho a mais até lá.`
      };
    }
    return {
      nivel: "verde",
      motivo: "folga",
      titulo: "Cabe com folga no mês",
      texto: "A compra ocupa uma fatia pequena da sua renda e não compromete o disponível projetado nem as metas. Se quiser, dá para comparar durabilidade e uso antes de fechar."
    };
  }
  function alternativas(preco) {
    const H = cfg.HIPOTESES_ALTERNATIVAS;
    const daHipotese = id => {
      const h = H[id];
      return {
        id: id,
        titulo: h.rotulo,
        economia: preco * h.referencia,
        faixa: {
          min: preco * h.min,
          max: preco * h.max
        },
        percentual: h.referencia,
        hipotese: true,
        texto: h.texto
      };
    };
    return [ daHipotese("usado"), daHipotese("reparar"), daHipotese("compartilhar"), {
      id: "adiar",
      titulo: "Adiar 30 dias e reavaliar",
      economia: 0,
      faixa: null,
      hipotese: false,
      texto: "A regra dos 30 dias ajuda a separar necessidade real de impulso."
    } ];
  }
  const FAIXAS_RESPONSABILIDADE = [ {
    minimo: 70,
    nivel: "alta",
    rotulo: "Escolha bem fundamentada",
    texto: "Pelas suas respostas, esta compra tende a ser necessária, usada e duradoura."
  }, {
    minimo: 40,
    nivel: "media",
    rotulo: "Vale reconsiderar alguns pontos",
    texto: "Suas respostas apontam pelo menos um ponto fraco antes de concluir a compra."
  }, {
    minimo: 0,
    nivel: "baixa",
    rotulo: "Sinais de consumo por impulso",
    texto: "Suas respostas indicam pouca necessidade, pouco uso ou vida útil curta."
  } ];
  const LIMITE_RESPONSABILIDADE = "Este indicador resume apenas o que você declarou nas seis perguntas. Ele não mede impacto ambiental real — o FinCK não calcula CO₂, água ou resíduo.";
  function indicadorResponsavel(reflexoes = {}) {
    const pesos = cfg.PESOS_RESPONSABILIDADE;
    const criterios = cfg.REFLEXOES.map(q => {
      const resposta = (reflexoes || {})[q.id] || null;
      const tabela = pesos[q.id] || {};
      const ponto = resposta !== null && Object.prototype.hasOwnProperty.call(tabela, resposta) ? tabela[resposta] : null;
      return {
        id: q.id,
        dimensao: q.dimensao,
        resposta: resposta,
        pontos: ponto,
        maximo: 2,
        respondida: ponto !== null
      };
    });
    const respondidas = criterios.filter(c => c.respondida);
    const soma = respondidas.reduce((s, c) => s + c.pontos, 0);
    const maximo = respondidas.length * 2;
    const pontuacao = maximo > 0 ? Math.round(soma / maximo * 100) : null;
    const faixa = pontuacao === null ? null : FAIXAS_RESPONSABILIDADE.find(f => pontuacao >= f.minimo);
    const alertas = respondidas.filter(c => c.pontos === 0).map(c => ({
      id: c.id,
      dimensao: c.dimensao,
      texto: cfg.ALERTAS_RESPONSABILIDADE[c.id]
    }));
    return {
      pontuacao: pontuacao,
      nivel: faixa ? faixa.nivel : null,
      rotulo: faixa ? faixa.rotulo : "Sem respostas suficientes",
      sintese: faixa ? faixa.texto : "Responda as perguntas de reflexão para ver a síntese da escolha.",
      criterios: criterios,
      respondidas: respondidas.length,
      total: criterios.length,
      alertas: alertas,
      limitacao: LIMITE_RESPONSABILIDADE
    };
  }
  function paraRegistro({item_name: item_name, price: price, category: category, resultado: resultado, perfil: perfil, decision: decision, reflections: reflections, note: note, item_link: item_link, quantity: quantity, expected_months: expected_months, end_of_life: end_of_life}) {
    const indicador = indicadorResponsavel(reflections);
    return {
      item_name: item_name,
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
      quantity: Number(quantity) > 0 ? Math.floor(Number(quantity)) : null,
      expected_months: Number(expected_months) > 0 ? Math.floor(Number(expected_months)) : null,
      end_of_life: end_of_life || null,
      responsibility_score: indicador.pontuacao,
      responsibility_label: indicador.nivel,
      analyzed_at: (new Date).toISOString()
    };
  }
  function resumoHistorico(analises) {
    const lista = analises || [];
    const conscientes = new Set(cfg.DECISOES.filter(d => d.consciente).map(d => d.id));
    const confirmam = new Set(cfg.ACOMPANHAMENTO.filter(a => a.confirma).map(a => a.id));
    const decididas = lista.filter(a => a.decision);
    const evitadas = decididas.filter(a => conscientes.has(a.decision));
    const potencial = evitadas.reduce((s, a) => s + Number(a.price || 0), 0);
    const horas = evitadas.reduce((s, a) => s + Number(a.work_hours || 0), 0);
    const acompanhadas = evitadas.filter(a => a.outcome);
    const confirmadas = acompanhadas.filter(a => confirmam.has(a.outcome));
    const somaIndicador = lista.filter(a => Number.isFinite(Number(a.responsibility_score)));
    return {
      total: lista.length,
      decididas: decididas.length,
      compras: decididas.length - evitadas.length,
      evitadas: evitadas.length,
      valor_potencial: potencial,
      economia_confirmada: confirmadas.reduce((s, a) => s + Number(a.price || 0), 0),
      acompanhadas: acompanhadas.length,
      confirmadas: confirmadas.length,
      a_acompanhar: evitadas.length - acompanhadas.length,
      horas_preservadas: horas,
      indicador_medio: somaIndicador.length ? Math.round(somaIndicador.reduce((s, a) => s + Number(a.responsibility_score), 0) / somaIndicador.length) : null,
      taxa_consciente: decididas.length ? evitadas.length / decididas.length * 100 : 0
    };
  }
  function paraAcompanhar(analises, {dias: dias = 30, hoje: hoje = new Date} = {}) {
    const conscientes = new Set(cfg.DECISOES.filter(d => d.consciente).map(d => d.id));
    const limite = new Date(hoje.getTime() - dias * 864e5);
    return (analises || []).filter(a => a.decision && conscientes.has(a.decision) && !a.outcome).filter(a => new Date(a.analyzed_at || a.created_at || 0) <= limite);
  }
  const GLOSSARIO = {
    saldo_atual: {
      rotulo: "Saldo atual",
      definicao: "Caixa já realizado: saldo inicial mais o que entrou, menos o que saiu, até hoje.",
      referencia: "até hoje"
    },
    sobra_apos_fixos: {
      rotulo: "Sobra após fixos",
      definicao: "Renda mensal menos as recorrências fixas de saída. É o que sobra por mês, não o que você tem.",
      referencia: "por mês"
    },
    deficit_fixos: {
      rotulo: "Déficit de fixos",
      definicao: "Quanto as despesas fixas superam a renda mensal. Aparece quando a sobra ficaria negativa.",
      referencia: "por mês"
    },
    compromissos_futuros: {
      rotulo: "Compromissos futuros",
      definicao: "Saídas previstas e parcelas em aberto que ainda vão acontecer.",
      referencia: "daqui para frente"
    },
    disponivel_projetado: {
      rotulo: "Disponível projetado",
      definicao: "Saldo atual menos os compromissos futuros já assumidos.",
      referencia: "até o fim dos compromissos"
    },
    nao_alocado: {
      rotulo: "Não alocado",
      definicao: "Dinheiro que entra no saldo geral mas não está em nenhuma conta cadastrada.",
      referencia: "até hoje"
    },
    previsto: {
      rotulo: "Previsto",
      definicao: "O que a regra recorrente diz que deve acontecer no ciclo. Não move saldo.",
      referencia: "no ciclo"
    },
    realizado: {
      rotulo: "Realizado",
      definicao: "O que você confirmou que aconteceu de verdade. Move saldo.",
      referencia: "no ciclo"
    },
    analises_registradas: {
      rotulo: "Análises registradas",
      definicao: "Quantas compras você passou pelo FinCK of Reality antes de decidir.",
      referencia: "no período"
    },
    decisoes_conscientes: {
      rotulo: "Decisões conscientes",
      definicao: "Análises em que você escolheu adiar, buscar alternativa, comprar usado, reparar ou desistir. É a decisão registrada, não a prova de que ela se manteve.",
      referencia: "no período"
    },
    valor_potencial: {
      rotulo: "Valor potencial preservado",
      definicao: "Soma do preço das compras com decisão consciente. É o valor que deixou de sair naquele momento — você pode comprar depois, pagar outro preço ou gastar em um substituto.",
      referencia: "no período"
    },
    economia_confirmada: {
      rotulo: "Economia confirmada",
      definicao: "Parte do valor potencial em que você, no acompanhamento, disse que manteve a decisão ou resolveu com reparo/reuso.",
      referencia: "após o acompanhamento"
    },
    horas_equivalentes: {
      rotulo: "Horas de trabalho equivalentes",
      definicao: "Quanto tempo de trabalho o valor potencial representa, pela sua renda e jornada declaradas.",
      referencia: "no período"
    },
    indicador_responsavel: {
      rotulo: "Indicador de decisão responsável",
      definicao: "Resumo de 0 a 100 das suas respostas às seis perguntas de reflexão. Critérios e pesos são visíveis. Não mede impacto ambiental real.",
      referencia: "por análise"
    },
    resultado_ambiental: {
      rotulo: "Resultado ambiental",
      definicao: "Não medido pelo FinCK. O app registra decisões e reflexões; não calcula CO₂, água, resíduo nem prova que um produto deixou de ser fabricado.",
      referencia: "fora do escopo"
    }
  };
  return {
    calcular: calcular,
    paraRegistro: paraRegistro,
    resumoHistorico: resumoHistorico,
    custoDeUso: custoDeUso,
    paraAcompanhar: paraAcompanhar,
    indicadorResponsavel: indicadorResponsavel,
    FAIXAS_RESPONSABILIDADE: FAIXAS_RESPONSABILIDADE,
    LIMITE_RESPONSABILIDADE: LIMITE_RESPONSABILIDADE,
    alternativas: alternativas,
    semaforo: semaforo,
    GLOSSARIO: GLOSSARIO,
    MOTIVOS: MOTIVOS
  };
})();
