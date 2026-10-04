// Testa a busca de lugares no Google Maps (api/buscar-preco-ia.js, pedido { locais }).
//
//   node ferramentas/testar-locais.mjs
//     Sem rede: validação do pedido, o prompt de cada tipo, a leitura das
//     fontes do Maps, a ausência de cache e os erros, com o Gemini simulado.
//
//   GEMINI_API_KEY=<chave> node ferramentas/testar-locais.mjs --ao-vivo "<onde>" [tipo] [item]
//     Faz uma busca de verdade. Na chave gratuita o Maps responde poucas
//     vezes por minuto; resposta vazia costuma ser esse limite, não falta de
//     lugar.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AO_VIVO = process.argv.includes("--ao-vivo");

delete process.env.BUSCA_IA_DEMO;
if (!AO_VIVO) {
  delete process.env.GEMINI_MODELO;
}
const api = require("../api/buscar-preco-ia.js");

if (AO_VIVO) {
  const [onde = "Vila Madalena, São Paulo, SP", tipo = "usado", item = ""] = process.argv.slice(process.argv.indexOf("--ao-vivo") + 1);
  const t0 = Date.now();
  const { corpo } = await api.buscarLocais({ chave: process.env.GEMINI_API_KEY, locais: { tipo, item, onde } });
  console.log(`\n${api.promptDosLocais({ tipo, item, onde })}\n${Date.now() - t0}ms`);
  if (!corpo.ok) {
    console.log(`${corpo.codigo}: ${corpo.motivo}\n`);
    process.exit(1);
  }
  for (const l of corpo.lugares) {
    console.log(`- ${l.nome} | ${l.endereco ?? "sem endereço"} | ${l.nota ?? "-"} (${l.avaliacoes ?? 0}) | ${l.mapa}`);
  }
  console.log(`\n${corpo.lugares.length} lugares, via ${corpo.modelo}\n`);
  process.exit(0);
}

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

console.log("\nPedido");

conferir("pedido completo", api.lerPedidoLocais({ tipo: "reparo", item: " celular ", onde: "Vila Madalena, São Paulo" }), { tipo: "reparo", item: "celular", onde: "Vila Madalena, São Paulo" });

conferir("tipo fora da lista é recusado", Boolean(api.lerPedidoLocais({ tipo: "festa", onde: "Centro" }).erro), true);

conferir("sem onde é recusado", Boolean(api.lerPedidoLocais({ tipo: "doacao" }).erro), true);

conferir("item é opcional", api.lerPedidoLocais({ tipo: "descarte", onde: "Centro, Osasco" }).item, null);

console.log("Prompt de cada tipo");

conferir("conserto com item, em texto livre", api.promptDosLocais({ tipo: "reparo", item: "celular", onde: "Largo do Taboão, Taboão da Serra" }), "Liste até 6 lugares que consertam celular perto de Largo do Taboão, Taboão da Serra, com endereço.");

conferir("descarte sem item", api.promptDosLocais({ tipo: "descarte", item: null, onde: "Centro" }), "Liste até 6 ecopontos e pontos de coleta seletiva perto de Centro, com endereço.");

conferir("o prompt não pede JSON (com JSON o modelo responde de memória)", /json/i.test(api.promptDosLocais({ tipo: "usado", onde: "Centro" })), false);

console.log("Leitura das fontes do Maps");

// Fontes no formato que o Gemini devolveu em 04/10/2026.
const fonte = (titulo, uri, linhas, placeId) => ({
  maps: { uri, title: `${titulo} - Google Maps`, text: `**Title:** ${titulo}\n\n**About:**\n\n${linhas.map((l) => `* ${l}`).join("\n")}`, ...(placeId ? { placeId } : {}) },
});

const fontes = [
  fonte("Peça Rara Vila Madalena", "https://maps.google.com/maps?cid=1", [
    "**Address:** R. Delfina, 94 - Vila Madalena, São Paulo - SP, 05443-010, Brazil",
    "**Rating:** 3.9 (66 reviews)",
    "**Phone:** +55 11 96858-6870",
    "**Website:** https://instagram.com/pecarara.vilamadalena",
    "**Description:** Brechó com roupas femininas.",
  ], "places/ChIJabc123"),
  fonte("Brechó Pechinchei", "https://maps.google.com/maps?cid=2", [
    "**Address:** R. Medeiros de Albuquerque, 144 - Jardim das Bandeiras, São Paulo - SP, 05436-060, Brazil",
    "**Rating:** 5 (1,673 reviews)",
  ]),
  fonte("Brechó Pechinchei", "https://maps.google.com/maps?cid=2", []),
  { web: { uri: "https://exemplo.com", title: "Página" } },
  fonte("Sem link", "javascript:alert(1)", []),
];

