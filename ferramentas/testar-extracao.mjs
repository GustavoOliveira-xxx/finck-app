import { paraNumero, lojaBloqueada, montarPanorama, valoresJsonLd, valoresMeta, valoresMicrodata, valoresRiscados, candidatosTexto, parDePor, descontoAnunciado, parcelasAnunciadas, acharParcelamento, acharAVista, acharFrete } from "../supabase/functions/buscar-preco/index.ts";

const viaJsonLd = h => {
  const r = valoresJsonLd(h);
  return r.valores.length ? {
    preco: r.valores[0],
    moeda: r.moeda ?? "BRL",
    titulo: r.titulo
  } : null;
};

const viaMeta = h => {
  const r = valoresMeta(h);
  return r.valores.length ? {
    preco: r.valores[0],
    moeda: r.moeda ?? "BRL"
  } : null;
};

const viaMicrodata = h => {
  const v = valoresMicrodata(h);
  return v.length ? {
    preco: v[0]
  } : null;
};

const viaTexto = h => {
  const c = candidatosTexto(h);
  return c.length ? {
    preco: c[0].valor
  } : null;
};

const precoRiscado = h => {
  const v = valoresRiscados(h);
  return v.length ? Math.max(...v) : null;
};

let ok = 0, falhou = 0;

const conferir = (titulo, obtido, esperado) => {
  const igual = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (igual) {
    ok++;
    return;
  }
  falhou++;
  console.log(`  FALHOU  ${titulo}`);
  console.log(`          esperado: ${JSON.stringify(esperado)}`);
  console.log(`          obtido:   ${JSON.stringify(obtido)}`);
};

console.log("\nNúmeros em formato brasileiro");

conferir("R$ 1.234,56", paraNumero("1.234,56"), 1234.56);

conferir("R$ 1.299,90", paraNumero("1.299,90"), 1299.9);

conferir("99,90", paraNumero("99,90"), 99.9);

conferir("1.299 (milhar)", paraNumero("1.299"), 1299);

conferir("12.345.678", paraNumero("12.345.678"), 12345678);

conferir("1.234.567,89", paraNumero("1.234.567,89"), 1234567.89);

conferir("1299.90 (JSON-LD)", paraNumero("1299.90"), 1299.9);

conferir("1299 (JSON-LD)", paraNumero("1299"), 1299);

conferir("número puro", paraNumero(1299.9), 1299.9);

conferir("1,234.56 (intl)", paraNumero("1,234.56"), 1234.56);

conferir("zero é inválido", paraNumero("0"), null);

conferir("vazio é inválido", paraNumero(""), null);

conferir("texto é inválido", paraNumero("grátis"), null);

console.log("Dados estruturados");

conferir("JSON-LD simples", viaJsonLd(`\n  <script type="application/ld+json">\n  {"@context":"https://schema.org","@type":"Product","name":"Fone XYZ",\n   "offers":{"@type":"Offer","price":"1299.90","priceCurrency":"BRL"}}\n  <\/script>`), {
  preco: 1299.9,
  moeda: "BRL",
  titulo: "Fone XYZ"
});

conferir("JSON-LD dentro de @graph", viaJsonLd(`\n  <script type="application/ld+json">\n  {"@graph":[{"@type":"WebPage"},\n   {"@type":"Product","name":"Notebook","offers":{"@type":"Offer","price":3499}}]}\n  <\/script>`), {
  preco: 3499,
  moeda: "BRL",
  titulo: "Notebook"
});

conferir("JSON-LD em array", viaJsonLd(`\n  <script type="application/ld+json">\n  [{"@type":"Organization"},{"@type":"Product","name":"Cadeira",\n   "offers":{"price":"850,00","priceCurrency":"BRL"}}]\n  <\/script>`), {
  preco: 850,
  moeda: "BRL",
  titulo: "Cadeira"
});

