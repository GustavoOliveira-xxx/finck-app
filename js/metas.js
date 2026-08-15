document.addEventListener("DOMContentLoaded", async () => {
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const G = window.FinckGame;

  const user = await window.FinckNav.iniciarPagina({ titulo: "Metas", subtitulo: "Planejamento" });
  if (!user) return;

  const M = window.FinckMetas;

  let metas = [];
  let perfil = null;
  let recorrentes = [];
  let movimentos = [];

  async function carregar() {

    [metas, perfil, recorrentes, movimentos] = await Promise.all([
      S.listar("goals", { ordem: "created_at", asc: false }),
      S.obterPerfil(),
      S.listar("recurring_transactions"),
      S.listar("goal_movements", { ordem: "date", asc: false }),
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
    const falta = foco ? Math.max(0, Number(foco.target_amount) - Number(foco.current_amount)) : 0;
    window.FinckFX?.mirarAlvo?.(
      progresso,
      foco ? foco.name : null,
      foco ? (falta > 0 ? `faltam ${U.moeda(falta)}` : "meta concluída") : null);

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
            <button type="button" class="btn-secundario btn-mini" data-retirar="${m.id}">Retirar</button>
            <button type="button" class="btn-secundario btn-mini" data-detalhe="${m.id}">Detalhes</button>
            <button type="button" class="btn-secundario btn-mini" data-editar="${m.id}">Editar</button>
            <button type="button" class="btn-excluir-item" data-excluir="${m.id}" aria-label="Excluir meta">✕</button>
          </div>
        </article>`;
    }).join("");

    host.querySelectorAll("[data-aporte]").forEach((b) => b.addEventListener("click", () => abrirAporte(b.dataset.aporte, "aporte")));
    host.querySelectorAll("[data-retirar]").forEach((b) => b.addEventListener("click", () => abrirAporte(b.dataset.retirar, "retirada")));
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
    window.FinckData.escrever("metaPrazo", m?.deadline ? String(m.deadline).slice(0, 10) : "");
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
      // O valor guardado nunca é escrito direto: ele vira um movimento de
      // ajuste no livro-razão e volta como cache recalculado. Assim uma meta
      // criada já com dinheiro continua sendo derivável do histórico.
      const { current_amount, ...semSaldo } = dados;

      if (id) {
        await S.atualizar("goals", id, semSaldo);
        await F.ajustarMeta(id, current_amount, "Saldo informado na edição da meta");
      } else {
        const nova = await S.inserir("goals", { ...semSaldo, current_amount: 0 });
        if (current_amount > 0) {
          await F.ajustarMeta(nova.id, current_amount, "Saldo informado na criação da meta");
        }
        await G.premiar("meta_criada", { motivo: "nova meta criada" });
      }
      await G.sincronizarConquistas();
      U.fecharModal("modalMeta");
      U.toast("Meta salva.", "sucesso");
      carregar();
    } catch (err) { U.toast(err.message, "erro"); }
  });

  let modoAporte = "aporte";

  function abrirAporte(id, modo = "aporte") {
    const m = metas.find((x) => String(x.id) === String(id));
    if (!m) return;
    modoAporte = modo;
    const guardado = Number(m.current_amount || 0);

    document.getElementById("aporteMetaId").value = m.id;
    document.getElementById("tituloAporte").textContent =
      modo === "retirada" ? "Retirar da meta" : "Aportar na meta";
    document.getElementById("aporteInfo").textContent = modo === "retirada"
      ? `${m.name} — você tem ${U.moeda(guardado)} guardados. A retirada volta para o caixa.`
      : `${m.name} — faltam ${U.moeda(Math.max(0, Number(m.target_amount) - guardado))}.`;
    document.getElementById("btnConfirmarAporte").textContent =
      modo === "retirada" ? "Registrar retirada" : "Registrar aporte";

    U.limparMoeda("aporteValor");
    U.abrirModal("modalAporte");
  }

  document.getElementById("formAporte").addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = document.getElementById("btnConfirmarAporte");
    const id = document.getElementById("aporteMetaId").value;
    const valor = U.lerMoeda("aporteValor");
    if (!(valor > 0)) return U.toast("Informe um valor maior que zero.", "erro");

    const meta = metas.find((x) => String(x.id) === String(id));
    const guardado = Number(meta?.current_amount || 0);
    if (modoAporte === "retirada" && valor > guardado + 0.005) {
      return U.toast(`Você tem ${U.moeda(guardado)} guardados nesta meta.`, "erro");
    }

    // Dois cliques rápidos e duas abas abertas mandam a mesma chave: a segunda
    // chamada devolve o resultado da primeira em vez de lançar de novo.
    const chave = S.chaveDeOperacao(modoAporte, id, valor.toFixed(2), Date.now().toString().slice(0, -4));
    botao.disabled = true;

    try {
      if (modoAporte === "retirada") {
        await F.retirarMeta(id, valor, `Retirada — ${meta?.name || "meta"}`, { chave });
        U.toast("Retirada registrada.", "sucesso");
      } else {
        await F.aportarMeta(id, valor, `Aporte — ${meta?.name || "meta"}`, { chave });
        await G.premiar("meta_aporte", { motivo: "aporte em meta" });
        const alvo = Number(meta?.target_amount || 0);
        if (alvo > 0 && guardado + valor >= alvo) {
          await G.premiar("meta_concluida", { chave: String(id), motivo: "meta concluída" });
        }
        U.toast("Aporte registrado.", "sucesso");
      }
      await G.sincronizarConquistas();
      U.fecharModal("modalAporte");
      carregar();
    } catch (err) {
      await S.registrarEvento({
        scope: "aporte",
        message: err.message,
        context: { meta: id, valor, modo: modoAporte },
      });
      U.toast(err.message, "erro");
    } finally {
      botao.disabled = false;
    }
  });

  const ROTULO_MOVIMENTO = {
    aporte: "Aporte", retirada: "Retirada", estorno: "Estorno", ajuste: "Ajuste",
  };

  async function abrirDetalhe(id) {
    const m = metas.find((x) => String(x.id) === String(id));
    if (!m) return;

    const transacoes = await S.listar("transactions", { ordem: "date", asc: false });
    const porTransacao = new Map(transacoes.map((t) => [String(t.id), t]));

    const livro = M.historico(movimentos, m.id);
    const derivado = M.progresso(livro);
    const cache = Number(m.current_amount || 0);
    const bate = Math.abs(cache - derivado) <= M.TOLERANCIA;

    const p = U.progresso(cache, m.target_amount);
    const falta = Math.max(0, Number(m.target_amount) - cache);

    const linhas = livro.map((mv) => {
      const t = mv.transaction_id ? porTransacao.get(String(mv.transaction_id)) : null;
      const estornado = Boolean(mv.reversed_at) || (t && t.reversed_at);
      const positivo = Number(mv.amount) > 0;
      const podeEstornar = !estornado && mv.kind !== "estorno" && t && !t.reversed_at;

      return `
        <li class="livro-linha${estornado ? " livro-linha--estornada" : ""}">
          <span class="livro-linha__selo livro-linha__selo--${mv.kind}">${ROTULO_MOVIMENTO[mv.kind] || mv.kind}</span>
          <span class="livro-linha__desc">
            ${U.escapeHTML(mv.note || ROTULO_MOVIMENTO[mv.kind] || "Movimento")}
            <small>${U.dataBR(mv.date)}${estornado ? " · estornado" : ""}</small>
          </span>
          <strong class="${positivo ? "cor-verde" : "cor-vermelha"}">
            ${positivo ? "+" : "−"} ${U.moeda(Math.abs(Number(mv.amount)))}
          </strong>
          ${podeEstornar
            ? `<button type="button" class="btn-secundario btn-mini" data-estornar="${t.id}" data-meta="${m.id}">Estornar</button>`
            : `<span class="livro-linha__vazio" aria-hidden="true"></span>`}
        </li>`;
    }).join("");

    document.getElementById("conteudoDetalheMeta").innerHTML = `
      <ul class="lista-resumo">
        <li><span>Meta</span><strong>${U.escapeHTML(m.name)}</strong></li>
        <li><span>Progresso</span><strong>${U.percentual(p, 1)}</strong></li>
        <li><span>Guardado</span><strong class="cor-verde">${U.moeda(cache)}</strong></li>
        <li><span>Falta</span><strong>${U.moeda(falta)}</strong></li>
        <li><span>Equivale a</span><strong>${U.numero(valorDia() > 0 ? falta / valorDia() : 0, 1)} dias de trabalho</strong></li>
        <li><span>Prazo</span><strong>${m.deadline ? U.dataBR(m.deadline) : "sem prazo"}</strong></li>
      </ul>

      <div class="livro-conferencia${bate ? " livro-conferencia--ok" : " livro-conferencia--divergente"}">
        <span class="livro-conferencia__icone" aria-hidden="true">${bate ? "✓" : "!"}</span>
        <div>
          <strong>${bate ? "Progresso confere com o histórico" : "Progresso não confere com o histórico"}</strong>
          <small>
            Soma dos ${livro.length} movimento(s): ${U.moeda(derivado)} ·
            valor guardado: ${U.moeda(cache)}${bate ? "" : ` · diferença de ${U.moeda(Math.abs(cache - derivado))}`}
          </small>
        </div>
      </div>

      <h4>Livro-razão da meta</h4>
      ${livro.length
        ? `<ul class="livro-lista">${linhas}</ul>`
        : `<p class="vazio">Nenhum movimento registrado. Aportes feitos daqui para frente aparecem aqui.</p>`}`;

    document.querySelectorAll("#conteudoDetalheMeta [data-estornar]").forEach((b) =>
      b.addEventListener("click", () => estornarDaMeta(b.dataset.estornar, b.dataset.meta)));

    U.abrirModal("modalDetalheMeta");
  }

  // Movimentação vinculada a meta não é excluída: ela é estornada, com motivo,
  // e o progresso volta exatamente uma vez.
  async function estornarDaMeta(transacaoId, metaId) {
    const motivo = prompt("Por que este movimento está sendo estornado?", "Lançamento incorreto");
    if (motivo === null) return;

    try {
      const r = await F.estornarTransacao(transacaoId, {
        motivo: motivo.trim() || "Estorno solicitado pelo usuário",
        chave: S.chaveDeOperacao("estorno", transacaoId),
      });
      U.toast(r.repetida ? "Este movimento já estava estornado." : "Movimento estornado. O histórico foi preservado.",
              r.repetida ? "info" : "sucesso");
      U.fecharModal("modalDetalheMeta");
      await carregar();
      abrirDetalhe(metaId);
    } catch (err) {
      await S.registrarEvento({ scope: "estorno", message: err.message, context: { transacao: transacaoId } });
      U.toast(err.message, "erro");
    }
  }

  carregar();
});
