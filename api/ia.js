// FINCK AI: ponte entre o site e o OpenRouter, só com modelos gratuitos.
//
// O navegador fala com esta rota, e só ela fala com o OpenRouter. A chave
// vive na Vercel, nunca no código da página.
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   OPENROUTER_API_KEY    obrigatória. Chave do painel do OpenRouter.
//   IA_TETO_DIA           opcional. Padrão: 40 chamadas por dia, abaixo das
//                         50 diárias do plano gratuito do OpenRouter.
//
// O modelo é "openrouter/free": o roteador escolhe sozinho um modelo
// gratuito disponível, então a rota não depende de um modelo específico.

const A = require("./_acesso.js");

const MODELO = "openrouter/free";
const ENDERECO = "https://openrouter.ai/api/v1/chat/completions";
const MAX_PERGUNTA = 2000;
const PRAZO_TOTAL_MS = 55000;
const TENTATIVAS = 3;

const SISTEMA =
  "Você é a FINCK AI, assistente financeira do aplicativo FINCK. " +
  "Responda sempre em português do Brasil, de forma clara, educada e objetiva.";

// O roteador gratuito às vezes sorteia um modelo que não conversa: um
// classificador de segurança ou de decisão, que devolve só um rótulo como
// "User Safety: safe". Quando isso acontece, a rota tenta outra vez.
const MODELO_NAO_CONVERSA = /(safety|guard|moderat|classif|decid|decision|clef|rerank|embed)/i;
const RESPOSTA_DE_CLASSIFICADOR = /^\s*(user|response|prompt)\s+safety\s*:/i;

const naoConversa = (modelo, texto) =>
  MODELO_NAO_CONVERSA.test(String(modelo || "")) || RESPOSTA_DE_CLASSIFICADOR.test(texto);

// Opcional: IA_MODELOS na Vercel com ids de modelos gratuitos preferidos,
// separados por vírgula. O roteador gratuito fica sempre como último recurso.
function corpoDoModelo() {
  const preferidos = String(process.env.IA_MODELOS || "")
    .split(",").map((m) => m.trim()).filter(Boolean);
  return preferidos.length ? { models: [...preferidos, MODELO] } : { model: MODELO };
}

// Por IP: freio contra abuso numa rota pública, não contabilidade exata.
const limites = A.criarLimites({
  porHora: 15,
  tetoDia: Number(process.env.IA_TETO_DIA || 40),
});

const ipDoPedido = (req) =>
  String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || "anonimo";

async function chamarUmaVez(pergunta, prazoMs, buscar) {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), prazoMs);
  try {
    const r = await buscar(ENDERECO, {
      method: "POST",
      signal: controle.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://finck-app.vercel.app",
        "X-Title": "FINCK",
      },
      body: JSON.stringify({
        ...corpoDoModelo(),
        messages: [
          { role: "system", content: SISTEMA },
          { role: "user", content: pergunta },
        ],
      }),
    });
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { status: r.status, erro: dados?.error?.message || "Falha ao consultar a IA." };
    }
    const texto = String(dados?.choices?.[0]?.message?.content ?? "").trim();
    if (!texto) return { status: 502, erro: "A IA respondeu vazio. Tente de novo.", repetir: true };
    const modelo = dados.model || MODELO;
    if (naoConversa(modelo, texto)) {
      return { status: 502, erro: "A IA não conseguiu responder agora. Tente de novo.", repetir: true, modelo };
    }
    return { status: 200, resposta: texto, modelo };
  } catch (e) {
    const tempo = e && e.name === "AbortError";
    return { status: 504, erro: tempo ? "A IA demorou demais. Tente de novo." : "Não foi possível conectar com a IA agora." };
  } finally {
    clearTimeout(relogio);
  }
}

async function perguntar(pergunta, { buscar = fetch, agora = Date.now } = {}) {
  const fim = agora() + PRAZO_TOTAL_MS;
  let ultimo = { status: 504, erro: "A IA demorou demais. Tente de novo." };
  for (let i = 0; i < TENTATIVAS; i++) {
    const resta = fim - agora();
    if (resta < 5000) break;
    ultimo = await chamarUmaVez(pergunta, resta, buscar);
    if (!ultimo.repetir) break;
  }
  const { repetir, ...resultado } = ultimo;
  if (resultado.status !== 200) delete resultado.modelo;
  return resultado;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return A.preflight(res);

  if (req.method === "GET") {
    return A.responder(res, { ok: true, ia: Boolean(process.env.OPENROUTER_API_KEY), modelo: MODELO });
  }

  if (req.method !== "POST") return A.responder(res, { erro: "Use o método POST." }, 405);

  if (!process.env.OPENROUTER_API_KEY) {
    return A.responder(res, { erro: "OPENROUTER_API_KEY não configurada na Vercel." }, 500);
  }

  const corpo = await A.lerCorpo(req);
  const pergunta = String(corpo?.pergunta ?? "").slice(0, MAX_PERGUNTA).trim();
  if (!pergunta) return A.responder(res, { erro: "Envie uma pergunta." }, 400);

  if (limites.passouDoUsuario(ipDoPedido(req))) {
    return A.responder(res, { erro: "Muitas perguntas seguidas. Espere um pouco e tente de novo." }, 429);
  }
  if (limites.passouDoDia()) {
    return A.responder(res, { erro: "A FINCK AI atingiu o limite de hoje. Volte amanhã." }, 429);
  }

  const r = await perguntar(pergunta);
  const { status, ...corpoResposta } = r;
  return A.responder(res, corpoResposta, status);
};

module.exports.perguntar = perguntar;
module.exports.MODELO = MODELO;
module.exports.naoConversa = naoConversa;