conferir("AggregateOffer usa lowPrice", viaJsonLd(`\n  <script type="application/ld+json">\n  {"@type":"Product","name":"TV","offers":{"@type":"AggregateOffer",\n   "lowPrice":"2199.00","highPrice":"2599.00","priceCurrency":"BRL"}}\n  <\/script>`), {
  preco: 2199,
  moeda: "BRL",
  titulo: "TV"
});

conferir("JSON-LD quebrado não derruba", viaJsonLd(`\n  <script type="application/ld+json">{isto não é json}<\/script>\n  <script type="application/ld+json">\n  {"@type":"Product","name":"Mesa","offers":{"price":"499.00"}}\n  <\/script>`), {
  preco: 499,
  moeda: "BRL",
  titulo: "Mesa"
});

conferir("moeda estrangeira é preservada", viaJsonLd(`\n  <script type="application/ld+json">\n  {"@type":"Product","name":"Game","offers":{"price":"59.99","priceCurrency":"USD"}}\n  <\/script>`), {
  preco: 59.99,
  moeda: "USD",
  titulo: "Game"
});

conferir("sem produto devolve null", viaJsonLd(`\n  <script type="application/ld+json">{"@type":"WebSite","name":"Loja"}<\/script>`), null);

conferir("meta og:price", viaMeta(`\n  <meta property="og:price:amount" content="1299.90">\n  <meta property="og:price:currency" content="BRL">`), {
  preco: 1299.9,
  moeda: "BRL"
});

conferir("meta com atributos invertidos", viaMeta(`\n  <meta content="750.00" property="product:price:amount">`), {
  preco: 750,
  moeda: "BRL"
});

conferir("microdata", viaMicrodata(`\n  <span itemprop="price" content="329.90">R$ 329,90</span>`), {
  preco: 329.9
});

console.log("Leitura do texto (último recurso)");

conferir("descarta preço riscado e parcela", viaTexto(`\n  <div class="produto">\n    <del>De R$ 1.999,00</del>\n    <span class="price">por R$ 1.299,90</span>\n    <p>ou 12x de R$ 108,32 sem juros</p>\n    <p>Frete: R$ 24,90</p>\n  </div>`), {
  preco: 1299.9
});

conferir("del já fechado não contamina o preço seguinte", viaTexto(`\n  <del>R$ 2.500,00</del> <span class="preco">R$ 1.890,00</span>`), {
  preco: 1890
});

conferir("preço dentro do del é descartado", viaTexto(`\n  <div><del>R$ 2.500,00</del></div>\n  <span class="valor">R$ 1.890,00</span>`), {
  preco: 1890
});

conferir("classe old-price é descartada", viaTexto(`\n  <span class="old-price">R$ 3.000,00</span>\n  <span class="preco-atual">R$ 2.100,00</span>`), {
  preco: 2100
});

conferir("prefere o valor à vista", viaTexto(`\n  <p>10x de R$ 45,90</p>\n  <p class="preco-avista">à vista R$ 459,00</p>`), {
  preco: 459
});

conferir("ignora cashback e cupom", viaTexto(`\n  <span class="valor">R$ 890,00</span>\n  <span>cashback de R$ 89,00</span>\n  <span>cupom de R$ 50,00</span>`), {
  preco: 890
});

conferir("ignora conteúdo de script", viaTexto(`\n  <script>var precoFake = "R$ 1,00";<\/script>\n  <span class="preco">R$ 249,90</span>`), {
  preco: 249.9
});

conferir("página sem preço devolve null", viaTexto(`<p>Produto indisponível</p>`), null);

const PAGINA_REAL = `\n<html><head><title>Fone Bluetooth XYZ | Loja</title></head><body>\n  <nav><span>Frete grátis acima de R$ 199,00</span></nav>\n  <div class="produto">\n    <h1>Fone Bluetooth XYZ</h1>\n    <div class="preco-bloco">\n      <span class="old-price"><del>R$ 899,00</del></span>\n      <span class="preco-venda">R$ 599,00</span>\n      <small>ou 10x de R$ 59,90 sem juros</small>\n      <p class="pix">à vista R$ 569,05 no PIX</p>\n    </div>\n    <p>Frete: R$ 19,90 · Cashback de R$ 30,00</p>\n  </div>\n  <aside class="recomendados">\n    <span class="preco">R$ 129,00</span>\n    <span class="preco">R$ 1.450,00</span>\n  </aside>\n  <footer>Parcelamos em até 12x de R$ 49,91</footer>\n</body></html>`;

