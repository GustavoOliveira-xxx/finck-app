/**
 * FinCK — busca automática do preço a partir do link do produto.
 *
 * Por que isto existe no servidor: o navegador não consegue ler a página de
 * outra loja (o CORS bloqueia). Esta função faz a leitura do lado de fora e
 * devolve só o número.
 *
 * O difícil não é achar um preço na página: é achar muitos e saber qual vale.
 * Uma página em promoção mostra o preço cheio riscado, o promocional, o do
 * Pix, o da parcela e o do frete — e o dado estruturado nem sempre traz o
 * certo (várias lojas publicam ali o preço de tabela).
 *
 * Por isso a leitura junta evidências em vez de seguir uma cascata fixa:
 *
 *   1. "De R$ X por R$ Y"  — a página declarando os dois papéis
 *   2. Selo de desconto    — "20% OFF" prova qual par de valores fecha
 *   3. Marcação de riscado — <del>, <s>, style com line-through
 *   4. Vários preços no dado estruturado — o menor é o promocional
 *   5. Texto com "R$"      — último recurso, descartando parcela e frete
 *
 * Mandar `{ "diagnostico": true }` no corpo devolve tudo que foi encontrado,
 * para quando uma loja específica continuar errando.
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
 * Leitura de preço
 *
 * A versão anterior decidia qual valor era o "de" e qual era o "por" pelo
 * nome da classe CSS do elemento. Isso quebra: cada loja nomeia como quer, e
 * quando o nome não estava na lista o preço riscado passava como se fosse o
 * preço válido.
 *
 * Agora a decisão vem de sinais que não dependem de classe:
 *
 *   1. "De R$ X por R$ Y"   — a própria página dizendo qual é qual
 *   2. O selo de desconto   — "20% OFF" prova qual par de valores fecha
 *   3. Vários preços no dado estruturado — o menor é o promocional
 *   4. Marcação de riscado  — <del>, <s> e style com line-through
 *   5. Classe CSS           — só como reforço, nunca sozinha
 *
 * Cada sinal encontrado vira uma evidência; a decisão pesa todas.
 * ------------------------------------------------------------------ */

/** Texto da página sem marcação, para as buscas que dependem de frase. */
const semTags = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#3[69];|&quot;|&amp;/gi, " ")
    .replace(/\s+/g, " ");

/* ---------- 1. Dado estruturado ---------- */

/**
 * Todos os preços do JSON-LD, não só o primeiro.
 *
 * Muita loja publica dois: o de tabela e o promocional. Pegar o primeiro que
 * aparece é sorteio — e foi assim que o preço cheio virou o preço exibido.
 */
export function valoresJsonLd(html: string): {
  valores: number[];
  moeda?: string;
  titulo?: string;
} {
  const blocos = [...html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )];

  const valores: number[] = [];
  let moeda: string | undefined;
  let titulo: string | undefined;

  for (const bloco of blocos) {
    let dados: unknown;
    try {
      dados = JSON.parse(bloco[1].trim());
    } catch {
      continue;
    }

    const fila: unknown[] = Array.isArray(dados) ? [...dados] : [dados];
    let visitados = 0;

    while (fila.length && visitados++ < 800) {
      const no = fila.shift() as Record<string, unknown>;
      if (!no || typeof no !== "object") continue;

      const tipo = ([] as unknown[]).concat(no["@type"] ?? []).join(",");

      if (/Product/i.test(tipo) && typeof no.name === "string" && !titulo) {
        titulo = no.name;
      }

      if (/Product|Offer|AggregateOffer|UnitPriceSpecification|PriceSpecification/i.test(tipo)
          || no.price !== undefined || no.lowPrice !== undefined) {
        for (const campo of ["price", "lowPrice", "highPrice"]) {
          const v = paraNumero((no as Record<string, unknown>)[campo]);
          if (v) valores.push(v);
        }
        if (typeof no.priceCurrency === "string" && !moeda) moeda = no.priceCurrency;
      }

      for (const v of Object.values(no)) {
        if (v && typeof v === "object") fila.push(v);
      }
    }
  }

  return { valores: [...new Set(valores)], moeda, titulo };
}

