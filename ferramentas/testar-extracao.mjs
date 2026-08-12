/**
 * Testa a leitura de preço sem depender de rede nem de loja no ar.
 *
 *   node --experimental-strip-types ferramentas/testar-extracao.mjs
 *
 * Importa as funções direto do index.ts que vai para o Supabase — então o
 * que passa aqui é exatamente o código publicado, não uma cópia.
 */

import {
  paraNumero, viaJsonLd, viaMeta, viaMicrodata, viaTexto, lojaBloqueada,
  precoRiscado, acharParcelamento, acharAVista, acharFrete, montarPanorama,
} from "../supabase/functions/buscar-preco/index.ts";

let ok = 0, falhou = 0;

const conferir = (titulo, obtido, esperado) => {
  const igual = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (igual) { ok++; return; }
  falhou++;
  console.log(`  FALHOU  ${titulo}`);
  console.log(`          esperado: ${JSON.stringify(esperado)}`);
  console.log(`          obtido:   ${JSON.stringify(obtido)}`);
};

/* ---------------------------------------------------------------- */
console.log("\nNúmeros em formato brasileiro");

conferir("R$ 1.234,56",      paraNumero("1.234,56"),   1234.56);
conferir("R$ 1.299,90",      paraNumero("1.299,90"),   1299.90);
conferir("99,90",            paraNumero("99,90"),      99.90);
conferir("1.299 (milhar)",   paraNumero("1.299"),      1299);
conferir("12.345.678",       paraNumero("12.345.678"), 12345678);
conferir("1.234.567,89",     paraNumero("1.234.567,89"), 1234567.89);
conferir("1299.90 (JSON-LD)", paraNumero("1299.90"),   1299.90);
conferir("1299 (JSON-LD)",   paraNumero("1299"),       1299);
conferir("número puro",      paraNumero(1299.9),       1299.9);
conferir("1,234.56 (intl)",  paraNumero("1,234.56"),   1234.56);
conferir("zero é inválido",  paraNumero("0"),          null);
conferir("vazio é inválido", paraNumero(""),           null);
conferir("texto é inválido", paraNumero("grátis"),     null);

/* ---------------------------------------------------------------- */
console.log("Dados estruturados");

conferir("JSON-LD simples", viaJsonLd(`
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Product","name":"Fone XYZ",
   "offers":{"@type":"Offer","price":"1299.90","priceCurrency":"BRL"}}
  </script>`), { preco: 1299.90, moeda: "BRL", titulo: "Fone XYZ" });

conferir("JSON-LD dentro de @graph", viaJsonLd(`
  <script type="application/ld+json">
  {"@graph":[{"@type":"WebPage"},
   {"@type":"Product","name":"Notebook","offers":{"@type":"Offer","price":3499}}]}
  </script>`), { preco: 3499, moeda: "BRL", titulo: "Notebook" });

conferir("JSON-LD em array", viaJsonLd(`
  <script type="application/ld+json">
  [{"@type":"Organization"},{"@type":"Product","name":"Cadeira",
   "offers":{"price":"850,00","priceCurrency":"BRL"}}]
  </script>`), { preco: 850, moeda: "BRL", titulo: "Cadeira" });

conferir("AggregateOffer usa lowPrice", viaJsonLd(`
  <script type="application/ld+json">
  {"@type":"Product","name":"TV","offers":{"@type":"AggregateOffer",
   "lowPrice":"2199.00","highPrice":"2599.00","priceCurrency":"BRL"}}
  </script>`), { preco: 2199, moeda: "BRL", titulo: "TV" });

conferir("JSON-LD quebrado não derruba", viaJsonLd(`
  <script type="application/ld+json">{isto não é json}</script>
  <script type="application/ld+json">
  {"@type":"Product","name":"Mesa","offers":{"price":"499.00"}}
  </script>`), { preco: 499, moeda: "BRL", titulo: "Mesa" });

conferir("moeda estrangeira é preservada", viaJsonLd(`
  <script type="application/ld+json">
  {"@type":"Product","name":"Game","offers":{"price":"59.99","priceCurrency":"USD"}}
  </script>`), { preco: 59.99, moeda: "USD", titulo: "Game" });

conferir("sem produto devolve null", viaJsonLd(`
  <script type="application/ld+json">{"@type":"WebSite","name":"Loja"}</script>`), null);

conferir("meta og:price", viaMeta(`
  <meta property="og:price:amount" content="1299.90">
  <meta property="og:price:currency" content="BRL">`), { preco: 1299.90, moeda: "BRL" });

conferir("meta com atributos invertidos", viaMeta(`
  <meta content="750.00" property="product:price:amount">`), { preco: 750, moeda: "BRL" });

conferir("microdata", viaMicrodata(`
  <span itemprop="price" content="329.90">R$ 329,90</span>`), { preco: 329.90 });

/* ---------------------------------------------------------------- */
console.log("Leitura do texto (último recurso)");

