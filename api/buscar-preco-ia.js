// Busca de preço por IA — função serverless da Vercel.
//
// Recebe o link do produto, pede ao Gemini que leia a página e devolve o
// preço já no mesmo formato que o painel do FinCK of Reality desenha hoje
// (o mesmo contrato da função `buscar-preco` do Supabase). O front-end
// tenta esta rota primeiro e cai para a antiga quando ela não responde.
//
// Variáveis de ambiente (painel da Vercel → Settings → Environment Variables):
//
//   GEMINI_API_KEY        obrigatória. Chave do Google AI Studio.
//   GEMINI_MODELO         opcional. Padrão: gemini-3.5-flash
//   GEMINI_BUSCA_GOOGLE   opcional. "1" liga o grounding com Busca do Google
//                         (só funciona em chave paga; no plano gratuito a
//                         cota dessa ferramenta é zero e a chamada dá 429).
//   SUPABASE_URL          opcional. Padrão: o projeto que está em js/config.js
//   SUPABASE_ANON_KEY     opcional. Chave pública, idem.

const MODELOS_PADRAO = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
const SUPABASE_URL_PADRAO = "https://iruqoghylxgopbopxjbi.supabase.co";
const SUPABASE_ANON_PADRAO = "sb_publishable_zn_jngIj2xibO_VpzOi0Wg_gGG7Z8eS";

const PRAZO_GEMINI_MS = 25000;
const PRAZO_PAGINA_MS = 12000;
const LIMITE_HTML_BYTES = 2500000;
const LIMITE_TRECHO = 90000;
const MAX_REDIRECIONAMENTOS = 5;
const CACHE_MS = 5 * 60 * 1000;
const LIMITE_POR_USUARIO = 30;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------- segurança

const FAIXAS_PRIVADAS = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

function ipPrivado(ip) {
  if (FAIXAS_PRIVADAS.some((r) => r.test(ip))) return true;
  const v6 = String(ip).toLowerCase().replace(/^\[|\]$/g, "");
  return v6 === "::1" || v6 === "::" ||
    /^f[cd]/.test(v6) || v6.startsWith("fe80") || v6.startsWith("::ffff:127.");
}

async function hostPerigoso(host) {
  const h = String(host).toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return true;
  if (h === "metadata.google.internal" || h === "metadata") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return ipPrivado(h);
  try {
    const dns = require("node:dns").promises;
    const achados = await dns.lookup(h, { all: true });
    if (achados.some((a) => ipPrivado(a.address))) return true;
  } catch { /* host que não resolve cai no fetch e falha lá */ }
  return false;
}

// ------------------------------------------------------------------ números

function paraNumero(bruto) {
  if (typeof bruto === "number") return Number.isFinite(bruto) && bruto > 0 ? bruto : null;
  let s = String(bruto ?? "").trim().replace(/[^\d.,]/g, "");
  if (!s) return null;
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  } else if (temVirgula) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (temPonto) {
    const partes = s.split(".");
    const ultima = partes[partes.length - 1];
    if (partes.length > 2 || (partes.length === 2 && ultima.length === 3 && partes[0].length <= 3)) {
      s = partes.join("");
    }
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n < 100000000 ? n : null;
}

const duasCasas = (n) => Number(Number(n).toFixed(2));

function normalizarMoeda(bruta) {
  const m = String(bruta ?? "").trim().toUpperCase();
  if (!m) return "BRL";
  if (m === "R$" || m === "RS" || m.includes("REA")) return "BRL";
  if (m === "US$" || m === "$" || m.includes("DOLAR") || m.includes("DÓLAR")) return "USD";
  if (m === "€" || m.includes("EURO")) return "EUR";
  return /^[A-Z]{3}$/.test(m) ? m : "BRL";
}

// -------------------------------------------------------------- página bruta

