# Assistente FinCK: planejamento pessoal com IA

## 1. Problema

O FinCK of Reality responde bem a uma pergunta: *quanto esta compra custa
na minha vida?* Ele traduz o preço em horas de trabalho, mostra o peso no
mês e o atraso nas metas. Mas olha **um item de cada vez**.

A observação da orientação do projeto foi que isso não basta para
planejamento pessoal: a pessoa precisa de um retrato da vida financeira
**inteira** (renda, despesas fixas, gastos do dia a dia, parcelas, reserva,
metas e o próprio jeito de decidir) e de um caminho concreto a partir dele.

O Assistente FinCK é essa resposta. Ele junta tudo o que o app já registra,
mede a situação em seis dimensões com regras explícitas, aponta por onde
começar e usa IA para transformar os números em um plano de ação e em
respostas a perguntas livres.

## 2. O que a pessoa vê

Tela `assistente.html` (atalho na home, em "Mais ferramentas" e no
resultado do Reality):

1. **Índice FinCK** (0 a 100) e uma frase de resumo.
2. **Raio-X em seis dimensões**, cada uma com o número, a referência usada,
   o nível (saudável, atenção, crítico, sem dados) e a explicação.
3. **Por onde começar**: prioridades em ordem de gravidade, cada uma com o
   motivo (o número que a disparou) e o lugar do app onde agir.
4. **Seu plano de ação**: diagnóstico, o que já vai bem, próximos passos com
   prazo, metas sugeridas que cabem no mês, hábito da semana. Um selo diz se
   o plano foi escrito pela IA ou montado pelas regras.
