

/**
 * Classificação das lojas para a busca automática de preço.
 *
 * Este é o único arquivo que precisa ser editado quando uma loja mudar de
 * comportamento. A tela de cálculo e o modal de ajuda leem tudo daqui.
 *
 * Três situações:
 *
 *   bloqueada — não adianta tentar. A busca fica desativada e o usuário
 *               é avisado antes de clicar.
 *   instavel  — a busca tenta, mas pode voltar sem preço.
 *   provavel  — costuma funcionar.
 *
 * O critério não é a loja ser grande ou pequena: é como a página é montada.
 * Loja que entrega o preço no HTML (para aparecer no Google Shopping) funciona.
 * Loja que monta o preço por JavaScript, ou que bloqueia acesso de servidor,
 * não funciona.
 */
window.FinckLojas = (() => {

  const BLOQUEADAS = [
    {
      nome: "Shopee",
      dominios: ["shopee.com.br", "shopee.com", "shp.ee"],
      motivo:
        "A página chega vazia para quem não é um navegador real: o preço é " +
        "carregado depois, por uma API interna assinada. Não há nem preço base " +
        "para ler no HTML.",
    },
    {
      nome: "Amazon",
      dominios: ["amazon.com.br", "amazon.com", "amzn.to", "a.co"],
      motivo:
        "Responde com CAPTCHA para acessos vindos de servidor. Os Termos de Uso " +
        "da Amazon também proíbem leitura automatizada das páginas.",
    },
    {
      nome: "Temu",
      dominios: ["temu.com"],
      motivo:
        "Página montada por JavaScript e proteção anti-robô que exige sessão de " +
        "navegador real.",
    },
    {
      nome: "AliExpress",
      dominios: ["aliexpress.com", "pt.aliexpress.com", "a.aliexpress.com", "aliexpress.us"],
      motivo:
        "Proteção anti-robô do grupo Alibaba. Além disso o preço muda conforme " +
        "moeda, região e cupom aplicado.",
    },
    {
      nome: "SHEIN",
      dominios: ["shein.com", "shein.com.br", "m.shein.com", "br.shein.com"],
      motivo: "Página montada por JavaScript, atrás de proteção anti-robô.",
    },
    {
      nome: "Instagram e Facebook Marketplace",
      dominios: ["instagram.com", "facebook.com", "fb.me", "fb.com", "marketplace.facebook.com"],
      motivo:
        "Exigem login. Não existe página pública de produto com preço para ser lida.",
    },
    {
      nome: "TikTok Shop",
      dominios: ["tiktok.com", "shop.tiktok.com", "vm.tiktok.com"],
      motivo: "Exige login e aplicativo. Sem página pública com preço.",
    },
    {
      nome: "Catálogo do WhatsApp",
      dominios: ["wa.me", "api.whatsapp.com", "whatsapp.com"],
      motivo:
        "O catálogo vive dentro do aplicativo. O link não abre uma página de " +
        "produto com preço.",
    },
    {
      nome: "Kwai Shop",
      dominios: ["kwai.com", "kwai-video.com", "kwaishop.com"],
      motivo: "Loja dentro do aplicativo, sem página pública de produto.",
    },
    {
      nome: "OLX e Facebook de usados",
      dominios: ["olx.com.br"],
      motivo:
        "Anúncio de pessoa física, com proteção anti-robô e preço combinável. " +
        "O valor do anúncio raramente é o valor final.",
    },
  ];

  const INSTAVEIS = [
    {
      nome: "Mercado Livre",
      dominios: ["mercadolivre.com.br", "mercadolibre.com", "mercadolivre.com", "meli.com.br", "mercadolivre.com/sec"],
      motivo:
        "Às vezes responde, às vezes bloqueia o acesso vindo de servidor. " +
        "Quando responde, o preço lido é o do anúncio principal — pode mudar " +
        "conforme vendedor, frete e cupom.",
    },
    {
      nome: "Magazine Luiza",
      dominios: ["magazineluiza.com.br", "magalu.com"],
      motivo:
        "Publica o preço no HTML, mas tem proteção que às vezes barra o acesso.",
    },
    {
      nome: "Americanas, Submarino e Shoptime",
      dominios: ["americanas.com.br", "submarino.com.br", "shoptime.com.br"],
      motivo: "Proteção anti-robô intermitente.",
    },
    {
      nome: "Casas Bahia, Ponto e Extra",
      dominios: ["casasbahia.com.br", "pontofrio.com.br", "extra.com.br"],
      motivo:
        "Publicam o preço no HTML, mas passam por proteção que pode barrar o acesso.",
    },
    {
      nome: "Marketplaces em geral",
      dominios: [],
      motivo:
        "Quando o mesmo produto tem vários vendedores, o preço lido é o da " +
        "oferta em destaque no momento — pode não ser o que você viu.",
      semDominio: true,
    },
  ];

  const PROVAVEIS = [
    {
      nome: "Lojas pequenas e médias",
      dominios: [],
      detalhe:
        "Feitas em Shopify, Nuvemshop, Loja Integrada, Tray ou WooCommerce. " +
        "São a maioria das lojas do Brasil e quase sempre funcionam.",
      semDominio: true,
    },
    {
      nome: "Informática e hardware",
      dominios: ["kabum.com.br", "terabyteshop.com.br", "pichau.com.br"],
      detalhe: "KaBuM!, Terabyte, Pichau.",
    },
    {
      nome: "Moda e esporte",
      dominios: ["netshoes.com.br", "centauro.com.br", "nike.com.br", "adidas.com.br", "lojasrenner.com.br", "riachuelo.com.br", "cea.com.br"],
      detalhe: "Netshoes, Centauro, Nike, Adidas, Renner, Riachuelo, C&A.",
    },
    {
      nome: "Casa, construção e mercado",
      dominios: ["leroymerlin.com.br", "telhanorte.com.br", "carrefour.com.br", "paodeacucar.com", "fastshop.com.br"],
      detalhe: "Leroy Merlin, Telhanorte, Carrefour, Pão de Açúcar, Fast Shop.",
    },
    {
      nome: "Livros e games",
      dominios: ["amazon.com.br.livros", "saraiva.com.br", "store.steampowered.com", "nintendo.com", "playstation.com"],
      detalhe: "Steam, Nintendo eShop, PlayStation Store, livrarias em geral.",
    },
  ];

  const hostDe = (url) => {
    if (!url) return null;
    try {
      const bruto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      return new URL(bruto).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return null;
    }
  };

  const casa = (host, dominios) =>
    (dominios || []).some((d) => host === d || host.endsWith(`.${d}`));

  /**
   * Classifica um link.
   * @returns {{status: "bloqueada"|"instavel"|"provavel"|"desconhecida", loja?: string, motivo?: string, host?: string}}
   */
  function classificar(url) {
    const host = hostDe(url);
    if (!host) return { status: "desconhecida" };

    const bloqueada = BLOQUEADAS.find((l) => casa(host, l.dominios));
    if (bloqueada) {
      return { status: "bloqueada", loja: bloqueada.nome, motivo: bloqueada.motivo, host };
    }

    const instavel = INSTAVEIS.find((l) => !l.semDominio && casa(host, l.dominios));
    if (instavel) {
      return { status: "instavel", loja: instavel.nome, motivo: instavel.motivo, host };
    }

    const provavel = PROVAVEIS.find((l) => !l.semDominio && casa(host, l.dominios));
    if (provavel) {
      return { status: "provavel", loja: provavel.nome, host };
    }

    return { status: "desconhecida", host };
  }

  return { BLOQUEADAS, INSTAVEIS, PROVAVEIS, classificar, hostDe };
})();
