document.addEventListener("DOMContentLoaded", async () => {
  const U = window.FinckUtils;
  const S = window.FinckStore;
  const O = window.FinckOcorrencias;
  const F = window.FinckFechamento;
  const R = window.FinckRevisao;
  if (!U || !S || !O || !F || !R) {
    return;
  }
  if (!document.getElementById("conteudoRevisao")) {
    return;
  }
  const user = await S.usuarioAtual();
  if (!user) {
    return;
  }
  const linha = (rotulo, previsto, realizado, invertido = false) => {
    const dif = realizado - previsto;
    const cor = Math.abs(dif) < .005 ? "" : (invertido ? dif > 0 : dif < 0) ? "cor-vermelha" : "cor-verde";
    return `\n      <div class="fech-linha">\n        <dt>${rotulo}</dt>\n        <dd>\n          <span class="fech-linha__par">\n            <em>previsto</em><b>${U.moeda(previsto)}</b>\n          </span>\n          <span class="fech-linha__par">\n            <em>realizado</em><b>${U.moeda(realizado)}</b>\n          </span>\n          <span class="fech-linha__dif ${cor}">\n            ${dif === 0 ? "igual" : `${dif > 0 ? "+" : "−"}${U.moeda(Math.abs(dif))}`}\n          </span>\n        </dd>\n      </div>`;
  };
  function montarRelatorio(r, fechamento) {
    const mes = new Date(`${r.ciclo}-15T12:00:00`).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric"
    });
    return `\n      <p class="fech-titulo">Fechamento de ${mes}</p>\n\n      ${!r.completo ? `\n        <p class="fech-aviso">\n          ${r.pendencias} movimentação(ões) prevista(s) não foram confirmadas.\n          Elas não entram como realizadas.\n        </p>` : ""}\n\n      <dl class="fech-bloco">\n        <h4>Movimentações</h4>\n        ${linha("Entradas", r.receitaEsperada, r.receitaRealizada)}\n        ${linha("Saídas", r.despesaEsperada, r.despesaRealizada, true)}\n      </dl>\n\n      <div class="fech-resultado">\n        <span>Resultado do ciclo</span>\n        <strong class="${r.resultado < 0 ? "cor-vermelha" : "cor-verde"}">\n          ${r.resultado >= 0 ? "+" : "−"}${U.moeda(Math.abs(r.resultado))}\n        </strong>\n      </div>\n\n      <dl class="fech-bloco">\n        <h4>Organização financeira</h4>\n        ${linha("Renda livre", r.rendaLivreProporcional, r.rendaLivreUsada, true)}\n        ${linha("Economia", r.economiaProporcional, r.economiaRealizada)}\n        <p class="fech-nota">\n          A referência acompanha a receita que realmente entrou, não a esperada.\n          É uma referência, não uma obrigação.\n        </p>\n      </dl>\n\n      <dl class="fech-bloco">\n        <h4>Saídas do ciclo</h4>\n        <div class="fech-linha fech-linha--simples">\n          <dt>Recorrentes realizados</dt><dd><b>${U.moeda(r.recorrentesRealizados)}</b></dd>\n        </div>\n        <div class="fech-linha fech-linha--simples">\n          <dt>Outras despesas</dt><dd><b>${U.moeda(r.outrasDespesas)}</b></dd>\n        </div>\n      </dl>\n\n      <div class="fech-acoes">\n        ${!r.completo && !fechamento ? `<button type="button" class="btn-secundario" data-acao="revisar">Revisar pendências</button>\n             <button type="button" class="btn-primario" data-acao="fechar-assim">Fechar mesmo assim</button>` : fechamento ? `<button type="button" class="btn-secundario" data-acao="reabrir">Reabrir fechamento</button>` : `<button type="button" class="btn-primario" data-acao="fechar">Fechar o ciclo</button>`}\n      </div>`;
  }
  async function contexto() {
    const [ocorrencias, transacoes, perfil, fechamentos] = await Promise.all([ S.listar("recurring_occurrences", {
      ordem: "due_date",
      asc: true
    }), S.listar("transactions", {
      ordem: "date",
      asc: false
    }).then(l => l.filter(t => !t.reversed_at)), S.obterPerfil(), S.listar("monthly_closings", {
      ordem: "cycle",
      asc: false
    }) ]);
    return {
      ocorrencias: ocorrencias,
      transacoes: transacoes,
      perfil: perfil,
      fechamentos: fechamentos
    };
  }
  async function abrirFechamento(ciclo) {
    const {ocorrencias: ocorrencias, transacoes: transacoes, perfil: perfil, fechamentos: fechamentos} = await contexto();
    const r = F.resumo(ciclo, {
      ocorrencias: ocorrencias,
      transacoes: transacoes,
      perfil: perfil
    });
    const jaFechado = fechamentos.find(f => f.cycle === ciclo && !f.reopened_at);
    const host = document.getElementById("conteudoFechamento");
    host.innerHTML = montarRelatorio(r, jaFechado);
    U.abrirModal("modalFechamento");
    host.querySelector('[data-acao="revisar"]')?.addEventListener("click", async () => {
      U.fecharModal("modalFechamento");
      const abertas = ocorrencias.filter(o => o.cycle === ciclo && O.ABERTOS.includes(o.status));
      await R.abrir(abertas, {
        cicloPronto: true,
        aoTerminar: () => abrirFechamento(ciclo)
      });
    });
    const fechar = async () => {
      await R.fecharCiclo(ciclo, {
        ocorrencias: ocorrencias,
        transacoes: transacoes,
        perfil: perfil,
        forcar: true
      });
      U.toast("Ciclo fechado.", "sucesso");
      abrirFechamento(ciclo);
    };
    host.querySelector('[data-acao="fechar"]')?.addEventListener("click", fechar);
    host.querySelector('[data-acao="fechar-assim"]')?.addEventListener("click", fechar);
    host.querySelector('[data-acao="reabrir"]')?.addEventListener("click", async () => {
      await R.reabrir(ciclo);
      U.toast("Fechamento reaberto. Você pode ajustar as movimentações.", "info");
      abrirFechamento(ciclo);
    });
  }
  const recorrentes = await S.listar("recurring_transactions", {
    ordem: "day_of_month",
    asc: true
  });
  const ocorrencias = await R.sincronizar(recorrentes);
  window.FinckProgramacaoHome?.recarregar?.();
  const anterior = F.cicloAnterior();
  const atual = O.cicloDe(new Date);
  const prontos = [ anterior, atual ].filter(c => O.cicloPronto(ocorrencias, c));
  const {fechamentos: fechamentos} = await contexto();
  const aFechar = prontos.find(c => !fechamentos.some(f => f.cycle === c && !f.reopened_at));
  const pendentes = O.pendentes(ocorrencias);
  const abrirRevisao = () => R.abrir(pendentes, {
    cicloPronto: Boolean(aFechar),
    aoTerminar: (_, opcoes) => {
      window.FinckProgramacaoHome?.recarregar?.();
      if (opcoes?.irParaFechamento && aFechar) {
        abrirFechamento(aFechar);
      }
    }
  });
  if (pendentes.length) {
    // UX-003 — na demonstração ninguém pediu para revisar nada: abrir o modal de
    // cara esconde o app de quem está conhecendo (ou apresentando) o FinCK. A
    // faixa deixa a escolha explícita. Em conta real, o dinheiro é de verdade e
    // a revisão continua vindo na frente.
    const faixa = document.getElementById("avisoRevisao");
    if (S.emDemo() && faixa) {
      faixa.hidden = false;
      faixa.innerHTML = `\n        <span>${pendentes.length} movimentação(ões) prevista(s) esperam sua confirmação. Elas ainda não mexeram no saldo.</span>\n        <button type="button" class="btn-secundario" id="btnRevisarAgora">Revisar agora</button>\n        <button type="button" class="btn-texto" id="btnVerAppPrimeiro">Ver o app primeiro</button>`;
      document.getElementById("btnRevisarAgora").addEventListener("click", () => {
        faixa.hidden = true;
        abrirRevisao();
      });
      document.getElementById("btnVerAppPrimeiro").addEventListener("click", () => {
        faixa.hidden = true;
      });
    } else {
      await abrirRevisao();
    }
  } else if (aFechar) {
    const faixa = document.getElementById("avisoFechamento");
    if (faixa) {
      faixa.hidden = false;
      faixa.innerHTML = `\n        <span>Seu ciclo de ${new Date(`${aFechar}-15T12:00:00`).toLocaleDateString("pt-BR", {
        month: "long"
      })} está pronto para fechamento.</span>\n        <button type="button" class="btn-secundario" id="btnAbrirFechamento">Ver fechamento</button>`;
      document.getElementById("btnAbrirFechamento").addEventListener("click", () => abrirFechamento(aFechar));
    }
  }
  window.FinckFechamentoUI = {
    abrir: abrirFechamento
  };
});