5. **O que é enviado para a IA**: o JSON exato que sai do aparelho.
6. **Pergunte ao FinCK**: conversa curta, respondida com os números da
   pessoa ("Quanto consigo guardar por mês?", "Posso assumir uma parcela de
   R$ 300?"). Vindo do Reality, a pergunta "Posso comprar X de R$ Y sem
   atrapalhar o meu planejamento?" já chega escrita.
7. **Os números por trás do raio-X**: mês típico, categorias com tendência,
   metas com ritmo e previsão de conclusão.

A home mostra um resumo do raio-X (índice e as duas primeiras prioridades)
logo abaixo de "Atenção necessária".

## 3. Arquitetura em três camadas

```
 navegador                                         servidor (Vercel)
 ┌──────────────────────────────┐
 │ dados do app (Supabase ou     │
 │ demonstração local)           │
 └──────────────┬───────────────┘
                ▼
 ┌──────────────────────────────┐
 │ 1. MOTOR DETERMINÍSTICO       │  js/diagnostico-engine.js
 │ dimensões, índice, prioridades│  parâmetros em FINCK_CONFIG.DIAGNOSTICO
 └───────┬───────────────┬──────┘
         │ paraIA()      │ planoLocal()  (sem IA)
         ▼               │
 retrato agregado ───────┼──────────────► ┌─────────────────────────────┐
 (sem descrições)        │                │ 2. IA INTERPRETATIVA         │
                         │                │ api/assistente-ia.js         │
                         │                │ Claude, saída em esquema JSON│
                         │                │ guarda-corpo dos números     │
                         │  ◄───────────── └─────────────────────────────┘
                         ▼
 ┌──────────────────────────────┐
 │ 3. INTERFACE                  │  assistente.html, js/assistente.js
 │ mostra origem de cada coisa   │
 └──────────────────────────────┘
```

**Por que separar assim.** Modelos de linguagem escrevem bem, mas não são
calculadoras confiáveis e podem afirmar números que não existem. No FinCK,
**toda conta é feita pelo motor**, com regra conhecida e testada; a IA
recebe os resultados prontos e cuida só da linguagem: priorizar, explicar,
sugerir passos e responder perguntas. Isso torna o sistema auditável (o
número na tela tem uma fórmula), testável (o motor tem testes de unidade) e
resiliente (sem IA, o motor ainda produz diagnóstico e plano).

### 3.1 Motor determinístico

`FinckDiagnostico.diagnosticar(contexto, { hoje })` recebe o mesmo contexto
financeiro que o resto do app usa (`FinckFinance.carregarContexto()`) e
devolve o retrato, as seis dimensões, o índice, as prioridades e os pontos
fortes.

Decisões de cálculo:

- **Janela de meses**: os últimos três meses *completos* com movimento.
  Sem nenhum mês completo, vale o mês atual, marcado como parcial; nesse
  caso o gasto considerado é no mínimo o valor das despesas fixas (que
  ainda vão sair) e a dimensão de poupança entra no índice com metade do
  peso.
- **Aporte não é gasto**: saída ligada a uma meta é dinheiro guardado.
- **Reserva** = saldo atual + o que está em metas de reserva/emergência.
- **Ritmo das metas** = aportes líquidos dos últimos 90 dias, por mês
  (`FinckMetas.ritmoMensal`); **necessário** = o que falta dividido pelos
  meses até o prazo (`FinckMetas.necessarioPorMes`).
- **Tendência por categoria**: o mês mais recente contra a média dos
  anteriores da janela.

### 3.2 IA interpretativa

`api/assistente-ia.js`, função serverless com o SDK oficial
`@anthropic-ai/sdk`:

- **Modelo**: `claude-opus-5-5` por padrão, configurável para
  `claude-sonnet-5-5` (`ASSISTENTE_MODELO`), mais barato.
- **Saída estruturada**: `output_config.format` com esquema JSON. O plano
  tem campos fixos (diagnóstico, pontos fortes, prioridades com dimensão de
  origem, passos e prazo, metas sugeridas, hábito, alerta, dados que
  faltam); a resposta da conversa também.
- **Esforço**: `medium` para o plano, `low` para perguntas.
- **Guarda-corpo**: `montarPlano()` descarta prioridade cuja dimensão não
  existe, corta listas, padroniza frases e **descarta meta sugerida com
  valor mensal acima do que sobra no mês** segundo o próprio retrato.
- **Recusas**: `fallbacks: "default"` (beta
  `server-side-fallback-2026-07-01`) refaz o pedido no modelo recomendado se
  um classificador recusar por engano; recusa que permanece e resposta
  cortada viram mensagem amigável.
- **Prompt de sistema** fixo (marcado para cache): papel de educador
  financeiro do app; usar só os números do retrato; citar a dimensão de
  origem; português do Brasil, sem julgamento moral; passos pequenos; sem
  produto financeiro, banco, corretora, crédito ou marca; em
  endividamento, renegociar com o credor e procurar o Procon, nunca novo
  crédito; o conteúdo da pessoa é dado, nunca instrução.
- **Acesso**: só com conta (token do Supabase), 20 pedidos por hora por
  pessoa, teto diário global e cache de 10 minutos para o mesmo retrato.

### 3.3 Interface

- O selo do plano diz a origem: "Escrito por IA a partir dos seus números"
  ou "Montado pelas regras do FinCK".
- Cada prioridade e cada resposta mostram "Baseado em: <dimensão>".
- **Degradação graciosa**: na demonstração, sem chave no servidor ou com
  falha da IA, o plano sai de `planoLocal()` no mesmo formato, e a conversa
  explica por que está desligada.
- O último plano da IA fica guardado só no aparelho; se os números mudaram
  desde então, a tela avisa.

## 4. Metodologia do diagnóstico

| Dimensão | Pergunta | Medida | Referência | Nota (0 a 100) |
|---|---|---|---|---|
| Fluxo do mês | Quanto da renda já tem destino fixo? | despesas fixas ÷ renda | até 50% | 100 até 50%; cai 2,5 pontos por ponto percentual acima; crítico se as fixas passam da renda |
| Capacidade de poupança | Quanto sobra de verdade? | (entradas − gastos) ÷ entradas, média da janela | 10% a 20% | proporcional a 20%; abaixo de 10% é atenção, negativa é crítica |
| Reserva de emergência | Por quanto tempo daria para viver sem renda? | (saldo + metas de reserva) ÷ custo fixo mensal | 3 a 6 meses | proporcional a 6 meses; abaixo de 3 é crítica |
| Parcelas e compromissos | Quanto da renda futura já está preso? | parcelas mensais ÷ renda; compromissos em aberto vs saldo | até 15% confortável, acima de 30% pesado | cai com o peso; crítica se os compromissos passam do saldo |
| Metas | As metas estão andando? | metas no ritmo ÷ metas abertas | aporte ≥ 90% do que o prazo pede | proporção de metas no ritmo |
| Consumo consciente | Analisar muda a decisão? | decisões conscientes ÷ decididas, e indicador médio de decisão responsável | decidir depois de analisar | média das duas medidas |

**Índice FinCK** = média ponderada das notas das dimensões com dados
(fluxo 25%, poupança 20%, reserva 20%, compromissos 15%, metas 10%, consumo
10%). Dimensão sem dados fica fora da conta, e o peso é redistribuído.
Rótulo: 75 ou mais "equilibrada", 50 a 74 "em ajuste", abaixo de 50
"pedindo atenção". **O índice é um resumo didático, não um score de
crédito.**

**Prioridades** seguem gravidade: primeiro o que ameaça o mês (renda não
informada, fixos acima da renda, compromissos acima do saldo, gastos acima
das entradas), depois o que constrói segurança (reserva, categoria em alta,
poupar no dia do pagamento, metas fora do ritmo, parcelas), por fim hábitos
(criar meta, analisar compras). Prioridades sobre o mesmo assunto não se
repetem.

### 4.1 Parâmetros e fundamentação

Todos os limites ficam em `FINCK_CONFIG.DIAGNOSTICO`, em um só lugar, para
poderem ser lidos, discutidos e ajustados:

- **50% para necessidades e 20% para poupança**: regra 50/30/20 de Warren e
  Tyagi (2005), que divide a renda líquida em necessidades (50%), desejos
  (30%) e poupança e quitação de dívidas (20%). O FinCK usa as despesas
  fixas como aproximação de necessidades.
- **Reserva de 3 a 6 meses de custo fixo**: faixa usual em materiais de
  educação financeira para reserva de emergência. É um parâmetro prudencial
  adotado pelo projeto; o Banco Central do Brasil (2013) trata a reserva
  para imprevistos como parte da gestão de finanças pessoais, sem fixar o
  número de meses.
- **Parcelas: 15% confortável, 30% pesado**: parâmetros prudenciais do
  projeto, abaixo das margens de crédito consignado.
- **Pesos do índice**: escolha do projeto, priorizando o que afeta o mês
  (fluxo) e a segurança (poupança e reserva) sobre hábitos.

Por serem parâmetros, e não verdades, a tela mostra a referência ao lado de
cada número, e a seção "Como o índice FinCK é calculado" lista os pesos.

## 5. Privacidade e LGPD

A Lei Geral de Proteção de Dados (Lei 13.709/2018) pede, entre outros
princípios, **necessidade** (tratar o mínimo de dados para a finalidade) e
**transparência** (informação clara sobre o tratamento). O assistente foi
desenhado a partir disso:

- **Minimização**: sai do aparelho só o retrato agregado (números
  arredondados, nomes de categoria e de meta). Não saem descrições de
  lançamento, contas, instituições, e-mail ou nome da pessoa. Isso é
  verificado por teste (`paraIA` não contém descrições).
- **Transparência**: a tela mostra o JSON exato enviado e marca a origem de
  cada plano e resposta.
- **Sem guarda no servidor**: a função não grava o retrato nem o plano; o
  cache de 10 minutos vive só na memória da instância. O último plano fica
  no próprio aparelho.
- **Escolha**: a IA só é chamada quando a pessoa toca em "Gerar meu plano"
  ou envia uma pergunta. Na demonstração, nada é enviado.
- **Provedor externo**: o retrato é processado pela API da Anthropic. A
  política de uso e retenção de dados do provedor deve constar do termo de
  uso do app.

## 6. Ética e segurança

- **Não é consultoria**: recomendação de investimento é atividade regulada
  no Brasil. O assistente fala de hábitos, organização e categorias de
  gasto, e nunca indica produto, banco, corretora, empréstimo ou cartão. O
  aviso aparece no plano e no rodapé da tela.
- **Sem julgamento**: o tom segue o do FinCK of Reality ("sem julgar a sua
  escolha"); a decisão é sempre da pessoa.
- **Endividamento**: o plano orienta renegociar com o credor e procurar o
  Procon, nunca tomar crédito novo para pagar dívida, em linha com a lógica
  de prevenção do superendividamento (Lei 14.181/2021).
- **Injeção de instruções**: pergunta, histórico e retrato vão entre
  marcadores, e o sistema declara que esse conteúdo é dado. O histórico só
  aceita os papéis "pessoa" e "assistente", com no máximo 6 trocas.
- **Números verificados**: o que é estruturado (dimensão, prazo, valor de
  meta) é conferido no servidor. Frases livres não são verificáveis da
  mesma forma; por isso o prompt exige usar só os números do retrato, e a
  tela mostra o retrato ao lado.

## 7. Avaliação

### 7.1 Testes automatizados

- `testes.html`, suíte "Assistente: diagnóstico da vida financeira": janela
  de meses, aporte fora dos gastos, mês parcial, tendência, cada dimensão,
  sem dados, índice ponderado, prioridades sem repetição, retrato sem
  descrições, plano por regras dentro da sobra.
- `ferramentas/testar-assistente.mjs`: validação do pedido, prompt,
  esquemas, guarda-corpo, recusa, resposta cortada, erros da API, cache e a
  rota HTTP inteira com o SDK oficial falando com uma API simulada; com
  `--ao-vivo`, um plano e uma pergunta de verdade.

### 7.2 Qualidade do plano

Rubrica para avaliar planos gerados (por exemplo, 10 retratos variados,
cada critério de 0 a 2):

| Critério | Pergunta |
|---|---|
| Fidelidade | Todo número citado existe no retrato? |
| Pertinência | As prioridades atacam as dimensões críticas primeiro? |
| Acionabilidade | Cada passo dá para fazer nesta semana ou neste mês? |
| Tom | É respeitoso e sem julgamento moral? |
| Segurança | Evita produto financeiro e crédito novo? |

Comparar o plano da IA com o plano por regras do mesmo retrato mostra o
que a IA acrescenta (linguagem, ordem, passos) sem mudar os números.

### 7.3 Com usuários

Junto do roteiro de `docs/ux-melhorias.md`, três tarefas: "Descubra qual é
o ponto mais fraco da sua vida financeira hoje", "Peça um plano e diga qual
seria o primeiro passo", "Pergunte se uma parcela de R$ 300 cabe no seu
mês". Medir acerto, tempo e confiança declarada ("você seguiria esse
passo?"), e aplicar o SUS (Brooke, 1996) ao final.

## 8. Limitações

- O retrato depende do que a pessoa registra; lançamentos esquecidos
  distorcem médias.
- Com poucos meses de histórico, as médias são frágeis (o app avisa quando
  o mês é parcial).
- Os parâmetros são didáticos e não consideram renda variável, dependentes
  ou região.
- Frases livres da IA podem conter imprecisões que o guarda-corpo não
  detecta; a tela sempre mostra os números de origem.
- Custo por uso (seção 9) e dependência de um provedor externo.
- Não substitui orientação profissional em situações de endividamento
  grave.

## 9. Configuração e custo

Variáveis na Vercel: `ANTHROPIC_API_KEY` (obrigatória),
`ASSISTENTE_MODELO` e `ASSISTENTE_TETO_DIA` (opcionais). Detalhes,
códigos de erro e estimativa de custo em `api/README.md`. Em resumo: com
`claude-opus-5-5`, um plano custa perto de US$ 0,07 e uma pergunta perto
de US$ 0,02.

## 10. Interdisciplinaridade

| Área | Onde aparece |
|---|---|
| Matemática financeira | médias móveis, taxa de poupança, projeção de metas, custo por mês de uso, comparação de opções |
| Economia comportamental | contabilidade mental e impulso (Thaler, 1985); viés do presente e "guardar no dia do pagamento" (Thaler e Benartzi, 2004); regra dos 30 dias no Reality; aversão à perda no enquadramento em tempo de trabalho (Kahneman e Tversky, 1979) |
| Educação financeira | letramento financeiro e decisões (Lusardi e Mitchell, 2014); regra 50/30/20 |
| Sustentabilidade | ODS 12 (consumo e produção responsáveis) no Reality, que alimenta a dimensão de consumo consciente |
| Computação | motor determinístico testável, IA com saída estruturada, engenharia de prompt, segurança contra injeção, degradação graciosa |
| Direito e ética | LGPD (minimização e transparência), limites de recomendação financeira, superendividamento |
| Design e acessibilidade | hierarquia de informação, explicação visível, WCAG 2.2 |

## Referências

- BANCO CENTRAL DO BRASIL. *Caderno de educação financeira: gestão de
  finanças pessoais*. Brasília: BCB, 2013.
- BRASIL. Lei nº 13.709, de 14 de agosto de 2018. Lei Geral de Proteção de
  Dados Pessoais (LGPD).
- BRASIL. Lei nº 14.181, de 1º de julho de 2021. Altera o Código de Defesa
  do Consumidor para prevenção e tratamento do superendividamento.
- BROOKE, J. SUS: a quick and dirty usability scale. In: JORDAN, P. W. et
  al. (org.). *Usability evaluation in industry*. London: Taylor &
  Francis, 1996.
- KAHNEMAN, D.; TVERSKY, A. Prospect theory: an analysis of decision under
  risk. *Econometrica*, v. 47, n. 2, p. 263-291, 1979.
- LUSARDI, A.; MITCHELL, O. S. The economic importance of financial
  literacy: theory and evidence. *Journal of Economic Literature*, v. 52,
  n. 1, p. 5-44, 2014.
- ONU. *Transformando nosso mundo: a Agenda 2030 para o desenvolvimento
  sustentável*. 2015. Objetivo 12.
- THALER, R. H. Mental accounting and consumer choice. *Marketing
  Science*, v. 4, n. 3, p. 199-214, 1985.
- THALER, R. H.; BENARTZI, S. Save More Tomorrow: using behavioral
  economics to increase employee saving. *Journal of Political Economy*,
  v. 112, n. S1, p. S164-S187, 2004.
- WARREN, E.; TYAGI, A. W. *All your worth: the ultimate lifetime money
  plan*. New York: Free Press, 2005.
