document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const R = window.FinckReality;
  const G = window.FinckGame;

  const user = await window.FinckNav.iniciarPagina({ titulo: "FinCK of Reality", subtitulo: "Cálculo realista de compra" });
  if (!user) return;

  let ctx = await F.carregarContexto();
  let resultado = null;
  let entrada = null;
  let decisao = null;
  let registroId = null;

  document.getElementById("itemCategory").innerHTML =
    cfg.CATEGORIAS.map((c) => `<option value="${c}">${c}</option>`).join("");

  document.getElementById("formReality").addEventListener("submit", async (e) => {
    e.preventDefault();
    const item_name = document.getElementById("itemName").value.trim();
    const price = U.lerMoeda("itemPrice");
    const category = document.getElementById("itemCategory").value;
    const note = document.getElementById("itemNote").value.trim();
    let item_link = document.getElementById("itemLink").value.trim();

    if (!item_name) return U.toast("Informe o item desejado.", "erro");
    if (!(price > 0)) return U.toast("Informe um preço maior que zero.", "erro");
    if (item_link && !/^https?:\/\//i.test(item_link)) item_link = `https://${item_link}`;
    if (item_link) {
      try { new URL(item_link); }
      catch { return U.toast("O link do item parece inválido. Confira o endereço.", "erro"); }
    }

    ctx = await F.carregarContexto();
    if (!(Number(ctx.perfil?.income_monthly) > 0)) {
      U.toast("Informe sua renda mensal no Perfil para usar o FinCK of Reality.", "erro");
      return;
    }

    entrada = { item_name, price, category, note, item_link: item_link || null };
    resultado = R.calcular(price, ctx.perfil, {
      saldo: ctx.saldo,
      despesasFixas: ctx.despesasFixas,
      metas: ctx.metas,
    });

    renderResultado();
    renderReflexoes();
    renderDecisoes();
    document.getElementById("passoResultado").hidden = false;
    document.getElementById("passoReflexao").hidden = false;
    document.getElementById("passoDecisao").hidden = false;
    document.getElementById("passoResultado").scrollIntoView({ behavior: "smooth" });

    document.getElementById("btnRegistrarCalculo").disabled = false;
    document.getElementById("statusRegistro").textContent =
      "Cálculo ainda não cadastrado. Registre para guardar no seu histórico real.";
  });

  function renderResultado() {
    const r = resultado;

    document.getElementById("semaforo").innerHTML = `
      <div class="semaforo-card semaforo--${r.semaforo.nivel}">
        <strong>${r.semaforo.titulo}</strong>
        <p>${r.semaforo.texto}</p>
      </div>`;

    document.getElementById("indicadores").innerHTML = `
      <article class="card-indicador"><span>Preço</span><strong>${U.moeda(r.price)}</strong></article>
      <article class="card-indicador"><span>% da renda mensal</span><strong>${U.percentual(r.income_percent)}</strong></article>
      <article class="card-indicador"><span>Dias de trabalho</span><strong>${U.numero(r.work_days)} dias</strong></article>
      <article class="card-indicador"><span>Horas de trabalho</span><strong>${U.numero(r.work_hours)} horas</strong></article>`;

    document.getElementById("impactoOrcamento").innerHTML = `
      <ul class="lista-resumo">
        <li><span>Saldo hoje</span><strong>${U.moeda(r.saldo_antes)}</strong></li>
        <li><span>Saldo após a compra</span>
            <strong class="${r.compromete_saldo ? "cor-vermelha" : ""}">${U.moeda(r.saldo_depois)}</strong></li>
        <li><span>Renda livre (após despesas fixas)</span><strong>${U.moeda(r.renda_livre)}</strong></li>
        <li><span>% da renda livre comprometida</span><strong>${U.percentual(r.percentual_renda_livre)}</strong></li>
        <li><span>Valor do seu dia / hora</span><strong>${U.moeda(r.valor_dia)} / ${U.moeda(r.valor_hora)}</strong></li>
      </ul>
      ${r.compromete_saldo ? `<p class="alerta">Esta compra deixa seu saldo negativo em ${U.moeda(Math.abs(r.saldo_depois))}.</p>` : ""}`;

    const metasHost = document.getElementById("impactoMetas");
    metasHost.innerHTML = r.impacto_metas.length
      ? r.impacto_metas.map((m) => `
          <article class="card-impacto-meta">
            <h5>${U.escapeHTML(m.nome)}</h5>
            <p>Faltam ${U.moeda(m.falta)} para concluir.</p>
            <p>Esta compra equivale a <strong>${U.percentual(m.percentual_da_meta, 1)}</strong> do alvo total
               e a <strong>${U.percentual(m.percentual_do_restante, 1)}</strong> do que ainda falta,
               ou cerca de <strong>${U.numero(m.dias_trabalho_extra, 1)} dias</strong> de trabalho a mais para alcançá-la.</p>
            ${m.cobre_a_meta ? `<p class="destaque">Com este valor você concluiria a meta hoje.</p>` : ""}
          </article>`).join("")
      : `<p class="vazio">Você ainda não tem metas cadastradas. <a href="metas.html">Criar uma meta</a> ajuda a comparar prioridades.</p>`;

    document.getElementById("alternativas").innerHTML = r.alternativas.map((a) => `
      <li class="alternativa">
        <h5>${U.escapeHTML(a.titulo)}</h5>
        <p>${U.escapeHTML(a.texto)}</p>
        ${a.economia > 0
          ? `<small>Hipótese ilustrativa: economia de até ${U.moeda(a.economia)} — confirme com o preço real.</small>`
          : ""}
      </li>`).join("");
  }

  const OPCOES = {
    necessidade: ["Preciso agora", "Posso esperar", "É impulso"],
    uso: ["Uso diário", "Uso ocasional", "Uso raro"],
    durabilidade: ["Alta, com garantia", "Média", "Baixa ou descartável"],
    alternativas: ["Existe opção usada", "Posso emprestar/alugar", "Não há alternativa"],
    orcamento: ["Não compromete nada", "Aperta um pouco", "Compromete o essencial"],
    descarte: ["Uso por muitos anos", "Doo ou revendo depois", "Vai virar descarte rápido"],
  };

  function renderReflexoes() {
    document.getElementById("formReflexao").innerHTML = cfg.REFLEXOES.map((q) => `
      <fieldset class="reflexao">
        <legend>${U.escapeHTML(q.dimensao)}</legend>
        <p>${U.escapeHTML(q.pergunta)}</p>
        <div class="opcoes-reflexao">
          ${OPCOES[q.id].map((op, i) => `
            <label class="chip">
              <input type="radio" name="${q.id}" value="${U.escapeHTML(op)}" ${i === 0 ? "" : ""}>
              <span>${U.escapeHTML(op)}</span>
            </label>`).join("")}
        </div>
      </fieldset>`).join("");
  }

  const coletarReflexoes = () => {
    const dados = {};
    new FormData(document.getElementById("formReflexao")).forEach((v, k) => { dados[k] = v; });
    return dados;
  };

  function renderDecisoes() {
    document.getElementById("opcoesDecisao").innerHTML = cfg.DECISOES.map((d) => `
      <button type="button" class="botao-decisao${d.consciente ? " botao-decisao--consciente" : ""}" data-decisao="${d.id}">
        <strong>${U.escapeHTML(d.label)}</strong>
        <small>+${d.xp} XP</small>
      </button>`).join("");

    document.querySelectorAll("[data-decisao]").forEach((b) =>
      b.addEventListener("click", () => {
        decisao = b.dataset.decisao;
        document.querySelectorAll("[data-decisao]").forEach((x) => x.classList.remove("ativo"));
        b.classList.add("ativo");
        document.getElementById("btnSalvarDecisao").disabled = false;
        document.getElementById("avisoDespesa").hidden = decisao !== "comprar";
      })
    );
  }

  const chaveCalculo = () =>
    `${(entrada.item_name || "").toLowerCase().trim()}|${Number(entrada.price).toFixed(2)}|${U.hojeISO()}`;

  function montarRegistro(extra = {}) {
    return R.paraRegistro({
      ...entrada,
      resultado,
      perfil: ctx.perfil,
      note: document.getElementById("decisaoNota").value.trim() || entrada.note,
      ...extra,
    });
  }

  async function cadastrarCalculo(extra = {}) {
    const registro = montarRegistro(extra);
    if (registroId) {
      const { analyzed_at, ...campos } = registro;
      await S.atualizar("purchase_analyses", registroId, campos);
      return registroId;
    }
    const criado = await S.inserir("purchase_analyses", registro);
    registroId = criado.id;
    return registroId;
  }

  document.getElementById("btnRegistrarCalculo").addEventListener("click", async () => {
    if (!resultado) return;
    const botao = document.getElementById("btnRegistrarCalculo");
    botao.disabled = true;
    try {
      await cadastrarCalculo({ decision: null });

      if (Number(entrada.price) >= cfg.XP.VALOR_MINIMO_CALCULO) {
        await G.premiar("calculo", { chave: chaveCalculo(), motivo: "cálculo real cadastrado" });
        window.FinckCalculos?.recarregar?.();
      }
      await G.sincronizarConquistas();
      document.getElementById("statusRegistro").innerHTML =
        `Cálculo cadastrado. <a href="#calculos" data-ir-aba="calculos">Ver meus cálculos reais →</a>`;
      U.toast("Cálculo cadastrado no seu histórico real.", "sucesso");
    } catch (err) {
      U.toast(err.message, "erro");
      botao.disabled = false;
    }
  });

  document.getElementById("btnSalvarDecisao").addEventListener("click", async () => {
    if (!resultado || !decisao) return;
    const botao = document.getElementById("btnSalvarDecisao");
    botao.disabled = true;

    try {
      const jaRegistrado = Boolean(registroId);
      await cadastrarCalculo({ decision: decisao, reflections: coletarReflexoes() });

      if (decisao === "comprar") {
        await S.inserir("transactions", {
          type: "saida",
          description: entrada.item_name,
          amount: entrada.price,
          date: U.hojeISO(),
          category: entrada.category,
          source: "reality",
        });
      }

      if (!jaRegistrado && Number(entrada.price) >= cfg.XP.VALOR_MINIMO_CALCULO) {
        await G.premiar("calculo", { chave: chaveCalculo(), motivo: "cálculo real cadastrado", silencioso: true });
      }
      const xp = cfg.DECISOES.find((d) => d.id === decisao)?.xp || 5;
      await G.premiar("decisao", { chave: `${registroId}`, xp, motivo: "decisão registrada" });
      window.FinckCalculos?.recarregar?.();
      await G.sincronizarConquistas();

      U.toast("Decisão registrada no seu histórico.", "sucesso");
      setTimeout(() => { window.FinckAbasReality?.trocar("calculos"); }, 900);
    } catch (err) {
      U.toast(err.message, "erro");
      botao.disabled = false;
    }
  });

  document.getElementById("btnNovaAnalise").addEventListener("click", () => {
    resultado = null; entrada = null; decisao = null; registroId = null;
    document.getElementById("btnRegistrarCalculo").disabled = false;
    document.getElementById("statusRegistro").textContent = "";
    document.getElementById("formReality").reset();
    U.limparMoeda("itemPrice");
    ["passoResultado", "passoReflexao", "passoDecisao"].forEach((id) => {
      document.getElementById(id).hidden = true;
    });
    document.getElementById("btnSalvarDecisao").disabled = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});
