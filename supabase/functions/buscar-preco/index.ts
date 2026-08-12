/**
 * FinCK — busca automática do preço a partir do link do produto.
 *
 * Por que isto existe no servidor: o navegador não consegue ler a página de
 * outra loja (o CORS bloqueia). Esta função faz a leitura do lado de fora e
 * devolve só o número.
 *
 * A leitura acontece em cascata, do mais confiável para o menos:
 *
 *   1. JSON-LD    — o bloco que as lojas publicam para o Google Shopping.
 *                   É um número limpo. Confiança alta.
 *   2. Meta tags  — og:price:amount / product:price:amount. Confiança alta.
 *   3. Microdata  — itemprop="price". Confiança média.
 *   4. Texto      — procura "R$" descartando parcela, frete e preço riscado.
 *                   Último recurso. Confiança sempre baixa.
 *
 * O passo 4 é o que parece óbvio e é o pior: uma página de produto tem muitos
 * "R$" (preço antigo, parcela, frete, produtos relacionados). Por isso ele só
 * roda quando os três primeiros falharam, e o resultado vem marcado para a
 * tela pedir conferência.
 */

const LIMITE_BYTES = 2_500_000;   // não baixa página maior que ~2,5 MB
const PRAZO_MS = 12_000;          // desiste depois de 12 s
const MAX_REDIRECIONAMENTOS = 5;
const CACHE_MS = 5 * 60 * 1000;   // 5 min: evita bater na loja a cada clique
const LIMITE_POR_USUARIO = 30;    // buscas por hora
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ------------------------------------------------------------------ *
 * Lojas que não funcionam
 *
 * Repetido aqui de propósito. A tela já avisa antes de o usuário clicar,
 * mas um link encurtado (amzn.to, shp.ee) só revela o destino depois do
 * redirecionamento — e aí quem precisa barrar é o servidor.
 * Mantenha em sincronia com js/lojas-suporte.js.
 * ------------------------------------------------------------------ */
const BLOQUEADAS: Record<string, string> = {
  "shopee.com.br": "Shopee", "shopee.com": "Shopee", "shp.ee": "Shopee",
  "amazon.com.br": "Amazon", "amazon.com": "Amazon", "amzn.to": "Amazon", "a.co": "Amazon",
  "temu.com": "Temu",
  "aliexpress.com": "AliExpress", "aliexpress.us": "AliExpress",
  "shein.com": "SHEIN", "shein.com.br": "SHEIN",
  "instagram.com": "Instagram", "facebook.com": "Facebook", "fb.me": "Facebook", "fb.com": "Facebook",
  "tiktok.com": "TikTok Shop", "vm.tiktok.com": "TikTok Shop",
  "wa.me": "WhatsApp", "whatsapp.com": "WhatsApp", "api.whatsapp.com": "WhatsApp",
  "kwai.com": "Kwai Shop", "kwaishop.com": "Kwai Shop",
  "olx.com.br": "OLX",
};

export const lojaBloqueada = (host: string): string | null => {
  const h = host.replace(/^www\./, "");
  for (const [dominio, nome] of Object.entries(BLOQUEADAS)) {
    if (h === dominio || h.endsWith(`.${dominio}`)) return nome;
  }
  return null;
};

/* ------------------------------------------------------------------ *
 * Proteção contra SSRF
 *
 * A URL vem do usuário. Sem isto, alguém poderia apontar a função para
 * endereços internos da nuvem (169.254.169.254 devolve credenciais em
 * vários provedores) e usar o FinCK como ponte para dentro da rede.
 * ------------------------------------------------------------------ */
const FAIXAS_PRIVADAS = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

function ipPrivado(ip: string): boolean {
  if (FAIXAS_PRIVADAS.some((r) => r.test(ip))) return true;
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  return v6 === "::1" || v6 === "::" ||
    /^f[cd]/.test(v6) || v6.startsWith("fe80") || v6.startsWith("::ffff:127.");
}

