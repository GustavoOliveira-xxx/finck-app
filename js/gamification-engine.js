window.FinckGame = (() => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;

  const NIVEIS = cfg.NIVEIS;
  const REGRAS = cfg.XP;
  const XP_POR_NIVEL = 250;

  const CONQUISTAS = [
    { id: "primeiro_passo",     icone: "🌱", titulo: "Primeiro passo",       descricao: "Configurou o perfil financeiro.",                         teste: (c) => Boolean(c.perfilCompleto) },
    { id: "primeiro_lancamento",icone: "✍️", titulo: "Mão na massa",         descricao: "Registrou a primeira movimentação.",                      teste: (c) => c.transacoes >= 1 },
    { id: "constancia",         icone: "📒", titulo: "Constância",           descricao: "Registrou 10 movimentações.",                             teste: (c) => c.transacoes >= 10 },
    { id: "diario_de_bordo",    icone: "📚", titulo: "Diário de bordo",      descricao: "Registrou 50 movimentações.",                             teste: (c) => c.transacoes >= 50 },
    { id: "primeira_meta",      icone: "🎯", titulo: "Com um plano",         descricao: "Criou a primeira meta.",                                  teste: (c) => c.metas >= 1 },
    { id: "meta_concluida",     icone: "🏁", titulo: "Meta batida",          descricao: "Concluiu uma meta financeira.",                           teste: (c) => c.metasConcluidas >= 1 },
    { id: "colecionador_metas", icone: "🏆", titulo: "Colecionador de metas",descricao: "Concluiu 3 metas financeiras.",                           teste: (c) => c.metasConcluidas >= 3 },
    { id: "primeira_analise",   icone: "🧮", titulo: "Pensou antes",         descricao: "Registrou o primeiro cálculo real.",                      teste: (c) => c.analises >= 1 },
    { id: "calculista",         icone: "📐", titulo: "Calculista",           descricao: "Registrou 25 cálculos reais.",                            teste: (c) => c.analises >= 25 },
    { id: "consumo_consciente", icone: "🧘", titulo: "Consumo consciente",   descricao: "Adiou, substituiu ou desistiu de 5 compras.",             teste: (c) => c.evitadas >= 5 },
    { id: "freio_de_mao",       icone: "🛑", titulo: "Freio de mão",         descricao: "Evitou 20 compras por impulso.",                          teste: (c) => c.evitadas >= 20 },
    { id: "guardiao",           icone: "⏳", titulo: "Guardião do tempo",    descricao: "Preservou 100 horas de trabalho evitando compras.",       teste: (c) => c.horasPreservadas >= 100 },
    { id: "ano_de_vida",        icone: "🕰️", titulo: "Um mês de vida",       descricao: "Preservou 176 horas — um mês inteiro de trabalho.",       teste: (c) => c.horasPreservadas >= 176 },
    { id: "mil_reais",          icone: "💰", titulo: "Mil conscientes",      descricao: "Deixou de gastar R$ 1.000 em compras evitadas.",          teste: (c) => c.economia >= 1000 },
    { id: "primeira_entrada",   icone: "💰", titulo: "Primeiro dinheiro registrado", descricao: "Cadastrou a primeira entrada.",                      teste: (c) => c.entradas >= 1 },
    { id: "primeira_saida",     icone: "💸", titulo: "Primeiro gasto registrado",   descricao: "Cadastrou a primeira saída.",                          teste: (c) => c.saidas >= 1 },
    { id: "mestre_financas",    icone: "🏅", titulo: "Mestre das finanças",         descricao: "Alcançou o nível 10 (The Miner).",                     teste: (c) => c.nivel >= 10 },
    { id: "semana_firme",       icone: "🔥", titulo: "Semana firme",         descricao: "Manteve 7 dias seguidos de uso do app.",                  teste: (c) => c.streak >= 7 },
    { id: "mes_firme",          icone: "☄️", titulo: "Mês firme",            descricao: "Manteve 30 dias seguidos de uso do app.",                 teste: (c) => c.streak >= 30 },
  ];

  function nivelDe(xpTotal) {
    const xp = Math.max(0, Number(xpTotal || 0));
    let atual = NIVEIS[0];
    for (const n of NIVEIS) if (xp >= n.xp) atual = n;
    const proximo = NIVEIS.find((n) => n.xp > xp) || null;
    const base = atual.xp;
    const alvo = proximo ? proximo.xp : atual.xp;
    const faixa = Math.max(1, alvo - base);
    return {
      level: atual.level,
      titulo: atual.titulo,
      icone: atual.icone,
      lema: atual.lema,
      proximo,
      xpNoNivel: xp - base,
      xpParaProximo: proximo ? proximo.xp - xp : 0,
      progresso: proximo ? Math.min(100, ((xp - base) / faixa) * 100) : 100,
      maximo: !proximo,
    };
  }

  const tituloDe = (xp) => nivelDe(xp).titulo;

  function normalizarLedger(estado) {
    const hoje = U.hojeISO();
    const l = estado.ledger && typeof estado.ledger === "object" ? estado.ledger : {};
    const chaves = Array.isArray(l.chaves) ? l.chaves : [];
    if (l.dia !== hoje) return { dia: hoje, total: 0, acoes: {}, ultimo: 0, chaves };
    return { dia: hoje, total: Number(l.total || 0), acoes: l.acoes || {}, ultimo: Number(l.ultimo || 0), chaves };
  }

  function podePremiar(estado, tipo, chave) {
    const regra = REGRAS.ACOES[tipo];
    if (!regra) return { ok: false, motivo: "Ação desconhecida." };
    const l = normalizarLedger(estado);
    if (chave && l.chaves.includes(`${tipo}:${chave}`)) return { ok: false, motivo: "Esta ação já rendeu XP antes." };
    if (l.total >= REGRAS.TETO_DIARIO) return { ok: false, motivo: "Teto diário de XP atingido. Volte amanhã." };
    if ((l.acoes[tipo] || 0) >= regra.limiteDia) return { ok: false, motivo: `Limite diário de "${regra.rotulo}" atingido.` };
    if (Date.now() - l.ultimo < REGRAS.INTERVALO_MIN_MS) return { ok: false, motivo: "Aguarde alguns segundos entre ações." };
    return { ok: true, regra, ledger: l };
  }

  async function premiar(tipo, opcoes = {}) {
    const estado = await S.obterGamificacao();
    const hoje = U.hojeISO();
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    let streak = Number(estado.streak || 0);
    if (estado.last_active === hoje) {  }
    else if (estado.last_active === ontem) streak += 1;
    else streak = 1;

    const veredito = podePremiar(estado, tipo, opcoes.chave);
    const ledger = veredito.ledger || normalizarLedger(estado);

    if (!veredito.ok) {
      await S.salvarGamificacao({ ...estado, streak, last_active: hoje, ledger });
      if (!opcoes.silencioso && veredito.motivo) U.toast(veredito.motivo, "info");
      return { concedido: 0, motivo: veredito.motivo, estado };
    }

    const ganho = Math.max(0, Math.min(
      Number(opcoes.xp ?? veredito.regra.xp),
      REGRAS.TETO_DIARIO - ledger.total
    ));

    ledger.total += ganho;
    ledger.acoes[tipo] = (ledger.acoes[tipo] || 0) + 1;
    ledger.ultimo = Date.now();
    if (opcoes.chave) {
      ledger.chaves = [...ledger.chaves, `${tipo}:${opcoes.chave}`].slice(-400);
    }

    const xp = Number(estado.xp || 0) + ganho;
    const nivelAntes = nivelDe(estado.xp);
    const nivelDepois = nivelDe(xp);

    const novo = { ...estado, xp, level: nivelDepois.level, streak, last_active: hoje, ledger };
    await S.salvarGamificacao(novo);

    if (ganho > 0 && !opcoes.silencioso) {
      U.toast(`+${ganho} XP — ${opcoes.motivo || veredito.regra.rotulo}`, "sucesso");
    }
    if (nivelDepois.level > nivelAntes.level) {
      U.toast(`${nivelDepois.icone} Nível ${nivelDepois.level}: ${nivelDepois.titulo}!`, "sucesso", 5000);
      document.dispatchEvent(new CustomEvent("finck:nivel", { detail: nivelDepois }));
    }
    return { concedido: ganho, estado: novo, nivel: nivelDepois };
  }

  async function ganharXP(quantidade, motivo = "", tipo = "transacao") {
    return premiar(tipo, { xp: quantidade, motivo });
  }

  async function sincronizarConquistas() {
    const [estado, perfil, transacoes, metas, analises] = await Promise.all([
      S.obterGamificacao(), S.obterPerfil(),
      S.listar("transactions"), S.listar("goals"), S.listar("purchase_analyses"),
    ]);
    const resumo = window.FinckReality.resumoHistorico(analises);

    const ctx = {
      perfilCompleto: Boolean(perfil?.income_monthly),
      transacoes: transacoes.length,
      metas: metas.length,
      metasConcluidas: metas.filter((m) => Number(m.current_amount || 0) >= Number(m.target_amount || 0) && Number(m.target_amount) > 0).length,
      analises: analises.length,
      evitadas: resumo.evitadas,
      economia: resumo.economia,
      horasPreservadas: resumo.horas_preservadas,
      streak: Number(estado.streak || 0),
      entradas: transacoes.filter((t) => t.type === "entrada").length,
      saidas: transacoes.filter((t) => t.type === "saida").length,
      nivel: nivelDe(estado.xp).level,
    };

    const desbloqueadas = CONQUISTAS.filter((c) => c.teste(ctx)).map((c) => c.id);
    const antes = Array.isArray(estado.achievements) ? estado.achievements : [];
    const novas = desbloqueadas.filter((id) => !antes.includes(id));

    if (novas.length) {

      await S.salvarGamificacao({ ...estado, achievements: desbloqueadas });
      for (const id of novas) {
        const c = CONQUISTAS.find((x) => x.id === id);
        await premiar("conquista", { chave: id, motivo: `Conquista: ${c.titulo}`, silencioso: true });
        U.toast(`${c.icone} Conquista desbloqueada: ${c.titulo}`, "sucesso", 4500);
      }
    }
    return { lista: CONQUISTAS, desbloqueadas, ctx };
  }

  async function statusDiario() {
    const estado = await S.obterGamificacao();
    const l = normalizarLedger(estado);
    return {
      total: l.total,
      teto: REGRAS.TETO_DIARIO,
      restante: Math.max(0, REGRAS.TETO_DIARIO - l.total),
      acoes: Object.entries(REGRAS.ACOES).map(([tipo, r]) => ({
        tipo, rotulo: r.rotulo, xp: r.xp, oculto: Boolean(r.oculto),
        usados: l.acoes[tipo] || 0,
        limite: r.limiteDia,
        unico: Boolean(r.unico),
      })),
    };
  }

  return {
    XP_POR_NIVEL, NIVEIS, CONQUISTAS, REGRAS,
    nivelDe, tituloDe, premiar, ganharXP, podePremiar,
    sincronizarConquistas, statusDiario,
  };
})();
