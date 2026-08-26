window.FinckRevisao = (() => {
  const U = window.FinckUtils;
  const S = window.FinckStore;
  const O = window.FinckOcorrencias;
  const F = window.FinckFechamento;
  const TABELA = "recurring_occurrences";
  const FECHAMENTOS = "monthly_closings";
  async function sincronizar(recorrentes) {
    const linhas = O.gerar(recorrentes || []);
    if (linhas.length) {
      await S.upsert(TABELA, linhas, [ "recurring_id", "cycle" ]);
    }
    const todas = await S.listar(TABELA, {
      ordem: "due_date",
      asc: true
    });
    await reconciliar(todas);
    const virar = O.paraPendente(todas);
    for (const oc of virar) {
      await S.atualizar(TABELA, oc.id, {
        status: "pendente"
      });
      oc.status = "pendente";
    }
    return todas;
  }
  async function reconciliar(ocorrencias) {
    const transacoes = await S.listar("transactions", {
      ordem: "date",
      asc: true
    });
    const {excluir: excluir, soltarVinculo: soltarVinculo, desvincular: desvincular, revincular: revincular} = O.orfas(ocorrencias, transacoes);
    for (const id of excluir) {
      await S.remover("transactions", id);
    }
    for (const id of soltarVinculo) {
      await S.atualizar("transactions", id, {
        source_occurrence_id: null
      });
    }
    for (const id of desvincular) {
      await S.atualizar(TABELA, id, {
        status: "pendente",
        transaction_id: null,
        actual_amount: null
      });
      const oc = ocorrencias.find(o => String(o.id) === String(id));
      if (oc) {
        oc.status = "pendente";
        oc.transaction_id = null;
        oc.actual_amount = null;
      }
    }
    for (const {id: id, transaction_id: transaction_id} of revincular) {
      await S.atualizar(TABELA, id, {
        transaction_id: transaction_id
      });
      const oc = ocorrencias.find(o => String(o.id) === String(id));
      if (oc) {
        oc.transaction_id = transaction_id;
      }
    }
    return {
      excluir: excluir,
      soltarVinculo: soltarVinculo,
      desvincular: desvincular,
      revincular: revincular
    };
  }
  async function movimentacaoExistente(oc) {
    if (oc.transaction_id) {
      const direta = await S.obter("transactions", oc.transaction_id);
      if (direta && !direta.reversed_at) {
        return direta;
      }
    }
    if (!oc.id) {
      return null;
    }
    const ligadas = await S.listar("transactions", {
      filtro: {
        source_occurrence_id: oc.id
      }
    });
    return ligadas.find(t => !t.reversed_at) || null;
  }
  async function confirmar(oc, valorReal, {account_id: account_id, unallocated: unallocated = false} = {}) {
    const valor = Number(valorReal);
    if (!(valor > 0)) {
      throw new Error("Informe um valor maior que zero.");
    }
    const status = O.estadoAposValor(oc, valor);
    const conta = account_id !== undefined ? account_id || null : oc.account_id || null;
    const campos = O.movimentacaoDe(oc, valor, conta, {
      unallocated: unallocated
    });
    const chave = S.chaveDeOperacao("confirmar_ocorrencia", oc.id, valor.toFixed(2), conta || "sem_conta");
    try {
      const noBanco = await S.rpc("confirmar_ocorrencia", {
        p_occurrence_id: oc.id,
        p_amount: valor,
        p_account_id: conta,
        p_unallocated: !conta && unallocated,
        p_idem_key: chave
      });
      if (noBanco.suportado) {
        const r = noBanco.dados || {};
        return {
          status: r.status || status,
          transaction_id: r.transaction_id,
          atomica: true
        };
      }
      return await S.operacao(chave, async () => {
        const existente = await movimentacaoExistente(oc);
        if (existente) {
          await S.atualizar("transactions", existente.id, campos);
          await S.atualizar(TABELA, oc.id, {
            status: status,
            actual_amount: valor,
            account_id: conta,
            transaction_id: existente.id,
            decided_at: (new Date).toISOString()
          });
          return {
            status: status,
            transaction_id: existente.id,
            reaproveitada: true
          };
        }
        const mov = await S.inserir("transactions", campos);
        try {
          await S.atualizar(TABELA, oc.id, {
            status: status,
            actual_amount: valor,
            account_id: conta,
            transaction_id: mov.id,
            decided_at: (new Date).toISOString()
          });
        } catch (err) {
          await S.remover("transactions", mov.id).catch(() => {});
          throw err;
        }
        return {
          status: status,
          transaction_id: mov.id,
          reaproveitada: false
        };
      }, {
        operacao: "confirmar_ocorrencia"
      });
    } catch (err) {
      await S.registrarEvento({
        scope: "confirmacao",
        message: err.message,
        context: {
          ocorrencia: oc.id,
          ciclo: oc.cycle,
          valor: valor,
          conta: conta || null,
          modo: S.MODO
        }
      });
      throw err;
    }
  }
  const MOTIVO_DESFAZER = {
    nao_realizado: "Previsão marcada como não realizada",
    nao_pago: "Previsão marcada como não paga"
  };
  async function naoAconteceu(oc, motivo) {
    const status = motivo === "nao_pago" ? "nao_pago" : "nao_realizado";
    const noBanco = await S.rpc("desfazer_ocorrencia", {
      p_occurrence_id: oc.id,
      p_status: status
    });
    if (noBanco.suportado) {
      return;
    }
    await S.atualizar(TABELA, oc.id, {
      status: status,
      actual_amount: null,
      transaction_id: null,
      decided_at: (new Date).toISOString()
    });
    const existente = await movimentacaoExistente({
      ...oc,
      transaction_id: oc.transaction_id
    });
    if (existente && !existente.reversed_at) {
      await S.atualizar("transactions", existente.id, {
        reversed_at: (new Date).toISOString(),
        reversal_reason: MOTIVO_DESFAZER[status]
      });
    }
  }
  async function adiar(oc) {
    await S.atualizar(TABELA, oc.id, {
      status: "pendente"
    });
  }
  function montarSeletorConta(oc, contas) {
    const ativas = (contas || []).filter(c => c.active !== false);
    if (!ativas.length) {
      return "";
    }
    const preferida = oc.account_id || ativas.find(c => c.is_default)?.id || "";
    const opcoes = ativas.map(c => `<option value="${c.id}"${String(preferida) === String(c.id) ? " selected" : ""}>${U.escapeHTML(c.name)}</option>`).join("");
    return `\n      <label class="revisao__conta">Em qual conta isso entrou ou saiu?\n        <select id="revisaoConta">\n          ${opcoes}\n          <option value="__sem_conta"${preferida ? "" : " selected"}>Fora das contas — só no saldo geral</option>\n        </select>\n      </label>\n      <p class="revisao__dica revisao__dica--conta" data-aviso-conta hidden>\n        Escolha declarada: o lançamento entra no saldo geral e fica marcado como\n        não alocado. Ele não aparece em nenhuma conta cadastrada, e a\n        reconciliação vai contá-lo como fora delas de propósito.\n      </p>`;
  }
  function montarCartao(oc, indice, total, contas) {
    const entrada = oc.type === "entrada";
    return `\n      <div class="revisao">\n        <p class="revisao__passo">${indice} de ${total}</p>\n\n        <div class="revisao__cabeca">\n          <span class="revisao__tipo ${entrada ? "revisao__tipo--entrada" : "revisao__tipo--saida"}">\n            ${entrada ? "Entrada prevista" : "Saída prevista"}\n          </span>\n          <strong class="revisao__valor">${U.moeda(oc.planned_amount)}</strong>\n          <p class="revisao__item">${U.escapeHTML(oc.description)} · ${U.dataBR(oc.due_date)}${oc.category ? ` · ${U.escapeHTML(oc.category)}` : ""}</p>\n        </div>\n\n        ${montarSeletorConta(oc, contas)}\n\n        <p class="revisao__pergunta">Essa movimentação realmente aconteceu?</p>\n\n        <div class="revisao__acoes">\n          <button type="button" class="btn-primario" data-acao="confirmar">\n            Sim, ${U.moeda(oc.planned_amount)}\n          </button>\n          <button type="button" class="btn-secundario" data-acao="outro">\n            ${entrada ? "Recebi outro valor" : "Paguei outro valor"}\n          </button>\n          <button type="button" class="btn-secundario" data-acao="nao_realizado">\n            Não aconteceu\n          </button>\n          ${entrada ? "" : `\n          <button type="button" class="btn-secundario" data-acao="nao_pago">\n            Decidi não pagar\n          </button>`}\n          <button type="button" class="revisao__adiar" data-acao="adiar">Decidir depois</button>\n        </div>\n\n        <form class="revisao__outro" data-outro hidden>\n          <label>Valor real\n            <input type="text" inputmode="numeric" data-moeda id="revisaoValor">\n          </label>\n          <p class="revisao__dica">\n            Previsto ${U.moeda(oc.planned_amount)}. O valor previsto continua guardado para comparação.\n          </p>\n          <button type="submit" class="btn-primario">Registrar valor real</button>\n        </form>\n      </div>`;
  }
  function montarResumo(contagem, cicloPronto) {
    return `\n      <div class="revisao revisao--fim">\n        <p class="revisao__passo">revisão concluída</p>\n        <ul class="revisao__placar">\n          <li><strong>${contagem.confirmadas}</strong><span>confirmadas</span></li>\n          <li><strong>${contagem.ajustadas}</strong><span>ajustadas</span></li>\n          <li><strong>${contagem.naoRealizadas}</strong><span>não aconteceram</span></li>\n          <li><strong>${contagem.naoPagas}</strong><span>não pagas</span></li>\n          <li><strong>${contagem.pendentes}</strong><span>ainda pendentes</span></li>\n        </ul>\n        <p class="revisao__nota">\n          O saldo já reflete o que você confirmou. Nada foi contado por suposição.\n        </p>\n        <div class="revisao__acoes">\n          ${cicloPronto ? `<button type="button" class="btn-primario" data-acao="fechar">Ver fechamento do mês</button>` : ""}\n          <button type="button" class="btn-secundario" data-acao="sair">Voltar ao início</button>\n        </div>\n      </div>`;
  }
  async function abrir(pendentes, {aoTerminar: aoTerminar, cicloPronto: cicloPronto = false, contas: contas} = {}) {
    const host = document.getElementById("conteudoRevisao");
    if (!host || !pendentes.length) {
      return;
    }
    const disponiveis = contas || await S.listar("accounts");
    const contagem = {
      confirmadas: 0,
      ajustadas: 0,
      naoRealizadas: 0,
      naoPagas: 0,
      pendentes: 0
    };
    let i = 0;
    const passo = () => {
      if (i >= pendentes.length) {
        host.innerHTML = montarResumo(contagem, cicloPronto);
        host.querySelector('[data-acao="sair"]')?.addEventListener("click", () => {
          U.fecharModal("modalRevisao");
          if (aoTerminar) {
            aoTerminar(contagem);
          }
        });
        host.querySelector('[data-acao="fechar"]')?.addEventListener("click", () => {
          U.fecharModal("modalRevisao");
          if (aoTerminar) {
            aoTerminar(contagem, {
              irParaFechamento: true
            });
          }
        });
        return;
      }
      const oc = pendentes[i];
      host.innerHTML = montarCartao(oc, i + 1, pendentes.length, disponiveis);
      window.FinckMoeda?.ligarTodos(host);
      const avancar = () => {
        i++;
        passo();
      };
      const erro = e => U.toast(e.message || "Não foi possível registrar.", "erro");
      const seletorConta = host.querySelector("#revisaoConta");
      const avisoConta = host.querySelector("[data-aviso-conta]");
      const foraDasContas = () => Boolean(seletorConta) && seletorConta.value === "__sem_conta";
      const contaEscolhida = () => {
        if (!seletorConta) {
          return oc.account_id || null;
        }
        return foraDasContas() ? null : seletorConta.value || null;
      };
      const alocacao = () => ({
        account_id: contaEscolhida(),
        unallocated: foraDasContas()
      });
      if (seletorConta && avisoConta) {
        const refletirAviso = () => {
          avisoConta.hidden = !foraDasContas();
        };
        seletorConta.addEventListener("change", refletirAviso);
        refletirAviso();
      }
      const umaVez = (botao, acao) => {
        if (!botao) {
          return;
        }
        botao.addEventListener("click", async () => {
          if (botao.disabled) {
            return;
          }
          botao.disabled = true;
          try {
            await acao();
          } catch (e) {
            erro(e);
            botao.disabled = false;
          }
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
      formOutro.addEventListener("submit", async e => {
        e.preventDefault();
        const enviar = formOutro.querySelector('button[type="submit"]');
        if (enviar.disabled) {
          return;
        }
        enviar.disabled = true;
        try {
          const valor = U.lerMoeda("revisaoValor");
          const r = await confirmar(oc, valor, alocacao());
          if (r.status === "ajustado") {
            contagem.ajustadas++;
          } else {
            contagem.confirmadas++;
          }
          avancar();
        } catch (err) {
          erro(err);
          enviar.disabled = false;
        }
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
  async function fecharCiclo(ciclo, {ocorrencias: ocorrencias, transacoes: transacoes, perfil: perfil, forcar: forcar = false}) {
    const r = F.resumo(ciclo, {
      ocorrencias: ocorrencias,
      transacoes: transacoes,
      perfil: perfil
    });
    if (!r.completo && !forcar) {
      return {
        precisaConfirmar: true,
        resumo: r
      };
    }
    const existentes = await S.listar(FECHAMENTOS, {
      filtro: {
        cycle: ciclo
      }
    });
    const registro = F.paraRegistro(r);
    if (existentes.length) {
      await S.atualizar(FECHAMENTOS, existentes[0].id, {
        ...registro,
        reopened_at: null
      });
    } else {
      await S.inserir(FECHAMENTOS, registro);
    }
    return {
      fechado: true,
      resumo: r
    };
  }
  async function reabrir(ciclo) {
    const existentes = await S.listar(FECHAMENTOS, {
      filtro: {
        cycle: ciclo
      }
    });
    if (!existentes.length) {
      return false;
    }
    await S.atualizar(FECHAMENTOS, existentes[0].id, {
      reopened_at: (new Date).toISOString()
    });
    return true;
  }
  return {
    sincronizar: sincronizar,
    reconciliar: reconciliar,
    confirmar: confirmar,
    naoAconteceu: naoAconteceu,
    adiar: adiar,
    abrir: abrir,
    fecharCiclo: fecharCiclo,
    reabrir: reabrir
  };
})();
