// Acesso às rotas de IA que exigem conta: token do Supabase, limite por
// usuário, teto diário, CORS e leitura do corpo. É o mesmo desenho de
// api/buscar-preco-ia.js, separado aqui para a rota do assistente. O prefixo
// "_" faz a Vercel tratar este arquivo como módulo, não como rota.

const SUPABASE_URL_PADRAO = "https://iruqoghylxgopbopxjbi.supabase.co";
const SUPABASE_ANON_PADRAO = "sb_publishable_zn_jngIj2xibO_VpzOi0Wg_gGG7Z8eS";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function responder(res, corpo, status = 200) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(JSON.stringify(corpo));
}

function preflight(res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  return res.status(204).end();
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

const tokenDoPedido = (req) => String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();

async function usuarioDoToken(token, { buscar = fetch } = {}) {
  if (!token) return null;
  const base = (process.env.SUPABASE_URL || SUPABASE_URL_PADRAO).replace(/\/$/, "");
  const chave = process.env.SUPABASE_ANON_KEY || SUPABASE_ANON_PADRAO;
  try {
    const r = await buscar(`${base}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: chave },
    });
    if (!r.ok) return null;
    const dados = await r.json();
    return dados?.id ?? null;
  } catch {
    return null;
  }
}

// Janela de uma hora por usuário. A instância serverless pode ser reciclada,
// então isto é um freio contra abuso, não uma contabilidade exata.
function criarLimites({ porHora, tetoDia }) {
  const usos = new Map();
  const diario = { dia: null, total: 0 };
  return {
    passouDoUsuario(userId) {
      const agora = Date.now();
      const janela = (usos.get(userId) ?? []).filter((t) => agora - t < 3600000);
      janela.push(agora);
      usos.set(userId, janela);
      if (usos.size > 2000) usos.delete(usos.keys().next().value);
      return janela.length > porHora;
    },
    passouDoDia() {
      const hoje = new Date().toISOString().slice(0, 10);
      if (diario.dia !== hoje) { diario.dia = hoje; diario.total = 0; }
      diario.total += 1;
      return diario.total > tetoDia;
    },
  };
}

module.exports = { CORS, responder, preflight, lerCorpo, tokenDoPedido, usuarioDoToken, criarLimites };
