document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const T = window.FinckTempo;
  const F = window.FinckFinance;
  const R = window.FinckReality;
  const G = window.FinckGame;

  const user = await window.FinckNav.iniciarPagina({ titulo: "FinCK", subtitulo: "Consumo consciente" });
  if (!user) return;

  let pendente = null;

  document.getElementById("categoria").innerHTML =
    cfg.CATEGORIAS.map((c) => `<option value="${c}">${c}</option>`).join("");
  window.FinckData.escrever("data", U.hojeISO());

  async function render() {
    const ctx = await F.carregarContexto();
    const resumo = R.resumoHistorico(ctx.analises);
    const game = await S.obterGamificacao();
    const nivel = G.nivelDe(game.xp);

    document.getElementById("saudacao").textContent =
      `${U.saudacao()}, ${ctx.perfil?.name || "por aqui"}!`;

    document.getElementById("saldoAtual").textContent = U.moeda(ctx.saldo);
    document.getElementById("entradasMes").textContent = U.moeda(ctx.entradasMes);
    document.getElementById("saidasMes").textContent = U.moeda(ctx.saidasMes);

    const campoSobra = document.getElementById("rendaLivre");
    campoSobra.textContent = U.moeda(ctx.sobraAposFixos);
    campoSobra.classList.toggle("cor-vermelha", ctx.sobraAposFixos < 0);

    const campoDisponivel = document.getElementById("disponivelProjetado");
    if (campoDisponivel) {
      campoDisponivel.textContent = U.moeda(ctx.disponivelProjetado);
      campoDisponivel.classList.toggle("cor-vermelha", ctx.disponivelProjetado < 0);
    }

    const notaSaldo = document.getElementById("notaSaldo");
    if (notaSaldo) notaSaldo.textContent = ctx.origemSaldo.nota;

    const notaFolga = document.getElementById("notaFolga");
    if (notaFolga) {
      notaFolga.textContent = ctx.semFolga
        ? `Suas despesas fixas consomem toda a renda do mês — faltam ${U.moeda(ctx.deficitFixos)}. O que você gastar agora sai do caixa acumulado, não da renda deste mês.`
        : "";
      notaFolga.classList.toggle("nota-saldo--alerta", ctx.semFolga);
    }

    const dias = Number(ctx.perfil?.work_days_month) || cfg.PADRAO.work_days_month;
    const horas = Number(ctx.perfil?.work_hours_day) || cfg.PADRAO.work_hours_day;
    const valorDia = (Number(ctx.perfil?.income_monthly) || 0) / dias;
    const valorHora = valorDia / horas;
    document.getElementById("valorDia").textContent = U.moeda(valorDia);
    document.getElementById("valorHora").textContent = U.moeda(valorHora);

    const sobra = ctx.rendaLivre;
    document.getElementById("prismaReais").textContent = U.moeda(sobra);
    document.getElementById("prismaHoras").textContent =
      valorHora > 0 ? `${U.numero(sobra / valorHora, 0)} h` : "—";
    document.getElementById("prismaDias").textContent =
      valorDia > 0 ? `${U.numero(sobra / valorDia, 1)} dias` : "—";

    const faceMetaRotulo = document.getElementById("prismaMetaRotulo");
    const faceMetaValor = document.getElementById("prismaMeta");
    const faceMetaNota = document.getElementById("prismaMetaNota");

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

    document.getElementById("indEvitadas").textContent = resumo.evitadas;
    document.getElementById("indEconomia").textContent = U.moeda(resumo.economia);
    document.getElementById("indHoras").textContent = `${U.numero(resumo.horas_preservadas, 1)} h`;
    document.getElementById("indNivel").textContent = nivel.level;

    const CT = window.FinckContas;
    const contas = ctx.contas;
    const [transferencias, ajustes] = await Promise.all([
      S.listar("transfers"),
      S.listar("balance_adjustments"),
    ]);
    const resumoContas = CT.consolidado(contas, {
      transacoes: ctx.transacoesRealizadas, transferencias, ajustes,
    });
    const orfaos = CT.semConta(ctx.transacoesRealizadas);
    const diferenca = ctx.saldo - resumoContas.disponivel;

    document.getElementById("cardContas").innerHTML = contas.length
      ? `<article class="card-contas">
           <div class="card-contas__topo">
             <h2>Minhas contas</h2>
             <span class="card-contas__total ${resumoContas.disponivel < 0 ? "cor-vermelha" : "cor-verde"}">
               ${U.moeda(resumoContas.disponivel)}</span>
           </div>
           <p class="descricao">${resumoContas.quantidade} conta(s) ativa(s)${
             orfaos ? ` · ${orfaos} lançamento(s) sem conta` : ""}</p>
           ${Math.abs(diferenca) >= 0.01
             ? `<p class="nota nota--conciliacao">
                  O saldo geral (${U.moeda(ctx.saldo)}) e a soma das contas (${U.moeda(resumoContas.disponivel)})
                  diferem em ${U.moeda(Math.abs(diferenca))}${
                    orfaos ? ` porque ${orfaos} lançamento(s) ainda não têm conta` : " por causa de ajustes de saldo"}.
                  <a href="contas.html">Conferir</a>
                </p>`
             : `<p class="nota">Saldo geral e soma das contas estão conciliados.</p>`}
           ${resumoContas.contas.slice(0, 3).map((c) => `
             <div class="card-contas__linha">
               <span class="ponto-banco" style="--cor:${c.instituicao.cor}"></span>
               <span>${U.escapeHTML(c.name)}</span>
               <strong class="${c.saldo < 0 ? "cor-vermelha" : ""}">${U.moeda(c.saldo)}</strong>
             </div>`).join("")}
           <a class="link-mais" href="contas.html">Ver contas</a>
         </article>`
      : `<article class="card-contas">
           <div class="card-contas__topo"><h2>Minhas contas</h2></div>
           <p class="descricao">Você ainda não cadastrou onde seu dinheiro está. O FinCK não acessa seu banco — você informa e edita quando quiser.</p>
           <a class="link-mais" href="contas.html">Cadastrar minha primeira conta</a>
         </article>`;

    document.getElementById("contaSelecionada").innerHTML =
      `<option value="">Conta não informada</option>` +
      contas.filter((c) => c.active !== false)
        .map((c) => `<option value="${c.id}"${c.is_default ? " selected" : ""}>${U.escapeHTML(c.name)}</option>`)
        .join("");

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
      <p class="nota">${U.percentual(comprometido, 1)} da renda prevista já está comprometida com despesas fixas${
        comprometido > 100 ? " — as fixas passaram da renda prevista."
        : comprometido === 100 ? " — exatamente no limite, sem folga."
        : "."}</p>
      <p class="nota">Estes valores são previsão do mês, não o que já saiu da conta.</p>`;

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
          ${T.selo(t.amount, { classe: t.type === "entrada" ? "selo-tempo--entrada" : "" })}
          <button type="button" class="btn-excluir-item" data-excluir="${t.id}" aria-label="Excluir movimentação">✕</button>
        </div>
      </article>`).join("");

    lista.querySelectorAll("[data-excluir]").forEach((b) =>
      b.addEventListener("click", async () => {
        const alvo = ctx.transacoes.find((t) => String(t.id) === String(b.dataset.excluir));
        const aviso = alvo?.goal_id
          ? "Esta movimentação está vinculada a uma meta. Excluir também devolve o valor ao progresso da meta. Continuar?"
          : "Excluir esta movimentação?";
        if (!confirm(aviso)) return;
        try {
          const r = await F.estornarTransacao(b.dataset.excluir);
          U.toast(r.estornouMeta ? "Movimentação excluída e meta estornada." : "Movimentação excluída.", "info");
          render();
        } catch (err) {
          U.toast(err.message || "Não foi possível excluir.", "erro");
        }
      })
    );

    document.getElementById("metaSelecionada").innerHTML =
      `<option value="">Nenhuma meta</option>` +
      ctx.metas.map((m) => `<option value="${m.id}">${U.escapeHTML(m.name)}</option>`).join("");
  }

  const abrir = (tipo) => {
    document.getElementById("tipoTransacao").value = tipo;
    document.getElementById("tituloModal").textContent = tipo === "entrada" ? "Nova entrada" : "Nova saída";
    document.getElementById("formTransacao").reset();
    U.limparMoeda("valor");
    window.FinckData.escrever("data", U.hojeISO());

    const campoCategoria = document.getElementById("categoria").closest("label");
    if (campoCategoria) campoCategoria.hidden = tipo === "entrada";

    U.abrirModal("modalTransacao");
  };
  document.getElementById("btnEntrada").addEventListener("click", () => abrir("entrada"));
  document.getElementById("btnSaida").addEventListener("click", () => abrir("saida"));

  document.getElementById("formTransacao").addEventListener("submit", (e) => {
    e.preventDefault();
    const type = document.getElementById("tipoTransacao").value;
    const amount = U.lerMoeda("valor");
    const description = document.getElementById("descricao").value.trim();
    const date = window.FinckData.ler("data");
    const category = type === "entrada" ? null : document.getElementById("categoria").value;
    const goalSel = document.getElementById("metaSelecionada");
    const goal_id = goalSel.value || null;

    if (!(amount > 0)) return U.toast("Informe um valor maior que zero.", "erro");
    if (!description) return U.toast("Informe uma descrição.", "erro");
    if (!date) return U.toast("Informe a data.", "erro");

    const contaSel = document.getElementById("contaSelecionada");
    const account_id = contaSel.value || null;

    pendente = { type, amount, description, date, category, goal_id, account_id };

    document.getElementById("resumoConfirmacao").innerHTML = `
      <ul class="lista-resumo">
        <li><span>Tipo</span><strong>${type === "entrada" ? "Entrada" : "Saída"}</strong></li>
        <li><span>Valor</span><strong>${U.moeda(amount)}</strong></li>
        <li><span>Descrição</span><strong>${U.escapeHTML(description)}</strong></li>
        <li><span>Categoria</span><strong>${U.escapeHTML(category)}</strong></li>
        <li><span>Data</span><strong>${U.dataBR(date)}</strong></li>
        <li><span>Conta</span><strong>${U.escapeHTML(contaSel.selectedOptions[0].textContent)}</strong></li>
        ${goal_id ? `<li><span>Meta</span><strong>${U.escapeHTML(goalSel.selectedOptions[0].textContent)}</strong></li>` : ""}
      </ul>`;
    U.fecharModal("modalTransacao");
    U.abrirModal("modalConfirmacao");
  });

  document.getElementById("btnConfirmarSalvar").addEventListener("click", async () => {
    if (!pendente) return;
    try {

      await F.registrarTransacao(pendente);

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
