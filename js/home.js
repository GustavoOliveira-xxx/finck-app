document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const T = window.FinckTempo;
  const F = window.FinckFinance;
  const R = window.FinckReality;
  const G = window.FinckGame;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "FinCK",
    subtitulo: "Consumo consciente"
  });
  if (!user) {
    return;
  }
  let pendente = null;
  document.getElementById("categoria").innerHTML = cfg.CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join("");
  window.FinckData.escrever("data", U.hojeISO());
  async function render() {
    const ctx = await F.carregarContexto();
    const resumo = R.resumoHistorico(ctx.analises);
    const game = await S.obterGamificacao();
    const nivel = G.nivelDe(game.xp);
    document.getElementById("saudacao").textContent = `${U.saudacao()}, ${ctx.perfil?.name || "por aqui"}!`;
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
    if (notaSaldo) {
      notaSaldo.textContent = ctx.origemSaldo.nota;
    }
    const notaFolga = document.getElementById("notaFolga");
    if (notaFolga) {
      notaFolga.textContent = ctx.semFolga ? `Suas despesas fixas consomem toda a renda do mês — faltam ${U.moeda(ctx.deficitFixos)}. O que você gastar agora sai do caixa acumulado, não da renda deste mês.` : "";
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
    document.getElementById("prismaHoras").textContent = valorHora > 0 ? `${U.numero(sobra / valorHora, 0)} h` : "—";
    document.getElementById("prismaDias").textContent = valorDia > 0 ? `${U.numero(sobra / valorDia, 1)} dias` : "—";
    const faceMetaRotulo = document.getElementById("prismaMetaRotulo");
    const faceMetaValor = document.getElementById("prismaMeta");
    const faceMetaNota = document.getElementById("prismaMetaNota");
    const emAberto = ctx.metas.filter(m => Number(m.current_amount || 0) < Number(m.target_amount || 0)).sort((a, b) => a.target_amount - a.current_amount - (b.target_amount - b.current_amount));
    if (emAberto.length) {
      const alvo = emAberto[0];
      const falta = Number(alvo.target_amount) - Number(alvo.current_amount);
      faceMetaRotulo.textContent = "Na meta mais perto";
      faceMetaValor.textContent = U.percentual(Math.min(100, sobra / falta * 100), 0);
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
    document.getElementById("indEconomia").textContent = U.moeda(resumo.valor_potencial);
    document.getElementById("indHoras").textContent = `${U.numero(resumo.horas_preservadas, 1)} h`;
    document.getElementById("indNivel").textContent = nivel.level;
    const CT = window.FinckContas;
    const contas = ctx.contas;
    const [transferencias, ajustes] = await Promise.all([ S.listar("transfers"), S.listar("balance_adjustments") ]);
    const resumoContas = CT.consolidado(contas, {
      transacoes: ctx.transacoesRealizadas,
      transferencias: transferencias,
      ajustes: ajustes
    });
    const orfaos = CT.semConta(ctx.transacoesRealizadas);
    const diferenca = ctx.saldo - resumoContas.disponivel;
    document.getElementById("cardContas").innerHTML = contas.length ? `<article class="card-contas">\n           <div class="card-contas__topo">\n             <h2>Minhas contas</h2>\n             <span class="card-contas__total ${resumoContas.disponivel < 0 ? "cor-vermelha" : "cor-verde"}">\n               ${U.moeda(resumoContas.disponivel)}</span>\n           </div>\n           <p class="descricao">${resumoContas.quantidade} conta(s) ativa(s)${orfaos ? ` · ${orfaos} lançamento(s) sem conta` : ""}</p>\n           ${Math.abs(diferenca) >= .01 ? `<p class="nota nota--conciliacao">\n                  O saldo geral (${U.moeda(ctx.saldo)}) e a soma das contas (${U.moeda(resumoContas.disponivel)})\n                  diferem em ${U.moeda(Math.abs(diferenca))}${orfaos ? ` porque ${orfaos} lançamento(s) ainda não têm conta` : " por causa de ajustes de saldo"}.\n                  <a href="contas.html">Conferir</a>\n                </p>` : `<p class="nota">Saldo geral e soma das contas estão conciliados.</p>`}\n           ${resumoContas.contas.slice(0, 3).map(c => `\n             <div class="card-contas__linha">\n               <span class="ponto-banco" style="--cor:${c.instituicao.cor}"></span>\n               <span>${U.escapeHTML(c.name)}</span>\n               <strong class="${c.saldo < 0 ? "cor-vermelha" : ""}">${U.moeda(c.saldo)}</strong>\n             </div>`).join("")}\n           <a class="link-mais" href="contas.html">Ver contas</a>\n         </article>` : `<article class="card-contas">\n           <div class="card-contas__topo"><h2>Minhas contas</h2></div>\n           <p class="descricao">Você ainda não cadastrou onde seu dinheiro está. O FinCK não acessa seu banco — você informa e edita quando quiser.</p>\n           <a class="link-mais" href="contas.html">Cadastrar minha primeira conta</a>\n         </article>`;
    document.getElementById("contaSelecionada").innerHTML = `<option value="">Escolha a conta…</option>` + contas.filter(c => c.active !== false).map(c => `<option value="${c.id}"${c.is_default ? " selected" : ""}>${U.escapeHTML(c.name)}</option>`).join("") + `<option value="__sem_conta">Fora das contas — só no saldo geral</option>`;
    const previstoSaida = ctx.despesasFixas;
    const previstoEntrada = ctx.previstoEntradas || Number(ctx.perfil?.income_monthly || 0);
    const comprometido = previstoEntrada > 0 ? previstoSaida / previstoEntrada * 100 : 0;
    document.getElementById("orcamento").innerHTML = `\n      <ul class="lista-resumo">\n        <li><span>Entradas previstas</span><strong class="cor-verde">${U.moeda(previstoEntrada)}</strong></li>\n        <li><span>Despesas fixas previstas</span><strong class="cor-vermelha">${U.moeda(previstoSaida)}</strong></li>\n        <li><span>Sobra prevista</span><strong>${U.moeda(previstoEntrada - previstoSaida)}</strong></li>\n      </ul>\n      <div class="barra" role="img" aria-label="Percentual da renda comprometido com despesas fixas">\n        <div class="barra-preenchida" style="width:${Math.min(100, comprometido)}%"></div>\n      </div>\n      <p class="nota">${U.percentual(comprometido, 1)} da renda prevista já está comprometida com despesas fixas${comprometido > 100 ? " — as fixas passaram da renda prevista." : comprometido === 100 ? " — exatamente no limite, sem folga." : "."}</p>\n      <p class="nota">Estes valores são previsão do mês, não o que já saiu da conta.</p>`;
    const metasHost = document.getElementById("metasResumo");
    metasHost.innerHTML = ctx.metas.length ? ctx.metas.slice(0, 3).map(m => {
      const p = U.progresso(m.current_amount, m.target_amount);
      return `\n            <article class="card-meta">\n              <h3>${U.escapeHTML(m.name)}</h3>\n              <div class="barra"><div class="barra-preenchida" style="width:${p}%"></div></div>\n              <p>${U.moeda(m.current_amount)} de ${U.moeda(m.target_amount)} · ${U.percentual(p, 0)}</p>\n            </article>`;
    }).join("") : `<p class="vazio">Você ainda não criou metas. <a href="metas.html">Criar a primeira</a>.</p>`;
    const lista = document.getElementById("lista");
    const vazio = document.getElementById("vazio");
    const ultimas = ctx.transacoes.slice(0, 8);
    vazio.hidden = ultimas.length > 0;
    lista.innerHTML = ultimas.map(t => `\n      <article class="item-transacao ${t.type}">\n        <div class="item-info">\n          <h4>${U.escapeHTML(t.description)}</h4>\n          <small>${U.escapeHTML(t.category || "Outros")} · ${U.dataBR(t.date)}</small>\n        </div>\n        <div class="item-lado">\n          <strong class="${t.type === "entrada" ? "cor-verde" : "cor-vermelha"}">\n            ${t.type === "entrada" ? "+" : "−"} ${U.moeda(t.amount)}\n          </strong>\n          ${T.selo(t.amount, {
      classe: t.type === "entrada" ? "selo-tempo--entrada" : ""
    })}\n          ${!t.account_id && !t.unallocated ? `<span class="selo-alocacao" title="Sem conta vinculada e sem declaração de que fica fora das contas.">sem conta</span>` : ""}\n          <button type="button" class="btn-excluir-item" data-estornar="${t.id}"\n                  aria-label="Estornar movimentação" title="Estornar">↺</button>\n        </div>\n      </article>`).join("");
    lista.querySelectorAll("[data-estornar]").forEach(b => b.addEventListener("click", async () => {
      const id = b.dataset.estornar;
      const alvo = ctx.transacoes.find(t => String(t.id) === String(id));
      const contexto = alvo?.goal_id ? "Ela está vinculada a uma meta: o progresso volta exatamente uma vez." : alvo?.source_occurrence_id ? "Ela veio de uma previsão confirmada: a previsão volta a ficar em aberto." : "O lançamento sai do saldo, mas continua no histórico.";
      const motivo = prompt(`Estornar "${alvo?.description || "movimentação"}"?\n${contexto}\n\nMotivo do estorno:`, "Lançamento incorreto");
      if (motivo === null) {
        return;
      }
      b.disabled = true;
      try {
        const r = await F.estornarTransacao(id, {
          motivo: motivo.trim() || "Estorno solicitado pelo usuário",
          chave: S.chaveDeOperacao("estorno", id)
        });
        U.toast(r.repetida ? "Esta movimentação já estava estornada." : r.estornouMeta ? "Movimentação estornada e progresso da meta revertido." : "Movimentação estornada. O histórico foi preservado.", r.repetida ? "info" : "sucesso");
        render();
      } catch (err) {
        await S.registrarEvento({
          scope: "estorno",
          message: err.message,
          context: {
            transacao: id
          }
        });
        U.toast(err.message || "Não foi possível estornar.", "erro");
      } finally {
        b.disabled = false;
      }
    }));
    document.getElementById("metaSelecionada").innerHTML = `<option value="">Nenhuma meta</option>` + ctx.metas.map(m => `<option value="${m.id}">${U.escapeHTML(m.name)}</option>`).join("");
  }
  const abrir = tipo => {
    document.getElementById("tipoTransacao").value = tipo;
    document.getElementById("tituloModal").textContent = tipo === "entrada" ? "Nova entrada" : "Nova saída";
    document.getElementById("formTransacao").reset();
    U.limparMoeda("valor");
    window.FinckData.escrever("data", U.hojeISO());
    const campoCategoria = document.getElementById("categoria").closest("label");
    if (campoCategoria) {
      campoCategoria.hidden = tipo === "entrada";
    }
    U.abrirModal("modalTransacao");
  };
  document.getElementById("btnEntrada").addEventListener("click", () => abrir("entrada"));
  document.getElementById("btnSaida").addEventListener("click", () => abrir("saida"));
  document.getElementById("formTransacao").addEventListener("submit", e => {
    e.preventDefault();
    const type = document.getElementById("tipoTransacao").value;
    const amount = U.lerMoeda("valor");
    const description = document.getElementById("descricao").value.trim();
    const date = window.FinckData.ler("data");
    const category = type === "entrada" ? null : document.getElementById("categoria").value;
    const goalSel = document.getElementById("metaSelecionada");
    const goal_id = goalSel.value || null;
    if (!(amount > 0)) {
      return U.toast("Informe um valor maior que zero.", "erro");
    }
    if (!description) {
      return U.toast("Informe uma descrição.", "erro");
    }
    if (!date) {
      return U.toast("Informe a data.", "erro");
    }
    const contaSel = document.getElementById("contaSelecionada");
    const semConta = contaSel.value === "__sem_conta";
    const account_id = semConta ? null : contaSel.value || null;
    const temContas = contaSel.options.length > 2;
    if (temContas && !account_id && !semConta) {
      return U.toast("Escolha a conta ou marque que a movimentação fica fora das contas.", "erro");
    }
    pendente = {
      type: type,
      amount: amount,
      description: description,
      date: date,
      category: category,
      goal_id: goal_id,
      account_id: account_id,
      unallocated: !account_id
    };
    document.getElementById("resumoConfirmacao").innerHTML = `\n      <ul class="lista-resumo">\n        <li><span>Tipo</span><strong>${type === "entrada" ? "Entrada" : "Saída"}</strong></li>\n        <li><span>Valor</span><strong>${U.moeda(amount)}</strong></li>\n        <li><span>Descrição</span><strong>${U.escapeHTML(description)}</strong></li>\n        <li><span>Categoria</span><strong>${U.escapeHTML(category)}</strong></li>\n        <li><span>Data</span><strong>${U.dataBR(date)}</strong></li>\n        <li><span>Conta</span><strong>${U.escapeHTML(account_id ? contaSel.selectedOptions[0].textContent : "Fora das contas — só no saldo geral")}</strong></li>\n        ${goal_id ? `<li><span>Meta</span><strong>${U.escapeHTML(goalSel.selectedOptions[0].textContent)}</strong></li>` : ""}\n      </ul>`;
    U.fecharModal("modalTransacao");
    U.abrirModal("modalConfirmacao");
  });
  document.getElementById("btnConfirmarSalvar").addEventListener("click", async () => {
    if (!pendente) {
      return;
    }
    try {
      await F.registrarTransacao(pendente);
      await G.premiar(pendente.type === "entrada" ? "entrada" : "saida", {
        motivo: pendente.type === "entrada" ? "entrada registrada" : "saída registrada"
      });
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
