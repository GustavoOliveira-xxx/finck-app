// FINCK AI: ponte entre o site e o OpenRouter, só com modelos gratuitos.
//
// O navegador fala com esta rota, e só ela fala com o OpenRouter. A chave
// vive na Vercel, nunca no código da página. A escolha de modelos, o descarte
// de classificadores e as novas tentativas ficam em api/_openrouter.js.
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   OPENROUTER_API_KEY    obrigatória. Chave do painel do OpenRouter.
//   IA_TETO_DIA           opcional. Padrão: 40 chamadas por dia, abaixo das
//                         50 diárias do plano gratuito do OpenRouter.
//   IA_MODELOS            opcional. Veja api/_openrouter.js.

const A = require("./_acesso.js");
const OR = require("./_openrouter.js");

const MAX_PERGUNTA = 3000;
const MAX_TOKENS = 1500;

const sistema = () =>
  "Você é a FINCK AI, assistente financeira do aplicativo FINCK. " +
  `Hoje é ${OR.hoje()}. ` +
  "Responda sempre em português do Brasil, de forma clara, educada e objetiva. " +
  "Seja breve: no máximo 150 palavras, indo direto ao ponto. " +
  "Escreva em texto simples, sem Markdown: não use #, *, negrito, títulos, tabelas nem linhas separadoras. " +
  "Quando uma lista ajudar, use linhas numeradas simples (1., 2., 3.).";

// Rede de segurança: alguns modelos formatam mesmo pedindo texto simples.
// A tela do FINCK mostra o texto como está, então os símbolos sairiam crus.
function limparMarkdown(texto) {
  return String(texto)
    .replace(/^[ \t]*```[^\n]*$/gm, "")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*([-*_])([ \t]*\1){2,}[ \t]*$/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^([ \t]*)[*+-][ \t]+/gm, "$1• ")
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1$2")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Por IP: freio contra abuso numa rota pública, não contabilidade exata.
const limites = A.criarLimites({
  porHora: 15,
  tetoDia: Number(process.env.IA_TETO_DIA || 40),
});

const ipDoPedido = (req) =>
  String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || "anonimo";

async function perguntar(pergunta, { buscar = fetch, agora = Date.now } = {}) {
  const r = await OR.conversar({ sistema: sistema(), usuario: pergunta, maxTokens: MAX_TOKENS, rotulo: "ia", buscar, agora });
  const { texto, valor, ...resultado } = r;
  if (r.status === 200) resultado.resposta = limparMarkdown(texto);
  return resultado;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return A.preflight(res);

  if (req.method === "GET") {
    return A.responder(res, { ok: true, ia: OR.configurado(), modelo: OR.MODELO });
  }

  if (req.method !== "POST") return A.responder(res, { erro: "Use o método POST." }, 405);

  if (!OR.configurado()) {
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
module.exports.MODELO = OR.MODELO;
module.exports.PREFERIDOS_PADRAO = OR.PREFERIDOS_PADRAO;
module.exports.naoConversa = OR.naoConversa;
module.exports.limparMarkdown = limparMarkdown;
