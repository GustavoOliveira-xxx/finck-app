// Testa a leitura de preço pelo print (api/buscar-preco-ia.js).
//
//   node ferramentas/testar-print.mjs
//     Sem rede: validação da imagem, conferências do panorama, a passagem
//     entre os modelos, a rota HTTP e a conferência de parcelas que a busca
//     pelo link também usa, com o Gemini e as páginas simulados.
//
//   GEMINI_API_KEY=<chave> node ferramentas/testar-print.mjs --ao-vivo [modelo]
//     Lê os prints de ferramentas/prints-exemplo com o Gemini de verdade e
//     compara com esperado.json. Gasta uma chamada por print. No plano
//     gratuito o gemini-3.5-flash aceita 5 por minuto e 20 por dia: para
//     testar só ele, use PAUSA=13000.
//
//   FINCK_API=https://finck-app.vercel.app FINCK_TOKEN=<jwt> \
//     node ferramentas/testar-print.mjs --ao-vivo
//     O mesmo, contra o deploy, passando pelo login e pelos limites. O token é
//     o de `await FinckStore.tokenAcesso()` no console do app logado.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PASTA = new URL("./prints-exemplo/", import.meta.url);
const AO_VIVO = process.argv.includes("--ao-vivo");

// O handler lê BUSCA_IA_DEMO ao carregar; os testes da rota esperam a demo
// desligada, que é o padrão do deploy.
delete process.env.BUSCA_IA_DEMO;
if (!AO_VIVO) {
  delete process.env.GEMINI_MODELO;
}
const api = require("../api/buscar-preco-ia.js");

let ok = 0, falhou = 0;

const conferir = (titulo, obtido, esperado) => {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) {
    ok++;
    return;
  }
  falhou++;
  console.log(`  FALHOU  ${titulo}`);
  console.log(`          esperado: ${JSON.stringify(esperado)}`);
  console.log(`          obtido:   ${JSON.stringify(obtido)}`);
};

// ------------------------------------------------------------------ ao vivo

if (AO_VIVO) {
  const esperado = JSON.parse(readFileSync(new URL("esperado.json", PASTA), "utf8"));
  const API = process.env.FINCK_API?.replace(/\/$/, "");
  const TOKEN = process.env.FINCK_TOKEN;
  const CHAVE = process.env.GEMINI_API_KEY;
  if (!API && !CHAVE) {
    console.error("Defina GEMINI_API_KEY (função local) ou FINCK_API e FINCK_TOKEN (deploy).");
    process.exit(1);
  }
  const modelo = process.argv.find((a) => a.startsWith("gemini-"));
  if (modelo) process.env.GEMINI_MODELO = modelo;
  const PAUSA = Number(process.env.PAUSA || 1500);

  const ler = async (arquivo) => {
    const imagem = `data:image/jpeg;base64,${readFileSync(new URL(arquivo, PASTA)).toString("base64")}`;
    const t0 = Date.now();
    if (API) {
      const r = await fetch(`${API}/api/buscar-preco-ia`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        },
        body: JSON.stringify({ imagem }),
      });
      const corpo = await r.json().catch(() => ({ ok: false, motivo: `HTTP ${r.status}` }));
      return { ms: Date.now() - t0, corpo };
    }
    const r = await api.lerPrint({ chave: CHAVE, imagem });
    return { ms: Date.now() - t0, corpo: r.corpo };
  };

  const diferencas = (e, c) => {
    if (e.encontrado === false) return c.ok ? [`devia recusar, leu ${c.preco}`] : [];
    if (!c.ok) return [`sem preço: ${c.codigo} ${c.detalhe ?? c.motivo ?? ""}`];
    const lista = [];
    const umDe = (v) => (Array.isArray(v) ? v : [v ?? null]);
    if (c.preco !== e.preco) lista.push(`preço ${c.preco}`);
    if (c.moeda !== e.moeda) lista.push(`moeda ${c.moeda}`);
    if (!umDe(e.precoOriginal).includes(c.precoOriginal ?? null)) lista.push(`riscado ${c.precoOriginal}`);
    if ((e.pix ?? null) !== (c.aVista?.valor ?? null)) lista.push(`pix ${c.aVista?.valor}`);
    const parcelas = c.parcelamento ? [c.parcelamento.vezes, c.parcelamento.valor] : null;
    if (JSON.stringify(parcelas) !== JSON.stringify(e.parcelas ?? null)) lista.push(`parcelas ${JSON.stringify(parcelas)}`);
    const faixa = c.faixa ? [c.faixa.min, c.faixa.max] : null;
    if (JSON.stringify(faixa) !== JSON.stringify(e.faixa ?? null)) lista.push(`faixa ${JSON.stringify(faixa)}`);
    if (e.frete && !c.frete?.gratis) lista.push("frete grátis não lido");
    if (!e.categoria.includes(c.categoria)) lista.push(`categoria ${c.categoria}`);
    return lista;
  };

  const arquivos = Object.keys(esperado).filter((k) => !k.startsWith("_"));
  console.log(`\nLendo ${arquivos.length} prints ${API ? `pelo deploy ${API}` : "pela função local"}\n`);
  const tempos = [];
  for (const arquivo of arquivos) {
    const { ms, corpo } = await ler(arquivo);
    tempos.push(ms);
    const lista = diferencas(esperado[arquivo], corpo);
    if (lista.length) falhou++; else ok++;
    const quem = corpo.modelo ? ` · ${corpo.modelo}` : "";
    console.log(`${arquivo.padEnd(18)}${String(ms).padStart(6)}ms  ${lista.length ? `FALHOU ${lista.join("; ")}` : "ok"}${quem}`);
    await new Promise((r) => setTimeout(r, PAUSA));
  }
  tempos.sort((a, b) => a - b);
  console.log(`\n${ok} de ${arquivos.length} certos · mediana ${tempos[Math.floor(tempos.length / 2)]}ms\n`);
  process.exit(falhou ? 1 : 0);
}

