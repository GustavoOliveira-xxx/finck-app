// "O que merece atenção", "Comparar formas de decidir" e "Tirar uma dúvida
// sobre o cálculo", dentro do resultado do FinCK of Reality.
// Os números e os textos vêm do motor (js/inteligencia-engine.js); aqui se
// desenham os blocos, se repassa ao Reality o que a pessoa respondeu e, só
// quando ela envia uma pergunta livre, se fala com a ajuda opcional (/api/ia).
//
// O bloco principal vai no host (section#analiseFinck). A comparação e a
// dúvida vão em hosts.comparar e hosts.duvida quando o Reality os passa
// (dentro de "Se quiser aprofundar"); sem eles, ficam no fim do host.
window.FinckInteligenciaUI = (() => {
  const I = window.FinckInteligencia;
  const U = window.FinckUtils;
  const esc = s => U ? U.escapeHTML(s) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ENDPOINT_IA = "/api/ia";
  const MAX_PERGUNTA = 600;
  const MAX_TROCAS = 3;
  const SELO = {
    confirmado: [ "confirmado", "Dado confirmado", "Dado confirmado: vem do que você registrou no FinCK." ],
    estimativa: [ "estimativa", "Estimativa", "Estimativa: depende de uma suposição, como o ritmo de aportes, a vida útil ou meses iguais na simulação." ]
  };
  // Mensagens da ajuda opcional, sem jargão: o que aconteceu e o que fazer.
  const MSG = {
    indisponivel: "A ajuda opcional não está disponível agora.",
    limite: "A ajuda opcional atingiu o limite por agora. Tente de novo mais tarde.",
    demorou: "A ajuda opcional demorou demais para responder. Tente de novo em instantes.",
    conexao: "Não foi possível falar com a ajuda opcional. Confira a sua conexão e tente de novo.",
    falhou: "A ajuda opcional não conseguiu responder agora. Tente de novo em instantes."
  };
  const VALEM = "Os números acima continuam valendo.";
  const ROTULO_IA = "Resposta escrita por IA a partir dos números desta análise.";

  // estado: a análise que está na tela. memoria: o que a pessoa fez com ela
  // (dúvidas, forma de pagamento escolhida), mantido enquanto o item for o
  // mesmo, inclusive quando o Reality refaz a conta por causa de uma resposta.
  let estado = null;
  let memoria = novaMemoria(null);
  let pedido = null;
  let etapaDoPedido = null;
  let relogioEntrada = null;
  let iaDisponivel = null;
  let verificando = false;
  let proximaTroca = 1;
  let ligadoNoDocumento = false;
  const raizesLigadas = new WeakSet();

  function novaMemoria(chave) {
    return { chave: chave, trocas: [], duvidaAberta: false, livreAberta: false, forma: null, rascunho: "" };
  }
  const chaveDe = entrada => `${String(entrada.item_name || "").trim().toLowerCase()}|${Number(entrada.price) || 0}|${Number(entrada.quantity) || 1}`;
  const emDemo = () => {
    try {
      return Boolean(window.FinckStore && window.FinckStore.emDemo && window.FinckStore.emDemo());
    } catch {
      return false;
    }
  };
  // Movimento só quando a pessoa e o sistema deixam (Perfil e prefers-reduced-motion).
  const movimentoLiberado = () => {
    const reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return !reduz && (document.documentElement.dataset.animacoes || "completa") === "completa";
  };
  // Os três lugares onde a tela desenha, sem repetir quando são o mesmo.
  const raizes = () => estado ? [ estado.host, estado.comparar, estado.duvida ].filter((r, i, lista) => r && lista.indexOf(r) === i) : [];
  function no(nome) {
    for (const raiz of raizes()) {
      const achado = raiz.querySelector(`[data-af="${nome}"]`);
      if (achado) {
        return achado;
      }
    }
    return null;
  }
  // Abre os details em volta (o "Se quiser aprofundar" do Reality, por exemplo).
  function abrirEmVolta(elemento) {
    let d = elemento && elemento.parentElement ? elemento.parentElement.closest("details") : null;
    while (d) {
      d.open = true;
      d = d.parentElement ? d.parentElement.closest("details") : null;
    }
  }

  function analisarAgora() {
    return I.analisar({
      ctx: estado.ctx,
      entrada: estado.entrada,
      resultado: estado.resultado,
      linhaTempo: estado.linhaTempo,
      hoje: new Date(),
      formaConfirmada: estado.formaConfirmada,
      demo: emDemo()
    });
  }

  // --------------------------------------------------------------- esqueletos

  function htmlPrincipal() {
    return `
      <div class="analise-finck__cabecalho">
        <h4 id="tituloAnaliseFinck" class="analise-finck__titulo">O que merece atenção</h4>
        <p class="analise-finck__resumo" data-af="resumo" hidden></p>
      </div>
      <ol class="analise-finck__pontos" role="list" data-af="pontos"></ol>
      <div class="analise-finck__leitura" data-af="leitura"></div>
      <div data-af="perguntas"></div>
      <p class="analise-finck__status" data-af="status" role="status" aria-live="polite" tabindex="-1"></p>`;
  }

  function htmlComparar() {
    return `
      <details class="secao-finck secao-finck--comparar" data-af="comparar-caixa">
        <summary>
          <span class="secao-finck__topo">
            <span class="secao-finck__nome" id="tituloCompararFinck">Comparar formas de decidir</span>
            <span class="selo-certeza selo-certeza--simulacao">Simulação</span>
          </span>
          <small class="secao-finck__resumo" data-af="cenarios-resumo"></small>
        </summary>
        <div class="secao-finck__corpo" data-af="cenarios"></div>
      </details>`;
  }

  function htmlDuvida() {
    return `
      <details class="secao-finck secao-finck--duvida" data-af="duvida-caixa">
        <summary>
          <span class="secao-finck__nome" id="tituloDuvidaFinck">Tirar uma dúvida sobre o cálculo</span>
          <small class="secao-finck__resumo">Perguntas com resposta na hora, com a conta à vista.</small>
        </summary>
        <div class="secao-finck__corpo conversa-finck">
          <p class="conversa-finck__grupo" id="rotuloSugestoesFinck">Cálculo do FinCK</p>
          <div class="chips-finck" role="group" aria-labelledby="rotuloSugestoesFinck" data-af="sugestoes"></div>
          <div class="conversa-finck__historico" data-af="historico" aria-live="polite" aria-relevant="additions"></div>
          <details class="pergunta-livre-finck" data-af="livre">
            <summary>
              <span class="pergunta-livre-finck__nome">Pergunta livre <span class="pergunta-livre-finck__tipo">(Ajuda opcional)</span></span>
              <small>Escreva com as suas palavras. Nada é enviado sem você pedir.</small>
            </summary>
            <form class="conversa-finck__form" data-af="form" novalidate>
              <p class="conversa-finck__indisponivel" data-af="indisponivel" tabindex="-1" hidden></p>
              <div class="conversa-finck__campos" data-af="campos">
                <p class="conversa-finck__como">Ao enviar, um serviço de IA escreve a resposta a partir dos números desta análise. Os cálculos continuam sendo do FinCK.</p>
                <label class="conversa-finck__rotulo" for="perguntaFinck">Sua pergunta</label>
                <textarea id="perguntaFinck" data-af="pergunta" name="pergunta" rows="3" maxlength="${MAX_PERGUNTA}" aria-describedby="perguntaFinckConta avisoEnvioFinck avisoPrivacidadeFinck"></textarea>
                <p class="conversa-finck__conta" id="perguntaFinckConta" data-af="conta">0 de ${MAX_PERGUNTA} caracteres</p>
                <div class="aviso-envio-finck">
                  <p id="avisoEnvioFinck"><strong>O que é enviado:</strong> a sua pergunta, a categoria da compra e os números desta análise (renda, despesas fixas, saldo, horas, percentuais, prazos estimados e a simulação dos próximos meses). Não vão o nome do item nem nomes de metas, contas ou lançamentos.<span data-af="demo" hidden> Na demonstração, esses números são dados de exemplo.</span></p>
                  <p id="avisoPrivacidadeFinck"><strong>Privacidade:</strong> não envie senhas, dados bancários, documentos ou informações de outras pessoas. As respostas ficam só nesta tela (as ${MAX_TROCAS} últimas) e somem quando você começa outra análise.</p>
                  <details class="aviso-envio-finck__ver">
                    <summary>Ver os números que vão junto</summary>
                    <pre data-af="contexto"></pre>
                  </details>
                </div>
                <button type="submit" class="btn-secundario conversa-finck__enviar" data-af="enviar">Enviar pergunta</button>
                <ol class="etapas-finck" data-af="etapas" hidden></ol>
              </div>
            </form>
          </details>
        </div>
      </details>`;
  }

  // ---------------------------------------------------------------- análise

  function htmlCalculo(lista) {
    return `<ol class="cadeia-finck" role="list">${lista.map(c => `<li><span>${esc(c.rotulo)}</span><strong>${esc(c.valor)}</strong></li>`).join("")}</ol>`;
  }
  const htmlSelo = certeza => {
    const [classe, texto] = SELO[certeza] || SELO.estimativa;
    return `<span class="selo-certeza selo-certeza--${classe}">${texto}</span>`;
  };

  // Um fato, o selo e um só "Como foi calculado?" com o que entra na conta,
  // a conta passo a passo e o que fica de fora.
  function htmlPonto(p) {
    const selo = SELO[p.certeza] || SELO.estimativa;
    return `
      <li class="ponto-finck ponto-finck--${esc(p.id)}" data-ponto="${esc(p.id)}">
        <div class="ponto-finck__topo">
          <h5 class="ponto-finck__titulo">${esc(p.titulo)}</h5>
          ${htmlSelo(p.certeza)}
        </div>
        <p class="ponto-finck__texto">${esc(p.texto)}</p>
        <details class="ponto-finck__detalhe" data-detalhe="calculo">
          <summary>Como foi calculado?</summary>
          <div class="ponto-finck__corpo">
            <p class="ponto-finck__rotulo">Entra na conta:</p>
            <ul class="ponto-finck__fatores">${p.fatores.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
            ${htmlCalculo(p.calculo)}
            ${p.nao_considera ? `<p class="ponto-finck__fora">Fica de fora: ${esc(p.nao_considera)}</p>` : ""}
            <p class="ponto-finck__selo">${esc(selo[2])}</p>
          </div>
        </details>
      </li>`;
  }

  function htmlPerguntas(lista) {
    if (!lista.length || !estado.aoEscolher) {
      return "";
    }
    return `
      <div class="analise-finck__perguntas">
        <h5 class="analise-finck__subtitulo">Para melhorar a análise</h5>
        ${lista.map(q => `
          <div class="pergunta-finck" role="group" aria-labelledby="pfTitulo-${esc(q.id)}" aria-describedby="pfAjuda-${esc(q.id)}">
            <p class="pergunta-finck__texto" id="pfTitulo-${esc(q.id)}">${esc(q.pergunta)}</p>
            <p class="pergunta-finck__ajuda" id="pfAjuda-${esc(q.id)}">${esc(q.ajuda)}</p>
            <div class="chips-finck">
              ${q.opcoes.map(o => `<button type="button" class="chip chip-finck" data-campo="${esc(q.campo)}" data-valor="${esc(o.valor)}" aria-pressed="false">${esc(o.rotulo)}</button>`).join("")}
            </div>
          </div>`).join("")}
      </div>`;
  }

  function htmlCenarios(a) {
    const meta = a.meta;
    const n = a.numeros;
    const rotuloAportes = { ritmo: "de aportes reais nas metas (média dos últimos 90 dias)", prazo: "que os prazos das metas pedem", misto: "de aportes e prazos das metas" }[n.base_aportes] || "das metas";
    return `
      <p class="secao-finck__intro">O mesmo preço de três formas, com o efeito ${meta ? `na meta “${esc(meta.nome)}”` : "nas metas"}, no seu mês e no total pago.</p>
      <ul class="cenarios-finck" role="list">
        ${a.cenarios.map(c => `
          <li class="cenario-finck cenario-finck--${esc(c.id)}">
            <h6 class="cenario-finck__titulo">${esc(c.titulo)}</h6>
            <p class="cenario-finck__valor">${esc(c.destaque)}</p>
            <p class="cenario-finck__sub">${esc(c.sub)}</p>
            <dl class="cenario-finck__efeitos">
              <div><dt>Na meta</dt><dd>${esc(c.meta)}</dd></div>
              <div><dt>No mês</dt><dd>${esc(c.mes)}</dd></div>
              <div><dt>Total pago</dt><dd>${esc(c.custo)}</dd></div>
            </dl>
            ${c.nota ? `<p class="cenario-finck__nota">${esc(c.nota)}</p>` : ""}
          </li>`).join("")}
      </ul>
      <details class="ponto-finck__detalhe analise-finck__regra">
        <summary>Como foi calculado?</summary>
        <div class="ponto-finck__corpo">
          <p>É a mesma conta do impacto lá em cima. Cada pagamento usa primeiro a folga fora das metas; só o que passa dela sai do que iria para a meta e vira atraso, pelo ritmo dela. Comprando agora, conta só a folga de hoje. Esperando ${esc(I.PARAMETROS.MESES_ESPERA)} meses, entra a sobra desses meses. Parcelando, cada parcela, com os juros, usa a folga e a sobra dos meses até ela.</p>
          <p>Folga fora das metas hoje: ${esc(U.moeda(n.folga_hoje))} (o saldo acima de um mês de despesas fixas, mais a sobra deste mês fora das metas, sem passar do saldo depois das parcelas).</p>
          <p>Sobra fora das metas: ${esc(U.moeda(n.sobra_livre))} ${n.sobra_livre_com_dia_a_dia ? "(renda menos despesas fixas menos gastos do dia a dia)" : "(renda menos despesas fixas; os gastos do dia a dia não entram)"} menos ${esc(U.moeda(n.aportes_metas))} por mês ${esc(rotuloAportes)} = ${esc(U.moeda(n.sobra_extra))} por mês.</p>
          <p>"No mês" compara o que sai em cada mês (ou o que você separa, se esperar) com a sua sobra após os fixos. O preço é o mesmo nas três formas, e renda e despesas ficam iguais todo mês: é uma simulação, não uma previsão garantida.</p>
        </div>
      </details>`;
  }

  // Redesenha tudo o que depende dos números, sem tocar nas dúvidas já
  // respondidas. Os detalhes que a pessoa abriu continuam abertos.
  function desenharAnalise() {
    const host = estado.host;
    const a = estado.analise;
    const abertos = new Set([ ...host.querySelectorAll("[data-ponto] details[open]") ].map(d => `${d.closest("[data-ponto]").dataset.ponto}:${d.dataset.detalhe}`));
    const caixaCenarios = no("cenarios");
    const regraAberta = Boolean(caixaCenarios && caixaCenarios.querySelector(".analise-finck__regra[open]"));
    const resumo = no("resumo");
    resumo.textContent = a.cabecalho || "";
    resumo.hidden = !a.cabecalho;
    const pontos = no("pontos");
    pontos.innerHTML = a.pontos.map(htmlPonto).join("");
    abertos.forEach(chave => {
      const [ponto, detalhe] = chave.split(":");
      const d = host.querySelector(`[data-ponto="${ponto}"] details[data-detalhe="${detalhe}"]`);
      if (d) {
        d.open = true;
      }
    });
    pontos.hidden = !a.pontos.length;
    no("leitura").innerHTML = `
      <h5 class="analise-finck__subtitulo">O que mais pesa neste cenário</h5>
      <p>${esc(a.leitura.texto)}</p>`;
    no("perguntas").innerHTML = htmlPerguntas(a.perguntas);
    caixaCenarios.innerHTML = htmlCenarios(a);
    const resumoCenarios = no("cenarios-resumo");
    if (resumoCenarios.textContent !== a.resumo_cenarios) {
      resumoCenarios.textContent = a.resumo_cenarios;
    }
    if (regraAberta) {
      caixaCenarios.querySelector(".analise-finck__regra").open = true;
    }
    no("sugestoes").innerHTML = htmlSugestoes(a.sugestoes);
    no("contexto").textContent = I.contexto(a);
    no("demo").hidden = !a.demo;
    marcarTrocasAntigas();
  }

  const htmlSugestoes = lista => lista.map(s => `<button type="button" class="chip chip-finck" data-sugestao="${esc(s.id)}"${s.valor ? ` data-valor="${esc(s.valor)}"` : ""}>${esc(s.rotulo)}</button>`).join("");

  // ----------------------------------------------------------------- dúvidas

  function elementoTroca(t) {
    const art = document.createElement("article");
    art.className = `troca-finck troca-finck--${t.tipo}`;
    art.dataset.troca = String(t.id);
    const pergunta = document.createElement("p");
    pergunta.className = "troca-finck__pergunta";
    const quem = document.createElement("span");
    quem.className = "visualmente-oculto";
    quem.textContent = "Você perguntou: ";
    pergunta.append(quem, t.pergunta);
    const resposta = document.createElement("div");
    resposta.className = "troca-finck__resposta";
    const origem = document.createElement("p");
    origem.className = "troca-finck__origem";
    // A resposta escrita por IA diz isso antes do texto, não no rodapé.
    origem.textContent = { calculo: "Cálculo do FinCK", ia: ROTULO_IA, erro: "Ajuda opcional" }[t.tipo];
    resposta.append(origem);
    if (t.titulo) {
      const titulo = document.createElement("p");
      titulo.className = "troca-finck__titulo";
      titulo.textContent = t.titulo;
      resposta.append(titulo);
    }
    const texto = document.createElement("p");
    texto.className = "troca-finck__texto";
    texto.textContent = t.texto;
    resposta.append(texto);
    if (t.tipo === "calculo") {
      const conta = document.createElement("div");
      conta.innerHTML = htmlCalculo(t.calculo || []);
      const selo = document.createElement("div");
      selo.innerHTML = htmlSelo(t.certeza);
      resposta.append(conta.firstElementChild, selo.firstElementChild);
    }
    if (t.tipo === "erro") {
      const valem = document.createElement("p");
      valem.className = "troca-finck__rodape";
      valem.textContent = `${VALEM} Estas perguntas têm resposta na hora, pelo cálculo do FinCK:`;
      const chips = document.createElement("div");
      chips.className = "chips-finck";
      chips.innerHTML = estado ? htmlSugestoes(estado.analise.sugestoes) : "";
      resposta.append(valem, chips);
    }
    const antiga = document.createElement("p");
    antiga.className = "troca-finck__antiga";
    antiga.textContent = "Feita com os números de antes da última mudança na análise.";
    antiga.hidden = true;
    art.append(pergunta, resposta, antiga);
    return art;
  }

  function desenharHistorico() {
    no("historico").replaceChildren(...memoria.trocas.map(elementoTroca));
    marcarTrocasAntigas();
  }

  function marcarTrocasAntigas() {
    if (!estado) {
      return;
    }
    const atual = I.contexto(estado.analise);
    const historico = no("historico");
    memoria.trocas.forEach(t => {
      const elemento = historico && historico.querySelector(`[data-troca="${t.id}"]`);
      if (elemento) {
        const antiga = t.base !== atual;
        elemento.classList.toggle("troca-finck--desatualizada", antiga);
        elemento.querySelector(".troca-finck__antiga").hidden = !antiga;
      }
    });
  }

  function adicionarTroca(dados) {
    const t = { id: proximaTroca++, base: I.contexto(estado.analise), ...dados };
    memoria.trocas.unshift(t);
    const sobra = memoria.trocas.splice(MAX_TROCAS);
    const historico = no("historico");
    sobra.forEach(v => historico.querySelector(`[data-troca="${v.id}"]`)?.remove());
    const elemento = elementoTroca(t);
    historico.prepend(elemento);
    elemento.scrollIntoView({ block: "nearest", behavior: movimentoLiberado() ? "smooth" : "auto" });
  }

  function sugerir(id, valor) {
    if (!estado) {
      return;
    }
    const s = estado.analise.sugestoes.find(x => x.id === id);
    const r = I.responder(estado.analise, id, { valor: Number(valor) || null });
    if (!s || !r) {
      return;
    }
    adicionarTroca({ tipo: "calculo", pergunta: s.rotulo, ...r });
  }

  function mostrarEtapas(atual) {
    const lista = no("etapas");
    const etapas = [ "Enviando a pergunta e os números desta análise…", "Esperando a resposta…" ];
    if (atual === null) {
      lista.hidden = true;
      lista.innerHTML = "";
      return;
    }
    lista.hidden = false;
    lista.innerHTML = etapas.map((t, i) => `<li data-estado="${i < atual ? "feita" : i === atual ? "atual" : "proxima"}">${i < atual ? '<span class="visualmente-oculto">Feito: </span>' : ""}${esc(t)}</li>`).join("");
    no("status").textContent = etapas[atual];
  }

  // Fora do ar, a pergunta livre some e fica só o aviso: nada de campo
  // desabilitado. Se o foco estava no campo, ele passa para o aviso.
  function aplicarDisponibilidade() {
    if (!estado) {
      return;
    }
    const fora = Boolean(iaDisponivel && iaDisponivel.ok === false);
    const aviso = no("indisponivel");
    const campos = no("campos");
    const focoNosCampos = Boolean(campos && campos.contains(document.activeElement));
    aviso.hidden = !fora;
    aviso.textContent = fora ? `${MSG.indisponivel} ${VALEM}` : "";
    campos.hidden = fora;
    if (fora && focoNosCampos) {
      aviso.focus({ preventScroll: true });
    }
    no("enviar").setAttribute("aria-disabled", String(Boolean(pedido)));
  }

  // Pergunta sem custo (GET não gasta cota), feita só quando a pessoa abre a
  // pergunta livre, para saber se a ajuda opcional existe neste endereço.
  function verificarIA() {
    if (iaDisponivel !== null || verificando || !window.fetch) {
      return;
    }
    verificando = true;
    const ctrl = window.AbortController ? new AbortController() : null;
    const alarme = setTimeout(() => ctrl && ctrl.abort(), 6000);
    fetch(ENDPOINT_IA, { method: "GET", cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(async r => {
        if (r.status === 404) {
          return { ok: false };
        }
        const j = await r.json().catch(() => null);
        return j && j.ia === false ? { ok: false } : { ok: true };
      })
      .catch(() => null)
      .then(v => {
        clearTimeout(alarme);
        verificando = false;
        iaDisponivel = v;
        aplicarDisponibilidade();
      });
  }

  function cancelarPedido() {
    if (pedido) {
      const p = pedido;
      pedido = null;
      etapaDoPedido = null;
      try {
        p.abort();
      } catch {}
    }
  }

  // A mensagem do servidor não vai para a tela: cada situação tem a sua
  // frase, sem nome de serviço nem código.
  function motivoDaFalha(status, dados) {
    if (status === 400 && dados && typeof dados.erro === "string" && dados.erro.length < 160) {
      return dados.erro;
    }
    if (status === 404 || status === 500 || status === 503) {
      return MSG.indisponivel;
    }
    if (status === 429) {
      return MSG.limite;
    }
    if (status === 504) {
      return MSG.demorou;
    }
    return MSG.falhou;
  }

  function enviarPergunta(e) {
    e.preventDefault();
    if (!estado || pedido) {
      return;
    }
    const campo = no("pergunta");
    const pergunta = campo.value.trim().slice(0, MAX_PERGUNTA);
    if (iaDisponivel && iaDisponivel.ok === false) {
      return;
    }
    if (!pergunta) {
      U.erroCampo(campo, "Escreva a sua pergunta sobre esta compra.");
      return;
    }
    // Os números que vão junto ficam guardados com a pergunta: se a análise
    // mudar durante a espera, a resposta é marcada como feita com os antigos.
    const base = I.contexto(estado.analise);
    const corpo = JSON.stringify({ pergunta: pergunta, contexto: base });
    no("form").setAttribute("aria-busy", "true");
    // XMLHttpRequest e não fetch: o evento de envio concluído é o que marca,
    // de verdade, a passagem de "enviando" para "esperando".
    const xhr = new XMLHttpRequest();
    pedido = xhr;
    etapaDoPedido = 0;
    mostrarEtapas(0);
    no("enviar").setAttribute("aria-disabled", "true");
    // O bloco pode ter sido redesenhado enquanto a resposta não chegava:
    // tudo é procurado de novo.
    const terminar = () => {
      if (pedido !== xhr || !estado) {
        return false;
      }
      pedido = null;
      etapaDoPedido = null;
      no("form").removeAttribute("aria-busy");
      mostrarEtapas(null);
      no("status").textContent = "";
      aplicarDisponibilidade();
      return true;
    };
    const falhar = motivo => {
      if (!terminar()) {
        return;
      }
      adicionarTroca({ tipo: "erro", pergunta: pergunta, texto: motivo, base: base });
    };
    xhr.open("POST", ENDPOINT_IA);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.timeout = 65000;
    xhr.upload.onload = () => {
      if (pedido === xhr && estado) {
        etapaDoPedido = 1;
        mostrarEtapas(1);
      }
    };
    xhr.onload = () => {
      let dados = null;
      try {
        dados = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && dados && typeof dados.resposta === "string" && dados.resposta.trim()) {
        if (!terminar()) {
          return;
        }
        no("pergunta").value = "";
        atualizarConta();
        adicionarTroca({ tipo: "ia", pergunta: pergunta, texto: dados.resposta.trim(), base: base });
        return;
      }
      if (xhr.status === 404) {
        iaDisponivel = { ok: false };
      }
      falhar(motivoDaFalha(xhr.status, dados));
    };
    xhr.onerror = () => falhar(MSG.conexao);
    xhr.ontimeout = () => falhar(MSG.demorou);
    xhr.send(corpo);
  }

  function atualizarConta() {
    if (!estado) {
      return;
    }
    const campo = no("pergunta");
    no("conta").textContent = `${campo.value.length} de ${MAX_PERGUNTA} caracteres`;
    memoria.rascunho = campo.value;
  }

  // ------------------------------------------------------- respostas da pessoa

  function anunciar(texto) {
    if (estado) {
      no("status").textContent = texto;
    }
  }
  function focarStatus() {
    const status = estado && no("status");
    if (status && status.textContent) {
      status.focus({ preventScroll: true });
      // Um ponto novo acima pode empurrar a mensagem para trás da navegação
      // de baixo: rola só o necessário para ela ficar à vista. Fica para o
      // próximo quadro porque o Reality ainda devolve o bloco à posição de antes.
      requestAnimationFrame(() => status.scrollIntoView({ block: "nearest", behavior: movimentoLiberado() ? "smooth" : "auto" }));
    }
  }

  function escolher(botao) {
    if (!estado || !estado.aoEscolher) {
      return;
    }
    const campo = botao.dataset.campo;
    const grupo = botao.closest(".pergunta-finck");
    grupo.querySelectorAll("button").forEach(b => {
      b.disabled = true;
      b.setAttribute("aria-pressed", String(b === botao));
    });
    if (campo === "forma") {
      const valor = botao.dataset.valor === "avista" ? "avista" : "parcelado";
      memoria.forma = valor;
      estado.formaConfirmada = true;
      anunciar(`Forma de pagamento: ${valor === "avista" ? "à vista" : "parcelado"}. A simulação dos próximos meses foi refeita com ela.`);
      try {
        estado.aoEscolher({ campo: "forma", valor: valor });
      } catch (err) {
        console.error(err);
      }
      if (estado) {
        estado.analise = analisarAgora();
        desenharAnalise();
        focarStatus();
      }
      return;
    }
    if (campo === "expected_months") {
      const valor = Number(botao.dataset.valor) || null;
      const anterior = estado;
      estado.pendente = { campo: campo, valor: valor };
      anunciar(`Refazendo a análise com ${valor} meses de uso…`);
      try {
        estado.aoEscolher({ campo: "expected_months", valor: valor });
      } catch (err) {
        console.error(err);
      }
      // Se o Reality não refizer a conta, a pergunta volta a funcionar e a
      // pessoa fica sabendo onde informar o dado.
      setTimeout(() => {
        if (estado === anterior && estado.pendente) {
          estado.pendente = null;
          grupo.querySelectorAll("button").forEach(b => {
            b.disabled = false;
            b.setAttribute("aria-pressed", "false");
          });
          anunciar("Não deu para refazer a análise agora. Você também pode informar a vida útil em “Quer deixar a análise mais precisa?”.");
        }
      }, 5000);
    }
  }

  // ----------------------------------------------------------------- eventos

  function ligar(raiz) {
    if (!raizesLigadas.has(raiz)) {
      raizesLigadas.add(raiz);
      raiz.addEventListener("click", e => {
        const escolha = e.target.closest("[data-campo]");
        if (escolha && raiz.contains(escolha) && !escolha.disabled) {
          escolher(escolha);
          return;
        }
        const sugestao = e.target.closest("[data-sugestao]");
        if (sugestao && raiz.contains(sugestao)) {
          sugerir(sugestao.dataset.sugestao, sugestao.dataset.valor);
        }
      });
      raiz.addEventListener("submit", e => {
        if (e.target.matches('[data-af="form"]')) {
          enviarPergunta(e);
        }
      });
      raiz.addEventListener("input", e => {
        if (e.target.matches('[data-af="pergunta"]')) {
          atualizarConta();
        }
      });
      raiz.addEventListener("toggle", e => {
        if (!estado || !raizes().includes(raiz)) {
          return;
        }
        if (e.target.matches('[data-af="duvida-caixa"]')) {
          memoria.duvidaAberta = e.target.open;
        }
        if (e.target.matches('[data-af="livre"]')) {
          memoria.livreAberta = e.target.open;
          if (e.target.open) {
            verificarIA();
          }
        }
      }, true);
    }
    if (!ligadoNoDocumento) {
      ligadoNoDocumento = true;
      // Mexer na forma de pagamento da linha do tempo é responder a pergunta.
      document.addEventListener("change", e => {
        const t = e.target;
        if (!estado || !t || t.name !== "ltForma" || !e.isTrusted) {
          return;
        }
        memoria.forma = t.value === "avista" ? "avista" : "parcelado";
        estado.formaConfirmada = true;
        estado.analise = analisarAgora();
        no("perguntas").innerHTML = htmlPerguntas(estado.analise.perguntas);
      });
    }
  }

  // ------------------------------------------------------------------ entrada

  // Chamado pelo Reality a cada análise.
  function mostrar({ ctx = {}, entrada = {}, resultado = null, linhaTempo = null, host = null, hosts = null, aoEscolher = null } = {}) {
    const alvo = host || document.getElementById("analiseFinck");
    if (!alvo || !I || !resultado) {
      return;
    }
    const comparar = hosts && hosts.comparar && hosts.comparar !== alvo ? hosts.comparar : null;
    const duvida = hosts && hosts.duvida && hosts.duvida !== alvo ? hosts.duvida : null;
    const chave = chaveDe(entrada || {});
    const mesmoItem = memoria.chave === chave;
    const pendente = estado && estado.pendente;
    const focoDentro = [ alvo, comparar, duvida ].some(r => r && r.contains(document.activeElement)) || document.activeElement === document.body;
    if (!mesmoItem) {
      cancelarPedido();
      memoria = novaMemoria(chave);
    } else if (estado) {
      const campo = no("pergunta");
      if (campo) {
        memoria.rascunho = campo.value;
      }
    }
    // Um lugar que deixou de ser usado não fica com a tela antiga.
    const antigos = raizes().filter(r => r !== alvo && r !== comparar && r !== duvida);
    const formaAtual = linhaTempo && linhaTempo.entrada ? linhaTempo.entrada.forma : null;
    estado = {
      ctx: ctx || {},
      entrada: entrada || {},
      resultado: resultado,
      linhaTempo: linhaTempo,
      host: alvo,
      comparar: comparar,
      duvida: duvida,
      aoEscolher: typeof aoEscolher === "function" ? aoEscolher : null,
      formaConfirmada: Boolean(memoria.forma),
      pendente: null,
      analise: null
    };
    antigos.forEach(r => {
      r.innerHTML = "";
    });
    estado.analise = analisarAgora();
    // O mesmo item nos mesmos lugares não refaz os esqueletos: a linha de
    // estado, as dúvidas e o que a pessoa abriu continuam os mesmos nós, e a
    // mensagem final cai numa região viva que já existia.
    const temEsqueleto = (raiz, nome) => Boolean(raiz.querySelector(`[data-af="${nome}"]`));
    const reaproveita = mesmoItem && temEsqueleto(alvo, "pontos") && temEsqueleto(comparar || alvo, "cenarios") && temEsqueleto(duvida || alvo, "historico");
    if (!reaproveita) {
      alvo.innerHTML = htmlPrincipal() + (comparar ? "" : htmlComparar()) + (duvida ? "" : htmlDuvida());
      if (comparar) {
        comparar.innerHTML = htmlComparar();
      }
      if (duvida) {
        duvida.innerHTML = htmlDuvida();
      }
    }
    alvo.hidden = false;
    alvo.classList.add("analise-finck");
    [ comparar, duvida ].forEach(r => {
      if (r) {
        r.hidden = false;
      }
    });
    // A entrada em cascata só na primeira vez do item; ao refazer a conta, o
    // bloco não "pisca" de novo.
    if (!mesmoItem) {
      alvo.classList.add("analise-finck--entrando");
      clearTimeout(relogioEntrada);
      relogioEntrada = setTimeout(() => alvo.classList.remove("analise-finck--entrando"), 1200);
    }
    raizes().forEach(ligar);
    desenharAnalise();
    if (!reaproveita) {
      desenharHistorico();
      no("duvida-caixa").open = memoria.duvidaAberta;
      no("livre").open = memoria.livreAberta;
      no("pergunta").value = memoria.rascunho || "";
    }
    atualizarConta();
    aplicarDisponibilidade();
    if (pedido && etapaDoPedido !== null) {
      no("form").setAttribute("aria-busy", "true");
      mostrarEtapas(etapaDoPedido);
    }
    if (pendente && pendente.campo === "expected_months") {
      anunciar(`Análise refeita com ${pendente.valor} meses de uso.`);
      if (focoDentro) {
        focarStatus();
      }
    }
    // Nova conta do mesmo item volta a linha do tempo ao padrão; a forma que
    // a pessoa já escolheu é devolvida a ela, sem perguntar de novo.
    if (mesmoItem && memoria.forma && formaAtual && formaAtual !== memoria.forma && estado.aoEscolher) {
      const forma = memoria.forma;
      setTimeout(() => {
        if (estado && estado.host === alvo && memoria.forma === forma) {
          try {
            estado.aoEscolher({ campo: "forma", valor: forma });
          } catch (err) {
            console.error(err);
          }
        }
      }, 0);
    }
  }

  // Chamado quando a linha do tempo muda (forma de pagamento, parcelas).
  function atualizar({ linhaTempo = null } = {}) {
    if (!estado || !estado.host || !estado.host.isConnected) {
      return;
    }
    if (linhaTempo) {
      estado.linhaTempo = linhaTempo;
    }
    estado.analise = analisarAgora();
    desenharAnalise();
  }

  function limpar() {
    cancelarPedido();
    const lugares = estado ? raizes() : [ "analiseFinck", "compararFormas", "duvidaCalculo" ].map(id => document.getElementById(id)).filter(Boolean);
    const host = estado ? estado.host : document.getElementById("analiseFinck");
    lugares.forEach(r => {
      r.innerHTML = "";
    });
    if (host) {
      host.hidden = true;
    }
    estado = null;
    memoria = novaMemoria(null);
  }

  // Abre "Tirar uma dúvida sobre o cálculo" e a pergunta livre, com a
  // pergunta já escrita, sem enviar: a pessoa lê o que vai junto e decide.
  // Também abre o que estiver em volta (o "Se quiser aprofundar").
  function perguntar(texto) {
    if (!estado || !estado.host || !estado.host.isConnected) {
      return false;
    }
    const caixa = no("duvida-caixa");
    const livre = no("livre");
    const campo = no("pergunta");
    if (!caixa || !livre || !campo) {
      return false;
    }
    abrirEmVolta(caixa);
    caixa.open = true;
    livre.open = true;
    memoria.duvidaAberta = true;
    memoria.livreAberta = true;
    const fora = Boolean(iaDisponivel && iaDisponivel.ok === false);
    const alvo = fora ? no("indisponivel") : campo;
    if (!fora && !campo.value.trim()) {
      campo.value = String(texto || "").slice(0, MAX_PERGUNTA);
      atualizarConta();
    }
    alvo.focus({ preventScroll: true });
    alvo.scrollIntoView({ block: "center", behavior: movimentoLiberado() ? "smooth" : "auto" });
    return true;
  }

  return { mostrar: mostrar, atualizar: atualizar, limpar: limpar, perguntar: perguntar, analiseAtual: () => estado ? estado.analise : null };
})();
