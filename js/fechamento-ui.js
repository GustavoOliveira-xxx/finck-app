document.addEventListener("DOMContentLoaded", async () => {
  const U = window.FinckUtils;
  const S = window.FinckStore;
  const O = window.FinckOcorrencias;
  const F = window.FinckFechamento;
  const R = window.FinckRevisao;
  if (!U || !S || !O || !F || !R) return;
  if (!document.getElementById("conteudoRevisao")) return;

  const user = await S.usuarioAtual();
  if (!user) return;

  const linha = (rotulo, previsto, realizado, invertido = false) => {
    const dif = realizado - previsto;
    const cor = Math.abs(dif) < 0.005 ? "" : (invertido ? dif > 0 : dif < 0) ? "cor-vermelha" : "cor-verde";
    return `
      <div class="fech-linha">
        <dt>${rotulo}</dt>
        <dd>
          <span class="fech-linha__par">
            <em>previsto</em><b>${U.moeda(previsto)}</b>
          </span>
          <span class="fech-linha__par">
            <em>realizado</em><b>${U.moeda(realizado)}</b>
          </span>
          <span class="fech-linha__dif ${cor}">
            ${dif === 0 ? "igual" : `${dif > 0 ? "+" : "−"}${U.moeda(Math.abs(dif))}`}
          </span>
        </dd>
      </div>`;
  };

  function montarRelatorio(r, fechamento) {
    const mes = new Date(`${r.ciclo}-15T12:00:00`)
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    return `
      <p class="fech-titulo">Fechamento de ${mes}</p>

      ${!r.completo ? `
        <p class="fech-aviso">
          ${r.pendencias} movimentação(ões) prevista(s) não foram confirmadas.
          Elas não entram como realizadas.
        </p>` : ""}

      <dl class="fech-bloco">
        <h4>Movimentações</h4>
        ${linha("Entradas", r.receitaEsperada, r.receitaRealizada)}
        ${linha("Saídas", r.despesaEsperada, r.despesaRealizada, true)}
      </dl>

      <div class="fech-resultado">
        <span>Resultado do ciclo</span>
        <strong class="${r.resultado < 0 ? "cor-vermelha" : "cor-verde"}">
          ${r.resultado >= 0 ? "+" : "−"}${U.moeda(Math.abs(r.resultado))}
        </strong>
      </div>

      <dl class="fech-bloco">
        <h4>Organização financeira</h4>
        ${linha("Renda livre", r.rendaLivreProporcional, r.rendaLivreUsada, true)}
        ${linha("Economia", r.economiaProporcional, r.economiaRealizada)}
        <p class="fech-nota">
          A referência acompanha a receita que realmente entrou, não a esperada.
          É uma referência, não uma obrigação.
        </p>
      </dl>

      <dl class="fech-bloco">
        <h4>Saídas do ciclo</h4>
        <div class="fech-linha fech-linha--simples">
          <dt>Recorrentes realizados</dt><dd><b>${U.moeda(r.recorrentesRealizados)}</b></dd>
        </div>
        <div class="fech-linha fech-linha--simples">
          <dt>Outras despesas</dt><dd><b>${U.moeda(r.outrasDespesas)}</b></dd>
        </div>
      </dl>

      <div class="fech-acoes">
        ${!r.completo && !fechamento
          ? `<button type="button" class="btn-secundario" data-acao="revisar">Revisar pendências</button>
             <button type="button" class="btn-primario" data-acao="fechar-assim">Fechar mesmo assim</button>`
          : fechamento
            ? `<button type="button" class="btn-secundario" data-acao="reabrir">Reabrir fechamento</button>`
            : `<button type="button" class="btn-primario" data-acao="fechar">Fechar o ciclo</button>`}
      </div>`;
  }

  async function contexto() {
    const [ocorrencias, transacoes, perfil, fechamentos] = await Promise.all([
      S.listar("recurring_occurrences", { ordem: "due_date", asc: true }),
      S.listar("transactions", { ordem: "date", asc: false }).then((l) => l.filter((t) => !t.reversed_at)),
      S.obterPerfil(),
      S.listar("monthly_closings", { ordem: "cycle", asc: false }),
    ]);
    return { ocorrencias, transacoes, perfil, fechamentos };
  }

  async function abrirFechamento(ciclo) {
    const { ocorrencias, transacoes, perfil, fechamentos } = await contexto();
    const r = F.resumo(ciclo, { ocorrencias, transacoes, perfil });
    const jaFechado = fechamentos.find((f) => f.cycle === ciclo && !f.reopened_at);

    const host = document.getElementById("conteudoFechamento");
    host.innerHTML = montarRelatorio(r, jaFechado);
    U.abrirModal("modalFechamento");

    host.querySelector('[data-acao="revisar"]')?.addEventListener("click", async () => {
      U.fecharModal("modalFechamento");
      const abertas = ocorrencias.filter(
        (o) => o.cycle === ciclo && O.ABERTOS.includes(o.status));
      await R.abrir(abertas, {
        cicloPronto: true,
        aoTerminar: () => abrirFechamento(ciclo),
      });
    });

    const fechar = async () => {
      await R.fecharCiclo(ciclo, { ocorrencias, transacoes, perfil, forcar: true });
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

  const recorrentes = await S.listar("recurring_transactions", { ordem: "day_of_month", asc: true });
  const ocorrencias = await R.sincronizar(recorrentes);
  window.FinckProgramacaoHome?.recarregar?.();

  const anterior = F.cicloAnterior();
  const atual = O.cicloDe(new Date());
  const prontos = [anterior, atual].filter((c) => O.cicloPronto(ocorrencias, c));
  const { fechamentos } = await contexto();
  const aFechar = prontos.find(
    (c) => !fechamentos.some((f) => f.cycle === c && !f.reopened_at));

  const pendentes = O.pendentes(ocorrencias);

  if (pendentes.length) {
    await R.abrir(pendentes, {
      cicloPronto: Boolean(aFechar),
      aoTerminar: (_, opcoes) => {
        window.FinckProgramacaoHome?.recarregar?.();
        if (opcoes?.irParaFechamento && aFechar) abrirFechamento(aFechar);
      },
    });
  } else if (aFechar) {
    const faixa = document.getElementById("avisoFechamento");
    if (faixa) {
      faixa.hidden = false;
      faixa.innerHTML = `
        <span>Seu ciclo de ${new Date(`${aFechar}-15T12:00:00`)
          .toLocaleDateString("pt-BR", { month: "long" })} está pronto para fechamento.</span>
        <button type="button" class="btn-secundario" id="btnAbrirFechamento">Ver fechamento</button>`;
      document.getElementById("btnAbrirFechamento")
        .addEventListener("click", () => abrirFechamento(aFechar));
    }
  }

  window.FinckFechamentoUI = { abrir: abrirFechamento };
});
