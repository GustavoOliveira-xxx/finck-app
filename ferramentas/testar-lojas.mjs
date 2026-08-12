/**
 * Testa a busca de preço contra lojas reais, usando a Edge Function já
 * publicada. É isto que transforma a lista de "lojas que funcionam" em dado
 * medido, em vez de estimativa.
 *
 * Rode do seu computador (precisa de Node 18+):
 *
 *   1. Abra o FinCK logado no navegador, aperte F12 → Console e cole:
 *
 *        JSON.parse(Object.entries(localStorage)
 *          .find(([k]) => k.startsWith('sb-') && k.endsWith('-auth-token'))[1]).access_token
 *
 *      Copie o texto que aparecer: é o seu token.
 *
 *   2. No terminal, na pasta do projeto:
 *
 *        export FINCK_URL="https://SEUPROJETO.supabase.co"
 *        export FINCK_TOKEN="cole-o-token-aqui"
 *        node ferramentas/testar-lojas.mjs
 *
 *      Para testar os seus próprios links, coloque um por linha num arquivo
 *      e passe o caminho:
 *
 *        node ferramentas/testar-lojas.mjs meus-links.txt
 *
 * O token vale poucas horas. Se der "sessão expirada", pegue outro.
 */

import { readFileSync } from "node:fs";

const URL_BASE = process.env.FINCK_URL?.replace(/\/$/, "");
const TOKEN = process.env.FINCK_TOKEN;

if (!URL_BASE || !TOKEN) {
  console.error("Defina FINCK_URL e FINCK_TOKEN antes de rodar. Veja o cabeçalho do arquivo.");
  process.exit(1);
}

// Links de exemplo. Troque por produtos reais das lojas que você usa —
// links de produto que já saíram do ar devolvem "não encontrei o preço"
// e falseiam o resultado.
const PADRAO = [
  "https://www.kabum.com.br/produto/353610",
  "https://www.magazineluiza.com.br/",
  "https://www.mercadolivre.com.br/",
  "https://www.casasbahia.com.br/",
  "https://www.centauro.com.br/",
  "https://www.netshoes.com.br/",
  "https://www.leroymerlin.com.br/",
  "https://www.fastshop.com.br/",
  "https://www.pichau.com.br/",
  "https://www.terabyteshop.com.br/",
];

const arquivo = process.argv[2];
const LINKS = arquivo
  ? readFileSync(arquivo, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  : PADRAO;

const buscar = async (url) => {
  const t0 = Date.now();
  try {
    const r = await fetch(`${URL_BASE}/functions/v1/buscar-preco`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ url }),
    });
    return { ...(await r.json()), ms: Date.now() - t0, http: r.status };
  } catch (e) {
    return { ok: false, motivo: `falha de rede: ${e.message}`, ms: Date.now() - t0 };
  }
};

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

console.log(`\nTestando ${LINKS.length} link(s) contra ${URL_BASE}\n`);
console.log("LOJA".padEnd(28) + "RESULTADO".padEnd(18) + "MÉTODO".padEnd(12) + "TEMPO");
console.log("-".repeat(74));

const resumo = { ok: 0, falha: 0, porMetodo: {} };

for (const link of LINKS) {
  const r = await buscar(link);

  if (r.ok) {
    resumo.ok++;
    resumo.porMetodo[r.metodo] = (resumo.porMetodo[r.metodo] ?? 0) + 1;
    console.log(
      host(link).slice(0, 27).padEnd(28) +
      brl(r.preco).padEnd(18) +
      `${r.metodo}`.padEnd(12) +
      `${r.ms}ms`,
    );
  } else {
    resumo.falha++;
    console.log(
      host(link).slice(0, 27).padEnd(28) +
      `— ${r.codigo ?? "erro"}`.padEnd(18) +
      "".padEnd(12) +
      `${r.ms}ms`,
    );
    console.log(`  ↳ ${r.motivo ?? "sem detalhe"}`);
  }

  await new Promise((s) => setTimeout(s, 1200)); // não martelar as lojas
}

console.log("-".repeat(74));
console.log(`\n${resumo.ok} de ${LINKS.length} com preço (${Math.round((resumo.ok / LINKS.length) * 100)}%)`);
if (Object.keys(resumo.porMetodo).length) {
  console.log("Por método:", Object.entries(resumo.porMetodo).map(([k, v]) => `${k}=${v}`).join("  "));
  if (resumo.porMetodo.texto) {
    console.log(`\nAtenção: ${resumo.porMetodo.texto} resultado(s) vieram do texto da página.`);
    console.log("Esses são os menos confiáveis — confira se o valor bate com a loja.");
  }
}
console.log("\nAtualize js/lojas-suporte.js conforme o que você mediu aqui.\n");
