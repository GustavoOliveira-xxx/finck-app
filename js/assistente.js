// Assistente FinCK: tela do planejamento pessoal.
//
// Três camadas, de baixo para cima:
//   1. FinckDiagnostico (js/diagnostico-engine.js) calcula o raio-X aqui, no
//      aparelho, com regras e parâmetros visíveis em FINCK_CONFIG.DIAGNOSTICO.
//   2. A rota api/assistente-ia.js recebe só o retrato agregado (paraIA) e a
//      FINCK AI devolve linguagem: o plano de ação e as respostas da conversa.
//   3. Esta tela mostra os dois e diz sempre de onde veio cada coisa.
// Sem IA (demonstração, servidor sem chave, falha de rede), o plano é montado
// pelas regras do FinCK, no mesmo formato: o recurso diminui, não some. O
// modo é descoberto ao abrir a tela e declarado antes de qualquer clique.
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
  const esc = U.escapeHTML;
  const IA = cfg.ASSISTENTE_IA || {};
  const IA_ATIVA = IA.ATIVA === true && !!IA.ENDPOINT;
  // A conversa responde em qualquer modo: com conta e a rota do assistente
  // disponível, por ela; senão (demonstração, rota do assistente ausente),
  // pela rota geral da FINCK AI (api/ia.js), com o retrato em texto, sem nomes.
  const ENDPOINT_LIVRE = "/api/ia";
  const MSG_IA = {
    ausente: "A FINCK AI não está disponível neste endereço.",
    desligada: "A FINCK AI está desligada neste servidor agora."
  };
  const P = cfg.DIAGNOSTICO || {};
  const JANELA = P.JANELA_MESES || 3;
  const ctx = await F.carregarContexto();
  const diag = D.diagnosticar(ctx);
  const retrato = D.paraIA(diag);
  const contextoConversa = D.contextoDaConversa(diag);
  const NOMES = Object.fromEntries(diag.dimensoes.map(d => [ d.id, d.nome ]));
  const DIMS = Object.fromEntries(diag.dimensoes.map(d => [ d.id, d ]));
  const chaveLocal = `finck-assistente-plano:${user.id || "local"}`;
  const assinatura = JSON.stringify(retrato);
  const demo = (() => {
    try {
      return S.emDemo();
    } catch {
      return false;
    }
  })();

  // Rolagem suave só com a animação completa e sem pedido do sistema.
  const movimentoLiberado = () => {
    const pref = window.FinckPreferencias?.animacoes?.() || "completa";
    return pref === "completa" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };
  const rolarAte = (el, bloco = "nearest") => el?.scrollIntoView({
    behavior: movimentoLiberado() ? "smooth" : "auto",
    block: bloco
  });

  const meses = n => `${n} ${n === 1 ? "mês" : "meses"}`;
  // Mensagens do servidor já costumam dizer o que fazer; a tela não repete.
  const jaDizOQueFazer = t => /tente de novo|entre novamente|volte amanhã|espere/i.test(String(t || ""));
  const selo = tipo => tipo === "estimativa" ? '<span class="selo-certeza selo-certeza--estimativa">Estimativa</span>' : '<span class="selo-certeza selo-certeza--confirmado">Dado confirmado</span>';

  // ------------------------------------------------------------ certeza

  // Dado confirmado: sai direto do que a pessoa registrou. Estimativa: depende
  // de média de poucos meses, de mês em andamento ou de um valor substituto.
  function certeza(d) {
    if (!d || d.nivel === "sem_dados") {
      return null;
    }
    const r = diag.retrato;
    if (d.id === "poupanca") {
      if (r.mes_parcial) {
        return {
          tipo: "estimativa",
          motivo: "O mês ainda está em andamento: a conta é refeita quando ele fechar."
        };
      }
      if (r.meses_considerados < JANELA) {
        return {
          tipo: "estimativa",
          motivo: `Média de ${meses(r.meses_considerados)}; a referência usa ${meses(JANELA)}.`
        };
      }
    }
    if (d.id === "reserva" && !(r.despesas_fixas > 0)) {
      return {
        tipo: "estimativa",
        motivo: "Sem despesas fixas cadastradas, o custo do mês vem da média de gastos."
      };
    }
    return {
      tipo: "confirmado",
      motivo: null
    };
  }
  const gastosEstimados = diag.retrato.mes_parcial || diag.retrato.meses_considerados < JANELA;

  // ------------------------------------------------------------ raio-X

  function renderIndice() {
    const host = $("indiceFinck");
    if (diag.indice === null) {
      host.innerHTML = `<p class="raiox__resumo">${esc(diag.resumo)}</p>`;
      return;
    }
    const nivel = diag.indice >= 75 ? "saudavel" : diag.indice >= 50 ? "atencao" : "critico";
    const estimadas = diag.dimensoes.filter(d => certeza(d)?.tipo === "estimativa").map(d => d.nome.toLowerCase());
    host.innerHTML = `
      <div class="indice-finck indice-finck--${nivel}">
        <span class="indice-finck__rotulo">Índice FinCK</span>
        <strong class="indice-finck__valor">${diag.indice}<small>/100</small></strong>
        <span class="indice-finck__nivel">vida financeira ${esc(diag.rotulo)}</span>
      </div>
      <p class="raiox__resumo">${esc(diag.resumo)}</p>
      ${estimadas.length ? `<p class="nota">${selo("estimativa")} O índice inclui estimativa em ${esc(estimadas.join(" e "))}, então ele pode mudar conforme você registra mais meses.</p>` : ""}`;
    window.FinckFundo?.tom(nivel === "saudavel" ? "positivo" : "neutro");
  }

  function renderDimensoes() {
    $("dimensoes").innerHTML = diag.dimensoes.map(d => {
      const c = certeza(d);
      return `
      <article class="dimensao dimensao--${d.nivel}">
        <header class="dimensao__topo">
          <h4>${esc(d.nome)}</h4>
          <span class="dimensao__nivel">${esc(D.NIVEIS[d.nivel])}</span>
        </header>
        <p class="dimensao__valor">${esc(d.valor_texto)}</p>
        ${c ? `<p class="dimensao__certeza">${selo(c.tipo)}${c.motivo ? ` <span>${esc(c.motivo)}</span>` : ""}</p>` : ""}
        ${d.nota !== null ? `<div class="barra" role="img" aria-label="Nota ${d.nota} de 100"><div class="barra-preenchida" style="width:${d.nota}%"></div></div>` : ""}
        ${d.referencia ? `<p class="dimensao__referencia">Referência: ${esc(d.referencia)}</p>` : ""}
        <p class="dimensao__explicacao">${esc(d.explicacao)}</p>
      </article>`;
    }).join("");
    $("comoCalcula").innerHTML = `
      <p class="descricao">Cada dimensão recebe uma nota de 0 a 100 pela distância até a referência. O índice é a média ponderada das dimensões que têm dados; as sem dados ficam fora da conta. Com o mês ainda em andamento, a poupança conta com metade do peso.</p>
      <ul class="lista-simples">
        ${diag.dimensoes.map(d => `<li>${esc(d.nome)}: peso ${Math.round((P.PESOS?.[d.id] || 0) * 100)}%${d.referencia ? `, referência ${esc(d.referencia)}` : ""}</li>`).join("")}
      </ul>
      <p class="nota">As referências são didáticas e ficam todas em um só lugar do código (FINCK_CONFIG.DIAGNOSTICO). A regra 50/30/20 vem de Warren e Tyagi (2005); a reserva de ${P.RESERVA_MINIMA_MESES} a ${P.RESERVA_IDEAL_MESES} meses e o teto de parcelas são parâmetros prudenciais adotados pelo projeto. O índice não é score de crédito.</p>`;
  }

  function renderPrioridades() {
    const host = $("prioridades");
    if (!diag.prioridades.length) {
      host.innerHTML = `<li class="prioridade prioridade--saudavel"><p><strong>Nada urgente agora.</strong> Os hábitos atuais estão segurando o mês. O FinCK of Reality ajuda a pesar as próximas compras.</p></li>`;
      return;
    }
    host.innerHTML = diag.prioridades.slice(0, 5).map(x => `
      <li class="prioridade prioridade--${x.nivel}">
        <div>
          <h4>${esc(x.titulo)}</h4>
          <p>${esc(x.porque)}</p>
          <small class="prioridade__origem">Baseado em: ${esc(NOMES[x.dimensao] || x.dimensao)}</small>
        </div>
        <a class="btn-secundario btn-mini" href="${x.href}">${esc(x.acao)}</a>
      </li>`).join("");
  }

  function renderNumeros() {
    const r = diag.retrato;
    const categorias = r.categorias.slice(0, 6);
    const metas = r.metas;
    const media = r.meses_considerados ? ` de ${meses(r.meses_considerados)}` : "";
    const marcaMedia = gastosEstimados ? ` ${selo("estimativa")}` : "";
    $("numeros").innerHTML = `
      <div class="numeros-assistente__grupo">
        <h4>Mês típico</h4>
        <ul class="lista-resumo">
          <li><span>Renda declarada</span><strong>${U.moeda(r.renda)}</strong></li>
          <li><span>Despesas fixas</span><strong class="cor-vermelha">${U.moeda(r.despesas_fixas)}</strong></li>
          <li><span>Gastos (média${media})${marcaMedia}</span><strong>${U.moeda(r.media_gastos)}</strong></li>
          <li><span>Guardado em metas por mês${marcaMedia}</span><strong class="cor-verde">${U.moeda(r.media_aportes)}</strong></li>
          <li><span>Parcelas por mês</span><strong>${U.moeda(r.parcelas_mensais)}</strong></li>
        </ul>
        ${r.mes_parcial ? `<p class="nota">Ainda não há um mês completo registrado: a média usa o mês atual, que está em andamento.</p>` : gastosEstimados ? `<p class="nota">As médias usam ${meses(r.meses_considerados)}; com ${meses(JANELA)} registrados, elas deixam de ser estimativa.</p>` : ""}
      </div>
      <div class="numeros-assistente__grupo">
        <h4>Para onde vai o dinheiro</h4>
        ${categorias.length ? `<ul class="lista-categorias">${categorias.map(c => `
          <li>
            <span class="lista-categorias__nome">${esc(c.nome)}</span>
            <span class="lista-categorias__barra"><span style="width:${Math.min(100, c.participacao)}%"></span></span>
            <strong>${U.moeda(c.media_mensal)}<small>/mês</small></strong>
            ${c.tendencia_pct !== null && Math.abs(c.tendencia_pct) >= 10 ? `<small class="lista-categorias__tendencia ${c.tendencia_pct > 0 ? "cor-vermelha" : "cor-verde"}">${c.tendencia_pct > 0 ? "▲" : "▼"} ${U.percentual(Math.abs(c.tendencia_pct), 0)} no último mês</small>` : ""}
          </li>`).join("")}</ul>` : `<p class="vazio">Nenhum gasto registrado ainda. <a href="home.html#novo-lancamento">Registrar o primeiro</a> e o FinCK mostra para onde vai o dinheiro.</p>`}
      </div>
      <div class="numeros-assistente__grupo">
        <h4>Metas</h4>
        ${metas.length ? `<ul class="lista-metas-assistente">${metas.map(m => `
          <li>
            <strong>${esc(m.nome)}</strong>
            <span>${U.moeda(m.atual)} de ${U.moeda(m.alvo)} (${U.percentual(m.progresso, 0)})</span>
            <small>${m.concluida ? "Concluída." : m.parada ? "Sem aportes nos últimos 3 meses." : m.meses_para_concluir ? `No ritmo atual (${U.moeda(m.ritmo_mensal)}/mês), conclui em cerca de ${U.numero(m.meses_para_concluir, 1)} meses (estimativa).` : ""}${!m.concluida && m.necessario_mensal ? ` O prazo pede ${U.moeda(m.necessario_mensal)}/mês.` : ""}</small>
          </li>`).join("")}</ul>` : `<p class="vazio">Nenhuma meta ainda. <a href="metas.html#nova">Criar a primeira</a>.</p>`}
      </div>`;
  }

  // Formato dos dois pedidos, para a pessoa ver antes de enviar qualquer coisa.
  $("jsonEnviado").textContent = JSON.stringify(retrato, null, 2);
  $("pedidoPlano").textContent = JSON.stringify({
    planejamento: {
      modo: "plano",
      retrato: "(o retrato agregado abaixo)"
    }
  }, null, 2);
  $("pedidoConversa").textContent = JSON.stringify({
    planejamento: {
      modo: "pergunta",
      retrato: "(o retrato agregado abaixo)",
      pergunta: "(a sua pergunta, até 400 caracteres)",
      historico: "(até 6 mensagens anteriores desta conversa)"
    }
  }, null, 2);
  renderIndice();
  renderDimensoes();
  renderPrioridades();
  renderNumeros();

  // ------------------------------------------------------------ modo

  // GET sem login e sem cota: diz se a rota existe e tem chave. Na
  // demonstração não chama nada. Sem resposta (site estático, 404 local,
  // rota fora do ar), o modo é o plano local.
  let situacao = null;
  function disponibilidade() {
    if (situacao) {
      return situacao;
    }
    situacao = (async () => {
      if (demo) {
        return {
          tipo: "demo"
        };
      }
      if (!IA_ATIVA) {
        return {
          tipo: "local",
          motivo: "A FINCK AI não está ligada nesta versão do app."
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
        if (r.status === 404) {
          return {
            tipo: "local",
            motivo: MSG_IA.ausente
          };
        }
        const s = r.ok ? await r.json().catch(() => null) : null;
        if (!s || s.ok !== true) {
          return {
            tipo: "local",
            motivo: "A FINCK AI não respondeu agora."
          };
        }
        return s.ia ? {
          tipo: "ia",
          provedor: s.provedor || null
        } : {
          tipo: "local",
          motivo: MSG_IA.desligada
        };
      } catch {
        return {
          tipo: "local",
          motivo: "Sem conexão com a FINCK AI agora."
        };
      } finally {
        clearTimeout(alarme);
      }
    })();
    return situacao;
  }

  // GET sem custo na rota geral: 404 ou ia:false avisam antes de a pessoa
  // escrever. Sem resposta, fica em aberto e o próprio envio conta o motivo.
  let situacaoLivre = null;
  function iaLivre() {
    if (!situacaoLivre) {
      situacaoLivre = (async () => {
        const ctrl = new AbortController;
        const alarme = setTimeout(() => ctrl.abort(), 6000);
        try {
          const r = await fetch(ENDPOINT_LIVRE, {
            method: "GET",
            cache: "no-store",
            signal: ctrl.signal
          });
          if (r.status === 404) {
            return {
              ok: false,
              motivo: MSG_IA.ausente
            };
          }
          const j = await r.json().catch(() => null);
          return j && j.ia === false ? {
            ok: false,
            motivo: MSG_IA.desligada
          } : {
            ok: true
          };
        } catch {
          return null;
        } finally {
          clearTimeout(alarme);
        }
      })();
    }
    return situacaoLivre;
  }
  async function canalDaConversa(m) {
    if (m.tipo === "ia") {
      return {
        canal: "assistente"
      };
    }
    const livre = await iaLivre();
    return livre && livre.ok === false ? {
      canal: null,
      motivo: livre.motivo
    } : {
      canal: "livre"
    };
  }

  const PROVEDORES = {
    anthropic: "o Claude, da Anthropic",
    openrouter: "modelos gratuitos do OpenRouter"
  };

  // Tudo que muda com o modo, num lugar só: título, texto, selo, ficha,
  // botão e a conversa.
  const MODOS = {
    demo: {
      titulo: "Plano demonstrativo",
      texto: "Este plano é montado pelas regras do FinCK usando dados de exemplo. Com uma conta, a FINCK AI pode escrever um plano a partir dos seus números agregados.",
      botao: "Gerar plano demonstrativo",
      selo: [ "regras", "Regras do FinCK" ],
      ficha: () => [ [ "Quem escreve", "As regras do FinCK, no seu aparelho, sem IA." ], [ "O que é enviado", "Nada para montar o plano. Uma pergunta na conversa leva os números de exemplo, sem nomes." ], [ "Onde fica salvo", "Em nenhum lugar: o plano é refeito na hora a cada clique." ] ]
    },
    local: {
      titulo: "Plano local",
      texto: "A FINCK AI está indisponível agora. O FinCK ainda pode montar um plano pelas regras locais.",
      botao: "Gerar plano local",
      selo: [ "regras", "Regras do FinCK" ],
      ficha: m => [ [ "Por que local", `${m.motivo || "A FINCK AI não respondeu."} As contas e as regras funcionam sem ela.` ], [ "O que é enviado", "Nada para montar o plano: as regras rodam neste aparelho." ], [ "Quando a FINCK AI voltar", "Recarregue a página mais tarde: o botão passa a ser Gerar meu plano." ], [ "Onde fica salvo", "Em nenhum lugar: o plano local é refeito na hora a cada clique." ] ]
    },
    ia: {
      titulo: "Plano com IA",
      texto: "A FINCK AI escreve a explicação usando o retrato agregado mostrado em O que é enviado.",
      botao: "Gerar meu plano",
      selo: [ "ia", "✦ FINCK AI" ],
      ficha: m => [ [ "Quem escreve", `A FINCK AI${PROVEDORES[m.provedor] ? ` (${PROVEDORES[m.provedor]})` : ""} escreve o texto; os números e as notas são contas do FinCK.` ], [ "O que é enviado", "Só o retrato agregado, que você pode conferir abaixo antes de gerar." ], [ "Se a FINCK AI falhar", "O FinCK mostra na hora o plano pelas regras locais, e você pode tentar de novo em alguns minutos." ], [ "Onde fica salvo", "O último plano fica só neste aparelho, no navegador. O servidor não grava o pedido nem a resposta em banco ou log; o mesmo plano fica até 10 minutos na memória da função." ] ]
    }
  };

  let modo = null;
  let planoIaNaTela = false;
  const botao = $("btnGerarPlano");

  function rotuloBotao() {
    if (!modo) {
      return;
    }
    botao.textContent = modo.tipo === "ia" && planoIaNaTela ? "Gerar de novo" : MODOS[modo.tipo].botao;
  }

  function aplicarModo(m) {
    modo = m;
    const d = MODOS[m.tipo];
    document.querySelector(".bloco--plano").dataset.modo = m.tipo;
    $("tituloPlano").textContent = d.titulo;
    $("descricaoPlano").textContent = d.texto;
    const origem = $("origemPlano");
    origem.className = `selo-origem selo-origem--${d.selo[0]}`;
    origem.textContent = d.selo[1];
    const ficha = $("fichaPlano");
    ficha.innerHTML = d.ficha(m).map(([ t, v ]) => `<div><dt>${esc(t)}</dt><dd>${esc(v)}</dd></div>`).join("");
    ficha.hidden = false;
    botao.disabled = false;
    rotuloBotao();
    $("explicaEnvio").textContent = m.tipo === "ia" ? `Só o retrato agregado abaixo: números arredondados, nomes de categoria e de meta. Nenhuma descrição de lançamento, conta, e-mail ou nome seu. Os pedidos vão para a rota do FinCK na Vercel, que exige a sua conta e repassa a ${PROVEDORES[m.provedor] || "um provedor de IA"}. O servidor não grava nada em banco nem em log; para não repetir a chamada, o mesmo plano fica até 10 minutos na memória da função. O último plano fica só neste aparelho, e a conversa some quando você sai da página.` : m.tipo === "demo" ? "Na demonstração, o plano é montado pelas regras do FinCK no seu aparelho e nada dele é enviado. Uma pergunta na conversa vai para a FINCK AI com o retrato em texto mostrado abaixo: números de exemplo, sem nomes de metas, contas ou lançamentos." : "Sem a rota do assistente, o plano é montado pelas regras do FinCK no seu aparelho e nada dele é enviado. Uma pergunta na conversa, se a FINCK AI responder, vai com o retrato em texto mostrado abaixo, sem nomes de metas, contas ou lançamentos.";
  }

  async function pedir(corpo, aoEtapa = () => {}) {
    aoEtapa(0);
    const token = await S.tokenAcesso();
    if (!token) {
      return {
        ok: false,
        codigo: "SEM_LOGIN",
        motivo: "Sua sessão expirou. Entre novamente na sua conta para usar a FINCK AI."
      };
    }
    aoEtapa(1);
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
      aoEtapa(2);
      return await r.json().catch(() => null) || {
        ok: false,
        motivo: "A FINCK AI respondeu fora do esperado."
      };
    } catch {
      return {
        ok: false,
        codigo: "REDE",
        motivo: "Não deu para falar com a FINCK AI. Confira a sua internet."
      };
    }
  }

  // ------------------------------------------------------------ plano

  const PRAZO_ORDEM = [ "esta semana", "este mês", "nos próximos 3 meses" ];

  // "Por que o FinCK diz isso?": os números da dimensão em que a prioridade
  // se apoia, para a pessoa conferir a conclusão em vez de só acreditar nela.
  function htmlPorque(x, origemIa) {
    const d = DIMS[x.baseado_em];
    if (!d) {
      return "";
    }
    const c = certeza(d);
    return `
      <details class="porque-finck">
        <summary>Por que o FinCK diz isso?</summary>
        <div class="porque-finck__corpo">
          <p>${origemIa ? "A FINCK AI escreveu esta prioridade a partir da dimensão" : "Esta prioridade sai da regra da dimensão"} <strong>${esc(d.nome)}</strong>. Os números são contas do FinCK:</p>
          <dl class="porque-finck__numeros">
            <div><dt>Situação</dt><dd>${esc(d.valor_texto)}</dd></div>
            ${d.referencia ? `<div><dt>Referência</dt><dd>${esc(d.referencia)}</dd></div>` : ""}
            ${d.nota !== null ? `<div><dt>Nota</dt><dd>${d.nota}/100, ${esc(D.NIVEIS[d.nivel].toLowerCase())}</dd></div>` : `<div><dt>Nota</dt><dd>${esc(D.NIVEIS[d.nivel])}</dd></div>`}
          </dl>
          <p>${esc(d.explicacao)}</p>
          ${c ? `<p class="porque-finck__certeza">${selo(c.tipo)}${c.motivo ? ` ${esc(c.motivo)}` : ""}</p>` : ""}
        </div>
      </details>`;
  }

  // Depois do clique, o começo do plano entra na tela; se ele já está à
  // vista, nada se mexe.
  function mostrarPlano() {
    const topo = $("plano").getBoundingClientRect().top;
    if (topo > window.innerHeight * .6) {
      rolarAte($("plano"), "start");
    }
  }

  function renderPlano(p, {em: em = null, aviso: aviso = null} = {}) {
    const ia = p.origem === "ia";
    planoIaNaTela = ia;
    const prioridades = p.prioridades.slice().sort((a, b) => PRAZO_ORDEM.indexOf(a.prazo) - PRAZO_ORDEM.indexOf(b.prazo));
    // Na demonstração as regras rodam sobre dados de exemplo, não "os seus".
    const limites = !ia && demo ? "Plano montado pelas regras do FinCK com os dados de exemplo. É educativo: não é recomendação de investimento nem consultoria financeira." : p.limites || "";
    $("plano").innerHTML = `
      ${aviso ? `<p class="nota plano__aviso">${esc(aviso)}</p>` : ""}
      <article class="plano plano--${ia ? "ia" : "regras"}" aria-label="${ia ? "Plano escrito pela FINCK AI" : "Plano montado pelas regras do FinCK"}">
        <p class="plano__origem">${ia ? "✦ FINCK AI · escrito a partir do retrato agregado" : "Montado pelas regras do FinCK"}${em ? ` · ${esc(U.dataBR(em))}` : ""}</p>
        <p class="plano__diagnostico">${esc(p.diagnostico)}</p>
        ${p.pontos_fortes.length ? `<div class="plano__fortes"><h4>O que já vai bem</h4><ul>${p.pontos_fortes.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
        <h4>Próximos passos</h4>
        <ol class="plano__prioridades">${prioridades.map(x => `
          <li>
            <div class="plano__cabeca">
              <strong>${esc(x.titulo)}</strong>
              <span class="chip-prazo">${esc(x.prazo)}</span>
            </div>
            <p>${esc(x.porque)}</p>
            ${x.passos.length ? `<ul class="plano__passos">${x.passos.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
            <small class="prioridade__origem">Baseado em: ${esc(NOMES[x.baseado_em] || x.baseado_em)}</small>
            ${htmlPorque(x, ia)}
            ${x.href ? `<a class="link-mais" href="${x.href}">${esc(x.acao || "Ver no app")}</a>` : ""}
          </li>`).join("")}</ol>
        ${p.metas_sugeridas.length ? `<div class="plano__metas"><h4>Metas sugeridas</h4>${p.metas_sugeridas.map(m => `
          <div class="meta-sugerida">
            <strong>${esc(m.nome)}</strong>
            <span class="meta-sugerida__valor">${U.moeda(m.valor_mensal)}<small>/mês</small></span>
            <p>${esc(m.motivo || "")}</p>
            <a class="btn-secundario btn-mini" href="metas.html#nova">Criar esta meta</a>
          </div>`).join("")}<p class="nota">Uma sugestão não vira meta sozinha: ela só existe se você criar.</p></div>` : ""}
        ${p.habito_da_semana ? `<div class="plano__habito"><h4>Hábito da semana</h4><p>${esc(p.habito_da_semana)}</p></div>` : ""}
        ${p.alerta ? `<p class="alerta">${esc(p.alerta)}</p>` : ""}
        ${p.faltam_dados && p.faltam_dados.length ? `<div class="plano__faltam"><h4>Para o retrato ficar mais preciso</h4><ul>${p.faltam_dados.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
        <p class="nota">${esc(limites)}${ia ? "" : " A decisão continua sendo sua."}</p>
      </article>`;
    rotuloBotao();
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

  // Etapas reais do pedido: sessão, envio e espera, conferência da resposta.
  // Nada de progresso inventado; o aviso de demora só aparece se demorar.
  const statusPlano = $("statusPlano");
  const listaEtapas = $("etapasPlano");
  const ETAPAS_PLANO = [ "Conferindo a sua sessão…", "Enviando o retrato agregado e esperando a FINCK AI…", "Conferindo a resposta antes de mostrar…" ];
  let alarmeDemora = null;
  function mostrarEtapa(i) {
    listaEtapas.hidden = false;
    listaEtapas.innerHTML = ETAPAS_PLANO.map((t, k) => `<li data-estado="${k < i ? "feita" : k === i ? "atual" : "proxima"}">${k < i ? '<span class="visualmente-oculto">Feito: </span>' : ""}${esc(t)}</li>`).join("");
    statusPlano.textContent = ETAPAS_PLANO[i];
    if (i === 0) {
      // O botão pode estar no pé da tela: as etapas não nascem atrás da navegação.
      rolarAte(listaEtapas);
    }
    clearTimeout(alarmeDemora);
    if (i === 1) {
      alarmeDemora = setTimeout(() => {
        statusPlano.textContent = "A FINCK AI está levando mais tempo que o normal. O limite é de cerca de um minuto; se passar disso, o FinCK mostra o plano pelas regras.";
      }, 2e4);
    }
  }
  function esconderEtapas() {
    clearTimeout(alarmeDemora);
    listaEtapas.hidden = true;
    listaEtapas.innerHTML = "";
  }

  botao.addEventListener("click", async () => {
    const m = await disponibilidade();
    if (m.tipo !== "ia") {
      renderPlano(D.planoLocal(diag));
      statusPlano.textContent = m.tipo === "demo" ? "Plano demonstrativo pronto, logo abaixo." : "Plano local pronto, logo abaixo.";
      mostrarPlano();
      return;
    }
    botao.disabled = true;
    botao.setAttribute("aria-busy", "true");
    botao.textContent = "Gerando o plano…";
    try {
      const r = await pedir({
        modo: "plano",
        retrato: retrato
      }, mostrarEtapa);
      esconderEtapas();
      if (!r || !r.ok) {
        const oQueFazer = r?.codigo === "SEM_LOGIN" ? "Entre de novo na sua conta e tente outra vez." : jaDizOQueFazer(r?.motivo) ? "" : "Você pode tentar de novo em alguns minutos.";
        renderPlano(D.planoLocal(diag), {
          aviso: `${r?.motivo || "A FINCK AI não respondeu agora."} Enquanto isso, este é o plano montado pelas regras do FinCK. ${oQueFazer}`.trim()
        });
        statusPlano.textContent = "A FINCK AI não respondeu; o plano pelas regras está logo abaixo.";
        mostrarPlano();
        return;
      }
      guardar(r);
      renderPlano(r, {
        em: U.hojeISO()
      });
      statusPlano.textContent = "Plano da FINCK AI pronto, logo abaixo. Ele fica salvo só neste aparelho.";
      mostrarPlano();
    } finally {
      esconderEtapas();
      botao.disabled = false;
      botao.removeAttribute("aria-busy");
      rotuloBotao();
    }
  });

  // O último plano da FINCK AI volta ao abrir a tela; se os números mudaram
  // desde então, a tela avisa em vez de fingir que o plano é de hoje.
  const salvo = demo ? null : lembrado();
  if (salvo?.plano?.origem === "ia") {
    renderPlano(salvo.plano, {
      em: salvo.em,
      aviso: salvo.assinatura !== assinatura ? "Este é o último plano da FINCK AI salvo neste aparelho, e os seus números mudaram desde então. Gere de novo para considerar a situação de hoje." : "Este é o último plano da FINCK AI, salvo só neste aparelho."
    });
  }

  // ------------------------------------------------------------ conversa

  // Sugestões ligadas às prioridades da própria pessoa: quem abre a conversa
  // não precisa adivinhar o que perguntar, e a pergunta já nasce no contexto.
  function sugestoesDoRaioX({semNomes: semNomes = false} = {}) {
    const r = diag.retrato;
    const lista = [];
    const add = t => {
      if (t && !lista.includes(t) && lista.length < 4) {
        lista.push(t);
      }
    };
    const curto = t => t.length > 28 ? `${t.slice(0, 27).trim()}…` : t;
    const porDimensao = {
      reserva: () => "O que falta para a minha reserva chegar à referência?",
      poupanca: () => "Para onde está indo a sobra do meu mês?",
      compromissos: () => "Quanto as parcelas pesam na minha renda?",
      fluxo: () => "Quanto da minha renda já tem destino fixo?",
      metas: () => {
        const m = r.metas.find(x => !x.concluida && !x.no_ritmo);
        return m ? semNomes ? "Como deixar no ritmo do prazo a meta que está atrasada?" : `Como deixar a meta "${curto(String(m.nome || "Meta"))}" no ritmo do prazo?` : "Qual meta pesa mais no meu mês?";
      },
      consumo: () => "Como pesar melhor a próxima compra?"
    };
    diag.prioridades.forEach(x => add(porDimensao[x.dimensao]?.()));
    const subiu = r.categorias.find(c => c.tendencia_pct !== null && c.tendencia_pct >= 10);
    if (subiu) {
      add(`Por que ${curto(subiu.nome)} subiu no último mês?`);
    }
    if (diag.indice !== null) {
      add(`Por que o meu Índice FinCK está em ${diag.indice}?`);
    }
    add("Quanto consigo guardar por mês?");
    return lista;
  }

  const historico = [];
  const conversa = $("conversa");
  const campo = $("pergunta");
  const btnPerguntar = $("btnPerguntar");
  const desenharSugestoes = (opcoes = {}) => {
    $("sugestoes").innerHTML = sugestoesDoRaioX(opcoes).map(t => `<button type="button" class="chip chip--sugestao" data-sugestao="${esc(t)}" disabled>${esc(t)}</button>`).join("");
  };
  desenharSugestoes();
  $("sugestoes").addEventListener("click", e => {
    const b = e.target.closest("[data-sugestao]");
    if (!b || b.disabled) {
      return;
    }
    campo.value = b.dataset.sugestao;
    campo.focus();
  });
  document.querySelector("[data-abrir-envio]")?.addEventListener("click", e => {
    e.preventDefault();
    const det = $("detalhesEnvio");
    det.open = true;
    rolarAte(det, "start");
    det.querySelector("summary").focus({
      preventScroll: true
    });
  });

  function bolha(papel, html) {
    const el = document.createElement("div");
    el.className = `bolha bolha--${papel}`;
    el.innerHTML = html;
    conversa.appendChild(el);
    rolarAte(el);
    return el;
  }
  const ORIGEM_IA = '<p class="bolha__origem">✦ FINCK AI</p>';

  // Pela rota geral vão só a pergunta e o retrato em texto (sem nomes).
  async function perguntarLivre(pergunta) {
    try {
      const r = await fetch(ENDPOINT_LIVRE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pergunta: pergunta,
          contexto: contextoConversa
        })
      });
      if (r.status === 404) {
        return {
          ok: false,
          codigo: "AUSENTE",
          motivo: MSG_IA.ausente
        };
      }
      const j = await r.json().catch(() => null);
      if (r.ok && j && typeof j.resposta === "string" && j.resposta.trim()) {
        return {
          ok: true,
          resposta: j.resposta.trim()
        };
      }
      return {
        ok: false,
        motivo: j && j.erro ? String(j.erro) : "A FINCK AI não respondeu agora. Tente de novo em instantes."
      };
    } catch {
      return {
        ok: false,
        codigo: "REDE",
        motivo: "Não consegui falar com a FINCK AI. Confira a sua conexão e tente de novo."
      };
    }
  }

  $("formPergunta").addEventListener("submit", async e => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (texto.length < 3) {
      return U.erroCampo("pergunta", "Escreva a sua pergunta.");
    }
    if (!canalAtual || !canalAtual.canal) {
      return;
    }
    const livre = canalAtual.canal === "livre";
    btnPerguntar.disabled = true;
    btnPerguntar.setAttribute("aria-busy", "true");
    bolha("pessoa", `<p><span class="visualmente-oculto">Você perguntou: </span>${esc(texto)}</p>`);
    campo.value = "";
    const ETAPAS = livre ? [ "Enviando a pergunta e os números do raio-X…" ] : [ "Conferindo a sua sessão…", "Enviando a pergunta e o retrato agregado…", "Conferindo a resposta…" ];
    const pendente = bolha("assistente", `${ORIGEM_IA}<p class="bolha__espera"><span class="bolha__ponto" aria-hidden="true"></span> <span data-etapa>${ETAPAS[0]}</span></p>`);
    const etapa = pendente.querySelector("[data-etapa]");
    try {
      const r = livre ? await perguntarLivre(texto) : await pedir({
        modo: "pergunta",
        retrato: retrato,
        pergunta: texto,
        historico: historico.slice(-6)
      }, i => {
        etapa.textContent = ETAPAS[i];
      });
      if (!r || !r.ok) {
        pendente.classList.add("bolha--erro");
        pendente.innerHTML = `
          <p class="bolha__origem">FINCK AI indisponível agora</p>
          <p>${esc(r?.motivo || "A FINCK AI não respondeu agora.")}</p>
          <p class="bolha__rodape">O raio-X e o plano pelas regras continuam valendo.${r?.codigo === "SEM_LOGIN" ? " Entre de novo na sua conta e pergunte outra vez." : jaDizOQueFazer(r?.motivo) || r?.codigo === "AUSENTE" ? "" : " Tente de novo em alguns minutos."}</p>`;
        if (r?.codigo === "AUSENTE") {
          aplicarModoConversa(modo, {
            canal: null,
            motivo: r.motivo
          });
        }
        return;
      }
      if (livre) {
        // A frase de autonomia já vem no fim da resposta (api/ia.js).
        pendente.innerHTML = `
        ${ORIGEM_IA}
        <p class="bolha__texto">${esc(r.resposta)}</p>
        <p class="bolha__rodape">Resposta escrita pela FINCK AI a partir dos números ${demo ? "de exemplo da demonstração" : "deste raio-X"}, sem nomes de metas, contas ou lançamentos.</p>`;
        return;
      }
      const baseado = Array.isArray(r.baseado_em) ? r.baseado_em : [];
      pendente.innerHTML = `
        ${ORIGEM_IA}
        <p class="bolha__texto">${esc(r.resposta)}</p>
        ${r.proximo_passo ? `<p class="bolha__passo"><strong>Uma sugestão:</strong> ${esc(r.proximo_passo)}</p>` : ""}
        ${baseado.length ? `<small class="prioridade__origem">Baseado em: ${baseado.map(id => esc(NOMES[id] || id)).join(", ")}</small>` : ""}
        ${r.fora_do_escopo ? `<small class="prioridade__origem">Essa pergunta foge do seu raio-X; a FINCK AI responde melhor sobre renda, gastos, reserva, parcelas, metas e decisões de compra.</small>` : ""}
        <p class="bolha__rodape">Resposta escrita pela FINCK AI a partir do retrato agregado. A decisão continua sendo sua.</p>`;
      historico.push({
        papel: "pessoa",
        texto: texto
      }, {
        papel: "assistente",
        texto: r.resposta
      });
    } finally {
      btnPerguntar.disabled = false;
      btnPerguntar.removeAttribute("aria-busy");
    }
  });

  // A conversa liga sempre que alguma rota da FINCK AI responde. Sem
  // nenhuma, o motivo fica escrito perto do campo, em vez de deixar a pessoa
  // escrever para nada.
  let canalAtual = null;
  function aplicarModoConversa(m, c) {
    canalAtual = c || null;
    const ligada = Boolean(c && c.canal);
    const livre = ligada && c.canal === "livre";
    const aviso = $("avisoConversa");
    $("avisoEnvioConversa").hidden = !ligada;
    aviso.hidden = ligada;
    aviso.textContent = ligada ? "" : `${c?.motivo || m?.motivo || MSG_IA.ausente} A conversa volta quando ela estiver disponível; o raio-X e o plano pelas regras continuam valendo.`;
    $("textoEnvioConversa").textContent = livre ? `${demo ? "Na demonstração, sua pergunta vai para a FINCK AI com os números de exemplo deste raio-X" : "Sua pergunta vai para a FINCK AI com os números agregados deste raio-X"}, em texto: não vão nomes de metas, contas nem lançamentos. Não envie senhas, dados bancários, documentos ou informações de outras pessoas.` : "Sua pergunta será enviada à FINCK AI com o retrato financeiro agregado. Não envie senhas, dados bancários, documentos ou informações de outras pessoas.";
    if (livre) {
      $("pedidoConversa").textContent = `${JSON.stringify({
        pergunta: "(a sua pergunta, até 400 caracteres)",
        contexto: "(o retrato em texto, logo abaixo)"
      }, null, 2)}\n\n${contextoConversa}`;
    }
    const origem = $("origemConversa");
    origem.hidden = false;
    origem.className = `selo-origem selo-origem--${ligada ? "ia" : "regras"}`;
    origem.textContent = ligada ? "✦ FINCK AI" : "Desligada agora";
    // Só o aviso visível descreve o campo: o texto do envio não vale quando
    // nada é enviado.
    campo.setAttribute("aria-describedby", ligada ? "avisoEnvioConversa" : "avisoConversa");
    campo.disabled = !ligada;
    btnPerguntar.disabled = !ligada;
    desenharSugestoes({
      semNomes: !ligada || livre
    });
    $("sugestoes").querySelectorAll("button").forEach(b => {
      b.disabled = !ligada;
    });
  }

  disponibilidade().then(async m => {
    aplicarModo(m);
    aplicarModoConversa(m, await canalDaConversa(m));
  });

  // Vindo do Reality, a pergunta neutra sobre a compra já chega escrita.
  const vinda = new URLSearchParams(location.search).get("pergunta");
  if (vinda) {
    campo.value = vinda.slice(0, 400);
    rolarAte($("secaoConversa"), "start");
  }
});