// Reduz o HTML ao que interessa para achar preço: os blocos JSON-LD, as meta
// tags de preço e o texto visível. Sem isso o modelo recebe megabytes de
// script e o custo por busca explode.
function resumirHtml(html) {
  const partes = [];

  const ld = [...html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )].map((m) => m[1].trim()).filter(Boolean);
  if (ld.length) {
    partes.push("== DADOS ESTRUTURADOS (JSON-LD) ==\n" + ld.join("\n").slice(0, 30000));
  }

  const metas = [...html.matchAll(/<meta[^>]+>/gi)]
    .map((m) => m[0])
    .filter((t) => /og:(title|price)|product:price|itemprop=["']price/i.test(t));
  if (metas.length) {
    partes.push("== META TAGS ==\n" + metas.join("\n").slice(0, 4000));
  }

  const titulo = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titulo) partes.push("== TITLE ==\n" + titulo[1].replace(/\s+/g, " ").trim().slice(0, 300));

  const texto = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#3[49];/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  partes.push("== TEXTO VISÍVEL ==\n" + texto.slice(0, 40000));

  return partes.join("\n\n").slice(0, LIMITE_TRECHO);
}

async function baixarPagina(urlInicial) {
  const ctrl = new AbortController();
  const alarme = setTimeout(() => ctrl.abort(), PRAZO_PAGINA_MS);
  try {
    let url = urlInicial;
    for (let salto = 0; salto <= MAX_REDIRECIONAMENTOS; salto++) {
      const alvo = new URL(url);
      if (alvo.protocol !== "http:" && alvo.protocol !== "https:") return null;
      if (await hostPerigoso(alvo.hostname)) return null;

      const r = await fetch(alvo.toString(), {
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          "User-Agent": UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
      });

      if ([301, 302, 303, 307, 308].includes(r.status)) {
        const destino = r.headers.get("location");
        await r.body?.cancel();
        if (!destino) return null;
        url = new URL(destino, alvo).toString();
        continue;
      }
      if (!r.ok) { await r.body?.cancel(); return null; }

      const tipo = r.headers.get("content-type") ?? "";
      if (!/text\/html|application\/xhtml|text\/plain/i.test(tipo)) {
        await r.body?.cancel();
        return null;
      }

      const bruto = await r.arrayBuffer();
      const corte = bruto.byteLength > LIMITE_HTML_BYTES
        ? bruto.slice(0, LIMITE_HTML_BYTES)
        : bruto;
      return {
        html: new TextDecoder("utf-8").decode(corte),
        urlFinal: alvo.toString(),
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(alarme);
  }
}

// -------------------------------------------------------------------- gemini

const FORMATO = `{
  "encontrado": true | false,
  "titulo": string | null,
  "preco": number | null,
  "precoOriginal": number | null,
  "moeda": "código ISO da moeda que a página exibe, ex.: BRL, USD, EUR",
  "aVista": { "valor": number, "forma": "Pix" | "boleto" | "à vista" } | null,
  "parcelamento": { "vezes": number, "valor": number, "semJuros": true | false } | null,
  "freteGratis": true | false | null,
  "confianca": "alta" | "media" | "baixa",
  "motivo": string | null
}`;

const REGRAS = [
  '"preco" é o valor de venda do produto hoje, inteiro e à vista no cartão — nunca o valor de uma parcela, do frete, de um acessório, de um item "quem viu também viu" ou de outro anúncio da página.',
  '"precoOriginal" só quando a página mostra um valor riscado/"de R$" maior que o atual. Caso contrário, null.',
  '"aVista" só quando a loja anuncia um preço menor para Pix, boleto ou pagamento à vista.',
  'Números puros, com ponto decimal e sem separador de milhar: 1499.90 — nunca "R$ 1.499,90".',
  'Se a página tiver variações (cor, tamanho, voltagem), use o preço da variação exibida por padrão.',
  'Produto esgotado, indisponível ou sem estoque ainda conta: se a página mostra o valor, devolva esse valor e registre a situação em "motivo".',
  '"moeda" é a moeda que a página realmente exibe. Se o preço estiver em dólar, devolva o valor em dólar com "moeda":"USD" — nunca converta para real.',
  'Responda encontrado=false só quando a página não abrir, não for de produto, ou não exibir preço nenhum. Explique em "motivo".',
  'Nunca invente, estime ou converta um valor: sem preço lido de verdade, encontrado=false.',
  '"confianca": "alta" quando o preço veio dos dados estruturados ou está claro na página; "media" quando houve ambiguidade entre valores; "baixa" quando é um palpite a partir do texto.',
];

const promptDaUrl = (url) => [
  "Você extrai preços de páginas de produto de lojas online brasileiras.",
  "",
  `Abra esta página e leia o preço do produto principal:`,
  url,
  "",
  "Responda APENAS com um objeto JSON, sem markdown e sem texto ao redor, exatamente neste formato:",
  FORMATO,
  "",
  "Regras:",
  ...REGRAS.map((r) => `- ${r}`),
].join("\n");

const promptDoHtml = (url, trecho) => [
  "Você extrai preços de páginas de produto de lojas online brasileiras.",
  "",
  `Abaixo está o conteúdo já baixado da página ${url}.`,
  "Leia o preço do produto principal a partir dele.",
  "",
  "Responda APENAS com um objeto JSON, sem markdown e sem texto ao redor, exatamente neste formato:",
  FORMATO,
  "",
  "Regras:",
  ...REGRAS.map((r) => `- ${r}`),
  "",
  "=== CONTEÚDO DA PÁGINA ===",
  trecho,
].join("\n");

const promptDaBusca = (url) => [
  "Você extrai preços de produtos de lojas online brasileiras.",
  "",
  `A página ${url} não pôde ser aberta diretamente.`,
  "Use a Busca do Google para descobrir de que produto ela trata e qual o preço anunciado hoje NESSA MESMA loja.",
  "",
  "Responda APENAS com um objeto JSON, sem markdown e sem texto ao redor, exatamente neste formato:",
  FORMATO,
  "",
  "Regras:",
  ...REGRAS.map((r) => `- ${r}`),
  '- Preço vindo de busca, e não da própria página, tem no máximo "confianca": "media".',
  "- Se os resultados não trouxerem o preço da loja do link, responda encontrado=false.",
].join("\n");

function extrairJson(texto) {
  if (!texto) return null;
  const limpo = String(texto)
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/,'')
    .trim();
  try {
    return JSON.parse(limpo);
  } catch { /* modelo às vezes embrulha o JSON em uma frase */ }
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio === -1 || fim <= inicio) return null;
  try {
    return JSON.parse(limpo.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}

async function chamarGemini({ chave, modelos, prompt, ferramentas }) {
  let ultimoErro = "IA indisponível.";

  for (const modelo of modelos) {
    const ctrl = new AbortController();
    const alarme = setTimeout(() => ctrl.abort(), PRAZO_GEMINI_MS);
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
        {
          method: "POST",
          signal: ctrl.signal,
          headers: { "x-goog-api-key": chave, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            // Atenção: responseSchema é incompatível com url_context e
            // google_search — a chamada trava. O formato vai no prompt.
            generationConfig: { temperature: 0 },
            ...(ferramentas.length ? { tools: ferramentas } : {}),
          }),
        }
      );

      const dados = await r.json().catch(() => null);

      if (!r.ok) {
        ultimoErro = dados?.error?.message ?? `Gemini respondeu ${r.status}.`;
        // Cota estourada ou modelo fora do ar: vale tentar o próximo.
        if (r.status === 429 || r.status === 503 || r.status === 404) continue;
        return { erro: ultimoErro };
      }

      const candidato = dados?.candidates?.[0];
      const texto = (candidato?.content?.parts ?? [])
        .map((p) => p.text)
        .filter(Boolean)
        .join("");
      const meta = candidato?.url_context_metadata ?? candidato?.urlContextMetadata;
      const statusUrl = (meta?.urlMetadata ?? [])
        .map((m) => String(m.urlRetrievalStatus ?? "").replace("URL_RETRIEVAL_STATUS_", ""));

      return { json: extrairJson(texto), statusUrl, modelo };
    } catch (e) {
      ultimoErro = e?.name === "AbortError"
        ? "A leitura por IA demorou demais."
        : `Falha ao falar com a IA: ${e?.message ?? "erro desconhecido"}`;
    } finally {
      clearTimeout(alarme);
    }
  }

  return { erro: ultimoErro };
}