// ---------------------------------------------------------------- sem rede

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(200, 1)]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(200, 1)]);
const heic = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypheic"), Buffer.alloc(200, 1)]);
const dataUrl = (tipo, bytes) => `data:${tipo};base64,${bytes.toString("base64")}`;
const recusa = (bruta) => Boolean(api.lerImagem(bruta).erro);

console.log("\nValidação da imagem");

conferir("jpeg aceito", api.lerImagem(dataUrl("image/jpeg", jpeg)).mime, "image/jpeg");

conferir("image/jpg vira image/jpeg", api.lerImagem(dataUrl("image/jpg", jpeg)).mime, "image/jpeg");

conferir("png aceito", api.lerImagem(dataUrl("image/png", png)).mime, "image/png");

conferir("webp aceito", api.lerImagem(dataUrl("image/webp", webp)).mime, "image/webp");

conferir("heic aceito", api.lerImagem(dataUrl("image/heic", heic)).mime, "image/heic");

conferir("gif fica de fora", recusa(dataUrl("image/gif", jpeg)), true);

conferir("pdf com nome de png é recusado", recusa(dataUrl("image/png", Buffer.from(`%PDF-1.4${"x".repeat(200)}`))), true);

conferir("jpeg declarado como png é recusado", recusa(dataUrl("image/png", jpeg)), true);

conferir("base64 corrompido é recusado", recusa("data:image/jpeg;base64,@@@@"), true);

conferir("link no lugar da imagem é recusado", recusa("https://exemplo.com/print.jpg"), true);

conferir("objeto no lugar do texto é recusado", recusa({ dados: "x" }), true);

conferir("acima de 3 MB é recusado", /grande demais/.test(api.lerImagem(dataUrl("image/jpeg", Buffer.concat([jpeg, Buffer.alloc(3 * 1024 * 1024)]))).erro), true);

console.log("Categorias");

conferir("sem lista, usa a do app", api.categoriasDoPedido(undefined).length, 9);

conferir("limpa, tira repetida e descarta o que não é texto", api.categoriasDoPedido([ "  Lazer ", "Lazer", "Casa<b>", 3, "" ]), [ "Lazer", "Casab" ]);

conferir("lista vazia volta à do app", api.categoriasDoPedido([]).length, 9);

conferir("a lista vai no esquema como enum", api.esquemaDoPrint([ "Lazer", "Outros" ]).properties.categoria.enum, [ "Lazer", "Outros" ]);

conferir("e no prompt, com a dica", api.promptDoPrint([ "Moradia" ]).includes("- Moradia (móveis, eletrodomésticos"), true);

console.log("Conferências do panorama");

const base = { encontrado: true, confianca: "alta", moeda: "BRL" };

const faixa = api.montarPanoramaDoPrint({ ...base, preco: 39.9, precoMaximo: 59.9, precoOriginal: 57 });

conferir("faixa por variação vira min e max", faixa.faixa, { min: 39.9, max: 59.9 });

conferir("faixa baixa a confiança para média", faixa.confianca, "media");

conferir("riscado do começo da faixa fica", faixa.precoOriginal, 57);

const faixaTrocada = api.montarPanoramaDoPrint({ ...base, preco: 39.9, precoMaximo: 59.9, precoOriginal: 85.57 });

conferir("riscado do topo da faixa sai, e o desconto junto", [ faixaTrocada.precoOriginal, faixaTrocada.desconto ], [ undefined, undefined ]);

