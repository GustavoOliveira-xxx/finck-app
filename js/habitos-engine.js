// Hábitos de consumo: o que o histórico mostra quando se olha o conjunto.
//
// O FinCK of Reality pesa uma compra de cada vez, e a Revisão financeira
// mede a vida financeira em seis dimensões. Este motor procura padrões no
// que a pessoa registrou: pequenos gastos que somam, categorias que crescem,
// gastos que se repetem, os momentos em que o dinheiro sai, o que já tem
// destino todo mês, a sobra do mês e a troca frequente de itens duráveis.
//
// É determinístico e roda no aparelho, sem IA e sem rede: as mesmas entradas
// dão sempre os mesmos padrões, cada um com a conta que o produziu. O motor
// não decide se um gasto é necessário. Ele mostra o contexto e o efeito
// acumulado, e a leitura fica com a pessoa. Os limites estão em
// FINCK_CONFIG.HABITOS.
window.FinckHabitos = (() => {
  const cfg = window.FINCK_CONFIG;
  const P = () => cfg.HABITOS;
  const num = v => Number(v || 0);
  const arred = (v, casas = 2) => Math.round(num(v) * 10 ** casas) / 10 ** casas;
  const moeda = v => window.FinckUtils ? window.FinckUtils.moeda(v) : `R$ ${num(v).toFixed(2)}`;
  const pct = (v, casas = 0) => `${num(v).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  })}%`;
  const casa1 = v => num(v).toLocaleString("pt-BR", {
    maximumFractionDigits: 1
  });
  const meioDia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const dia = valor => new Date(`${String(valor || "").slice(0, 10)}T12:00:00`);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const chaveMes = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const MESES = [ "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro" ];
  const nomeMes = chave => MESES[Number(String(chave).slice(5, 7)) - 1] || chave;
  const soma = lista => lista.reduce((s, t) => s + num(t.amount), 0);
  const normalizar = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const vezes = n => `${n} ${n === 1 ? "vez" : "vezes"}`;
  const meses = n => `${casa1(n)} ${arred(n, 1) === 1 ? "mês" : "meses"}`;

  // ------------------------------------------------------------ classificação

  // Gasto do dia a dia é a saída que não é aporte em meta, conta fixa
  // (recorrência) nem parcela. É nele que hábitos aparecem: as fixas e as
  // parcelas já têm destino antes de o mês começar.
  function classificador(ctx = {}) {
    const fixas = new Set((ctx.recorrentes || []).filter(r => r.type === "saida" && r.active !== false).map(r => normalizar(r.description)));
    const ehGasto = t => t.type === "saida" && !t.goal_id;
    const ehFixo = t => t.source === "recorrente" || Boolean(t.source_occurrence_id) || fixas.has(normalizar(t.description));
    const ehParcela = t => t.source === "parcela";
    return {
      ehGasto: ehGasto,
      ehFixo: ehFixo,
      ehParcela: ehParcela,
      ehDiaADia: t => ehGasto(t) && !ehFixo(t) && !ehParcela(t),
      ehAporte: t => t.type === "saida" && Boolean(t.goal_id)
    };
  }

  const categoriaDe = t => t.category || "Outros";

  // Lançamentos de hoje para trás, sem estornos e sem previsões.
  function realizadasAte(ctx, hoje) {
    const limite = iso(hoje);
    return (ctx.transacoesRealizadas || ctx.transacoes || []).filter(t => !t.reversed_at && String(t.date || "").slice(0, 10) <= limite);
  }

  // Os últimos n dias, contando hoje.
  function ultimosDias(lista, hoje, n) {
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - (n - 1));
    const de = iso(inicio);
    return lista.filter(t => String(t.date || "").slice(0, 10) >= de);
  }

  // ------------------------------------------------------------ confiança

  // Um histórico de cinco dias não tem o mesmo peso de um de seis meses: a
  // leitura diz quanto tempo de registro sustenta cada padrão.
  function confiancaDe(realizadas, gastos, hoje) {
    const p = P();
    const datas = realizadas.map(t => String(t.date || "").slice(0, 10)).filter(Boolean).sort();
    const diasHistorico = datas.length ? Math.max(1, Math.round((hoje - dia(datas[0])) / 864e5) + 1) : 0;
    const base = {
      dias: diasHistorico,
      gastos: gastos.length
    };
    if (!datas.length || gastos.length < p.MIN_GASTOS) {
      return {
        ...base,
        nivel: "insuficiente",
        rotulo: "Poucos registros",
        texto: "Ainda há poucos gastos registrados para falar de hábitos. Com algumas semanas de registros, o FinCK começa a mostrar padrões."
      };
    }
    if (diasHistorico < p.CONFIANCA_MODERADA_DIAS) {
      return {
        ...base,
        nivel: "inicial",
        rotulo: "Leitura inicial",
        texto: `Leitura inicial, com ${diasHistorico} ${diasHistorico === 1 ? "dia" : "dias"} de registros. Os padrões podem mudar conforme você registra mais.`
      };
    }
    if (diasHistorico < p.CONFIANCA_CONSISTENTE_DIAS) {
      return {
        ...base,
        nivel: "moderada",
        rotulo: "Leitura moderada",
        texto: `Leitura com ${diasHistorico} dias de registros. Já dá para ver tendências; com ${p.CONFIANCA_CONSISTENTE_DIAS} dias, a comparação entre meses fica mais firme.`
      };
    }
    return {
      ...base,
      nivel: "consistente",
      rotulo: "Leitura consistente",
      texto: `Leitura com ${diasHistorico} dias de registros, cerca de ${meses(diasHistorico / 30)}.`
    };
  }

  // ------------------------------------------------------------ meses

  // Os últimos meses completos e o mês em andamento, lado a lado. Sobra é o
  // que entrou menos o que foi gasto; o que foi para as metas é sobra
  // guardada, não gasto.
  function serieMensal(realizadas, C, hoje, quantos) {
    const lista = [];
    for (let i = quantos; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1, 12);
      const mes = chaveMes(d);
      const doMes = realizadas.filter(t => String(t.date || "").slice(0, 7) === mes);
      const entradas = soma(doMes.filter(t => t.type === "entrada"));
      const gastos = soma(doMes.filter(C.ehGasto));
      lista.push({
        mes: mes,
        rotulo: nomeMes(mes),
        parcial: i === 0,
        com_registros: doMes.length > 0,
        entradas: entradas,
        gastos: gastos,
        dia_a_dia: soma(doMes.filter(C.ehDiaADia)),
        fixos: soma(doMes.filter(t => C.ehGasto(t) && C.ehFixo(t))),
        parcelas: soma(doMes.filter(t => C.ehGasto(t) && C.ehParcela(t))),
        aportes: soma(doMes.filter(C.ehAporte)),
        sobra: entradas - gastos
      });
    }
    return lista;
  }

  // Gasto do dia a dia por categoria em cada mês da série.
  function categoriasPorMes(diaADia, chaves) {
    const mapa = new Map;
    diaADia.forEach(t => {
      const mes = String(t.date || "").slice(0, 7);
      if (!chaves.includes(mes)) {
        return;
      }
      const c = categoriaDe(t);
      if (!mapa.has(c)) {
        mapa.set(c, Object.fromEntries(chaves.map(k => [ k, 0 ])));
      }
      mapa.get(c)[mes] += num(t.amount);
    });
    return [ ...mapa.entries() ].map(([nome, valores]) => ({
      nome: nome,
      valores: valores
    }));
  }

  // ------------------------------------------------------------ padrões

  function padraoPequenos(x) {
    const p = P();
    const limite = x.renda > 0 ? Math.min(p.PEQUENO_MAX_REAIS, Math.max(p.PEQUENO_MIN_REAIS, x.renda * p.PEQUENO_PCT_RENDA / 100)) : 50;
    const pequenos = x.recentes.filter(t => num(t.amount) <= limite);
    const total = soma(pequenos);
    const minimo = x.renda > 0 ? x.renda * p.PEQUENOS_MIN_PCT_RENDA / 100 : 150;
    if (pequenos.length < p.PEQUENOS_MIN_QTD || total < minimo) {
      return null;
    }
    const porCategoria = new Map;
    pequenos.forEach(t => porCategoria.set(categoriaDe(t), (porCategoria.get(categoriaDe(t)) || 0) + num(t.amount)));
    const maiores = [ ...porCategoria.entries() ].sort((a, b) => b[1] - a[1]).slice(0, 2);
    const pctRenda = x.renda > 0 ? total / x.renda * 100 : null;
    const horas = x.valorHora > 0 ? total / x.valorHora : null;
    const texto = `Nos últimos ${p.JANELA_DIAS} dias, ${pequenos.length} gastos de até ${moeda(limite)} somaram ${moeda(total)}${pctRenda !== null ? `, ${pct(pctRenda, 1)} da sua renda` : ""}${horas !== null ? ` (${casa1(horas)} h de trabalho)` : ""}. ${maiores.length ? `A maior parte em ${maiores.map(([c, v]) => `${c} (${moeda(v)})`).join(" e ")}.` : ""}`.trim();
    return {
      id: "pequenos",
      titulo: "Pequenos gastos que somam",
      texto: texto,
      categoria: maiores[0]?.[0] || null,
      base_mensal: total * 30 / p.JANELA_DIAS,
      vezes: pequenos.length,
      pct_renda: pctRenda,
      relevancia: 55 + Math.min(30, pctRenda || 10),
      certeza: "confirmado",
      simulavel: true,
      reflexao: "Quais desses gastos você faria de novo do mesmo jeito, e quais aconteceram por conveniência do momento?",
      acao: {
        rotulo: "Ver os gastos do mês",
        href: "analises.html#categorias"
      },
      calculo: [ {
        rotulo: "Limite de gasto pequeno",
        valor: x.renda > 0 ? `${pct(p.PEQUENO_PCT_RENDA, 1)} da renda, entre ${moeda(p.PEQUENO_MIN_REAIS)} e ${moeda(p.PEQUENO_MAX_REAIS)}: ${moeda(limite)}` : `sem renda informada: ${moeda(limite)}`
      }, {
        rotulo: `Gastos do dia a dia até esse valor (${p.JANELA_DIAS} dias)`,
        valor: `${pequenos.length}`
      }, {
        rotulo: "Soma",
        valor: moeda(total)
      }, ...pctRenda !== null ? [ {
        rotulo: "Parte da renda",
        valor: `${moeda(total)} ÷ ${moeda(x.renda)} = ${pct(pctRenda, 1)}`
      } ] : [], {
        rotulo: "Fora da conta",
        valor: "contas fixas, parcelas e aportes em metas"
      } ],
      resumo_ia: `${pequenos.length} gastos pequenos (até ${moeda(limite)}) em ${p.JANELA_DIAS} dias somaram ${moeda(total)}${pctRenda !== null ? ` (${pct(pctRenda, 1)} da renda)` : ""}; categorias principais: ${maiores.map(([c]) => c).join(", ") || "várias"}.`
    };
  }

  // O mesmo gasto, com a mesma descrição, várias vezes no período.
  function padraoRepetido(x) {
    const p = P();
    const grupos = new Map;
    x.recentes.forEach(t => {
      const k = normalizar(t.description);
      if (!k) {
        return;
      }
      const g = grupos.get(k) || {
        descricao: String(t.description).trim(),
        categoria: categoriaDe(t),
        itens: []
      };
      g.itens.push(t);
      grupos.set(k, g);
    });
    const g = [ ...grupos.values() ].filter(g => g.itens.length >= p.REPETIDO_MIN_VEZES).sort((a, b) => soma(b.itens) - soma(a.itens))[0];
    if (!g) {
      return null;
    }
    const total = soma(g.itens);
    const media = total / g.itens.length;
    const pctRenda = x.renda > 0 ? total / x.renda * 100 : null;
    return {
      id: "repetido",
      titulo: "Um gasto que se repete",
      texto: `"${g.descricao}" aparece ${vezes(g.itens.length)} nos últimos ${p.JANELA_DIAS} dias: ${moeda(total)} no total, em média ${moeda(media)} por vez${pctRenda !== null ? ` (${pct(pctRenda, 1)} da renda)` : ""}.`,
      categoria: g.categoria,
      base_mensal: total * 30 / p.JANELA_DIAS,
      vezes: g.itens.length,
      pct_renda: pctRenda,
      relevancia: 45 + Math.min(25, g.itens.length * 2),
      certeza: "confirmado",
      simulavel: true,
      reflexao: "Esse gasto faz parte da rotina que você planejou ou foi se repetindo sem você perceber?",
      acao: {
        rotulo: "Ver a categoria",
        href: "analises.html#categorias"
      },
      calculo: [ {
        rotulo: "Registros com a mesma descrição",
        valor: `${g.itens.length} em ${p.JANELA_DIAS} dias`
      }, {
        rotulo: "Soma",
        valor: moeda(total)
      }, {
        rotulo: "Média por vez",
        valor: `${moeda(total)} ÷ ${g.itens.length} = ${moeda(media)}`
      }, {
        rotulo: "Regra",
        valor: `aparece com ${p.REPETIDO_MIN_VEZES} ou mais registros iguais no período`
      } ],
      // A descrição é texto da pessoa: para a IA vai só a categoria.
      resumo_ia: `Um mesmo gasto de ${g.categoria} se repetiu ${g.itens.length} vezes em ${p.JANELA_DIAS} dias, somando ${moeda(total)} (média ${moeda(media)} por vez).`
    };
  }

  // Categoria do dia a dia que cresceu no último mês completo.
  function padroesDeTendencia(x) {
    const p = P();
    const completos = x.completos;
    if (completos.length < 2) {
      return {
        alta: null,
        quedas: []
      };
    }
    const ultimo = completos[completos.length - 1].mes;
    const anteriores = completos.slice(0, -1).map(m => m.mes);
    const minimo = Math.max(p.TENDENCIA_MIN_REAIS, x.renda * .02);
    const linhas = x.porCategoria.map(c => {
      const media = anteriores.reduce((s, m) => s + num(c.valores[m]), 0) / anteriores.length;
      const valor = num(c.valores[ultimo]);
      return {
        nome: c.nome,
        media: media,
        ultimo: valor,
        diferenca: valor - media,
        tendencia: media > 0 ? (valor - media) / media * 100 : null
      };
    });
    const alta = linhas.filter(l => l.tendencia !== null && l.tendencia >= p.TENDENCIA_ALTA_PCT && l.diferenca >= minimo).sort((a, b) => b.diferenca - a.diferenca)[0];
    // Queda é de um hábito que continua, não de um gasto que só não se
    // repetiu: a categoria precisa aparecer em todos os meses comparados.
    const presente = nome => [ ...anteriores, ultimo ].every(m => num(x.porCategoria.find(c => c.nome === nome)?.valores[m]) > 0);
    const quedas = linhas.filter(l => l.tendencia !== null && l.tendencia <= -p.TENDENCIA_QUEDA_PCT && -l.diferenca >= Math.min(minimo, 30) && presente(l.nome)).sort((a, b) => a.diferenca - b.diferenca);
    const quais = anteriores.map(nomeMes).join(" e ");
    return {
      quedas: quedas.map(l => ({
        id: `queda-${normalizar(l.nome)}`,
        categoria: l.nome,
        texto: `${l.nome} caiu de ${moeda(l.media)} por mês (média de ${quais}) para ${moeda(l.ultimo)} em ${nomeMes(ultimo)}: ${moeda(-l.diferenca)} a menos.`,
        resumo_ia: `${l.nome} caiu ${pct(-l.tendencia)} no último mês completo.`
      })),
      alta: alta ? {
        id: "alta",
        titulo: `${alta.nome} em alta`,
        texto: `${alta.nome} subiu de ${moeda(alta.media)} por mês (média de ${quais}) para ${moeda(alta.ultimo)} em ${nomeMes(ultimo)}: ${moeda(alta.diferenca)} a mais (+${pct(alta.tendencia)}).`,
        categoria: alta.nome,
        base_mensal: alta.ultimo,
        pct_renda: x.renda > 0 ? alta.ultimo / x.renda * 100 : null,
        relevancia: 50 + Math.min(35, alta.tendencia / 4),
        certeza: x.completos.length >= 3 ? "confirmado" : "estimativa",
        simulavel: true,
        reflexao: `O que mudou em ${alta.nome} no último mês: foi algo pontual ou um hábito novo?`,
        acao: {
          rotulo: "Ver mês a mês",
          href: "analises.html#mes-a-mes"
        },
        calculo: [ {
          rotulo: `${alta.nome} em ${nomeMes(ultimo)}`,
          valor: moeda(alta.ultimo)
        }, {
          rotulo: `Média de ${quais}`,
          valor: moeda(alta.media)
        }, {
          rotulo: "Diferença",
          valor: `${moeda(alta.ultimo)} − ${moeda(alta.media)} = ${moeda(alta.diferenca)} (+${pct(alta.tendencia)})`
        }, {
          rotulo: "Regra",
          valor: `aparece quando uma categoria do dia a dia sobe ${p.TENDENCIA_ALTA_PCT}% ou mais e pelo menos ${moeda(minimo)}`
        } ],
        resumo_ia: `${alta.nome} subiu ${pct(alta.tendencia)} no último mês completo (de ${moeda(alta.media)} para ${moeda(alta.ultimo)}).`
      } : null
    };
  }

  // A categoria do dia a dia que mais pesa na renda nos últimos 30 dias.
  function padraoPeso(x) {
    const p = P();
    if (!(x.renda > 0)) {
      return null;
    }
    const mapa = new Map;
    x.recentes.forEach(t => {
      const c = categoriaDe(t);
      const atual = mapa.get(c) || {
        total: 0,
        n: 0
      };
      atual.total += num(t.amount);
      atual.n += 1;
      mapa.set(c, atual);
    });
    const [nome, dado] = [ ...mapa.entries() ].sort((a, b) => b[1].total - a[1].total)[0] || [];
    if (!nome) {
      return null;
    }
    const pctRenda = dado.total / x.renda * 100;
    if (pctRenda < p.CATEGORIA_PESO_PCT_RENDA) {
      return null;
    }
    const horas = x.valorHora > 0 ? dado.total / x.valorHora : null;
    return {
      id: "peso",
      titulo: `O peso de ${nome}`,
      texto: `Nos últimos ${p.JANELA_DIAS} dias, seus gastos do dia a dia com ${nome} somaram ${moeda(dado.total)} em ${dado.n} ${dado.n === 1 ? "registro" : "registros"}. É ${pct(pctRenda, 1)} da sua renda${horas !== null ? `, ou ${casa1(horas)} h de trabalho` : ""}.`,
      categoria: nome,
      base_mensal: dado.total * 30 / p.JANELA_DIAS,
      vezes: dado.n,
      pct_renda: pctRenda,
      relevancia: 40 + Math.min(30, pctRenda),
      certeza: "confirmado",
      simulavel: true,
      reflexao: `Esse valor combina com a importância que ${nome} tem para você hoje?`,
      acao: {
        rotulo: "Ver a categoria",
        href: "analises.html#categorias"
      },
      calculo: [ {
        rotulo: `${nome} (${p.JANELA_DIAS} dias, sem contas fixas)`,
        valor: moeda(dado.total)
      }, {
        rotulo: "Parte da renda",
        valor: `${moeda(dado.total)} ÷ ${moeda(x.renda)} = ${pct(pctRenda, 1)}`
      }, {
        rotulo: "Regra",
        valor: `aparece quando uma categoria do dia a dia passa de ${p.CATEGORIA_PESO_PCT_RENDA}% da renda`
      } ],
      resumo_ia: `${nome} somou ${moeda(dado.total)} em ${p.JANELA_DIAS} dias (${pct(pctRenda, 1)} da renda), em ${dado.n} registros.`
    };
  }

  // Quando o dinheiro sai: fim de semana ou logo depois do pagamento. Olha
  // 90 dias, para um mês atípico não decidir sozinho.
  function padraoMomento(x) {
    const p = P();
    const lista = x.longos;
    const total = soma(lista);
    if (lista.length < p.MOMENTO_MIN_GASTOS || !(total > 0)) {
      return null;
    }
    const fds = lista.filter(t => [ 0, 6 ].includes(dia(t.date).getDay()));
    const pctFds = soma(fds) / total * 100;
    const pagamento = Math.min(31, Math.max(1, num(x.perfil?.payday) || cfg.PADRAO.payday));
    const depoisDoPagamento = t => {
      const d = dia(t.date).getDate();
      const desde = (d - pagamento + 31) % 31;
      return desde < p.POS_PAGAMENTO_DIAS;
    };
    const pos = lista.filter(depoisDoPagamento);
    const pctPos = soma(pos) / total * 100;
    const excessoFds = pctFds - p.FIM_DE_SEMANA_PCT;
    const excessoPos = pctPos - p.POS_PAGAMENTO_PCT;
    if (excessoFds < 0 && excessoPos < 0) {
      return null;
    }
    const base = {
      id: "momento",
      categoria: null,
      base_mensal: null,
      relevancia: 45,
      certeza: x.confianca.nivel === "consistente" ? "confirmado" : "estimativa",
      simulavel: false,
      acao: {
        rotulo: "Ver os gastos",
        href: "analises.html#categorias"
      }
    };
    if (excessoFds >= excessoPos) {
      return {
        ...base,
        titulo: "O fim de semana concentra os gastos",
        texto: `Nos últimos ${p.JANELA_LONGA_DIAS} dias, ${pct(pctFds)} dos gastos do dia a dia (${moeda(soma(fds))} de ${moeda(total)}) aconteceram no sábado ou no domingo, que são 29% dos dias.`,
        valor_periodo: soma(fds),
        reflexao: "Decidir um valor para o fim de semana antes de ele começar mudaria alguma coisa?",
        calculo: [ {
          rotulo: `Gastos do dia a dia (${p.JANELA_LONGA_DIAS} dias)`,
          valor: `${lista.length}, somando ${moeda(total)}`
        }, {
          rotulo: "No sábado ou domingo",
          valor: `${fds.length}, somando ${moeda(soma(fds))}`
        }, {
          rotulo: "Parte do total",
          valor: `${moeda(soma(fds))} ÷ ${moeda(total)} = ${pct(pctFds)}`
        }, {
          rotulo: "Regra",
          valor: `aparece acima de ${p.FIM_DE_SEMANA_PCT}%`
        } ],
        resumo_ia: `${pct(pctFds)} dos gastos do dia a dia em ${p.JANELA_LONGA_DIAS} dias foram no fim de semana.`
      };
    }
    return {
      ...base,
      titulo: "Os gastos se concentram depois do pagamento",
      texto: `Nos ${p.POS_PAGAMENTO_DIAS} dias que seguem o pagamento (dia ${pagamento}), sai ${pct(pctPos)} do que você gasta no dia a dia: ${moeda(soma(pos))} de ${moeda(total)} nos últimos ${p.JANELA_LONGA_DIAS} dias.`,
      valor_periodo: soma(pos),
      reflexao: "Separar a parte das metas no dia do pagamento, antes dos outros gastos, mudaria o seu mês?",
      calculo: [ {
        rotulo: `Gastos do dia a dia (${p.JANELA_LONGA_DIAS} dias)`,
        valor: `${lista.length}, somando ${moeda(total)}`
      }, {
        rotulo: `Do dia ${pagamento} aos ${p.POS_PAGAMENTO_DIAS - 1} dias seguintes`,
        valor: `${pos.length}, somando ${moeda(soma(pos))}`
      }, {
        rotulo: "Parte do total",
        valor: `${moeda(soma(pos))} ÷ ${moeda(total)} = ${pct(pctPos)}`
      }, {
        rotulo: "Regra",
        valor: `aparece acima de ${p.POS_PAGAMENTO_PCT}%`
      } ],
      resumo_ia: `${pct(pctPos)} dos gastos do dia a dia saem nos ${p.POS_PAGAMENTO_DIAS} dias depois do pagamento.`
    };
  }

  // O que já tem destino todo mês: contas fixas e parcelas, antes de
  // qualquer gasto do dia a dia.
  function padraoCompromissos(x) {
    const p = P();
    const fixas = (x.ctx.recorrentes || []).filter(r => r.type === "saida" && r.active !== false);
    const totalFixas = fixas.reduce((s, r) => s + num(r.amount), 0);
    const parcelas = window.FinckDiagnostico ? window.FinckDiagnostico.parcelasMensais(x.ctx.parcelamentos) : 0;
    const total = totalFixas + parcelas;
    if (!(x.renda > 0) || !(total > 0)) {
      return null;
    }
    const pctRenda = total / x.renda * 100;
    const pequenas = fixas.filter(r => num(r.amount) > 0 && num(r.amount) <= p.CONTA_PEQUENA_MAX_REAIS);
    const somaPequenas = pequenas.reduce((s, r) => s + num(r.amount), 0);
    if (pctRenda < p.COMPROMISSOS_ATENCAO_PCT && pequenas.length < 2) {
      return null;
    }
    const nomes = pequenas.slice(0, 4).map(r => String(r.description || "").trim()).filter(Boolean);
    return {
      id: "compromissos",
      titulo: "O que já tem destino todo mês",
      texto: `Contas fixas${parcelas > 0 ? " e parcelas" : ""} somam ${moeda(total)} por mês, ${pct(pctRenda)} da renda, antes de qualquer gasto do dia a dia.${pequenas.length >= 2 ? ` Entre elas, ${pequenas.length} contas de até ${moeda(p.CONTA_PEQUENA_MAX_REAIS)}${nomes.length ? ` (${nomes.join(", ")})` : ""} somam ${moeda(somaPequenas)} por mês, ${moeda(somaPequenas * 12)} por ano.` : ""}`,
      categoria: null,
      base_mensal: pequenas.length >= 2 ? somaPequenas : null,
      pct_renda: pctRenda,
      relevancia: pctRenda >= 70 ? 80 : pctRenda >= p.COMPROMISSOS_ATENCAO_PCT ? 60 : 38,
      certeza: "confirmado",
      simulavel: false,
      reflexao: "Todas essas contas ainda fazem sentido para você hoje?",
      acao: {
        rotulo: "Revisar recorrentes",
        href: "recorrentes.html"
      },
      calculo: [ {
        rotulo: "Contas fixas cadastradas",
        valor: `${fixas.length}, somando ${moeda(totalFixas)}`
      }, ...parcelas > 0 ? [ {
        rotulo: "Parcelas por mês",
        valor: moeda(parcelas)
      } ] : [], {
        rotulo: "Parte da renda",
        valor: `${moeda(total)} ÷ ${moeda(x.renda)} = ${pct(pctRenda)}`
      }, ...pequenas.length >= 2 ? [ {
        rotulo: `Contas de até ${moeda(p.CONTA_PEQUENA_MAX_REAIS)}`,
        valor: `${moeda(somaPequenas)} × 12 = ${moeda(somaPequenas * 12)} por ano`
      } ] : [] ],
      resumo_ia: `Contas fixas e parcelas: ${moeda(total)} por mês (${pct(pctRenda)} da renda); ${pequenas.length} contas fixas pequenas somam ${moeda(somaPequenas)} por mês.`
    };
  }

  // A sobra do mês (entradas menos gastos) nos meses completos.
  function padraoSobra(x) {
    const c = x.completos;
    if (c.length < 2) {
      return {
        padrao: null,
        positivo: null
      };
    }
    const ultimo = c[c.length - 1];
    const anteriores = c.slice(0, -1);
    const media = anteriores.reduce((s, m) => s + m.sobra, 0) / anteriores.length;
    const margem = x.renda > 0 ? x.renda * .05 : 100;
    const lista = c.map(m => `${m.rotulo}: ${moeda(m.sobra)}`).join("; ");
    const calculo = [ ...c.map(m => ({
      rotulo: `Sobra em ${m.rotulo}`,
      valor: `${moeda(m.entradas)} − ${moeda(m.gastos)} = ${moeda(m.sobra)}`
    })), {
      rotulo: "Sobra",
      valor: "o que entrou menos o que foi gasto; aportes em metas contam como sobra guardada"
    } ];
    if (ultimo.sobra < 0 || ultimo.sobra < media - margem) {
      return {
        positivo: null,
        padrao: {
          id: "sobra",
          titulo: ultimo.sobra < 0 ? "O último mês fechou no vermelho" : "A sobra do mês diminuiu",
          texto: ultimo.sobra < 0 ? `Em ${ultimo.rotulo}, os gastos passaram do que entrou em ${moeda(-ultimo.sobra)}. Nos meses anteriores, a sobra foi de ${anteriores.map(m => `${moeda(m.sobra)} em ${m.rotulo}`).join(" e ")}.` : `Em ${ultimo.rotulo} sobraram ${moeda(ultimo.sobra)}, abaixo da média de ${moeda(media)} dos meses anteriores.`,
          categoria: null,
          base_mensal: null,
          pct_renda: null,
          relevancia: ultimo.sobra < 0 ? 90 : 70,
          certeza: "confirmado",
          simulavel: false,
          reflexao: "O que pesou mais no último mês: um gasto pontual ou vários pequenos?",
          acao: {
            rotulo: "Ver mês a mês",
            href: "analises.html#mes-a-mes"
          },
          calculo: calculo,
          resumo_ia: `Sobra por mês nos meses completos: ${lista}.`
        }
      };
    }
    if (ultimo.sobra > 0 && ultimo.sobra > media + margem) {
      return {
        padrao: null,
        positivo: {
          id: "sobra-subiu",
          texto: `A sobra de ${ultimo.rotulo} (${moeda(ultimo.sobra)}) ficou acima da média dos meses anteriores (${moeda(media)}).`,
          resumo_ia: `A sobra do último mês subiu para ${moeda(ultimo.sobra)}.`
        }
      };
    }
    return {
      padrao: null,
      positivo: null
    };
  }

  // ODS 12: itens duráveis comprados com frequência. Comprar menos vezes,
  // consertar, trocar ou comprar usado reduz o que é produzido e descartado.
  function padraoDuraveis(x) {
    const p = P();
    const duraveis = new Set(p.DURAVEIS);
    const grupos = new Map;
    x.longos.filter(t => duraveis.has(categoriaDe(t))).forEach(t => {
      const c = categoriaDe(t);
      grupos.set(c, [ ...grupos.get(c) || [], t ]);
    });
    const [nome, itens] = [ ...grupos.entries() ].sort((a, b) => b[1].length - a[1].length || soma(b[1]) - soma(a[1]))[0] || [];
    if (!nome || itens.length < p.DURAVEIS_MIN_COMPRAS) {
      return null;
    }
    const total = soma(itens);
    return {
      id: "duraveis",
      titulo: `Compras frequentes de ${nome}`,
      texto: `Em ${p.JANELA_LONGA_DIAS} dias foram ${itens.length} compras de ${nome}, somando ${moeda(total)}. Itens que duram anos podem ser consertados, trocados, comprados usados ou passados adiante quando ficam parados.`,
      categoria: nome,
      base_mensal: total * 30 / p.JANELA_LONGA_DIAS,
      vezes: itens.length,
      pct_renda: x.renda > 0 ? total * 30 / p.JANELA_LONGA_DIAS / x.renda * 100 : null,
      relevancia: 50,
      certeza: "confirmado",
      simulavel: true,
      ods12: true,
      reflexao: "Algum desses itens poderia ter sido consertado, trocado ou comprado usado?",
      acao: {
        rotulo: "Conserto, usado e troca perto de você",
        href: "locais.html"
      },
      calculo: [ {
        rotulo: `Compras de ${nome} (${p.JANELA_LONGA_DIAS} dias)`,
        valor: `${itens.length}, somando ${moeda(total)}`
      }, {
        rotulo: "Média por mês",
        valor: `${moeda(total)} ÷ ${casa1(p.JANELA_LONGA_DIAS / 30)} = ${moeda(total * 30 / p.JANELA_LONGA_DIAS)}`
      }, {
        rotulo: "Regra",
        valor: `aparece com ${p.DURAVEIS_MIN_COMPRAS} ou mais compras de ${p.DURAVEIS.join(" ou ")} no período`
      } ],
      resumo_ia: `${itens.length} compras de ${nome} (bem durável) em ${p.JANELA_LONGA_DIAS} dias, somando ${moeda(total)}.`
    };
  }

  // ------------------------------------------------------------ análise

  function analisar(ctx = {}, {hoje: hoje = new Date} = {}) {
    const p = P();
    const agora = meioDia(hoje);
    const perfil = ctx.perfil || {};
    const renda = num(perfil.income_monthly);
    const diasMes = num(perfil.work_days_month) || cfg.PADRAO.work_days_month;
    const horasDia = num(perfil.work_hours_day) || cfg.PADRAO.work_hours_day;
    const valorHora = renda > 0 ? renda / diasMes / horasDia : 0;
    const C = classificador(ctx);
    const realizadas = realizadasAte(ctx, agora);
    const gastos = realizadas.filter(C.ehGasto);
    const diaADia = realizadas.filter(C.ehDiaADia);
    const confianca = confiancaDe(realizadas, gastos, agora);
    const serie = serieMensal(realizadas, C, agora, p.MESES_COMPARADOS);
    const completos = serie.filter(m => !m.parcial && m.com_registros);
    const chaves = serie.map(m => m.mes);
    const x = {
      ctx: ctx,
      perfil: perfil,
      renda: renda,
      valorHora: valorHora,
      confianca: confianca,
      completos: completos,
      recentes: ultimosDias(diaADia, agora, p.JANELA_DIAS),
      longos: ultimosDias(diaADia, agora, p.JANELA_LONGA_DIAS),
      porCategoria: categoriasPorMes(diaADia, chaves)
    };
    const tendencia = padroesDeTendencia(x);
    const sobra = padraoSobra(x);
    let padroes = [];
    if (confianca.nivel !== "insuficiente") {
      padroes = [ padraoPequenos(x), padraoRepetido(x), tendencia.alta, padraoPeso(x), padraoMomento(x), padraoCompromissos(x), sobra.padrao, padraoDuraveis(x) ].filter(Boolean);
    } else {
      padroes = [ padraoCompromissos(x) ].filter(Boolean);
    }
    // A mesma categoria não aparece duas vezes com o mesmo número: a alta
    // diz mais que o peso.
    if (padroes.some(q => q.id === "alta") && padroes.some(q => q.id === "peso")) {
      const alta = padroes.find(q => q.id === "alta");
      padroes = padroes.filter(q => !(q.id === "peso" && q.categoria === alta.categoria));
    }
    // Com pouco histórico, tudo o que compara períodos vira estimativa.
    if (confianca.nivel === "inicial") {
      padroes.forEach(q => {
        q.certeza = "estimativa";
      });
    }
    // O efeito acumulado vale para hábitos que se repetem; o peso de uma
    // categoria inteira (com o mercado do mês, por exemplo) não é projetado.
    padroes.forEach(q => {
      q.acumulado_12m = q.base_mensal && q.id !== "peso" ? arred(q.base_mensal * 12) : null;
      q.horas_mes = q.base_mensal && valorHora > 0 ? arred(q.base_mensal / valorHora, 1) : null;
    });
    padroes.sort((a, b) => b.relevancia - a.relevancia);
    let escolhidos = padroes.slice(0, p.MAX_PADROES);
    // O ODS 12 não sai da lista por falta de espaço: a troca frequente de
    // itens duráveis entra no lugar do último.
    const duraveis = padroes.find(q => q.ods12);
    if (duraveis && !escolhidos.includes(duraveis)) {
      escolhidos = [ ...escolhidos.slice(0, p.MAX_PADROES - 1), duraveis ];
    }
    // Uma categoria que já aparece como ponto de atenção não aparece de novo
    // como melhora, mesmo que um mês tenha caído.
    const comAtencao = new Set(escolhidos.map(q => q.categoria).filter(Boolean));
    const positivos = [ ...tendencia.quedas.filter(q => !comAtencao.has(q.categoria)).slice(0, 2), sobra.positivo, ...positivosExtras(ctx, agora, completos) ].filter(Boolean);
    const ultimoMes = completos[completos.length - 1]?.mes || null;
    const categorias = x.porCategoria.map(c => ({
      nome: c.nome,
      valores: c.valores,
      ultimo: ultimoMes ? num(c.valores[ultimoMes]) : 0,
      total: Object.values(c.valores).reduce((s, v) => s + v, 0)
    })).sort((a, b) => b.total - a.total);
    return {
      gerado_em: agora.toISOString(),
      renda: renda,
      valor_hora: valorHora,
      confianca: confianca,
      meses: serie,
      meses_completos: completos.length,
      categorias: categorias,
      padroes: escolhidos,
      positivos: positivos,
      dia_a_dia_30: soma(x.recentes),
      resumo: resumoDe(escolhidos, confianca)
    };
  }

  function positivosExtras(ctx, hoje, completos) {
    const lista = [];
    const R = window.FinckReality;
    const limite = new Date(hoje.getTime() - P().JANELA_LONGA_DIAS * 864e5);
    const recentes = (ctx.analises || []).filter(a => new Date(a.analyzed_at || a.created_at || 0) >= limite);
    if (recentes.length) {
      const pensadas = recentes.filter(a => a.decision && (a.decision !== "comprar" || R?.compraPlanejada?.(a)));
      lista.push({
        id: "analises",
        texto: `Nos últimos ${P().JANELA_LONGA_DIAS} dias, você analisou ${recentes.length} ${recentes.length === 1 ? "compra" : "compras"} antes de decidir${pensadas.length ? `, e em ${pensadas.length} a escolha foi esperar, buscar alternativa, não comprar ou comprar o que estava planejado` : ""}.`,
        resumo_ia: `${recentes.length} compras analisadas antes de decidir em ${P().JANELA_LONGA_DIAS} dias.`
      });
    }
    const aportes = completos.reduce((s, m) => s + m.aportes, 0);
    if (aportes > 0) {
      lista.push({
        id: "aportes",
        texto: `Nos últimos ${completos.length} ${completos.length === 1 ? "mês" : "meses"} completos, ${moeda(aportes)} foram para as suas metas.`,
        resumo_ia: `${moeda(aportes)} guardados em metas nos meses completos.`
      });
    }
    return lista;
  }

  function resumoDe(padroes, confianca) {
    if (confianca.nivel === "insuficiente" && !padroes.length) {
      return confianca.texto;
    }
    if (!padroes.length) {
      return "Nenhum padrão chamou atenção nos seus registros recentes.";
    }
    return `${padroes.length === 1 ? "Um padrão merece" : `${padroes.length} padrões merecem`} atenção. O primeiro: ${padroes[0].titulo.charAt(0).toLowerCase()}${padroes[0].titulo.slice(1)}.`;
  }

  // ------------------------------------------------------------ simulação

  // Meta de referência para as simulações: a que está em andamento com o
  // prazo mais próximo (ou a primeira sem prazo).
  function metaDeReferencia(ctx = {}, {hoje: hoje = new Date} = {}) {
    const M = window.FinckMetas;
    const abertas = (ctx.metas || []).filter(m => num(m.current_amount) < num(m.target_amount));
    if (!abertas.length) {
      return null;
    }
    const ordenadas = abertas.slice().sort((a, b) => String(a.deadline || "9999").localeCompare(String(b.deadline || "9999")));
    const m = ordenadas[0];
    return {
      id: m.id,
      nome: m.name,
      falta: num(m.target_amount) - num(m.current_amount),
      ritmo: M ? M.ritmoMensal(ctx.movimentosMeta || [], m.id, {
        hoje: hoje
      }) : 0
    };
  }

  // O que muda se um valor mensal diminuir 10%, 15% ou 20%. É uma
  // possibilidade matemática, não uma recomendação: a tela diz isso.
  function simular(baseMensal, {pcts: pcts = P().SIMULACOES_PCT, meta: meta = null, valorHora: valorHora = 0} = {}) {
    const base = Math.max(0, num(baseMensal));
    return pcts.map(pc => {
      const mensal = arred(base * pc / 100);
      const r = {
        pct: pc,
        mensal: mensal,
        seis_meses: arred(mensal * 6),
        doze_meses: arred(mensal * 12),
        horas_mes: valorHora > 0 ? arred(mensal / valorHora, 1) : null,
        meta: null
      };
      if (meta && meta.falta > 0 && mensal > 0) {
        const atual = meta.ritmo > 0 ? meta.falta / meta.ritmo : null;
        const novo = meta.falta / (num(meta.ritmo) + mensal);
        r.meta = {
          nome: meta.nome,
          meses_atual: atual === null ? null : arred(atual, 1),
          meses_novo: arred(novo, 1),
          meses_a_menos: atual === null ? null : arred(atual - novo, 1)
        };
      }
      return r;
    });
  }

  // ------------------------------------------------------------ Reality

  // A compra em análise dentro do histórico da mesma categoria: quanto já
  // saiu no mês, a média dos meses completos e as compras parecidas já
  // analisadas. Só fatos registrados; a comparação com a média é estimativa
  // quando há poucos meses.
  function historicoDaCategoria(ctx = {}, categoria, preco, {hoje: hoje = new Date} = {}) {
    const p = P();
    const agora = meioDia(hoje);
    const C = classificador(ctx);
    const cat = categoria || "Outros";
    const realizadas = realizadasAte(ctx, agora).filter(t => C.ehGasto(t) && categoriaDe(t) === cat);
    const mesAtual = chaveMes(agora);
    const doMes = realizadas.filter(t => String(t.date || "").slice(0, 7) === mesAtual);
    const noMes = soma(doMes);
    const completos = [];
    for (let i = 1; i <= p.MESES_COMPARADOS; i++) {
      const chave = chaveMes(new Date(agora.getFullYear(), agora.getMonth() - i, 1, 12));
      completos.push({
        mes: chave,
        valor: soma(realizadas.filter(t => String(t.date || "").slice(0, 7) === chave))
      });
    }
    const todas = realizadasAte(ctx, agora);
    const mesesComRegistro = completos.filter(m => todas.some(t => String(t.date || "").slice(0, 7) === m.mes));
    const media = mesesComRegistro.length ? mesesComRegistro.reduce((s, m) => s + m.valor, 0) / mesesComRegistro.length : null;
    const noventa = ultimosDias(realizadas, agora, p.JANELA_LONGA_DIAS);
    const limite = new Date(agora.getTime() - p.JANELA_LONGA_DIAS * 864e5);
    const analisadas = (ctx.analises || []).filter(a => a.category === cat && new Date(a.analyzed_at || a.created_at || 0) >= limite);
    const rotuloDecisao = id => (cfg.DECISOES.find(d => d.id === id)?.label || "Sem decisão").toLowerCase();
    const porDecisao = new Map;
    analisadas.forEach(a => porDecisao.set(rotuloDecisao(a.decision), (porDecisao.get(rotuloDecisao(a.decision)) || 0) + 1));
    const comCompra = noMes + num(preco);
    const acimaDaMedia = media !== null && media > 0 ? comCompra - media : null;
    const linhas = [ {
      rotulo: `${cat} neste mês, até hoje`,
      valor: `${moeda(noMes)} em ${doMes.length} ${doMes.length === 1 ? "registro" : "registros"}`
    }, {
      rotulo: "Com esta compra",
      valor: `${moeda(noMes)} + ${moeda(preco)} = ${moeda(comCompra)}`
    } ];
    if (media !== null) {
      linhas.push({
        rotulo: `Média por mês (${mesesComRegistro.length} ${mesesComRegistro.length === 1 ? "mês completo" : "meses completos"})`,
        valor: moeda(media)
      });
    }
    linhas.push({
      rotulo: `Últimos ${p.JANELA_LONGA_DIAS} dias`,
      valor: `${noventa.length} ${noventa.length === 1 ? "compra" : "compras"}, ${moeda(soma(noventa))}`
    });
    if (analisadas.length) {
      linhas.push({
        rotulo: "Analisadas no FinCK of Reality",
        valor: [ ...porDecisao.entries() ].map(([d, n]) => `${n} ${d}`).join(", ")
      });
    }
    let texto;
    if (!noventa.length && !noMes) {
      texto = `Nenhum gasto em ${cat} registrado nos últimos ${p.JANELA_LONGA_DIAS} dias: esta seria a primeira compra da categoria no período.`;
    } else {
      const parteMes = noMes > 0 ? `Em ${cat}, você já gastou ${moeda(noMes)} este mês (${doMes.length} ${doMes.length === 1 ? "registro" : "registros"}). Com esta compra, o mês chegaria a ${moeda(comCompra)}` : `Ainda não há gastos em ${cat} este mês. Com esta compra, o mês chegaria a ${moeda(comCompra)}`;
      const parteMedia = acimaDaMedia === null ? "." : acimaDaMedia > 0 ? `, ${moeda(acimaDaMedia)} acima da sua média mensal na categoria (${moeda(media)}).` : `, dentro da sua média mensal na categoria (${moeda(media)}).`;
      texto = `${parteMes}${parteMedia}`;
    }
    const extra = noventa.length >= 2 ? `Nos últimos ${p.JANELA_LONGA_DIAS} dias foram ${noventa.length} compras nesta categoria, somando ${moeda(soma(noventa))}.` : "";
    // ODS 12: em itens duráveis, a frequência de troca também conta.
    const duravel = (p.DURAVEIS || []).includes(cat);
    const ods12 = duravel && noventa.length + 1 >= p.DURAVEIS_MIN_COMPRAS ? `Com esta, seriam ${noventa.length + 1} compras de ${cat} em ${p.JANELA_LONGA_DIAS} dias. Itens duráveis podem ser consertados, trocados, comprados usados ou passados adiante quando ficam parados.` : null;
    return {
      categoria: cat,
      no_mes: noMes,
      registros_no_mes: doMes.length,
      com_compra: comCompra,
      media_mensal: media,
      meses_na_media: mesesComRegistro.length,
      acima_da_media: acimaDaMedia,
      noventa_dias: {
        compras: noventa.length,
        total: soma(noventa)
      },
      analisadas: analisadas.length,
      texto: texto,
      extra: extra,
      ods12: ods12,
      certeza: mesesComRegistro.length >= p.MESES_COMPARADOS ? "confirmado" : "estimativa",
      calculo: linhas
    };
  }

  // Mesmo período do mês anterior (do dia 1 até o dia de hoje): compara
  // gastos sem misturar um mês inteiro com um pela metade.
  function comparacaoMesAnterior(ctx = {}, {hoje: hoje = new Date} = {}) {
    const agora = meioDia(hoje);
    const C = classificador(ctx);
    const todas = realizadasAte(ctx, agora);
    const gastos = todas.filter(C.ehGasto);
    const diaHoje = agora.getDate();
    const anterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1, 12);
    const ultimoDiaAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0).getDate();
    const ate = Math.min(diaHoje, ultimoDiaAnterior);
    const mesAnterior = chaveMes(anterior);
    if (!todas.some(t => String(t.date || "").slice(0, 7) === mesAnterior)) {
      return null;
    }
    const doMes = (mes, limiteDia) => soma(gastos.filter(t => String(t.date || "").slice(0, 7) === mes && dia(t.date).getDate() <= limiteDia));
    const atual = doMes(chaveMes(agora), diaHoje);
    const antes = doMes(mesAnterior, ate);
    const diferenca = atual - antes;
    const pc = antes > 0 ? diferenca / antes * 100 : null;
    const igual = Math.abs(diferenca) < Math.max(1, antes * .03);
    return {
      atual: atual,
      anterior: antes,
      diferenca: diferenca,
      pct: pc,
      ate_dia: ate,
      mes_anterior: nomeMes(mesAnterior),
      texto: igual ? `Quase igual ao mesmo período de ${nomeMes(mesAnterior)} (${moeda(antes)}).` : `${moeda(Math.abs(diferenca))} a ${diferenca > 0 ? "mais" : "menos"} que no mesmo período de ${nomeMes(mesAnterior)} (${moeda(antes)}).`
    };
  }

  // ------------------------------------------------------------ para a IA

  // O que vai para a IA quando a pessoa pede uma explicação: números
  // agregados, categorias e o resumo de cada padrão. Nenhuma descrição de
  // lançamento, conta ou nome de meta.
  function paraIA(h) {
    if (!h) {
      return null;
    }
    return {
      confianca: h.confianca.nivel,
      dias_de_historico: h.confianca.dias,
      meses: h.meses.filter(m => m.com_registros).map(m => ({
        mes: m.mes,
        parcial: m.parcial,
        entradas: arred(m.entradas),
        gastos: arred(m.gastos),
        dia_a_dia: arred(m.dia_a_dia),
        guardado_em_metas: arred(m.aportes),
        sobra: arred(m.sobra)
      })),
      padroes: h.padroes.map(q => ({
        id: q.id,
        categoria: q.categoria || null,
        valor_mensal: q.base_mensal ? arred(q.base_mensal) : null,
        acumulado_12_meses: q.acumulado_12m,
        pct_renda: q.pct_renda === null || q.pct_renda === undefined ? null : arred(q.pct_renda, 1),
        vezes: q.vezes || null,
        certeza: q.certeza,
        ods12: Boolean(q.ods12),
        resumo: q.resumo_ia
      })),
      positivos: h.positivos.map(x => x.resumo_ia).filter(Boolean)
    };
  }

  // Os mesmos padrões em texto, para a rota geral (api/ia.js).
  function contexto(h) {
    const r = paraIA(h);
    if (!r) {
      return "";
    }
    const linhas = [ `Hábitos de consumo calculados pelo FinCK com ${r.dias_de_historico} dias de registros (leitura ${r.confianca}). Valores em reais. Descrições de lançamentos, contas e metas não são enviadas.` ];
    if (r.meses.length) {
      linhas.push(`Meses: ${r.meses.map(m => `${m.mes}${m.parcial ? " (em andamento)" : ""}: entradas ${moeda(m.entradas)}, gastos ${moeda(m.gastos)} (dia a dia ${moeda(m.dia_a_dia)}), guardado ${moeda(m.guardado_em_metas)}, sobra ${moeda(m.sobra)}`).join("; ")}.`);
    }
    r.padroes.forEach((q, i) => linhas.push(`Padrão ${i + 1} (${q.id}${q.ods12 ? ", ODS 12" : ""}, ${q.certeza === "estimativa" ? "estimativa" : "dado registrado"}): ${q.resumo}${q.acumulado_12_meses ? ` Mantido o ritmo, cerca de ${moeda(q.acumulado_12_meses)} em 12 meses (estimativa).` : ""}`));
    if (!r.padroes.length) {
      linhas.push("Nenhum padrão chamou atenção.");
    }
    if (r.positivos.length) {
      linhas.push(`O que melhorou: ${r.positivos.join(" ")}`);
    }
    return linhas.join("\n");
  }

  // O hábito de consumo que mais pesa, para o resumo da home. A sobra do mês
  // e as contas fixas ficam na Revisão financeira; aqui vai um hábito.
  const DE_CONSUMO = new Set([ "pequenos", "repetido", "alta", "peso", "momento", "duraveis" ]);
  const habitoPrincipal = h => (h?.padroes || []).find(q => DE_CONSUMO.has(q.id)) || null;

  return {
    classificador: classificador,
    habitoPrincipal: habitoPrincipal,
    analisar: analisar,
    simular: simular,
    metaDeReferencia: metaDeReferencia,
    historicoDaCategoria: historicoDaCategoria,
    comparacaoMesAnterior: comparacaoMesAnterior,
    paraIA: paraIA,
    contexto: contexto
  };
})();
