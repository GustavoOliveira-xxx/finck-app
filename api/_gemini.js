// Gemini, do Google, para a Revisão financeira (api/assistente-ia.js).
//
// A chave vive na Vercel. A revisão usa ASSISTENTE_GEMINI_API_KEY quando
// existe; senão, a mesma GEMINI_API_KEY da busca de preço. Uma chave de outro
// projeto do Google AI Studio tem cota própria, e a revisão não disputa os
// pedidos do dia com a leitura de preço.
//
// A resposta sai num esquema JSON (responseSchema), o modo de saída
// estruturada do Gemini. Quem chama ainda confere o conteúdo (aceitar): se
// o JSON não servir, vai o próximo modelo da lista.
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   ASSISTENTE_GEMINI_API_KEY  opcional. Chave só da revisão.
//   GEMINI_API_KEY             a da busca de preço, usada se a de cima faltar.
//   ASSISTENTE_GEMINI_MODELO   opcional. Modelo tentado antes dos padrões.

// Medidos na chave gratuita em outubro de 2026 (veja api/README.md): o lite
// é rápido e tem cota folgada; o 3.5-flash aceita só 20 pedidos por dia.
const MODELOS_PADRAO = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite"];
const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const chave = () => String(process.env.ASSISTENTE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim();
const configurado = () => Boolean(chave());
const modelos = () => [...new Set([process.env.ASSISTENTE_GEMINI_MODELO, ...MODELOS_PADRAO].map((m) => String(m || "").trim()).filter(Boolean))];

// O responseSchema do Gemini segue o subconjunto OpenAPI: tipos em
// maiúsculas e sem additionalProperties. O esquema da revisão é o mesmo do
// Claude, em JSON Schema; aqui ele é traduzido, e a ordem das chaves vai em
// propertyOrdering para o texto sair na ordem em que a tela lê.
function paraEsquemaGemini(esquema) {
  if (Array.isArray(esquema)) return esquema.map(paraEsquemaGemini);
  if (!esquema || typeof esquema !== "object") return esquema;
  const saida = {};
  for (const [k, v] of Object.entries(esquema)) {
    if (k === "additionalProperties" || k === "$schema") continue;
    if (k === "type" && typeof v === "string") saida.type = v.toUpperCase();
    else if (k === "properties") {
      saida.properties = Object.fromEntries(Object.entries(v).map(([p, s]) => [p, paraEsquemaGemini(s)]));
      saida.propertyOrdering = Object.keys(v);
    } else saida[k] = paraEsquemaGemini(v);
  }
  return saida;
}

function extrairJson(texto) {
  const limpo = String(texto || "").replace(/```(?:json)?/gi, "");
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio === -1 || fim <= inicio) return null;
  try {
    const valor = JSON.parse(limpo.slice(inicio, fim + 1));
    return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : null;
  } catch {
    return null;
  }
}

// Bloqueio por segurança do próprio Gemini: não adianta insistir em outro
// modelo com o mesmo pedido.
const BLOQUEIOS = new Set(["SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII"]);

// Pede um JSON no esquema e devolve { status: 200, valor, modelo } ou
// { status, erro }. Status 429 quando todos estão sem cota ou ocupados, 504
// quando o prazo acabou, 401/403 para chave recusada e "recusa" para
// bloqueio de segurança. Nunca lança erro.
async function gerarJson({
  sistema,
  usuario,
  esquema,
  maxTokens = 2000,
  prazoMs = 50000,
  prazoPorModeloMs = 25000,
  aceitar = (json) => json,
  buscar = fetch,
  agora = Date.now,
}) {
  const fim = agora() + prazoMs;
  let ultimo = { status: 502, erro: "O Gemini não respondeu." };
  let houveCota = false;
  const lista = modelos();
  for (const modelo of lista) {
    const prazo = Math.min(prazoPorModeloMs, fim - agora());
    if (prazo < 3000) {
      ultimo = { status: 504, erro: "O prazo acabou." };
      break;
    }
    const ctrl = new AbortController();
    const alarme = setTimeout(() => ctrl.abort(), prazo);
    try {
      const r = await buscar(`${URL_BASE}/${encodeURIComponent(modelo)}:generateContent`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "x-goog-api-key": chave(), "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistema }] },
          contents: [{ role: "user", parts: [{ text: usuario }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json",
            responseSchema: paraEsquemaGemini(esquema),
          },
        }),
      });
      const dados = await r.json().catch(() => null);
      if (!r.ok) {
        // Cota do dia, modelo sobrecarregado, fora do ar ou erro interno:
        // vale o próximo da lista.
        if ([404, 429, 500, 503].includes(r.status)) {
          if (r.status === 429) houveCota = true;
          ultimo = { status: r.status === 404 ? 502 : r.status, erro: dados?.error?.message || `Gemini respondeu ${r.status}.` };
          continue;
        }
        // 400 com chave inválida vem assim no Gemini, não como 401.
        const chaveRecusada = r.status === 401 || r.status === 403 || /api key/i.test(dados?.error?.message || "");
        return { status: chaveRecusada ? 403 : 502, erro: dados?.error?.message || `Gemini respondeu ${r.status}.`, modelo };
      }
      if (dados?.promptFeedback?.blockReason) return { status: "recusa", erro: dados.promptFeedback.blockReason, modelo };
      const candidato = dados?.candidates?.[0];
      if (BLOQUEIOS.has(candidato?.finishReason)) return { status: "recusa", erro: candidato.finishReason, modelo };
      const texto = (candidato?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text).filter(Boolean).join("");
      const json = extrairJson(texto);
      const valor = json ? aceitar(json) : null;
      if (valor) return { status: 200, valor, modelo };
      ultimo = {
        status: candidato?.finishReason === "MAX_TOKENS" ? "cortada" : 502,
        erro: json ? "A resposta não passou nas conferências." : "A resposta não veio em JSON.",
        modelo,
      };
    } catch (e) {
      ultimo = e?.name === "AbortError"
        ? { status: 504, erro: "O Gemini demorou demais." }
        : { status: 502, erro: `Falha ao falar com o Gemini: ${e?.message || "erro desconhecido"}` };
    } finally {
      clearTimeout(alarme);
    }
  }
  // Se algum modelo estava sem cota e nenhum outro deu certo, o motivo que
  // importa para a pessoa é o limite.
  if (houveCota && [429, 500, 502, 503].includes(ultimo.status)) return { ...ultimo, status: 429 };
  return ultimo;
}

module.exports = { MODELOS_PADRAO, configurado, modelos, paraEsquemaGemini, extrairJson, gerarJson };
