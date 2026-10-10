# Linha do tempo da compra

## 1. Problema

O FinCK of Reality traduz uma compra em horas de trabalho e em peso no mês.
É uma foto do dia da compra. A observação da orientação foi que uma compra,
principalmente parcelada, é um filme: ela ocupa os próximos meses e convive
com tudo o que acontece neles.

O exemplo da geladeira resume a ideia. À vista ou parcelado, os dois cabem
no dia da compra. A diferença aparece depois: se num mês surgir outro gasto
e faltar dinheiro, a parcela não paga vira dívida no cartão, e o cartão
cobra juros compostos altíssimos. O preço real da geladeira depende do que
acontecer nos meses seguintes.

## 2. O que a pessoa vê

No resultado do Reality, dentro de "Quer olhar mais fundo?", o tema
recolhido **"E nos próximos meses?"**. Fechado, ele já mostra numa linha a
conclusão da simulação. Aberto, a leitura segue a ordem em que a pessoa
precisa da informação (segunda rodada de UX, outubro de 2026):

1. **Conclusão primeiro.** Uma frase curta, com a borda colorida pela
   situação: "Neste cenário, parcelando em 10x de R$ 300,00, a compra cabe
   nos próximos meses sem usar o cartão.", ou que o imprevisto testado levaria
   parte da conta para o cartão, ou que faltaria dinheiro mesmo sem
   imprevisto, ou que o saldo de hoje não cobre a compra à vista. Só essa
   frase é anunciada ao leitor de tela, e só quando muda.
