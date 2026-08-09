/* ============================================================
   FinCK v2 — Dashboard (home)
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const R = window.FinckReality;
  const G = window.FinckGame;

  const user = await window.FinckNav.iniciarPagina({ titulo: "FinCK", subtitulo: "Consumo consciente" });
  if (!user) return;

  let pendente = null;

  /* ---------- selects estáticos ---------- */
  document.getElementById("categoria").innerHTML =
    cfg.CATEGORIAS.map((c) => `<option value="${c}">${c}</option>`).join("");
  document.getElementById("data").value = U.hojeISO();

  async function render() {
    const ctx = await F.carregarContexto();
    const resumo = R.resumoHistorico(ctx.analises);
    const game = await S.obterGamificacao();
    const nivel = G.nivelDe(game.xp);

    /* saudação */
    document.getElementById("saudacao").textContent =
      `${U.saudacao()}, ${ctx.perfil?.name || "por aqui"}!`;

    /* saldo */
    document.getElementById("saldoAtual").textContent = U.moeda(ctx.saldo);
    document.getElementById("entradasMes").textContent = U.moeda(ctx.entradasMes);
    document.getElementById("saidasMes").textContent = U.moeda(ctx.saidasMes);
    document.getElementById("rendaLivre").textContent = U.moeda(ctx.rendaLivre);

    /* valor do tempo */
    const dias = Number(ctx.perfil?.work_days_month) || cfg.PADRAO.work_days_month;
    const horas = Number(ctx.perfil?.work_hours_day) || cfg.PADRAO.work_hours_day;
    const valorDia = (Number(ctx.perfil?.income_monthly) || 0) / dias;
    const valorHora = valorDia / horas;
    document.getElementById("valorDia").textContent = U.moeda(valorDia);
    document.getElementById("valorHora").textContent = U.moeda(valorHora);

    /* prisma: a renda livre traduzida em quatro unidades.
       O número é sempre o mesmo — muda só a régua usada para medi-lo.
       Usa exatamente o ctx.rendaLivre do cartão de saldo (renda do mês
       menos despesas fixas), e não a "sobra prevista" do bloco de
       orçamento, que parte das entradas recorrentes quando existem. */
    const sobra = ctx.rendaLivre;
    document.getElementById("prismaReais").textContent = U.moeda(sobra);
    document.getElementById("prismaHoras").textContent =
      valorHora > 0 ? `${U.numero(sobra / valorHora, 0)} h` : "—";
    document.getElementById("prismaDias").textContent =
      valorDia > 0 ? `${U.numero(sobra / valorDia, 1)} dias` : "—";

    const faceMetaRotulo = document.getElementById("prismaMetaRotulo");
    const faceMetaValor = document.getElementById("prismaMeta");
    const faceMetaNota = document.getElementById("prismaMetaNota");
    // meta mais perto de fechar entre as que ainda não fecharam
    const emAberto = ctx.metas
      .filter((m) => Number(m.current_amount || 0) < Number(m.target_amount || 0))
      .sort((a, b) =>
        (a.target_amount - a.current_amount) - (b.target_amount - b.current_amount));

    if (emAberto.length) {
      const alvo = emAberto[0];
      const falta = Number(alvo.target_amount) - Number(alvo.current_amount);
      faceMetaRotulo.textContent = "Na meta mais perto";
      faceMetaValor.textContent = U.percentual(Math.min(100, (sobra / falta) * 100), 0);
      faceMetaNota.textContent = `de "${alvo.name}" — ainda faltam ${U.moeda(falta)}`;
    } else if (ctx.metas.length) {
      faceMetaRotulo.textContent = "Suas metas";
      faceMetaValor.textContent = "100%";
      faceMetaNota.textContent = "todas as metas já foram alcançadas";
    } else {
      faceMetaRotulo.textContent = "Na sua meta";
      faceMetaValor.textContent = "—";
      faceMetaNota.textContent = "crie uma meta para ver esta face";
    }

    /* indicadores conscientes */
    document.getElementById("indEvitadas").textContent = resumo.evitadas;
    document.getElementById("indEconomia").textContent = U.moeda(resumo.economia);
    document.getElementById("indHoras").textContent = `${U.numero(resumo.horas_preservadas, 1)} h`;
    document.getElementById("indNivel").textContent = nivel.level;

    /* orçamento previsto */
    const previstoSaida = ctx.despesasFixas;
    const previstoEntrada = ctx.previstoEntradas || Number(ctx.perfil?.income_monthly || 0);
    const comprometido = previstoEntrada > 0 ? (previstoSaida / previstoEntrada) * 100 : 0;
    document.getElementById("orcamento").innerHTML = `
      <ul class="lista-resumo">
        <li><span>Entradas previstas</span><strong class="cor-verde">${U.moeda(previstoEntrada)}</strong></li>
        <li><span>Despesas fixas previstas</span><strong class="cor-vermelha">${U.moeda(previstoSaida)}</strong></li>
        <li><span>Sobra prevista</span><strong>${U.moeda(previstoEntrada - previstoSaida)}</strong></li>
      </ul>
      <div class="barra" role="img" aria-label="Percentual da renda comprometido com despesas fixas">
        <div class="barra-preenchida" style="width:${Math.min(100, comprometido)}%"></div>
      </div>
      <p class="nota">${U.percentual(comprometido, 1)} da renda prevista já está comprometida com despesas fixas.</p>`;

    /* metas */
    const metasHost = document.getElementById("metasResumo");
    metasHost.innerHTML = ctx.metas.length
      ? ctx.metas.slice(0, 3).map((m) => {
          const p = U.progresso(m.current_amount, m.target_amount);
          return `
            <article class="card-meta">
              <h3>${U.escapeHTML(m.name)}</h3>
              <div class="barra"><div class="barra-preenchida" style="width:${p}%"></div></div>
              <p>${U.moeda(m.current_amount)} de ${U.moeda(m.target_amount)} · ${U.percentual(p, 0)}</p>
            </article>`;
        }).join("")
      : `<p class="vazio">Você ainda não criou metas. <a href="metas.html">Criar a primeira</a>.</p>`;

    /* transações */
    const lista = document.getElementById("lista");
    const vazio = document.getElementById("vazio");
    const ultimas = ctx.transacoes.slice(0, 8);
    vazio.hidden = ultimas.length > 0;
    lista.innerHTML = ultimas.map((t) => `
      <article class="item-transacao ${t.type}">
        <div class="item-info">
          <h4>${U.escapeHTML(t.description)}</h4>
          <small>${U.escapeHTML(t.category || "Outros")} · ${U.dataBR(t.date)}</small>
        </div>
        <div class="item-lado">
          <strong class="${t.type === "entrada" ? "cor-verde" : "cor-vermelha"}">
            ${t.type === "entrada" ? "+" : "−"} ${U.moeda(t.amount)}
          </strong>
          <button type="button" class="btn-excluir-item" data-excluir="${t.id}" aria-label="Excluir movimentação">✕</button>
        </div>
      </article>`).join("");

    lista.querySelectorAll("[data-excluir]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Excluir esta movimentação?")) return;
        await S.remover("transactions", b.dataset.excluir);
        U.toast("Movimentação excluída.", "info");
        render();
      })
    );

    /* select de metas do modal */
    document.getElementById("metaSelecionada").innerHTML =
      `<option value="">Nenhuma meta</option>` +
      ctx.metas.map((m) => `<option value="${m.id}">${U.escapeHTML(m.name)}</option>`).join("");
  }

  /* ---------- abrir modal ---------- */
  const abrir = (tipo) => {
    document.getElementById("tipoTransacao").value = tipo;
    document.getElementById("tituloModal").textContent = tipo === "entrada" ? "Nova entrada" : "Nova saída";
    document.getElementById("formTransacao").reset();
    document.getElementById("data").value = U.hojeISO();
    U.abrirModal("modalTransacao");
  };
  document.getElementById("btnEntrada").addEventListener("click", () => abrir("entrada"));
  document.getElementById("btnSaida").addEventListener("click", () => abrir("saida"));

  /* ---------- validação + confirmação ---------- */
  document.getElementById("formTransacao").addEventListener("submit", (e) => {
    e.preventDefault();
    const type = document.getElementById("tipoTransacao").value;
    const amount = Number(document.getElementById("valor").value);
    const description = document.getElementById("descricao").value.trim();
    const date = document.getElementById("data").value;
    const category = document.getElementById("categoria").value;
    const goalSel = document.getElementById("metaSelecionada");
    const goal_id = goalSel.value || null;

    if (!(amount > 0)) return U.toast("Informe um valor maior que zero.", "erro");
    if (!description) return U.toast("Informe uma descrição.", "erro");
    if (!date) return U.toast("Informe a data.", "erro");

    pendente = { type, amount, description, date, category, goal_id };

    document.getElementById("resumoConfirmacao").innerHTML = `
      <ul class="lista-resumo">
        <li><span>Tipo</span><strong>${type === "entrada" ? "Entrada" : "Saída"}</strong></li>
        <li><span>Valor</span><strong>${U.moeda(amount)}</strong></li>
        <li><span>Descrição</span><strong>${U.escapeHTML(description)}</strong></li>
        <li><span>Categoria</span><strong>${U.escapeHTML(category)}</strong></li>
        <li><span>Data</span><strong>${U.dataBR(date)}</strong></li>
        ${goal_id ? `<li><span>Meta</span><strong>${U.escapeHTML(goalSel.selectedOptions[0].textContent)}</strong></li>` : ""}
      </ul>`;
    U.fecharModal("modalTransacao");
    U.abrirModal("modalConfirmacao");
  });

  /* ---------- salvar ---------- */
  document.getElementById("btnConfirmarSalvar").addEventListener("click", async () => {
    if (!pendente) return;
    try {
      await S.inserir("transactions", pendente);

      // meta vinculada: entrada aumenta o acumulado, saída reduz
      if (pendente.goal_id) {
        const metas = await S.listar("goals");
        const meta = metas.find((m) => String(m.id) === String(pendente.goal_id));
        if (meta) {
          const delta = pendente.type === "saida" ? Number(pendente.amount) : -Number(pendente.amount);
          await S.atualizar("goals", meta.id, {
            current_amount: Math.max(0, Number(meta.current_amount || 0) + delta),
          });
        }
      }

      await G.premiar(pendente.type === "entrada" ? "entrada" : "saida", { motivo: pendente.type === "entrada" ? "entrada registrada" : "saída registrada" });
      await G.sincronizarConquistas();
      U.fecharModal("modalConfirmacao");
      U.toast("Movimentação salva.", "sucesso");
      pendente = null;
      render();
    } catch (err) {
      U.toast(err.message, "erro");
    }
  });

  render();
});
