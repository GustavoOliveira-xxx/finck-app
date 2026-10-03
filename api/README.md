# Busca de preço por IA

`buscar-preco-ia.js` é uma função serverless da Vercel. Ela recebe o link
que o usuário colou no FinCK of Reality, pede ao Gemini que leia a página
do produto e devolve o preço já no formato que o painel do app desenha.

É uma **adição**: o leitor antigo, a função `buscar-preco` do Supabase,
continua no ar e vira rede de segurança. O front-end tenta a IA primeiro e
só cai para o leitor antigo quando ela volta sem preço.

A mesma função também **lê o print da tela** do produto (veja
[Leitura do print](#leitura-do-print)). É a saída para Shopee, Amazon,
Instagram e as outras lojas que recusam a leitura do link: ali o usuário já
está vendo o preço, e o Gemini lê a imagem.

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
| `GEMINI_MODELO` | não | Modelo tentado primeiro, no link e no print. Sem ela, vale a ordem de [Modelos](#modelos-medidos-em-03102026): `gemini-3.5-flash-lite`, `gemini-3.5-flash` e `gemini-3.1-flash-lite` |
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

A busca inteira tem 52 s, abaixo dos 60 s do `vercel.json`. Antes, três
etapas com tentativas de 25 s podiam passar disso, e a Vercel cortava a
resposta antes do aviso para digitar o preço.

### Parcela que não fecha com o preço

Um preço só sai de uma etapa se a soma das parcelas fechar com ele. Quando
não fecha, a busca segue para a próxima etapa e guarda esse resultado como
reserva: se nenhuma outra resolver, ele sai sem a parcela e com
`confianca: "baixa"`, e a tela pede para conferir na loja.

O caso que motivou isso, medido em 03/10/2026: na KaBuM, o preço atual fica
num contador animado, e quando o Google abre a página ele vira
"R$ 0123456789...". O modelo lia o valor ao lado, que é o preço antigo
(R$ 488,62 num mouse de R$ 204,48), junto com a parcela do preço de verdade
(8x de R$ 25,56). Com a conferência, a busca passa para o `ia-html`, onde o
preço certo está nos dados estruturados da página.

## O que ainda não funciona

Amazon, Shopee, Mercado Livre e afins recusam acesso automático de
qualquer origem — inclusive do buscador do Google. Nessas lojas a busca
volta sem preço e o usuário digita o valor. O botão continua liberado
(vale a tentativa, o bloqueio muda com o tempo), mas o aviso na tela diz
que ali costuma falhar e sugere mandar o print, que não depende da loja.

O `motivo` que a função devolve quando falha vem do próprio modelo — é ele
que explica se a página não abriu, se não era página de produto ou se não
havia preço. Isso aparece no campo `detalhe` da resposta.

## Leitura do print

No FinCK of Reality, o botão **Ler preço de um print** (ou colar a imagem,
ou arrastá-la para o formulário) manda a imagem para esta mesma rota, com o
mesmo login e os mesmos limites do link:

```json
{ "imagem": "data:image/jpeg;base64,...", "categorias": ["Alimentação", "..."] }
```

A resposta é o mesmo panorama do link, com `metodo: "ia-print"` e quatro
campos a mais: `nomeCurto` (preenche o campo do item sem cortar palavra),
`categoria` (sempre uma das enviadas, que são as do `js/config.js`), `faixa`
(`{ min, max }` quando o preço muda por variação, e aí `preco` é o menor) e
`modelo` (qual modelo leu). `loja` é o que a IA reconheceu na imagem.

### O caminho da imagem

1. O navegador (`js/imagem-print.js`) reduz o lado maior para até 2048 px e
   converte para JPEG. Um print de celular de 1 a 4 MB chega com 100 a
   300 KB. PNG com transparência ganha fundo branco; HEIC que o navegador
   não desenha vai como está, porque o Gemini lê HEIC.
2. A função aceita até 3 MB (a Vercel recusa corpo acima de 4,5 MB, e o
   base64 cresce um terço) e confere os primeiros bytes contra o tipo
   declarado: o Gemini só recebe JPEG, PNG, WEBP ou HEIC de verdade.
3. O Gemini responde com saída estruturada (`responseSchema`). Aqui ela
   funciona porque a chamada não usa ferramenta (veja o último item deste
   README).
4. O resultado passa por conferências antes de chegar ao painel. Nos testes
   o modelo às vezes calculou uma parcela que não estava escrita, ou juntou o
   preço de uma variação com o riscado de outra:
   - parcelas que não fecham com o preço saem; se fecham, viram "sem juros";
   - riscado do tamanho do topo da faixa sai, com o desconto calculado sobre ele;
   - categoria fora da lista enviada é ignorada.
5. A mesma imagem lida de novo em 5 minutos vem do cache (pelo hash), sem
   gastar cota. A imagem em si não é guardada nem registrada em log.

### Modelos, medidos em 03/10/2026

A ordem é a mesma para o link e para o print. Com os oito prints de teste
(`ferramentas/prints-exemplo`) e com links reais da KaBuM:

| Ordem | Modelo | Resultado |
|---|---|---|
| 1 | `gemini-3.5-flash-lite` | 8 de 8 prints certos, 1,8 s de mediana; abre o link pelo `url_context` em 1,5 a 3 s |
| 2 | `gemini-3.5-flash` | também acerta, mas leva de 9 a 23 s |
| 3 | `gemini-3.1-flash-lite` | acerta quando responde, mas deu 503 em 3 de 8 |

Quando um modelo responde 429, 500 ou 503, ou estoura o prazo da tentativa
(20 s no print, 25 s no link), a função passa para o próximo, dentro do
prazo total (50 s no print, 52 s no link). Os da família 2.5 já respondem
404 para chaves novas e ficaram de fora. A resposta traz em `modelo` qual
deles leu.

### Plano gratuito do Gemini

Na chave gratuita, o `gemini-3.5-flash` aceitou **5 pedidos por minuto e 20
por dia**, para o projeto inteiro (todos os usuários somados). É por isso
que ele não é o primeiro, nem no link nem no print.

Cada modelo tem a própria cota, então a lista de reserva aumenta o total do
dia. Quando todos estão cheios, a resposta é `IA_OCUPADA` e a tela pede
para tentar em um minuto ou digitar o preço. Para uso de verdade, ligar o
faturamento da chave no AI Studio acaba com esse aperto. Um print gasta
perto de 1.700 tokens de entrada e 200 de saída; nos preços da linha
flash-lite isso fica em fração de centavo, mas confira a tabela atual do
Google antes de ligar.

**Privacidade.** Pelos termos do Gemini, o conteúdo enviado no plano
gratuito pode ser usado pelo Google para melhorar os produtos dele. Por isso
a tela diz que a imagem é lida pela IA do Google e pede para evitar prints
com dados pessoais (endereço de entrega, nome, notificações). Com o
faturamento ligado, esse uso deixa de valer.

### Situação da rota (GET)

`GET /api/buscar-preco-ia` responde `{ ok, ia, demo, print }` sem login e
sem gastar cota. A tela usa isso para desligar o botão do print antes de o
usuário ir buscar uma imagem: sem chave no servidor, ou na demonstração
com `BUSCA_IA_DEMO` desligada.

### Códigos de erro do print

| Código | Quando |
|---|---|
| `IMAGEM_INVALIDA` | tipo fora da lista, arquivo corrompido, acima de 3 MB, ou imagem que o Gemini não abriu |
| `SEM_PRECO` | a imagem não mostra um produto à venda com preço legível; `detalhe` traz o motivo dado pela IA |
| `IA_OCUPADA` | todos os modelos responderam 429 ou 503, ou estouraram o prazo |
| `IA_FALHOU` | outro erro do Gemini; o texto original vai em `tecnico` |

`SEM_LOGIN`, `LIMITE`, `ORIGEM_NAO_PERMITIDA` e `IA_INDISPONIVEL` valem como
no link.

### Como testar

```bash
node ferramentas/testar-print.mjs                  # sem rede, Gemini simulado
GEMINI_API_KEY=<chave> node ferramentas/testar-print.mjs --ao-vivo
FINCK_API=https://finck-app.vercel.app FINCK_TOKEN=<jwt> \
  node ferramentas/testar-print.mjs --ao-vivo      # contra o deploy
```

O modo `--ao-vivo` lê os prints de `ferramentas/prints-exemplo` e compara
com `esperado.json`. Quando um modelo for aposentado ou trocado, é este
teste que diz se a leitura continua certa.

## Contrato da resposta

É o mesmo da função do Supabase, mais os campos `fonte` e `metodo`, para o
app saber de onde veio o número e ajustar o aviso de confiança, e `modelo`,
que diz qual modelo leu:

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
  "confianca": "alta",
  "modelo": "gemini-3.5-flash-lite"
}
```

`moeda` é a moeda que a página exibe, não a do usuário: preço em dólar
volta como `USD` e o app avisa na tela em vez de converter por conta
própria. O painel mostra o valor na moeda original (US$ 23,45) e o campo de
preço não é preenchido: quem converte e digita em reais é o usuário.

Quando falha: `{ "ok": false, "codigo": "...", "motivo": "...", "detalhe": "..." }`.
Os códigos são `SEM_LOGIN`, `LIMITE`, `URL_INVALIDA`, `SEM_PRECO` e
`IA_INDISPONIVEL` (esse último quando falta a `GEMINI_API_KEY`). O print
tem também os seus, na seção [Leitura do print](#códigos-de-erro-do-print).

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

O print não usa ferramenta nenhuma, então ali o esquema vai e o JSON chega
no formato. `chamarGemini` só manda o esquema quando a lista de
ferramentas está vazia, para essa trava não voltar por descuido.
