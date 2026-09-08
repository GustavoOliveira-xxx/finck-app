document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const P = window.FinckPlano;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "Planejamento",
    subtitulo: "O que já está comprometido"
  });
  if (!user) {
    return;
  }
  const $ = id => document.getElementById(id);
  let ctx = null;
  let parcelamentos = [];
  let pagamentos = [];
  let ocorrencias = [];
  let tetos = [];
  let mesVisivel = P.chaveMes(new Date);
  async function carregar() {
    [ctx, parcelamentos, pagamentos, ocorrencias, tetos] = await Promise.all([ F.carregarContexto(), S.listar("installment_purchases", {
      ordem: "first_due_date",
      asc: true
    }), S.listar("installment_payments"), S.listar("recurring_occurrences"), S.listar("category_budgets", {
      ordem: "category",
      asc: true
    }) ]);
    renderProjecao();
    renderCalendario();
    renderParcelas();
    renderOrcamento();
  }
  function renderProjecao() {
    const linhas = P.projecaoSaldo({
      saldo: ctx.saldo,
      recorrentes: ctx.recorrentes,
      parcelamentos: parcelamentos,
      pagamentos: pagamentos,
      ocorrencias: ocorrencias,
      transacoesFuturas: ctx.transacoesFuturas,
      meses: 6
    });
    const furo = P.primeiroMesNegativo(linhas);
    $("chipProjecao").textContent = `${linhas.length} meses`;
    $("alertaProjecao").innerHTML = furo ? `<article class="proxima-acao proxima-acao--alerta">\n           <div class="proxima-acao__texto">\n             <span class="proxima-acao__etiqueta">Atenção</span>\n             <h2>O saldo fica negativo em ${U.escapeHTML(furo.rotulo)}</h2>\n             <p>Mantendo as recorrentes e as parcelas de hoje, o saldo chega a\n                ${U.moeda(furo.saldoFim)} no fim daquele mês. Dá tempo de agir agora.</p>\n           </div>\n           <a class="btn-primario" href="recorrentes.html">Revisar compromissos</a>\n         </article>` : `<article class="proxima-acao proxima-acao--bom">\n           <div class="proxima-acao__texto">\n             <span class="proxima-acao__etiqueta">Projeção</span>\n             <h2>O saldo se mantém positivo nos próximos ${linhas.length} meses</h2>\n             <p>Fecha em ${U.moeda(linhas[linhas.length - 1].saldoFim)} se nada mudar.</p>\n           </div>\n         </article>`;
    const maior = Math.max(...linhas.map(l => Math.abs(l.saldoFim)), 1);
    $("projecaoGrafico").innerHTML = linhas.map(l => {
      const altura = Math.max(4, Math.abs(l.saldoFim) / maior * 100);
      return `\n        <div class="projecao-col" title="${U.escapeHTML(l.rotulo)}: ${U.moeda(l.saldoFim)}">\n          <div class="projecao-barra-caixa">\n            <div class="projecao-barra ${l.negativo ? "projecao-barra--negativa" : ""}"\n                 style="height:${altura}%"></div>\n          </div>\n          <span class="projecao-valor">${U.moeda(l.saldoFim)}</span>\n          <span class="projecao-mes">${U.escapeHTML(l.rotulo)}</span>\n        </div>`;
    }).join("");
    $("tabelaProjecao").querySelector("tbody").innerHTML = linhas.map(l => `\n      <tr>\n        <th scope="row">${U.escapeHTML(l.rotulo)}</th>\n        <td class="cor-verde">${U.moeda(l.entradas)}</td>\n        <td class="cor-vermelha">${U.moeda(l.saidas)}</td>\n        <td>${l.parcelas ? U.moeda(l.parcelas) : "—"}</td>\n        <td class="${l.negativo ? "cor-vermelha" : ""}"><strong>${U.moeda(l.saldoFim)}</strong></td>\n      </tr>`).join("");
  }
  const NOMES_DIA = [ "Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb" ];
  function renderCalendario() {
    const [ano, mes] = mesVisivel.split("-").map(Number);
    const primeiro = new Date(ano, mes - 1, 1);
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const inicioSemana = primeiro.getDay();
    const hoje = new Date;
    const ehMesAtual = P.chaveMes(hoje) === mesVisivel;
    $("mesAtualRotulo").textContent = primeiro.toLocaleDateString(cfg.LOCALE, {
      month: "long",
      year: "numeric"
    });
    const eventos = P.eventosDoMes({
      recorrentes: ctx.recorrentes,
      parcelamentos: parcelamentos,
      pagamentos: pagamentos,
      transacoes: ctx.transacoes
    }, mesVisivel);
    const celulas = [];
    NOMES_DIA.forEach(n => celulas.push(`<div class="calendario__cabecalho" aria-hidden="true">${n}</div>`));
    for (let i = 0; i < inicioSemana; i++) {
      celulas.push(`<div class="calendario__vazio"></div>`);
    }
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const doDia = eventos.get(dia) || [];
      const entradas = doDia.filter(e => e.sinal > 0).length;
      const saidas = doDia.filter(e => e.sinal < 0 && e.tipo !== "parcela").length;
      const parcelas = doDia.filter(e => e.tipo === "parcela").length;
      const saldoDia = doDia.reduce((s, e) => s + e.valor * e.sinal, 0);
      const ehHoje = ehMesAtual && dia === hoje.getDate();
      celulas.push(`\n        <button type="button"\n                class="calendario__dia${doDia.length ? " calendario__dia--com-evento" : ""}${ehHoje ? " calendario__dia--hoje" : ""}"\n                data-dia="${dia}"\n                ${doDia.length ? "" : "disabled"}\n                aria-label="Dia ${dia}${doDia.length ? `, ${doDia.length} compromisso(s), resultado ${U.moeda(saldoDia)}` : ", sem compromissos"}">\n          <span class="calendario__numero">${dia}</span>\n          <span class="calendario__pontos" aria-hidden="true">\n            ${entradas ? '<span class="ponto ponto--entrada"></span>' : ""}\n            ${saidas ? '<span class="ponto ponto--saida"></span>' : ""}\n            ${parcelas ? '<span class="ponto ponto--parcela"></span>' : ""}\n          </span>\n        </button>`);
    }
    $("calendario").innerHTML = celulas.join("");
    $("detalheDia").innerHTML = "";
    $("calendario").querySelectorAll("[data-dia]").forEach(b => b.addEventListener("click", () => mostrarDia(Number(b.dataset.dia), eventos)));
    if (ehMesAtual && eventos.has(hoje.getDate())) {
      mostrarDia(hoje.getDate(), eventos);
    }
  }
  function mostrarDia(dia, eventos) {
    const lista = eventos.get(dia) || [];
    const total = lista.reduce((s, e) => s + e.valor * e.sinal, 0);
    $("detalheDia").innerHTML = `\n      <h4>Dia ${dia}</h4>\n      <ul class="lista-simples">\n        ${lista.map(e => `\n          <li class="item-lista">\n            <span class="item-desc">${U.escapeHTML(e.titulo)}</span>\n            <span class="item-dia">\n              ${e.tipo === "parcela" ? "parcela" : e.tipo === "recorrente" ? "fixa" : "lançada"}\n              <span class="${e.estado === "realizado" ? "selo-realizado" : "selo-previsto"}">${e.estado === "realizado" ? "realizado" : "previsto"}</span>\n            </span>\n            <span class="item-valor ${e.sinal > 0 ? "cor-verde" : "cor-vermelha"}">\n              ${e.sinal > 0 ? "+" : "−"} ${U.moeda(e.valor)}\n            </span>\n          </li>`).join("")}\n      </ul>\n      <p class="total-linha"><span>Resultado do dia</span>\n        <strong class="${total < 0 ? "cor-vermelha" : "cor-verde"}">${U.moeda(total)}</strong></p>\n      <p class="nota">Previsto é compromisso que ainda não moveu dinheiro. Realizado já está no saldo.</p>`;
  }
  $("mesAnterior").addEventListener("click", () => {
    const [a, m] = mesVisivel.split("-").map(Number);
    mesVisivel = P.chaveMes(new Date(a, m - 2, 1));
    renderCalendario();
  });
  $("mesSeguinte").addEventListener("click", () => {
    const [a, m] = mesVisivel.split("-").map(Number);
    mesVisivel = P.chaveMes(new Date(a, m, 1));
    renderCalendario();
  });
  function renderParcelas() {
    const ativos = parcelamentos.filter(p => p.active !== false);
    const porCompra = P.pagamentosPorCompra(pagamentos);
    const devedor = ativos.reduce((s, p) => s + P.saldoDevedor(p, porCompra.get(String(p.id)) || []), 0);
    const porMes = P.parcelasPorMes(ativos, 12, new Date, pagamentos);
    const esteMes = porMes[P.chaveMes(new Date)] || 0;
    const comprometeRendaLivre = ctx.rendaLivre > 0 ? esteMes / ctx.rendaLivre * 100 : 0;
    $("resumoParcelas").innerHTML = `\n      <article class="card-indicador"><span>Ainda a pagar</span><strong>${U.moeda(devedor)}</strong></article>\n      <article class="card-indicador"><span>Parcelas neste mês</span><strong>${U.moeda(esteMes)}</strong></article>\n      <article class="card-indicador"><span>Da sua renda livre</span>\n        <strong class="${comprometeRendaLivre > 30 ? "cor-vermelha" : ""}">${U.percentual(comprometeRendaLivre, 0)}</strong></article>\n      <article class="card-indicador"><span>Compras ativas</span><strong>${ativos.length}</strong></article>`;
    $("vazioParcelas").hidden = parcelamentos.length > 0;
    $("listaParcelas").innerHTML = parcelamentos.map(p => {
      const doParcelamento = porCompra.get(String(p.id)) || [];
      const crono = P.cronograma(p, doParcelamento);
      const pagas = crono.filter(c => c.paga).length;
      const restante = P.saldoDevedor(p, doParcelamento);
      const ultimaPaga = [ ...crono ].reverse().find(c => c.paga);
      const proxima = crono.find(c => !c.paga);
      const pct = pagas / crono.length * 100;
      return `\n        <article class="item-transacao saida item-parcela">\n          <div class="item-info">\n            <h4>${U.escapeHTML(p.description)}</h4>\n            <small>${U.escapeHTML(p.category || "Outros")} · ${pagas}/${p.installments_count} pagas\n              ${proxima ? `· próxima em ${U.dataBR(proxima.vencimento.toISOString())}` : "· quitada"}</small>\n            <div class="barra barra--fina"><div class="barra-preenchida" style="width:${pct}%"></div></div>\n          </div>\n          <div class="item-lado">\n            <strong>${U.moeda(P.valorParcela(p.total_amount, p.installments_count))}/mês</strong>\n            <small class="item-dia">falta ${U.moeda(restante)}</small>\n            <div class="acoes-card">\n              ${proxima ? `<button type="button" class="btn-secundario btn-mini" data-pagar="${p.id}" data-numero="${proxima.numero}">Registrar pagamento</button>` : ""}\n              ${ultimaPaga ? `<button type="button" class="btn-secundario btn-mini" data-desfazer-parcela="${p.id}" data-numero="${ultimaPaga.numero}">Desfazer última</button>` : ""}\n              <button type="button" class="btn-secundario btn-mini" data-editar-parcela="${p.id}">Editar</button>\n              <button type="button" class="btn-excluir-item" data-excluir-parcela="${p.id}" aria-label="Excluir parcelamento">✕</button>\n            </div>\n          </div>\n        </article>`;
    }).join("");
    $("listaParcelas").querySelectorAll("[data-pagar]").forEach(b => b.addEventListener("click", async () => {
      const p = parcelamentos.find(x => String(x.id) === b.dataset.pagar);
      try {
        const r = await F.pagarParcela(p, Number(b.dataset.numero));
        U.toast(r.jaPaga ? "Esta parcela já estava paga." : "Parcela paga e lançada no seu saldo.", "sucesso");
        carregar();
      } catch (err) {
        U.toast(err.message, "erro");
      }
    }));
    $("listaParcelas").querySelectorAll("[data-desfazer-parcela]").forEach(b => b.addEventListener("click", async () => {
      const p = parcelamentos.find(x => String(x.id) === b.dataset.desfazerParcela);
      if (!await U.confirmar("Desfazer este pagamento?", "A movimentação correspondente é removida e a parcela volta a ser compromisso em aberto.", {
        confirmar: "Desfazer"
      })) {
        return;
      }
      try {
        await F.desfazerPagamentoParcela(p, Number(b.dataset.numero));
        U.toast("Pagamento desfeito.", "info");
        carregar();
      } catch (err) {
        U.toast(err.message, "erro");
      }
    }));
    $("listaParcelas").querySelectorAll("[data-editar-parcela]").forEach(b => b.addEventListener("click", () => abrirParcela(b.dataset.editarParcela)));
    $("listaParcelas").querySelectorAll("[data-excluir-parcela]").forEach(b => b.addEventListener("click", async () => {
      if (!await U.confirmar("Excluir este parcelamento?", "Ele sai da projeção e do calendário de compromissos.", {
        confirmar: "Excluir"
      })) {
        return;
      }
      await S.remover("installment_purchases", b.dataset.excluirParcela);
      U.toast("Parcelamento excluído.", "info");
      carregar();
    }));
  }
  function abrirParcela(id) {
    const p = id ? parcelamentos.find(x => String(x.id) === String(id)) : null;
    $("tituloParcela").textContent = p ? "Editar parcelamento" : "Nova compra parcelada";
    $("parcelaId").value = p?.id || "";
    $("parcelaDescricao").value = p?.description || "";
    U.escreverMoeda("parcelaTotal", p?.total_amount || 0);
    $("parcelaQtd").value = p?.installments_count || "";
    window.FinckData.escrever("parcelaData", p ? String(p.first_due_date).slice(0, 10) : U.hojeISO());
    $("parcelaPagas").value = p?.paid_count || 0;
    $("parcelaCategoria").innerHTML = cfg.CATEGORIAS.map(c => `<option value="${c}"${p?.category === c ? " selected" : ""}>${c}</option>`).join("");
    atualizarPrevia();
    U.abrirModal("modalParcela");
  }
  function atualizarPrevia() {
    const total = U.lerMoeda("parcelaTotal");
    const qtd = Number($("parcelaQtd").value);
    if (!(total > 0) || !(qtd >= 1)) {
      $("previaParcela").textContent = "";
      return;
    }
    const valores = P.dividirParcelas(total, qtd);
    const ultima = valores[valores.length - 1];
    const diferente = Math.abs(ultima - valores[0]) > .001;
    const fatia = ctx.rendaLivre > 0 ? valores[0] / ctx.rendaLivre * 100 : 0;
    $("previaParcela").innerHTML = `<strong>${qtd}x de ${U.moeda(valores[0])}</strong>` + (diferente ? ` (a última fica ${U.moeda(ultima)} para fechar a conta)` : "") + (ctx.rendaLivre > 0 ? ` — ${U.percentual(fatia, 1)} da sua renda livre por mês.` : "");
  }
  [ "parcelaTotal", "parcelaQtd" ].forEach(id => $(id).addEventListener("input", atualizarPrevia));
  $("btnNovaParcela").addEventListener("click", () => abrirParcela(null));
  $("formParcela").addEventListener("submit", async e => {
    e.preventDefault();
    const id = $("parcelaId").value;
    const total = U.lerMoeda("parcelaTotal");
    const qtd = Number($("parcelaQtd").value);
    const pagas = Number($("parcelaPagas").value) || 0;
    if (!$("parcelaDescricao").value.trim()) {
      return U.toast("Informe a descrição.", "erro");
    }
    if (!(total > 0)) {
      return U.toast("Informe um valor total maior que zero.", "erro");
    }
    if (!(qtd >= 1)) {
      return U.toast("Informe ao menos 1 parcela.", "erro");
    }
    if (pagas > qtd) {
      return U.toast("Parcelas pagas não podem passar do total.", "erro");
    }
    if (!window.FinckData.ler("parcelaData")) {
      return U.toast("Informe o primeiro vencimento.", "erro");
    }
    const dados = {
      description: $("parcelaDescricao").value.trim(),
      category: $("parcelaCategoria").value,
      total_amount: total,
      installments_count: qtd,
      installment_amount: P.valorParcela(total, qtd),
      first_due_date: window.FinckData.ler("parcelaData"),
      paid_count: pagas,
      active: true
    };
    try {
      if (id) {
        await S.atualizar("installment_purchases", id, dados);
      } else {
        await S.inserir("installment_purchases", dados);
      }
      U.fecharModal("modalParcela");
      U.toast("Parcelamento salvo.", "sucesso");
      carregar();
    } catch (err) {
      U.toast(err.message, "erro");
    }
  });
  function renderOrcamento() {
    const situacao = P.situacaoOrcamento(tetos, ctx.transacoesRealizadas);
    $("vazioOrcamento").hidden = tetos.length > 0;
    $("listaOrcamento").innerHTML = situacao.map(s => `\n      <article class="teto teto--${s.situacao}">\n        <div class="teto__topo">\n          <strong>${U.escapeHTML(s.categoria)}</strong>\n          <span class="teto__valores">${U.moeda(s.gasto)} de ${U.moeda(s.limite)}</span>\n        </div>\n        <div class="barra"><div class="barra-preenchida" style="width:${Math.min(100, s.percentual)}%"></div></div>\n        <p class="teto__nota">\n          ${s.situacao === "estourado" ? `Passou ${U.moeda(-s.restante)} do teto.` : s.situacao === "no_limite" ? `Exatamente no limite: usou 100% do teto, sem estourar.` : s.situacao === "atencao" ? `Restam ${U.moeda(s.restante)} — ${U.percentual(s.percentual, 0)} usado.` : `Restam ${U.moeda(s.restante)}.`}\n          <button type="button" class="btn-texto" data-editar-teto="${s.id}">ajustar</button>\n          <button type="button" class="btn-texto" data-excluir-teto="${s.id}">remover</button>\n        </p>\n      </article>`).join("");
    const semTeto = P.categoriasSemTeto(tetos, ctx.transacoesRealizadas);
    $("sugestaoTetos").innerHTML = semTeto.length ? `<p class="nota">Gastou este mês em <strong>${semTeto.map(U.escapeHTML).join(", ")}</strong> sem teto definido.\n           ${semTeto.map(c => `<button type="button" class="chip chip--acao" data-teto-rapido="${U.escapeHTML(c)}">definir ${U.escapeHTML(c)}</button>`).join(" ")}</p>` : "";
    $("listaOrcamento").querySelectorAll("[data-editar-teto]").forEach(b => b.addEventListener("click", () => abrirTeto(b.dataset.editarTeto)));
    $("listaOrcamento").querySelectorAll("[data-excluir-teto]").forEach(b => b.addEventListener("click", async () => {
      if (!await U.confirmar("Remover o teto desta categoria?", "A categoria deixa de ter limite mensal definido.", {
        confirmar: "Remover"
      })) {
        return;
      }
      await S.remover("category_budgets", b.dataset.excluirTeto);
      carregar();
    }));
    $("sugestaoTetos").querySelectorAll("[data-teto-rapido]").forEach(b => b.addEventListener("click", () => abrirTeto(null, b.dataset.tetoRapido)));
  }
  function abrirTeto(id, categoriaSugerida = null) {
    const t = id ? tetos.find(x => String(x.id) === String(id)) : null;
    const categoria = t?.category || categoriaSugerida || cfg.CATEGORIAS[0];
    $("tetoId").value = t?.id || "";
    U.escreverMoeda("tetoLimite", t?.limit_amount || 0);
    $("tetoCategoria").innerHTML = cfg.CATEGORIAS.map(c => `<option value="${c}"${c === categoria ? " selected" : ""}>${c}</option>`).join("");
    $("tetoCategoria").disabled = Boolean(t);
    const gastoAtual = ctx.transacoes.filter(x => x.type === "saida" && (x.category || "Outros") === categoria && String(x.date || "").slice(0, 7) === P.chaveMes(new Date)).reduce((s, x) => s + Number(x.amount || 0), 0);
    $("notaTeto").textContent = gastoAtual > 0 ? `Você já gastou ${U.moeda(gastoAtual)} nesta categoria neste mês.` : "Sem gastos nesta categoria neste mês.";
    U.abrirModal("modalTeto");
  }
  $("btnNovoTeto").addEventListener("click", () => abrirTeto(null));
  $("formTeto").addEventListener("submit", async e => {
    e.preventDefault();
    const id = $("tetoId").value;
    const limite = U.lerMoeda("tetoLimite");
    if (!(limite > 0)) {
      return U.toast("Informe um limite maior que zero.", "erro");
    }
    const categoria = $("tetoCategoria").value;
    if (!id && tetos.some(t => t.category === categoria)) {
      return U.toast("Essa categoria já tem um teto. Ajuste o existente.", "erro");
    }
    try {
      if (id) {
        await S.atualizar("category_budgets", id, {
          limit_amount: limite
        });
      } else {
        await S.inserir("category_budgets", {
          category: categoria,
          limit_amount: limite
        });
      }
      U.fecharModal("modalTeto");
      U.toast("Teto salvo.", "sucesso");
      carregar();
    } catch (err) {
      U.toast(err.message, "erro");
    }
  });
  carregar();
});
