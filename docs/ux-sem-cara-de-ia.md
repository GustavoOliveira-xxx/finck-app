# Terceira rodada de UX: um FinCK que calcula primeiro

Este documento registra a terceira rodada de revisão da experiência do FinCK
(outubro de 2026). O objetivo foi tirar do produto a "cara de IA": a sensação
de que o aplicativo é uma interface de inteligência artificial com algumas
funções financeiras, e não um instrumento de decisão financeira com cálculos
próprios. As rodadas anteriores estão em `docs/ux-melhorias.md` (seções 1 a
5); quando houver divergência, vale o que está aqui.

Frase-guia da rodada: **o FinCK calcula primeiro, você decide, e a IA só ajuda
se você pedir.**

## 1. Problema

Um aplicativo parece "gerado por IA" por dois motivos diferentes, e os dois
pesam num produto financeiro:

1. **Aparência de modelo pronto.** Muitos cartões equivalentes, gradientes e
   brilhos sem função, botões em forma de pílula com luz que atravessa,
   títulos em degradê, rótulos em caixa alta com letras espaçadas e emoji
   nos títulos. Cada elemento pode ser bonito, mas o conjunto sugere uma
   interface montada por combinação de padrões, sem decisões sobre o que é
   importante.
2. **A IA como protagonista.** A interface anuncia inteligência em toda parte
   (símbolo ✦, "Análise FinCK", "FINCK AI", "Assistente", "Converse sobre
   esta compra", "Gerar plano") até onde basta mostrar uma conta. Isso cria a
   expectativa de um chatbot, desloca a atenção do resultado e faz a pessoa
   desconfiar de que o número veio de um modelo de linguagem, quando na
   verdade veio de uma regra verificável.

Em finanças pessoais, confiança depende de números reproduzíveis e de saber
de onde cada resposta veio. Por isso a rodada não removeu funcionalidades:
reorganizou o que aparece primeiro e mudou como cada coisa se apresenta.

## 2. Método

- **Duas auditorias externas** da versão publicada depois da segunda rodada
  (commit a728583): a auditoria A, feita com o ChatGPT, com foco em identidade
  própria e hierarquia; e a auditoria B, feita com o Manus, com foco em
  reduzir a presença de IA e em critérios de aceite verificáveis.
- **Síntese e decisões do autor**: onde as duas concordam, onde divergem e o
  que foi decidido (seção 4).
- **Leitura do código e medições em navegador** (Chromium automatizado, modo
  demonstração, 320, 375, 390, 768 e 1280 px de largura): texto visível de
  cada tela, distâncias até a ação principal, pedidos de rede ao abrir cada
  página e contagem de termos de IA.
- **Implementação em cinco pacotes** (fluxo do Reality; pontos, dúvida e
  linha do tempo; home, entrada e acabamento; Revisão financeira; demais
  telas), cada um com antes e depois medidos.
- **Testes automatizados** em cada etapa (suíte do navegador em
  `testes.html` e ferramentas em `ferramentas/`).

## 3. Diagnóstico e o que mudou, tela por tela

### 3.1 FinCK of Reality

| O que dava cara de IA | Antes | Depois |
|---|---|---|
| Termos de IA no caminho principal (demonstração, depois de uma análise) | 9 ocorrências de "IA", "Google", ✦ ou "FINCK AI" no texto visível | 0 |
| Recurso desligado à vista | botão de imagem desligado "reservado a contas reais, porque usa a IA do servidor" e "Salvar decisão" desligado | nenhum; a importação explica que funciona com uma conta, e "Salvar decisão" pede uma escolha |
| Entrada | bloco aberto "Não quer digitar o preço?" com "A IA do Google lê a imagem" antes do botão | item, preço e "Calcular o impacto"; imagem e página em "Importar preço", recolhido, com "Revise antes de usar" |
| Carregamento | "✦ Análise FinCK" e etapas genéricas | "Lendo seus dados registrados…", "Calculando o peso no mês…", "Verificando suas metas…", "Comparando cenários…", "Resultado pronto." |
| Bloco de análise | "✦ Análise FinCK", "Encontramos N pontos", até três pontos numerados, dois detalhes por ponto, "✦ Nossa leitura" | "O que merece atenção", no máximo dois fatos, um único "Como foi calculado?" e "O que mais pesa neste cenário" |
| Distância até a decisão (375 × 812, do topo da revelação ao botão "Comprar agora") | 4.603 px (5,67 telas) | 1.933 px (2,38 telas) |
| Etapas | 1 Compra, 2 Revelação, 3 Reflexão, 4 Decisão | 1 Compra, 2 Impacto, 3 Decisão; a reflexão continua, como "Pensar antes de decidir (opcional)" |
| Conversa | "✦ Converse sobre esta compra" com a FINCK AI | "Tirar uma dúvida sobre o cálculo": primeiro respostas calculadas, depois, recolhida, a "Pergunta livre (Ajuda opcional)" |
| "E se...?" | dentro do bloco principal | "Comparar formas de decidir", em "Se quiser aprofundar" |
| Sustentabilidade (ODS 12) | estimada por IA automaticamente depois de toda análise | estimada só quando a pessoa abre o trecho (0 pedidos antes, 1 depois), com o selo Estimativa |
| Filosofia repetida | "A decisão continua sendo sua." em três lugares e "O FinCK não decide por você" | uma vez, na decisão; "sem julgar a sua escolha" só na apresentação |

O resultado ficou com três blocos visíveis (o impacto, o que merece atenção e
a decisão) e um opcional, "Se quiser aprofundar", com orçamento completo,
metas em detalhe, próximos meses, comparação de formas de decidir,
sustentabilidade, alternativas e a dúvida sobre o cálculo.

### 3.2 Revisão financeira (antigo Assistente FinCK)

| Antes | Depois |
|---|---|
| Página "Assistente FinCK", com o estado "Conferindo se a FINCK AI está disponível…" e uma chamada ao servidor ao abrir | "Revisão financeira", aberta direto com o Índice FinCK, as próximas ações montadas pelas regras e as seis dimensões; nenhuma chamada de rede ao abrir |
| Botão "Gerar plano" como ação central | sem botão: as próximas ações já estão na tela |
| "Por que o FinCK diz isso?" só no plano gerado | "Como foi calculado?" (a conta passo a passo, com o selo) e "Por que isso importa?" em cada ação |
| Conversa visível "Pergunte sobre o seu raio-X", com chips que dependiam da IA | "Ajuda opcional: perguntar sobre estes números", recolhida, com perguntas prontas respondidas pelo próprio motor |
| Plano escrito por IA como função principal | "Quer uma explicação escrita destas ações?", no fim, só com conta e quando a pessoa pede; na demonstração não aparece |
| Provedor e modelo visíveis antes do clique | um único "Dados e privacidade", recolhido, com o que é enviado, quem escreve o texto e o formato dos pedidos |

### 3.3 Home

| Antes | Depois |
|---|---|
| "Seu resumo de hoje, em três perguntas" | "Resumo financeiro": Como estou?, Para onde vai meu dinheiro?, Próximo passo |
| "Você está em dia" ao lado de um caixa negativo de R$ 448,00 na demonstração | um status só para a previsão: "Coberto pelas entradas previstas"; o negativo aparece no detalhe, como "Só com as saídas" |
| Registro só lá embaixo, em "Últimas movimentações" | "Registrar gasto" e "Registrar entrada" logo abaixo do resumo, como ações secundárias |
| Nove atalhos por nome de tela | quatro atalhos por tarefa e o resto em "Ver todas as ferramentas" |
| Nomes abstratos | "Situação atual e previsões", "Revisão financeira", "Sua renda livre em diferentes medidas", "Seu progresso", "Entenda seus números" |
| Conta nova com cartões zerados | "Sua conta começa aqui" e "Registrar primeira movimentação" |
| Demonstração identificada só por um ícone | selo "Dados de exemplo" no resumo |

### 3.4 Entrada (index)

- "Experimentar com dados de exemplo" é a ação dominante; o login virou o
  caminho secundário "Já tem conta? Entrar", em cartão plano.
- O fundo animado continua, mas atrás do formulário os pontos ficam com 18%
  do brilho.
- O CAPTCHA deslizante só aparece quando a pessoa começa a entrar (foco,
  digitação ou preenchimento automático), nunca no caminho da demonstração.

### 3.5 Demais telas

- Busca de lugares apresentada como "Busca automática no Google Maps", sem a
  palavra IA no título; a privacidade fica num detalhe.
- Glossário único: Saldo atual (registrado), Sobra da renda (por mês), Caixa
  previsto (com a janela) e Previsão (não altera o saldo até confirmar).
- Previsto, vencido e confirmado se distinguem por texto e marca, não só por
  cor, e cada ação da revisão de previsões dá retorno.
- A Jornada mostra o progresso como consequência do uso, sem textos que
  pressionem a registrar mais para subir de nível.

### 3.6 Acabamento visual

Depois das auditorias, o autor pediu botões mais quadrados e ainda menos cara
de IA. A identidade (paleta roxo, amarelo e preto, fontes, logos 3D, prisma,
cofre e fundo animado) continua; mudou a intensidade:

- **Cantos**: controles com 4 px, selos com 3 px e cartões com a escala de
  raio pela metade (4, 6, 10 e 14 px). Pílulas só onde o elemento é uma barra
  ou um ponto.
- **Botões**: ação principal em roxo sólido, sem gradiente, sem brilho que
  atravessa, sem sombra luminosa e sem "levantar" ao passar o mouse. Aba
  ativa, chips e etapas selecionadas seguem o mesmo padrão.
- **Títulos** em cor sólida; o degradê fica só na marca FinCK.
- **Rótulos de seção** em caixa normal, sem espaçamento largo de letras.
- **Sem emoji em títulos** (o ⚡ de "Quer comprar alguma coisa?" saiu).
- **Três níveis de acabamento** (`.acabamento-1`, `.acabamento-2`,
  `.acabamento-3` em `css/clareza.css`): o efeito forte fica com o Reality
  (cartão da home e revelação do resultado), os cartões principais ficam
  moderados e os detalhes e o conteúdo recolhido ficam planos.

## 4. As duas auditorias: acordos, divergências e decisões

**Onde concordam** (e foi aplicado): o núcleo financeiro funciona sem IA; a IA
fica opcional e contextual; menos termos de IA e nenhum anúncio de
inteligência para o que é conta; resultado do Reality mais curto, com a
decisão perto do impacto; estados vazios como ponto de partida; textos mais
diretos; distinção entre dado confirmado e estimativa; hierarquia visual em
vez de ornamento igual em tudo.

**Onde divergem e o que se decidiu:**

| Tema | Auditoria A (ChatGPT) | Auditoria B (Manus) | Decisão |
|---|---|---|---|
| Ação principal da home | registrar movimentação | "Analisar uma compra" | O Reality continua sendo a ação principal (é o diferencial do produto e as rodadas anteriores pediram isso); o registro ficou a um toque, logo abaixo do resumo, sem competir no estilo |
| Assistente | manter, com conclusões concretas e "Como foi calculado?" | remover como produto paralelo e substituir por uma revisão determinística | Virou "Revisão financeira", determinística e aberta direto nas próximas ações. A IA não foi removida: o planejamento pessoal com IA foi pedido pelo orientador do TCC e foi construído pelo autor; ela passou a ser um extra opcional no fim da página |
| Leitura de print e de página | manter quando disponível | tirar do caminho principal | Saíram do caminho principal para "Importar preço", recolhido, com revisão antes de usar |
| Sustentabilidade gerada por IA | manter | remover se não houver base local | Mantida (é parte do projeto, ODS 12), recolhida e estimada só sob pedido, com o selo Estimativa |
| Reflexão | não aborda | descer para "Se quiser aprofundar" | Mantida (as rodadas anteriores pediram), mas opcional e recolhida junto da decisão |
| Nomes criativos | manter os que carregam identidade | trocar nomes de produto por nomes de tarefa | Trocados os que evocam agente ou conversa; mantidos FinCK of Reality, "Sua hora vale...", consertar, reutilizar, comparar e adiar |

## 5. Arquitetura em três camadas

1. **Sistema financeiro** (JavaScript local, determinístico): saldo,
   lançamentos, metas, parcelas, recorrências, previsões, horas e dias de
   trabalho, impacto no mês e nas metas, linha do tempo e cenários.
2. **Regras do FinCK** (determinísticas): pontos de atenção, próximas ações da
   Revisão, respostas às perguntas prontas, leitura do histórico.
3. **IA opcional**: só quando a pessoa pede (pergunta livre, explicação
   escrita das próximas ações) ou escolhe importar um preço de imagem ou de
   página. Recebe só números, sem nomes de item, metas, contas ou
   lançamentos; não grava nada; o texto vem rotulado como escrito por IA.

Consequência prática: se a API de IA falhar ou demorar, nenhuma função
financeira para. Isso também deixa o produto mais resistente aos limites dos
modelos gratuitos.

## 6. Vocabulário fixo

| Uso | Rótulo |
|---|---|
| Número calculado | Cálculo do FinCK |
| Leitura determinística | Regra do FinCK |
| Hipótese (vida útil, ritmo de aportes, impacto ambiental) | Estimativa |
| Dado registrado | Dado confirmado |
| Leitura de imagem ou página | Importar preço (revise antes de usar) |
| Texto escrito sob pedido | Ajuda opcional; resposta rotulada "Resposta escrita por IA a partir dos números desta análise." |

A palavra "IA" aparece só onde a pessoa escolheu a ajuda opcional ou a
importação, e o provedor só em "Dados e privacidade" ou "Como funciona".

## 7. Acessibilidade

- Nenhum botão importante sob a navegação fixa nas larguras medidas; o botão
  "Analisar uma compra" fica acima da navegação na primeira tela em 360 × 740,
  375 × 667, 375 × 812, 390 × 844 e 412 × 915, com e sem toque.
- Alvos de pelo menos 24 px (44 px no toque) nos detalhes recolhidos, no
  switch de Recorrentes e nos resumos de "Como foi calculado?".
- Sem rolagem horizontal em 320 px, inclusive no calendário do Planejamento.
- Estados (previsto, vencido, confirmado) com texto, não só cor.
- Recolher conteúdo também reduz carga cognitiva (WCAG 2.2, 3.3.2: instruções
  demais atrapalham tanto quanto de menos).

## 8. O que não foi feito e por quê

- **Teste com pessoas**: depende de sessões presenciais (seção 9).
- **Leitor de tela real**: a estrutura foi conferida pelo DOM (rótulos,
  `aria-live`, detalhes), mas não com NVDA ou VoiceOver.
- **IA ao vivo**: as rotas foram testadas com respostas simuladas; falta uma
  pergunta real na Vercel com a chave configurada.
- **320 × 568**: "Analisar uma compra" continua abaixo da primeira tela, como
  já acontecia antes desta rodada.

## 9. Validação com pessoas

Cinco pessoas que não conhecem o projeto, no celular, sem explicação prévia:

1. "Você quer comprar um notebook por R$ 3.000. Descubra o impacto."
2. "Sem abrir detalhes, diga o que esta compra representa para você."
3. "Escolha o que faria agora."
4. "Encontre onde rever suas movimentações."
5. "Diga se o FinCK usa IA para calcular as horas."

Critérios de sucesso: 80% começam pelo fluxo certo sem orientação; 80%
explicam preço, horas e impacto sem abrir detalhes; 80% encontram a decisão
sem rolar a página inteira; ninguém entende que a IA decidiu por elas; pelo
menos 4 de 5 percebem a IA como opcional; ninguém confunde saldo registrado
com previsão. Ao final, o questionário SUS (Brooke, 1996). Registrar tempo,
erros, hesitações e interpretações erradas, e corrigir o que aparecer em mais
de uma pessoa ou bloquear o fluxo.

## 10. Testes automatizados

Ao fim da rodada: suíte do navegador (`testes.html`) com 433 testes verdes,
incluindo casos que conferem a ausência de ✦, de "IA" fora da ajuda opcional
e de provedor no texto visível; `ferramentas/testar-assistente.mjs` com 100,
`ferramentas/testar-ia.mjs` com 65, `ferramentas/testar-programacao.mjs` com
55 e `ferramentas/testar-ocorrencias.mjs` com 53, todos verdes.

## Referências

- BROOKE, J. SUS: a quick and dirty usability scale. In: JORDAN, P. W. et al.
  (org.). Usability evaluation in industry. London: Taylor & Francis, 1996.
- NIELSEN NORMAN GROUP. 10 usability heuristics for user interface design.
  Disponível em: https://www.nngroup.com/articles/ten-usability-heuristics/.
- NIELSEN NORMAN GROUP. AI UX debt. Disponível em:
  https://www.nngroup.com/articles/ai-ux-debt/.
- W3C. Web Content Accessibility Guidelines (WCAG) 2.2: 1.4.3 Contrast
  (Minimum), 2.5.8 Target Size (Minimum) e 3.3.2 Labels or Instructions.
  Disponível em: https://www.w3.org/WAI/WCAG22/Understanding/.
