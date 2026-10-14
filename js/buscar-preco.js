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
  const botaoMostrarLink = document.getElementById("btnMostrarLink");
  const areaLink = document.getElementById("areaLink");
  const atalho = document.getElementById("atalhoPreco");
  const notaDemo = document.getElementById("importarDemo");
  const detalhesImportar = document.getElementById("importarPreco");
  // Na demonstração não há conta: a importação só aparece se o servidor
  // liberar o modo demo (o GET de conferirImportacao). Sem isso, "Importar
  // preço" diz que ela funciona com uma conta, sem botão desligado.
  const EM_DEMO = S.emDemo();
  // A imagem usa a mesma rota da leitura automática. Começa ligada quando ela
  // está ativa; o GET ou a primeira resposta do servidor podem desligá-la.
  let printDisponivel = IA_ATIVA && !!P && !!botaoPrint && !!entradaPrint && !EM_DEMO;
  const TEXTOS = IA_ATIVA ? {
    bloqueada: c => `<strong>${U.escapeHTML(c.loja)} dificulta a leitura de fora.</strong> ` + (printDisponivel ? `Pela página, a importação costuma voltar sem preço aqui. ` + `Use uma imagem da tela do produto: o preço é lido direto dela.` : `A importação vai tentar mesmo assim, mas aqui ela costuma voltar sem preço. ` + `Se voltar, digite o valor.`),
    instavel: c => `<strong>${U.escapeHTML(c.loja)}:</strong> nesta loja a importação pela página ` + `pode voltar sem preço. ${U.escapeHTML(c.motivo)}` + (printDisponivel ? ` Se falhar, use uma imagem da tela.` : ""),
    provavel: () => `Importação disponível para esta loja.`,
    desconhecida: () => `Loja não catalogada. Vale tentar; se não achar, é só digitar o valor.`
  } : {
    bloqueada: c => `<strong>${U.escapeHTML(c.loja)} não permite importar o preço.</strong> ` + `${U.escapeHTML(c.motivo)} Digite o valor no campo de preço.`,
    instavel: c => `<strong>${U.escapeHTML(c.loja)}:</strong> a importação pode não encontrar o preço. ` + `${U.escapeHTML(c.motivo)}`,
    provavel: () => `Importação disponível para esta loja.`,
    desconhecida: () => `Loja não catalogada. Vale tentar; se não achar, é só digitar o valor.`
  };
  let classificacao = {
    status: "desconhecida"
  };
  // A busca automática continua sendo um extra: depende de chave no
  // servidor e de sites de terceiros que podem recusar a leitura. Digitar o
  // preço segue funcionando sempre. O que mudou é que ela roda em todos os
  // modos, demo incluído: sem sessão, o pedido vai sem token e o servidor
  // decide (BUSCA_IA_DEMO), aplicando limite por IP e teto diário. A chave
  // nunca chega aqui no navegador.
  // Sem a leitura automática, o link usa o leitor antigo da página, que
  // também exige conta: na demonstração, os dois dependem do servidor.
  let OPCIONAL = !IA_ATIVA || EM_DEMO;
  // Códigos em que o servidor diz "este recurso não existe aqui", diferente de
  // "não achei o preço nesta página". Nesses casos não adianta tentar de novo:
  // o caminho some e fica a digitação.
  const INDISPONIVEL = new Set([ "IA_INDISPONIVEL", "SEM_LOGIN", "ORIGEM_NAO_PERMITIDA" ]);
  const NOTA_SEM_IMPORTACAO = EM_DEMO ? "Na demonstração, digite o preço no campo acima. A importação funciona quando você entra com uma conta." : "A importação de preço não está disponível agora. Digite o preço no campo acima.";
  // O que aparece em "Importar preço": só os caminhos que funcionam aqui.
  // Nenhum botão fica desligado à vista; sem caminho, sobra a frase.
  function mostrarCaminhos() {
    const link = !OPCIONAL;
    if (botaoMostrarLink) {
      botaoMostrarLink.hidden = !link;
    }
    if (areaLink && !link) {
      areaLink.hidden = true;
      botaoMostrarLink?.setAttribute("aria-expanded", "false");
    }
    if (botaoPrint) {
      botaoPrint.hidden = !printDisponivel;
    }
    if (dicaPrint) {
      dicaPrint.hidden = !printDisponivel;
    }
    const nenhum = !link && !printDisponivel;
    if (atalho) {
      atalho.hidden = nenhum;
    }
    if (notaDemo) {
      notaDemo.textContent = NOTA_SEM_IMPORTACAO;
      notaDemo.hidden = !nenhum;
    }
  }
  function marcarOpcional() {
    if (!OPCIONAL) {
      return false;
    }
    mostrarCaminhos();
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
      if (/busca-preco__aviso--(bloqueada|instavel|provavel|desconhecida)/.test(aviso.className)) {
        aviso.hidden = true;
      }
      botao.disabled = false;
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
    botao.querySelector(".busca-preco__rotulo").textContent = ligado ? "Importando…" : "Importar o preço desta página";
  }
  // O painel da importação mora dentro de "Importar preço": colar ou soltar
  // uma imagem com ele fechado abre o detalhe para mostrar o que foi lido.
  function abrirImportar() {
    if (detalhesImportar && !detalhesImportar.open) {
      detalhesImportar.open = true;
    }
  }
  // Enquanto a leitura roda, a tela diz o que está acontecendo.
  // As etapas seguem o que a rota faz de verdade: abrir a página, ler o preço
  // e conferir parcelas e frete; a última só aparece se demorar.
  let etapasBusca = [];
  function mostrarBuscando() {
    const passos = [ "Abrindo a página da loja…", "Lendo o preço…", "Conferindo parcelas, frete e desconto…", "A loja está demorando para responder. Ainda tentando…" ];
    const pintar = i => {
      aviso.hidden = false;
      aviso.className = "busca-preco__aviso busca-preco__aviso--lendo";
      aviso.innerHTML = `<p class="processo-ia"><span class="busca-preco__giro" aria-hidden="true"></span> <strong>${passos[i]}</strong></p>`;
    };
    pararBuscando();
    pintar(0);
    etapasBusca = [ setTimeout(() => pintar(1), 2500), setTimeout(() => pintar(2), 7000), setTimeout(() => pintar(3), 18000) ];
  }
  function pararBuscando() {
    etapasBusca.forEach(clearTimeout);
    etapasBusca = [];
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
      linhas.push([ "Frete", d.frete.minimo ? `grátis acima de ${U.moeda(d.frete.minimo)}` : doPrint ? "grátis, segundo a imagem" : "grátis, segundo a página" ]);
    }
    const selo = d.desconto ? `<span class="panorama__selo">${Math.floor(d.desconto.percentual)}% OFF</span>` : "";
    const de = d.precoOriginal ? `<p class="panorama__de">de <s>${dinheiro(d.precoOriginal)}</s> · você economiza\n         <strong>${dinheiro(d.desconto.valor)}</strong></p>` : "";
    const trocarPix = d.aVista && emReais ? `<button type="button" class="panorama__troca" data-preco="${d.aVista.valor}">\n           Usar o preço ${d.aVista.forma === "Pix" ? "do Pix" : "à vista"} (${U.moeda(d.aVista.valor)})\n         </button>` : "";
    // Na imagem, a miniatura mostra qual foi lida, e a loja vai embaixo do
    // nome: ela vem do que foi reconhecido na imagem, não de um endereço.
    const cabecalho = doPrint ? `\n        <div class="panorama__cabecalho panorama__cabecalho--print">\n          ${d.miniatura ? `<img class="panorama__miniatura" src="${U.escapeHTML(d.miniatura)}" alt="Imagem enviada">` : ""}\n          <div class="panorama__titulos">\n            ${d.titulo ? `<p class="panorama__item">${U.escapeHTML(d.titulo)}</p>` : ""}\n            <span class="panorama__loja">${d.loja ? `${U.escapeHTML(d.loja)} · ` : ""}lido da imagem</span>\n          </div>\n        </div>` : `\n        <div class="panorama__cabecalho">\n          ${d.titulo ? `<p class="panorama__item">${U.escapeHTML(d.titulo)}</p>` : ""}\n          ${d.loja ? `<span class="panorama__loja">${U.escapeHTML(d.loja)}</span>` : ""}\n        </div>`;
    return `\n      <div class="panorama">${cabecalho}\n\n        <p class="panorama__achado">✓ Preço encontrado</p>\n        <div class="panorama__valor">\n          <strong>${dinheiro(d.preco)}</strong>${selo}\n        </div>\n        ${de}\n\n        ${linhas.length ? `<dl class="panorama__linhas">${linhas.map(([rotulo, valor]) => `\n          <div><dt>${rotulo}</dt><dd>${valor}</dd></div>`).join("")}</dl>` : ""}\n\n        ${emReais ? `<div class="panorama__acoes"><button type="button" class="btn-primario btn-mini panorama__usar" data-preco="${d.preco}">Usar este preço</button>${trocarPix}</div>` : ""}\n        <p class="panorama__nota">${avisoConfianca(d)}</p>\n      </div>`;
  }
  function avisoConfianca(d) {
    if (d.moeda && d.moeda !== "BRL") {
      return `Atenção: o preço está em ${U.escapeHTML(d.moeda)}, não em reais. O campo de preço ficou como estava: converta e digite o valor em reais.`;
    }
    // Quem leu fica dito de forma neutra: da imagem ou da página.
    if (d.metodo === "ia-print") {
      if (d.faixa) {
        return "O preço muda conforme a opção (cor, tamanho). Foi lido o menor valor: ajuste o campo se for escolher outra.";
      }
      if (d.confianca === "baixa") {
        return "A leitura ficou em dúvida (imagem cortada ou pouco nítida). Confira o valor antes de usar.";
      }
      if (d.confianca === "media") {
        return "A imagem mostrava mais de um valor; foi lido o do produto principal. Confira antes de usar.";
      }
      return "Preço lido da imagem. Confira antes de usar.";
    }
    if (d.fonte === "ia") {
      if (d.metodo === "ia-busca") {
        return "Este valor veio de uma busca na web, não da própria página. Confira na loja antes de usar.";
      }
      if (d.confianca === "baixa") {
        return "A página mostrava valores diferentes e a leitura ficou em dúvida sobre qual é o do produto. Confira na loja.";
      }
      if (d.confianca === "media") {
        return "A página mostrava mais de um valor; foi lido o do produto principal. Confira antes de usar.";
      }
      return "Preço lido da página. Confira antes de usar.";
    }
    if (d.confianca === "baixa") {
      return "Os valores foram lidos do texto da página e podem estar errados. Confira na loja antes de usar.";
    }
    if (d.confianca === "media") {
      return "A loja anunciava outro valor no código da página; foi usado o preço promocional que aparece na tela. Confira antes de usar.";
    }
    return "Preço lido da página. Confira antes de usar.";
  }
  // O que foi lido aparece primeiro como sugestão. O
  // formulário só muda quando a pessoa toca em "Usar este preço" (ou no preço
  // do Pix): nenhum dado é trocado sem uma confirmação explícita.
  function mostrarResultado(dados) {
    aviso.hidden = false;
    aviso.className = "busca-preco__aviso busca-preco__aviso--painel";
    aviso.innerHTML = montarPainel(dados);
    aviso.querySelectorAll(".panorama__usar, .panorama__troca").forEach(b => b.addEventListener("click", () => {
      preencher(dados, Number(b.dataset.preco));
      aviso.querySelectorAll(".panorama__usar, .panorama__troca").forEach(x => {
        x.disabled = true;
      });
      b.textContent = "✓ Preço aplicado";
      document.getElementById("itemPrice")?.focus();
    }));
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
    // o que ela não achou, menos nas lojas que recusam acesso de servidor,
    // onde ele já responderia recusando.
    if (classificacao.status === "bloqueada") {
      return porIA;
    }
    const antigo = await consultar(ENDPOINT, url, token);
    return antigo?.ok ? antigo : porIA || antigo;
  }
  // A mensagem diz o que não deu certo em linguagem comum e já
  // oferece a saída: digitar o preço ou tentar o outro caminho.
  function mostrarErro(motivo, {titulo: titulo = null, origem: origem = "link"} = {}) {
    pararBuscando();
    aviso.hidden = false;
    aviso.className = "busca-preco__aviso busca-preco__aviso--erro";
    abrirImportar();
    const outroCaminho = origem === "link" ? printDisponivel ? `<button type="button" class="btn-secundario btn-mini" data-acao-erro="print">Tentar com uma imagem</button>` : "" : `<button type="button" class="btn-secundario btn-mini" data-acao-erro="print">Tentar outra imagem</button>`;
    aviso.innerHTML = `${titulo ? `<p><strong>${U.escapeHTML(titulo)}</strong></p>` : ""}<p>${U.escapeHTML(motivo)}</p>
      <div class="busca-preco__acoes-erro">
        <button type="button" class="btn-secundario btn-mini" data-acao-erro="digitar">Digitar o preço</button>
        ${origem === "print" && !printDisponivel ? "" : outroCaminho}
      </div>`;
    aviso.querySelector('[data-acao-erro="digitar"]')?.addEventListener("click", () => document.getElementById("itemPrice")?.focus());
    aviso.querySelector('[data-acao-erro="print"]')?.addEventListener("click", () => botaoPrint?.click());
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
  function preencher(dados, preco) {
    const preenchidos = [];
    const campoNome = document.getElementById("itemName");
    const nome = nomeParaCampo(dados.nomeCurto || dados.titulo);
    if (campoNome && !campoNome.value.trim() && nome) {
      campoNome.value = nome;
      campoNome.dispatchEvent(new Event("input", {
        bubbles: true
      }));
      preenchidos.push("item");
    }
    U.escreverMoeda("itemPrice", preco);
    preenchidos.push("preço");
    if (campoCategoria && dados.categoria && !campoCategoria.dataset.escolhida && !campoCategoria.dataset.confirmada && Array.from(campoCategoria.options).some(o => o.value === dados.categoria)) {
      campoCategoria.value = dados.categoria;
      // A pílula do Reality diz de onde veio a sugestão: da imagem ou da
      // página da loja. Continua sugestão até a pessoa confirmar.
      campoCategoria.dataset.origem = dados.metodo === "ia-print" ? "imagem" : "pagina";
      campoCategoria.dispatchEvent(new Event("finck:categoria"));
      preenchidos.push("categoria");
    }
    const frase = listaFalada(preenchidos);
    U.toast(`${frase.charAt(0).toUpperCase()}${frase.slice(1)} ${preenchidos.length > 1 ? "preenchidos" : "preenchido"}. Confira e toque em Calcular o impacto.`, "sucesso");
  }
  function aplicarResultado(dados) {
    pararBuscando();
    abrirImportar();
    const emReais = !dados.moeda || dados.moeda === "BRL";
    mostrarResultado(dados);
    if (!emReais) {
      U.toast(`O preço está em ${dados.moeda}. Converta para reais e digite o valor.`, "info", 4500);
    }
  }
  botao.addEventListener("click", async () => {
    const url = campoLink.value.trim();
    if (OPCIONAL) {
      return;
    }
    if (!url) {
      U.erroCampo("itemLink", "Cole o link da página do produto.");
      return;
    }
    // Em conta real vai o token da sessão; na demonstração não há token, e o
    // servidor responde pelo caminho anônimo se ele estiver liberado.
    const token = S.emDemo() ? null : await S.tokenAcesso();
    if (!S.emDemo() && !token) {
      mostrarErro("Sua sessão expirou. Entre novamente para importar o preço.");
      return;
    }
    carregando(true);
    mostrarBuscando();
    try {
      const dados = await buscarPreco(url, token);
      if (!dados) {
        mostrarErro("O servidor não respondeu. Você pode digitar o valor ou tentar de novo em instantes.", {
          titulo: "Não deu para importar o preço agora."
        });
        return;
      }
      if (!dados.ok) {
        // Servidor sem chave, sem demo liberado ou origem recusada: o recurso
        // não está disponível aqui, e insistir no botão não muda isso.
        if (INDISPONIVEL.has(dados.codigo)) {
          pararBuscando();
          OPCIONAL = true;
          marcarOpcional();
          aviso.hidden = false;
          aviso.className = "busca-preco__aviso busca-preco__aviso--opcional";
          aviso.textContent = EM_DEMO ? NOTA_SEM_IMPORTACAO : "A importação pela página não está disponível agora. Digite o preço no campo acima.";
          return;
        }
        mostrarErro(dados.motivo || "A página não mostrou um preço que desse para ler.", {
          titulo: "Não deu para ler o preço nesta página."
        });
        return;
      }
      aplicarResultado(dados);
    } catch {
      mostrarErro("A conexão caiu no meio da importação. Confira sua internet; enquanto isso, dá para digitar o valor.", {
        titulo: "Não deu para importar o preço agora."
      });
    } finally {
      pararBuscando();
      carregando(false);
    }
  });
  // Leitura da imagem. É a saída para as lojas que recusam o link: a pessoa
  // já está vendo o preço na tela, e a leitura automática lê a imagem. Mesma
  // rota, mesmo login e mesmos limites do link; a imagem não é guardada.
  let lendoPrint = false;
  let miniaturaAtual = null;
  const MSG_PRINT_SEM_IA = "A importação por imagem não está disponível agora. Digite o preço no campo acima.";
  const podeLerImagem = IA_ATIVA && !!P && !!botaoPrint && !!entradaPrint;
  // Sem a leitura, o botão sai de vista (nada de botão desligado) e
  // "Importar preço" mostra só o que ainda funciona.
  function desligarPrint() {
    printDisponivel = false;
    mostrarCaminhos();
    // O aviso da loja pode estar sugerindo a imagem; refaz sem a sugestão.
    if (/busca-preco__aviso--(bloqueada|instavel)/.test(aviso.className)) {
      avaliarLink();
    }
  }
  // Pergunta à rota, sem gastar cota, se a leitura existe aqui e se a
  // demonstração pode usá-la. Na demonstração, só um "sim" do servidor liga
  // a importação; fora dela, sem resposta, quem decide é o clique.
  async function conferirImportacao() {
    // A mesma consulta serve ao impacto ambiental: js/ia-cliente.js faz um GET
    // só por página.
    const s = window.FinckIA ? await window.FinckIA.status() : null;
    if (!s) {
      return;
    }
    if (s.ia === false) {
      desligarPrint();
      return;
    }
    if (EM_DEMO && s.demo === true) {
      printDisponivel = podeLerImagem;
      OPCIONAL = false;
      mostrarCaminhos();
      avaliarLink();
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
    botaoPrint.querySelector(".busca-preco__rotulo").textContent = ligado ? "Lendo a imagem…" : "De uma imagem";
  }
  function mostrarLendo(demorando = false) {
    aviso.hidden = false;
    aviso.className = "busca-preco__aviso busca-preco__aviso--lendo";
    aviso.innerHTML = `\n      <div class="print-lendo">\n        ${miniaturaAtual ? `<img class="print-lendo__miniatura" src="${U.escapeHTML(miniaturaAtual)}" alt="Imagem enviada">` : ""}\n        <p><strong>${demorando ? "Ainda lendo a imagem…" : "Lendo o preço da imagem…"}</strong>\n          ${demorando ? "A leitura está mais lenta que o normal agora. Ainda tentando." : "Procurando o produto, o preço e as condições de pagamento. Leva alguns segundos."}</p>\n      </div>`;
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
    // A galeria pode ter sido aberta antes de conferirImportacao() responder.
    if (!printDisponivel) {
      mostrarErro(EM_DEMO ? NOTA_SEM_IMPORTACAO : MSG_PRINT_SEM_IA);
      return;
    }
    const token = S.emDemo() ? null : await S.tokenAcesso();
    if (!S.emDemo() && !token) {
      mostrarErro("Sua sessão expirou. Entre novamente para importar o preço.");
      return;
    }
    abrirImportar();
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
        mostrarErro("O servidor não respondeu. Você pode digitar o valor ou tentar outra imagem.", {
          titulo: "Não deu para ler o preço desta imagem.",
          origem: "print"
        });
        return;
      }
      if (!dados.ok) {
        // Sem chave, sem demo liberado ou origem recusada: insistir não muda nada.
        if (dados.codigo === "IA_INDISPONIVEL" || dados.codigo === "ORIGEM_NAO_PERMITIDA" || dados.codigo === "SEM_LOGIN" && S.emDemo()) {
          const mensagem = dados.codigo === "SEM_LOGIN" ? NOTA_SEM_IMPORTACAO : MSG_PRINT_SEM_IA;
          desligarPrint();
          mostrarErro(mensagem);
          return;
        }
        if (dados.codigo === "SEM_LOGIN") {
          mostrarErro("Sua sessão expirou. Entre novamente para importar o preço.");
          return;
        }
        mostrarErro([ dados.motivo || "A imagem pode estar cortada ou pouco nítida.", dados.detalhe ].filter(Boolean).join(" "), {
          titulo: "Não deu para ler o preço desta imagem.",
          origem: "print"
        });
        return;
      }
      aplicarResultado({
        ...dados,
        miniatura: miniaturaAtual
      });
    } catch {
      mostrarErro("A conexão caiu no meio da leitura. Você pode digitar o valor ou tentar outra imagem.", {
        titulo: "Não deu para ler o preço desta imagem.",
        origem: "print"
      });
    } finally {
      clearTimeout(demora);
      lendoPrint = false;
      carregandoPrint(false);
    }
  }
  const painelVisivel = () => !document.getElementById("painelCalculo")?.hidden && !document.querySelector(".modal-overlay:not([hidden])");
  mostrarCaminhos();
  if (botaoPrint && entradaPrint) {
    if (!podeLerImagem) {
      // Sem a leitura automática no config, a imagem não tem por onde ir.
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
    }
  }
  if (IA_ATIVA) {
    conferirImportacao();
  }
  // "Nova análise" limpa o formulário: o painel e a categoria escolhida
  // pertenciam ao item anterior.
  document.getElementById("formReality")?.addEventListener("reset", () => {
    if (campoCategoria) {
      [ "escolhida", "confirmada", "origem", "inferida" ].forEach(k => delete campoCategoria.dataset[k]);
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
    host.innerHTML = `\n      <p class="lojas-intro">\n        ${IA_ATIVA ? "A importação abre a página do produto e lê o preço como uma pessoa\n        leria, então funciona em muitas lojas, mas ainda depende de a loja deixar\n        a página ser aberta de fora." : "A importação lê a página do produto e traz o preço. Isso depende de como\n        cada loja monta o site, por isso não funciona em todas."} Em qualquer caso,\n        você pode digitar o valor.\n      </p>\n${printDisponivel ? `\n      <p class="lojas-print">\n        <strong>A imagem resolve em qualquer loja.</strong> Inclusive nas que recusam o\n        link: use <em>De uma imagem</em> com a tela do produto aberta, e o preço é\n        lido direto dela.\n      </p>\n` : ""}\n      <section class="lojas-grupo lojas-grupo--bloqueada">\n        <h4>${IA_ATIVA ? "Raramente funciona" : "Não funciona"}</h4>\n        <p class="lojas-grupo__nota">${IA_ATIVA ? printDisponivel ? "Estas lojas recusam o acesso de fora. Pela página, quase sempre\n          volta sem preço: aqui, use uma imagem da tela." : "Estas lojas recusam o acesso de fora. A importação tenta mesmo\n          assim: se voltar sem preço, digite o valor." : "Nestas lojas, digite o valor."}</p>\n        <ul class="lojas-lista">\n          ${L.BLOQUEADAS.map(l => item(l, true)).join("")}\n        </ul>\n      </section>\n\n      <section class="lojas-grupo lojas-grupo--instavel">\n        <h4>Pode falhar</h4>\n        <p class="lojas-grupo__nota">A importação tenta, mas às vezes volta sem preço.</p>\n        <ul class="lojas-lista">\n          ${L.INSTAVEIS.map(l => item(l, true)).join("")}\n        </ul>\n      </section>\n\n      <section class="lojas-grupo lojas-grupo--provavel">\n        <h4>Costuma funcionar</h4>\n        <ul class="lojas-lista">\n          ${L.PROVAVEIS.map(l => item(l, false)).join("")}\n        </ul>\n      </section>\n\n      <p class="lojas-rodape">\n        O valor trazido é sempre uma sugestão: ele preenche o campo, mas quem\n        confirma é você. Em produto com variação (cor, tamanho) ou preço que muda\n        por CEP, o valor lido pode ser o do item base.\n      </p>`;
  }
  if (abrirLista) {
    abrirLista.addEventListener("click", () => {
      montarModal();
      U.abrirModal("modalLojas");
    });
  }
  document.querySelectorAll('[data-fechar="modalLojas"]').forEach(b => b.addEventListener("click", () => U.fecharModal("modalLojas")));
});