async function hostPerigoso(host: string): Promise<boolean> {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");

  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return true;
  if (h === "metadata.google.internal" || h === "metadata") return true;

  // Endereço IP escrito direto na URL
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return ipPrivado(h);

  // Domínio que aponta para IP interno (DNS rebinding).
  // Best-effort: se o runtime não permitir resolver, seguimos com as
  // checagens acima, que já cobrem o caso direto.
  try {
    const ips = await Deno.resolveDns(h, "A");
    if (ips.some(ipPrivado)) return true;
  } catch { /* resolveDns indisponível — segue */ }

  return false;
}

/* ------------------------------------------------------------------ *
 * Números em formato brasileiro
 * "R$ 1.234,56" → 1234.56   (ponto = milhar, vírgula = decimal)
 * "1299.90"     → 1299.90   (formato do JSON-LD, internacional)
 * "1.299"       → 1299      (milhar sem centavos)
 * ------------------------------------------------------------------ */
export function paraNumero(bruto: unknown): number | null {
  if (typeof bruto === "number") return Number.isFinite(bruto) && bruto > 0 ? bruto : null;
  let s = String(bruto ?? "").trim().replace(/[^\d.,]/g, "");
  if (!s) return null;

  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");

  if (temVirgula && temPonto) {
    // o separador que aparece por último é o decimal
    s = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  } else if (temVirgula) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (temPonto) {
    const partes = s.split(".");
    const ultima = partes[partes.length - 1];
    // "1.299" e "12.345.678" são milhar; "1299.90" é decimal
    if (partes.length > 2 || (partes.length === 2 && ultima.length === 3 && partes[0].length <= 3)) {
      s = partes.join("");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? n : null;
}

/* ------------------------------------------------------------------ *
 * 1. JSON-LD — o caminho bom
 * ------------------------------------------------------------------ */
export function viaJsonLd(html: string): { preco: number; moeda?: string; titulo?: string } | null {
  const blocos = [...html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )];

  for (const bloco of blocos) {
    let dados: unknown;
    try {
      dados = JSON.parse(bloco[1].trim());
    } catch {
      continue; // JSON-LD malformado é comum; ignora e tenta o próximo
    }

    const fila: unknown[] = Array.isArray(dados) ? [...dados] : [dados];
    let visitados = 0;

    while (fila.length && visitados++ < 500) {
      const no = fila.shift() as Record<string, unknown>;
      if (!no || typeof no !== "object") continue;

      const tipo = ([] as unknown[]).concat(no["@type"] ?? []).join(",");

      if (/Product|Offer|AggregateOffer/i.test(tipo)) {
        const ofertas = ([] as unknown[]).concat(no.offers ?? no);
        for (const o of ofertas) {
          const of = o as Record<string, unknown>;
          if (!of || typeof of !== "object") continue;
          const preco = paraNumero(of.price ?? of.lowPrice ?? of.highPrice);
          if (preco) {
            return {
              preco,
              moeda: String(of.priceCurrency ?? no.priceCurrency ?? "BRL"),
              titulo: typeof no.name === "string" ? no.name : undefined,
            };
          }
        }
      }

      for (const v of Object.values(no)) {
        if (v && typeof v === "object") fila.push(v);
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 2. Meta tags
 * ------------------------------------------------------------------ */
export function viaMeta(html: string): { preco: number; moeda?: string } | null {
  // Só campos que significam preço. "twitter:data1" fica de fora de propósito:
  // é campo livre, usado por umas lojas para preço e por outras para
  // qualquer outro número — daria falso positivo com cara de alta confiança.
  const nomes = "og:price:amount|product:price:amount";
  const padroes = [
    new RegExp(`<meta[^>]*(?:property|name)=["'](?:${nomes})["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:${nomes})["']`, "i"),
  ];
  for (const p of padroes) {
    const m = html.match(p);
    const preco = m ? paraNumero(m[1]) : null;
    if (preco) {
      const moeda = html.match(
        /<meta[^>]*(?:property|name)=["'](?:og:price:currency|product:price:currency)["'][^>]*content=["']([^"']+)["']/i,
      );
      return { preco, moeda: moeda?.[1] ?? "BRL" };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 3. Microdata
 * ------------------------------------------------------------------ */
export function viaMicrodata(html: string): { preco: number } | null {
  const padroes = [
    /itemprop=["']price["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*itemprop=["']price["']/i,
  ];
  for (const p of padroes) {
    const m = html.match(p);
    const preco = m ? paraNumero(m[1]) : null;
    if (preco) return { preco };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 4. Texto — último recurso
 *
 * Descarta o que sabidamente não é o preço à vista e pontua o resto.
 * Uma página típica tem de 10 a 60 ocorrências de "R$"; sem estes
 * descartes, a chance de acertar é baixa.
 * ------------------------------------------------------------------ */
/**
 * O preço está dentro de uma marcação de riscado ainda aberta?
 *
 * Não basta procurar "<del>" no trecho anterior: numa página de promoção o
 * preço antigo vem riscado e fechado logo antes do preço válido. Procurar a
 * marca solta descartaria justamente o preço certo. O que vale é a abertura
 * ser mais recente que o último fechamento.
 */
/**
 * A tag que envolve o preço — só ela, não o trecho inteiro.
 *
 * Olhar uma janela de texto solta faz a classe do elemento vizinho valer pelo
 * do preço: numa promoção, o "old-price" do valor antigo fica a poucos
 * caracteres do valor novo e acabaria descartando o certo.
 */
function tagAnterior(antes: string): string {
  const i = antes.lastIndexOf("<");
  if (i === -1) return "";
  const fim = antes.indexOf(">", i);
  return fim === -1 ? antes.slice(i) : antes.slice(i, fim + 1);
}

function dentroDeRiscado(antes: string): boolean {
  const abre = Math.max(
    antes.lastIndexOf("<del"),
    antes.lastIndexOf("<s>"),
    antes.lastIndexOf("<s "),
  );
  if (abre === -1) return false;
  const fecha = Math.max(antes.lastIndexOf("</del>"), antes.lastIndexOf("</s>"));
  return abre > fecha;
}

export function viaTexto(html: string): { preco: number } | null {
  const limpo = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const pontos = new Map<number, number>();
  const re = /R\$\s*([\d.,]{3,20})/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(limpo))) {
    const valor = paraNumero(m[1]);
    if (!valor) continue;

    const antes = limpo.slice(Math.max(0, m.index - 130), m.index);
    const antesTexto = antes.replace(/<[^>]+>/g, " ").toLowerCase();
    const depois = limpo.slice(re.lastIndex, re.lastIndex + 60).replace(/<[^>]+>/g, " ").toLowerCase();

    // parcela: "12x de R$ 108,32", "em até 10x R$ ..."
    if (/\d+\s*x\s*(de\s*)?$/.test(antesTexto)) continue;
    if (/^\s*(sem|com)\s+juros/.test(depois)) continue;

    // frete, cashback, desconto, mensalidade
    if (/frete|entrega|cashback|desconto|economi[ae]|cupom|juros|por m[êe]s|mensal|assinatura/
      .test(antesTexto.slice(-55))) continue;

    // preço antigo riscado
    const tag = tagAnterior(antes);
    if (dentroDeRiscado(antes)) continue;
    if (/riscado|old-?price|price--old|de-por__de|line-through|preco-de/i.test(tag)) continue;

    let peso = 1;
    if (/(à\s*vista|a\s*vista|no\s*pix|por\s*apenas|por:?)\s*$/.test(antesTexto.slice(-28))) peso += 4;
    if (/pric(e|ing)|pre[cç]o|valor|sale|best-?price|melhor\s*pre/i.test(tag)) peso += 2;

    pontos.set(valor, (pontos.get(valor) ?? 0) + peso);
  }

  if (!pontos.size) return null;

  // o preço real costuma repetir na página; frequência + peso decidem
  const [melhor] = [...pontos.entries()].sort((a, b) => b[1] - a[1]);
  return { preco: melhor[0] };
}

export function extrairTitulo(html: string): string | null {
  const og = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (og) return og[1].trim().slice(0, 160);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? t[1].replace(/\s+/g, " ").trim().slice(0, 160) : null;
}

/* ------------------------------------------------------------------ *
 * Busca com redirecionamento manual
 * Cada salto é revalidado — senão um encurtador poderia levar para
 * endereço interno depois da checagem inicial.
 * ------------------------------------------------------------------ */
async function baixar(urlInicial: string, sinal: AbortSignal) {
  let url = urlInicial;

  for (let salto = 0; salto <= MAX_REDIRECIONAMENTOS; salto++) {
    const alvo = new URL(url);

    if (alvo.protocol !== "http:" && alvo.protocol !== "https:") {
      throw { codigo: "URL_INVALIDA", motivo: "O endereço precisa começar com http ou https." };
    }
    if (await hostPerigoso(alvo.hostname)) {
      throw { codigo: "URL_INVALIDA", motivo: "Endereço não permitido." };
    }
    const bloqueada = lojaBloqueada(alvo.hostname);
    if (bloqueada) {
      throw {
        codigo: "LOJA_BLOQUEADA",
        motivo: `${bloqueada} não permite a busca automática de preço. Digite o valor manualmente.`,
        loja: bloqueada,
      };
    }

    const r = await fetch(alvo.toString(), {
      redirect: "manual",
      signal: sinal,
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });

    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const destino = r.headers.get("location");
      await r.body?.cancel();
      if (!destino) throw { codigo: "SEM_PRECO", motivo: "A loja respondeu com um redirecionamento vazio." };
      url = new URL(destino, alvo).toString();
      continue;
    }

    if (r.status === 403 || r.status === 401 || r.status === 503 || r.status === 429) {
      await r.body?.cancel();
      throw {
        codigo: "BLOQUEADO_PELA_LOJA",
        motivo: "A loja recusou o acesso automático. Digite o valor manualmente.",
      };
    }
    if (!r.ok) {
      await r.body?.cancel();
      throw { codigo: "SEM_PRECO", motivo: `A loja respondeu com erro ${r.status}.` };
    }

    const tipo = r.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml|text\/plain/i.test(tipo)) {
      await r.body?.cancel();
      throw { codigo: "SEM_PRECO", motivo: "O link não aponta para uma página de produto." };
    }

    // lê em pedaços para não estourar memória com página gigante
    const leitor = r.body?.getReader();
    if (!leitor) throw { codigo: "SEM_PRECO", motivo: "A loja não devolveu conteúdo." };

    const pedacos: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      if (total + value.length > LIMITE_BYTES) {
        pedacos.push(value.subarray(0, LIMITE_BYTES - total)); // guarda só o que cabe
        total = LIMITE_BYTES;
        await leitor.cancel();
        break;
      }
      pedacos.push(value);
      total += value.length;
    }

    const buffer = new Uint8Array(total);
    let pos = 0;
    for (const p of pedacos) {
      buffer.set(p, pos);
      pos += p.length;
    }

    return { html: new TextDecoder("utf-8").decode(buffer), urlFinal: alvo.toString() };
  }

  throw { codigo: "SEM_PRECO", motivo: "O link tem redirecionamentos demais." };
}

/* ------------------------------------------------------------------ *
 * Cache e limite por usuário (memória do isolate — some no cold start;
 * é um freio, não uma contabilidade exata)
 * ------------------------------------------------------------------ */
const cache = new Map<string, { em: number; corpo: unknown }>();
const usos = new Map<string, number[]>();

function passouDoLimite(userId: string): boolean {
  const agora = Date.now();
  const janela = (usos.get(userId) ?? []).filter((t) => agora - t < 3_600_000);
  janela.push(agora);
  usos.set(userId, janela);
  return janela.length > LIMITE_POR_USUARIO;
}

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/* ------------------------------------------------------------------ */
export async function atender(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ ok: false, motivo: "Método não suportado." }, 405);

  // Quem está pedindo? A chave anônima é pública, então o que vale é o
  // token do usuário logado.
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return responder({ ok: false, codigo: "SEM_LOGIN", motivo: "Entre na sua conta para usar a busca." }, 401);
  }

  const urlSupabase = Deno.env.get("SUPABASE_URL");
  const chave = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  let userId = "";
  try {
    const r = await fetch(`${urlSupabase}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: chave },
    });
    if (!r.ok) throw new Error("token inválido");
    userId = (await r.json()).id ?? "";
  } catch {
    return responder({ ok: false, codigo: "SEM_LOGIN", motivo: "Sessão expirada. Entre novamente." }, 401);
  }
  if (!userId) {
    return responder({ ok: false, codigo: "SEM_LOGIN", motivo: "Sessão inválida." }, 401);
  }

  if (passouDoLimite(userId)) {
    return responder({
      ok: false,
      codigo: "LIMITE",
      motivo: "Muitas buscas seguidas. Espere alguns minutos e tente de novo.",
    }, 429);
  }

  let url = "";
  try {
    url = String((await req.json()).url ?? "").trim();
  } catch {
    return responder({ ok: false, codigo: "URL_INVALIDA", motivo: "Requisição inválida." }, 400);
  }
  if (!url) {
    return responder({ ok: false, codigo: "URL_INVALIDA", motivo: "Informe o link do produto." }, 400);
  }
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const emCache = cache.get(url);
  if (emCache && Date.now() - emCache.em < CACHE_MS) {
    return responder(emCache.corpo);
  }

  const ctrl = new AbortController();
  const alarme = setTimeout(() => ctrl.abort(), PRAZO_MS);

  try {
    const { html, urlFinal } = await baixar(url, ctrl.signal);

    // cascata: para no primeiro que encontrar
    const tentativas = [
      ["json-ld", viaJsonLd],
      ["meta", viaMeta],
      ["microdata", viaMicrodata],
      ["texto", viaTexto],
    ] as const;

    let metodo = "";
    let achado: { preco: number; moeda?: string; titulo?: string } | null = null;
    for (const [nome, fn] of tentativas) {
      achado = fn(html);
      if (achado) { metodo = nome; break; }
    }

    if (!achado) {
      return responder({
        ok: false,
        codigo: "SEM_PRECO",
        motivo: "Não encontrei o preço nessa página. Digite o valor manualmente.",
      });
    }

    const corpo = {
      ok: true,
      preco: Number(achado.preco.toFixed(2)),
      moeda: String(achado.moeda ?? "BRL").toUpperCase(),
      titulo: achado.titulo ?? extrairTitulo(html),
      loja: new URL(urlFinal).hostname.replace(/^www\./, ""),
      metodo,
      confianca: metodo === "texto" ? "baixa" : metodo === "microdata" ? "media" : "alta",
    };

    cache.set(url, { em: Date.now(), corpo });
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);

    return responder(corpo);
  } catch (e) {
    const erro = e as { codigo?: string; motivo?: string; name?: string; loja?: string };
    if (erro?.name === "AbortError") {
      return responder({ ok: false, codigo: "TIMEOUT", motivo: "A loja demorou demais para responder." });
    }
    if (erro?.codigo) {
      return responder({ ok: false, codigo: erro.codigo, motivo: erro.motivo, loja: erro.loja });
    }
    return responder({
      ok: false,
      codigo: "SEM_PRECO",
      motivo: "Não consegui ler essa página. Digite o valor manualmente.",
    });
  } finally {
    clearTimeout(alarme);
  }
}

// Só liga o servidor quando roda no Deno (Supabase). Assim as funções de
// leitura acima podem ser importadas e testadas fora dele —
// veja ferramentas/testar-extracao.mjs
// deno-lint-ignore no-explicit-any
const runtime = (globalThis as any).Deno;
if (runtime && typeof runtime.serve === "function") {
  runtime.serve(atender);
}
