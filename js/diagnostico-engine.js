// Revisão financeira: diagnóstico da vida financeira inteira.
//
// O FinCK of Reality olha uma compra de cada vez. Este motor olha o conjunto:
// renda, despesas fixas, gastos do dia a dia, parcelas, reserva, metas e as
// decisões de consumo já registradas. Ele é determinístico e roda no próprio
// aparelho: os números saem daqui, sempre com a regra que os produziu.
//
// As próximas ações (planoLocal), a conta de cada uma (calculo) e as
// respostas às perguntas prontas (responder) também saem daqui, sem IA. A IA
// é opcional: só quando a pessoa pede, a rota api/assistente-ia.js recebe o
// retrato agregado que paraIA() monta, sem descrição de lançamento nem dado
// pessoal, e devolve texto. Ela interpreta números, não os calcula.
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
  const casa1 = v => num(v).toLocaleString("pt-BR", {
    maximumFractionDigits: 1
  });
  const meses = n => `${casa1(n)} ${arred(n, 1) === 1 ? "mês" : "meses"}`;
  const dataBR = iso => window.FinckUtils ? window.FinckUtils.dataBR(iso) : String(iso || "");
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
        media_anterior: mediaAnterior,
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
      return semDados("metas", "Metas", "Nenhuma meta cadastrada. Com uma meta, a sobra do mês ganha um destino.");
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
      return semDados("consumo", "Consumo consciente", "Nenhuma compra analisada ainda. As decisões registradas no FinCK of Reality entram nesta dimensão.");
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

  // ------------------------------------------------- como foi calculado

  // A conta de cada dimensão, passo a passo, com os mesmos números que deram
  // a nota. Só monta texto: nenhuma conta nova sai daqui.
  function calculoDaDimensao(r, d) {
    const p = P();
    const linhas = [];
    const add = (rotulo, valor) => linhas.push({
      rotulo: rotulo,
      valor: valor
    });
    if (!d) {
      return linhas;
    }
    if (d.id === "fluxo") {
      add("Renda declarada", r.renda > 0 ? moeda(r.renda) : "não informada");
      if (r.renda > 0) {
        add("Despesas fixas", moeda(r.despesas_fixas));
        add("Parte da renda em fixos", `${moeda(r.despesas_fixas)} ÷ ${moeda(r.renda)} = ${pct(d.valor)}`);
        add("Sobra após os fixos", `${moeda(r.renda)} − ${moeda(r.despesas_fixas)} = ${moeda(r.sobra_mensal)}`);
        add("Regra da nota", `100 com os fixos até ${p.FIXOS_REFERENCIA_PCT}% da renda; cada ponto percentual acima tira 2,5 pontos`);
      }
    }
    if (d.id === "poupanca") {
      const n = r.meses_considerados;
      const sobra = r.base_renda - r.media_gastos;
      if (n) {
        add(r.mes_parcial ? "Entradas consideradas (mês em andamento)" : `Entradas (média de ${meses(n)})`, moeda(r.base_renda));
        add(r.mes_parcial ? "Gastos considerados (mês em andamento)" : `Gastos (média de ${meses(n)})`, moeda(r.media_gastos));
        add("Sobra por mês", `${moeda(r.base_renda)} − ${moeda(r.media_gastos)} = ${moeda(sobra)}`);
        if (r.base_renda > 0) {
          add("Taxa de poupança", `${moeda(sobra)} ÷ ${moeda(r.base_renda)} = ${pct(r.taxa_poupanca)}`);
        }
        if (r.mes_parcial) {
          add("Mês em andamento", "a renda vale pelo menos a declarada, e os gastos, pelo menos as despesas fixas");
        }
        add("Regra da nota", `proporcional à taxa: ${p.POUPANCA_IDEAL_PCT}% ou mais vale 100; sobra negativa deixa a dimensão crítica`);
      } else {
        add("Meses registrados", "nenhum");
      }
    }
    if (d.id === "reserva") {
      const saldo = Math.max(0, r.saldo);
      const emMetas = num(r.reserva_em_metas);
      add("Saldo atual", moeda(saldo));
      if (emMetas > 0) {
        add("Guardado em metas de reserva", moeda(emMetas));
        add("Reserva", `${moeda(saldo)} + ${moeda(emMetas)} = ${moeda(r.reserva)}`);
      }
      if (r.custo_mensal > 0) {
        add(r.despesas_fixas > 0 ? "Custo fixo do mês" : "Custo do mês (média de gastos)", moeda(r.custo_mensal));
        add("Meses cobertos", `${moeda(r.reserva)} ÷ ${moeda(r.custo_mensal)} = ${meses(r.reserva_meses)}`);
        add(`Primeiro degrau (${p.RESERVA_MINIMA_MESES} meses)`, moeda(r.custo_mensal * p.RESERVA_MINIMA_MESES));
        add(`Alvo (${p.RESERVA_IDEAL_MESES} meses)`, moeda(r.custo_mensal * p.RESERVA_IDEAL_MESES));
        add("Regra da nota", `proporcional: ${p.RESERVA_IDEAL_MESES} meses ou mais vale 100`);
      } else {
        add("Custo fixo do mês", "não cadastrado");
      }
    }
    if (d.id === "compromissos") {
      add("Parcelas por mês", moeda(r.parcelas_mensais));
      add("Renda declarada", r.renda > 0 ? moeda(r.renda) : "não informada");
      if (r.renda > 0) {
        add("Peso na renda", `${moeda(r.parcelas_mensais)} ÷ ${moeda(r.renda)} = ${pct(d.valor)}`);
        add("Parcelas e previsões em aberto", moeda(r.compromissos_abertos));
        add("Saldo depois desses compromissos", moeda(r.disponivel_projetado));
        add("Regra da nota", `100 sem parcelas; cada ponto percentual da renda em parcelas tira ${casa1(60 / p.PARCELAS_LIMITE_PCT)} pontos; compromissos acima do saldo limitam a nota a 30`);
      }
    }
    if (d.id === "metas") {
      const abertas = r.metas.filter(m => !m.concluida);
      if (!r.metas.length) {
        add("Metas cadastradas", "nenhuma");
      } else if (!abertas.length) {
        add("Metas cadastradas", `${r.metas.length}, todas alcançadas`);
      } else {
        add("Metas em andamento", String(abertas.length));
        add("No ritmo do prazo", `${abertas.filter(m => m.no_ritmo).length} de ${abertas.length}`);
        abertas.filter(m => !m.no_ritmo).slice(0, 3).forEach(m => {
          add(`Meta "${m.nome}"`, m.necessario_mensal ? `aportes de ${moeda(m.ritmo_mensal)} por mês; o prazo pede ${moeda(m.necessario_mensal)}` : "sem aportes nos últimos 3 meses");
        });
        add("Regra", "uma meta está no ritmo quando os aportes dos últimos 3 meses chegam a 90% do que o prazo pede; sem prazo, quando recebe aporte");
        add("Regra da nota", "metas no ritmo ÷ metas em andamento");
      }
    }
    if (d.id === "consumo") {
      const c = r.consumo;
      add("Compras analisadas", String(c.analises));
      add("Com decisão registrada", String(c.decididas));
      if (c.decididas) {
        add("Decisões conscientes", `${c.conscientes} (esperar, buscar alternativa ou não comprar)`);
        add("Taxa", `${c.conscientes} ÷ ${c.decididas} = ${pct(c.taxa_consciente)}`);
      }
      if (c.indicador_medio !== null) {
        add("Indicador médio de decisão responsável", `${c.indicador_medio}/100`);
      }
      if (c.analises) {
        add("Regra da nota", c.indicador_medio === null ? "a taxa de decisões conscientes" : "média entre a taxa e o indicador médio");
      }
    }
    if (d.referencia) {
      add("Referência", d.referencia);
    }
    add("Nota", d.nota !== null ? `${d.nota}/100, ${NIVEIS[d.nivel].toLowerCase()}` : NIVEIS.sem_dados);
    return linhas;
  }

  // ------------------------------------------------------------- prioridades

  // Cada prioridade diz o que fazer, por quê (com o número que a disparou),
  // por que isso importa (uma frase), como foi calculada e onde fazer no app.
  // A ordem segue a gravidade: primeiro o que ameaça o mês, depois o que
  // constrói segurança, por fim os hábitos.
  function prioridades(r, dims) {
    const p = P();
    const d = Object.fromEntries(dims.map(x => [ x.id, x ]));
    const lista = [];
    const add = (nivel, titulo, porque, acao, href, dimensao, extra = {}) => lista.push({
      nivel: nivel,
      titulo: titulo,
      porque: porque,
      acao: acao,
      href: href,
      dimensao: dimensao,
      importa: extra.importa || "",
      calculo: extra.calculo || calculoDaDimensao(r, d[dimensao])
    });
    if (!(r.renda > 0)) {
      add("critico", "Informar a sua renda mensal", "Sem ela, o FinCK não converte compras em tempo de trabalho nem mede o peso dos gastos.", "Ir para o Perfil", "perfil.html", "fluxo", {
        importa: "A renda é a base das outras contas: o valor da sua hora, o peso de cada gasto e a sobra do mês."
      });
    }
    if (d.fluxo.nivel === "critico") {
      add("critico", "Reduzir as despesas fixas", d.fluxo.explicacao, "Revisar recorrentes", "recorrentes.html", "fluxo", {
        importa: "Com os fixos acima da renda, cada gasto variável sai do saldo guardado, e o saldo diminui a cada mês."
      });
    }
    if (d.compromissos.nivel === "critico") {
      add("critico", "Não assumir novas parcelas por enquanto", d.compromissos.explicacao, "Ver compromissos", "planejamento.html", "compromissos", {
        importa: "Parcelas já assumidas ocupam a renda dos próximos meses; com elas acima do limite, um imprevisto vira atraso."
      });
    }
    if (d.poupanca.nivel === "critico") {
      add("critico", "Fechar o mês sem gastar mais do que entra", d.poupanca.explicacao, "Ver para onde vai o dinheiro", "analises.html", "poupanca", {
        importa: "Gastar mais do que entra consome o saldo e a reserva, e o mês seguinte começa com menos."
      });
    }
    if (d.reserva.nivel === "critico" || d.reserva.nivel === "atencao") {
      const minimo = r.custo_mensal * p.RESERVA_MINIMA_MESES;
      const ideal = r.custo_mensal * p.RESERVA_IDEAL_MESES;
      const temMetaReserva = r.metas.some(m => /reserva|emerg/i.test(m.nome || ""));
      // Com o primeiro degrau alcançado, o texto aponta o próximo alvo.
      const passouMinimo = r.reserva_meses >= p.RESERVA_MINIMA_MESES;
      const degrau = passouMinimo ? `O primeiro degrau (${moeda(minimo)}, ${p.RESERVA_MINIMA_MESES} meses de custo fixo) já foi alcançado; o próximo alvo é ${moeda(ideal)} (${p.RESERVA_IDEAL_MESES} meses).` : `O primeiro degrau é ${moeda(minimo)} (${p.RESERVA_MINIMA_MESES} meses de custo fixo).`;
      const titulo = temMetaReserva ? "Reforçar a reserva de emergência" : passouMinimo ? "Separar a reserva de emergência numa meta" : "Começar uma reserva de emergência";
      add(d.reserva.nivel, titulo, `${d.reserva.explicacao} ${degrau}`, temMetaReserva ? "Ver minhas metas" : "Criar a meta de reserva", temMetaReserva ? "metas.html" : "metas.html#nova", "reserva", {
        importa: "A reserva paga imprevistos (saúde, conserto, perda de renda) sem recorrer a crédito, que costuma ter juros altos."
      });
    }
    const emAlta = r.categorias.find(c => c.tendencia_pct !== null && c.tendencia_pct >= p.TENDENCIA_ALTA_PCT && c.participacao >= 10);
    if (emAlta) {
      const anterior = num(emAlta.media_anterior);
      add("atencao", `Olhar os gastos com ${emAlta.nome}`, `No último mês eles foram ${moeda(emAlta.ultimo_mes)}, ${pct(emAlta.tendencia_pct)} acima da média dos meses anteriores.`, "Ver análise dos gastos", "analises.html", "poupanca", {
        importa: "Uma categoria que cresce de um mês para o outro é o lugar mais rápido para ver para onde o dinheiro foi.",
        calculo: [ {
          rotulo: `${emAlta.nome} no último mês`,
          valor: moeda(emAlta.ultimo_mes)
        }, {
          rotulo: "Média dos meses anteriores",
          valor: moeda(anterior)
        }, {
          rotulo: "Diferença",
          valor: `${moeda(emAlta.ultimo_mes)} − ${moeda(anterior)} = ${moeda(emAlta.ultimo_mes - anterior)} (${pct(emAlta.tendencia_pct)} a mais)`
        }, {
          rotulo: "Parte dos gastos",
          valor: pct(emAlta.participacao)
        }, {
          rotulo: "Regra",
          valor: `aparece quando uma categoria com pelo menos 10% dos gastos sobe ${p.TENDENCIA_ALTA_PCT}% ou mais`
        } ]
      });
    }
    if (d.poupanca.nivel === "atencao") {
      add("atencao", "Guardar um valor fixo assim que o dinheiro entrar", `${d.poupanca.explicacao} Separar a poupança no dia do pagamento, antes dos gastos, costuma funcionar melhor do que guardar o que sobra.`, "Escolher uma meta", "metas.html", "poupanca", {
        importa: "Com pouca sobra, sobra pouco espaço para metas e imprevistos; um valor separado no dia do pagamento fica previsível."
      });
    }
    const jaFalouDeReserva = lista.some(x => x.dimensao === "reserva");
    r.metas.filter(m => !m.concluida && !m.no_ritmo && !(jaFalouDeReserva && /reserva|emerg/i.test(m.nome || ""))).slice(0, 2).forEach(m => {
      const calculo = [ {
        rotulo: "Guardado",
        valor: `${moeda(m.atual)} de ${moeda(m.alvo)}`
      }, {
        rotulo: "Falta",
        valor: moeda(m.falta)
      }, {
        rotulo: "Prazo",
        valor: m.prazo ? dataBR(m.prazo) : "sem prazo"
      }, {
        rotulo: "Aportes recentes",
        valor: `${moeda(m.ritmo_mensal)} por mês (média dos últimos 3 meses)`
      } ];
      if (m.necessario_mensal) {
        calculo.push({
          rotulo: "O prazo pede",
          valor: `${moeda(m.falta)} ÷ meses até o prazo = ${moeda(m.necessario_mensal)} por mês`
        }, {
          rotulo: "Diferença",
          valor: `${moeda(Math.max(0, m.necessario_mensal - m.ritmo_mensal))} por mês`
        });
      }
      add("atencao", `Ajustar o ritmo da meta "${m.nome}"`, m.necessario_mensal ? `O prazo pede ${moeda(m.necessario_mensal)} por mês e os aportes recentes estão em ${moeda(m.ritmo_mensal)}.` : "Ela não recebeu aportes nos últimos 3 meses.", "Ver a meta", "metas.html", "metas", {
        importa: m.necessario_mensal ? "No ritmo atual, a meta não chega no prazo; ajustar o aporte ou o prazo deixa a conta possível." : "Sem aportes, a meta fica parada; um valor mensal, mesmo pequeno, dá a ela uma data para chegar.",
        calculo: calculo
      });
    });
    if (d.compromissos.nivel === "atencao") {
      add("atencao", "Esperar as parcelas atuais terminarem antes de parcelar de novo", d.compromissos.explicacao, "Ver parcelas", "planejamento.html", "compromissos", {
        importa: "Cada nova parcela se soma às atuais e reduz a sobra dos próximos meses."
      });
    }
    if (d.fluxo.nivel === "atencao") {
      add("atencao", "Rever uma despesa fixa", `${d.fluxo.explicacao} Assinaturas e planos são os mais fáceis de renegociar.`, "Revisar recorrentes", "recorrentes.html", "fluxo", {
        importa: "Uma despesa fixa se repete todo mês: reduzir uma delas libera dinheiro em todos os meses seguintes."
      });
    }
    if (d.metas.nivel === "sem_dados") {
      add("info", "Criar uma meta", "Com uma meta, o FinCK mostra quanto cada compra atrasa aquilo que importa para você.", "Criar meta", "metas.html#nova", "metas", {
        importa: "Uma meta dá destino à sobra do mês e deixa visível o efeito de cada compra nesse objetivo."
      });
    }
    if (d.consumo.nivel === "sem_dados" || d.consumo.nivel === "critico") {
      add("info", "Analisar a próxima compra antes de comprar", d.consumo.nivel === "sem_dados" ? d.consumo.explicacao : `${d.consumo.explicacao} Usar o FinCK of Reality antes de comprar ajuda a separar necessidade de impulso.`, "Analisar uma compra", "reality.html", "consumo", {
        importa: "A análise mostra o preço em horas de trabalho e o efeito no mês e nas metas antes de a compra acontecer."
      });
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
      resumo: indice === null ? "Faltam dados para calcular o índice. Os primeiros são a renda e as despesas fixas." : `Índice FinCK de ${indice}/100: vida financeira ${rotuloIndice(indice)}.${prio.length ? ` Primeira das próximas ações: ${prio[0].titulo.charAt(0).toLowerCase()}${prio[0].titulo.slice(1)}.` : " Nenhuma ação pendente no momento."}`
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
      // Mês em andamento: as médias ainda são estimativa.
      mes_parcial: r.mes_parcial === true,
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

  // O mesmo retrato em texto, para a pergunta livre pela rota geral
  // (api/ia.js, campo "contexto"). Só números, níveis e nomes de categoria:
  // metas entram numeradas, sem o nome, e nenhuma conta ou lançamento vai.
  function contextoDaConversa(diag) {
    const r = paraIA(diag);
    const casa1 = v => num(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    const linhas = [
      "Retrato agregado da vida financeira, calculado pelo FinCK (valores em reais, arredondados). Nomes de metas, contas e lançamentos não são enviados.",
      `Período: ${r.meses_considerados} ${r.meses_considerados === 1 ? "mês" : "meses"} até ${r.referencia || "hoje"}${r.mes_parcial ? "; mês em andamento, as médias são estimativa" : ""}.`,
      `Renda mensal declarada ${moeda(r.renda_mensal)}${r.tipo_renda ? ` (renda ${r.tipo_renda})` : ""}; despesas fixas ${moeda(r.despesas_fixas)}; sobra da renda após os fixos ${moeda(r.sobra_mensal)} por mês.`,
      `Saldo atual ${moeda(r.saldo)}; parcelas por mês ${moeda(r.parcelas_mensais)}; parcelas que faltam pagar ${moeda(r.compromissos_abertos)}; saldo depois das parcelas ${moeda(r.disponivel_projetado)}.`,
      `Médias por mês: entradas ${moeda(r.media_entradas)}; gastos ${moeda(r.media_gastos)}; guardado em metas ${moeda(r.media_guardado_em_metas)}; taxa de poupança ${casa1(r.taxa_poupanca_pct)}%.`,
      `Reserva (saldo mais metas de reserva) ${moeda(r.reserva)}, que cobre ${casa1(r.reserva_meses)} ${arred(r.reserva_meses, 1) === 1 ? "mês" : "meses"} de custo fixo.`
    ];
    if (r.categorias.length) {
      linhas.push(`Gastos por categoria (média por mês): ${r.categorias.map(c => `${c.nome} ${moeda(c.media_mensal)} (${casa1(c.participacao_pct)}% dos gastos${c.tendencia_pct === null ? "" : `, ${c.tendencia_pct >= 0 ? "+" : ""}${pct(c.tendencia_pct)} no último mês`})`).join("; ")}.`);
    }
    linhas.push(r.metas.length ? `Metas, numeradas e sem nome: ${r.metas.map((m, i) => `meta ${i + 1}: alvo ${moeda(m.alvo)}, guardado ${moeda(m.atual)}${m.prazo ? `, prazo ${m.prazo}` : ""}, aporte recente ${moeda(m.aporte_mensal_recente)} por mês${m.aporte_mensal_necessario === null ? "" : `, necessário ${moeda(m.aporte_mensal_necessario)} por mês`}, ${m.concluida ? "concluída" : m.no_ritmo ? "no ritmo" : "fora do ritmo"}`).join("; ")}.` : "Metas: nenhuma cadastrada.");
    linhas.push(`Decisões de compra: ${r.consumo.analises} análise(s), ${r.consumo.decididas} com decisão${r.consumo.decididas ? `, ${pct(r.consumo.taxa_consciente_pct)} conscientes` : ""}.`);
    if (r.indice !== null && r.indice !== undefined) {
      linhas.push(`Índice FinCK: ${r.indice} de 100.`);
    }
    linhas.push(`Dimensões pelas regras do FinCK: ${diag.dimensoes.map(d => `${d.nome}: ${NIVEIS[d.nivel] || d.nivel}, ${d.valor_texto}${d.referencia ? ` (referência ${d.referencia})` : ""}`).join("; ")}.`);
    return linhas.join("\n");
  }

  // ------------------------------------------------------------ plano local

  // As próximas ações da Revisão financeira, montadas só com as regras. É o
  // que a página mostra ao abrir, em qualquer modo. A explicação escrita por
  // IA (opcional) usa o mesmo formato, sem a conta e o "por que importa".
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
    // Quem já tem uma meta de reserva não recebe a sugestão de criar outra.
    const temMetaReserva = (r.metas || []).some(m => /reserva|emerg/i.test(m.nome || ""));
    if (!temMetaReserva && diag.dimensoes.find(d => d.id === "reserva")?.nivel !== "saudavel" && r.custo_mensal > 0 && folga > 0) {
      const alvo = r.custo_mensal * (r.reserva_meses >= p.RESERVA_MINIMA_MESES ? p.RESERVA_IDEAL_MESES : p.RESERVA_MINIMA_MESES);
      sugestoes.push({
        nome: "Reserva de emergência",
        valor_mensal: arred(Math.min(folga * .5, alvo / 6)),
        motivo: `Metade da sobra média do mês, até chegar a ${moeda(alvo)}.`
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
        href: x.href,
        nivel: x.nivel,
        importa: x.importa || "",
        calculo: x.calculo || []
      })),
      metas_sugeridas: sugestoes,
      habito_da_semana: "Para compras acima de uma hora de trabalho: analisar no FinCK of Reality e esperar um dia antes de decidir.",
      alerta: r.disponivel_projetado < 0 ? "Os compromissos em aberto passam do saldo. Se as parcelas ficarem impossíveis de pagar, procure renegociar direto com o credor ou o Procon da sua cidade antes de atrasar." : null,
      limites: "Ações montadas pelas regras do FinCK com os seus números. É educativo: não é recomendação de investimento nem consultoria financeira."
    };
  }

  // ------------------------------------------------------- perguntas prontas

  // Perguntas sobre os próprios números, com resposta calculada aqui, na
  // hora, sem IA e sem rede. A ordem segue as prioridades da pessoa: quem abre
  // a ajuda vê primeiro o que tem a ver com o seu caso.
  const curto = t => t.length > 28 ? `${t.slice(0, 27).trim()}…` : t;
  const metaForaDoRitmo = r => r.metas.find(m => !m.concluida && !m.no_ritmo) || null;
  const categoriaEmAlta = r => r.categorias.find(c => c.tendencia_pct !== null && c.tendencia_pct >= 10) || null;

  function perguntasProntas(diag, limite = 5) {
    const r = diag.retrato;
    const lista = [];
    const add = (id, rotulo) => {
      if (rotulo && !lista.some(x => x.id === id) && lista.length < limite) {
        lista.push({
          id: id,
          rotulo: rotulo
        });
      }
    };
    const meta = metaForaDoRitmo(r);
    const subiu = categoriaEmAlta(r);
    const porDimensao = {
      reserva: () => r.custo_mensal > 0 && add("reserva", "Quanto falta para a minha reserva chegar à referência?"),
      poupanca: () => r.meses_considerados && add("sobra", "Para onde está indo a sobra do meu mês?"),
      compromissos: () => r.renda > 0 && add("parcelas", "Quanto as parcelas pesam na minha renda?"),
      fluxo: () => r.renda > 0 && add("fixos", "Quanto da minha renda já tem destino fixo?"),
      metas: () => meta && add("meta", `Quanto falta por mês para a meta "${curto(String(meta.nome || "Meta"))}"?`),
      consumo: () => r.consumo.analises && add("consumo", "Como foram as minhas decisões de compra?")
    };
    diag.prioridades.forEach(x => porDimensao[x.dimensao]?.());
    if (subiu) {
      add("categoria", `Quanto ${curto(subiu.nome)} subiu no último mês?`);
    }
    if (diag.indice !== null) {
      add("indice", `Por que o meu Índice FinCK está em ${diag.indice}?`);
    }
    if (r.meses_considerados) {
      add("guardar", "Quanto sobra por mês para guardar?");
    }
    Object.values(porDimensao).forEach(f => f());
    return lista;
  }

  // A resposta de uma pergunta pronta: texto curto, a conta passo a passo e
  // o selo (dado confirmado ou estimativa). Null quando faltam os dados.
  function responder(diag, id) {
    const r = diag.retrato;
    const p = P();
    const dim = Object.fromEntries(diag.dimensoes.map(d => [ d.id, d ]));
    const linha = (rotulo, valor) => ({
      rotulo: rotulo,
      valor: valor
    });
    const mediaEstimada = r.mes_parcial || r.meses_considerados < (p.JANELA_MESES || 3);
    const pronta = (rotulo, texto, calculo, estimativa = false) => ({
      id: id,
      rotulo: rotulo,
      texto: texto,
      calculo: calculo,
      certeza: estimativa ? "estimativa" : "confirmado"
    });
    const rotulo = (perguntasProntas(diag, 99).find(x => x.id === id) || {}).rotulo || "";
    const sobra = r.base_renda - r.media_gastos;
    if (id === "reserva" && r.custo_mensal > 0) {
      const minimo = r.custo_mensal * p.RESERVA_MINIMA_MESES;
      const ideal = r.custo_mensal * p.RESERVA_IDEAL_MESES;
      const faltaMin = Math.max(0, minimo - r.reserva);
      const faltaIdeal = Math.max(0, ideal - r.reserva);
      const ritmo = sobra > 0 && faltaMin > 0 ? ` Se toda a sobra média (${moeda(sobra)} por mês) fosse para a reserva, o primeiro degrau chegaria em cerca de ${meses(Math.ceil(faltaMin / sobra))}.` : "";
      const texto = faltaIdeal <= 0 ? `A reserva de ${moeda(r.reserva)} já cobre ${meses(r.reserva_meses)} de custo fixo, acima da referência de ${p.RESERVA_IDEAL_MESES} meses.` : faltaMin > 0 ? `A reserva de ${moeda(r.reserva)} cobre ${meses(r.reserva_meses)} de custo fixo. Faltam ${moeda(faltaMin)} para o primeiro degrau (${p.RESERVA_MINIMA_MESES} meses) e ${moeda(faltaIdeal)} para o alvo de ${p.RESERVA_IDEAL_MESES} meses.${ritmo}` : `A reserva de ${moeda(r.reserva)} já passou do primeiro degrau (${p.RESERVA_MINIMA_MESES} meses). Faltam ${moeda(faltaIdeal)} para o alvo de ${p.RESERVA_IDEAL_MESES} meses.`;
      return pronta(rotulo, texto, [ ...calculoDaDimensao(r, dim.reserva).filter(x => !/^Regra|^Nota$|^Referência$/.test(x.rotulo)), linha(`Falta para ${p.RESERVA_MINIMA_MESES} meses`, `${moeda(minimo)} − ${moeda(r.reserva)} = ${moeda(faltaMin)}`), linha(`Falta para ${p.RESERVA_IDEAL_MESES} meses`, `${moeda(ideal)} − ${moeda(r.reserva)} = ${moeda(faltaIdeal)}`) ], !(r.despesas_fixas > 0) || Boolean(ritmo));
    }
    if ((id === "sobra" || id === "guardar") && r.meses_considerados) {
      const n = r.meses_considerados;
      const maiores = r.categorias.slice(0, 3);
      const calculo = [ linha(r.mes_parcial ? "Entradas (mês em andamento)" : `Entradas (média de ${meses(n)})`, moeda(r.base_renda)), linha(r.mes_parcial ? "Gastos (mês em andamento)" : `Gastos (média de ${meses(n)})`, moeda(r.media_gastos)), linha("Sobra por mês", `${moeda(r.base_renda)} − ${moeda(r.media_gastos)} = ${moeda(sobra)}`), linha("Guardado em metas por mês", moeda(r.media_aportes)) ];
      if (id === "sobra") {
        maiores.forEach(c => calculo.push(linha(`${c.nome} (média por mês)`, `${moeda(c.media_mensal)}, ${pct(c.participacao)} dos gastos`)));
        const texto = sobra < 0 ? `Os gastos (${moeda(r.media_gastos)}) passaram das entradas (${moeda(r.base_renda)}) em ${moeda(-sobra)} por mês.` : `Entram ${moeda(r.base_renda)} e saem ${moeda(r.media_gastos)} em gastos: sobram ${moeda(sobra)} por mês${r.media_aportes > 0 ? `, e ${moeda(r.media_aportes)} deles vão para metas` : "; nenhum valor foi para metas no período"}.`;
        return pronta(rotulo, `${texto}${maiores.length ? ` Os maiores gastos: ${maiores.map(c => `${c.nome} (${pct(c.participacao)})`).join(", ")}.` : ""}`, calculo, mediaEstimada);
      }
      const declarado = r.plano_declarado || {};
      const alvo = declarado.economia_valor ? num(declarado.economia_valor) : declarado.economia_pct && r.renda > 0 ? r.renda * num(declarado.economia_pct) / 100 : null;
      if (alvo !== null) {
        calculo.push(linha("Plano declarado no Perfil", declarado.economia_valor ? moeda(alvo) : `${pct(declarado.economia_pct)} da renda = ${moeda(alvo)}`));
      }
      const texto = sobra <= 0 ? `Na média, não sobra dinheiro depois dos gastos: as entradas são ${moeda(r.base_renda)} e os gastos, ${moeda(r.media_gastos)}.` : `Na média, sobram ${moeda(sobra)} por mês depois dos gastos (${pct(r.taxa_poupanca)} das entradas). ${r.media_aportes > 0 ? `Hoje ${moeda(r.media_aportes)} por mês vão para metas.` : "Nenhum valor foi para metas no período."}${alvo !== null ? ` O plano declarado no Perfil é guardar ${moeda(alvo)} por mês.` : ""}`;
      return pronta(rotulo, texto, calculo, mediaEstimada);
    }
    if (id === "parcelas" && r.renda > 0) {
      const peso = r.parcelas_mensais / r.renda * 100;
      const texto = r.parcelas_mensais > 0 ? `As parcelas somam ${moeda(r.parcelas_mensais)} por mês, ${pct(peso)} da renda declarada (confortável até ${p.PARCELAS_ATENCAO_PCT}%, pesado acima de ${p.PARCELAS_LIMITE_PCT}%). Em aberto, entre parcelas e previsões, são ${moeda(r.compromissos_abertos)}.` : "Não há compra parcelada em aberto: nenhuma parte da renda dos próximos meses está presa em parcelas.";
      return pronta(rotulo, texto, calculoDaDimensao(r, dim.compromissos).filter(x => !/^Regra|^Nota$/.test(x.rotulo)));
    }
    if (id === "fixos" && r.renda > 0) {
      const fixos = r.despesas_fixas / r.renda * 100;
      return pronta(rotulo, `${moeda(r.despesas_fixas)} de ${moeda(r.renda)} já têm destino todo mês: ${pct(fixos)} da renda (referência: até ${p.FIXOS_REFERENCIA_PCT}%). Depois dos fixos sobram ${moeda(r.sobra_mensal)}.`, calculoDaDimensao(r, dim.fluxo).filter(x => !/^Regra|^Nota$/.test(x.rotulo)));
    }
    if (id === "meta") {
      const m = metaForaDoRitmo(r);
      if (!m) {
        return null;
      }
      const dif = m.necessario_mensal ? Math.max(0, m.necessario_mensal - m.ritmo_mensal) : null;
      const calculo = [ linha("Guardado", `${moeda(m.atual)} de ${moeda(m.alvo)}`), linha("Falta", moeda(m.falta)), linha("Prazo", m.prazo ? dataBR(m.prazo) : "sem prazo"), linha("Aportes recentes", `${moeda(m.ritmo_mensal)} por mês (média dos últimos 3 meses)`) ];
      if (m.necessario_mensal) {
        calculo.push(linha("O prazo pede", `${moeda(m.necessario_mensal)} por mês`), linha("Diferença", `${moeda(m.necessario_mensal)} − ${moeda(m.ritmo_mensal)} = ${moeda(dif)} por mês`));
      }
      if (m.meses_para_concluir) {
        calculo.push(linha("No ritmo atual", `${moeda(m.falta)} ÷ ${moeda(m.ritmo_mensal)} = ${meses(m.meses_para_concluir)}`));
      }
      const texto = m.necessario_mensal ? `Faltam ${moeda(m.falta)}. O prazo pede ${moeda(m.necessario_mensal)} por mês e os aportes recentes estão em ${moeda(m.ritmo_mensal)}: a diferença é de ${moeda(dif)} por mês.${m.meses_para_concluir ? ` No ritmo atual, a meta chega em cerca de ${meses(m.meses_para_concluir)}.` : ""}` : `Faltam ${moeda(m.falta)} e a meta não recebeu aportes nos últimos 3 meses, então ainda não dá para estimar quando ela chega.`;
      return pronta(rotulo, texto, calculo, Boolean(m.meses_para_concluir));
    }
    if (id === "consumo" && r.consumo.analises) {
      const c = r.consumo;
      const texto = c.decididas ? `Foram ${c.analises} ${c.analises === 1 ? "compra analisada" : "compras analisadas"} e ${c.decididas} com decisão registrada. Em ${c.conscientes} delas a escolha foi esperar, buscar alternativa ou não comprar (${pct(c.taxa_consciente)}).${c.indicador_medio !== null ? ` Indicador médio de decisão responsável: ${c.indicador_medio}/100.` : ""}` : `Foram ${c.analises} ${c.analises === 1 ? "compra analisada" : "compras analisadas"}, ainda sem decisão registrada.`;
      return pronta(rotulo, texto, calculoDaDimensao(r, dim.consumo).filter(x => !/^Regra|^Nota$/.test(x.rotulo)));
    }
    if (id === "categoria") {
      const c = categoriaEmAlta(r);
      if (!c) {
        return null;
      }
      const anterior = num(c.media_anterior);
      return pronta(rotulo, `${c.nome} somou ${moeda(c.ultimo_mes)} no último mês, contra ${moeda(anterior)} na média dos meses anteriores: ${moeda(c.ultimo_mes - anterior)} a mais (${pct(c.tendencia_pct)}). É ${pct(c.participacao)} dos gastos do período.`, [ linha(`${c.nome} no último mês`, moeda(c.ultimo_mes)), linha("Média dos meses anteriores", moeda(anterior)), linha("Diferença", `${moeda(c.ultimo_mes)} − ${moeda(anterior)} = ${moeda(c.ultimo_mes - anterior)}`), linha("Parte dos gastos", pct(c.participacao)) ], mediaEstimada);
    }
    if (id === "indice" && diag.indice !== null) {
      const pesos = p.PESOS || {};
      const comDados = diag.dimensoes.filter(d => d.nota !== null);
      const pesoDe = d => (pesos[d.id] || 0) * (d.parcial ? .5 : 1);
      const baixas = comDados.filter(d => d.nivel !== "saudavel").sort((a, b) => a.nota - b.nota).slice(0, 2);
      const fora = diag.dimensoes.filter(d => d.nota === null).map(d => d.nome.toLowerCase());
      const calculo = comDados.map(d => linha(d.nome, `nota ${d.nota} × peso ${pct(pesoDe(d) * 100)}`));
      calculo.push(linha("Índice", `soma das notas × pesos ÷ soma dos pesos = ${diag.indice}/100`));
      const texto = `O índice é a média das notas das dimensões com dados, cada uma com o seu peso. ${baixas.length ? `${baixas.length === 1 ? "A dimensão que mais puxa o índice para baixo é" : "As dimensões que mais puxam o índice para baixo são"} ${baixas.map(d => `${d.nome.toLowerCase()} (nota ${d.nota})`).join(" e ")}.` : "Todas as dimensões com dados estão no nível saudável."}${fora.length ? ` Ficaram fora da conta, por falta de dados: ${fora.join(", ")}.` : ""}`;
      return pronta(rotulo, texto, calculo, comDados.some(d => d.parcial));
    }
    return null;
  }

  return {
    NIVEIS: NIVEIS,
    diagnosticar: diagnosticar,
    paraIA: paraIA,
    contextoDaConversa: contextoDaConversa,
    planoLocal: planoLocal,
    perguntasProntas: perguntasProntas,
    responder: responder,
    janelaDeMeses: janelaDeMeses,
    categorias: categorias,
    parcelasMensais: parcelasMensais,
    situacaoDasMetas: situacaoDasMetas,
    rotuloIndice: rotuloIndice
  };
})();
