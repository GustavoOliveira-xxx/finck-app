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
    const virar = O.paraPendente(todas);
    for (const oc of virar) {
      await S.atualizar(TABELA, oc.id, { status: "pendente" });
      oc.status = "pendente";
    }
    return todas;
  }

  async function confirmar(oc, valorReal) {
    const valor = Number(valorReal);
    if (!(valor > 0)) throw new Error("Informe um valor maior que zero.");
    const status = O.estadoAposValor(oc, valor);

    if (oc.transaction_id) {
      await S.atualizar("transactions", oc.transaction_id, { amount: valor });
      await S.atualizar(TABELA, oc.id, {
        status, actual_amount: valor, decided_at: new Date().toISOString(),
      });
      return { status, transaction_id: oc.transaction_id };
    }

    const mov = await S.inserir("transactions", O.movimentacaoDe(oc, valor));
    await S.atualizar(TABELA, oc.id, {
      status, actual_amount: valor, transaction_id: mov.id,
      decided_at: new Date().toISOString(),
    });
    return { status, transaction_id: mov.id };
  }

  async function naoAconteceu(oc, motivo) {
    if (oc.transaction_id) {
      await S.remover("transactions", oc.transaction_id);
    }
    await S.atualizar(TABELA, oc.id, {
      status: motivo === "nao_pago" ? "nao_pago" : "nao_realizado",
      actual_amount: null,
      transaction_id: null,
      decided_at: new Date().toISOString(),
    });
  }

  async function adiar(oc) {
    await S.atualizar(TABELA, oc.id, { status: "pendente" });
  }

  function montarCartao(oc, indice, total) {
    const entrada = oc.type === "entrada";
    return `
      <div class="revisao">
        <p class="revisao__passo">${indice} de ${total}</p>

        <div class="revisao__cabeca">
          <span class="revisao__tipo ${entrada ? "revisao__tipo--entrada" : "revisao__tipo--saida"}">
            ${entrada ? "Entrada prevista" : "Saída prevista"}
          </span>
          <strong class="revisao__valor">${U.moeda(oc.planned_amount)}</strong>
          <p class="revisao__item">${U.escapeHTML(oc.description)} · ${U.dataBR(oc.due_date)}</p>
        </div>

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

  async function abrir(pendentes, { aoTerminar, cicloPronto = false } = {}) {
    const host = document.getElementById("conteudoRevisao");
    if (!host || !pendentes.length) return;

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
      host.innerHTML = montarCartao(oc, i + 1, pendentes.length);
      window.FinckMoeda?.ligarTodos(host);

      const avancar = () => { i++; passo(); };
      const erro = (e) => U.toast(e.message || "Não foi possível registrar.", "erro");

      host.querySelector('[data-acao="confirmar"]').addEventListener("click", async () => {
        try {
          await confirmar(oc, oc.planned_amount);
          contagem.confirmadas++;
          avancar();
        } catch (e) { erro(e); }
      });

      host.querySelector('[data-acao="outro"]').addEventListener("click", () => {
        host.querySelector("[data-outro]").hidden = false;
        host.querySelector("#revisaoValor")?.focus();
      });

      host.querySelector("[data-outro]").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          const valor = U.lerMoeda("revisaoValor");
          const r = await confirmar(oc, valor);
          if (r.status === "ajustado") contagem.ajustadas++;
          else contagem.confirmadas++;
          avancar();
        } catch (err) { erro(err); }
      });

      host.querySelector('[data-acao="nao_realizado"]').addEventListener("click", async () => {
        try {
          await naoAconteceu(oc, "nao_realizado");
          contagem.naoRealizadas++;
          avancar();
        } catch (e) { erro(e); }
      });

      host.querySelector('[data-acao="nao_pago"]')?.addEventListener("click", async () => {
        try {
          await naoAconteceu(oc, "nao_pago");
          contagem.naoPagas++;
          avancar();
        } catch (e) { erro(e); }
      });

      host.querySelector('[data-acao="adiar"]').addEventListener("click", async () => {
        try {
          await adiar(oc);
          contagem.pendentes++;
          avancar();
        } catch (e) { erro(e); }
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

  return { sincronizar, confirmar, naoAconteceu, adiar, abrir, fecharCiclo, reabrir };
})();