conferir("parcela que fecha com o preço é sem juros", api.montarPanoramaDoPrint({ ...base, preco: 189.9, parcelamento: { vezes: 6, valor: 31.65, semJuros: false } }).parcelamento.semJuros, true);

conferir("\"sem juros\" que não fecha com o preço sai", api.montarPanoramaDoPrint({ ...base, preco: 39.9, parcelamento: { vezes: 2, valor: 29.95, semJuros: true } }).parcelamento, undefined);

conferir("com juros acima do preço fica", api.montarPanoramaDoPrint({ ...base, preco: 999, parcelamento: { vezes: 12, valor: 99.9, semJuros: false } }).parcelamento, { vezes: 12, valor: 99.9, semJuros: false, total: 1198.8 });

conferir("parcelas que somam menos que o preço saem", api.montarPanoramaDoPrint({ ...base, preco: 500, parcelamento: { vezes: 10, valor: 20, semJuros: false } }).parcelamento, undefined);

conferir("categoria fora da lista é ignorada", api.montarPanoramaDoPrint({ ...base, preco: 10, categoria: "Brinquedos" }).categoria, undefined);

const completo = api.montarPanoramaDoPrint({ ...base, preco: 10, categoria: "Lazer", nomeCurto: "  Bola \n de futebol ", loja: "Loja\u0007X" });

conferir("categoria da lista entra", completo.categoria, "Lazer");

conferir("nome curto chega limpo", completo.nomeCurto, "Bola de futebol");

conferir("loja sem caractere de controle", completo.loja, "Loja X");

conferir("método é ia-print", completo.metodo, "ia-print");

conferir("encontrado=false não vira preço", api.montarPanoramaDoPrint({ ...base, encontrado: false, preco: 10 }), null);

conferir("preço em dólar continua em dólar", api.montarPanoramaDoPrint({ ...base, preco: 23.45, moeda: "USD" }).moeda, "USD");

console.log("Passagem entre os modelos (Gemini simulado)");

const chamadas = [];

let roteiro = [];

const resposta = (status, corpo) => new Response(JSON.stringify(corpo), {
  status,
  headers: { "Content-Type": "application/json" },
});

const lido = (obj) => ({ candidates: [ { content: { parts: [ { text: JSON.stringify(obj) } ] } } ] });

// Páginas de loja que a busca pelo link baixa na segunda etapa.
const paginas = {};

globalThis.fetch = async (url, opcoes) => {
  const alvo = String(url);
  if (alvo.includes("/auth/v1/user")) return resposta(200, { id: "usuario-teste" });
  if (!alvo.includes("generativelanguage.googleapis.com")) {
    const pagina = paginas[alvo];
    return pagina ? pagina() : new Response("não encontrada", { status: 404 });
  }
  chamadas.push({ url: alvo, corpo: JSON.parse(opcoes.body) });
  const proxima = roteiro.shift();
  if (!proxima) throw new Error("chamada ao Gemini que o teste não esperava");
  return proxima();
};

const imagemDe = (marca) => dataUrl("image/jpeg", Buffer.concat([ jpeg, Buffer.from(marca) ]));

roteiro = [
  () => resposta(429, { error: { message: "cota" } }),
  () => resposta(200, lido({ ...base, preco: 99.9, titulo: "Fone", nomeCurto: "Fone", categoria: "Eletrônicos" })),
];

let r = await api.lerPrint({ chave: "teste", imagem: imagemDe("a") });

conferir("429 no primeiro modelo passa para o segundo", [ r.status, r.corpo.ok, r.corpo.preco ], [ 200, true, 99.9 ]);

conferir("ordem dos modelos", chamadas.map((c) => c.url.match(/models\/([^:]+)/)[1]), [ "gemini-3.5-flash-lite", "gemini-3.5-flash" ]);

conferir("a imagem vai como inline_data", chamadas[0].corpo.contents[0].parts[0].inline_data.mime_type, "image/jpeg");

conferir("com saída estruturada", chamadas[0].corpo.generationConfig.responseMimeType, "application/json");

conferir("e sem ferramenta", chamadas[0].corpo.tools, undefined);

conferir("a resposta diz qual modelo leu", r.corpo.modelo, "gemini-3.5-flash");

chamadas.length = 0;

r = await api.lerPrint({ chave: "teste", imagem: imagemDe("a") });

conferir("a mesma imagem sai do cache, sem nova chamada", [ r.corpo.preco, chamadas.length ], [ 99.9, 0 ]);

roteiro = [ 429, 503, 429 ].map((s) => () => resposta(s, { error: { message: "cheio" } }));

r = await api.lerPrint({ chave: "teste", imagem: imagemDe("b") });

conferir("todos sobrecarregados viram IA_OCUPADA", [ r.status, r.corpo.codigo ], [ 503, "IA_OCUPADA" ]);

