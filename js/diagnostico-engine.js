// Assistente FinCK: diagnóstico da vida financeira inteira.
//
// O FinCK of Reality olha uma compra de cada vez. Este motor olha o conjunto:
// renda, despesas fixas, gastos do dia a dia, parcelas, reserva, metas e as
// decisões de consumo já registradas. Ele é determinístico e roda no próprio
// aparelho: os números saem daqui, sempre com a regra que os produziu.
//
// A IA (api/buscar-preco-ia.js, pedido { planejamento }) recebe só o retrato
// agregado que paraIA() monta, sem descrição de lançamento nem dado pessoal, e
// devolve linguagem: explicação, plano e respostas. Ela interpreta números,
// não os calcula. Quando a IA não está disponível (demonstração, servidor sem
// chave, sem internet), planoLocal() monta o plano só com as regras daqui.
window.FinckDiagnostico = (() => {
  const cfg = window.FINCK_CONFIG;
  const P = () => cfg.DIAGNOSTICO;
  const num = v => Number(v || 0);
  const arred = (v, casas = 2) => Math.round(num(v) * 10 ** casas) / 10 ** casas;
  const limitar = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
  const moeda = v => window.FinckUtils ? window.FinckUtils.moeda(v) : `R$ ${num(v).toFixed(2)}`;
  const pct = (v, casas = 0) => `${num(v).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  })}%`;
  const chaveMes = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const ehEntrada = t => t.type === "entrada";
  // Saída ligada a uma meta é dinheiro guardado, não consumo.
  const ehAporte = t => t.type === "saida" && Boolean(t.goal_id);
  const ehGasto = t => t.type === "saida" && !t.goal_id;
  const soma = lista => lista.reduce((s, t) => s + num(t.amount), 0);

  const NIVEIS = {
    saudavel: "Saudável",
    atencao: "Atenção",
    critico: "Crítico",
    sem_dados: "Sem dados suficientes"
  };
  const nivelPorNota = nota => nota >= 75 ? "saudavel" : nota >= 45 ? "atencao" : "critico";

  // Meses de referência: os últimos meses completos com movimento. Sem nenhum
  // mês completo registrado, vale o mês corrente, mesmo parcial.
  function janelaDeMeses(transacoes, hoje, quantos) {
    const comMovimento = new Set((transacoes || []).map(t => String(t.date || "").slice(0, 7)));
    const atual = chaveMes(hoje);
    const completos = [];
    for (let i = 1; i <= 12 && completos.length < quantos; i++) {
      const chave = chaveMes(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1));
      if (comMovimento.has(chave)) {
        completos.push(chave);
      }
    }
    if (completos.length) {
      return {
        meses: completos,
        parcial: false
      };
    }
    return {
      meses: comMovimento.has(atual) ? [ atual ] : [],
      parcial: true
    };
  }

  function fluxoMensal(transacoes, meses) {
    return meses.map(mes => {
      const doMes = transacoes.filter(t => String(t.date || "").slice(0, 7) === mes);
      return {
        mes: mes,
        entradas: soma(doMes.filter(ehEntrada)),
        gastos: soma(doMes.filter(ehGasto)),
        aportes: soma(doMes.filter(ehAporte))
      };
    });
  }

  function categorias(transacoes, meses, hoje) {
    if (!meses.length) {
      return [];
    }
    const naJanela = transacoes.filter(t => ehGasto(t) && meses.includes(String(t.date || "").slice(0, 7)));
    const total = soma(naJanela);
    const mapa = new Map;
    naJanela.forEach(t => {
      const c = t.category || "Outros";
      mapa.set(c, (mapa.get(c) || 0) + num(t.amount));
    });
    // Tendência: o mês mais recente da janela contra a média dos anteriores.
    const [recente, ...anteriores] = meses;
    const doMes = (mes, c) => soma(transacoes.filter(t => ehGasto(t) && (t.category || "Outros") === c && String(t.date || "").slice(0, 7) === mes));
    return [ ...mapa.entries() ].map(([nome, valor]) => {
      const mediaAnterior = anteriores.length ? anteriores.reduce((s, m) => s + doMes(m, nome), 0) / anteriores.length : null;
      const ultimo = doMes(recente, nome);
      return {
        nome: nome,
        media_mensal: valor / meses.length,
        participacao: total > 0 ? valor / total * 100 : 0,
        ultimo_mes: ultimo,
        tendencia_pct: mediaAnterior && mediaAnterior > 0 ? (ultimo - mediaAnterior) / mediaAnterior * 100 : null
      };
    }).sort((a, b) => b.media_mensal - a.media_mensal);
  }

  function parcelasMensais(parcelamentos) {
    return (parcelamentos || []).filter(p => p.active !== false && num(p.paid_count) < num(p.installments_count)).reduce((s, p) => s + num(p.installment_amount || num(p.total_amount) / Math.max(1, num(p.installments_count))), 0);
  }

  function situacaoDasMetas(metas, movimentos, hoje) {
    const M = window.FinckMetas;
    return (metas || []).map(m => {
      const alvo = num(m.target_amount);
      const atual = num(m.current_amount);
      const falta = Math.max(0, alvo - atual);
      const ritmo = M ? M.ritmoMensal(movimentos, m.id, {
        hoje: hoje
      }) : 0;
      const necessario = M ? M.necessarioPorMes(m, {
        hoje: hoje
      }) : null;
      const concluida = falta <= 0;
      const noRitmo = concluida || (necessario ? ritmo >= necessario * .9 : ritmo > 0);
      return {
        id: m.id,
        nome: m.name,
        alvo: alvo,
        atual: atual,
        falta: falta,
        progresso: alvo > 0 ? limitar(atual / alvo * 100) : 0,
        prazo: m.deadline || null,
        ritmo_mensal: ritmo,
        necessario_mensal: necessario,
        meses_para_concluir: ritmo > 0 && falta > 0 ? falta / ritmo : null,
        concluida: concluida,
        no_ritmo: noRitmo,
        parada: !concluida && ritmo <= 0
      };
    });
  }

  // ---------------------------------------------------------------- dimensões

  function dimensaoFluxo(r) {
    const p = P();
    if (!(r.renda > 0)) {
      return semDados("fluxo", "Fluxo do mês", "Informe a sua renda mensal no Perfil para o FinCK medir quanto dela já está comprometido.");
    }
    const fixos = r.despesas_fixas / r.renda * 100;
    // 50% ou menos vale 100; cai até zero quando os fixos passam de 90%.
    const nota = limitar(100 - Math.max(0, fixos - p.FIXOS_REFERENCIA_PCT) * 2.5);
    return {
      id: "fluxo",
      nome: "Fluxo do mês",
      nota: Math.round(nota),
      nivel: r.sem_folga ? "critico" : nivelPorNota(nota),
      valor: fixos,
      valor_texto: `${pct(fixos)} da renda em despesas fixas`,
      referencia: `até ${p.FIXOS_REFERENCIA_PCT}% (regra 50/30/20)`,
      explicacao: r.sem_folga ? `As despesas fixas (${moeda(r.despesas_fixas)}) já passam da renda (${moeda(r.renda)}). Todo gasto variável sai da reserva.` : `Das ${moeda(r.renda)} de renda, ${moeda(r.despesas_fixas)} já têm destino todo mês. Sobram ${moeda(r.sobra_mensal)} para o resto.`
    };
  }

  function dimensaoPoupanca(r) {
    const p = P();
    if (!(r.base_renda > 0) || !r.meses_considerados) {
      return semDados("poupanca", "Capacidade de poupança", "Registre entradas e saídas por pelo menos um mês para o FinCK medir quanto sobra de verdade.");
    }
    const nota = limitar(r.taxa_poupanca / p.POUPANCA_IDEAL_PCT * 100);
    return {
      id: "poupanca",
      nome: "Capacidade de poupança",
      nota: Math.round(nota),
      nivel: r.taxa_poupanca < 0 ? "critico" : r.taxa_poupanca < p.POUPANCA_MINIMA_PCT ? "atencao" : nivelPorNota(nota),
      valor: r.taxa_poupanca,
      valor_texto: `${pct(r.taxa_poupanca)} da renda sobra por mês`,
      referencia: `${p.POUPANCA_MINIMA_PCT}% a ${p.POUPANCA_IDEAL_PCT}% (regra 50/30/20)`,
      parcial: r.mes_parcial,
      explicacao: (r.mes_parcial ? "Mês ainda em andamento, então a conta é parcial e é refeita quando o mês fechar. " : "") + (r.taxa_poupanca < 0 ? `Na média de ${r.meses_considerados} ${r.meses_considerados === 1 ? "mês" : "meses"}, os gastos (${moeda(r.media_gastos)}) passaram do que entrou (${moeda(r.base_renda)}).` : `Na média de ${r.meses_considerados} ${r.meses_considerados === 1 ? "mês" : "meses"}, entram ${moeda(r.base_renda)} e saem ${moeda(r.media_gastos)} em gastos: sobram cerca de ${moeda(r.base_renda - r.media_gastos)}.`)
    };
  }

  function dimensaoReserva(r) {
    const p = P();
    if (!(r.custo_mensal > 0)) {
      return semDados("reserva", "Reserva de emergência", "Cadastre as despesas fixas em Recorrentes para o FinCK saber quantos meses a sua reserva cobre.");
    }
    const nota = limitar(r.reserva_meses / p.RESERVA_IDEAL_MESES * 100);
    return {
      id: "reserva",
      nome: "Reserva de emergência",
      nota: Math.round(nota),
      nivel: r.reserva_meses >= p.RESERVA_IDEAL_MESES ? "saudavel" : r.reserva_meses >= p.RESERVA_MINIMA_MESES ? "atencao" : "critico",
      valor: r.reserva_meses,
      valor_texto: `${r.reserva_meses.toLocaleString("pt-BR", {
        maximumFractionDigits: 1
      })} ${arred(r.reserva_meses, 1) === 1 ? "mês" : "meses"} de custo fixo`,
      referencia: `${p.RESERVA_MINIMA_MESES} a ${p.RESERVA_IDEAL_MESES} meses`,
      explicacao: `Saldo e metas de reserva somam ${moeda(r.reserva)}; o custo fixo do mês é ${moeda(r.custo_mensal)}. Se a renda parasse hoje, isso duraria cerca de ${r.reserva_meses.toLocaleString("pt-BR", {
        maximumFractionDigits: 1
      })} ${arred(r.reserva_meses, 1) === 1 ? "mês" : "meses"}.`
    };
  }

  function dimensaoCompromissos(r) {
    const p = P();
    if (!(r.renda > 0)) {
      return semDados("compromissos", "Parcelas e compromissos", "Sem renda informada não dá para medir o peso das parcelas.");
    }
    const peso = r.parcelas_mensais / r.renda * 100;
    let nota = limitar(100 - peso / p.PARCELAS_LIMITE_PCT * 60);
    if (r.disponivel_projetado < 0) {
      nota = Math.min(nota, 30);
    }
    return {
      id: "compromissos",
      nome: "Parcelas e compromissos",
      nota: Math.round(nota),
      nivel: r.disponivel_projetado < 0 || peso > p.PARCELAS_LIMITE_PCT ? "critico" : peso > p.PARCELAS_ATENCAO_PCT ? "atencao" : "saudavel",
      valor: peso,
      valor_texto: r.parcelas_mensais > 0 ? `${pct(peso)} da renda em parcelas` : "nenhuma parcela em aberto",
      referencia: `até ${p.PARCELAS_ATENCAO_PCT}% confortável, acima de ${p.PARCELAS_LIMITE_PCT}% pesado`,
      explicacao: r.disponivel_projetado < 0 ? `Parcelas e previsões em aberto (${moeda(r.compromissos_abertos)}) passam do saldo atual em ${moeda(Math.abs(r.disponivel_projetado))}.` : r.parcelas_mensais > 0 ? `${moeda(r.parcelas_mensais)} por mês já estão presos em parcelas, com ${moeda(r.compromissos_abertos)} ainda a pagar.` : "Você não tem compras parceladas em aberto: a renda futura está livre de dívidas registradas."
    };
  }

  function dimensaoMetas(r) {
    const abertas = r.metas.filter(m => !m.concluida);
    if (!r.metas.length) {
      return semDados("metas", "Metas", "Você ainda não tem metas. Uma meta dá direção ao que sobra no mês.");
    }
    if (!abertas.length) {
      return {
        id: "metas",
        nome: "Metas",
        nota: 100,
        nivel: "saudavel",
        valor: 100,
        valor_texto: "todas as metas alcançadas",
        referencia: "metas no ritmo do prazo",
        explicacao: "Todas as metas cadastradas foram alcançadas. Uma nova meta mantém o hábito de guardar."
      };
    }
    const noRitmo = abertas.filter(m => m.no_ritmo).length;
    const nota = noRitmo / abertas.length * 100;
    const paradas = abertas.filter(m => m.parada);
    return {
      id: "metas",
      nome: "Metas",
      nota: Math.round(nota),
      nivel: nivelPorNota(nota),
      valor: nota,
      valor_texto: `${noRitmo} de ${abertas.length} ${abertas.length === 1 ? "meta" : "metas"} no ritmo`,
      referencia: "aporte mensal suficiente para o prazo",
      explicacao: paradas.length ? `${paradas.length === 1 ? `"${paradas[0].nome}" não recebeu aporte` : `${paradas.length} metas não receberam aporte`} nos últimos 3 meses.` : `${noRitmo} de ${abertas.length} metas estão recebendo aportes no ritmo que o prazo pede.`
    };
  }

  function dimensaoConsumo(r) {
    const c = r.consumo;
    if (!c.analises) {
      return semDados("consumo", "Consumo consciente", "Analise a próxima compra no FinCK of Reality: é assim que o FinCK aprende como você decide.");
    }
    const taxa = c.decididas ? c.taxa_consciente : 0;
    const nota = c.indicador_medio === null ? taxa : (taxa + c.indicador_medio) / 2;
    return {
      id: "consumo",
      nome: "Consumo consciente",
      nota: Math.round(nota),
      nivel: nivelPorNota(nota),
      valor: taxa,
      valor_texto: c.decididas ? `${pct(taxa)} das decisões foram conscientes` : `${c.analises} ${c.analises === 1 ? "análise" : "análises"} sem decisão`,
      referencia: "decidir depois de analisar",
      explicacao: c.decididas ? `Em ${c.conscientes} de ${c.decididas} compras analisadas você esperou, buscou alternativa ou não comprou.${c.indicador_medio !== null ? ` Indicador médio de decisão responsável: ${c.indicador_medio}/100.` : ""}` : "Você analisou compras, mas ainda não registrou a decisão de nenhuma."
    };
  }

  function semDados(id, nome, explicacao) {
    return {
      id: id,
      nome: nome,
      nota: null,
      nivel: "sem_dados",
      valor: null,
      valor_texto: "sem dados suficientes",
      referencia: "",
      explicacao: explicacao
    };
  }

  // ------------------------------------------------------------- prioridades

  // Cada prioridade diz o que fazer, por quê (com o número que a disparou) e
  // onde fazer no app. A ordem segue a gravidade: primeiro o que ameaça o
  // mês, depois o que constrói segurança, por fim os hábitos.
  function prioridades(r, dims) {
    const p = P();
    const d = Object.fromEntries(dims.map(x => [ x.id, x ]));
    const lista = [];
    const add = (nivel, titulo, porque, acao, href, dimensao) => lista.push({
      nivel: nivel,
      titulo: titulo,
      porque: porque,
      acao: acao,
      href: href,
      dimensao: dimensao
    });
    if (!(r.renda > 0)) {
      add("critico", "Informar a sua renda mensal", "Sem ela, o FinCK não converte compras em tempo de trabalho nem mede o peso dos gastos.", "Ir para o Perfil", "perfil.html", "fluxo");
    }
    if (d.fluxo.nivel === "critico") {
      add("critico", "Reduzir as despesas fixas", d.fluxo.explicacao, "Revisar recorrentes", "recorrentes.html", "fluxo");
    }
    if (d.compromissos.nivel === "critico") {
      add("critico", "Não assumir novas parcelas por enquanto", d.compromissos.explicacao, "Ver compromissos", "planejamento.html", "compromissos");
    }
    if (d.poupanca.nivel === "critico") {
      add("critico", "Fechar o mês sem gastar mais do que entra", d.poupanca.explicacao, "Ver para onde vai o dinheiro", "analises.html", "poupanca");
    }
    if (d.reserva.nivel === "critico" || d.reserva.nivel === "atencao") {
      const alvo = r.custo_mensal * p.RESERVA_MINIMA_MESES;
      const temMetaReserva = r.metas.some(m => /reserva|emerg/i.test(m.nome || ""));
      add(d.reserva.nivel, temMetaReserva ? "Reforçar a reserva de emergência" : "Começar uma reserva de emergência", `${d.reserva.explicacao} O primeiro degrau é ${moeda(alvo)} (${p.RESERVA_MINIMA_MESES} meses de custo fixo).`, temMetaReserva ? "Ver minhas metas" : "Criar a meta de reserva", temMetaReserva ? "metas.html" : "metas.html#nova", "reserva");
    }
    const emAlta = r.categorias.find(c => c.tendencia_pct !== null && c.tendencia_pct >= p.TENDENCIA_ALTA_PCT && c.participacao >= 10);
    if (emAlta) {
      add("atencao", `Olhar os gastos com ${emAlta.nome}`, `No último mês eles foram ${moeda(emAlta.ultimo_mes)}, ${pct(emAlta.tendencia_pct)} acima da média dos meses anteriores.`, "Ver análise dos gastos", "analises.html", "poupanca");
    }
    if (d.poupanca.nivel === "atencao") {
      add("atencao", "Guardar um valor fixo assim que o dinheiro entrar", `${d.poupanca.explicacao} Separar a poupança no dia do pagamento, antes dos gastos, costuma funcionar melhor do que guardar o que sobra.`, "Escolher uma meta", "metas.html", "poupanca");
    }
    const jaFalouDeReserva = lista.some(x => x.dimensao === "reserva");
    r.metas.filter(m => !m.concluida && !m.no_ritmo && !(jaFalouDeReserva && /reserva|emerg/i.test(m.nome || ""))).slice(0, 2).forEach(m => {
      add("atencao", `Ajustar o ritmo da meta "${m.nome}"`, m.necessario_mensal ? `O prazo pede ${moeda(m.necessario_mensal)} por mês e os aportes recentes estão em ${moeda(m.ritmo_mensal)}.` : "Ela não recebeu aportes nos últimos 3 meses.", "Ver a meta", "metas.html", "metas");
    });
    if (d.compromissos.nivel === "atencao") {
      add("atencao", "Esperar as parcelas atuais terminarem antes de parcelar de novo", d.compromissos.explicacao, "Ver parcelas", "planejamento.html", "compromissos");
    }
    if (d.fluxo.nivel === "atencao") {
      add("atencao", "Rever uma despesa fixa", `${d.fluxo.explicacao} Assinaturas e planos são os mais fáceis de renegociar.`, "Revisar recorrentes", "recorrentes.html", "fluxo");
    }
    if (d.metas.nivel === "sem_dados") {
      add("info", "Criar uma meta", "Com uma meta, o FinCK mostra quanto cada compra atrasa aquilo que importa para você.", "Criar meta", "metas.html#nova", "metas");
    }
    if (d.consumo.nivel === "sem_dados" || d.consumo.nivel === "critico") {
      add("info", "Analisar a próxima compra antes de comprar", d.consumo.nivel === "sem_dados" ? d.consumo.explicacao : `${d.consumo.explicacao} Usar o FinCK of Reality antes de comprar ajuda a separar necessidade de impulso.`, "Analisar uma compra", "reality.html", "consumo");
    }
    const peso = {
      critico: 0,
      atencao: 1,
      info: 2
    };
    return lista.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
  }

  function rotuloIndice(indice) {
    if (indice === null) {
      return "sem dados suficientes";
    }
    return indice >= 75 ? "equilibrada" : indice >= 50 ? "em ajuste" : "pedindo atenção";
  }

  // ------------------------------------------------------------- diagnóstico

  function diagnosticar(ctx, {hoje: hoje = new Date} = {}) {
    const p = P();
    const perfil = ctx.perfil || {};
    const renda = num(perfil.income_monthly);
    const realizadas = ctx.transacoesRealizadas || ctx.transacoes || [];
    const janela = janelaDeMeses(realizadas, hoje, p.JANELA_MESES);
    const fluxo = fluxoMensal(realizadas, janela.meses);
    const n = fluxo.length;
    const mediaEntradas = n ? fluxo.reduce((s, m) => s + m.entradas, 0) / n : 0;
    const mediaGastos = n ? fluxo.reduce((s, m) => s + m.gastos, 0) / n : 0;
    const mediaAportes = n ? fluxo.reduce((s, m) => s + m.aportes, 0) / n : 0;
    // Mês parcial subestima a renda; nesse caso vale a renda declarada.
    const baseRenda = janela.parcial ? Math.max(renda, mediaEntradas) : mediaEntradas || renda;
    const despesasFixas = num(ctx.despesasFixas);
    // No mês em andamento, parte das despesas fixas ainda não saiu: o gasto
    // considerado é pelo menos o valor das fixas.
    const gastosConsiderados = janela.parcial ? Math.max(mediaGastos, despesasFixas) : mediaGastos;
    const metas = situacaoDasMetas(ctx.metas, ctx.movimentosMeta, hoje);
    // Aporte pode entrar como lançamento ligado à meta ou direto no histórico
    // da meta; vale o maior dos dois retratos.
    const aportesNasMetas = metas.reduce((s, m) => s + m.ritmo_mensal, 0);
    const emReserva = metas.filter(m => /reserva|emerg/i.test(m.nome || "")).reduce((s, m) => s + m.atual, 0);
    const reserva = Math.max(0, num(ctx.saldo)) + emReserva;
    const custoMensal = despesasFixas || mediaGastos;
    const resumo = window.FinckReality ? window.FinckReality.resumoHistorico(ctx.analises || []) : {
      total: 0,
      decididas: 0,
      evitadas: 0,
      taxa_consciente: 0,
      indicador_medio: null
    };
    const r = {
      referencia: chaveMes(hoje),
      meses_considerados: n,
      mes_parcial: janela.parcial,
      renda: renda,
      tipo_renda: perfil.income_type || null,
      despesas_fixas: despesasFixas,
      sobra_mensal: renda - despesasFixas,
      sem_folga: renda > 0 && renda - despesasFixas <= 0,
      saldo: num(ctx.saldo),
      compromissos_abertos: num(ctx.compromissosAbertos),
      disponivel_projetado: num(ctx.disponivelProjetado),
      parcelas_mensais: parcelasMensais(ctx.parcelamentos),
      media_entradas: mediaEntradas,
      media_gastos: gastosConsiderados,
      media_aportes: Math.max(mediaAportes, aportesNasMetas),
      base_renda: baseRenda,
      taxa_poupanca: baseRenda > 0 ? (baseRenda - gastosConsiderados) / baseRenda * 100 : 0,
      reserva: reserva,
      custo_mensal: custoMensal,
      reserva_meses: custoMensal > 0 ? reserva / custoMensal : 0,
      categorias: categorias(realizadas, janela.meses, hoje),
      metas: metas,
      consumo: {
        analises: resumo.total,
        decididas: resumo.decididas,
        conscientes: resumo.evitadas,
        taxa_consciente: resumo.taxa_consciente,
        indicador_medio: resumo.indicador_medio
      },
      plano_declarado: {
        economia_pct: perfil.savings_percent ?? null,
        economia_valor: perfil.savings_amount ?? null,
        renda_livre_pct: perfil.free_income_percent ?? null
      }
    };
    const dimensoes = [ dimensaoFluxo(r), dimensaoPoupanca(r), dimensaoReserva(r), dimensaoCompromissos(r), dimensaoMetas(r), dimensaoConsumo(r) ];
    // Índice FinCK: média ponderada só das dimensões com dados. É um resumo
    // didático, não um score de crédito.
    const comDados = dimensoes.filter(d => d.nota !== null);
    const pesoDe = d => (p.PESOS[d.id] || 0) * (d.parcial ? .5 : 1);
    const pesoReal = comDados.reduce((s, d) => s + pesoDe(d), 0);
    const indice = pesoReal > 0 ? Math.round(comDados.reduce((s, d) => s + d.nota * pesoDe(d), 0) / pesoReal) : null;
    const prio = prioridades(r, dimensoes);
    const fortes = dimensoes.filter(d => d.nivel === "saudavel").map(d => ({
      dimensao: d.id,
      texto: `${d.nome}: ${d.valor_texto}.`
    }));
    const lacunas = dimensoes.filter(d => d.nivel === "sem_dados").map(d => d.explicacao);
    return {
      gerado_em: hoje.toISOString(),
      retrato: r,
      dimensoes: dimensoes,
      indice: indice,
      rotulo: rotuloIndice(indice),
      prioridades: prio,
      pontos_fortes: fortes,
      lacunas: lacunas,
      resumo: indice === null ? "Ainda faltam dados para um retrato completo. Comece pela renda e pelas despesas fixas." : `Sua vida financeira está ${rotuloIndice(indice)} (${indice}/100).${prio.length ? ` O que mais pede atenção agora: ${prio[0].titulo.charAt(0).toLowerCase()}${prio[0].titulo.slice(1)}.` : " Nenhum ponto crítico no momento."}`
    };
  }

  // ------------------------------------------------------------ para a IA

  // O que vai para o servidor: números agregados e arredondados, nomes de
  // categoria e de meta. Nenhuma descrição de lançamento, conta, e-mail ou
  // nome da pessoa. A tela mostra exatamente este objeto antes do envio.
  function paraIA(diag) {
    const r = diag.retrato;
    return {
      versao: 1,
      referencia: r.referencia,
      meses_considerados: r.meses_considerados,
      renda_mensal: arred(r.renda),
      tipo_renda: r.tipo_renda,
      despesas_fixas: arred(r.despesas_fixas),
      sobra_mensal: arred(r.sobra_mensal),
      saldo: arred(r.saldo),
      parcelas_mensais: arred(r.parcelas_mensais),
      compromissos_abertos: arred(r.compromissos_abertos),
      disponivel_projetado: arred(r.disponivel_projetado),
      media_entradas: arred(r.base_renda),
      media_gastos: arred(r.media_gastos),
      media_guardado_em_metas: arred(r.media_aportes),
      taxa_poupanca_pct: arred(r.taxa_poupanca, 1),
      reserva: arred(r.reserva),
      reserva_meses: arred(r.reserva_meses, 1),
      categorias: r.categorias.slice(0, 6).map(c => ({
        nome: c.nome,
        media_mensal: arred(c.media_mensal),
        participacao_pct: arred(c.participacao, 1),
        tendencia_pct: c.tendencia_pct === null ? null : arred(c.tendencia_pct, 0)
      })),
      metas: r.metas.slice(0, 6).map(m => ({
        nome: String(m.nome || "").slice(0, 40),
        alvo: arred(m.alvo),
        atual: arred(m.atual),
        prazo: m.prazo,
        aporte_mensal_recente: arred(m.ritmo_mensal),
        aporte_mensal_necessario: m.necessario_mensal === null ? null : arred(m.necessario_mensal),
        no_ritmo: m.no_ritmo,
        concluida: m.concluida
      })),
      consumo: {
        analises: r.consumo.analises,
        decididas: r.consumo.decididas,
        taxa_consciente_pct: arred(r.consumo.taxa_consciente, 0),
        indicador_medio: r.consumo.indicador_medio
      },
      plano_declarado: r.plano_declarado,
      indice: diag.indice,
      dimensoes: diag.dimensoes.map(d => ({
        id: d.id,
        nivel: d.nivel,
        nota: d.nota,
        resumo: d.valor_texto,
        referencia: d.referencia
      })),
      prioridades_regras: diag.prioridades.slice(0, 5).map(x => x.titulo)
    };
  }

  // ------------------------------------------------------------ plano local

  // Mesmo formato do plano da IA, montado só com as regras. É o que aparece
  // na demonstração e quando a IA não responde: o recurso degrada, não some.
  const PRAZO_POR_NIVEL = {
    critico: "esta semana",
    atencao: "este mês",
    info: "nos próximos 3 meses"
  };
  function planoLocal(diag) {
    const r = diag.retrato;
    const p = P();
    const folga = Math.max(0, r.base_renda - r.media_gastos);
    const sugestoes = [];
    if (diag.dimensoes.find(d => d.id === "reserva")?.nivel !== "saudavel" && r.custo_mensal > 0 && folga > 0) {
      sugestoes.push({
        nome: "Reserva de emergência",
        valor_mensal: arred(Math.min(folga * .5, r.custo_mensal * p.RESERVA_MINIMA_MESES / 6)),
        motivo: `Metade da sobra média do mês, até chegar a ${moeda(r.custo_mensal * p.RESERVA_MINIMA_MESES)}.`
      });
    }
    return {
      origem: "regras",
      diagnostico: diag.resumo,
      pontos_fortes: diag.pontos_fortes.map(f => f.texto),
      prioridades: diag.prioridades.slice(0, 4).map(x => ({
        titulo: x.titulo,
        porque: x.porque,
        baseado_em: x.dimensao,
        passos: [],
        acao: x.acao,
        prazo: PRAZO_POR_NIVEL[x.nivel] || "este mês",
        href: x.href
      })),
      metas_sugeridas: sugestoes,
      habito_da_semana: "Antes de qualquer compra acima de uma hora de trabalho, passe pelo FinCK of Reality e espere um dia para decidir.",
      alerta: r.disponivel_projetado < 0 ? "Os compromissos em aberto passam do saldo. Se as parcelas ficarem impossíveis de pagar, procure renegociar direto com o credor ou o Procon da sua cidade antes de atrasar." : null,
      limites: "Plano montado pelas regras do FinCK com os seus números. É educativo: não é recomendação de investimento nem consultoria financeira."
    };
  }

  return {
    NIVEIS: NIVEIS,
    diagnosticar: diagnosticar,
    paraIA: paraIA,
    planoLocal: planoLocal,
    janelaDeMeses: janelaDeMeses,
    categorias: categorias,
    parcelasMensais: parcelasMensais,
    situacaoDasMetas: situacaoDasMetas,
    rotuloIndice: rotuloIndice
  };
})();
