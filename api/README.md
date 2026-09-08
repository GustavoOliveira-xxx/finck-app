# Busca de preço por IA

`buscar-preco-ia.js` é uma função serverless da Vercel. Ela recebe o link
que o usuário colou no FinCK of Reality, pede ao Gemini que leia a página
do produto e devolve o preço já no formato que o painel do app desenha.

É uma **adição**: o leitor antigo, a função `buscar-preco` do Supabase,
continua no ar e vira rede de segurança. O front-end tenta a IA primeiro e
só cai para o leitor antigo quando ela volta sem preço.

## Por que a chave fica aqui, e não no navegador

Chave de API no `js/config.js` é chave pública — qualquer pessoa lê o
código da página e usa a sua cota. A chave do Gemini vive só como variável
de ambiente da Vercel; o navegador fala com esta função, e só ela fala com
o Google.

Pelo mesmo motivo a função exige o JWT do Supabase e limita 30 buscas por
usuário por hora: sem isso, o endereço público seria uma torneira aberta
para a cota da chave.

## Variáveis de ambiente

Painel da Vercel → o projeto → *Settings* → *Environment Variables*.
Marque os três ambientes (Production, Preview, Development).

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `GEMINI_API_KEY` | sim | Chave do Google AI Studio |
| `GEMINI_MODELO` | não | Modelo preferido. Padrão: `gemini-3.5-flash`, com `gemini-3.1-flash-lite` de reserva |
| `GEMINI_BUSCA_GOOGLE` | não | `1` liga a busca na web como último recurso |
| `BUSCA_IA_DEMO` | não | `1` libera a busca **sem login**, para o modo demonstração |
| `BUSCA_IA_ORIGENS` | não | Origens aceitas, separadas por vírgula. Padrão: a origem do deploy + `localhost` |
| `BUSCA_IA_TETO_DIA` | não | Teto global de chamadas por dia. Padrão: `400` |
| `SUPABASE_URL` | não | Padrão: o projeto que está em `js/config.js` |
| `SUPABASE_ANON_KEY` | não | Chave pública, idem |

Variável nova só vale depois de um novo deploy — *Deployments* → o último
→ *Redeploy*.

### Sobre `BUSCA_IA_DEMO`

Com `BUSCA_IA_DEMO=1`, esta rota passa a responder a quem não tem conta — que
é o que permite demonstrar a busca no modo demo. Em troca, ela vira um endpoint
público, e por isso se defende sozinha:

- **Origem**: pedidos sem login só passam se o cabeçalho `Origin` estiver em
  `BUSCA_IA_ORIGENS`. Sem a variável, vale a própria origem do deploy e o
  `localhost`.
- **Por IP**: 8 buscas por hora para quem não está logado (contra 30 por hora
  por usuário logado).
- **Teto do dia**: `BUSCA_IA_TETO_DIA` corta o total de chamadas, logado ou não.
  É um freio contra esgotar a cota da chave, não uma contabilidade exata — a
  instância serverless pode ser reciclada e zerar a contagem.

A `GEMINI_API_KEY` **nunca** vai para o navegador: ela existe só aqui, no
servidor. Não coloque a chave em `js/config.js` nem em qualquer arquivo do
front-end — tudo que está lá é público para quem abrir o site.

Se a chave vazar (ou se você desconfiar disso), revogue em
<https://aistudio.google.com/apikey> e gere outra. Trocar a variável na Vercel
e redeployar é o suficiente do lado do app.

## As três tentativas

A função tenta, em ordem, e para na primeira que trouxer preço:

| Método | Como funciona | Quando entra |
|---|---|---|
| `ia-url` | Ferramenta `url_context`: o próprio Google abre a página | sempre, primeiro |
| `ia-html` | A Vercel baixa o HTML e manda o conteúdo limpo para o modelo | quando o Google é barrado pela loja |
| `ia-busca` | Ferramenta `google_search`: procura o preço na web | só com `GEMINI_BUSCA_GOOGLE=1` |

O `ia-url` só é aceito quando o Google confirma que abriu a página
(`URL_RETRIEVAL_STATUS_SUCCESS`). Sem essa trava o modelo responderia de
memória, com preço desatualizado, e o usuário não teria como saber.

O `ia-html` existe porque os dois buscadores são barrados por lojas
diferentes: o IP da Vercel passa em sites que recusam o do Google, e
vice-versa. Duas portas cobrem mais lojas do que uma.

O `ia-busca` fica desligado porque **a cota dessa ferramenta é zero no
plano gratuito do Gemini** — ligada numa chave gratuita, toda chamada volta
`429`. Ligue quando a chave virar paga.

## O que ainda não funciona

Amazon, Shopee, Mercado Livre e afins recusam acesso automático de
qualquer origem — inclusive do buscador do Google. Nessas lojas a busca
volta sem preço e o usuário digita o valor. O botão continua liberado
(vale a tentativa, o bloqueio muda com o tempo), mas o aviso na tela diz
que ali costuma falhar.

O `motivo` que a função devolve quando falha vem do próprio modelo — é ele
que explica se a página não abriu, se não era página de produto ou se não
havia preço. Isso aparece no campo `detalhe` da resposta.

## Contrato da resposta

É o mesmo da função do Supabase, mais os campos `fonte` e `metodo`, para o
app saber de onde veio o número e ajustar o aviso de confiança:

```json
{
  "ok": true,
  "preco": 137.79,
  "precoOriginal": 189.9,
  "desconto": { "valor": 52.11, "percentual": 27.4 },
  "aVista": { "valor": 130.9, "forma": "Pix", "percentual": 5 },
  "parcelamento": { "vezes": 10, "valor": 13.78, "semJuros": true, "total": 137.8 },
  "frete": { "gratis": true },
  "moeda": "BRL",
  "titulo": "Celular Multilaser Vita",
  "loja": "kabum.com.br",
  "metodo": "ia-url",
  "fonte": "ia",
  "confianca": "alta"
}
```

`moeda` é a moeda que a página exibe, não a do usuário: preço em dólar
volta como `USD` e o app avisa na tela em vez de converter por conta
própria.

Quando falha: `{ "ok": false, "codigo": "...", "motivo": "...", "detalhe": "..." }`.
Os códigos são `SEM_LOGIN`, `LIMITE`, `URL_INVALIDA`, `SEM_PRECO` e
`IA_INDISPONIVEL` (esse último quando falta a `GEMINI_API_KEY`).

## Como medir

```bash
FINCK_API=https://finck-app.vercel.app FINCK_TOKEN=<jwt> \
  node ferramentas/testar-busca-ia.mjs
```

O token é o `access_token` da sessão. Com o app aberto e logado, rode
`await FinckStore.tokenAcesso()` no console do navegador.

Passe um arquivo com um link por linha para testar a sua própria lista.
Atualize `js/lojas-suporte.js` conforme o que medir: as lojas que passarem
a funcionar podem sair da lista de bloqueadas.

## Detalhe de implementação que economiza uma hora de depuração

`responseSchema` (saída estruturada) **trava** quando combinado com
`url_context` ou `google_search`: a chamada fica pendurada até o timeout,
sem erro. Por isso o formato do JSON vai escrito no prompt e a resposta
passa por um extrator tolerante, que aceita o JSON embrulhado em
` ```json ` ou dentro de uma frase.
