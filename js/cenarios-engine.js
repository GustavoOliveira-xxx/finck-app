window.FinckCenarios = (() => {
  const cfg = window.FINCK_CONFIG;
  const num = (v) => Number(v || 0);

  const CATALOGO = [
    {
      id: "nao_comprar",
      rotulo: "Não comprar",
      pergunta: "E se eu não comprar?",
      resumo: "O dinheiro fica onde está.",
      consciente: true,
    },
    {
      id: "comprar_agora",
      rotulo: "Comprar agora",
      pergunta: "E se eu comprar hoje?",
      resumo: "Sai do saldo deste mês, de uma vez.",
      consciente: false,
    },
    {
      id: "adiar",
      rotulo: "Comprar mês que vem",
      pergunta: "E se eu esperar um mês?",
      resumo: "Um mês de folga para a sobra recompor.",
      consciente: true,
    },
    {
      id: "parcelar",
      rotulo: "Parcelar",
      pergunta: "E se eu parcelar?",
      resumo: "O peso se divide, mas ocupa os próximos meses.",
      consciente: false,
    },
    {
      id: "usado",
      rotulo: "Comprar usado",
      pergunta: "E se eu comprar usado?",
      resumo: "Mesma função por uma fração do preço.",
      consciente: true,
    },
  ];

  const catalogo = () => CATALOGO.map((c) => ({ ...c }));

  function calcular(id, entrada, ctx) {
    const preco = num(entrada.preco);
    const parcelas = Math.max(1, Math.floor(num(entrada.parcelas) || 12));
    const desconto = Math.min(0.95, Math.max(0, num(entrada.descontoUsado ?? 0.45)));
    const saldo = num(ctx.saldo);
    const rendaLivre = num(ctx.rendaLivre);

    let custoAgora = 0;
    let custoMensal = 0;
    let mesesDeImpacto = 0;
    let precoEfetivo = preco;

    switch (id) {
      case "nao_comprar":
        precoEfetivo = 0;
        break;
      case "comprar_agora":
        custoAgora = preco;
        mesesDeImpacto = 1;
        break;
      case "adiar":

        custoAgora = 0;
        custoMensal = preco;
        mesesDeImpacto = 1;
        break;
      case "parcelar":
        custoMensal = preco / parcelas;
        custoAgora = custoMensal;
        mesesDeImpacto = parcelas;
        break;
      case "usado":
        precoEfetivo = preco * (1 - desconto);
        custoAgora = precoEfetivo;
        mesesDeImpacto = 1;
        break;
      default:
        break;
    }

    const saldoDepois = saldo - custoAgora;
    const sobraDepois = rendaLivre - (id === "parcelar" ? custoMensal : 0);

    const valorHora = num(ctx.valorHora);
    const horas = valorHora > 0 ? precoEfetivo / valorHora : 0;

    return {
      id,
      ...CATALOGO.find((c) => c.id === id),
      precoEfetivo,
      custoAgora,
      custoMensal,
      mesesDeImpacto,
      parcelas: id === "parcelar" ? parcelas : 0,
      saldoDepois,
      sobraDepois,
      horas,
      comprometeSaldo: saldoDepois < 0,
      comprometeSobra: sobraDepois < 0,
      impactoMetas: impactoNasMetas(precoEfetivo, ctx.metas || [], rendaLivre),
    };
  }

  function impactoNasMetas(gasto, metas, rendaLivre) {
    const alvo = metas.reduce((s, m) => s + num(m.target_amount), 0);
    const atual = metas.reduce((s, m) => s + num(m.current_amount), 0);
    if (alvo <= 0) return { possui: false, percentual: 100, atrasoMeses: 0 };

    const capacidade = Math.max(0, alvo - atual);
    const consumido = capacidade > 0 ? Math.min(1, gasto / capacidade) : 0;

    return {
      possui: true,
      percentual: Math.max(0, Math.min(100, (1 - consumido) * 100)),
      atrasoMeses: rendaLivre > 0 ? gasto / rendaLivre : 0,
    };
  }

  function comparar(entrada, ctx, ids = null) {
    const escolhidos = ids && ids.length ? ids : CATALOGO.map((c) => c.id);
    return CATALOGO.filter((c) => escolhidos.includes(c.id)).map((c) => calcular(c.id, entrada, ctx));
  }

  function ranking(cenarios) {
    return [...cenarios].sort((a, b) => b.saldoDepois - a.saldoDepois);
  }

  function fluxograma(entrada, cenarios) {
    const nos = [];
    const arestas = [];

    const raiz = {
      id: "raiz",
      tipo: "pergunta",
      titulo: entrada.item ? `Comprar "${entrada.item}"?` : "Fazer esta compra?",
      detalhe: `${cfg.MOEDA === "BRL" ? "R$ " : ""}${num(entrada.preco).toLocaleString(cfg.LOCALE, {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      })}`,
      nivel: 0,
    };
    nos.push(raiz);

    cenarios.forEach((c, i) => {
      const noCaminho = {
        id: `caminho-${c.id}`,
        tipo: "caminho",
        titulo: c.rotulo,
        detalhe: c.resumo,
        consciente: c.consciente,
        nivel: 1,
        ordem: i,
      };
      nos.push(noCaminho);
      arestas.push({ de: raiz.id, para: noCaminho.id, rotulo: c.pergunta });

      const risco = c.comprometeSaldo ? "alerta" : c.comprometeSobra ? "atencao" : "ok";
      const noResultado = {
        id: `resultado-${c.id}`,
        tipo: "resultado",
        titulo: c.custoMensal && c.parcelas
          ? `${c.parcelas}x de ${moeda(c.custoMensal)}`
          : c.precoEfetivo > 0 ? moeda(c.precoEfetivo) : "Nada sai do bolso",
        linhas: [
          { rotulo: "Saldo depois", valor: moeda(c.saldoDepois) },
          { rotulo: "Em trabalho", valor: c.horas > 0 ? formatarHoras(c.horas) : "—" },
          c.impactoMetas.possui
            ? { rotulo: "Metas", valor: `${Math.round(c.impactoMetas.percentual)}%` }
            : null,
        ].filter(Boolean),
        risco,
        nivel: 2,
        ordem: i,
      };
      nos.push(noResultado);
      arestas.push({ de: noCaminho.id, para: noResultado.id, rotulo: "" });
    });

    return { nos, arestas, colunas: cenarios.length };
  }

  const moeda = (v) =>
    num(v).toLocaleString(cfg.LOCALE, { style: "currency", currency: cfg.MOEDA });

  function formatarHoras(h) {
    if (window.FinckTempo) return window.FinckTempo.formatar(h);
    return `${Math.round(h)}h`;
  }

  return { catalogo, calcular, comparar, ranking, fluxograma };
})();
