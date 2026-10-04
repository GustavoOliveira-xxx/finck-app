// Testa a estimativa de impacto ambiental (api/buscar-preco-ia.js, pedido { impacto }).
//
//   node ferramentas/testar-impacto.mjs
//     Sem rede: validação do pedido, limpeza do que o modelo devolve, cache,
//     erros e a rota HTTP, com o Gemini simulado.
//
//   GEMINI_API_KEY=<chave> node ferramentas/testar-impacto.mjs --ao-vivo [modelo]
//     Pede a estimativa de verdade para itens com ordem de grandeza conhecida
//     e confere se a faixa devolvida encosta na de referência. Gasta uma
//     chamada por item.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AO_VIVO = process.argv.includes("--ao-vivo");

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
  const CHAVE = process.env.GEMINI_API_KEY;
  if (!CHAVE) {
    console.error("Defina GEMINI_API_KEY para o modo --ao-vivo.");
    process.exit(1);
  }
  const modelo = process.argv.find((a) => a.startsWith("gemini-"));
  if (modelo) process.env.GEMINI_MODELO = modelo;

  // Ordens de grandeza publicadas em relatórios ambientais de fabricantes e
  // em estudos de ciclo de vida. A faixa da IA precisa encostar nesta; não
  // precisa ser igual, porque modelos e marcas variam.
  const ITENS = [
    { item: "Smartphone Samsung Galaxy A55 5G 256GB", categoria: "Eletrônicos", preco: 2129.05, carbono: [40, 120], fabricacaoMin: 0.6, residuo: "eletrônico", agua: false },
    { item: "Notebook 15 polegadas Intel Core i5 16GB", categoria: "Eletrônicos", preco: 3899, carbono: [150, 500], fabricacaoMin: 0.5, residuo: "eletrônico", agua: false },
    { item: "Camiseta básica de algodão", categoria: "Vestuário", preco: 49.9, carbono: [2, 15], residuo: "têxtil", agua: [1500, 4000] },
    { item: "Calça jeans masculina", categoria: "Vestuário", preco: 159.9, carbono: [10, 40], residuo: "têxtil", agua: [2000, 10000] },
    { item: "Tênis de corrida", categoria: "Vestuário", preco: 499.9, carbono: [8, 20], agua: false },
    { item: "Presente", categoria: "Outros", preco: 100, avaliavel: false },
  ];

  const encosta = (faixa, [min, max]) => Boolean(faixa) && faixa.min <= max && faixa.max >= min;

  console.log("\nEstimando o impacto de itens com referência conhecida\n");
  for (const ref of ITENS) {
    const t0 = Date.now();
    const { corpo: c } = await api.estimarImpacto({ chave: CHAVE, impacto: ref });
    const ms = Date.now() - t0;
    const problemas = [];
    if (ref.avaliavel === false) {
      if (c.ok) problemas.push("devia recusar item vago");
    } else if (!c.ok) {
      problemas.push(`sem estimativa: ${c.codigo} ${c.detalhe ?? c.motivo}`);
    } else {
      if (!encosta(c.carbono, ref.carbono)) problemas.push(`carbono ${c.carbono.min}-${c.carbono.max} longe de ${ref.carbono.join("-")}`);
      if (ref.fabricacaoMin && !(c.fracaoFabricacao >= ref.fabricacaoMin)) problemas.push(`fabricação ${c.fracaoFabricacao}`);
      if (ref.residuo && c.residuo !== ref.residuo) problemas.push(`resíduo ${c.residuo}`);
      if (ref.agua === false && c.agua) problemas.push(`água inventada ${c.agua.min}-${c.agua.max}`);
      if (Array.isArray(ref.agua) && !encosta(c.agua, ref.agua)) problemas.push(`água ${c.agua ? `${c.agua.min}-${c.agua.max}` : "ausente"}`);
    }
    if (problemas.length) falhou++; else ok++;
    const resumo = c.ok ? `${c.carbono.min}-${c.carbono.max} kg CO2e${c.agua ? ` · ${c.agua.min}-${c.agua.max} L` : ""} · ${c.modelo}` : c.codigo;
    console.log(`${ref.item.slice(0, 38).padEnd(40)}${String(ms).padStart(6)}ms  ${problemas.length ? `FALHOU ${problemas.join("; ")}` : "ok"}  [${resumo}]`);
    await new Promise((r) => setTimeout(r, Number(process.env.PAUSA || 1200)));
  }
  console.log(`\n${ok} de ${ITENS.length} dentro da referência\n`);
  process.exit(falhou ? 1 : 0);
}

