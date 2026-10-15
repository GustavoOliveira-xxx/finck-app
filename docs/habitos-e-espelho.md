# Hábitos de consumo, Espelho financeiro e a IA na medida

Este documento registra a quarta rodada do FinCK (outubro de 2026), feita a
partir do relatório geral de avaliação do projeto. O relatório concluiu que o
FinCK não precisava de mais funcionalidades, e sim de tornar o diferencial
mais evidente: mostrar como os hábitos de consumo afetam a vida financeira e
ajudar a pessoa a perceber o consumo desenfreado antes que ele vire aperto.

As quatro prioridades do relatório e onde cada uma ficou:

| Prioridade | O que foi feito | Onde |
|---|---|---|
| Análise de hábitos recorrentes | Motor de hábitos com oito padrões, efeito acumulado em 12 meses e simulação | `js/habitos-engine.js`, Análises, home |
| Reality conectado ao histórico | "No seu histórico de <categoria>" junto do impacto | `js/reality-page.js` |
| Revisão financeira mais visual | Espelho financeiro: meses lado a lado, o que mudou, hábitos, simulação e consumo consciente | `assistente.html` |
| Validação com usuários | Roteiro, ferramenta de coleta e indicadores | `validacao.html`, `docs/validacao-com-usuarios.md` |

Frase-guia, a mesma da rodada anterior: **o FinCK calcula primeiro, você
decide, e a IA só ajuda se você pedir.**

## 1. O motor de hábitos

`window.FinckHabitos` é puro e determinístico, como os outros motores: roda
no aparelho, sem rede, e as mesmas entradas dão sempre os mesmos padrões.
Cada padrão traz o fato com os números, a conta que o produziu ("Como foi
calculado?"), o selo de certeza, o efeito acumulado em 12 meses (sempre
estimativa) e uma pergunta de reflexão.

### 1.1 O que é "dia a dia"

Hábito aparece no gasto que a pessoa decide no momento. Por isso o motor
separa:

- **conta fixa**: lançamento de recorrência (`source: "recorrente"` ou
  `source_occurrence_id`) ou com a mesma descrição de uma recorrência ativa;
- **parcela**: lançamento de parcelamento (`source: "parcela"`);
- **aporte**: saída ligada a uma meta (`goal_id`), que é dinheiro guardado,
  não gasto;
- **dia a dia**: toda outra saída.

### 1.2 Os padrões

| Padrão | Quando aparece | Relevância |
|---|---|---|
| Pequenos gastos que somam | 6 ou mais gastos do dia a dia de até 1,5% da renda (entre R$ 30 e R$ 80) em 30 dias, somando 5% da renda ou mais | 55 + % da renda (até 30) |
| Um gasto que se repete | 4 ou mais registros com a mesma descrição em 30 dias | 45 + 2 por vez (até 25) |
| Categoria em alta | Uma categoria do dia a dia sobe 25% ou mais no último mês completo, contra a média dos anteriores, e pelo menos R$ 50 (ou 2% da renda) | 50 + alta ÷ 4 (até 35) |
| O peso de uma categoria | A categoria do dia a dia que mais pesa em 30 dias passa de 10% da renda | 40 + % da renda (até 30) |
| Quando o dinheiro sai | Em 90 dias, mais de 45% do dia a dia no fim de semana (que é 29% dos dias) ou mais de 40% nos 7 dias depois do pagamento | 45 |
| O que já tem destino todo mês | Contas fixas e parcelas acima de 50% da renda, ou duas ou mais contas fixas de até R$ 100 | 80, 60 ou 38 |
| A sobra do mês | O último mês completo fechou negativo ou abaixo da média dos anteriores em mais de 5% da renda | 90 ou 70 |
| Compras frequentes de itens duráveis (ODS 12) | 3 ou mais compras de Eletrônicos ou Vestuário em 90 dias | 50, e sempre entra na lista |

Entram até cinco padrões, em ordem de relevância. O de itens duráveis nunca
sai por falta de espaço: é o que liga o hábito à ODS 12. Quando a categoria
em alta e o peso falam da mesma categoria, fica só a alta. O efeito em 12
meses não é calculado para o peso de uma categoria inteira, porque ela
inclui gastos essenciais como o mercado.

