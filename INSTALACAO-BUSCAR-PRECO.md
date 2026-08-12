# Busca automática de preço pelo link

Traz um panorama do produto a partir do link colado no FinCK of Reality:
preço atual, preço riscado com o desconto, valor à vista no Pix, parcelamento
e frete grátis — cada um aparecendo só quando a página tem aquela informação.

> **Já publicou a função antes?** O `index.ts` mudou bastante nesta versão.
> Republique — sem isso o painel não aparece e o erro do preço riscado
> continua. O passo 2 explica como.

## O que o frete faz — e o que não faz

A busca informa **frete grátis** e o valor mínimo, quando a página anuncia
isso. Ela **não calcula o frete por CEP**, e isso não é uma limitação que dê
para contornar depois: o valor do frete não está na página. Ele é calculado
por um endereço próprio de cada plataforma (Nuvemshop, Shopify, VTEX, Tray,
WooCommerce — cada uma com o seu), quase sempre exigindo carrinho, sessão e o
código da variação escolhida. Não existe um jeito que funcione em todas as
lojas, que é justamente o critério aqui.

---

## O que entra no projeto

**Arquivos novos**

| Arquivo | Para quê |
|---|---|
| `supabase/functions/buscar-preco/index.ts` | A função que lê a página da loja (roda no Supabase) |
| `js/lojas-suporte.js` | **A lista de lojas.** É aqui que você edita quando uma loja mudar |
| `js/buscar-preco.js` | Botão, aviso e modal na tela |
| `css/buscar-preco.css` | Estilo, usando as cores que o FinCK já tem |
| `ferramentas/testar-lojas.mjs` | Testa lojas de verdade e diz quais funcionam |
| `ferramentas/testar-extracao.mjs` | 69 testes da leitura, sem depender de rede |
| `ferramentas/gerar-icones.py` | Regera os ícones do app |
| `assets/icone-maskable-192.png` · `-512.png` | Ícones para o recorte do Android |

**Arquivos alterados**

| Arquivo | O que mudou |
|---|---|
| `reality.html` | Botão + painel abaixo do campo de link, o modal, e 3 linhas de `<script>`/`<link>` |
| `js/store.js` | Ganhou `tokenAcesso()` — 6 linhas, para chamar a função autenticado |
| `manifest.json` | Aponta os ícones `maskable` novos |
| `assets/icone-192.png` · `icone-512.png` · `icone-apple-180.png` | Regerados com fundo roxo |

> Se você já mexeu nesses dois arquivos depois de me mandar o projeto, não
> substitua direto: abra os dois e copie só os trechos marcados.

---

## Passo 1 — Subir os arquivos

Copie tudo mantendo as pastas. Nada mais é preciso no front: o FinCK não tem
build, os arquivos entram e já valem.

## Passo 2 — Publicar a função no Supabase

A função **não** vai junto com os arquivos do site. Ela roda no Supabase.

### Pelo painel (mais simples)