export function valoresMeta(html: string): { valores: number[]; moeda?: string } {
  const valores: number[] = [];
  const nomes = "og:price:amount|product:price:amount";
  for (const m of html.matchAll(
    new RegExp(`<meta[^>]*(?:property|name)=["'](?:${nomes})["'][^>]*content=["']([^"']+)["']`, "gi"),
  )) {
    const v = paraNumero(m[1]);
    if (v) valores.push(v);
  }
  for (const m of html.matchAll(
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:${nomes})["']`, "gi"),
  )) {
    const v = paraNumero(m[1]);
    if (v) valores.push(v);
  }
  const cur = html.match(
    /<meta[^>]*(?:property|name)=["'](?:og:price:currency|product:price:currency)["'][^>]*content=["']([^"']+)["']/i,
  );
  return { valores: [...new Set(valores)], moeda: cur?.[1] };
}

export function valoresMicrodata(html: string): number[] {
  const valores: number[] = [];
  for (const m of html.matchAll(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/gi)) {
    const v = paraNumero(m[1]);
    if (v) valores.push(v);
  }
  for (const m of html.matchAll(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/gi)) {
    const v = paraNumero(m[1]);
    if (v) valores.push(v);
  }
  return [...new Set(valores)];
}

/* ---------- 2. "De X por Y" ---------- */

/**
 * O sinal mais direto que existe: a página declarando os dois papéis.
 * Aceita "de R$ X por R$ Y" e "de R$ X por apenas R$ Y".
 */
export function parDePor(html: string): { de: number; por: number } | null {
  const texto = semTags(html);
  const re = /\bde\s*:?\s*R\$\s*([\d.,]+)\s*(?:por|até)\s*(?:apenas\s*)?R\$\s*([\d.,]+)/gi;
  for (const m of texto.matchAll(re)) {
    const de = paraNumero(m[1]);
    const por = paraNumero(m[2]);
    if (de && por && por < de) return { de, por };
  }
  return null;
}

/* ---------- 3. Selo de desconto ---------- */

/**
 * "20% OFF", "-20%", "20% de desconto".
 *
 * Sozinho não diz preço nenhum, mas prova qual par de valores está certo:
 * de 439,90 para 349,90 dá 20%; para 339,40 daria 23%. É o desempate que
 * não depende de como a loja nomeia as coisas.
 */
export function descontoAnunciado(html: string): number | null {
  const texto = semTags(html);
  const achados: number[] = [];
  for (const m of texto.matchAll(/(\d{1,2})\s*%\s*(?:off|de\s*desconto|desconto)/gi)) {
    const n = Number(m[1]);
    if (n >= 3 && n <= 95) achados.push(n);
  }
  for (const m of texto.matchAll(/-\s*(\d{1,2})\s*%/g)) {
    const n = Number(m[1]);
    if (n >= 3 && n <= 95) achados.push(n);
  }
  if (!achados.length) return null;
  // o maior selo costuma ser o do produto; os menores são de pix/cupom
  return Math.max(...achados);
}

/* ---------- 4. Marcação de riscado ---------- */

const CLASSES_RISCADO =
  /(?:old-?price|price--old|price-old|preco-?antigo|preco-?de|de-por__de|list-?price|compare-at|regular-price|riscado|was-price|valor-?antigo|preco-?cheio|antes)/i;

/**
 * Preços marcados como antigos.
 *
 * Três caminhos, do mais confiável ao menos: a tag <del>/<s>, o estilo
 * line-through escrito no próprio elemento, e por fim o nome da classe.
 */
export function valoresRiscados(html: string): number[] {
  const achados: number[] = [];

  const primeiro = (trecho: string) => {
    const m = trecho.match(/R\$\s*([\d.,]+)/i);
    return m ? paraNumero(m[1]) : null;
  };

  for (const m of html.matchAll(/<(?:del|s)\b[^>]*>([\s\S]{0,260}?)<\/(?:del|s)>/gi)) {
    const v = primeiro(m[1]);
    if (v) achados.push(v);
  }

  for (const m of html.matchAll(/style=["'][^"']*line-through[^"']*["']/gi)) {
    const v = primeiro(html.slice(m.index ?? 0, (m.index ?? 0) + 260));
    if (v) achados.push(v);
  }

  for (const m of html.matchAll(/class=["']([^"']*)["']/gi)) {
    if (!CLASSES_RISCADO.test(m[1])) continue;
    const v = primeiro(html.slice(m.index ?? 0, (m.index ?? 0) + 260));
    if (v) achados.push(v);
  }

  return [...new Set(achados)];
}

/* ---------- 5. Candidatos do texto ---------- */

function tagAnterior(antes: string): string {
  const i = antes.lastIndexOf("<");
  if (i === -1) return "";
  const fim = antes.indexOf(">", i);
  return fim === -1 ? antes.slice(i) : antes.slice(i, fim + 1);
}

function dentroDeRiscado(antes: string): boolean {
  const abre = Math.max(
    antes.lastIndexOf("<del"), antes.lastIndexOf("<s>"), antes.lastIndexOf("<s "),
  );
  if (abre === -1) return false;
  const fecha = Math.max(antes.lastIndexOf("</del>"), antes.lastIndexOf("</s>"));
  return abre > fecha;
}

/**
 * Todo "R$" da página que pode ser o preço do produto, com um peso.
 *
 * Descarta o que sabidamente não é: parcela, frete, cashback, cupom e o que
 * está dentro de marcação de riscado.
 */
export function candidatosTexto(html: string): { valor: number; peso: number }[] {
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
    const depois = limpo.slice(re.lastIndex, re.lastIndex + 60)
      .replace(/<[^>]+>/g, " ").toLowerCase();

    if (/\d+\s*x\s*(de\s*)?$/.test(antesTexto)) continue;
    if (/^\s*(sem|com)\s+juros/.test(depois)) continue;
    if (/frete|entrega|cashback|desconto|economi[ae]|cupom|juros|por m[êe]s|mensal|assinatura/
      .test(antesTexto.slice(-55))) continue;

    if (dentroDeRiscado(antes)) continue;

    const tag = tagAnterior(antes);
    if (CLASSES_RISCADO.test(tag)) continue;

    let peso = 1;
    if (/(à\s*vista|a\s*vista|no\s*pix|por\s*apenas|por:?)\s*$/.test(antesTexto.slice(-28))) peso += 4;
    if (/pric(e|ing)|pre[cç]o|valor|sale|best-?price|melhor\s*pre/i.test(tag)) peso += 2;

    pontos.set(valor, (pontos.get(valor) ?? 0) + peso);
  }

  return [...pontos.entries()]
    .map(([valor, peso]) => ({ valor, peso }))
    .sort((a, b) => b.peso - a.peso);
}

export function extrairTitulo(html: string): string | null {
  const og = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (og) return og[1].trim().slice(0, 160);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? t[1].replace(/\s+/g, " ").trim().slice(0, 160) : null;
}

/* ---------- Parcelamento, à vista e frete ---------- */

export function acharParcelamento(
  html: string,
  precoAtual: number,
): { vezes: number; valor: number; semJuros: boolean; total: number } | null {
  const texto = semTags(html);
  let melhor: { vezes: number; valor: number; semJuros: boolean; total: number } | null = null;

  for (const m of texto.matchAll(/(\d{1,2})\s*x\s*(?:de\s*)?R\$\s*([\d.,]+)/gi)) {
    const vezes = Number(m[1]);
    const valor = paraNumero(m[2]);
    if (!valor || vezes < 2 || vezes > 24) continue;

    const total = vezes * valor;
    const depois = texto.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 40)
      .toLowerCase();
    const semJuros = /sem\s*juros/.test(depois);
    const comJuros = /com\s*juros/.test(depois);

    const bate = Math.abs(total - precoAtual) / precoAtual <= 0.03;
    const bateComJuros = comJuros && total > precoAtual && total <= precoAtual * 1.5;
    if (!bate && !bateComJuros) continue;

    if (!melhor || vezes > melhor.vezes) {
      melhor = { vezes, valor, semJuros, total: Number(total.toFixed(2)) };
    }
  }
  return melhor;
}

export function acharAVista(
  html: string,
  precoAtual: number,
): { valor: number; forma: string; percentual: number } | null {
  const texto = semTags(html);
  const FORMAS = /(no\s*pix|com\s*pix|via\s*pix|pix|à\s*vista|a\s*vista|no\s*boleto|boleto)/i;
  const candidatos: { valor: number; forma: string }[] = [];

  const registrar = (bruto?: string, formaBruta?: string) => {
    const valor = paraNumero(bruto);
    if (!valor || !formaBruta) return;
    if (valor > precoAtual || valor < precoAtual * 0.5) return;
    candidatos.push({
      valor,
      forma: /pix/i.test(formaBruta) ? "Pix" : /boleto/i.test(formaBruta) ? "boleto" : "à vista",
    });
  };

  for (const m of texto.matchAll(new RegExp(`R\\$\\s*([\\d.,]+)[^\\d]{0,25}?${FORMAS.source}`, "gi"))) {
    registrar(m[1], m[2]);
  }
  for (const m of texto.matchAll(new RegExp(`${FORMAS.source}[^\\d]{0,25}?R\\$\\s*([\\d.,]+)`, "gi"))) {
    registrar(m[2], m[1]);
  }

  if (!candidatos.length) return null;
  const melhor = candidatos.sort((a, b) => a.valor - b.valor)[0];
  return {
    valor: melhor.valor,
    forma: melhor.forma,
    percentual: Number((((precoAtual - melhor.valor) / precoAtual) * 100).toFixed(1)),
  };
}

export function acharFrete(html: string): { gratis: boolean; minimo?: number } | null {
  const texto = semTags(html);
  const comMinimo = texto.match(
    /frete\s*gr[áa]tis[^.!?]{0,70}?(?:acima|a\s*partir)\s*de\s*R\$\s*([\d.,]+)/i,
  );
  if (comMinimo) {
    const minimo = paraNumero(comMinimo[1]);
    return minimo ? { gratis: true, minimo } : { gratis: true };
  }
  if (/frete\s*gr[áa]tis/i.test(texto)) return { gratis: true };
  return null;
}

/* ---------- A decisão ---------- */

export interface Panorama {
  preco: number;
  precoOriginal?: number;
  desconto?: { valor: number; percentual: number };
  aVista?: { valor: number; forma: string; percentual: number };
  parcelamento?: { vezes: number; valor: number; semJuros: boolean; total: number };
  frete?: { gratis: boolean; minimo?: number };
  moeda: string;
  titulo?: string | null;
  metodo: string;
  confianca: "alta" | "media" | "baixa";
  diagnostico?: Record<string, unknown>;
}

const perto = (a: number, b: number, tol = 0.015) => Math.abs(a - b) / Math.max(a, b) <= tol;

export function montarPanorama(html: string, comDiagnostico = false): Panorama | null {
  const ld = valoresJsonLd(html);
  const meta = valoresMeta(html);
  const micro = valoresMicrodata(html);
  const riscados = valoresRiscados(html);
  const texto = candidatosTexto(html);
  const par = parDePor(html);
  const selo = descontoAnunciado(html);

  const estruturados = [...new Set([...ld.valores, ...meta.valores, ...micro])];
  const metodoBase = ld.valores.length ? "json-ld"
    : meta.valores.length ? "meta"
    : micro.length ? "microdata"
    : "texto";

  // Todo valor plausível da página, para o selo de desconto poder cruzar.
  const universo = [...new Set([...estruturados, ...riscados, ...texto.map((t) => t.valor)])]
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  let atual: number | null = null;
  let original: number | null = null;
  let metodo = metodoBase;

  // 1. A página diz explicitamente "de X por Y" — nada supera isso.
  if (par) {
    atual = par.por;
    original = par.de;
    metodo = "de-por";
  }

  // 2. O selo de desconto aponta o par certo.
  if (atual === null && selo && universo.length >= 2) {
    let melhorPar: { de: number; por: number; erro: number } | null = null;
    for (const de of universo) {
      for (const por of universo) {
        if (por >= de) continue;
        const pct = ((de - por) / de) * 100;
        const erro = Math.abs(pct - selo);
        if (erro > 1.6) continue;
        if (!melhorPar || erro < melhorPar.erro) melhorPar = { de, por, erro };
      }
    }
    if (melhorPar) {
      atual = melhorPar.por;
      original = melhorPar.de;
      metodo = `${metodoBase}+selo`;
    }
  }

  // 3. Há marcação de riscado: o riscado é o "de", e o "por" é o melhor
  //    candidato que seja menor que ele.
  if (atual === null && riscados.length) {
    const maiorRiscado = Math.max(...riscados);
    const abaixo = universo.filter((v) => v < maiorRiscado);
    if (abaixo.length) {
      const doTexto = texto.find((t) => t.valor < maiorRiscado);
      const estruturadoAbaixo = estruturados.filter((v) => v < maiorRiscado).sort((a, b) => a - b)[0];
      atual = estruturadoAbaixo ?? doTexto?.valor ?? Math.max(...abaixo);
      original = maiorRiscado;
      metodo = `${metodoBase}+riscado`;
    }
  }

  // 4. O dado estruturado trouxe mais de um preço: o menor é o promocional.
  if (atual === null && estruturados.length > 1) {
    const ordenado = [...estruturados].sort((a, b) => a - b);
    atual = ordenado[0];
    const maior = ordenado[ordenado.length - 1];
    if (maior > atual * 1.02) original = maior;
    metodo = `${metodoBase}+menor`;
  }

  // 5. Caminho simples: um preço estruturado só, ou nada além do texto.
  if (atual === null) {
    atual = estruturados[0] ?? texto[0]?.valor ?? null;
  }
  if (atual === null) return null;

  // Rede de segurança: se o valor escolhido está marcado como riscado e
  // existe um candidato de texto menor, o escolhido era o preço cheio.
  if (riscados.some((r) => perto(r, atual as number))) {
    const menor = texto.find((t) => t.valor < (atual as number));
    if (menor) {
      original = atual;
      atual = menor.valor;
      metodo = `${metodoBase}+correcao`;
    }
  }

  if (original !== null && original <= atual * 1.01) original = null;

  const panorama: Panorama = {
    preco: Number(atual.toFixed(2)),
    moeda: String(ld.moeda ?? meta.moeda ?? "BRL").toUpperCase(),
    titulo: ld.titulo ?? extrairTitulo(html),
    metodo,
    confianca:
      metodo === "de-por" || metodo.includes("selo") ? "alta"
      : metodo === "texto" ? "baixa"
      : metodo.includes("correcao") || metodo === "microdata" ? "media"
      : metodo.includes("riscado") || metodo.includes("menor") ? "alta"
      : "alta",
  };

  if (original !== null) {
    panorama.precoOriginal = Number(original.toFixed(2));
    const valor = panorama.precoOriginal - panorama.preco;
    panorama.desconto = {
      valor: Number(valor.toFixed(2)),
      percentual: Number(((valor / panorama.precoOriginal) * 100).toFixed(1)),
    };
  }

  const aVista = acharAVista(html, panorama.preco);
  if (aVista && aVista.percentual > 0) panorama.aVista = aVista;

  const parcelamento = acharParcelamento(html, panorama.preco);
  if (parcelamento) panorama.parcelamento = parcelamento;

  const frete = acharFrete(html);
  if (frete) panorama.frete = frete;

  // Modo diagnóstico: quando um site continua errando, é isto que mostra o
  // que a função enxergou, sem precisar adivinhar.
  if (comDiagnostico) {
    panorama.diagnostico = {
      jsonLd: ld.valores,
      meta: meta.valores,
      microdata: micro,
      riscados,
      texto: texto.slice(0, 12),
      parDePor: par,
      seloDesconto: selo,
      universo,
    };
  }

  return panorama;
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
  let diagnostico = false;
  try {
    const corpo = await req.json();
    url = String(corpo.url ?? "").trim();
    diagnostico = corpo.diagnostico === true;
  } catch {
    return responder({ ok: false, codigo: "URL_INVALIDA", motivo: "Requisição inválida." }, 400);
  }
  if (!url) {
    return responder({ ok: false, codigo: "URL_INVALIDA", motivo: "Informe o link do produto." }, 400);
  }
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  // O diagnóstico ignora o cache de propósito: quem está investigando um site
  // precisa do que a página devolve agora, não do que devolveu há cinco minutos.
  const emCache = cache.get(url);
  if (!diagnostico && emCache && Date.now() - emCache.em < CACHE_MS) {
    return responder(emCache.corpo);
  }

  const ctrl = new AbortController();
  const alarme = setTimeout(() => ctrl.abort(), PRAZO_MS);

  try {
    const { html, urlFinal } = await baixar(url, ctrl.signal);

    const panorama = montarPanorama(html, diagnostico);

    if (!panorama) {
      return responder({
        ok: false,
        codigo: "SEM_PRECO",
        motivo: "Não encontrei o preço nessa página. Digite o valor manualmente.",
      });
    }

    const corpo = {
      ok: true,
      ...panorama,
      loja: new URL(urlFinal).hostname.replace(/^www\./, ""),
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
