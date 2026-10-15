// Hábitos de consumo na tela: os mesmos cartões em Análises, na Revisão
// financeira e no resumo da home. Só monta HTML com o que o motor
// (js/habitos-engine.js) calculou; nenhuma conta nova sai daqui.
//
// Linguagem: fatos com números, uma pergunta de reflexão e a conta à vista.
// Nada de "você gasta demais" nem de ordem de compra; a simulação aparece
// como possibilidade matemática, e a escolha fica com a pessoa.
window.FinckHabitosUI = (() => {
  const U = window.FinckUtils;
  const H = () => window.FinckHabitos;
  const esc = t => U.escapeHTML(t);
  const casa1 = v => Number(v || 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 1
  });
  const meses = n => `${casa1(n)} ${Math.round(Number(n) * 10) / 10 === 1 ? "mês" : "meses"}`;

  const SELOS = {
    confirmado: '<span class="selo-certeza selo-certeza--confirmado">Dado confirmado</span>',
    estimativa: '<span class="selo-certeza selo-certeza--estimativa">Estimativa</span>',
    simulacao: '<span class="selo-certeza selo-certeza--simulacao">Simulação</span>'
  };
  const selo = tipo => SELOS[tipo] || SELOS.confirmado;
  const htmlConta = linhas => linhas && linhas.length ? `<dl class="conta-habito">${linhas.map(l => `<div><dt>${esc(l.rotulo)}</dt><dd>${esc(l.valor)}</dd></div>`).join("")}</dl>` : "";

  function htmlConfianca(c) {
    if (!c) {
      return "";
    }
    return `<p class="confianca-habitos confianca-habitos--${esc(c.nivel)}"><strong>${esc(c.rotulo)}.</strong> ${esc(c.texto)}</p>`;
  }

  // Um padrão: título, o fato com os números, o efeito acumulado (sempre
  // estimativa), a pergunta de reflexão e, recolhidos, a conta e a simulação.
  function htmlPadrao(q, {simulador: simulador = true, link: link = true, compacto: compacto = false} = {}) {
    const acumulado = q.acumulado_12m ? `<p class="padrao-habito__acumulado"><span>Mantido esse ritmo, em 12 meses:</span> <strong>${U.moeda(q.acumulado_12m)}</strong>${q.horas_12m ? ` <small>(${casa1(q.horas_12m)} h de trabalho)</small>` : ""} ${selo("estimativa")}</p>` : "";
    const podeSimular = simulador && q.simulavel && q.base_mensal > 0;
    return `
      <li class="padrao-habito${q.ods12 ? " padrao-habito--ods12" : ""}" data-padrao="${esc(q.id)}">
        <div class="padrao-habito__topo">
          <h4 class="padrao-habito__titulo">${esc(q.titulo)}</h4>
          ${q.ods12 ? '<span class="selo-ods12">ODS 12</span>' : ""}
        </div>
        <p class="padrao-habito__texto">${esc(q.texto)} ${selo(q.certeza)}</p>
        ${acumulado}
        ${compacto ? "" : `<p class="padrao-habito__reflexao"><span>Para pensar:</span> ${esc(q.reflexao)}</p>`}
        <div class="padrao-habito__detalhes">
          ${compacto ? "" : `<details class="detalhe-habito">
            <summary>Como foi calculado?</summary>
            <div class="detalhe-habito__corpo">${htmlConta(q.calculo)}</div>
          </details>`}
          ${podeSimular ? `<details class="detalhe-habito simulador-habito" data-simular="${esc(q.id)}" data-base="${Number(q.base_mensal)}" data-nome="${esc(q.categoria || q.titulo)}">
            <summary>E se esse valor mudasse?</summary>
            <div class="detalhe-habito__corpo">
              <p class="simulador-habito__pergunta">Escolha uma redução para ver o efeito. É uma possibilidade matemática, não uma recomendação.</p>
              <div class="simulador-habito__opcoes" role="group" aria-label="Redução simulada">
                ${(window.FINCK_CONFIG.HABITOS.SIMULACOES_PCT || [ 10, 15, 20 ]).map(pc => `<button type="button" class="chip simulador-habito__chip" data-pct="${pc}" aria-pressed="false">${pc}% a menos</button>`).join("")}
              </div>
              <div class="simulador-habito__resultado" aria-live="polite"></div>
            </div>
          </details>` : ""}
        </div>
        ${link && q.acao ? `<a class="link-mais padrao-habito__acao" href="${esc(q.acao.href)}">${esc(q.acao.rotulo)}</a>` : ""}
      </li>`;
  }

  function htmlPadroes(h, opcoes = {}) {
    if (!h.padroes.length) {
      return `<p class="padroes-habitos__vazio">${esc(h.confianca.nivel === "insuficiente" ? h.confianca.texto : "Nenhum padrão chamou atenção nos seus registros recentes. Os números continuam em Análises, por categoria e mês a mês.")}</p>`;
    }
    const lista = opcoes.limite ? h.padroes.slice(0, opcoes.limite) : h.padroes;
    return `<ol class="padroes-habitos">${lista.map(q => htmlPadrao(q, opcoes)).join("")}</ol>`;
  }

  function htmlPositivos(h, {titulo: titulo = "O que melhorou"} = {}) {
    if (!h.positivos.length) {
      return "";
    }
    return `<div class="positivos-habitos"><h4>${esc(titulo)}</h4><ul>${h.positivos.map(p => `<li>${esc(p.texto)}</li>`).join("")}</ul></div>`;
  }

  // Os meses lado a lado. Sobra negativa leva o sinal e a palavra, não só a
  // cor; o mês em andamento é identificado.
  function htmlMeses(h) {
    const lista = h.meses.filter(m => m.com_registros);
    if (!lista.length) {
      return "";
    }
    const celula = v => `<td class="${v < 0 ? "cor-vermelha" : ""}">${U.moeda(v)}${v < 0 ? ' <small>(faltou)</small>' : ""}</td>`;
    return `
      <div class="tabela-wrapper" tabindex="0" role="region" aria-label="Meses lado a lado">
        <table class="tabela tabela-meses">
          <caption class="visualmente-oculto">Entradas, gastos, valor guardado em metas e sobra de cada mês</caption>
          <thead><tr><th scope="col">Mês</th><th scope="col">Entradas</th><th scope="col">Gastos</th><th scope="col">Dia a dia</th><th scope="col">Guardado em metas</th><th scope="col">Sobra</th></tr></thead>
          <tbody>${lista.map(m => `
            <tr${m.parcial ? ' class="tabela-meses__parcial"' : ""}>
              <th scope="row">${esc(m.rotulo)}${m.parcial ? " <small>(até hoje)</small>" : ""}</th>
              <td>${U.moeda(m.entradas)}</td>
              <td>${U.moeda(m.gastos)}</td>
              <td>${U.moeda(m.dia_a_dia)}</td>
              <td>${U.moeda(m.aportes)}</td>
              ${celula(m.sobra)}
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p class="nota">Sobra é o que entrou menos o que foi gasto. Dia a dia é o que não é conta fixa, parcela nem aporte. ${h.meses.some(m => m.parcial && m.com_registros) ? "O mês atual ainda está em andamento." : ""}</p>`;
  }

  // Categorias do dia a dia mês a mês, com a variação escrita (▲ ou ▼ e o
  // valor), para não depender de cor.
  function htmlCategorias(h, {limite: limite = 6} = {}) {
    const completos = h.meses.filter(m => !m.parcial && m.com_registros);
    if (completos.length < 2 || !h.categorias.length) {
      return "";
    }
    const cols = h.meses.filter(m => m.com_registros);
    const ultimo = completos[completos.length - 1].mes;
    const anterior = completos[completos.length - 2].mes;
    return `
      <div class="tabela-wrapper" tabindex="0" role="region" aria-label="Categorias do dia a dia mês a mês">
        <table class="tabela tabela-meses tabela-meses--categorias">
          <caption class="visualmente-oculto">Gastos do dia a dia por categoria em cada mês</caption>
          <thead><tr><th scope="col">Categoria</th>${cols.map(m => `<th scope="col">${esc(m.rotulo)}${m.parcial ? " <small>(até hoje)</small>" : ""}</th>`).join("")}<th scope="col">Variação</th></tr></thead>
          <tbody>${h.categorias.slice(0, limite).map(c => {
            const dif = (c.valores[ultimo] || 0) - (c.valores[anterior] || 0);
            const variacao = Math.abs(dif) < .005 ? "igual" : `${dif > 0 ? "▲" : "▼"} ${U.moeda(Math.abs(dif))}`;
            return `<tr><th scope="row">${esc(c.nome)}</th>${cols.map(m => `<td>${U.moeda(c.valores[m.mes] || 0)}</td>`).join("")}<td>${esc(variacao)}</td></tr>`;
          }).join("")}
          </tbody>
        </table>
      </div>
      <p class="nota">A variação compara os dois últimos meses completos.</p>`;
  }

  // O resultado de uma simulação, em texto. Sem meta, só o dinheiro.
  function textoSimulacao(s, nome) {
    const base = `Com ${s.pct}% a menos em ${nome}, são ${U.moeda(s.mensal)} por mês${s.horas_mes ? ` (${casa1(s.horas_mes)} h de trabalho)` : ""}: ${U.moeda(s.seis_meses)} em 6 meses e ${U.moeda(s.doze_meses)} em 12 meses.`;
    if (!s.meta) {
      return base;
    }
    const m = s.meta;
    const meta = m.meses_atual !== null ? ` Se esse valor fosse para a meta "${m.nome}", o prazo estimado passaria de ${meses(m.meses_atual)} para ${meses(m.meses_novo)}.` : ` Se esse valor fosse para a meta "${m.nome}", ela chegaria em cerca de ${meses(m.meses_novo)}.`;
    return base + meta;
  }

  // Liga os simuladores de uma região da página. A meta de referência e o
  // valor da hora vêm de quem chama.
  function ligarSimuladores(raiz, {meta: meta = null, valorHora: valorHora = 0} = {}) {
    if (!raiz || raiz.dataset.simuladoresLigados) {
      return;
    }
    raiz.dataset.simuladoresLigados = "1";
    raiz.addEventListener("click", e => {
      const chip = e.target.closest(".simulador-habito__chip");
      if (!chip) {
        return;
      }
      const caixa = chip.closest(".simulador-habito");
      const pc = Number(chip.dataset.pct);
      const [s] = H().simular(Number(caixa.dataset.base), {
        pcts: [ pc ],
        meta: meta,
        valorHora: valorHora
      });
      caixa.querySelectorAll(".simulador-habito__chip").forEach(b => b.setAttribute("aria-pressed", String(b === chip)));
      caixa.querySelector(".simulador-habito__resultado").innerHTML = `
        <p>${esc(textoSimulacao(s, caixa.dataset.nome))} ${selo("simulacao")}</p>
        <p class="nota">Supõe o mesmo ritmo de gastos e que o valor reduzido fique guardado. Mudar ou não é uma escolha sua.</p>`;
    });
  }

  return {
    selo: selo,
    htmlConta: htmlConta,
    htmlConfianca: htmlConfianca,
    htmlPadrao: htmlPadrao,
    htmlPadroes: htmlPadroes,
    htmlPositivos: htmlPositivos,
    htmlMeses: htmlMeses,
    htmlCategorias: htmlCategorias,
    textoSimulacao: textoSimulacao,
    ligarSimuladores: ligarSimuladores
  };
})();