// ---------------------------------------------------------------- sem rede

console.log("\nPedido");

conferir("item e categoria limpos", api.lerPedidoImpacto({ item: "  Fone \n Bluetooth ", categoria: "Eletrônicos<b>" }), { item: "Fone Bluetooth", categoria: "Eletrônicosb", preco: null });

conferir("preço em texto vira número", api.lerPedidoImpacto({ item: "Fone", preco: "R$ 249,90" }).preco, 249.9);

conferir("item curto demais é recusado", Boolean(api.lerPedidoImpacto({ item: "x" }).erro), true);

conferir("sem item é recusado", Boolean(api.lerPedidoImpacto({}).erro), true);

conferir("o prompt leva item, categoria e preço", [ "Produto: Fone Bluetooth", "Categoria no app: Eletrônicos", "R$ 249,90" ].every((t) => api.promptDoImpacto({ item: "Fone Bluetooth", categoria: "Eletrônicos", preco: 249.9 }).includes(t)), true);

conferir("e a matriz elétrica brasileira", api.promptDoImpacto({ item: "Air fryer" }).includes("matriz elétrica brasileira"), true);

conferir("o esquema decide \"avaliavel\" por último", api.esquemaDoImpacto().propertyOrdering.at(-1), "avaliavel");

console.log("Limpeza da estimativa");

const base = { avaliavel: true, confianca: "alta", carbono: { min: 50, max: 90 } };

conferir("sem avaliavel não há estimativa", api.montarImpacto({ ...base, avaliavel: false }), null);

conferir("sem carbono não há estimativa", api.montarImpacto({ ...base, carbono: null }), null);

conferir("faixa invertida é desvirada", api.montarImpacto({ ...base, carbono: { min: 90, max: 50 } }).carbono, { min: 50, max: 90 });

conferir("dois algarismos significativos, sem precisão falsa", api.montarImpacto({ ...base, carbono: { min: 43.7, max: 2734 } }).carbono, { min: 44, max: 2700 });

conferir("valor pequeno guarda a casa decimal", api.montarImpacto({ ...base, carbono: { min: 0.84, max: 1.26 } }).carbono, { min: 0.84, max: 1.3 });

conferir("carbono zero ou negativo é recusado", api.montarImpacto({ ...base, carbono: { min: 0, max: 10 } }), null);

conferir("fração em porcentagem vira fração", api.montarImpacto({ ...base, fracaoFabricacao: 80 }).fracaoFabricacao, 0.8);

conferir("fração impossível vira null", api.montarImpacto({ ...base, fracaoFabricacao: 250 }).fracaoFabricacao, null);

conferir("água acima do plausível vira null", api.montarImpacto({ ...base, agua: { min: 1, max: 99999999 } }).agua, null);

conferir("vida útil acima de 50 anos vira null", api.montarImpacto({ ...base, vidaUtilMeses: { min: 12, max: 1200 } }).vidaUtilMeses, null);

conferir("etapa e resíduo fora da lista viram null", [ api.montarImpacto({ ...base, etapaPrincipal: "marketing" }).etapaPrincipal, api.montarImpacto({ ...base, residuo: "radioativo" }).residuo ], [ null, null ]);

conferir("no máximo três dicas, como frases", api.montarImpacto({ ...base, dicas: [ " use capa ", "Doe.", "", "repare", "d" ] }).dicas, [ "Use capa.", "Doe.", "Repare." ]);

conferir("descarte e reparo também viram frase", [ api.montarImpacto({ ...base, descarte: "leve a um ecoponto" }).descarte, api.montarImpacto({ ...base, reparo: { nivel: "medio", texto: "bateria tem troca" } }).reparo.texto ], [ "Leve a um ecoponto.", "Bateria tem troca." ]);

conferir("reparo com nível fora da lista sai", api.montarImpacto({ ...base, reparo: { nivel: "talvez", texto: "x" } }).reparo, null);