roteiro = [ () => resposta(400, { error: { message: "Unable to process input image." } }) ];

r = await api.lerPrint({ chave: "teste", imagem: imagemDe("c") });

conferir("imagem que o Gemini não abre vira IMAGEM_INVALIDA", [ r.status, r.corpo.codigo ], [ 400, "IMAGEM_INVALIDA" ]);

roteiro = [ () => resposta(200, lido({ encontrado: false, confianca: "alta", motivo: "É um carrinho com vários produtos." })) ];

r = await api.lerPrint({ chave: "teste", imagem: imagemDe("d") });

conferir("sem produto vira SEM_PRECO com o motivo da IA", [ r.corpo.codigo, r.corpo.detalhe ], [ "SEM_PRECO", "É um carrinho com vários produtos." ]);

chamadas.length = 0;

r = await api.lerPrint({ chave: "teste", imagem: "data:image/gif;base64,R0lGODlh" });

conferir("imagem recusada nem chega ao Gemini", [ r.status, r.corpo.codigo, chamadas.length ], [ 400, "IMAGEM_INVALIDA", 0 ]);

console.log("Rota HTTP");

const rota = async (method, body, headers = {}) => {
  const res = {
    statusCode: 0,
    cabecalhos: {},
    corpo: null,
    setHeader(k, v) { this.cabecalhos[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    send(b) { this.corpo = JSON.parse(b); return this; },
    end() { return this; },
  };
  await api({ method, headers, body, socket: {} }, res);
  return res;
};

process.env.GEMINI_API_KEY = "teste";

let h = await rota("GET");

conferir("GET diz se a IA e a demo estão ligadas", h.corpo, { ok: true, ia: true, demo: false, print: true, impacto: true });

conferir("e não fica em cache", h.cabecalhos["cache-control"], "no-store");

h = await rota("POST", { imagem: imagemDe("e") });

conferir("print sem login, com a demo desligada, é recusado", [ h.statusCode, h.corpo.codigo ], [ 401, "SEM_LOGIN" ]);

console.log("Busca pelo link: parcela que não fecha com o preço");

const comLogin = { authorization: "Bearer teste" };

const lidoDaUrl = (obj) => ({
  candidates: [ {
    content: { parts: [ { text: JSON.stringify(obj) } ] },
    urlContextMetadata: { urlMetadata: [ { urlRetrievalStatus: "URL_RETRIEVAL_STATUS_SUCCESS" } ] },
  } ],
});

// IP público no lugar do nome: a conferência de endereço não depende de DNS.
const loja = "https://93.184.216.34/produto";

roteiro = [ () => resposta(200, lidoDaUrl({ encontrado: true, confianca: "alta", preco: 189.9, parcelamento: { vezes: 6, valor: 31.65, semJuros: false } })) ];

chamadas.length = 0;

h = await rota("POST", { url: `${loja}/1` }, comLogin);

conferir("parcela que fecha sai na primeira etapa, como sem juros", [ h.corpo.metodo, h.corpo.parcelamento?.semJuros, chamadas.length ], [ "ia-url", true, 1 ]);

paginas[`${loja}/2`] = () => new Response("<html><title>Mouse</title><body>R$ 204,48 em 8x de R$ 25,56</body></html>", {
  status: 200,
  headers: { "content-type": "text/html; charset=utf-8" },
});

roteiro = [
  () => resposta(200, lidoDaUrl({ encontrado: true, confianca: "alta", preco: 488.62, parcelamento: { vezes: 8, valor: 25.56, semJuros: true } })),
  () => resposta(200, lido({ encontrado: true, confianca: "alta", preco: 204.48, parcelamento: { vezes: 8, valor: 25.56, semJuros: true } })),
];

h = await rota("POST", { url: `${loja}/2` }, comLogin);

conferir("parcela que não fecha manda para a página baixada", [ h.corpo.preco, h.corpo.metodo, h.corpo.confianca ], [ 204.48, "ia-html", "alta" ]);

roteiro = [ () => resposta(200, lidoDaUrl({ encontrado: true, confianca: "alta", preco: 527.64, parcelamento: { vezes: 10, valor: 36.99, semJuros: true } })) ];

h = await rota("POST", { url: `${loja}/3` }, comLogin);

conferir("sem página para baixar, entrega o primeiro com confiança baixa", [ h.corpo.preco, h.corpo.metodo, h.corpo.confianca ], [ 527.64, "ia-url", "baixa" ]);

conferir("e sem a parcela que não fechava", h.corpo.parcelamento, undefined);

delete process.env.GEMINI_API_KEY;

h = await rota("GET");

conferir("GET sem chave avisa que não há IA", h.corpo.ia, false);

console.log(`\n${ok} passaram, ${falhou} falharam\n`);

process.exit(falhou ? 1 : 0);