1. Abra o projeto no [supabase.com](https://supabase.com) → **Edge Functions**
2. **Deploy a new function**, nome exatamente: `buscar-preco`
3. Cole o conteúdo de `supabase/functions/buscar-preco/index.ts`
4. **Desligue a opção "Verify JWT"** e publique

> Desligar o "Verify JWT" não deixa a função aberta: ela confere o token do
> usuário por conta própria, na linha do `auth/v1/user`. O motivo de desligar
> é que o navegador manda uma requisição de checagem (OPTIONS) sem token —
> com a verificação automática ligada, essa checagem é recusada e o navegador
> nem chega a fazer a busca.

### Pela CLI

```bash
supabase functions deploy buscar-preco --no-verify-jwt
```

Não precisa cadastrar nenhuma chave: o Supabase já injeta `SUPABASE_URL` e
`SUPABASE_ANON_KEY` dentro da função.

## Passo 3 — Conferir o projeto certo

O `js/config.js` do FinCK aponta para o projeto `iruqoghylxgopbopxjbi`.
A função tem que ser publicada **nesse mesmo projeto**, senão o app chama um
endereço que não existe.

## Passo 4 — Testar

Abra o FinCK of Reality logado, cole um link de produto e clique em
**Buscar preço do link**.

---

## Como usar o `ferramentas/testar-lojas.mjs`

Este script responde de verdade a pergunta "quais lojas funcionam?", porque
roda contra a função publicada — o mesmo caminho que o app usa.

```bash
export FINCK_URL="https://iruqoghylxgopbopxjbi.supabase.co"
export FINCK_TOKEN="seu-token"     # como pegar: veja o topo do arquivo
node ferramentas/testar-lojas.mjs
```

Para testar os seus links, ponha um por linha num `.txt`:

```bash
node ferramentas/testar-lojas.mjs meus-links.txt
```

Ele imprime loja, preço encontrado, método e tempo — e, no fim, a taxa de
acerto. **Use links de produtos que estão no ar**: link vencido devolve
"não encontrei o preço" e suja o resultado.

Depois, ajuste `js/lojas-suporte.js` com o que você mediu.

---

## Editar a lista de lojas

Tudo que aparece no modal sai de `js/lojas-suporte.js`, em três listas:

```js
const BLOQUEADAS = [ … ]   // botão desativado, com o motivo explicado
const INSTAVEIS  = [ … ]   // tenta, mas avisa que pode falhar
const PROVAVEIS  = [ … ]   // costuma funcionar
```

Para mover uma loja de lugar, recorte o bloco dela e cole na outra lista:

```js
{
  nome: "Nome da Loja",
  dominios: ["loja.com.br", "atalho.com"],
  motivo: "Explicação curta, em linguagem de gente.",
}
```

Uma loja em `BLOQUEADAS` também precisa entrar no `BLOQUEADAS` de
`supabase/functions/buscar-preco/index.ts`. Os dois existem de propósito: a
tela avisa antes do clique, mas link encurtado (`amzn.to`, `shp.ee`) só revela
o destino no servidor — e aí quem barra é a função.

---

## Os ícones do app

`assets/icone-192.png`, `icone-512.png` e `icone-apple-180.png` foram regerados
com a logo sobre o gradiente roxo da marca, e entraram dois `icone-maskable-*`.

O motivo: a logo é um PNG de fundo transparente. Na tela inicial do celular o
sistema preenchia esse vazio com branco ou preto, e no formato *maskable* — que
o Android recorta em círculo ou squircle — as pontas do desenho eram cortadas.
Agora o gradiente ocupa a arte inteira e a logo fica dentro da área segura, então
qualquer recorte tira só fundo.

Como os nomes dos arquivos continuam os mesmos, **nenhum HTML precisou mudar**.
Só o `manifest.json`, que passou a apontar os dois `maskable`.

Para mexer no visual depois, edite `PARADAS` em `ferramentas/gerar-icones.py`
e rode `python3 ferramentas/gerar-icones.py` (precisa de `pip install Pillow`).

> O ícone pode demorar a trocar no celular: o sistema guarda o antigo em cache.
> Remova o app da tela inicial e adicione de novo para ver o novo.

## Como funciona a leitura

Quatro tentativas, da mais confiável para a menos:

| Ordem | Onde procura | Confiança |
|---|---|---|
| 1 | **JSON-LD** — o bloco que a loja publica para o Google Shopping | alta |
| 2 | **Meta tags** — `og:price:amount` | alta |
| 3 | **Microdata** — `itemprop="price"` | média |
| 4 | **Texto** — procura "R$" | **baixa** |

O passo 4 é o que parece o caminho natural e é o pior. Uma página de produto
tem muitos "R$":

```
De R$ 1.999,00 por R$ 1.299,90
ou 12x de R$ 108,32 sem juros
Frete: R$ 24,90
```

Pegar "o primeiro R$" traz 1.999 (preço velho). "O menor" traz o frete. Por
isso o passo 4 descarta parcela, frete e preço riscado antes de escolher — e
mesmo assim o resultado vem marcado como **confiança baixa**, e a tela pede
para você conferir.

Quando o preço vem por JSON-LD, é um número limpo, sem ambiguidade:

```json
{ "@type": "Product", "offers": { "price": "1299.90", "priceCurrency": "BRL" } }
```

### O caso do preço riscado

Nem sempre o dado estruturado está certo. Várias lojas publicam ali o preço
**cheio**, não o promocional — foi o que aconteceu no primeiro teste real, em
que a busca trouxe R$ 439,90 num produto anunciado por R$ 349,90.

A correção: quando o valor do dado estruturado é **igual ao valor riscado** da
página e o texto encontrou um menor, quem vale é o texto — o estruturado é o
preço cheio. Nesse caso a confiança cai para média e o painel avisa.

### Como o parcelamento é validado

"6x de R$ 58,32" só é aceito se `vezes × valor` fechar com o preço do produto.
É o que separa o parcelamento real de um banner de topo ("parcele em até 12x"),
que fala de outro valor e seria capturado por qualquer regex ingênua.

---

## Segurança

A função recebe um endereço digitado pelo usuário, então ela:

- exige usuário logado (o token, não a chave anônima — que é pública)
- limita a 30 buscas por hora por usuário
- recusa endereços internos (`localhost`, `10.x`, `169.254.169.254` — este
  último devolve credenciais da nuvem em vários provedores)
- revalida **cada redirecionamento**, para um encurtador não desviar o
  destino depois da checagem
- desiste em 12 s e para de baixar em 2,5 MB
- guarda o resultado por 5 min, para não bater na loja a cada clique

Nada da página lida é gravado no banco: entra o link, sai o número.

---

## Se der problema

| Sintoma | Causa provável |
|---|---|
| "Entre na sua conta para usar a busca" | Modo demonstração, ou sessão vencida |
| Erro de CORS no console | "Verify JWT" ficou ligado no deploy |
| Todo link dá "não encontrei o preço" | Função publicada em outro projeto |
| Uma loja específica falha sempre | Provavelmente é caso de `BLOQUEADAS` — teste com o script e mova de lista |