const lido = viaTexto(PAGINA_REAL);

const aceitos = [ 599, 569.05 ];

if (aceitos.includes(lido?.preco)) {
  ok++;
} else {
  falhou++;
  console.log(`  FALHOU  página realista`);
  console.log(`          esperado um de: ${aceitos.join(" ou ")}`);
  console.log(`          obtido:   ${JSON.stringify(lido)}`);
}

conferir("JSON-LD vence o texto bagunçado", viaJsonLd(`\n  <script type="application/ld+json">\n  {"@type":"Product","name":"Fone Bluetooth XYZ",\n   "offers":{"price":"599.00","priceCurrency":"BRL"}}<\/script>${PAGINA_REAL}`), {
  preco: 599,
  moeda: "BRL",
  titulo: "Fone Bluetooth XYZ"
});

console.log("Panorama: preço riscado, parcelas, à vista, frete");

conferir("riscado dentro de <del>", precoRiscado(`<del>R$ 439,90</del> <strong>R$ 349,90</strong>`), 439.9);

conferir("riscado por classe", precoRiscado(`<span class="old-price">R$ 2.000,00</span>`), 2e3);

conferir("riscado do Shopify (compare-at)", precoRiscado(`<s class="compare-at-price">R$ 199,00</s>`), 199);

conferir("sem riscado devolve null", precoRiscado(`<span class="preco">R$ 100,00</span>`), null);

conferir("parcelamento sem juros", acharParcelamento(`<p>6 x de R$ 58,32 sem juros</p>`, 349.9), {
  vezes: 6,
  valor: 58.32,
  semJuros: true,
  total: 349.92
});

conferir("banner de outro valor é ignorado", acharParcelamento(`<footer>parcele em até 12x de R$ 49,91</footer>`, 349.9), null);

conferir("parcelamento com juros é aceito", acharParcelamento(`<p>10x de R$ 40,00 com juros</p>`, 349.9), {
  vezes: 10,
  valor: 40,
  semJuros: false,
  total: 400
});

conferir("pix depois do valor", acharAVista(`<p>R$ 339,40 com Pix</p>`, 349.9), {
  valor: 339.4,
  forma: "Pix",
  percentual: 3
});

conferir("pix antes do valor", acharAVista(`<p>no Pix: R$ 320,00</p>`, 400), {
  valor: 320,
  forma: "Pix",
  percentual: 20
});

conferir("valor de outro produto é ignorado", acharAVista(`<p>R$ 20,00 no pix</p>`, 400), null);

conferir("frete grátis com mínimo", acharFrete(`<span>Frete grátis acima de R$ 199,00</span>`), {
  gratis: true,
  minimo: 199
});

conferir("frete grátis sem mínimo", acharFrete(`<span>FRETE GRÁTIS para todo o Brasil</span>`), {
  gratis: true
});

conferir("sem menção a frete", acharFrete(`<p>Produto novo</p>`), null);

console.log("Panorama completo — reprodução da página que falhou (BAPPE)");

const bappe = precoNoJsonLd => `\n<html><head><title>AIR MAX TN PLUS TRIPLE WHITE</title>\n<meta property="og:title" content="AIR MAX TN PLUS TRIPLE WHITE">\n${precoNoJsonLd ? `<script type="application/ld+json">\n{"@type":"Product","name":"AIR MAX TN PLUS TRIPLE WHITE",\n "offers":{"@type":"Offer","price":"${precoNoJsonLd}","priceCurrency":"BRL"}}\n<\/script>` : ""}\n</head><body>\n  <div class="barra-topo">PARCELE EM 6X SEM JUROS</div>\n  <h1>AIR MAX TN PLUS TRIPLE WHITE</h1>\n  <span class="badge">20% OFF</span>\n  <div class="precos">\n    <del class="old-price">R$439,90</del>\n    <strong class="preco-venda">R$349,90</strong>\n    <p class="pix">R$339,40 com Pix</p>\n    <small>6 x de R$58,32 sem juros</small>\n  </div>\n  <p>3% OFF no pix + Envio Prioritário</p>\n</body></html>`;

