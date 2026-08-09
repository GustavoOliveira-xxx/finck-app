/* ============================================================
   FinCK — planejamento-engine.js
   Parcelas, orçamento por categoria, calendário e projeção.

   Só cálculo puro: recebe dados, devolve dados. Nada aqui toca o
   DOM nem o banco, o que deixa tudo testável em testes.html.
   ============================================================ */

window.FinckPlano = (() => {
  const cfg = window.FINCK_CONFIG;

  const num = (v) => Number(v || 0);
  const chaveMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const somarMeses = (data, n) => {
    const d = new Date(data.getFullYear(), data.getMonth() + n, 1);
    // preserva o dia, recuando quando o mês é mais curto (31 -> 30 -> 28)
    const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(data.getDate(), ultimoDia));
    return d;
  };
  const paraData = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`);

  /* ============================================================
     1. PARCELAS
     ============================================================ */

  /**
   * Divide um total em parcelas sem perder centavo.
   * 100 em 3x não é 33,33 três vezes: a diferença vai na última.
   */
  function dividirParcelas(total, quantidade) {
    const t = Math.round(num(total) * 100);
    const q = Math.max(1, Math.floor(num(quantidade)));
    const base = Math.floor(t / q);
    const sobra = t - base * q;
    return Array.from({ length: q }, (_, i) => (base + (i === q - 1 ? sobra : 0)) / 100);
  }

  /** Valor sugerido de parcela (o app grava; a última absorve a diferença). */
  const valorParcela = (total, quantidade) => dividirParcelas(total, quantidade)[0];

  /**
   * Cronograma completo de um parcelamento.
   * @returns [{ numero, valor, vencimento, mes, paga }]
   */
  function cronograma(parcelamento) {
    const q = Math.max(1, num(parcelamento.installments_count));
    const valores = dividirParcelas(parcelamento.total_amount, q);
    const inicio = paraData(parcelamento.first_due_date);
    const pagas = num(parcelamento.paid_count);

    return valores.map((valor, i) => {
      const venc = somarMeses(inicio, i);
      return {
        numero: i + 1,
        valor,
        vencimento: venc,
        mes: chaveMes(venc),
        paga: i < pagas,
      };
    });
  }

  /** Quanto ainda falta pagar de um parcelamento. */
  function saldoDevedor(p) {
    return cronograma(p).filter((c) => !c.paga).reduce((s, c) => s + c.valor, 0);
  }

  /**
   * Soma das parcelas que caem em cada mês, para os próximos N meses.
   * @returns { "2026-08": 430.5, "2026-09": 430.5, ... }
   */
  function parcelasPorMes(parcelamentos, meses = 12, hoje = new Date()) {
    const mapa = {};
    for (let i = 0; i < meses; i++) mapa[chaveMes(somarMeses(hoje, i))] = 0;

    parcelamentos
      .filter((p) => p.active !== false)
      .forEach((p) => {
        cronograma(p).forEach((c) => {
          if (c.paga) return;
          if (mapa[c.mes] !== undefined) mapa[c.mes] += c.valor;
        });
      });

    return mapa;
  }

  /* ============================================================
     2. ORÇAMENTO POR CATEGORIA
     ============================================================ */

  /**
   * Cruza tetos definidos com o que já foi gasto no mês.
   * @returns [{ categoria, limite, gasto, restante, percentual, situacao }]
   *   situacao: "tranquilo" | "atencao" (>=75%) | "estourado" (>100%)
   */
  function situacaoOrcamento(tetos, transacoes, mes = chaveMes(new Date())) {
    const gastoPorCategoria = {};
    transacoes
      .filter((t) => t.type === "saida" && String(t.date || "").slice(0, 7) === mes)
      .forEach((t) => {
        const c = t.category || "Outros";
        gastoPorCategoria[c] = (gastoPorCategoria[c] || 0) + num(t.amount);
      });

    return tetos
      .map((t) => {
        const limite = num(t.limit_amount);
        const gasto = gastoPorCategoria[t.category] || 0;
        const percentual = limite > 0 ? (gasto / limite) * 100 : 0;
        return {
          id: t.id,
          categoria: t.category,
          limite,
          gasto,
          restante: limite - gasto,
          percentual,
          situacao: percentual > 100 ? "estourado" : percentual >= 75 ? "atencao" : "tranquilo",
        };
      })
      .sort((a, b) => b.percentual - a.percentual);
  }

  /** Categorias com gasto no mês que ainda não têm teto definido. */
  function categoriasSemTeto(tetos, transacoes, mes = chaveMes(new Date())) {
    const comTeto = new Set(tetos.map((t) => t.category));
    const vistas = new Set(
      transacoes
        .filter((t) => t.type === "saida" && String(t.date || "").slice(0, 7) === mes)
        .map((t) => t.category || "Outros")
    );
    return [...vistas].filter((c) => !comTeto.has(c));
  }

  /* ============================================================
     3. CALENDÁRIO DO MÊS
     ============================================================ */

  /**
   * Todos os compromissos de um mês, dia a dia.
   * Junta recorrentes (dia fixo), parcelas (vencimento) e o que já
   * foi lançado — o painel mostra totais, mas não mostra *quando*,
   * que é o que decide se a conta fura antes do salário cair.
   *
   * @returns Map<numeroDoDia, [{ tipo, titulo, valor, sinal }]>
   */
  function eventosDoMes({ recorrentes = [], parcelamentos = [], transacoes = [] }, mes = chaveMes(new Date())) {
    const [ano, mesNum] = mes.split("-").map(Number);
    const diasNoMes = new Date(ano, mesNum, 0).getDate();
    const porDia = new Map();

    const add = (dia, evento) => {
      const d = Math.min(Math.max(1, dia), diasNoMes);
      if (!porDia.has(d)) porDia.set(d, []);
      porDia.get(d).push(evento);
    };

    recorrentes
      .filter((r) => r.active !== false)
      .forEach((r) =>
        add(num(r.day_of_month), {
          tipo: "recorrente",
          titulo: r.description,
          valor: num(r.amount),
          sinal: r.type === "entrada" ? 1 : -1,
        })
      );

    parcelamentos
      .filter((p) => p.active !== false)
      .forEach((p) =>
        cronograma(p)
          .filter((c) => c.mes === mes && !c.paga)
          .forEach((c) =>
            add(c.vencimento.getDate(), {
              tipo: "parcela",
              titulo: `${p.description} (${c.numero}/${p.installments_count})`,
              valor: c.valor,
              sinal: -1,
            })
          )
      );

    transacoes
      .filter((t) => String(t.date || "").slice(0, 7) === mes)
      .forEach((t) =>
        add(Number(String(t.date).slice(8, 10)), {
          tipo: "lancamento",
          titulo: t.description,
          valor: num(t.amount),
          sinal: t.type === "entrada" ? 1 : -1,
        })
      );

    return porDia;
  }

  /* ============================================================
     4. PROJEÇÃO DE SALDO
     ============================================================ */

  /**
   * Saldo previsto ao fim de cada um dos próximos N meses.
   *
   * Parte do saldo de hoje e aplica, mês a mês, as entradas e
   * saídas recorrentes mais as parcelas que vencem. O mês corrente
   * é tratado à parte: nele só entram os compromissos que ainda
   * não passaram, senão o salário já recebido seria contado duas
   * vezes.
   *
   * @returns [{ mes, rotulo, entradas, saidas, resultado, saldoFim, negativo }]
   */
  function projecaoSaldo({ saldo = 0, recorrentes = [], parcelamentos = [], meses = 6 }, hoje = new Date()) {
    const ativos = recorrentes.filter((r) => r.active !== false);
    const entradasMes = ativos.filter((r) => r.type === "entrada").reduce((s, r) => s + num(r.amount), 0);
    const saidasMes = ativos.filter((r) => r.type === "saida").reduce((s, r) => s + num(r.amount), 0);

    const porMes = parcelasPorMes(parcelamentos, meses, hoje);
    const linhas = [];
    let acumulado = num(saldo);

    for (let i = 0; i < meses; i++) {
      const d = somarMeses(new Date(hoje.getFullYear(), hoje.getMonth(), 1), i);
      const mes = chaveMes(d);

      // no mês corrente, só o que ainda está por vir
      const aindaVem = (r) => i > 0 || num(r.day_of_month) >= hoje.getDate();
      const entradas = i === 0
        ? ativos.filter((r) => r.type === "entrada" && aindaVem(r)).reduce((s, r) => s + num(r.amount), 0)
        : entradasMes;
      const saidasRec = i === 0
        ? ativos.filter((r) => r.type === "saida" && aindaVem(r)).reduce((s, r) => s + num(r.amount), 0)
        : saidasMes;

      const parcelas = porMes[mes] || 0;
      const saidas = saidasRec + parcelas;
      const resultado = entradas - saidas;
      acumulado += resultado;

      linhas.push({
        mes,
        rotulo: d.toLocaleDateString(cfg.LOCALE, { month: "short", year: "2-digit" }),
        entradas,
        saidas,
        parcelas,
        resultado,
        saldoFim: acumulado,
        negativo: acumulado < 0,
      });
    }

    return linhas;
  }

  /** Primeiro mês em que a projeção fica negativa, se houver. */
  const primeiroMesNegativo = (projecao) => projecao.find((l) => l.negativo) || null;

  /* ============================================================
     5. PLANO MENSAL DA META
     ============================================================ */

  /**
   * Quanto guardar por mês para bater a meta no prazo, e se cabe.
   * @returns null quando a meta não tem prazo ou já foi atingida
   */
  function planoDaMeta(meta, rendaLivre = 0, hoje = new Date()) {
    const alvo = num(meta.target_amount);
    const atual = num(meta.current_amount);
    const falta = Math.max(0, alvo - atual);
    if (falta <= 0) return null;
    if (!meta.deadline) return { falta, meses: null, porMes: null, cabe: null, vencida: false };

    const prazo = paraData(meta.deadline);
    if (Number.isNaN(prazo.getTime())) return null;

    const meses = (prazo.getFullYear() - hoje.getFullYear()) * 12 + (prazo.getMonth() - hoje.getMonth());
    if (meses <= 0) return { falta, meses: 0, porMes: falta, cabe: false, vencida: true };

    const porMes = falta / meses;
    const livre = num(rendaLivre);
    return {
      falta,
      meses,
      porMes,
      cabe: livre > 0 ? porMes <= livre : null,
      fatiaDaRenda: livre > 0 ? (porMes / livre) * 100 : 0,
      vencida: false,
    };
  }

  /**
   * Efeito de uma compra sobre a data prevista da meta: quanto
   * tempo a mais a pessoa levaria se gastasse aquele valor.
   */
  function atrasoNaMeta(meta, valorGasto, aportePorMes) {
    const porMes = num(aportePorMes);
    if (porMes <= 0) return null;
    const mesesExtras = num(valorGasto) / porMes;
    return { mesesExtras, diasExtras: mesesExtras * 30 };
  }

  return {
    dividirParcelas, valorParcela, cronograma, saldoDevedor, parcelasPorMes,
    situacaoOrcamento, categoriasSemTeto,
    eventosDoMes,
    projecaoSaldo, primeiroMesNegativo,
    planoDaMeta, atrasoNaMeta,
    chaveMes, somarMeses,
  };
})();