Os limites ficam em `FINCK_CONFIG.HABITOS` (`js/config.js`). São
referências de design do projeto, escritas num lugar só para poderem ser
discutidas, não resultados de pesquisa.

### 1.3 Confiança pelo tamanho do histórico

O relatório pediu para não apresentar cinco dias de registro com a mesma
confiança de seis meses:

| Nível | Quando | Efeito |
|---|---|---|
| Poucos registros | Menos de 5 gastos | Nenhum padrão de hábito |
| Leitura inicial | Menos de 30 dias de registro | Todos os padrões viram estimativa |
| Leitura moderada | De 30 a 89 dias | Padrões normais |
| Leitura consistente | 90 dias ou mais | Padrões normais |

### 1.4 O que melhorou

Além dos pontos de atenção, o motor mostra o que melhorou: categoria do dia
a dia em queda (só se ela aparece em todos os meses comparados, para um
gasto que não se repetiu não contar como hábito novo), sobra acima da média,
compras analisadas antes de decidir e dinheiro guardado em metas.

### 1.5 Simulação

`FinckHabitos.simular(valorMensal, { pcts, meta, valorHora })` mostra o que
muda com 10%, 15% ou 20% a menos: por mês, em 6 e 12 meses, em horas de
trabalho e no prazo da meta de referência (a meta em andamento com o prazo
mais próximo). A tela diz que é uma possibilidade matemática, não uma
recomendação, e que supõe o mesmo ritmo de gastos.

## 2. Onde os hábitos aparecem

- **Análises** abre com "Hábitos de consumo": a confiança, os padrões
  completos com a simulação, o que melhorou e os meses lado a lado, com as
  categorias do dia a dia mês a mês.
- **Home**: o cartão da Revisão financeira mostra o hábito de consumo que
  mais pesa e os gastos do mês contra o mesmo período do mês anterior. Fica
  abaixo do Reality para que "Analisar uma compra" continue acima da
  navegação na primeira tela de 360 × 740, 375 × 667, 375 × 812, 390 × 844
  e 412 × 915.
- **Reality**: "No seu histórico de <categoria>" aparece junto do impacto,
  com o que já saiu na categoria no mês, o total com a compra, a média dos
  meses completos, as compras dos últimos 90 dias e as já analisadas. Em
  itens duráveis, o lembrete de ODS 12 diz quantas compras seriam com esta.
- **Revisão financeira**: o Espelho financeiro (seção 3).

## 3. O Espelho financeiro

O relatório pediu uma evolução da Revisão financeira, sem criar um sistema
novo. O Espelho fica logo depois do Índice FinCK e reúne, pelas regras do
FinCK:

1. a confiança da leitura;
2. os meses lado a lado: entradas, gastos, dia a dia, guardado em metas e
   sobra (sobra negativa com a palavra "faltou", não só a cor);
3. o que mudou do penúltimo para o último mês completo (`mudancas()`): gastos,
   sobra e a categoria que mais subiu ou caiu;
4. os três hábitos que mais pesam, com a simulação;
5. consumo consciente, com o selo ODS 12: compras analisadas, esperar,
   alternativa, não comprar e compras planejadas, lado a lado e sem nota.

## 4. Comprar também pode ser consciente

O relatório pediu para não tratar a desistência como a decisão certa. Uma
compra conta como **planejada** (`FinckReality.compraPlanejada`) quando foi
decidida no Reality depois da análise e a pessoa marcou na reflexão que
precisa dela agora e que ela não compromete o essencial. Sem essas
respostas, o FinCK não presume nada.

A página de Decisões ganhou a **Retrospectiva** (`FinckReality.retrospectiva`):
cada escolha com o número de análises, o valor e o percentual, na mesma
lista, sem ordem de mérito. O "O que aconteceu depois?" também deixou de
esperar 30 dias.

## 5. A IA na medida

O relatório recomenda a arquitetura **dados financeiros, cálculos do
FinCK, identificação de padrões, Gemini, explicação para o usuário**. É o
que foi feito:

| Etapa | Quem faz | Onde |
|---|---|---|
| Dados | A pessoa registra | Supabase ou o aparelho |
| Cálculos | FinCK | `js/finance.js`, `js/diagnostico-engine.js` |
| Padrões | FinCK | `js/habitos-engine.js` |
| Explicação | Gemini, só sob pedido | `api/assistente-ia.js` (modo `habitos`) e `api/ia.js` |

- **Sob pedido**: nada é enviado ao abrir a página. "Explicar meus hábitos"
  só envia depois do clique no botão que diz "(usa IA)".
- **Interpretação, não cálculo**: a IA recebe os padrões já calculados e
  devolve texto no esquema. O servidor descarta padrão que não existe no
  retrato, pergunta que não é pergunta e resposta com veredito de compra.
- **Mínimo de dados**: vai o retrato agregado (`FinckHabitos.paraIA`), com
  categorias e números. Descrições de lançamentos ficam no aparelho; o
  padrão "um gasto que se repete" mostra a descrição na tela, mas para a IA
  vai só a categoria. A tela mostra o JSON exato em "Dados e privacidade".
- **Sem julgamento**: o sistema pede para não chamar gasto de desnecessário,
  supérfluo ou errado, lembra que comprar o necessário e planejado também é
  consumo consciente e liga o consumo à ODS 12 sem sermão e sem inventar
  números de impacto ambiental.
- **Sem IA, tudo funciona**: hábitos, Espelho, simulação e retrospectiva
  são regras do FinCK. Se a IA cair, a tela diz que a explicação não veio e
  os números continuam.
- **Gemini proporcional**: a chave fica na Vercel. A Revisão usa o Gemini
  quando não há chave da Anthropic; a rota geral (`/api/ia`, usada pelo
  Reality e pela demonstração) passou a usar o Gemini quando há
  `GEMINI_API_KEY`, com o OpenRouter de reserva. As explicações de planos e
  hábitos ficam 10 minutos em cache no servidor para o mesmo retrato.

No plano gratuito do Gemini, o Google pode usar o conteúdo enviado para
melhorar os produtos dele. Por isso a tela avisa em "Dados e privacidade" e
só o retrato agregado sai do aparelho.

## 6. Demonstração

A demonstração ganhou quatro meses de histórico para os hábitos aparecerem
em qualquer data: salário e contas fixas nos dias das recorrências e gastos
do dia a dia contados em dias para trás (de 1 a 120), com o consumo
crescendo nos ciclos recentes (delivery, lazer, pequenos gastos, roupas). O
histórico soma zero, então o saldo continua R$ 2.880,00. Ela também tem uma
compra planejada (jaqueta) e uma desistência com mais de 30 dias
(videogame), que aparece em "O que aconteceu depois?".

## 7. Testes

- `js/testes-habitos.js` (na suíte de `testes.html`): padrões, exclusão de
  fixas, parcelas e aportes, descrição fora do envio para a IA, ODS 12, o
  que melhorou, o que mudou, textos sem julgamento, sem IA e sem
  travessão, confiança, simulação, histórico da categoria, comparação com
  o mês anterior, compra planejada, retrospectiva, tela escapando o texto,
  indicadores da validação e a demonstração somando zero em qualquer data.
- `ferramentas/testar-assistente.mjs`: modo `habitos` (pedido, esquema,
  conferência, Gemini recusando veredito, cache).
- `ferramentas/testar-ia.mjs`: Gemini na rota geral, reserva no OpenRouter
  e chave recusada.

## 8. Limitações

- **Categorias como o app as conhece.** "Alimentação" junta mercado e
  delivery; o padrão de gasto repetido ajuda a separar, mas o FinCK não
  sabe a intenção de cada gasto.
- **Limites de design.** Os percentuais e valores dos padrões são escolhas
  do projeto, explicitadas para discussão.
- **Projeção simples.** O efeito em 12 meses supõe o mesmo ritmo; não
  considera inflação, rendimento nem mudança de renda.
- **Dependência do registro.** Sem registros, não há hábito. O nível de
  confiança diz isso na tela.
- **Teste com pessoas.** O efeito educativo só pode ser afirmado depois das
  sessões descritas em `docs/validacao-com-usuarios.md`.