2. **Exemplo até a pessoa escolher.** Enquanto ela não mexe em "Como você
   pagaria?", uma linha logo acima da conclusão avisa que a forma é um
   exemplo ("Exemplo: 10x sem juros. Escolha em “Como você pagaria?”, logo
   abaixo, a forma que você usaria."), e a linha do tema fechado começa
   com "Exemplo.". Na comparação, o caminho simulado leva o rótulo
   "exemplo"; só depois da escolha ele vira "sua escolha".
3. **Selo e simulação lado a lado.** Quando o selo de impacto do Reality e
   a simulação parecem dizer coisas opostas, uma frase explica que o selo
   mede o peso no dinheiro de agora e a simulação mede o fôlego dos
   próximos meses (parcelada, uma compra pode pesar muito hoje e ainda
   caber mês a mês).
4. **Pergunta quando falta.** Sem histórico de gastos e sem valor
   informado, a simulação usaria R$ 0,00 para o dia a dia e a folga sairia
   inflada. Em vez de calcular em silêncio, a tela pergunta "Quanto você
   gasta por mês no dia a dia (mercado, transporte, lazer)?", diz que, sem
   esse dado, a conta considera R$ 0,00, e oferece o botão "Informar os
   gastos do dia a dia", que leva ao campo.
5. **Aviso de simulação**: "Cálculo do FinCK, sem IA. É uma simulação com
   os números desta tela, não previsão garantida: se a renda ou os gastos
   mudarem, o resultado muda."
6. **Quatro cartões**: mês mais apertado, folga para imprevistos, o que o
   imprevisto faz e o custo real da compra. Onde há juros do cartão, o
   próprio cartão explica: "Juros do cartão: cobrados quando a fatura não é
   paga inteira."
7. **Os controles**, para testar outros cenários:
   - **Como você pagaria?** Parcelado (número de parcelas e juros do
     parcelamento, se houver) ou à vista (com desconto, se houver).
   - **Gastos do dia a dia**: já vem com a média dos últimos meses fora das
     despesas fixas e das parcelas, com o selo Estimativa, e pode ser
     ajustado.
   - **E se aparecer um imprevisto?** Valor e mês, também com o selo
     Estimativa. A sugestão inicial é 15% da renda no 3º mês.
8. **Uma frase** que diz em voz alta o que os números significam e, quando
   for o caso, os alertas do cenário. O crédito rotativo aparece como
   consequência, sem reprimenda: "Se a fatura não for paga integralmente, o
   valor pode entrar no crédito rotativo, que costuma ter juros muito
   altos."
9. **"Ver a simulação completa"**, recolhida: os números desta simulação,
   separados em **Dado confirmado** (renda, despesas fixas, parcelas
   registradas, saldo e preço) e **Estimativa** (dia a dia, imprevisto e
   taxa do cartão); os **três caminhos para a mesma compra** (parcelado, à
   vista e juntar antes); o **gráfico** do dinheiro guardado (roxo) e da
   dívida no cartão (vermelho); **a conta mês a mês**, recolhida; e **Como
   calculamos**, com as fórmulas. O que a pessoa abriu continua aberto
   enquanto ela digita.

Ao refazer a análise do mesmo item (por exemplo, mudando a quantidade ou a
vida útil), a forma de pagamento e os campos que a pessoa mexeu continuam
como estavam. Outro item volta tudo ao padrão.

### 2.1 A FINCK AI na linha do tempo

A linha do tempo não tem mais um botão de IA próprio. "Perguntar à FINCK AI
sobre esta simulação" abre a conversa da Análise FinCK, no mesmo
resultado, com uma pergunta já escrita e **sem enviar**: a pessoa lê antes
o aviso do que vai junto e decide. Se enviar, vão só números: a forma
simulada (e se ela foi confirmada pela pessoa ou ainda é exemplo), o mês
mais apertado, a folga ou os juros do cartão, o peso das parcelas e o custo
real, junto com os demais números da análise. O nome do item, de metas,
de contas e de lançamentos não é enviado. O contrato com a rota está em
`docs/analise-finck.md`.

O link para o Assistente ("Ver como esta compra cabe no seu planejamento")
leva uma pergunta neutra, só com valores, que inclui a forma de pagamento
depois que a pessoa a escolhe: "Como uma compra de R$ 3.000,00 em 10x de
R$ 300,00 mexe no meu planejamento?"

## 3. As contas

Tudo em `js/linha-tempo-engine.js`, sem IA: as mesmas entradas dão sempre o
mesmo resultado. Parâmetros em `FINCK_CONFIG.LINHA_DO_TEMPO`.

**Sobra do mês i**

    sobra_i = renda − fixos − dia a dia − parcelas existentes_i − parcela nova_i − imprevisto_i

As parcelas existentes vêm do cronograma real dos parcelamentos cadastrados
(`FinckPlano.parcelasPorMes`), no mês em que vencem.

**Dinheiro guardado**

    caixa_0 = saldo de hoje − (preço, se à vista)
    caixa_i = caixa_(i−1) + sobra_i − pagamento da dívida_i

Se o caixa ficaria negativo, a falta vira dívida no cartão.

**Juros do cartão.** Taxa anual vira mensal por juros compostos:

    i = (1 + a)^(1/12) − 1

| Modalidade | Ao ano (BC) | Ao mês |
|---|---|---|
| Rotativo | 436,2% (jul/2026) | ≈ 15,02% |
| Parcelamento da fatura | 191,4% (jun/2026) | ≈ 9,32% |

No primeiro mês da dívida vale o rotativo; depois, o parcelamento da fatura
(Resolução CMN 4.549/2017). A dívida segue uma progressão geométrica:

    D_(n+1) = D_n × (1 + i) − pagamento

Desde janeiro de 2024 os juros e encargos dessas duas modalidades não passam
de 100% do valor devido (Lei 14.690/2023). Toda sobra seguinte quita a dívida.

**Parcela com juros** (Tabela Price):

    PMT = V × i / (1 − (1 + i)^(−n))

**Custo real** = total pago + juros do cartão que só existem por causa da
compra. Para isolar esses juros, a mesma vida é simulada duas vezes, com o
mesmo imprevisto: com a compra e sem ela.

**Folga para imprevistos** a partir do mês k = o menor caixa de k em diante.
Um gasto extra no mês k tira o mesmo valor de todos os meses seguintes, então
esse é o maior gasto que cabe sem virar dívida.

**Juntar antes**: o primeiro mês em que o caixa, sem a compra, alcança o
preço à vista.

## 4. Exemplo da geladeira

Renda de R$ 2.500, fixos de R$ 1.600, dia a dia de R$ 500, saldo zero:
sobram R$ 400 por mês. Geladeira de R$ 3.000 em 10x de R$ 300: sobram
R$ 100.

Um imprevisto de R$ 400 no primeiro mês deixa R$ 300 sem cobertura:

| Mês | Sobra | Juros | Pago da dívida | Dívida |
|---|---|---|---|---|
| nov | −300 | 0 | 0 | 300,00 |
| dez | 100 | 45,06 (rotativo) | 100 | 245,06 |
| jan | 100 | 22,84 | 100 | 167,91 |
| fev | 100 | 15,65 | 100 | 83,56 |
| mar | 100 | 7,79 | 91,35 | 0 |

São R$ 91,35 de juros e quatro meses pagando dívida: a geladeira de
R$ 3.000 passa a custar R$ 3.091,35. Sem a geladeira, o mesmo imprevisto
caberia na sobra de R$ 400, sem juros. Juntando os R$ 400 por mês, daria
para comprar à vista no 8º mês.

Este exemplo é um teste automático em `js/testes.js` ("Linha do tempo da
compra"). A leitura em palavras (conclusão por cenário, pergunta do dia a
dia, nenhum texto que julgue a compra), a separação entre dado confirmado
e estimativa e o que vai para a FINCK AI sem o nome do item são testados
em `js/testes-linha-tempo.js`.

## 5. Simplificações

- Renda, despesas fixas e gastos do dia a dia iguais todo mês.
- Entradas extras e lançamentos agendados não entram.
- Toda sobra vai para quitar a dívida, sem guardar nada até zerar.
- O teto de 100% é aplicado ao total devido, não a cada fatura.
- As taxas são médias do Banco Central; cada banco cobra a sua.
