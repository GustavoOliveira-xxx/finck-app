// Tela da Análise FinCK, dentro do resultado do FinCK of Reality.
// Os números e os textos vêm do motor (js/inteligencia-engine.js); aqui se
// desenha o bloco, se repassa ao Reality o que a pessoa respondeu e, só
// quando ela escreve uma pergunta, se fala com a FINCK AI.
window.FinckInteligenciaUI = (() => {
  const I = window.FinckInteligencia;
  const U = window.FinckUtils;
  const esc = s => U ? U.escapeHTML(s) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ENDPOINT_IA = "/api/ia";
  const MAX_PERGUNTA = 600;
  const MAX_TROCAS = 3;
  const SELO = {
    confirmado: [ "confirmado", "Dado confirmado" ],
    estimativa: [ "estimativa", "Estimativa" ]
  };

  // estado: a análise que está na tela. memoria: o que a pessoa fez com ela
  // (conversa, forma de pagamento escolhida), mantido enquanto o item for o
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
  const hostsLigados = new WeakSet();

  function novaMemoria(chave) {
    return { chave: chave, trocas: [], conversaAberta: false, forma: null, rascunho: "" };
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
  const el = (host, nome) => host.querySelector(`[data-af="${nome}"]`);

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

  // --------------------------------------------------------------- esqueleto

  function esqueleto() {
    return `
      <div class="analise-finck__cabecalho">
        <h4 id="tituloAnaliseFinck" class="analise-finck__titulo"><span class="analise-finck__marca" aria-hidden="true">✦</span> Análise FinCK</h4>
        <p class="analise-finck__resumo" data-af="resumo"></p>
        <p class="analise-finck__origem">Feita pelo FinCK com os seus dados e regras que você pode conferir, sem IA. A FINCK AI só entra se você escrever uma pergunta na conversa, no fim deste bloco.</p>
      </div>
      <ol class="analise-finck__pontos" role="list" data-af="pontos"></ol>
      <p class="analise-finck__legenda" data-af="legenda"><span class="selo-certeza selo-certeza--confirmado">Dado confirmado</span> vem do que você registrou no FinCK. <span class="selo-certeza selo-certeza--estimativa">Estimativa</span> depende de uma suposição, como o ritmo de aportes ou a vida útil.</p>
      <div class="analise-finck__leitura" data-af="leitura"></div>
      <div data-af="perguntas"></div>
      <p class="analise-finck__status" data-af="status" role="status" aria-live="polite" tabindex="-1"></p>
      <details class="analise-finck__cenarios" data-af="cenarios-caixa">
        <summary>
          <span class="analise-finck__subtopo">
            <span class="analise-finck__subtitulo" id="tituloCenariosFinck">E se...?</span>
            <span class="selo-certeza selo-certeza--simulacao">Simulação</span>
          </span>
          <small class="analise-finck__cenarios-resumo" data-af="cenarios-resumo"></small>
        </summary>
        <div data-af="cenarios"></div>
      </details>
      <details class="analise-finck__conversa" data-af="conversa">
        <summary>
          <h5 class="analise-finck__conversa-titulo"><span aria-hidden="true">✦</span> Converse sobre esta compra</h5>
          <small>Perguntas prontas com a conta na hora, ou uma pergunta sua para a FINCK AI.</small>
        </summary>
        <div class="conversa-finck">
          <p class="conversa-finck__intro">Pergunte sobre esta análise. As sugestões são respondidas na hora pelo cálculo do FinCK, sem IA.</p>
          <div class="chips-finck" role="group" aria-label="Sugestões de pergunta" data-af="sugestoes"></div>
          <div class="conversa-finck__historico" data-af="historico" aria-live="polite" aria-relevant="additions"></div>
          <form class="conversa-finck__form" data-af="form" novalidate>
            <label class="conversa-finck__rotulo" for="perguntaFinck">Ou escreva a sua pergunta para a FINCK AI</label>
            <textarea id="perguntaFinck" name="pergunta" rows="3" maxlength="${MAX_PERGUNTA}" aria-describedby="perguntaFinckConta avisoEnvioFinck"></textarea>
            <p class="conversa-finck__conta" id="perguntaFinckConta" data-af="conta">0 de ${MAX_PERGUNTA} caracteres</p>
            <div class="aviso-envio-finck" id="avisoEnvioFinck">
              <p><strong>O que vai para a FINCK AI:</strong> a sua pergunta, a categoria da compra e os números desta análise (renda, despesas fixas, saldo, horas, percentuais, prazos estimados e a simulação dos próximos meses). Não vão o nome do item nem nomes de metas, contas ou lançamentos.<span data-af="demo" hidden> Na demonstração, esses números são dados de exemplo e a pergunta é enviada do mesmo jeito.</span></p>
              <p><strong>Não envie senhas, dados bancários, documentos ou informações de outras pessoas.</strong></p>
              <p>As respostas ficam só nesta tela (as ${MAX_TROCAS} últimas) e somem quando você começa outra análise.</p>
              <details class="aviso-envio-finck__ver">
                <summary>Ver os números que vão junto</summary>
                <pre data-af="contexto"></pre>
              </details>
            </div>
            <p class="conversa-finck__indisponivel" data-af="indisponivel" hidden></p>
            <button type="submit" class="btn-secundario conversa-finck__enviar" data-af="enviar">Perguntar à FINCK AI</button>
            <ol class="etapas-finck" data-af="etapas" hidden></ol>
          </form>
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

  function htmlPonto(p) {
    return `
      <li class="ponto-finck ponto-finck--${esc(p.id)}" data-ponto="${esc(p.id)}">
        <div class="ponto-finck__topo">
          <span class="ponto-finck__num" aria-hidden="true">${esc(p.numero)}</span>
          <h5 class="ponto-finck__titulo">${esc(p.titulo)}</h5>
          ${htmlSelo(p.certeza)}
        </div>
        <p class="ponto-finck__texto">${esc(p.texto)}</p>
        <div class="ponto-finck__explica">
          <details class="ponto-finck__detalhe" data-detalhe="porque">
            <summary>Por que o FinCK diz isso?</summary>
            <div class="ponto-finck__corpo">
              <p>Consideramos:</p>
              <ul class="ponto-finck__fatores">${p.fatores.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
              ${p.nao_considera ? `<p class="ponto-finck__fora">Fica de fora da conta: ${esc(p.nao_considera)}</p>` : ""}
              <p>Por isso chegamos a essa conclusão.</p>
            </div>
          </details>
          <details class="ponto-finck__detalhe" data-detalhe="como">
            <summary>Como chegamos nisso?</summary>
            <div class="ponto-finck__corpo">${htmlCalculo(p.calculo)}</div>
          </details>
        </div>
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
      <p class="analise-finck__intro">O mesmo preço em três momentos, com o efeito ${meta ? `na meta “${esc(meta.nome)}”` : "nas metas"}, no seu mês e no total pago.</p>
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
        <summary>Como os cenários são calculados</summary>
        <div class="ponto-finck__corpo">
          <p>É a mesma conta da revelação lá em cima. Cada pagamento usa primeiro a folga fora das metas; só o que passa dela sai do que iria para a meta e vira atraso, pelo ritmo dela. Agora, conta só a folga de hoje. Esperando ${esc(I.PARAMETROS.MESES_ESPERA)} meses, entra a sobra desses meses. Parcelando, cada parcela, com os juros, usa a folga e a sobra dos meses até ela.</p>
          <p>Folga fora das metas hoje: ${esc(U.moeda(n.folga_hoje))} (o saldo acima de um mês de despesas fixas, mais a sobra deste mês fora das metas, sem passar do saldo depois das parcelas).</p>
          <p>Sobra fora das metas: ${esc(U.moeda(n.sobra_livre))} ${n.sobra_livre_com_dia_a_dia ? "(renda menos despesas fixas menos gastos do dia a dia)" : "(renda menos despesas fixas; os gastos do dia a dia não entram)"} menos ${esc(U.moeda(n.aportes_metas))} por mês ${esc(rotuloAportes)} = ${esc(U.moeda(n.sobra_extra))} por mês.</p>
          <p>"No mês" compara o que sai em cada mês (ou o que você separa, no cenário de esperar) com a sua sobra após os fixos. O preço é o mesmo nos três casos, e renda e despesas ficam iguais todo mês: é uma simulação, não uma previsão garantida.</p>
        </div>
      </details>`;
  }

  // Redesenha tudo o que depende dos números, sem tocar na conversa. Os
  // detalhes que a pessoa abriu continuam abertos.
  function desenharAnalise() {
    const host = estado.host;
    const a = estado.analise;
    const abertos = new Set([ ...host.querySelectorAll("[data-ponto] details[open]") ].map(d => `${d.closest("[data-ponto]").dataset.ponto}:${d.dataset.detalhe}`));
    const regraAberta = Boolean(host.querySelector(".analise-finck__regra[open]"));
    el(host, "resumo").textContent = a.cabecalho;
    el(host, "pontos").innerHTML = a.pontos.map(htmlPonto).join("");
    abertos.forEach(chave => {
      const [ponto, detalhe] = chave.split(":");
      const d = host.querySelector(`[data-ponto="${ponto}"] details[data-detalhe="${detalhe}"]`);
      if (d) {
        d.open = true;
      }
    });
    el(host, "pontos").hidden = !a.pontos.length;
    el(host, "legenda").hidden = !a.pontos.length;
    el(host, "leitura").innerHTML = `
      <h5 class="analise-finck__subtitulo"><span aria-hidden="true">✦</span> Nossa leitura</h5>
      <p>${esc(a.leitura.texto)}</p>`;
    el(host, "perguntas").innerHTML = htmlPerguntas(a.perguntas);
    el(host, "cenarios").innerHTML = htmlCenarios(a);
    const resumoCenarios = el(host, "cenarios-resumo");
    if (resumoCenarios.textContent !== a.resumo_cenarios) {
      resumoCenarios.textContent = a.resumo_cenarios;
    }
    if (regraAberta) {
      host.querySelector(".analise-finck__regra").open = true;
    }
    el(host, "sugestoes").innerHTML = htmlSugestoes(a.sugestoes);
    el(host, "contexto").textContent = I.contexto(a);
    el(host, "demo").hidden = !a.demo;
    marcarTrocasAntigas();
  }

  const htmlSugestoes = lista => lista.map(s => `<button type="button" class="chip chip-finck" data-sugestao="${esc(s.id)}"${s.valor ? ` data-valor="${esc(s.valor)}"` : ""}>${esc(s.rotulo)}</button>`).join("");

  // --------------------------------------------------------------- conversa

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
    origem.textContent = { calculo: "Cálculo do FinCK", ia: "✦ FINCK AI", erro: "FINCK AI indisponível agora" }[t.tipo];
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
    if (t.tipo === "ia") {
      const rodape = document.createElement("p");
      rodape.className = "troca-finck__rodape";
      // A frase de autonomia já vem no fim da resposta (api/ia.js).
      rodape.textContent = "Resposta escrita pela FINCK AI a partir dos números desta análise.";
      resposta.append(rodape);
      if (t.modelo || t.tempo_ms) {
        const tecnico = document.createElement("p");
        tecnico.className = "troca-finck__tecnico";
        tecnico.textContent = [ t.modelo ? `Modelo: ${t.modelo}` : "", t.tempo_ms ? `${U.numero(t.tempo_ms / 1000, 1)} s` : "" ].filter(Boolean).join(" · ");
        resposta.append(tecnico);
      }
    }
    if (t.tipo === "erro") {
      const valem = document.createElement("p");
      valem.className = "troca-finck__rodape";
      valem.textContent = "Os números acima continuam valendo. Estas perguntas têm resposta na hora, pelo cálculo do FinCK:";
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
    const historico = el(estado.host, "historico");
    historico.replaceChildren(...memoria.trocas.map(elementoTroca));
    marcarTrocasAntigas();
  }

  function marcarTrocasAntigas() {
    if (!estado) {
      return;
    }
    const atual = I.contexto(estado.analise);
    memoria.trocas.forEach(t => {
      const no = estado.host.querySelector(`[data-troca="${t.id}"]`);
      if (no) {
        const antiga = t.base !== atual;
        no.classList.toggle("troca-finck--desatualizada", antiga);
        no.querySelector(".troca-finck__antiga").hidden = !antiga;
      }
    });
  }

  function adicionarTroca(dados) {
    const t = { id: proximaTroca++, base: I.contexto(estado.analise), ...dados };
    memoria.trocas.unshift(t);
    const sobra = memoria.trocas.splice(MAX_TROCAS);
    const historico = el(estado.host, "historico");
    sobra.forEach(v => historico.querySelector(`[data-troca="${v.id}"]`)?.remove());
    const no = elementoTroca(t);
    historico.prepend(no);
    no.scrollIntoView({ block: "nearest", behavior: movimentoLiberado() ? "smooth" : "auto" });
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
    const lista = el(estado.host, "etapas");
    const etapas = [ "Enviando os números desta análise…", "Esperando a FINCK AI…" ];
    if (atual === null) {
      lista.hidden = true;
      lista.innerHTML = "";
      return;
    }
    lista.hidden = false;
    lista.innerHTML = etapas.map((t, i) => `<li data-estado="${i < atual ? "feita" : i === atual ? "atual" : "proxima"}">${i < atual ? '<span class="visualmente-oculto">Feito: </span>' : ""}${esc(t)}</li>`).join("");
    el(estado.host, "status").textContent = etapas[atual];
  }

  function aplicarDisponibilidade() {
    if (!estado) {
      return;
    }
    const host = estado.host;
    const fora = iaDisponivel && iaDisponivel.ok === false;
    const aviso = el(host, "indisponivel");
    aviso.hidden = !fora;
    aviso.textContent = fora ? `${iaDisponivel.motivo} Os números acima continuam valendo, e as sugestões acima respondem na hora.` : "";
    host.querySelector("#perguntaFinck").disabled = Boolean(fora);
    el(host, "enviar").setAttribute("aria-disabled", String(Boolean(fora || pedido)));
  }

  // Pergunta sem custo (GET não gasta cota) para saber, antes de a pessoa
  // escrever, se a FINCK AI existe neste endereço.
  // As mesmas frases do Assistente quando a FINCK AI não responde neste
  // endereço (rota ausente) ou está desligada no servidor.
  const INDISPONIVEL = "A FINCK AI não está disponível neste endereço.";
  const DESLIGADA = "A FINCK AI está desligada neste servidor agora.";
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
          return { ok: false, motivo: INDISPONIVEL };
        }
        const j = await r.json().catch(() => null);
        return j && j.ia === false ? { ok: false, motivo: DESLIGADA } : { ok: true };
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

  function enviarPergunta(e) {
    e.preventDefault();
    if (!estado || pedido) {
      return;
    }
    const host = estado.host;
    const campo = host.querySelector("#perguntaFinck");
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
    el(host, "form").setAttribute("aria-busy", "true");
    // XMLHttpRequest e não fetch: o evento de envio concluído é o que marca,
    // de verdade, a passagem de "enviando" para "esperando".
    const xhr = new XMLHttpRequest();
    pedido = xhr;
    etapaDoPedido = 0;
    mostrarEtapas(0);
    el(host, "enviar").setAttribute("aria-disabled", "true");
    // O bloco pode ter sido redesenhado enquanto a resposta não chegava:
    // tudo é procurado de novo no host atual.
    const terminar = () => {
      if (pedido !== xhr || !estado) {
        return false;
      }
      pedido = null;
      etapaDoPedido = null;
      el(estado.host, "form").removeAttribute("aria-busy");
      mostrarEtapas(null);
      el(estado.host, "status").textContent = "";
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
      if (xhr.status === 404) {
        iaDisponivel = { ok: false, motivo: INDISPONIVEL };
        falhar(INDISPONIVEL);
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && dados && typeof dados.resposta === "string" && dados.resposta.trim()) {
        if (!terminar()) {
          return;
        }
        estado.host.querySelector("#perguntaFinck").value = "";
        atualizarConta();
        adicionarTroca({ tipo: "ia", pergunta: pergunta, texto: dados.resposta.trim(), modelo: dados.modelo ? String(dados.modelo) : "", tempo_ms: Number(dados.tempo_ms) || 0, base: base });
        return;
      }
      falhar(dados && dados.erro ? String(dados.erro) : "A FINCK AI não respondeu agora. Tente de novo em instantes.");
    };
    xhr.onerror = () => falhar("A FINCK AI não respondeu agora. Confira a sua conexão e tente de novo.");
    xhr.ontimeout = () => falhar("A FINCK AI demorou demais para responder. Tente de novo em instantes.");
    xhr.send(corpo);
  }

  function atualizarConta() {
    if (!estado) {
      return;
    }
    const campo = estado.host.querySelector("#perguntaFinck");
    el(estado.host, "conta").textContent = `${campo.value.length} de ${MAX_PERGUNTA} caracteres`;
    memoria.rascunho = campo.value;
  }

  // ------------------------------------------------------- respostas da pessoa

  function anunciar(texto) {
    if (estado) {
      el(estado.host, "status").textContent = texto;
    }
  }
  function focarStatus() {
    const status = estado && el(estado.host, "status");
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

  function ligar(host) {
    if (!hostsLigados.has(host)) {
      hostsLigados.add(host);
      host.addEventListener("click", e => {
        const escolha = e.target.closest("[data-campo]");
        if (escolha && host.contains(escolha) && !escolha.disabled) {
          escolher(escolha);
          return;
        }
        const sugestao = e.target.closest("[data-sugestao]");
        if (sugestao && host.contains(sugestao)) {
          sugerir(sugestao.dataset.sugestao, sugestao.dataset.valor);
        }
      });
      host.addEventListener("submit", e => {
        if (e.target.matches('[data-af="form"]')) {
          enviarPergunta(e);
        }
      });
      host.addEventListener("input", e => {
        if (e.target.id === "perguntaFinck") {
          atualizarConta();
        }
      });
      host.addEventListener("toggle", e => {
        if (e.target.matches('[data-af="conversa"]')) {
          memoria.conversaAberta = e.target.open;
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
        el(estado.host, "perguntas").innerHTML = htmlPerguntas(estado.analise.perguntas);
      });
    }
  }

  // ------------------------------------------------------------------ entrada

  // Chamado pelo Reality a cada análise.
  function mostrar({ ctx = {}, entrada = {}, resultado = null, linhaTempo = null, host = null, aoEscolher = null } = {}) {
    const alvo = host || document.getElementById("analiseFinck");
    if (!alvo || !I || !resultado) {
      return;
    }
    const chave = chaveDe(entrada || {});
    const mesmoItem = memoria.chave === chave;
    const pendente = estado && estado.pendente;
    const focoDentro = alvo.contains(document.activeElement) || document.activeElement === document.body;
    if (!mesmoItem) {
      cancelarPedido();
      memoria = novaMemoria(chave);
    } else if (estado && estado.host === alvo) {
      const campo = alvo.querySelector("#perguntaFinck");
      if (campo) {
        memoria.rascunho = campo.value;
      }
    }
    const formaAtual = linhaTempo && linhaTempo.entrada ? linhaTempo.entrada.forma : null;
    estado = {
      ctx: ctx || {},
      entrada: entrada || {},
      resultado: resultado,
      linhaTempo: linhaTempo,
      host: alvo,
      aoEscolher: typeof aoEscolher === "function" ? aoEscolher : null,
      formaConfirmada: Boolean(memoria.forma),
      pendente: null,
      analise: null
    };
    estado.analise = analisarAgora();
    // O mesmo item no mesmo bloco não refaz o esqueleto: a linha de estado,
    // a conversa e o que a pessoa abriu continuam os mesmos nós, e a
    // mensagem final cai numa região viva que já existia.
    const reaproveita = mesmoItem && Boolean(el(alvo, "pontos"));
    if (!reaproveita) {
      alvo.innerHTML = esqueleto();
    }
    alvo.hidden = false;
    alvo.classList.add("analise-finck");
    // A entrada em cascata só na primeira vez do item; ao refazer a conta, o
    // bloco não "pisca" de novo.
    if (!mesmoItem) {
      alvo.classList.add("analise-finck--entrando");
      clearTimeout(relogioEntrada);
      relogioEntrada = setTimeout(() => alvo.classList.remove("analise-finck--entrando"), 1200);
    }
    ligar(alvo);
    desenharAnalise();
    if (!reaproveita) {
      desenharHistorico();
      const conversa = el(alvo, "conversa");
      conversa.open = memoria.conversaAberta;
      const campo = alvo.querySelector("#perguntaFinck");
      campo.value = memoria.rascunho || "";
    }
    atualizarConta();
    aplicarDisponibilidade();
    if (pedido && etapaDoPedido !== null) {
      el(alvo, "form").setAttribute("aria-busy", "true");
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
    const host = estado ? estado.host : document.getElementById("analiseFinck");
    if (host) {
      host.innerHTML = "";
      host.hidden = true;
    }
    estado = null;
    memoria = novaMemoria(null);
  }

  // Abre a conversa com uma pergunta já escrita, sem enviar: a pessoa lê o
  // aviso do que vai junto e decide.
  function perguntar(texto) {
    if (!estado || !estado.host || !estado.host.isConnected) {
      return;
    }
    const conversa = el(estado.host, "conversa");
    const campo = estado.host.querySelector("#perguntaFinck");
    if (!conversa || !campo) {
      return;
    }
    conversa.open = true;
    if (!campo.value.trim()) {
      campo.value = String(texto || "").slice(0, MAX_PERGUNTA);
      atualizarConta();
    }
    campo.focus({ preventScroll: true });
    campo.scrollIntoView({ block: "center", behavior: movimentoLiberado() ? "smooth" : "auto" });
  }

  return { mostrar: mostrar, atualizar: atualizar, limpar: limpar, perguntar: perguntar, analiseAtual: () => estado ? estado.analise : null };
})();
