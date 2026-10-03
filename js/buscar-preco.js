document.addEventListener("DOMContentLoaded", () => {
  const U = window.FinckUtils;
  const S = window.FinckStore;
  const L = window.FinckLojas;
  const cfg = window.FINCK_CONFIG;
  const campoLink = document.getElementById("itemLink");
  const botao = document.getElementById("btnBuscarPreco");
  const aviso = document.getElementById("avisoLoja");
  const abrirLista = document.getElementById("btnLojasSuportadas");
  if (!campoLink || !botao || !aviso) {
    return;
  }
  const ENDPOINT = `${cfg.SUPABASE_URL}/functions/v1/buscar-preco`;
  const IA = cfg.BUSCA_IA || {};
  const IA_ATIVA = IA.ATIVA === true && !!IA.ENDPOINT;
  const P = window.FinckPrint;
  const botaoPrint = document.getElementById("btnLerPrint");
  const entradaPrint = document.getElementById("entradaPrint");
  const dicaPrint = document.getElementById("dicaPrint");
  // O print usa a mesma rota da IA. Começa ligado quando ela está ativa; o GET
  // de conferirPrint() ou a primeira resposta do servidor podem desligá-lo.
  let printDisponivel = IA_ATIVA && !!P && !!botaoPrint && !!entradaPrint;
  const TEXTOS = IA_ATIVA ? {
    bloqueada: c => `<strong>${U.escapeHTML(c.loja)} dificulta a leitura de fora.</strong> ` + (printDisponivel ? `Pelo link, a busca costuma voltar sem preço aqui. ` + `Mande um print da tela do produto: a IA lê o preço direto da imagem.` : `A busca por IA vai tentar mesmo assim, mas aqui ela costuma voltar sem preço. ` + `Se voltar, digite o valor manualmente.`),
    instavel: c => `<strong>${U.escapeHTML(c.loja)}:</strong> a busca por IA lê a página, mas nesta loja ` + `pode voltar sem preço. ${U.escapeHTML(c.motivo)}` + (printDisponivel ? ` Se falhar, mande um print da tela.` : ""),
    provavel: () => `Busca por IA disponível para esta loja.`,
    desconhecida: () => `Loja não catalogada. A busca por IA lê a página do produto — ` + `se não achar, é só digitar o valor.`
  } : {
    bloqueada: c => `<strong>${U.escapeHTML(c.loja)} não permite busca automática.</strong> ` + `${U.escapeHTML(c.motivo)} Digite o valor manualmente.`,
    instavel: c => `<strong>${U.escapeHTML(c.loja)}:</strong> a busca pode não encontrar o preço. ` + `${U.escapeHTML(c.motivo)}`,
    provavel: () => `Busca disponível para esta loja.`,
    desconhecida: () => `Loja não catalogada. Vale tentar — se não achar, é só digitar o valor.`
  };
  let classificacao = {
    status: "desconhecida"
  };
  // PROD-009 — a busca automática continua sendo um extra: depende de chave no
  // servidor e de sites de terceiros que podem recusar a leitura. Digitar o
  // preço segue funcionando sempre. O que mudou é que ela roda em todos os
  // modos, demo incluído: sem sessão, o pedido vai sem token e o servidor
  // decide (BUSCA_IA_DEMO), aplicando limite por IP e teto diário. A chave
  // nunca chega aqui no navegador.
  let OPCIONAL = !IA_ATIVA;
  // Códigos em que o servidor diz "este recurso não existe aqui" — diferente de
  // "não achei o preço nesta página". Nesses casos não adianta o usuário tentar
  // de novo: o certo é dizer que a busca é opcional e liberar a digitação.
  const INDISPONIVEL = new Set([ "IA_INDISPONIVEL", "SEM_LOGIN", "ORIGEM_NAO_PERMITIDA" ]);
  function marcarOpcional() {
    if (!OPCIONAL) {
      return false;
    }
    botao.disabled = true;
    botao.classList.add("busca-preco__botao--bloqueado");
    botao.title = "Recurso opcional indisponível aqui — digite o preço no campo acima.";
    aviso.hidden = false;
    aviso.className = "busca-preco__aviso busca-preco__aviso--opcional";
    aviso.innerHTML = `<strong>Busca automática indisponível neste ambiente.</strong> Ela é um recurso opcional: digite o preço no campo acima e siga com a análise normalmente.`;
    return true;
  }
  function avaliarLink() {
    if (marcarOpcional()) {
      return;
    }
    const valor = campoLink.value.trim();
    if (!valor) {
      classificacao = {
        status: "desconhecida"
      };
      aviso.hidden = true;
      botao.disabled = true;
      botao.classList.remove("busca-preco__botao--bloqueado");
      return;
    }
    classificacao = L.classificar(valor);
    const status = classificacao.status;
    aviso.hidden = false;
    aviso.className = `busca-preco__aviso busca-preco__aviso--${status}`;
    aviso.innerHTML = TEXTOS[status](classificacao);
    const travado = status === "bloqueada" && !IA_ATIVA;
    botao.disabled = travado;
    botao.classList.toggle("busca-preco__botao--bloqueado", travado);
  }
  campoLink.addEventListener("input", avaliarLink);
  campoLink.addEventListener("paste", () => setTimeout(avaliarLink, 0));
  avaliarLink();
  function carregando(ligado) {
    botao.disabled = ligado || OPCIONAL || (classificacao.status === "bloqueada" && !IA_ATIVA);
    botao.classList.toggle("busca-preco__botao--carregando", ligado);
    botao.querySelector(".busca-preco__rotulo").textContent = ligado ? "Buscando…" : "Buscar preço do link";
  }
  function montarPainel(d) {
    const linhas = [];
    const doPrint = d.metodo === "ia-print";
    const emReais = !d.moeda || d.moeda === "BRL";
    // Preço em dólar aparece em dólar: "R$ 23,45" para US$ 23,45 enganaria.
    const dinheiro = valor => {
      if (emReais) {
        return U.moeda(valor);
      }
      try {
        return Number(valor).toLocaleString(cfg.LOCALE, {
          style: "currency",
          currency: d.moeda
        });
      } catch {
        return `${U.escapeHTML(d.moeda)} ${U.numero(valor, 2)}`;
      }
    };
    if (d.faixa) {
      linhas.push([ "Conforme a opção", `${dinheiro(d.faixa.min)} a ${dinheiro(d.faixa.max)}` ]);
    }
    if (d.aVista) {
      linhas.push([ `À vista${d.aVista.forma === "Pix" ? " no Pix" : d.aVista.forma === "boleto" ? " no boleto" : ""}`, `${dinheiro(d.aVista.valor)}<span class="panorama__off">−${Math.floor(d.aVista.percentual)}%</span>` ]);
    }
    if (d.parcelamento) {
      const p = d.parcelamento;
      linhas.push([ "Parcelado", `${p.vezes}x de ${dinheiro(p.valor)}` + `<span class="panorama__juros">${p.semJuros ? "sem juros" : `com juros · total ${dinheiro(p.total)}`}</span>` ]);
    }
    if (d.frete) {
      linhas.push([ "Frete", d.frete.minimo ? `grátis acima de ${U.moeda(d.frete.minimo)}` : doPrint ? "grátis, segundo o print" : "grátis, segundo a página" ]);
    }
    const selo = d.desconto ? `<span class="panorama__selo">${Math.floor(d.desconto.percentual)}% OFF</span>` : "";
    const de = d.precoOriginal ? `<p class="panorama__de">de <s>${dinheiro(d.precoOriginal)}</s> · você economiza\n         <strong>${dinheiro(d.desconto.valor)}</strong></p>` : "";
    const trocarPix = d.aVista && emReais ? `<button type="button" class="panorama__troca" data-preco="${d.aVista.valor}">\n           Usar o preço ${d.aVista.forma === "Pix" ? "do Pix" : "à vista"} (${U.moeda(d.aVista.valor)})\n         </button>` : "";
    // No print, a miniatura mostra qual imagem foi lida, e a loja vai embaixo
    // do nome: ela vem do que a IA reconheceu, não de um endereço.
    const cabecalho = doPrint ? `\n        <div class="panorama__cabecalho panorama__cabecalho--print">\n          ${d.miniatura ? `<img class="panorama__miniatura" src="${U.escapeHTML(d.miniatura)}" alt="Print enviado">` : ""}\n          <div class="panorama__titulos">\n            ${d.titulo ? `<p class="panorama__item">${U.escapeHTML(d.titulo)}</p>` : ""}\n            <span class="panorama__loja">${d.loja ? `${U.escapeHTML(d.loja)} · ` : ""}lido do print</span>\n          </div>\n        </div>` : `\n        <div class="panorama__cabecalho">\n          ${d.titulo ? `<p class="panorama__item">${U.escapeHTML(d.titulo)}</p>` : ""}\n          ${d.loja ? `<span class="panorama__loja">${U.escapeHTML(d.loja)}</span>` : ""}\n        </div>`;
    return `\n      <div class="panorama">${cabecalho}\n\n        <div class="panorama__valor">\n          <strong>${dinheiro(d.preco)}</strong>${selo}\n        </div>\n        ${de}\n\n        ${linhas.length ? `<dl class="panorama__linhas">${linhas.map(([rotulo, valor]) => `\n          <div><dt>${rotulo}</dt><dd>${valor}</dd></div>`).join("")}</dl>` : ""}\n\n        ${trocarPix ? `<div class="panorama__acoes">${trocarPix}</div>` : ""}\n        <p class="panorama__nota">${avisoConfianca(d)}</p>\n      </div>`;
  }
  function avisoConfianca(d) {
    if (d.moeda && d.moeda !== "BRL") {
      return `Atenção: o preço está em ${U.escapeHTML(d.moeda)}, não em reais. O campo de preço ficou como estava: converta e digite o valor em reais.`;
    }
    if (d.metodo === "ia-print") {
      if (d.faixa) {
        return "O preço muda conforme a opção (cor, tamanho). A IA usou o menor valor: ajuste o campo se for escolher outra.";
      }
      if (d.confianca === "baixa") {
        return "A IA ficou em dúvida ao ler o print (imagem cortada ou pouco nítida). Confira o valor antes de analisar.";
      }
      if (d.confianca === "media") {
        return "O print mostrava mais de um valor; a IA escolheu o do produto principal. Vale conferir.";
      }
      return "Preço lido do print pela IA. Confira se bate com o que a loja mostra.";
    }
    if (d.fonte === "ia") {
      if (d.metodo === "ia-busca") {
        return "Este valor veio de uma busca na web, não da própria página. Confira na loja antes de analisar.";
      }
      if (d.confianca === "baixa") {
        return "A IA leu a página, mas ficou em dúvida sobre qual valor é o do produto. Confira na loja.";
      }
      if (d.confianca === "media") {
        return "A página mostrava mais de um valor; a IA escolheu o do produto principal. Vale conferir.";
      }
      return "Preço lido da página pela IA. Confira se bate com o que a loja mostra.";
    }
    if (d.confianca === "baixa") {
      return "Li os valores do texto da página, então podem estar errados. Confira na loja antes de analisar.";
    }
    if (d.confianca === "media") {
      return "A loja anunciava outro valor no código da página; usei o preço promocional que aparece na tela. Vale conferir.";
    }
    return "Preço lido do código da página. Confira se bate com o que a loja mostra.";
  }
  function mostrarResultado(dados) {
    aviso.hidden = false;
    aviso.className = "busca-preco__aviso busca-preco__aviso--painel";
    aviso.innerHTML = montarPainel(dados);
    const troca = aviso.querySelector(".panorama__troca");
    if (troca) {
      troca.addEventListener("click", () => {
        U.escreverMoeda("itemPrice", Number(troca.dataset.preco));
        troca.disabled = true;
        troca.textContent = "Preço trocado ✓";
        U.toast("Campo atualizado com o preço à vista.", "sucesso");
      });
    }
  }
  async function consultar(endpoint, url, token) {
    try {
      const cabecalhos = {
        "Content-Type": "application/json",
        apikey: cfg.SUPABASE_ANON_KEY
      };
      if (token) {
        cabecalhos.Authorization = `Bearer ${token}`;
      }
      const r = await fetch(endpoint, {
        method: "POST",
        headers: cabecalhos,
        body: JSON.stringify({
          url: url
        })
      });
      return await r.json().catch(() => null);
    } catch {
      return null;
    }
  }
  async function buscarPreco(url, token) {
    if (!IA_ATIVA) {
      return consultar(ENDPOINT, url, token);
    }
    const porIA = await consultar(IA.ENDPOINT, url, token);
    if (porIA?.ok) {
      return porIA;
    }
    // A IA não trouxe preço. O leitor antigo lê o HTML direto e às vezes acha
    // o que ela não achou — menos nas lojas que recusam acesso de servidor,
    // onde ele já responderia recusando.
    if (classificacao.status === "bloqueada") {
      return porIA;
    }
    const antigo = await consultar(ENDPOINT, url, token);
    return antigo?.ok ? antigo : porIA || antigo;
  }
  function mostrarErro(motivo) {
    aviso.hidden = false;
    aviso.className = "busca-preco__aviso busca-preco__aviso--erro";
    aviso.textContent = motivo;
  }
  // Corta no limite do campo sem partir palavra ao meio.
  function nomeParaCampo(texto, max = 80) {
    const limpo = String(texto || "").replace(/\s+/g, " ").trim();
    if (limpo.length <= max) {
      return limpo;
    }
    const corte = limpo.slice(0, max + 1);
    const espaco = corte.lastIndexOf(" ");
    return (espaco > max / 2 ? corte.slice(0, espaco) : limpo.slice(0, max)).replace(/[\s,;:.\u2013\u2014-]+$/, "");
  }
  const listaFalada = itens => itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}` : itens[0] || "";
  const campoCategoria = document.getElementById("itemCategory");
  // A sugestão de categoria só entra enquanto o usuário não escolheu uma.
  if (campoCategoria) {
    campoCategoria.addEventListener("change", () => {
      campoCategoria.dataset.escolhida = "1";
    });
  }
  // Link e print preenchem o formulário do mesmo jeito. Preço em outra moeda
  // não entra no campo: o FinCK calcula em reais, e um valor em dólar ali
  // viraria uma análise errada sem ninguém perceber.
  function aplicarResultado(dados) {
    const emReais = !dados.moeda || dados.moeda === "BRL";
    const preenchidos = [];
    const campoNome = document.getElementById("itemName");
    const nome = nomeParaCampo(dados.nomeCurto || dados.titulo);
    if (campoNome && !campoNome.value.trim() && nome) {
      campoNome.value = nome;
      preenchidos.push("item");
    }
    if (emReais) {
      U.escreverMoeda("itemPrice", dados.preco);
      preenchidos.push("preço");
    }
    if (campoCategoria && dados.categoria && !campoCategoria.dataset.escolhida && Array.from(campoCategoria.options).some(o => o.value === dados.categoria)) {
      campoCategoria.value = dados.categoria;
      preenchidos.push("categoria");
    }
    mostrarResultado(dados);
    if (!emReais) {
      U.toast(`O preço está em ${dados.moeda}. Converta para reais e digite o valor.`, "info", 4500);
      return;
    }
    const frase = listaFalada(preenchidos);
    U.toast(`${frase.charAt(0).toUpperCase()}${frase.slice(1)} ${preenchidos.length > 1 ? "preenchidos" : "preenchido"}. Confira antes de analisar.`, "sucesso");
  }
  botao.addEventListener("click", async () => {
    const url = campoLink.value.trim();
    if (!url || OPCIONAL) {
      return;
    }
    // Em conta real vai o token da sessão; na demonstração não há token, e o
    // servidor responde pelo caminho anônimo se ele estiver liberado.
    const token = S.emDemo() ? null : await S.tokenAcesso();
    if (!S.emDemo() && !token) {
      mostrarErro("Sua sessão expirou. Entre novamente para usar a busca.");
      return;
    }
    carregando(true);
    try {
      const dados = await buscarPreco(url, token);
      if (!dados) {
        mostrarErro("Não consegui falar com o servidor de busca. Tente de novo em instantes.");
        return;
      }
      if (!dados.ok) {
        // Servidor sem chave, sem demo liberado ou origem recusada: o recurso
        // não está disponível aqui, e insistir no botão não muda isso.
        if (INDISPONIVEL.has(dados.codigo)) {
          OPCIONAL = true;
          marcarOpcional();
          return;
        }
        mostrarErro(dados.motivo || "Não encontrei o preço nessa página.");
        return;
      }
      aplicarResultado(dados);
    } catch {
      mostrarErro("Falha de conexão. Verifique sua internet e tente de novo.");
    } finally {
      carregando(false);
    }
  });
  // Leitura do print. É a saída para as lojas que recusam o link: o usuário
  // já está vendo o preço na tela, e a IA lê a imagem. Mesma rota, mesmo
  // login e mesmos limites da busca pelo link; a imagem não é guardada.
  let lendoPrint = false;
  let miniaturaAtual = null;
  const MSG_PRINT_DEMO = "Na demonstração, a leitura do print fica desligada. Entre com uma conta para usar, ou digite o preço.";
  const MSG_PRINT_SEM_IA = "A leitura do print não está disponível neste servidor. Digite o preço no campo acima.";
  function desligarPrint(mensagem) {
    printDisponivel = false;
    botaoPrint.disabled = true;
    botaoPrint.classList.add("busca-preco__botao--bloqueado");
    botaoPrint.title = mensagem;
    if (dicaPrint) {
      dicaPrint.textContent = mensagem;
      dicaPrint.classList.add("busca-preco__dica--desligada");
    }
    // O aviso da loja pode estar sugerindo o print; refaz sem a sugestão.
    if (/busca-preco__aviso--(bloqueada|instavel)/.test(aviso.className)) {
      avaliarLink();
    }
  }
  // Pergunta à rota, sem gastar cota, se a IA existe aqui e se a demonstração
  // pode usá-la. Assim o botão desliga antes de o usuário escolher a imagem.
  async function conferirPrint() {
    const ctrl = new AbortController;
    const alarme = setTimeout(() => ctrl.abort(), 6000);
    try {
      const r = await fetch(IA.ENDPOINT, {
        method: "GET",
        cache: "no-store",
        signal: ctrl.signal
      });
      // Servidor estático, rota antiga ou fora do ar: quem decide é o clique.
      const s = r.ok ? await r.json().catch(() => null) : null;
      if (!s || s.ok !== true) {
        return;
      }
      if (s.ia === false) {
        desligarPrint(MSG_PRINT_SEM_IA);
      } else if (S.emDemo() && s.demo === false) {
        desligarPrint(MSG_PRINT_DEMO);
      }
    } catch {} finally {
      clearTimeout(alarme);
    }
  }
  function trocarMiniatura(blob) {
    if (miniaturaAtual) {
      URL.revokeObjectURL(miniaturaAtual);
    }
    miniaturaAtual = blob ? URL.createObjectURL(blob) : null;
  }
  function carregandoPrint(ligado) {
    botaoPrint.disabled = ligado || !printDisponivel;
    botaoPrint.classList.toggle("busca-preco__botao--carregando", ligado);
    botaoPrint.setAttribute("aria-busy", ligado ? "true" : "false");
    botaoPrint.querySelector(".busca-preco__rotulo").textContent = ligado ? "Lendo o print…" : "Ler preço de um print";
  }
  function mostrarLendo(demorando = false) {
    aviso.hidden = false;
    aviso.className = "busca-preco__aviso busca-preco__aviso--lendo";
    aviso.innerHTML = `\n      <div class="print-lendo">\n        ${miniaturaAtual ? `<img class="print-lendo__miniatura" src="${U.escapeHTML(miniaturaAtual)}" alt="Print enviado">` : ""}\n        <p><strong>Lendo o print…</strong>\n          ${demorando ? "A IA está mais lenta que o normal agora. Ainda tentando." : "A IA está procurando o produto e o preço. Leva alguns segundos."}</p>\n      </div>`;
  }
  async function consultarPrint(imagem, token) {
    try {
      const cabecalhos = {
        "Content-Type": "application/json"
      };
      if (token) {
        cabecalhos.Authorization = `Bearer ${token}`;
      }
      const r = await fetch(IA.ENDPOINT, {
        method: "POST",
        headers: cabecalhos,
        body: JSON.stringify({
          imagem: imagem,
          categorias: cfg.CATEGORIAS
        })
      });
      // A Vercel recusa corpo grande antes da função, e responde sem JSON.
      if (r.status === 413) {
        return {
          ok: false,
          codigo: "IMAGEM_INVALIDA",
          motivo: "Imagem grande demais para enviar. Recorte só a parte do produto e tente de novo."
        };
      }
      return await r.json().catch(() => null);
    } catch {
      return null;
    }
  }
  async function lerPrint(arquivo) {
    if (!arquivo || lendoPrint) {
      return;
    }
    // A galeria pode ter sido aberta antes de conferirPrint() responder.
    if (!printDisponivel) {
      mostrarErro(botaoPrint.title || MSG_PRINT_SEM_IA);
      return;
    }
    const token = S.emDemo() ? null : await S.tokenAcesso();
    if (!S.emDemo() && !token) {
      mostrarErro("Sua sessão expirou. Entre novamente para ler o print.");
      return;
    }
    lendoPrint = true;
    carregandoPrint(true);
    let demora = null;
    try {
      let preparado;
      try {
        preparado = await P.preparar(arquivo);
      } catch (e) {
        mostrarErro(e.message || "Não consegui abrir essa imagem.");
        return;
      }
      trocarMiniatura(preparado.blob);
      mostrarLendo();
      demora = setTimeout(() => mostrarLendo(true), 9000);
      const dados = await consultarPrint(preparado.dataUrl, token);
      clearTimeout(demora);
      if (!dados) {
        mostrarErro("Não consegui falar com o servidor. Confira sua internet e tente de novo.");
        return;
      }
      if (!dados.ok) {
        // Sem chave, sem demo liberado ou origem recusada: insistir não muda nada.
        if (dados.codigo === "IA_INDISPONIVEL" || dados.codigo === "ORIGEM_NAO_PERMITIDA" || dados.codigo === "SEM_LOGIN" && S.emDemo()) {
          const mensagem = dados.codigo === "SEM_LOGIN" ? MSG_PRINT_DEMO : MSG_PRINT_SEM_IA;
          desligarPrint(mensagem);
          mostrarErro(mensagem);
          return;
        }
        if (dados.codigo === "SEM_LOGIN") {
          mostrarErro("Sua sessão expirou. Entre novamente para ler o print.");
          return;
        }
        mostrarErro([ dados.motivo || "Não consegui ler o preço nesse print.", dados.detalhe ].filter(Boolean).join(" "));
        return;
      }
      aplicarResultado({
        ...dados,
        miniatura: miniaturaAtual
      });
    } catch {
      mostrarErro("Falha de conexão. Verifique sua internet e tente de novo.");
    } finally {
      clearTimeout(demora);
      lendoPrint = false;
      carregandoPrint(false);
    }
  }
  const painelVisivel = () => !document.getElementById("painelCalculo")?.hidden && !document.querySelector(".modal-overlay:not([hidden])");
  if (botaoPrint && entradaPrint) {
    if (!printDisponivel) {
      // Sem a IA no config, o print não tem por onde ir.
      botaoPrint.hidden = true;
      if (dicaPrint) {
        dicaPrint.hidden = true;
      }
    } else {
      botaoPrint.addEventListener("click", () => {
        if (printDisponivel && !lendoPrint) {
          entradaPrint.click();
        }
      });
      entradaPrint.addEventListener("change", () => {
        const arquivo = entradaPrint.files && entradaPrint.files[0];
        // Limpa depois de ler, para escolher o mesmo arquivo de novo funcionar.
        lerPrint(arquivo).finally(() => {
          entradaPrint.value = "";
        });
      });
      document.addEventListener("paste", e => {
        if (!printDisponivel || lendoPrint || !painelVisivel()) {
          return;
        }
        const arquivo = P.imagemDaColagem(e.clipboardData);
        if (!arquivo) {
          return;
        }
        e.preventDefault();
        lerPrint(arquivo);
      });
      const zona = document.getElementById("passoDados");
      let camadas = 0;
      const soltarAtivo = ligado => zona && zona.classList.toggle("busca-preco--soltar", ligado);
      // Soltar a imagem fora da área não pode abrir o arquivo no lugar do app.
      window.addEventListener("dragover", e => {
        if (P.temArquivo(e.dataTransfer)) {
          e.preventDefault();
        }
      });
      window.addEventListener("drop", e => {
        if (P.temArquivo(e.dataTransfer)) {
          e.preventDefault();
        }
      });
      if (zona) {
        zona.addEventListener("dragenter", e => {
          if (!printDisponivel || !P.temArquivo(e.dataTransfer)) {
            return;
          }
          camadas++;
          soltarAtivo(true);
        });
        zona.addEventListener("dragover", e => {
          if (printDisponivel && P.temArquivo(e.dataTransfer)) {
            e.dataTransfer.dropEffect = "copy";
          }
        });
        zona.addEventListener("dragleave", () => {
          camadas = Math.max(0, camadas - 1);
          if (!camadas) {
            soltarAtivo(false);
          }
        });
        zona.addEventListener("drop", e => {
          camadas = 0;
          soltarAtivo(false);
          if (!printDisponivel || !P.temArquivo(e.dataTransfer)) {
            return;
          }
          const arquivo = P.imagemDoArraste(e.dataTransfer);
          if (arquivo) {
            lerPrint(arquivo);
          } else {
            mostrarErro("Solte uma imagem: o print da tela ou a foto do produto.");
          }
        });
      }
      conferirPrint();
    }
  }
  // "Nova análise" limpa o formulário: o painel e a categoria escolhida
  // pertenciam ao item anterior.
  document.getElementById("formReality")?.addEventListener("reset", () => {
    if (campoCategoria) {
      delete campoCategoria.dataset.escolhida;
    }
    setTimeout(() => {
      if (!lendoPrint) {
        aviso.hidden = true;
        avaliarLink();
      }
    }, 0);
  });
  function montarModal() {
    const host = document.getElementById("conteudoLojas");
    if (!host) {
      return;
    }
    const item = (l, mostrarMotivo) => `\n      <li>\n        <strong>${U.escapeHTML(l.nome)}</strong>\n        ${mostrarMotivo && l.motivo ? `<p>${U.escapeHTML(l.motivo)}</p>` : ""}\n        ${l.detalhe ? `<p>${U.escapeHTML(l.detalhe)}</p>` : ""}\n      </li>`;
    host.innerHTML = `\n      <p class="lojas-intro">\n        ${IA_ATIVA ? "A busca manda a IA abrir a página do produto e ler o preço.\n        Ela entende a página como um leitor humano, então funciona em muito\n        mais loja do que antes — mas ainda depende de a loja deixar a página\n        ser aberta de fora." : "A busca lê a página do produto e traz o preço. Isso depende de como cada\n        loja monta o site — por isso não funciona em todas."} Em qualquer caso,\n        você pode digitar o valor manualmente.\n      </p>\n${printDisponivel ? `\n      <p class="lojas-print">\n        <strong>O print resolve em qualquer loja.</strong> Inclusive nas que recusam o\n        link: use <em>Ler preço de um print</em> com a tela do produto aberta, e a IA lê\n        o preço direto da imagem.\n      </p>\n` : ""}\n      <section class="lojas-grupo lojas-grupo--bloqueada">\n        <h4>${IA_ATIVA ? "Raramente funciona" : "Não funciona"}</h4>\n        <p class="lojas-grupo__nota">${IA_ATIVA ? printDisponivel ? "Estas lojas recusam o acesso de fora, inclusive o da IA. Pelo link,\n          quase sempre volta sem preço: aqui, use o print da tela." : "Estas lojas recusam o acesso de fora, inclusive o da IA. O botão\n          continua liberado — se voltar sem preço, digite o valor." : "O botão fica desativado nestas lojas."}</p>\n        <ul class="lojas-lista">\n          ${L.BLOQUEADAS.map(l => item(l, true)).join("")}\n        </ul>\n      </section>\n\n      <section class="lojas-grupo lojas-grupo--instavel">\n        <h4>Pode falhar</h4>\n        <p class="lojas-grupo__nota">A busca tenta, mas às vezes volta sem preço.</p>\n        <ul class="lojas-lista">\n          ${L.INSTAVEIS.map(l => item(l, true)).join("")}\n        </ul>\n      </section>\n\n      <section class="lojas-grupo lojas-grupo--provavel">\n        <h4>Costuma funcionar</h4>\n        <ul class="lojas-lista">\n          ${L.PROVAVEIS.map(l => item(l, false)).join("")}\n        </ul>\n      </section>\n\n      <p class="lojas-rodape">\n        O valor trazido é sempre uma sugestão: ele preenche o campo, mas quem\n        confirma é você. Em produto com variação (cor, tamanho) ou preço que muda\n        por CEP, o valor lido pode ser o do item base.\n      </p>`;
  }
  if (abrirLista) {
    abrirLista.addEventListener("click", () => {
      montarModal();
      U.abrirModal("modalLojas");
    });
  }
  document.querySelectorAll('[data-fechar="modalLojas"]').forEach(b => b.addEventListener("click", () => U.fecharModal("modalLojas")));
});