const p1 = montarPanorama(bappe("439.90"));

conferir("preço atual (JSON-LD trazia o cheio)", p1?.preco, 349.9);

conferir("preço original", p1?.precoOriginal, 439.9);

conferir("desconto", p1?.desconto, {
  valor: 90,
  percentual: 20.5
});

conferir("à vista no Pix", p1?.aVista, {
  valor: 339.4,
  forma: "Pix",
  percentual: 3
});

conferir("parcelamento", p1?.parcelamento, {
  vezes: 6,
  valor: 58.32,
  semJuros: true,
  total: 349.92
});

conferir("confiança alta pelo selo", p1?.confianca, "alta");

const p2 = montarPanorama(bappe("349.90"));

conferir("preço atual (JSON-LD correto)", p2?.preco, 349.9);

conferir("preço original mesmo assim", p2?.precoOriginal, 439.9);

conferir("confiança alta", p2?.confianca, "alta");

const p3 = montarPanorama(bappe(null));

conferir("preço atual só pelo texto", p3?.preco, 349.9);

conferir("original pelo texto", p3?.precoOriginal, 439.9);

console.log("Panorama: campos ausentes não aparecem");

const simples = montarPanorama(`\n  <script type="application/ld+json">\n  {"@type":"Product","name":"Caneca","offers":{"price":"29.90","priceCurrency":"BRL"}}\n  <\/script>\n  <span class="preco">R$ 29,90</span>`);

conferir("preço", simples?.preco, 29.9);

conferir("sem preço original", simples?.precoOriginal, undefined);

conferir("sem desconto", simples?.desconto, undefined);

conferir("sem à vista", simples?.aVista, undefined);

conferir("sem parcelamento", simples?.parcelamento, undefined);

conferir("sem frete", simples?.frete, undefined);

console.log("Modos de falha que derrubavam a versão anterior");

const f1 = montarPanorama(`\n  <script type="application/ld+json">\n  {"@type":"Product","name":"Tênis","offers":{"price":"439.90","priceCurrency":"BRL"}}\n  <\/script>\n  <span class="qualquerNomeEstranho">R$ 439,90</span>\n  <span class="destaque">R$ 349,90</span>\n  <span class="selo">20% OFF</span>`);

conferir("classe desconhecida + selo → preço certo", f1?.preco, 349.9);

conferir("classe desconhecida + selo → original", f1?.precoOriginal, 439.9);

const f2 = montarPanorama(`<p>De R$ 1.200,00 por R$ 899,00</p>`);

conferir("de-por → preço certo", f2?.preco, 899);

conferir("de-por → original", f2?.precoOriginal, 1200);

conferir("de-por tem confiança alta", f2?.confianca, "alta");

const f3 = montarPanorama(`\n  <span style="text-decoration: line-through">R$ 500,00</span>\n  <span class="atual">R$ 400,00</span>`);

conferir("line-through no style → preço certo", f3?.preco, 400);

conferir("line-through no style → original", f3?.precoOriginal, 500);

const f4 = montarPanorama(`\n  <script type="application/ld+json">\n  {"@type":"Product","name":"Mochila","offers":[\n    {"@type":"Offer","price":"259.00","priceCurrency":"BRL"},\n    {"@type":"Offer","price":"199.00","priceCurrency":"BRL"}]}\n  <\/script>`);

conferir("dois preços no JSON-LD → menor vence", f4?.preco, 199);

