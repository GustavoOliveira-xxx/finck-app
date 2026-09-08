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
  const TEXTOS = IA_ATIVA ? {
    bloqueada: c => `<strong>${U.escapeHTML(c.loja)} dificulta a leitura de fora.</strong> ` + `A busca por IA vai tentar mesmo assim, mas aqui ela costuma voltar sem preço. ` + `Se voltar, digite o valor manualmente.`,
    instavel: c => `<strong>${U.escapeHTML(c.loja)}:</strong> a busca por IA lê a página, mas nesta loja ` + `pode voltar sem preço. ${U.escapeHTML(c.motivo)}`,
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
    if (d.aVista) {
      linhas.push([ `À vista${d.aVista.forma === "Pix" ? " no Pix" : d.aVista.forma === "boleto" ? " no boleto" : ""}`, `${U.moeda(d.aVista.valor)}<span class="panorama__off">−${Math.floor(d.aVista.percentual)}%</span>` ]);
    }
    if (d.parcelamento) {
      const p = d.parcelamento;
      linhas.push([ "Parcelado", `${p.vezes}x de ${U.moeda(p.valor)}` + `<span class="panorama__juros">${p.semJuros ? "sem juros" : `com juros · total ${U.moeda(p.total)}`}</span>` ]);
    }
    if (d.frete) {
      linhas.push([ "Frete", d.frete.minimo ? `grátis acima de ${U.moeda(d.frete.minimo)}` : "grátis, segundo a página" ]);
    }
    const selo = d.desconto ? `<span class="panorama__selo">${Math.floor(d.desconto.percentual)}% OFF</span>` : "";
    const de = d.precoOriginal ? `<p class="panorama__de">de <s>${U.moeda(d.precoOriginal)}</s> · você economiza\n         <strong>${U.moeda(d.desconto.valor)}</strong></p>` : "";
    const trocarPix = d.aVista ? `<button type="button" class="panorama__troca" data-preco="${d.aVista.valor}">\n           Usar o preço ${d.aVista.forma === "Pix" ? "do Pix" : "à vista"} (${U.moeda(d.aVista.valor)})\n         </button>` : "";
    return `\n      <div class="panorama">\n        <div class="panorama__cabecalho">\n          ${d.titulo ? `<p class="panorama__item">${U.escapeHTML(d.titulo)}</p>` : ""}\n          ${d.loja ? `<span class="panorama__loja">${U.escapeHTML(d.loja)}</span>` : ""}\n        </div>\n\n        <div class="panorama__valor">\n          <strong>${U.moeda(d.preco)}</strong>${selo}\n        </div>\n        ${de}\n\n        ${linhas.length ? `<dl class="panorama__linhas">${linhas.map(([rotulo, valor]) => `\n          <div><dt>${rotulo}</dt><dd>${valor}</dd></div>`).join("")}</dl>` : ""}\n\n        ${trocarPix ? `<div class="panorama__acoes">${trocarPix}</div>` : ""}\n        <p class="panorama__nota">${avisoConfianca(d)}</p>\n      </div>`;
  }
  function avisoConfianca(d) {
    if (d.moeda && d.moeda !== "BRL") {
      return `Atenção: o preço está em ${U.escapeHTML(d.moeda)}, não em reais. Converta antes de salvar.`;
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
      U.escreverMoeda("itemPrice", dados.preco);
      const campoNome = document.getElementById("itemName");
      if (campoNome && !campoNome.value.trim() && dados.titulo) {
        campoNome.value = String(dados.titulo).slice(0, 80);
      }
      mostrarResultado(dados);
      U.toast("Preço preenchido. Confira antes de analisar.", "sucesso");
    } catch {
      mostrarErro("Falha de conexão. Verifique sua internet e tente de novo.");
    } finally {
      carregando(false);
    }
  });
  function montarModal() {
    const host = document.getElementById("conteudoLojas");
    if (!host) {
      return;
    }
    const item = (l, mostrarMotivo) => `\n      <li>\n        <strong>${U.escapeHTML(l.nome)}</strong>\n        ${mostrarMotivo && l.motivo ? `<p>${U.escapeHTML(l.motivo)}</p>` : ""}\n        ${l.detalhe ? `<p>${U.escapeHTML(l.detalhe)}</p>` : ""}\n      </li>`;
    host.innerHTML = `\n      <p class="lojas-intro">\n        ${IA_ATIVA ? "A busca manda a IA abrir a página do produto e ler o preço.\n        Ela entende a página como um leitor humano, então funciona em muito\n        mais loja do que antes — mas ainda depende de a loja deixar a página\n        ser aberta de fora." : "A busca lê a página do produto e traz o preço. Isso depende de como cada\n        loja monta o site — por isso não funciona em todas."} Em qualquer caso,\n        você pode digitar o valor manualmente.\n      </p>\n\n      <section class="lojas-grupo lojas-grupo--bloqueada">\n        <h4>${IA_ATIVA ? "Raramente funciona" : "Não funciona"}</h4>\n        <p class="lojas-grupo__nota">${IA_ATIVA ? "Estas lojas recusam o acesso de fora, inclusive o da IA. O botão\n          continua liberado — se voltar sem preço, digite o valor." : "O botão fica desativado nestas lojas."}</p>\n        <ul class="lojas-lista">\n          ${L.BLOQUEADAS.map(l => item(l, true)).join("")}\n        </ul>\n      </section>\n\n      <section class="lojas-grupo lojas-grupo--instavel">\n        <h4>Pode falhar</h4>\n        <p class="lojas-grupo__nota">A busca tenta, mas às vezes volta sem preço.</p>\n        <ul class="lojas-lista">\n          ${L.INSTAVEIS.map(l => item(l, true)).join("")}\n        </ul>\n      </section>\n\n      <section class="lojas-grupo lojas-grupo--provavel">\n        <h4>Costuma funcionar</h4>\n        <ul class="lojas-lista">\n          ${L.PROVAVEIS.map(l => item(l, false)).join("")}\n        </ul>\n      </section>\n\n      <p class="lojas-rodape">\n        O valor trazido é sempre uma sugestão: ele preenche o campo, mas quem\n        confirma é você. Em produto com variação (cor, tamanho) ou preço que muda\n        por CEP, o valor lido pode ser o do item base.\n      </p>`;
  }
  if (abrirLista) {
    abrirLista.addEventListener("click", () => {
      montarModal();
      U.abrirModal("modalLojas");
    });
  }
  document.querySelectorAll('[data-fechar="modalLojas"]').forEach(b => b.addEventListener("click", () => U.fecharModal("modalLojas")));
});