conferir("descarta preço riscado e parcela", viaTexto(`
  <div class="produto">
    <del>De R$ 1.999,00</del>
    <span class="price">por R$ 1.299,90</span>
    <p>ou 12x de R$ 108,32 sem juros</p>
    <p>Frete: R$ 24,90</p>
  </div>`), { preco: 1299.90 });

conferir("del já fechado não contamina o preço seguinte", viaTexto(`
  <del>R$ 2.500,00</del> <span class="preco">R$ 1.890,00</span>`), { preco: 1890 });

conferir("preço dentro do del é descartado", viaTexto(`
  <div><del>R$ 2.500,00</del></div>
  <span class="valor">R$ 1.890,00</span>`), { preco: 1890 });

conferir("classe old-price é descartada", viaTexto(`
  <span class="old-price">R$ 3.000,00</span>
  <span class="preco-atual">R$ 2.100,00</span>`), { preco: 2100 });

conferir("prefere o valor à vista", viaTexto(`
  <p>10x de R$ 45,90</p>
  <p class="preco-avista">à vista R$ 459,00</p>`), { preco: 459 });

conferir("ignora cashback e cupom", viaTexto(`
  <span class="valor">R$ 890,00</span>
  <span>cashback de R$ 89,00</span>
  <span>cupom de R$ 50,00</span>`), { preco: 890 });

conferir("ignora conteúdo de script", viaTexto(`
  <script>var precoFake = "R$ 1,00";</script>
  <span class="preco">R$ 249,90</span>`), { preco: 249.90 });

conferir("página sem preço devolve null", viaTexto(`<p>Produto indisponível</p>`), null);

// Página parecida com uma de loja real: preço antigo, parcela, pix, frete,
// recomendados e rodapé. É o cenário em que "pegar o primeiro R$" erra.
const PAGINA_REAL = `
<html><head><title>Fone Bluetooth XYZ | Loja</title></head><body>
  <nav><span>Frete grátis acima de R$ 199,00</span></nav>
  <div class="produto">
    <h1>Fone Bluetooth XYZ</h1>
    <div class="preco-bloco">
      <span class="old-price"><del>R$ 899,00</del></span>
      <span class="preco-venda">R$ 599,00</span>
      <small>ou 10x de R$ 59,90 sem juros</small>
      <p class="pix">à vista R$ 569,05 no PIX</p>
    </div>
    <p>Frete: R$ 19,90 · Cashback de R$ 30,00</p>
  </div>
  <aside class="recomendados">
    <span class="preco">R$ 129,00</span>
    <span class="preco">R$ 1.450,00</span>
  </aside>
  <footer>Parcelamos em até 12x de R$ 49,91</footer>
</body></html>`;

// Sem dados estruturados, o melhor resultado possível é o preço à vista/PIX
// ou o de venda — nunca o riscado, a parcela, o frete ou o recomendado.
const lido = viaTexto(PAGINA_REAL);
const aceitos = [599, 569.05];
if (aceitos.includes(lido?.preco)) {
  ok++;
} else {
  falhou++;
  console.log(`  FALHOU  página realista`);
  console.log(`          esperado um de: ${aceitos.join(" ou ")}`);
  console.log(`          obtido:   ${JSON.stringify(lido)}`);
}

// A mesma página com JSON-LD: aí não há dúvida nenhuma.
conferir("JSON-LD vence o texto bagunçado", viaJsonLd(`
  <script type="application/ld+json">
  {"@type":"Product","name":"Fone Bluetooth XYZ",
   "offers":{"price":"599.00","priceCurrency":"BRL"}}</script>${PAGINA_REAL}`),
  { preco: 599, moeda: "BRL", titulo: "Fone Bluetooth XYZ" });

/* ---------------------------------------------------------------- */
console.log("Panorama: preço riscado, parcelas, à vista, frete");

conferir("riscado dentro de <del>",
  precoRiscado(`<del>R$ 439,90</del> <strong>R$ 349,90</strong>`), 439.90);

conferir("riscado por classe",
  precoRiscado(`<span class="old-price">R$ 2.000,00</span>`), 2000);

conferir("riscado do Shopify (compare-at)",
  precoRiscado(`<s class="compare-at-price">R$ 199,00</s>`), 199);

conferir("sem riscado devolve null",
  precoRiscado(`<span class="preco">R$ 100,00</span>`), null);

conferir("parcelamento sem juros",
  acharParcelamento(`<p>6 x de R$ 58,32 sem juros</p>`, 349.90),
  { vezes: 6, valor: 58.32, semJuros: true, total: 349.92 });

conferir("banner de outro valor é ignorado",
  acharParcelamento(`<footer>parcele em até 12x de R$ 49,91</footer>`, 349.90), null);

conferir("parcelamento com juros é aceito",
  acharParcelamento(`<p>10x de R$ 40,00 com juros</p>`, 349.90),
  { vezes: 10, valor: 40, semJuros: false, total: 400 });