const lugares = api.lugaresDasFontes(fontes);

conferir("só fontes do Maps, com link seguro e sem repetir", lugares.map((l) => l.nome), [ "Peça Rara Vila Madalena", "Brechó Pechinchei" ]);

conferir("endereço sem o país", lugares[0].endereco, "R. Delfina, 94 - Vila Madalena, São Paulo - SP, 05443-010");

conferir("nota e número de avaliações", [ lugares[0].nota, lugares[0].avaliacoes, lugares[1].avaliacoes ], [ 3.9, 66, 1673 ]);

conferir("telefone, site e descrição", [ lugares[0].telefone, lugares[0].site, lugares[0].descricao ], [ "+55 11 96858-6870", "https://instagram.com/pecarara.vilamadalena", "Brechó com roupas femininas." ]);

conferir("placeId sem o prefixo places/", lugares[0].placeId, "ChIJabc123");

conferir("o link é o da fonte, para a atribuição", lugares[1].mapa, "https://maps.google.com/maps?cid=2");

conferir("no máximo seis lugares", api.lugaresDasFontes(Array.from({ length: 9 }, (_, i) => fonte(`Lugar ${i}`, `https://maps.google.com/maps?cid=${i}`, []))).length, 6);

console.log("Busca com o Gemini simulado");

const chamadas = [];

let roteiro = [];

const resposta = (status, corpo) => new Response(JSON.stringify(corpo), {
  status,
  headers: { "Content-Type": "application/json" },
});

const comFontes = (lista) => ({
  candidates: [ { content: { parts: [ { text: "Aqui estão alguns lugares." } ] }, groundingMetadata: { groundingChunks: lista } } ],
});

globalThis.fetch = async (url, opcoes) => {
  const alvo = String(url);
  if (alvo.includes("/auth/v1/user")) return resposta(200, { id: "usuario-teste" });
  chamadas.push({ url: alvo, corpo: JSON.parse(opcoes.body) });
  const proxima = roteiro.shift();
  if (!proxima) throw new Error("chamada ao Gemini que o teste não esperava");
  return proxima();
};

const pedido = { tipo: "usado", item: "roupas", onde: "Vila Madalena, São Paulo" };

roteiro = [ () => resposta(200, comFontes(fontes)) ];

let r = await api.buscarLocais({ chave: "teste", locais: pedido });

conferir("lugares saem das fontes", [ r.status, r.corpo.ok, r.corpo.fonte, r.corpo.lugares.length ], [ 200, true, "google-maps", 2 ]);

conferir("vai com a ferramenta do Maps e sem esquema", [ chamadas[0].corpo.tools, chamadas[0].corpo.generationConfig.responseSchema ], [ [ { googleMaps: {} } ], undefined ]);

roteiro = [ () => resposta(200, comFontes(fontes)) ];

chamadas.length = 0;

r = await api.buscarLocais({ chave: "teste", locais: pedido });

conferir("a mesma busca não sai de cache (os termos proíbem guardar)", chamadas.length, 1);

roteiro = [ () => resposta(200, { candidates: [ { content: { parts: [ { text: "1. **Loja X**, Rua Y, 10 (de memória)" } ] } } ] }) ];

r = await api.buscarLocais({ chave: "teste", locais: pedido });

conferir("texto sem fonte do Maps vira SEM_LUGARES, e nada inventado aparece", [ r.corpo.ok, r.corpo.codigo ], [ false, "SEM_LUGARES" ]);

roteiro = [ 429, 503, 429 ].map((s) => () => resposta(s, { error: { message: "cheio" } }));

r = await api.buscarLocais({ chave: "teste", locais: pedido });

conferir("todos sobrecarregados viram IA_OCUPADA", [ r.status, r.corpo.codigo ], [ 503, "IA_OCUPADA" ]);

chamadas.length = 0;

r = await api.buscarLocais({ chave: "teste", locais: { tipo: "reparo" } });

conferir("pedido sem onde nem chega ao Gemini", [ r.status, r.corpo.codigo, chamadas.length ], [ 400, "BUSCA_INVALIDA", 0 ]);

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

let h = await rota({ locais: pedido });

conferir("sem login, com a demo desligada, é recusado", [ h.statusCode, h.corpo.codigo ], [ 401, "SEM_LOGIN" ]);

roteiro = [ () => resposta(200, comFontes(fontes)) ];

h = await rota({ locais: pedido }, { authorization: "Bearer teste" });

conferir("com login, devolve os lugares", [ h.statusCode, h.corpo.ok, h.corpo.lugares[0].nome ], [ 200, true, "Peça Rara Vila Madalena" ]);

delete process.env.GEMINI_API_KEY;

console.log(`\n${ok} passaram, ${falhou} falharam\n`);

process.exit(falhou ? 1 : 0);
