document.addEventListener("DOMContentLoaded", async () => {
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const G = window.FinckGame;

  const user = await window.FinckNav.iniciarPagina({ titulo: "Metas", subtitulo: "Planejamento" });
  if (!user) return;

  let metas = [];
  let perfil = null;
  let recorrentes = [];

  async function carregar() {

    [metas, perfil, recorrentes] = await Promise.all([
      S.listar("goals", { ordem: "created_at", asc: false }),
      S.obterPerfil(),
      S.listar("recurring_transactions"),
    ]);
    renderResumo();
    renderAlvo();
    renderLista();
  }

  function renderAlvo() {
    const abertas = metas.filter((m) => Number(m.target_amount) > 0);
    const emAberto = abertas.filter((m) => Number(m.current_amount) < Number(m.target_amount));
    const ordenadas = (emAberto.length ? emAberto : abertas)
      .slice()
      .sort((a, b) => U.progresso(b.current_amount, b.target_amount) - U.progresso(a.current_amount, a.target_amount));

    const foco = ordenadas[0];
    const progresso = foco ? U.progresso(foco.current_amount, foco.target_amount) : 0;
    window.FinckFX?.mirarAlvo?.(progresso, foco ? foco.name : null);

    const legenda = document.getElementById("alvoLegenda");
    if (!legenda) return;

    if (!abertas.length) {
      legenda.innerHTML = "";
      return;
    }

    const cores = ["var(--amarelo)", "var(--roxo-neon)", "var(--verde)"];
    legenda.innerHTML = ordenadas.slice(0, 3).map((m, i) => {
      const p = U.progresso(m.current_amount, m.target_amount);
      return `
        <li>
          <span class="alvo-legenda__ponto" style="--cor:${cores[i]}"></span>
          <span class="alvo-legenda__nome">${U.escapeHTML(m.name)}</span>
          <span class="alvo-legenda__pct">${U.percentual(p, 0)}</span>
        </li>`;
    }).join("");
  }

  const valorDia = () => {
    const renda = Number(perfil?.income_monthly || 0);
    const dias = Number(perfil?.work_days_month || 22);
    return renda > 0 ? renda / dias : 0;
  };

  const rendaLivre = () => {
    const renda = Number(perfil?.income_monthly || 0);
    const fixas = recorrentes
      .filter((r) => r.active !== false && r.type === "saida")
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    return Math.max(0, renda - fixas);
  };

  function renderResumo() {
    const alvo = F.soma(metas, "target_amount");
    const atual = F.soma(metas, "current_amount");
    const concluidas = metas.filter((m) => Number(m.current_amount) >= Number(m.target_amount) && Number(m.target_amount) > 0).length;
    document.getElementById("resumoMetas").innerHTML = `
      <article class="card-indicador"><span>Metas ativas</span><strong>${metas.length - concluidas}</strong></article>
      <article class="card-indicador"><span>Concluídas</span><strong>${concluidas}</strong></article>
      <article class="card-indicador"><span>Total guardado</span><strong class="cor-verde">${U.moeda(atual)}</strong></article>
      <article class="card-indicador"><span>Objetivo total</span><strong>${U.moeda(alvo)}</strong></article>`;
  }

  function ritmoDaMeta(m, falta) {
    if (!m.deadline || falta <= 0) return "";

    const hoje = new Date();
    const prazo = new Date(`${String(m.deadline).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(prazo.getTime())) return "";

    const meses = (prazo.getFullYear() - hoje.getFullYear()) * 12 + (prazo.getMonth() - hoje.getMonth());

    if (meses <= 0) {
      return `<p class="ritmo-meta ritmo-meta--vencida">
                O prazo já passou. Faltam ${U.moeda(falta)} — vale remarcar a data.
              </p>`;
    }

    const porMes = falta / meses;
    const livre = rendaLivre();
    const cabe = livre <= 0 ? null : porMes <= livre;
    const fatia = livre > 0 ? (porMes / livre) * 100 : 0;

    const veredito =
      cabe === null ? "Preencha sua renda no perfil para saber se esse ritmo cabe."
      : cabe ? `Cabe na sua renda livre — ${U.percentual(fatia, 0)} dela.`
      : `Acima da sua renda livre de ${U.moeda(livre)}. Vale esticar o prazo ou reduzir o alvo.`;

    return `<p class="ritmo-meta${cabe === false ? " ritmo-meta--apertada" : ""}">
              <strong>${U.moeda(porMes)}/mês</strong> por ${meses} ${meses === 1 ? "mês" : "meses"}. ${veredito}
            </p>`;
  }

  function renderLista() {
    const host = document.getElementById("listaMetas");
    document.getElementById("vazioMetas").hidden = metas.length > 0;

    host.innerHTML = metas.map((m) => {
      const p = U.progresso(m.current_amount, m.target_amount);
      const falta = Math.max(0, Number(m.target_amount) - Number(m.current_amount));
      const dias = valorDia() > 0 ? falta / valorDia() : 0;
      const concluida = p >= 100;
      return `
        <article class="card-meta${concluida ? " card-meta--concluida" : ""}">
          <header>
            <h4>${U.escapeHTML(m.name)}</h4>
            ${concluida ? `<span class="selo">Concluída</span>` : ""}
          </header>
          <div class="barra"><div class="barra-preenchida" style="width:${p}%"></div></div>
          <p>${U.moeda(m.current_amount)} de ${U.moeda(m.target_amount)} · ${U.percentual(p, 0)}</p>
          <p class="nota">Faltam ${U.moeda(falta)} — cerca de ${U.numero(dias, 1)} dias de trabalho.</p>
          ${concluida ? "" : ritmoDaMeta(m, falta)}
          ${m.deadline ? `<small>Prazo: ${U.dataBR(m.deadline)}</small>` : ""}
          <div class="acoes-card">
            <button type="button" class="btn-secundario btn-mini" data-aporte="${m.id}">Aportar</button>
            <button type="button" class="btn-secundario btn-mini" data-detalhe="${m.id}">Detalhes</button>
            <button type="button" class="btn-secundario btn-mini" data-editar="${m.id}">Editar</button>
            <button type="button" class="btn-excluir-item" data-excluir="${m.id}" aria-label="Excluir meta">✕</button>
          </div>
        </article>`;
    }).join("");

    host.querySelectorAll("[data-aporte]").forEach((b) => b.addEventListener("click", () => abrirAporte(b.dataset.aporte)));
    host.querySelectorAll("[data-detalhe]").forEach((b) => b.addEventListener("click", () => abrirDetalhe(b.dataset.detalhe)));
    host.querySelectorAll("[data-editar]").forEach((b) => b.addEventListener("click", () => abrirMeta(b.dataset.editar)));
    host.querySelectorAll("[data-excluir]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Excluir esta meta? As transações vinculadas serão mantidas.")) return;
        await S.remover("goals", b.dataset.excluir);
        U.toast("Meta excluída.", "info");
        carregar();
      })
    );
  }

  function abrirMeta(id) {
    const m = metas.find((x) => String(x.id) === String(id));
    document.getElementById("tituloMeta").textContent = m ? "Editar meta" : "Nova meta";
    document.getElementById("metaId").value = m?.id || "";
    document.getElementById("metaNome").value = m?.name || "";
    U.escreverMoeda("metaAlvo", m?.target_amount || 0);
    U.escreverMoeda("metaAtual", m?.current_amount || 0);
    window.FinckData.ler("metaPrazo") = m?.deadline ? String(m.deadline).slice(0, 10) : "";
    document.getElementById("metaTaxa").value = m?.rate || 0;
    U.abrirModal("modalMeta");
  }
  document.getElementById("btnNovaMeta").addEventListener("click", () => abrirMeta(null));

  document.getElementById("formMeta").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("metaId").value;
    const dados = {
      name: document.getElementById("metaNome").value.trim(),
      target_amount: U.lerMoeda("metaAlvo"),
      current_amount: U.lerMoeda("metaAtual"),
      deadline: window.FinckData.ler("metaPrazo") || null,
      rate: Number(document.getElementById("metaTaxa").value) || 0,
    };
    if (!dados.name) return U.toast("Informe o nome da meta.", "erro");
    if (!(dados.target_amount > 0)) return U.toast("Informe um valor total maior que zero.", "erro");

    try {
      if (id) await S.atualizar("goals", id, dados);
      else { await S.inserir("goals", dados); await G.premiar("meta_criada", { motivo: "nova meta criada" }); }
      await G.sincronizarConquistas();
      U.fecharModal("modalMeta");
      U.toast("Meta salva.", "sucesso");
      carregar();
    } catch (err) { U.toast(err.message, "erro"); }
  });

  function abrirAporte(id) {
    const m = metas.find((x) => String(x.id) === String(id));
    if (!m) return;
    document.getElementById("aporteMetaId").value = m.id;
    document.getElementById("aporteInfo").textContent =
      `${m.name} — faltam ${U.moeda(Math.max(0, Number(m.target_amount) - Number(m.current_amount)))}.`;
    U.limparMoeda("aporteValor");
    U.abrirModal("modalAporte");
  }

  document.getElementById("formAporte").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("aporteMetaId").value;
    const valor = U.lerMoeda("aporteValor");
    if (!(valor > 0)) return U.toast("Informe um valor maior que zero.", "erro");
    try {
      const meta = metas.find((x) => String(x.id) === String(id));
      await F.aportarMeta(id, valor, `Aporte — ${meta?.name || "meta"}`);
      await G.premiar("meta_aporte", { motivo: "aporte em meta" });
      const alvo = Number(meta?.target_amount || 0);
      const atingiu = alvo > 0 && Number(meta?.current_amount || 0) + valor >= alvo;
      if (atingiu) await G.premiar("meta_concluida", { chave: String(id), motivo: "meta concluída" });
      await G.sincronizarConquistas();
      U.fecharModal("modalAporte");
      U.toast("Aporte registrado.", "sucesso");
      carregar();
    } catch (err) { U.toast(err.message, "erro"); }
  });

  async function abrirDetalhe(id) {
    const m = metas.find((x) => String(x.id) === String(id));
    if (!m) return;
    const transacoes = await S.listar("transactions", { ordem: "date", asc: false });
    const vinculadas = transacoes.filter((t) => String(t.goal_id) === String(m.id));
    const p = U.progresso(m.current_amount, m.target_amount);
    const falta = Math.max(0, Number(m.target_amount) - Number(m.current_amount));

    document.getElementById("conteudoDetalheMeta").innerHTML = `
      <ul class="lista-resumo">
        <li><span>Meta</span><strong>${U.escapeHTML(m.name)}</strong></li>
        <li><span>Progresso</span><strong>${U.percentual(p, 1)}</strong></li>
        <li><span>Guardado</span><strong class="cor-verde">${U.moeda(m.current_amount)}</strong></li>
        <li><span>Falta</span><strong>${U.moeda(falta)}</strong></li>
        <li><span>Equivale a</span><strong>${U.numero(valorDia() > 0 ? falta / valorDia() : 0, 1)} dias de trabalho</strong></li>
        <li><span>Prazo</span><strong>${m.deadline ? U.dataBR(m.deadline) : "sem prazo"}</strong></li>
      </ul>
      <h4>Movimentações vinculadas</h4>
      ${vinculadas.length
        ? `<ul class="lista-simples">${vinculadas.map((t) => `
            <li class="item-lista">
              <span>${U.escapeHTML(t.description)}</span>
              <span>${U.dataBR(t.date)}</span>
              <strong class="${t.type === "entrada" ? "cor-verde" : "cor-vermelha"}">${U.moeda(t.amount)}</strong>
            </li>`).join("")}</ul>`
        : `<p class="vazio">Nenhuma movimentação vinculada.</p>`}`;
    U.abrirModal("modalDetalheMeta");
  }

  carregar();
});