conferir("dois preços no JSON-LD → original", f4?.precoOriginal, 259);

const f5 = montarPanorama(`\n  <span class="badge">25% OFF</span>\n  <del>R$ 200,00</del> <span>R$ 150,00</span>\n  <p>5% OFF no pix: R$ 142,50</p>`);

conferir("usa o selo do produto, não o do pix", f5?.preco, 150);

conferir("original pelo selo do produto", f5?.precoOriginal, 200);

const f6 = montarPanorama(`\n  <script type="application/ld+json">\n  {"@type":"Product","name":"Caneta","offers":{"price":"12.90","priceCurrency":"BRL"}}\n  <\/script>\n  <span class="preco">R$ 12,90</span>`);

conferir("sem promoção → preço", f6?.preco, 12.9);

conferir("sem promoção → sem original", f6?.precoOriginal, undefined);

conferir("sem promoção → sem desconto", f6?.desconto, undefined);

const f7 = montarPanorama(`\n  <del>R$ 200,00</del><span>R$ 150,00</span><span>25% OFF</span>`, true);

conferir("diagnóstico traz o selo", f7?.diagnostico?.seloDesconto, 25);

conferir("diagnóstico traz os riscados", f7?.diagnostico?.riscados, [ 200 ]);

conferir("sem diagnóstico por padrão", montarPanorama(`<span>R$ 10,00</span>`)?.diagnostico, undefined);

console.log("Segunda página real que falhou (BAPPE Barcelona)");

const barcelona = `\n<html><head><title>AIR MAX TN PLUS BARCELONA</title></head><body>\n  <span class="badge">43% OFF</span>\n  <h1>AIR MAX TN PLUS BARCELONA</h1>\n  <div class="precos">\n    <span class="deee">R$439,90</span>\n    <strong class="agora">R$249,90</strong>\n    <p>R$242,40 com Pix</p>\n    <small>6 x de R$41,65 sem juros</small>\n  </div>\n  <p>3% OFF no pix + Envio Prioritário</p>\n</body></html>`;

const b1 = montarPanorama(barcelona);

conferir("preço não é a parcela", b1?.preco, 249.9);

conferir("original correto", b1?.precoOriginal, 439.9);

conferir("desconto bate com o selo de 43%", Math.round(b1?.desconto?.percentual ?? 0), 43);

conferir("pix identificado", b1?.aVista?.valor, 242.4);

conferir("parcelamento identificado", b1?.parcelamento, {
  vezes: 6,
  valor: 41.65,
  semJuros: true,
  total: 249.9
});

const b2 = montarPanorama(barcelona.replace('<span class="badge">43% OFF</span>', ""));

conferir("sem selo, a parcela ainda aponta o preço", b2?.preco, 249.9);

const b3 = montarPanorama(barcelona.replace('<span class="badge">43% OFF</span>', "").replace("<small>6 x de R$41,65 sem juros</small>", ""));

conferir("sem selo nem parcela, o riscado resolve", b3?.preco, 249.9);

const b4 = montarPanorama(`\n  <span class="badge">10% OFF</span>\n  <del>R$ 500,00</del><span>R$ 200,00</span>`);

conferir("desconto que contradiz o selo é descartado", b4?.precoOriginal, undefined);

conferir("mas o preço continua", b4?.preco, 200);

console.log("Lojas bloqueadas");

conferir("shopee", lojaBloqueada("shopee.com.br"), "Shopee");

conferir("subdomínio shopee", lojaBloqueada("br.shopee.com.br"), "Shopee");

conferir("www.amazon", lojaBloqueada("www.amazon.com.br"), "Amazon");

conferir("encurtador amzn.to", lojaBloqueada("amzn.to"), "Amazon");

conferir("kabum é liberada", lojaBloqueada("kabum.com.br"), null);

conferir("não casa por sufixo solto", lojaBloqueada("naoshopee.com.br"), null);

console.log(`\n${ok} passaram, ${falhou} falharam\n`);

process.exit(falhou ? 1 : 0);
