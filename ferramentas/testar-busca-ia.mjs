// Mede a busca de preço por IA contra links reais.
//
//   FINCK_API=https://finck-app.vercel.app FINCK_TOKEN=<jwt> \
//     node ferramentas/testar-busca-ia.mjs [arquivo-com-links.txt]
//
// O token é o `access_token` da sessão do Supabase — no app logado, pegue com
// `await FinckStore.tokenAcesso()` no console do navegador.

import { readFileSync } from "node:fs";

const API = process.env.FINCK_API?.replace(/\/$/, "");

const TOKEN = process.env.FINCK_TOKEN;

if (!API || !TOKEN) {
  console.error("Defina FINCK_API e FINCK_TOKEN no ambiente antes de rodar.");
  process.exit(1);
}

const PADRAO = [ "https://www.kabum.com.br/produto/98897", "https://www.terabyteshop.com.br/", "https://www.pichau.com.br/", "https://www.netshoes.com.br/", "https://www.centauro.com.br/", "https://www.leroymerlin.com.br/", "https://www.fastshop.com.br/", "https://www.magazineluiza.com.br/", "https://www.mercadolivre.com.br/", "https://www.amazon.com.br/" ];

const arquivo = process.argv[2];

const LINKS = arquivo ? readFileSync(arquivo, "utf8").split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#")) : PADRAO;

const buscar = async url => {
  const t0 = Date.now();
  try {
    const r = await fetch(`${API}/api/buscar-preco-ia`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        url: url
      })
    });
    return {
      ...await r.json(),
      ms: Date.now() - t0,
      http: r.status
    };
  } catch (e) {
    return {
      ok: false,
      motivo: `falha de rede: ${e.message}`,
      ms: Date.now() - t0
    };
  }
};

const host = u => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

const dinheiro = (n, moeda = "BRL") => Number(n).toLocaleString("pt-BR", {
  style: "currency",
  currency: moeda
});

console.log(`\nTestando ${LINKS.length} link(s) contra ${API}\n`);

console.log("LOJA".padEnd(26) + "RESULTADO".padEnd(18) + "MÉTODO".padEnd(12) + "CONF.".padEnd(8) + "TEMPO");

console.log("-".repeat(80));

const resumo = {
  ok: 0,
  falha: 0,
  porMetodo: {},
  tempos: []
};

for (const link of LINKS) {
  const r = await buscar(link);
  resumo.tempos.push(r.ms);
  if (r.ok) {
    resumo.ok++;
    resumo.porMetodo[r.metodo] = (resumo.porMetodo[r.metodo] ?? 0) + 1;
    console.log(host(link).slice(0, 25).padEnd(26) + dinheiro(r.preco, r.moeda).padEnd(18) + `${r.metodo}`.padEnd(12) + `${r.confianca}`.padEnd(8) + `${r.ms}ms`);
    if (r.moeda && r.moeda !== "BRL") {
      console.log(`  ↳ atenção: preço em ${r.moeda}, não em reais`);
    }
  } else {
    resumo.falha++;
    console.log(host(link).slice(0, 25).padEnd(26) + `— ${r.codigo ?? "erro"}`.padEnd(18) + "".padEnd(12) + "".padEnd(8) + `${r.ms}ms`);
    console.log(`  ↳ ${r.detalhe ?? r.motivo ?? "sem detalhe"}`);
  }
  await new Promise(s => setTimeout(s, 1200));
}

console.log("-".repeat(80));

const media = Math.round(resumo.tempos.reduce((a, b) => a + b, 0) / resumo.tempos.length);

console.log(`\n${resumo.ok} de ${LINKS.length} com preço (${Math.round(resumo.ok / LINKS.length * 100)}%) · tempo médio ${media}ms`);

if (Object.keys(resumo.porMetodo).length) {
  console.log("Por método:", Object.entries(resumo.porMetodo).map(([k, v]) => `${k}=${v}`).join("  "));
  console.log("\nia-url   = o Gemini abriu a página sozinho");
  console.log("ia-html  = a Vercel baixou a página e o Gemini leu o conteúdo");
  console.log("ia-busca = veio da Busca do Google, não da página (menos confiável)");
}

console.log("\nO limite é de 30 buscas por usuário por hora — rode listas grandes em partes.\n");
