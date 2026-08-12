

/**
 * Busca automática do preço a partir do link do produto.
 *
 * A ideia: o valor trazido é sempre uma sugestão. Ele preenche o campo de
 * preço, o usuário confere e pode corrigir. Nada é salvo automaticamente —
 * a decisão continua sendo dele, que é o ponto do FinCK of Reality.
 */
document.addEventListener("DOMContentLoaded", () => {
  const U = window.FinckUtils;
  const S = window.FinckStore;
  const L = window.FinckLojas;
  const cfg = window.FINCK_CONFIG;

  const campoLink = document.getElementById("itemLink");
  const botao = document.getElementById("btnBuscarPreco");
  const aviso = document.getElementById("avisoLoja");
  const abrirLista = document.getElementById("btnLojasSuportadas");
  if (!campoLink || !botao || !aviso) return;

  const ENDPOINT = `${cfg.SUPABASE_URL}/functions/v1/buscar-preco`;

  /* ---------------------------------------------------------------- *
   * Aviso conforme a loja detectada no link
   * ---------------------------------------------------------------- */
  const TEXTOS = {
    bloqueada: (c) =>
      `<strong>${U.escapeHTML(c.loja)} não permite busca automática.</strong> ` +
      `${U.escapeHTML(c.motivo)} Digite o valor manualmente.`,
    instavel: (c) =>
      `<strong>${U.escapeHTML(c.loja)}:</strong> a busca pode não encontrar o preço. ` +
      `${U.escapeHTML(c.motivo)}`,
    provavel: () => `Busca disponível para esta loja.`,
    desconhecida: () =>
      `Loja não catalogada. Vale tentar — se não achar, é só digitar o valor.`,
  };

  let classificacao = { status: "desconhecida" };

  function avaliarLink() {
    const valor = campoLink.value.trim();

    if (!valor) {
      classificacao = { status: "desconhecida" };
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

    const bloqueada = status === "bloqueada";
    botao.disabled = bloqueada;
    botao.classList.toggle("busca-preco__botao--bloqueado", bloqueada);
  }

  campoLink.addEventListener("input", avaliarLink);
  campoLink.addEventListener("paste", () => setTimeout(avaliarLink, 0));
  avaliarLink();

  /* ---------------------------------------------------------------- *
   * A busca
   * ---------------------------------------------------------------- */
  function carregando(ligado) {
    botao.disabled = ligado || classificacao.status === "bloqueada";
    botao.classList.toggle("busca-preco__botao--carregando", ligado);
    botao.querySelector(".busca-preco__rotulo").textContent =
      ligado ? "Buscando…" : "Buscar preço do link";
  }

  /**
   * O painel do que foi encontrado.
   *
   * Só entra linha que existe: página sem parcelamento não mostra parcelamento,
   * produto sem promoção não mostra preço riscado. Nada de "—" ou "não
   * informado" ocupando espaço.
   */
  function montarPainel(d) {
    const linhas = [];

    if (d.aVista) {
      linhas.push([
        `À vista${d.aVista.forma === "Pix" ? " no Pix" : d.aVista.forma === "boleto" ? " no boleto" : ""}`,
        `${U.moeda(d.aVista.valor)}<span class="panorama__off">−${Math.floor(d.aVista.percentual)}%</span>`,
      ]);
    }

    if (d.parcelamento) {
      const p = d.parcelamento;
      linhas.push([
        "Parcelado",
        `${p.vezes}x de ${U.moeda(p.valor)}` +
        `<span class="panorama__juros">${p.semJuros ? "sem juros" : `com juros · total ${U.moeda(p.total)}`}</span>`,
      ]);
    }

    if (d.frete) {
      linhas.push([
        "Frete",
        d.frete.minimo
          ? `grátis acima de ${U.moeda(d.frete.minimo)}`
          : "grátis, segundo a página",
      ]);
    }

    // Trunca em vez de arredondar: é assim que as lojas anunciam o selo
    // (439,90 → 349,90 dá 20,4%, e a loja estampa "20% OFF"). Arredondar
    // mostraria 21% e brigaria com o que está na tela da loja.
    const selo = d.desconto
      ? `<span class="panorama__selo">${Math.floor(d.desconto.percentual)}% OFF</span>`
      : "";

    const de = d.precoOriginal
      ? `<p class="panorama__de">de <s>${U.moeda(d.precoOriginal)}</s> · você economiza
         <strong>${U.moeda(d.desconto.valor)}</strong></p>`
      : "";

    const trocarPix = d.aVista
      ? `<button type="button" class="panorama__troca" data-preco="${d.aVista.valor}">
           Usar o preço ${d.aVista.forma === "Pix" ? "do Pix" : "à vista"} (${U.moeda(d.aVista.valor)})
         </button>`
      : "";

    return `
      <div class="panorama">
        <div class="panorama__cabecalho">
          ${d.titulo ? `<p class="panorama__item">${U.escapeHTML(d.titulo)}</p>` : ""}
          ${d.loja ? `<span class="panorama__loja">${U.escapeHTML(d.loja)}</span>` : ""}
        </div>

        <div class="panorama__valor">
          <strong>${U.moeda(d.preco)}</strong>${selo}
        </div>
        ${de}

        ${linhas.length ? `<dl class="panorama__linhas">${linhas.map(([rotulo, valor]) => `
          <div><dt>${rotulo}</dt><dd>${valor}</dd></div>`).join("")}</dl>` : ""}

        ${trocarPix ? `<div class="panorama__acoes">${trocarPix}</div>` : ""}
        <p class="panorama__nota">${avisoConfianca(d)}</p>
      </div>`;
  }

  function avisoConfianca(d) {
    if (d.moeda && d.moeda !== "BRL") {
      return `Atenção: o preço está em ${U.escapeHTML(d.moeda)}, não em reais. Converta antes de salvar.`;
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

  function mostrarErro(motivo) {
    aviso.hidden = false;
    aviso.className = "busca-preco__aviso busca-preco__aviso--erro";
    aviso.textContent = motivo;
  }

  botao.addEventListener("click", async () => {
    const url = campoLink.value.trim();
    if (!url) return;

    if (S.emDemo()) {
      mostrarErro("A busca de preço precisa de uma conta cadastrada. No modo demonstração, digite o valor manualmente.");
      return;
    }

    const token = await S.tokenAcesso();
    if (!token) {
      mostrarErro("Sua sessão expirou. Entre novamente para usar a busca.");
      return;
    }

    carregando(true);
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": cfg.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ url }),
      });

      const dados = await r.json().catch(() => null);

      if (!dados) {
        mostrarErro("Não consegui falar com o servidor de busca. Tente de novo em instantes.");
        return;
      }
      if (!dados.ok) {
        mostrarErro(dados.motivo || "Não encontrei o preço nessa página.");
        return;
      }

      U.escreverMoeda("itemPrice", dados.preco);

      // só preenche o nome se o usuário ainda não escreveu nada
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

  /* ---------------------------------------------------------------- *
   * Modal com a lista de lojas
   * ---------------------------------------------------------------- */
  function montarModal() {
    const host = document.getElementById("conteudoLojas");
    if (!host) return;

    const item = (l, mostrarMotivo) => `
      <li>
        <strong>${U.escapeHTML(l.nome)}</strong>
        ${mostrarMotivo && l.motivo ? `<p>${U.escapeHTML(l.motivo)}</p>` : ""}
        ${l.detalhe ? `<p>${U.escapeHTML(l.detalhe)}</p>` : ""}
      </li>`;

    host.innerHTML = `
      <p class="lojas-intro">
        A busca lê a página do produto e traz o preço. Isso depende de como cada
        loja monta o site — por isso não funciona em todas. Em qualquer caso,
        você pode digitar o valor manualmente.
      </p>

      <section class="lojas-grupo lojas-grupo--bloqueada">
        <h4>Não funciona</h4>
        <p class="lojas-grupo__nota">O botão fica desativado nestas lojas.</p>
        <ul class="lojas-lista">
          ${L.BLOQUEADAS.map((l) => item(l, true)).join("")}
        </ul>
      </section>

      <section class="lojas-grupo lojas-grupo--instavel">
        <h4>Pode falhar</h4>
        <p class="lojas-grupo__nota">A busca tenta, mas às vezes volta sem preço.</p>
        <ul class="lojas-lista">
          ${L.INSTAVEIS.map((l) => item(l, true)).join("")}
        </ul>
      </section>

      <section class="lojas-grupo lojas-grupo--provavel">
        <h4>Costuma funcionar</h4>
        <ul class="lojas-lista">
          ${L.PROVAVEIS.map((l) => item(l, false)).join("")}
        </ul>
      </section>

      <p class="lojas-rodape">
        O valor trazido é sempre uma sugestão: ele preenche o campo, mas quem
        confirma é você. Em produto com variação (cor, tamanho) ou preço que muda
        por CEP, o valor lido pode ser o do item base.
      </p>`;
  }

  if (abrirLista) {
    abrirLista.addEventListener("click", () => {
      montarModal();
      U.abrirModal("modalLojas");
    });
  }

  // fecha o modal mesmo se ligarModais() não tiver rodado nesta página
  document.querySelectorAll('[data-fechar="modalLojas"]').forEach((b) =>
    b.addEventListener("click", () => U.fecharModal("modalLojas")),
  );
});