// ------------------------------------------------------------------ panorama

// Traduz a resposta do modelo para o mesmo objeto que o painel já desenha.
function montarPanorama(bruto, metodo) {
  if (!bruto || bruto.encontrado === false) return null;

  const preco = paraNumero(bruto.preco);
  if (!preco) return null;

  const panorama = {
    preco: duasCasas(preco),
    moeda: normalizarMoeda(bruto.moeda),
    titulo: typeof bruto.titulo === "string" && bruto.titulo.trim()
      ? bruto.titulo.trim().slice(0, 160)
      : null,
    metodo,
    fonte: "ia",
    confianca: ["alta", "media", "baixa"].includes(bruto.confianca) ? bruto.confianca : "media",
  };

  const original = paraNumero(bruto.precoOriginal);
  if (original && original > preco * 1.01) {
    panorama.precoOriginal = duasCasas(original);
    const valor = panorama.precoOriginal - panorama.preco;
    panorama.desconto = {
      valor: duasCasas(valor),
      percentual: Number(((valor / panorama.precoOriginal) * 100).toFixed(1)),
    };
  }

  const aVista = paraNumero(bruto.aVista?.valor);
  if (aVista && aVista < preco && aVista >= preco * 0.5) {
    const forma = String(bruto.aVista?.forma ?? "");
    panorama.aVista = {
      valor: duasCasas(aVista),
      forma: /pix/i.test(forma) ? "Pix" : /boleto/i.test(forma) ? "boleto" : "à vista",
      percentual: Number((((preco - aVista) / preco) * 100).toFixed(1)),
    };
  }

  const vezes = Number(bruto.parcelamento?.vezes);
  const parcela = paraNumero(bruto.parcelamento?.valor);
  if (parcela && Number.isFinite(vezes) && vezes >= 2 && vezes <= 24) {
    panorama.parcelamento = {
      vezes: Math.round(vezes),
      valor: duasCasas(parcela),
      semJuros: bruto.parcelamento?.semJuros === true,
      total: duasCasas(Math.round(vezes) * parcela),
    };
  }

  if (bruto.freteGratis === true) panorama.frete = { gratis: true };

  return panorama;
}

