// Assistente FinCK: tela do planejamento pessoal.
//
// Três camadas, de baixo para cima:
//   1. FinckDiagnostico (js/diagnostico-engine.js) calcula o raio-X aqui, no
//      aparelho, com regras e parâmetros visíveis em FINCK_CONFIG.DIAGNOSTICO.
//   2. A rota api/assistente-ia.js recebe só o retrato agregado (paraIA) e a
//      IA devolve linguagem: o plano de ação e as respostas da conversa.
//   3. Esta tela mostra os dois e diz sempre de onde veio cada coisa.
// Sem IA (demonstração, servidor sem chave, falha de rede), o plano é montado
// pelas regras do FinCK, no mesmo formato: o recurso diminui, não some.
document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const D = window.FinckDiagnostico;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "Assistente FinCK",
    subtitulo: "Seu planejamento pessoal"
  });
  if (!user) {
    return;
  }
  const $ = id => document.getElementById(id);
  const IA = cfg.ASSISTENTE_IA || {};
  const IA_ATIVA = IA.ATIVA === true && !!IA.ENDPOINT;
  const ctx = await F.carregarContexto();
  const diag = D.diagnosticar(ctx);
  const retrato = D.paraIA(diag);
  const NOMES = Object.fromEntries(diag.dimensoes.map(d => [ d.id, d.nome ]));
  const chaveLocal = `finck-assistente-plano:${user.id || "local"}`;
  const assinatura = JSON.stringify(retrato);

  // ------------------------------------------------------------ raio-X

  function renderIndice() {
    const host = $("indiceFinck");
    if (diag.indice === null) {
      host.innerHTML = `<p class="raiox__resumo">${U.escapeHTML(diag.resumo)}</p>`;
      return;
    }
    const nivel = diag.indice >= 75 ? "saudavel" : diag.indice >= 50 ? "atencao" : "critico";
    host.innerHTML = `
      <div class="indice-finck indice-finck--${nivel}">
        <span class="indice-finck__rotulo">Índice FinCK</span>
        <strong class="indice-finck__valor">${diag.indice}<small>/100</small></strong>
        <span class="indice-finck__nivel">vida financeira ${U.escapeHTML(diag.rotulo)}</span>
      </div>
      <p class="raiox__resumo">${U.escapeHTML(diag.resumo)}</p>`;
    window.FinckFundo?.tom(nivel === "saudavel" ? "positivo" : "neutro");
  }

  function renderDimensoes() {
    $("dimensoes").innerHTML = diag.dimensoes.map(d => `
      <article class="dimensao dimensao--${d.nivel}">
        <header class="dimensao__topo">
          <h4>${U.escapeHTML(d.nome)}</h4>
          <span class="dimensao__nivel">${U.escapeHTML(D.NIVEIS[d.nivel])}</span>
        </header>
        <p class="dimensao__valor">${U.escapeHTML(d.valor_texto)}</p>
        ${d.nota !== null ? `<div class="barra" role="img" aria-label="Nota ${d.nota} de 100"><div class="barra-preenchida" style="width:${d.nota}%"></div></div>` : ""}
        ${d.referencia ? `<p class="dimensao__referencia">Referência: ${U.escapeHTML(d.referencia)}</p>` : ""}
        <p class="dimensao__explicacao">${U.escapeHTML(d.explicacao)}</p>
      </article>`).join("");
    const p = cfg.DIAGNOSTICO;
    $("comoCalcula").innerHTML = `
      <p class="descricao">Cada dimensão recebe uma nota de 0 a 100 pela distância até a referência. O índice é a média ponderada das dimensões que têm dados; as sem dados ficam fora da conta. Com o mês ainda em andamento, a poupança conta com metade do peso.</p>
      <ul class="lista-simples">
        ${diag.dimensoes.map(d => `<li>${U.escapeHTML(d.nome)}: peso ${Math.round((p.PESOS[d.id] || 0) * 100)}%${d.referencia ? `, referência ${U.escapeHTML(d.referencia)}` : ""}</li>`).join("")}
      </ul>
      <p class="nota">As referências são didáticas e ficam todas em um só lugar do código (FINCK_CONFIG.DIAGNOSTICO). A regra 50/30/20 vem de Warren e Tyagi (2005); a reserva de ${p.RESERVA_MINIMA_MESES} a ${p.RESERVA_IDEAL_MESES} meses e o teto de parcelas são parâmetros prudenciais adotados pelo projeto. O índice não é score de crédito.</p>`;
  }

  function renderPrioridades() {
    const host = $("prioridades");
    if (!diag.prioridades.length) {
      host.innerHTML = `<li class="prioridade prioridade--saudavel"><p><strong>Nada urgente agora.</strong> Mantenha os hábitos e use o FinCK of Reality antes das próximas compras.</p></li>`;
      return;
    }
    host.innerHTML = diag.prioridades.slice(0, 5).map(x => `
      <li class="prioridade prioridade--${x.nivel}">
        <div>
          <h4>${U.escapeHTML(x.titulo)}</h4>
          <p>${U.escapeHTML(x.porque)}</p>
          <small class="prioridade__origem">Baseado em: ${U.escapeHTML(NOMES[x.dimensao] || x.dimensao)}</small>
        </div>
        <a class="btn-secundario btn-mini" href="${x.href}">${U.escapeHTML(x.acao)}</a>
      </li>`).join("");
  }

  function renderNumeros() {
    const r = diag.retrato;
    const categorias = r.categorias.slice(0, 6);
    const metas = r.metas;
    $("numeros").innerHTML = `
      <div class="numeros-assistente__grupo">
        <h4>Mês típico</h4>
        <ul class="lista-resumo">
          <li><span>Renda declarada</span><strong>${U.moeda(r.renda)}</strong></li>
          <li><span>Despesas fixas</span><strong class="cor-vermelha">${U.moeda(r.despesas_fixas)}</strong></li>
          <li><span>Gastos (média${r.meses_considerados ? ` de ${r.meses_considerados} ${r.meses_considerados === 1 ? "mês" : "meses"}` : ""})</span><strong>${U.moeda(r.media_gastos)}</strong></li>
          <li><span>Guardado em metas por mês</span><strong class="cor-verde">${U.moeda(r.media_aportes)}</strong></li>
          <li><span>Parcelas por mês</span><strong>${U.moeda(r.parcelas_mensais)}</strong></li>
        </ul>
        ${r.mes_parcial ? `<p class="nota">Ainda não há um mês completo registrado: a média usa o mês atual, que está em andamento.</p>` : ""}
      </div>
      <div class="numeros-assistente__grupo">
        <h4>Para onde vai o dinheiro</h4>
        ${categorias.length ? `<ul class="lista-categorias">${categorias.map(c => `
          <li>
            <span class="lista-categorias__nome">${U.escapeHTML(c.nome)}</span>
            <span class="lista-categorias__barra"><span style="width:${Math.min(100, c.participacao)}%"></span></span>
            <strong>${U.moeda(c.media_mensal)}<small>/mês</small></strong>
            ${c.tendencia_pct !== null && Math.abs(c.tendencia_pct) >= 10 ? `<small class="lista-categorias__tendencia ${c.tendencia_pct > 0 ? "cor-vermelha" : "cor-verde"}">${c.tendencia_pct > 0 ? "▲" : "▼"} ${U.percentual(Math.abs(c.tendencia_pct), 0)} no último mês</small>` : ""}
          </li>`).join("")}</ul>` : `<p class="vazio">Sem gastos registrados ainda.</p>`}
      </div>
      <div class="numeros-assistente__grupo">
        <h4>Metas</h4>
        ${metas.length ? `<ul class="lista-metas-assistente">${metas.map(m => `
          <li>
            <strong>${U.escapeHTML(m.nome)}</strong>
            <span>${U.moeda(m.atual)} de ${U.moeda(m.alvo)} (${U.percentual(m.progresso, 0)})</span>
            <small>${m.concluida ? "Concluída." : m.parada ? "Sem aportes nos últimos 3 meses." : m.meses_para_concluir ? `No ritmo atual (${U.moeda(m.ritmo_mensal)}/mês), conclui em cerca de ${U.numero(m.meses_para_concluir, 1)} meses.` : ""}${!m.concluida && m.necessario_mensal ? ` O prazo pede ${U.moeda(m.necessario_mensal)}/mês.` : ""}</small>
          </li>`).join("")}</ul>` : `<p class="vazio">Nenhuma meta ainda. <a href="metas.html#nova">Criar a primeira</a>.</p>`}
      </div>`;
  }

  $("jsonEnviado").textContent = JSON.stringify(retrato, null, 2);
  renderIndice();
  renderDimensoes();
  renderPrioridades();
  renderNumeros();

  // ------------------------------------------------------------ IA

  // GET sem login e sem cota: diz se a rota existe e tem chave. Sem resposta
  // (site estático, rota fora do ar), o plano sai pelas regras.
  let situacao = null;
  function disponibilidade() {
    if (situacao) {
      return situacao;
    }
    situacao = (async () => {
      if (!IA_ATIVA) {
        return {
          ok: false,
          motivo: "O assistente com IA não está ligado nesta versão do app."
        };
      }
      if (S.emDemo()) {
        return {
          ok: false,
          demo: true,
          motivo: "Na demonstração, o plano é montado pelas regras do FinCK, sem IA. Com uma conta, a IA escreve o plano a partir dos seus números."
        };
      }
      const ctrl = new AbortController;
      const alarme = setTimeout(() => ctrl.abort(), 6000);
      try {
        const r = await fetch(IA.ENDPOINT, {
          method: "GET",
          cache: "no-store",
          signal: ctrl.signal
        });
        const s = r.ok ? await r.json().catch(() => null) : null;
        if (!s || s.ok !== true) {
          return {
            ok: false,
            motivo: "O assistente com IA não respondeu agora."
          };
        }
        return s.ia ? {
          ok: true
        } : {
          ok: false,
          motivo: "O assistente com IA ainda não foi configurado no servidor."
        };
      } catch {
        return {
          ok: false,
          motivo: "Sem conexão com o assistente com IA agora."
        };
      } finally {
        clearTimeout(alarme);
      }
    })();
    return situacao;
  }

  async function pedir(corpo) {
    const token = await S.tokenAcesso();
    if (!token) {
      return {
        ok: false,
        codigo: "SEM_LOGIN",
        motivo: "Sua sessão expirou. Entre novamente para usar o assistente."
      };
    }
    try {
      const r = await fetch(IA.ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planejamento: corpo
        })
      });
      return await r.json().catch(() => null) || {
        ok: false,
        motivo: "O assistente respondeu fora do esperado."
      };
    } catch {
      return {
        ok: false,
        codigo: "REDE",
        motivo: "Não deu para falar com o assistente. Confira sua internet."
      };
    }
  }

  // ------------------------------------------------------------ plano

  const PRAZO_ORDEM = [ "esta semana", "este mês", "nos próximos 3 meses" ];
  function renderPlano(p, {em: em = null, aviso: aviso = null} = {}) {
    const origem = $("origemPlano");
    origem.hidden = false;
    origem.className = `selo-origem selo-origem--${p.origem}`;
    origem.textContent = p.origem === "ia" ? "Escrito por IA a partir dos seus números" : "Montado pelas regras do FinCK";
    const prioridades = p.prioridades.slice().sort((a, b) => PRAZO_ORDEM.indexOf(a.prazo) - PRAZO_ORDEM.indexOf(b.prazo));
    $("plano").innerHTML = `
      ${aviso ? `<p class="nota plano__aviso">${U.escapeHTML(aviso)}</p>` : ""}
      <article class="plano">
        <p class="plano__diagnostico">${U.escapeHTML(p.diagnostico)}</p>
        ${p.pontos_fortes.length ? `<div class="plano__fortes"><h4>O que já vai bem</h4><ul>${p.pontos_fortes.map(t => `<li>${U.escapeHTML(t)}</li>`).join("")}</ul></div>` : ""}
        <h4>Próximos passos</h4>
        <ol class="plano__prioridades">${prioridades.map(x => `
          <li>
            <div class="plano__cabeca">
              <strong>${U.escapeHTML(x.titulo)}</strong>
              <span class="chip-prazo">${U.escapeHTML(x.prazo)}</span>
            </div>
            <p>${U.escapeHTML(x.porque)}</p>
            ${x.passos.length ? `<ul class="plano__passos">${x.passos.map(t => `<li>${U.escapeHTML(t)}</li>`).join("")}</ul>` : ""}
            <small class="prioridade__origem">Baseado em: ${U.escapeHTML(NOMES[x.baseado_em] || x.baseado_em)}</small>
            ${x.href ? `<a class="link-mais" href="${x.href}">${U.escapeHTML(x.acao || "Fazer agora")}</a>` : ""}
          </li>`).join("")}</ol>
        ${p.metas_sugeridas.length ? `<div class="plano__metas"><h4>Metas sugeridas</h4>${p.metas_sugeridas.map(m => `
          <div class="meta-sugerida">
            <strong>${U.escapeHTML(m.nome)}</strong>
            <span class="meta-sugerida__valor">${U.moeda(m.valor_mensal)}<small>/mês</small></span>
            <p>${U.escapeHTML(m.motivo || "")}</p>
            <a class="btn-secundario btn-mini" href="metas.html#nova">Criar esta meta</a>
          </div>`).join("")}</div>` : ""}
        ${p.habito_da_semana ? `<div class="plano__habito"><h4>Hábito da semana</h4><p>${U.escapeHTML(p.habito_da_semana)}</p></div>` : ""}
        ${p.alerta ? `<p class="alerta">${U.escapeHTML(p.alerta)}</p>` : ""}
        ${p.faltam_dados && p.faltam_dados.length ? `<div class="plano__faltam"><h4>Para o retrato ficar mais preciso</h4><ul>${p.faltam_dados.map(t => `<li>${U.escapeHTML(t)}</li>`).join("")}</ul></div>` : ""}
        <p class="nota">${U.escapeHTML(p.limites || "")}${em ? ` Gerado em ${U.dataBR(em)}.` : ""}</p>
      </article>`;
    $("btnGerarPlano").textContent = p.origem === "ia" ? "Gerar de novo" : "Gerar meu plano";
  }

  function guardar(p) {
    try {
      localStorage.setItem(chaveLocal, JSON.stringify({
        plano: p,
        em: U.hojeISO(),
        assinatura: assinatura
      }));
    } catch {}
  }
  function lembrado() {
    try {
      return JSON.parse(localStorage.getItem(chaveLocal) || "null");
    } catch {
      return null;
    }
  }

  const statusPlano = $("statusPlano");
  let etapas = [];
  function mostrarEtapas() {
    const passos = [ "Lendo o seu retrato financeiro…", "Comparando gastos, reserva e metas…", "Escrevendo o plano de ação…", "A IA está levando mais tempo que o normal. Ainda tentando…" ];
    statusPlano.innerHTML = `<span class="busca-preco__giro" aria-hidden="true"></span> ${passos[0]}`;
    etapas = [ 2500, 7000, 20000 ].map((ms, i) => setTimeout(() => {
      statusPlano.innerHTML = `<span class="busca-preco__giro" aria-hidden="true"></span> ${passos[i + 1]}`;
    }, ms));
  }
  const pararEtapas = () => {
    etapas.forEach(clearTimeout);
    etapas = [];
  };

  $("btnGerarPlano").addEventListener("click", async () => {
    const botao = $("btnGerarPlano");
    const pode = await disponibilidade();
    if (!pode.ok) {
      // Na demonstração o motivo já está escrito acima do botão.
      renderPlano(D.planoLocal(diag), {
        aviso: pode.demo ? null : pode.motivo
      });
      statusPlano.textContent = "";
      return;
    }
    botao.disabled = true;
    botao.setAttribute("aria-busy", "true");
    mostrarEtapas();
    try {
      const r = await pedir({
        modo: "plano",
        retrato: retrato
      });
      pararEtapas();
      if (!r || !r.ok) {
        renderPlano(D.planoLocal(diag), {
          aviso: `${r?.motivo || "A IA não respondeu agora."} Enquanto isso, este é o plano montado pelas regras do FinCK.`
        });
        statusPlano.textContent = "";
        return;
      }
      guardar(r);
      renderPlano(r, {
        em: U.hojeISO()
      });
      statusPlano.textContent = "Plano pronto.";
    } finally {
      pararEtapas();
      botao.disabled = false;
      botao.removeAttribute("aria-busy");
    }
  });

  // O último plano da IA volta ao abrir a tela; se os números mudaram desde
  // então, a tela avisa em vez de fingir que o plano é de hoje.
  const salvo = lembrado();
  if (salvo?.plano?.origem === "ia") {
    renderPlano(salvo.plano, {
      em: salvo.em,
      aviso: salvo.assinatura !== assinatura ? "Seus números mudaram desde este plano. Gere de novo para considerar a situação de hoje." : null
    });
  }

  // ------------------------------------------------------------ conversa

  const SUGESTOES = [ "Quanto consigo guardar por mês?", "Qual meta devo priorizar?", "Onde estou gastando mais do que deveria?", "Posso assumir uma parcela de R$ 300 por mês?" ];
  const historico = [];
  const conversa = $("conversa");
  const campo = $("pergunta");
  $("sugestoes").innerHTML = SUGESTOES.map(t => `<button type="button" class="chip chip--sugestao" data-sugestao="${U.escapeHTML(t)}">${U.escapeHTML(t)}</button>`).join("");
  $("sugestoes").addEventListener("click", e => {
    const b = e.target.closest("[data-sugestao]");
    if (!b) {
      return;
    }
    campo.value = b.dataset.sugestao;
    campo.focus();
  });
  function bolha(papel, html) {
    const el = document.createElement("div");
    el.className = `bolha bolha--${papel}`;
    el.innerHTML = html;
    conversa.appendChild(el);
    el.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
    return el;
  }
  $("formPergunta").addEventListener("submit", async e => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (texto.length < 3) {
      return U.erroCampo("pergunta", "Escreva a sua pergunta.");
    }
    const pode = await disponibilidade();
    if (!pode.ok) {
      return;
    }
    const botao = $("btnPerguntar");
    botao.disabled = true;
    bolha("pessoa", `<p>${U.escapeHTML(texto)}</p>`);
    campo.value = "";
    const pendente = bolha("assistente", `<p class="bolha__pensando"><span class="busca-preco__giro" aria-hidden="true"></span> Pensando com os seus números…</p>`);
    try {
      const r = await pedir({
        modo: "pergunta",
        retrato: retrato,
        pergunta: texto,
        historico: historico.slice(-6)
      });
      if (!r || !r.ok) {
        pendente.innerHTML = `<p>${U.escapeHTML(r?.motivo || "A IA não respondeu agora.")}</p>`;
        pendente.classList.add("bolha--erro");
        return;
      }
      pendente.innerHTML = `
        <p>${U.escapeHTML(r.resposta)}</p>
        ${r.proximo_passo ? `<p class="bolha__passo"><strong>Próximo passo:</strong> ${U.escapeHTML(r.proximo_passo)}</p>` : ""}
        ${r.baseado_em.length ? `<small class="prioridade__origem">Baseado em: ${r.baseado_em.map(id => U.escapeHTML(NOMES[id] || id)).join(", ")}</small>` : ""}
        ${r.fora_do_escopo ? `<small class="prioridade__origem">Essa pergunta foge das finanças pessoais; o assistente responde melhor sobre renda, gastos, metas e decisões.</small>` : ""}`;
      historico.push({
        papel: "pessoa",
        texto: texto
      }, {
        papel: "assistente",
        texto: r.resposta
      });
    } finally {
      botao.disabled = false;
    }
  });

  // Sem IA disponível, a conversa avisa o motivo e o campo fica desligado,
  // em vez de deixar a pessoa escrever para nada.
  disponibilidade().then(pode => {
    if (pode.ok) {
      return;
    }
    const aviso = $("avisoConversa");
    aviso.hidden = false;
    aviso.textContent = pode.demo ? "Na demonstração, a conversa com a IA fica desligada. Com uma conta, ela responde usando os seus números." : `${pode.motivo} A conversa volta quando a IA estiver disponível.`;
    campo.disabled = true;
    $("btnPerguntar").disabled = true;
    $("sugestoes").querySelectorAll("button").forEach(b => {
      b.disabled = true;
    });
    if (!pode.demo) {
      $("descricaoPlano").textContent = "O plano abaixo é montado pelas regras do FinCK com os seus números.";
    } else {
      $("descricaoPlano").textContent = "Na demonstração, o plano é montado pelas regras do FinCK com os números de exemplo.";
    }
  });

  // Vindo do Reality: "Posso comprar … de R$ …?" já chega escrito.
  const vinda = new URLSearchParams(location.search).get("pergunta");
  if (vinda) {
    campo.value = vinda.slice(0, 400);
    $("secaoConversa").scrollIntoView({
      behavior: "smooth"
    });
  }
});
