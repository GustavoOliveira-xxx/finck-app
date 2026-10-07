// Conversa com o OpenRouter usando só modelos gratuitos. Compartilhado pela
// FINCK AI (api/ia.js) e pelo Assistente FinCK (api/assistente-ia.js). O
// prefixo "_" faz a Vercel tratar este arquivo como módulo, não como rota.
//
// Variáveis de ambiente:
//   OPENROUTER_API_KEY    obrigatória. Chave do painel do OpenRouter.
//   IA_MODELOS            opcional. Ids de modelos gratuitos preferidos,
//                         separados por vírgula, no lugar de PREFERIDOS_PADRAO.

const MODELO = "openrouter/free";
const ENDERECO = "https://openrouter.ai/api/v1/chat/completions";
const PRAZO_TOTAL_MS = 55000;
const TENTATIVAS = 3;

// Modelos gratuitos testados em 7/10/2026: bons e rápidos (5 a 6 s). O
// OpenRouter usa o primeiro e só passa ao seguinte se ele der erro; o
// roteador gratuito fica como último recurso.
const PREFERIDOS_PADRAO = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "inclusionai/ling-3.0-flash-sante:free",
];

// Modelos que responderam errado nos testes. Se o sorteio cair num deles,
// a rota tenta de novo.
const MODELOS_EVITADOS = /liquid\/lfm-2\.5-2\.6b/i;

// O roteador gratuito às vezes sorteia um modelo que não conversa: um
// classificador de segurança ou de decisão, que devolve só um rótulo como
// "User Safety: safe". Quando isso acontece, tenta outra vez.
const MODELO_NAO_CONVERSA = /(safety|guard|moderat|classif|decid|decision|clef|rerank|embed)/i;
const RESPOSTA_DE_CLASSIFICADOR = /^\s*(user|response|prompt)\s+safety\s*:/i;

const naoConversa = (modelo, texto) =>
  MODELO_NAO_CONVERSA.test(String(modelo || "")) ||
  MODELOS_EVITADOS.test(String(modelo || "")) ||
  RESPOSTA_DE_CLASSIFICADOR.test(String(texto || ""));

const configurado = () => Boolean(process.env.OPENROUTER_API_KEY);

function preferidos() {
  const daVercel = String(process.env.IA_MODELOS || "")
    .split(",").map((m) => m.trim()).filter(Boolean);
  return daVercel.length ? daVercel : PREFERIDOS_PADRAO;
}

function corpoDoModelo(usarPreferidos = true) {
  const lista = usarPreferidos ? preferidos() : [];
  return lista.length ? { models: [...lista, MODELO] } : { model: MODELO };
}

// A data entra no prompt para a IA conseguir contar meses ("até dezembro").
const hoje = (agora = new Date()) =>
  agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" });

async function chamarUmaVez({ sistema, usuario, maxTokens, prazoMs, buscar, usarPreferidos, aceitar }) {
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
        ...corpoDoModelo(usarPreferidos),
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: usuario },
        ],
      }),
    });
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) {
      // Um id da lista de preferidos pode deixar de existir: aí a próxima
      // tentativa vai direto ao roteador gratuito.
      const semLista = r.status === 400 || r.status === 404;
      return {
        status: r.status,
        erro: dados?.error?.message || "Falha ao consultar a IA.",
        repetir: usarPreferidos && semLista,
        semPreferidos: usarPreferidos && semLista,
      };
    }
    const texto = String(dados?.choices?.[0]?.message?.content ?? "").trim();
    if (!texto) return { status: 502, erro: "A IA respondeu vazio. Tente de novo.", repetir: true };
    const modelo = dados.model || MODELO;
    if (naoConversa(modelo, texto)) {
      return { status: 502, erro: "A IA não conseguiu responder agora. Tente de novo.", repetir: true, modelo };
    }
    // Quem chama pode exigir um formato (JSON do assistente, por exemplo).
    // Resposta fora do formato também conta como nova tentativa.
    if (aceitar) {
      const valor = aceitar(texto);
      if (valor === null || valor === undefined) {
        return { status: 502, erro: "A IA respondeu fora do formato esperado. Tente de novo.", repetir: true, modelo };
      }
      return { status: 200, texto, valor, modelo };
    }
    return { status: 200, texto, modelo };
  } catch (e) {
    const tempo = e && e.name === "AbortError";
    return { status: 504, erro: tempo ? "A IA demorou demais. Tente de novo." : "Não foi possível conectar com a IA agora." };
  } finally {
    clearTimeout(relogio);
  }
}

// Uma conversa de uma pergunta e uma resposta, com até três tentativas
// dentro do prazo. Devolve { status, texto, valor?, modelo?, erro?, tempo_ms }.
async function conversar({
  sistema,
  usuario,
  maxTokens = 1500,
  aceitar = null,
  rotulo = "ia",
  buscar = fetch,
  agora = Date.now,
  prazoTotalMs = PRAZO_TOTAL_MS,
} = {}) {
  const inicio = agora();
  const fim = inicio + prazoTotalMs;
  let ultimo = { status: 504, erro: "A IA demorou demais. Tente de novo." };
  let usarPreferidos = true;
  for (let i = 0; i < TENTATIVAS; i++) {
    const resta = fim - agora();
    if (resta < 5000) break;
    ultimo = await chamarUmaVez({ sistema, usuario, maxTokens, prazoMs: resta, buscar, usarPreferidos, aceitar });
    if (ultimo.semPreferidos) usarPreferidos = false;
    if (!ultimo.repetir) break;
  }
  const { repetir, semPreferidos, ...resultado } = ultimo;
  if (resultado.status !== 200) delete resultado.modelo;
  resultado.tempo_ms = agora() - inicio;
  // Aparece nos logs da Vercel: ajuda a escolher os modelos mais rápidos.
  console.log(`[${rotulo}] ${resultado.status} ${resultado.modelo || "-"} ${resultado.tempo_ms}ms`);
  return resultado;
}

// Primeiro objeto JSON de um texto: tolera cercas de código e frases antes
// ou depois, que modelos gratuitos às vezes acrescentam.
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

module.exports = {
  MODELO,
  PREFERIDOS_PADRAO,
  configurado,
  preferidos,
  naoConversa,
  hoje,
  conversar,
  extrairJson,
};