// ----------------------------------------------------------------- infra web

const cache = new Map();
const usos = new Map();

function passouDoLimite(userId) {
  const agora = Date.now();
  const janela = (usos.get(userId) ?? []).filter((t) => agora - t < 3600000);
  janela.push(agora);
  usos.set(userId, janela);
  return janela.length > LIMITE_POR_USUARIO;
}

function responder(res, corpo, status = 200) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(corpo));
}

async function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const pedacos = [];
  for await (const p of req) pedacos.push(p);
  if (!pedacos.length) return {};
  try { return JSON.parse(Buffer.concat(pedacos).toString("utf8")); } catch { return {}; }
}

async function usuarioDoToken(token) {
  const base = (process.env.SUPABASE_URL || SUPABASE_URL_PADRAO).replace(/\/$/, "");
  const chave = process.env.SUPABASE_ANON_KEY || SUPABASE_ANON_PADRAO;
  try {
    const r = await fetch(`${base}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: chave },
    });
    if (!r.ok) return null;
    const dados = await r.json();
    return dados?.id ?? null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ handler

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return responder(res, { ok: false, motivo: "Método não suportado." }, 405);
  }

  const chave = process.env.GEMINI_API_KEY;
  if (!chave) {
    return responder(res, {
      ok: false,
      codigo: "IA_INDISPONIVEL",
      motivo: "A busca por IA não está configurada neste servidor.",
    }, 503);
  }

  const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return responder(res, {
      ok: false,
      codigo: "SEM_LOGIN",
      motivo: "Entre na sua conta para usar a busca.",
    }, 401);
  }

  const userId = await usuarioDoToken(token);
  if (!userId) {
    return responder(res, {
      ok: false,
      codigo: "SEM_LOGIN",
      motivo: "Sessão expirada. Entre novamente.",
    }, 401);
  }

  if (passouDoLimite(userId)) {
    return responder(res, {
      ok: false,
      codigo: "LIMITE",
      motivo: "Muitas buscas seguidas. Espere alguns minutos e tente de novo.",
    }, 429);
  }

  const corpo = await lerCorpo(req);
  let url = String(corpo?.url ?? "").trim();
  if (!url) {
    return responder(res, {
      ok: false,
      codigo: "URL_INVALIDA",
      motivo: "Informe o link do produto.",
    }, 400);
  }
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  let alvo;
  try {
    alvo = new URL(url);
  } catch {
    return responder(res, {
      ok: false,
      codigo: "URL_INVALIDA",
      motivo: "Esse link não parece válido.",
    }, 400);
  }
  if (alvo.protocol !== "http:" && alvo.protocol !== "https:") {
    return responder(res, {
      ok: false,
      codigo: "URL_INVALIDA",
      motivo: "O endereço precisa começar com http ou https.",
    }, 400);
  }
  if (await hostPerigoso(alvo.hostname)) {
    return responder(res, {
      ok: false,
      codigo: "URL_INVALIDA",
      motivo: "Endereço não permitido.",
    }, 400);
  }

  const emCache = cache.get(url);
  if (emCache && Date.now() - emCache.em < CACHE_MS) {
    return responder(res, emCache.corpo);
  }

  const modelos = [
    ...new Set([process.env.GEMINI_MODELO, ...MODELOS_PADRAO].filter(Boolean)),
  ];
  const loja = alvo.hostname.replace(/^www\./, "");
  const entregar = (panorama) => {
    const resposta = { ok: true, ...panorama, loja };
    cache.set(url, { em: Date.now(), corpo: resposta });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return responder(res, resposta);
  };

  let ultimoMotivo = null;

  // 1) O Gemini abre a página por conta própria (ferramenta url_context).
  const porUrl = await chamarGemini({
    chave,
    modelos,
    prompt: promptDaUrl(url),
    ferramentas: [{ url_context: {} }],
  });
  if (porUrl.erro) ultimoMotivo = porUrl.erro;
  if (porUrl.json?.motivo) ultimoMotivo = porUrl.json.motivo;
  // Só aceitamos o preço quando o Google confirma que abriu a página. Sem essa
  // trava o modelo responderia de memória, com valor desatualizado.
  if (porUrl.statusUrl?.includes("SUCCESS")) {
    const panorama = montarPanorama(porUrl.json, "ia-url");
    if (panorama) return entregar(panorama);
  }

  // 2) A loja barrou o buscador do Google. Baixamos a página daqui — o IP da
  //    Vercel costuma passar onde o do Google não passa — e mandamos o
  //    conteúdo já limpo para o modelo ler.
  const pagina = await baixarPagina(url);
  if (pagina) {
    const porHtml = await chamarGemini({
      chave,
      modelos,
      prompt: promptDoHtml(pagina.urlFinal, resumirHtml(pagina.html)),
      ferramentas: [],
    });
    if (porHtml.erro) ultimoMotivo = porHtml.erro;
    const panorama = montarPanorama(porHtml.json, "ia-html");
    if (panorama) return entregar(panorama);
    if (porHtml.json?.motivo) ultimoMotivo = porHtml.json.motivo;
  }

  // 3) Último recurso: procurar o preço na Busca do Google. Depende de chave
  //    com cota para grounding, por isso fica atrás de uma variável.
  if (process.env.GEMINI_BUSCA_GOOGLE === "1") {
    const porBusca = await chamarGemini({
      chave,
      modelos,
      prompt: promptDaBusca(url),
      ferramentas: [{ google_search: {} }],
    });
    if (porBusca.erro) ultimoMotivo = porBusca.erro;
    const panorama = montarPanorama(porBusca.json, "ia-busca");
    if (panorama) return entregar(panorama);
    if (porBusca.json?.motivo) ultimoMotivo = porBusca.json.motivo;
  }

  return responder(res, {
    ok: false,
    codigo: "SEM_PRECO",
    motivo: "Não consegui ler o preço nessa página. Digite o valor manualmente.",
    detalhe: ultimoMotivo,
  });
};

module.exports.paraNumero = paraNumero;
module.exports.normalizarMoeda = normalizarMoeda;
module.exports.extrairJson = extrairJson;
module.exports.montarPanorama = montarPanorama;
module.exports.resumirHtml = resumirHtml;