conferir("pix depois do valor",
  acharAVista(`<p>R$ 339,40 com Pix</p>`, 349.90),
  { valor: 339.40, forma: "Pix", percentual: 3 });

conferir("pix antes do valor",
  acharAVista(`<p>no Pix: R$ 320,00</p>`, 400),
  { valor: 320, forma: "Pix", percentual: 20 });

conferir("valor de outro produto é ignorado",
  acharAVista(`<p>R$ 20,00 no pix</p>`, 400), null);

conferir("frete grátis com mínimo",
  acharFrete(`<span>Frete grátis acima de R$ 199,00</span>`), { gratis: true, minimo: 199 });

conferir("frete grátis sem mínimo",
  acharFrete(`<span>FRETE GRÁTIS para todo o Brasil</span>`), { gratis: true });

conferir("sem menção a frete",
  acharFrete(`<p>Produto novo</p>`), null);

/* ---------------------------------------------------------------- */
console.log("Panorama completo — reprodução da página que falhou (BAPPE)");

// Estrutura da loja do print: banner de parcelamento no topo, preço riscado
// coladinho no preço válido, preço do Pix e parcelamento.
const bappe = (precoNoJsonLd) => `
<html><head><title>AIR MAX TN PLUS TRIPLE WHITE</title>
<meta property="og:title" content="AIR MAX TN PLUS TRIPLE WHITE">
${precoNoJsonLd ? `<script type="application/ld+json">
{"@type":"Product","name":"AIR MAX TN PLUS TRIPLE WHITE",
 "offers":{"@type":"Offer","price":"${precoNoJsonLd}","priceCurrency":"BRL"}}
</script>` : ""}
</head><body>
  <div class="barra-topo">PARCELE EM 6X SEM JUROS</div>
  <h1>AIR MAX TN PLUS TRIPLE WHITE</h1>
  <span class="badge">20% OFF</span>
  <div class="precos">
    <del class="old-price">R$439,90</del>
    <strong class="preco-venda">R$349,90</strong>
    <p class="pix">R$339,40 com Pix</p>
    <small>6 x de R$58,32 sem juros</small>
  </div>
  <p>3% OFF no pix + Envio Prioritário</p>
</body></html>`;

// Cenário 1 — a loja publica o preço CHEIO no JSON-LD (a causa do erro do print)
const p1 = montarPanorama(bappe("439.90"));
conferir("preço atual (JSON-LD trazia o cheio)", p1?.preco, 349.90);
conferir("preço original", p1?.precoOriginal, 439.90);
conferir("desconto", p1?.desconto, { valor: 90, percentual: 20.5 });
conferir("à vista no Pix", p1?.aVista, { valor: 339.40, forma: "Pix", percentual: 3 });
conferir("parcelamento", p1?.parcelamento, { vezes: 6, valor: 58.32, semJuros: true, total: 349.92 });
conferir("confiança rebaixada por reconciliação", p1?.confianca, "media");

// Cenário 2 — a loja publica o preço promocional correto no JSON-LD
const p2 = montarPanorama(bappe("349.90"));
conferir("preço atual (JSON-LD correto)", p2?.preco, 349.90);
conferir("preço original mesmo assim", p2?.precoOriginal, 439.90);
conferir("confiança alta", p2?.confianca, "alta");

// Cenário 3 — sem dado estruturado nenhum
const p3 = montarPanorama(bappe(null));
conferir("preço atual só pelo texto", p3?.preco, 349.90);
conferir("original pelo texto", p3?.precoOriginal, 439.90);

/* ---------------------------------------------------------------- */
console.log("Panorama: campos ausentes não aparecem");

const simples = montarPanorama(`
  <script type="application/ld+json">
  {"@type":"Product","name":"Caneca","offers":{"price":"29.90","priceCurrency":"BRL"}}
  </script>
  <span class="preco">R$ 29,90</span>`);

conferir("preço", simples?.preco, 29.90);
conferir("sem preço original", simples?.precoOriginal, undefined);
conferir("sem desconto", simples?.desconto, undefined);
conferir("sem à vista", simples?.aVista, undefined);
conferir("sem parcelamento", simples?.parcelamento, undefined);
conferir("sem frete", simples?.frete, undefined);

/* ---------------------------------------------------------------- */
console.log("Lojas bloqueadas");

conferir("shopee",            lojaBloqueada("shopee.com.br"),      "Shopee");
conferir("subdomínio shopee", lojaBloqueada("br.shopee.com.br"),   "Shopee");
conferir("www.amazon",        lojaBloqueada("www.amazon.com.br"),  "Amazon");
conferir("encurtador amzn.to", lojaBloqueada("amzn.to"),           "Amazon");
conferir("kabum é liberada",  lojaBloqueada("kabum.com.br"),       null);
conferir("não casa por sufixo solto", lojaBloqueada("naoshopee.com.br"), null);

/* ---------------------------------------------------------------- */
console.log(`\n${ok} passaram, ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
