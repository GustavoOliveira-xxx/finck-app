document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const R = window.FinckReality;
  const G = window.FinckGame;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "FinCK of Reality",
    subtitulo: "Cálculo realista de compra"
  });
  if (!user) {
    return;
  }
  let ctx = await F.carregarContexto();
  let resultado = null;
  let entrada = null;
  let decisao = null;
  let registroId = null;
  document.getElementById("itemCategory").innerHTML = cfg.CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join("");
  document.getElementById("itemDestino").innerHTML = `<option value="">Prefiro não dizer</option>` + cfg.DESTINOS_ITEM.map(d => `<option value="${d.id}">${U.escapeHTML(d.rotulo)}</option>`).join("");
  document.getElementById("formReality").addEventListener("submit", async e => {
    e.preventDefault();
    const item_name = document.getElementById("itemName").value.trim();
    const price = U.lerMoeda("itemPrice");
    const category = document.getElementById("itemCategory").value;
    const note = document.getElementById("itemNote").value.trim();
    let item_link = document.getElementById("itemLink").value.trim();
    if (!item_name) {
      return U.toast("Informe o item desejado.", "erro");
    }
    if (!(price > 0)) {
      return U.toast("Informe um preço maior que zero.", "erro");
    }
    if (item_link && !/^https?:\/\//i.test(item_link)) {
      item_link = `https://${item_link}`;
    }
    if (item_link) {
      try {
        new URL(item_link);
      } catch {
        return U.toast("O link do item parece inválido. Confira o endereço.", "erro");
      }
    }
    ctx = await F.carregarContexto();
    if (!(Number(ctx.perfil?.income_monthly) > 0)) {
      U.toast("Informe sua renda mensal no Perfil para usar o FinCK of Reality.", "erro");
      return;
    }
    const quantidade = Number(document.getElementById("itemQuantidade").value) || null;
    const mesesDeUso = Number(document.getElementById("itemMeses").value) || null;
    const destino = document.getElementById("itemDestino").value || null;
    entrada = {
      item_name: item_name,
      price: price,
      category: category,
      note: note,
      item_link: item_link || null,
      quantity: quantidade,
      expected_months: mesesDeUso,
      end_of_life: destino
    };
    resultado = R.calcular(price, ctx.perfil, {
      saldo: ctx.saldo,
      despesasFixas: ctx.despesasFixas,
      compromissosAbertos: ctx.compromissosAbertos,
      quantidade: quantidade,
      mesesDeUso: mesesDeUso,
      metas: ctx.metas
    });
    renderResultado();
    renderReflexoes();
    renderDecisoes();
    document.getElementById("passoResultado").hidden = false;
    document.getElementById("passoReflexao").hidden = false;
    document.getElementById("passoDecisao").hidden = false;
    document.getElementById("passoResultado").scrollIntoView({
      behavior: "smooth"
    });
    document.getElementById("btnRegistrarCalculo").disabled = false;
    document.getElementById("statusRegistro").textContent = "Cálculo ainda não cadastrado. Registre para guardar no seu histórico real.";
  });
  function renderResultado() {
    const r = resultado;
    document.getElementById("semaforo").innerHTML = `\n      <div class="semaforo-card semaforo--${r.semaforo.nivel}">\n        <strong>${r.semaforo.titulo}</strong>\n        <p>${r.semaforo.texto}</p>\n      </div>`;
    document.getElementById("indicadores").innerHTML = `\n      <article class="card-indicador"><span>Preço</span><strong>${U.moeda(r.price)}</strong></article>\n      <article class="card-indicador"><span>% da renda mensal</span><strong>${U.percentual(r.income_percent)}</strong></article>\n      <article class="card-indicador"><span>Dias de trabalho</span><strong>${U.numero(r.work_days)} dias</strong></article>\n      <article class="card-indicador"><span>Horas de trabalho</span><strong>${U.numero(r.work_hours)} horas</strong></article>\n      ${r.custo_de_uso.por_mes ? `<article class="card-indicador" title="Preço total dividido pelos meses de uso que você espera. É estimativa sua, não medição.">\n        <span>Custo por mês de uso</span><strong>${U.moeda(r.custo_de_uso.por_mes)}</strong></article>` : ""}\n      ${r.custo_de_uso.quantidade > 1 ? `<article class="card-indicador"><span>Total por ${r.custo_de_uso.quantidade} unidades</span><strong>${U.moeda(r.custo_de_uso.total)}</strong></article>` : ""}`;
    const G = R.GLOSSARIO;
    const linha = (chave, valor, classe = "") => `\n      <li title="${U.escapeHTML(G[chave].definicao)}">\n        <span>${U.escapeHTML(G[chave].rotulo)}\n          <small class="indicador-quando">${U.escapeHTML(G[chave].referencia)}</small>\n        </span>\n        <strong class="${classe}">${valor}</strong>\n      </li>`;
    document.getElementById("impactoOrcamento").innerHTML = `\n      <ul class="lista-resumo lista-resumo--glossario">\n        ${linha("saldo_atual", U.moeda(r.saldo_antes))}\n        <li title="Saldo atual menos o preço desta compra.">\n          <span>Saldo após a compra <small class="indicador-quando">se comprar hoje</small></span>\n          <strong class="${r.compromete_saldo ? "cor-vermelha" : ""}">${U.moeda(r.saldo_depois)}</strong>\n        </li>\n        ${r.deficit_fixos > 0 ? linha("deficit_fixos", `− ${U.moeda(r.deficit_fixos)}`, "cor-vermelha") : linha("sobra_apos_fixos", U.moeda(r.sobra_apos_fixos))}\n        ${r.compromissos_futuros > 0 ? linha("compromissos_futuros", U.moeda(r.compromissos_futuros)) : ""}\n        ${linha("disponivel_projetado", U.moeda(r.disponivel_projetado), r.disponivel_projetado < 0 ? "cor-vermelha" : "")}\n        <li title="Fatia da sobra após os fixos que esta compra consome.">\n          <span>Fatia da sobra comprometida <small class="indicador-quando">neste mês</small></span>\n          <strong>${r.renda_livre > 0 ? U.percentual(r.percentual_renda_livre) : "sem sobra"}</strong>\n        </li>\n        <li><span>Valor do seu dia / hora</span><strong>${U.moeda(r.valor_dia)} / ${U.moeda(r.valor_hora)}</strong></li>\n      </ul>\n      ${r.compromete_saldo ? `<p class="alerta">Esta compra deixa seu saldo negativo em ${U.moeda(Math.abs(r.saldo_depois))}.</p>` : r.compromete_projetado ? `<p class="alerta">Cabe no saldo de hoje, mas não no disponível projetado: faltariam ${U.moeda(Math.abs(r.disponivel_depois))} para cobrir os compromissos já assumidos.</p>` : ""}\n      ${r.deficit_fixos > 0 ? `<p class="alerta">Suas despesas fixas superam a renda em ${U.moeda(r.deficit_fixos)} por mês. Enquanto isso durar, toda compra sai da reserva.</p>` : ""}`;
    const metasHost = document.getElementById("impactoMetas");
    metasHost.innerHTML = r.impacto_metas.length ? r.impacto_metas.map(m => `\n          <article class="card-impacto-meta">\n            <h5>${U.escapeHTML(m.nome)}</h5>\n            <p>Faltam ${U.moeda(m.falta)} para concluir.</p>\n            <p>Esta compra equivale a <strong>${U.percentual(m.percentual_da_meta, 1)}</strong> do alvo total\n               e a <strong>${U.percentual(m.percentual_do_restante, 1)}</strong> do que ainda falta,\n               ou cerca de <strong>${U.numero(m.dias_trabalho_extra, 1)} dias</strong> de trabalho a mais para alcançá-la.</p>\n            ${m.cobre_a_meta ? `<p class="destaque">Com este valor você concluiria a meta hoje.</p>` : ""}\n          </article>`).join("") : `<p class="vazio">Você ainda não tem metas cadastradas. <a href="metas.html">Criar uma meta</a> ajuda a comparar prioridades.</p>`;
    document.getElementById("alternativas").innerHTML = r.alternativas.map(a => `\n      <li class="alternativa">\n        <h5>${U.escapeHTML(a.titulo)}</h5>\n        <p>${U.escapeHTML(a.texto)}</p>\n        ${a.faixa ? `<small>Hipótese de design do projeto: entre ${U.moeda(a.faixa.min)} e ${U.moeda(a.faixa.max)} a menos (referência de ${U.percentual(a.percentual * 100, 0)}). Não é dado de pesquisa — confirme com o preço real.</small>` : ""}\n        ${LOCAIS_POR_ALTERNATIVA[a.id] ? `<a class="alternativa__local" href="locais.html">${U.escapeHTML(LOCAIS_POR_ALTERNATIVA[a.id])}</a>` : ""}\n      </li>`).join("");
  }
  // ODS-006: cada alternativa aponta para os pontos reais que o usuário cadastrou.
  const LOCAIS_POR_ALTERNATIVA = {
    usado: "Ver brechós e usados que você cadastrou →",
    reparar: "Ver pontos de reparo que você cadastrou →",
    compartilhar: "Ver quem aluga ou empresta na sua região →"
  };
  const OPCOES = {
    necessidade: [ "Preciso agora", "Posso esperar", "É impulso" ],
    uso: [ "Uso diário", "Uso ocasional", "Uso raro" ],
    durabilidade: [ "Alta, com garantia", "Média", "Baixa ou descartável" ],
    alternativas: [ "Existe opção usada", "Posso emprestar/alugar", "Não há alternativa" ],
    orcamento: [ "Não compromete nada", "Aperta um pouco", "Compromete o essencial" ],
    descarte: [ "Uso por muitos anos", "Doo ou revendo depois", "Vai virar descarte rápido" ]
  };
  function renderReflexoes() {
    const form = document.getElementById("formReflexao");
    form.innerHTML = cfg.REFLEXOES.map(q => `\n      <fieldset class="reflexao">\n        <legend>${U.escapeHTML(q.dimensao)}</legend>\n        <p>${U.escapeHTML(q.pergunta)}</p>\n        <div class="opcoes-reflexao">\n          ${OPCOES[q.id].map((op, i) => `\n            <label class="chip">\n              <input type="radio" name="${q.id}" value="${U.escapeHTML(op)}" ${i === 0 ? "" : ""}>\n              <span>${U.escapeHTML(op)}</span>\n            </label>`).join("")}\n        </div>\n      </fieldset>`).join("");
    form.addEventListener("change", renderSintese);
    renderSintese();
  }
  function renderSintese() {
    const ind = R.indicadorResponsavel(coletarReflexoes());
    const host = document.getElementById("sinteseReflexao");
    if (!host) {
      return;
    }
    if (ind.pontuacao === null) {
      host.innerHTML = `<p class="nota">${U.escapeHTML(ind.sintese)}</p>`;
      return;
    }
    host.innerHTML = `\n      <article class="indicador-responsavel indicador-responsavel--${ind.nivel}">\n        <span class="indicador-responsavel__etiqueta">Indicador de decisão responsável</span>\n        <strong class="indicador-responsavel__valor">${ind.pontuacao}<small>/100</small></strong>\n        <p class="indicador-responsavel__rotulo">${U.escapeHTML(ind.rotulo)}</p>\n        <p>${U.escapeHTML(ind.sintese)}</p>\n        <p class="indicador-responsavel__cobertura">${ind.respondidas} de ${ind.total} perguntas respondidas.</p>\n      </article>\n      ${ind.alertas.length ? `<ul class="lista-alertas-reflexao">${ind.alertas.map(a => `<li><strong>${U.escapeHTML(a.dimensao)}:</strong> ${U.escapeHTML(a.texto)}</li>`).join("")}</ul>` : ""}\n      <details class="detalhes-hipoteses">\n        <summary>Como este número é calculado</summary>\n        <ul class="lista-simples">\n          ${ind.criterios.map(c => `<li>${U.escapeHTML(c.dimensao)}: ${c.respondida ? `${U.escapeHTML(c.resposta)} — ${c.pontos} de 2 pontos` : "sem resposta, fora da conta"}</li>`).join("")}\n        </ul>\n        <p class="nota">Cada pergunta vale de 0 a 2 pontos; o indicador é a soma dividida pelo máximo das perguntas respondidas.</p>\n        <p class="nota">${U.escapeHTML(ind.limitacao)}</p>\n      </details>`;
  }
  const coletarReflexoes = () => {
    const dados = {};
    new FormData(document.getElementById("formReflexao")).forEach((v, k) => {
      dados[k] = v;
    });
    return dados;
  };
  function renderDecisoes() {
    document.getElementById("opcoesDecisao").innerHTML = cfg.DECISOES.map(d => `\n      <button type="button" class="botao-decisao${d.consciente ? " botao-decisao--consciente" : ""}" data-decisao="${d.id}">\n        <strong>${U.escapeHTML(d.label)}</strong>\n        <small>+${d.xp} XP</small>\n      </button>`).join("");
    document.querySelectorAll("[data-decisao]").forEach(b => b.addEventListener("click", () => {
      decisao = b.dataset.decisao;
      document.querySelectorAll("[data-decisao]").forEach(x => x.classList.remove("ativo"));
      b.classList.add("ativo");
      document.getElementById("btnSalvarDecisao").disabled = false;
      document.getElementById("avisoDespesa").hidden = decisao !== "comprar";
    }));
  }
  const chaveCalculo = () => `${(entrada.item_name || "").toLowerCase().trim()}|${Number(entrada.price).toFixed(2)}|${U.hojeISO()}`;
  function montarRegistro(extra = {}) {
    return R.paraRegistro({
      ...entrada,
      resultado: resultado,
      perfil: ctx.perfil,
      note: document.getElementById("decisaoNota").value.trim() || entrada.note,
      ...extra
    });
  }
  async function cadastrarCalculo(extra = {}) {
    const registro = montarRegistro(extra);
    if (registroId) {
      const {analyzed_at: analyzed_at, ...campos} = registro;
      await S.atualizar("purchase_analyses", registroId, campos);
      return registroId;
    }
    const criado = await S.inserir("purchase_analyses", registro);
    registroId = criado.id;
    return registroId;
  }
  document.getElementById("btnRegistrarCalculo").addEventListener("click", async () => {
    if (!resultado) {
      return;
    }
    const botao = document.getElementById("btnRegistrarCalculo");
    botao.disabled = true;
    try {
      await cadastrarCalculo({
        decision: null
      });
      if (Number(entrada.price) >= cfg.XP.VALOR_MINIMO_CALCULO) {
        await G.premiar("calculo", {
          chave: chaveCalculo(),
          motivo: "cálculo real cadastrado"
        });
        window.FinckCalculos?.recarregar?.();
      }
      await G.sincronizarConquistas();
      document.getElementById("statusRegistro").innerHTML = `Cálculo cadastrado. <a href="#calculos" data-ir-aba="calculos">Ver meus cálculos reais →</a>`;
      U.toast("Cálculo cadastrado no seu histórico real.", "sucesso");
    } catch (err) {
      U.toast(err.message, "erro");
      botao.disabled = false;
    }
  });
  document.getElementById("btnSalvarDecisao").addEventListener("click", async () => {
    if (!resultado || !decisao) {
      return;
    }
    const botao = document.getElementById("btnSalvarDecisao");
    botao.disabled = true;
    try {
      const jaRegistrado = Boolean(registroId);
      const reflexoes = coletarReflexoes();
      // PROD-010 — a análise e a saída eram duas gravações soltas: se a segunda
      // falhasse, ficava uma decisão de "comprar" sem dinheiro saindo. Agora a
      // análise é gravada sem decisão, o lançamento vem antes (idempotente pela
      // chave da análise, então clicar duas vezes não duplica) e a decisão só é
      // registrada depois que o dinheiro se moveu de verdade.
      await cadastrarCalculo({
        decision: null,
        reflections: reflexoes
      });
      if (decisao === "comprar") {
        await S.operacao(S.chaveDeOperacao("compra_reality", registroId), () => S.inserir("transactions", {
          type: "saida",
          description: entrada.item_name,
          amount: entrada.price,
          date: U.hojeISO(),
          category: entrada.category,
          source: "reality"
        }), {
          operacao: "compra_reality"
        });
      }
      await S.atualizar("purchase_analyses", registroId, {
        decision: decisao,
        reflections: reflexoes
      });
      if (!jaRegistrado && Number(entrada.price) >= cfg.XP.VALOR_MINIMO_CALCULO) {
        await G.premiar("calculo", {
          chave: chaveCalculo(),
          motivo: "cálculo real cadastrado",
          silencioso: true
        });
      }
      const xp = cfg.DECISOES.find(d => d.id === decisao)?.xp || 5;
      await G.premiar("decisao", {
        chave: `${registroId}`,
        xp: xp,
        motivo: "decisão registrada"
      });
      window.FinckCalculos?.recarregar?.();
      await G.sincronizarConquistas();
      U.toast("Decisão registrada no seu histórico.", "sucesso");
      setTimeout(() => {
        window.FinckAbasReality?.trocar("calculos");
      }, 900);
    } catch (err) {
      U.toast(err.message, "erro");
      botao.disabled = false;
    }
  });
  document.getElementById("btnNovaAnalise").addEventListener("click", () => {
    resultado = null;
    entrada = null;
    decisao = null;
    registroId = null;
    document.getElementById("btnRegistrarCalculo").disabled = false;
    document.getElementById("statusRegistro").textContent = "";
    document.getElementById("formReality").reset();
    U.limparMoeda("itemPrice");
    [ "passoResultado", "passoReflexao", "passoDecisao" ].forEach(id => {
      document.getElementById(id).hidden = true;
    });
    document.getElementById("btnSalvarDecisao").disabled = true;
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
});