conferir("confiança desconhecida vira média", api.montarImpacto({ ...base, confianca: "total" }).confianca, "media");

conferir("método é ia-impacto", api.montarImpacto(base).metodo, "ia-impacto");

console.log("Estimativa com o Gemini simulado");

const chamadas = [];

let roteiro = [];

const resposta = (status, corpo) => new Response(JSON.stringify(corpo), {
  status,
  headers: { "Content-Type": "application/json" },
});

const lido = (obj) => ({ candidates: [ { content: { parts: [ { text: JSON.stringify(obj) } ] } } ] });

globalThis.fetch = async (url, opcoes) => {
  const alvo = String(url);
  if (alvo.includes("/auth/v1/user")) return resposta(200, { id: "usuario-teste" });
  chamadas.push({ url: alvo, corpo: JSON.parse(opcoes.body) });
  const proxima = roteiro.shift();
  if (!proxima) throw new Error("chamada ao Gemini que o teste não esperava");
  return proxima();
};

const celular = { item: "Smartphone Galaxy A55", categoria: "Eletrônicos", preco: 2129.05 };

roteiro = [
  () => resposta(429, { error: { message: "cota" } }),
  () => resposta(200, lido({ ...base, tipo: "smartphone", fracaoFabricacao: 0.8, residuo: "eletrônico", vidaUtilMeses: { min: 36, max: 60 } })),
];

let r = await api.estimarImpacto({ chave: "teste", impacto: celular });

conferir("429 no primeiro modelo passa para o segundo", [ r.status, r.corpo.ok, r.corpo.carbono, r.corpo.modelo ], [ 200, true, { min: 50, max: 90 }, "gemini-3.5-flash" ]);

conferir("vai com saída estruturada e sem ferramenta", [ chamadas[0].corpo.generationConfig.responseMimeType, chamadas[0].corpo.tools ], [ "application/json", undefined ]);

chamadas.length = 0;

r = await api.estimarImpacto({ chave: "teste", impacto: { ...celular, preco: 1999 } });

conferir("o mesmo item por outro preço sai do cache", [ r.corpo.tipo, chamadas.length ], [ "smartphone", 0 ]);

roteiro = [ 429, 503, 429 ].map((s) => () => resposta(s, { error: { message: "cheio" } }));

r = await api.estimarImpacto({ chave: "teste", impacto: { item: "Geladeira frost free" } });

conferir("todos sobrecarregados viram IA_OCUPADA", [ r.status, r.corpo.codigo ], [ 503, "IA_OCUPADA" ]);

roteiro = [ () => resposta(200, lido({ avaliavel: false, confianca: "baixa", motivo: "\"Presente\" é vago demais." })) ];

r = await api.estimarImpacto({ chave: "teste", impacto: { item: "Presente" } });

conferir("item vago vira SEM_ESTIMATIVA com o motivo da IA", [ r.corpo.codigo, r.corpo.detalhe ], [ "SEM_ESTIMATIVA", "\"Presente\" é vago demais." ]);

chamadas.length = 0;

r = await api.estimarImpacto({ chave: "teste", impacto: { item: "" } });

conferir("item vazio nem chega ao Gemini", [ r.status, r.corpo.codigo, chamadas.length ], [ 400, "ITEM_INVALIDO", 0 ]);

console.log("Rota HTTP");

const rota = async (body, headers = {}) => {
  const res = {
    statusCode: 0,
    corpo: null,
    setHeader() {},
    status(c) { this.statusCode = c; return this; },
    send(b) { this.corpo = JSON.parse(b); return this; },
    end() { return this; },
  };
  await api({ method: "POST", headers, body, socket: {} }, res);
  return res;
};

process.env.GEMINI_API_KEY = "teste";

let h = await rota({ impacto: celular });

conferir("sem login, com a demo desligada, é recusado", [ h.statusCode, h.corpo.codigo ], [ 401, "SEM_LOGIN" ]);

h = await rota({ impacto: celular }, { authorization: "Bearer teste" });

conferir("com login, devolve a estimativa", [ h.statusCode, h.corpo.ok, h.corpo.metodo ], [ 200, true, "ia-impacto" ]);

delete process.env.GEMINI_API_KEY;

console.log(`\n${ok} passaram, ${falhou} falharam\n`);

process.exit(falhou ? 1 : 0);
