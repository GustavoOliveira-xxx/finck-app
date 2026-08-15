window.FinckRevisao = (() => {
  const U = window.FinckUtils;
  const S = window.FinckStore;
  const O = window.FinckOcorrencias;
  const F = window.FinckFechamento;

  const TABELA = "recurring_occurrences";
  const FECHAMENTOS = "monthly_closings";

  async function sincronizar(recorrentes) {
    const linhas = O.gerar(recorrentes || []);
    if (linhas.length) await S.upsert(TABELA, linhas, ["recurring_id", "cycle"]);

    const todas = await S.listar(TABELA, { ordem: "due_date", asc: true });
    await reconciliar(todas);

    const virar = O.paraPendente(todas);
    for (const oc of virar) {
      await S.atualizar(TABELA, oc.id, { status: "pendente" });
      oc.status = "pendente";
    }
    return todas;
  }

  async function reconciliar(ocorrencias) {
    const transacoes = await S.listar("transactions", { ordem: "date", asc: true });
    const { excluir, soltarVinculo, desvincular, revincular } = O.orfas(ocorrencias, transacoes);

    for (const id of excluir) await S.remover("transactions", id);
    for (const id of soltarVinculo) {
      await S.atualizar("transactions", id, { source_occurrence_id: null });
    }
    for (const id of desvincular) {
      await S.atualizar(TABELA, id, { status: "pendente", transaction_id: null, actual_amount: null });
      const oc = ocorrencias.find((o) => String(o.id) === String(id));
      if (oc) { oc.status = "pendente"; oc.transaction_id = null; oc.actual_amount = null; }
    }
    for (const { id, transaction_id } of revincular) {
      await S.atualizar(TABELA, id, { transaction_id });
      const oc = ocorrencias.find((o) => String(o.id) === String(id));
      if (oc) oc.transaction_id = transaction_id;
    }

    return { excluir, soltarVinculo, desvincular, revincular };
  }

  // Só conta a movimentação que ainda vale. Uma estornada continua apontando
  // para a ocorrência — é história — mas reaproveitá-la ressuscitaria dinheiro
  // que já foi revertido.
  async function movimentacaoExistente(oc) {
    if (oc.transaction_id) {
      const direta = await S.obter("transactions", oc.transaction_id);
      if (direta && !direta.reversed_at) return direta;
    }
    if (!oc.id) return null;

    const ligadas = await S.listar("transactions", { filtro: { source_occurrence_id: oc.id } });
    return ligadas.find((t) => !t.reversed_at) || null;
  }

  async function confirmar(oc, valorReal, { account_id, unallocated = false } = {}) {
    const valor = Number(valorReal);
    if (!(valor > 0)) throw new Error("Informe um valor maior que zero.");
    const status = O.estadoAposValor(oc, valor);
    const conta = account_id !== undefined ? (account_id || null) : (oc.account_id || null);
    const campos = O.movimentacaoDe(oc, valor, conta, { unallocated });

    // Chave estável para a mesma decisão: retry depois de timeout, duplo
    // clique e segunda aba caem todos no mesmo resultado.
    const chave = S.chaveDeOperacao("confirmar_ocorrencia", oc.id, valor.toFixed(2), conta || "sem_conta");

    try {
      // Caminho preferido: uma única transação de banco, atômica de verdade.
      const noBanco = await S.rpc("confirmar_ocorrencia", {
        p_occurrence_id: oc.id, p_amount: valor, p_account_id: conta,
        p_unallocated: !conta && unallocated, p_idem_key: chave,
      });
      if (noBanco.suportado) {
        const r = noBanco.dados || {};
        return { status: r.status || status, transaction_id: r.transaction_id, atomica: true };
      }

      return await S.operacao(chave, async () => {
        const existente = await movimentacaoExistente(oc);
        if (existente) {
          await S.atualizar("transactions", existente.id, campos);
          await S.atualizar(TABELA, oc.id, {
            status, actual_amount: valor, account_id: conta,
            transaction_id: existente.id, decided_at: new Date().toISOString(),
          });
          return { status, transaction_id: existente.id, reaproveitada: true };
        }

        const mov = await S.inserir("transactions", campos);
        try {
          await S.atualizar(TABELA, oc.id, {
            status, actual_amount: valor, account_id: conta,
            transaction_id: mov.id, decided_at: new Date().toISOString(),
          });
        } catch (err) {

          await S.remover("transactions", mov.id).catch(() => {});
          throw err;
        }
        return { status, transaction_id: mov.id, reaproveitada: false };
      }, { operacao: "confirmar_ocorrencia" });
    } catch (err) {
      await S.registrarEvento({
        scope: "confirmacao",
        message: err.message,
        context: {
          ocorrencia: oc.id, ciclo: oc.cycle, valor,
          conta: conta || null, modo: S.MODO,
        },
      });
      throw err;
    }
  }

  const MOTIVO_DESFAZER = {
    nao_realizado: "Previsão marcada como não realizada",
    nao_pago: "Previsão marcada como não paga",
  };

  async function naoAconteceu(oc, motivo) {
    const status = motivo === "nao_pago" ? "nao_pago" : "nao_realizado";

    const noBanco = await S.rpc("desfazer_ocorrencia", {
      p_occurrence_id: oc.id, p_status: status,
    });
    if (noBanco.suportado) return;

    await S.atualizar(TABELA, oc.id, {
      status,
      actual_amount: null,
      transaction_id: null,
      decided_at: new Date().toISOString(),
    });

    // Se havia movimentação, dinheiro se moveu: ela é estornada, não apagada.
    const existente = await movimentacaoExistente({ ...oc, transaction_id: oc.transaction_id });
    if (existente && !existente.reversed_at) {
      await S.atualizar("transactions", existente.id, {
        reversed_at: new Date().toISOString(),
        reversal_reason: MOTIVO_DESFAZER[status],
      });
    }
  }

  async function adiar(oc) {
    await S.atualizar(TABELA, oc.id, { status: "pendente" });
  }

  function montarSeletorConta(oc, contas) {
    const ativas = (contas || []).filter((c) => c.active !== false);
    if (!ativas.length) return "";

    const preferida = oc.account_id || ativas.find((c) => c.is_default)?.id || "";
    const opcoes = ativas.map((c) =>
      `<option value="${c.id}"${String(preferida) === String(c.id) ? " selected" : ""}>${U.escapeHTML(c.name)}</option>`
    ).join("");

    return `
      <label class="revisao__conta">Em qual conta isso entrou ou saiu?
        <select id="revisaoConta">
          ${opcoes}
          <option value="__sem_conta"${preferida ? "" : " selected"}>Fora das contas — só no saldo geral</option>
        </select>
      </label>
      <p class="revisao__dica revisao__dica--conta" data-aviso-conta hidden>
        Escolha declarada: o lançamento entra no saldo geral e fica marcado como
        não alocado. Ele não aparece em nenhuma conta cadastrada, e a
        reconciliação vai contá-lo como fora delas de propósito.
      </p>`;
  }

  function montarCartao(oc, indice, total, contas) {
    const entrada = oc.type === "entrada";
    return `
      <div class="revisao">
        <p class="revisao__passo">${indice} de ${total}</p>

        <div class="revisao__cabeca">
          <span class="revisao__tipo ${entrada ? "revisao__tipo--entrada" : "revisao__tipo--saida"}">
            ${entrada ? "Entrada prevista" : "Saída prevista"}
          </span>
          <strong class="revisao__valor">${U.moeda(oc.planned_amount)}</strong>
          <p class="revisao__item">${U.escapeHTML(oc.description)} · ${U.dataBR(oc.due_date)}${
            oc.category ? ` · ${U.escapeHTML(oc.category)}` : ""}</p>
        </div>

        ${montarSeletorConta(oc, contas)}

        <p class="revisao__pergunta">Essa movimentação realmente aconteceu?</p>

        <div class="revisao__acoes">
          <button type="button" class="btn-primario" data-acao="confirmar">
            Sim, ${U.moeda(oc.planned_amount)}
          </button>
          <button type="button" class="btn-secundario" data-acao="outro">
            ${entrada ? "Recebi outro valor" : "Paguei outro valor"}
          </button>
          <button type="button" class="btn-secundario" data-acao="nao_realizado">
            Não aconteceu
          </button>
          ${entrada ? "" : `
          <button type="button" class="btn-secundario" data-acao="nao_pago">
            Decidi não pagar
          </button>`}
          <button type="button" class="revisao__adiar" data-acao="adiar">Decidir depois</button>
        </div>

        <form class="revisao__outro" data-outro hidden>
          <label>Valor real
            <input type="text" inputmode="numeric" data-moeda id="revisaoValor">
          </label>
          <p class="revisao__dica">
            Previsto ${U.moeda(oc.planned_amount)}. O valor previsto continua guardado para comparação.
          </p>
          <button type="submit" class="btn-primario">Registrar valor real</button>
        </form>
      </div>`;
  }

  function montarResumo(contagem, cicloPronto) {
    return `
      <div class="revisao revisao--fim">
        <p class="revisao__passo">revisão concluída</p>
        <ul class="revisao__placar">
          <li><strong>${contagem.confirmadas}</strong><span>confirmadas</span></li>
          <li><strong>${contagem.ajustadas}</strong><span>ajustadas</span></li>
          <li><strong>${contagem.naoRealizadas}</strong><span>não aconteceram</span></li>
          <li><strong>${contagem.naoPagas}</strong><span>não pagas</span></li>
          <li><strong>${contagem.pendentes}</strong><span>ainda pendentes</span></li>
        </ul>
        <p class="revisao__nota">
          O saldo já reflete o que você confirmou. Nada foi contado por suposição.
        </p>
        <div class="revisao__acoes">
          ${cicloPronto
            ? `<button type="button" class="btn-primario" data-acao="fechar">Ver fechamento do mês</button>`
            : ""}
          <button type="button" class="btn-secundario" data-acao="sair">Voltar ao início</button>
        </div>
      </div>`;
  }

  async function abrir(pendentes, { aoTerminar, cicloPronto = false, contas } = {}) {
    const host = document.getElementById("conteudoRevisao");
    if (!host || !pendentes.length) return;

    const disponiveis = contas || (await S.listar("accounts"));
    const contagem = { confirmadas: 0, ajustadas: 0, naoRealizadas: 0, naoPagas: 0, pendentes: 0 };
    let i = 0;

    const passo = () => {
      if (i >= pendentes.length) {
        host.innerHTML = montarResumo(contagem, cicloPronto);
        host.querySelector('[data-acao="sair"]')?.addEventListener("click", () => {
          U.fecharModal("modalRevisao");
          if (aoTerminar) aoTerminar(contagem);
        });
        host.querySelector('[data-acao="fechar"]')?.addEventListener("click", () => {
          U.fecharModal("modalRevisao");
          if (aoTerminar) aoTerminar(contagem, { irParaFechamento: true });
        });
        return;
      }

      const oc = pendentes[i];
      host.innerHTML = montarCartao(oc, i + 1, pendentes.length, disponiveis);
      window.FinckMoeda?.ligarTodos(host);

      const avancar = () => { i++; passo(); };
      const erro = (e) => U.toast(e.message || "Não foi possível registrar.", "erro");

      const seletorConta = host.querySelector("#revisaoConta");
      const avisoConta = host.querySelector("[data-aviso-conta]");
      const foraDasContas = () => Boolean(seletorConta) && seletorConta.value === "__sem_conta";
      const contaEscolhida = () => {
        if (!seletorConta) return oc.account_id || null;
        return foraDasContas() ? null : (seletorConta.value || null);
      };
      const alocacao = () => ({ account_id: contaEscolhida(), unallocated: foraDasContas() });

      if (seletorConta && avisoConta) {
        const refletirAviso = () => { avisoConta.hidden = !foraDasContas(); };
        seletorConta.addEventListener("change", refletirAviso);
        refletirAviso();
      }

      // Duplo clique no mesmo botão não vira dois lançamentos: a primeira
      // chamada desabilita o botão e a chave de operação cobre o resto.
      const umaVez = (botao, acao) => {
        if (!botao) return;
        botao.addEventListener("click", async () => {
          if (botao.disabled) return;
          botao.disabled = true;
          try { await acao(); } catch (e) { erro(e); botao.disabled = false; }
        });
      };

      umaVez(host.querySelector('[data-acao="confirmar"]'), async () => {
        await confirmar(oc, oc.planned_amount, alocacao());
        contagem.confirmadas++;
        avancar();
      });

      host.querySelector('[data-acao="outro"]').addEventListener("click", () => {
        host.querySelector("[data-outro]").hidden = false;
        host.querySelector("#revisaoValor")?.focus();
      });

      const formOutro = host.querySelector("[data-outro]");
      formOutro.addEventListener("submit", async (e) => {
        e.preventDefault();
        const enviar = formOutro.querySelector('button[type="submit"]');
        if (enviar.disabled) return;
        enviar.disabled = true;
        try {
          const valor = U.lerMoeda("revisaoValor");
          const r = await confirmar(oc, valor, alocacao());
          if (r.status === "ajustado") contagem.ajustadas++;
          else contagem.confirmadas++;
          avancar();
        } catch (err) { erro(err); enviar.disabled = false; }
      });

      umaVez(host.querySelector('[data-acao="nao_realizado"]'), async () => {
        await naoAconteceu(oc, "nao_realizado");
        contagem.naoRealizadas++;
        avancar();
      });

      umaVez(host.querySelector('[data-acao="nao_pago"]'), async () => {
        await naoAconteceu(oc, "nao_pago");
        contagem.naoPagas++;
        avancar();
      });

      umaVez(host.querySelector('[data-acao="adiar"]'), async () => {
        await adiar(oc);
        contagem.pendentes++;
        avancar();
      });
    };

    passo();
    U.abrirModal("modalRevisao");
  }

  async function fecharCiclo(ciclo, { ocorrencias, transacoes, perfil, forcar = false }) {
    const r = F.resumo(ciclo, { ocorrencias, transacoes, perfil });
    if (!r.completo && !forcar) return { precisaConfirmar: true, resumo: r };

    const existentes = await S.listar(FECHAMENTOS, { filtro: { cycle: ciclo } });
    const registro = F.paraRegistro(r);
    if (existentes.length) {
      await S.atualizar(FECHAMENTOS, existentes[0].id, { ...registro, reopened_at: null });
    } else {
      await S.inserir(FECHAMENTOS, registro);
    }
    return { fechado: true, resumo: r };
  }

  async function reabrir(ciclo) {
    const existentes = await S.listar(FECHAMENTOS, { filtro: { cycle: ciclo } });
    if (!existentes.length) return false;
    await S.atualizar(FECHAMENTOS, existentes[0].id, { reopened_at: new Date().toISOString() });
    return true;
  }

  return { sincronizar, reconciliar, confirmar, naoAconteceu, adiar, abrir, fecharCiclo, reabrir };
})();
