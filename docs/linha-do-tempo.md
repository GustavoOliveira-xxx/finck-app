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

No resultado do Reality, a seção **"E nos próximos meses?"**:

1. **Como você pagaria?** Parcelado (número de parcelas e juros do
   parcelamento, se houver) ou à vista (com desconto, se houver).
2. **Gastos do dia a dia**: já vem preenchido com a média dos últimos meses
   fora das despesas fixas e das parcelas, e pode ser ajustado.
3. **E se aparecer um imprevisto?** Valor e mês. A sugestão inicial é 15%
   da renda no 3º mês.
4. **Quatro números**: mês mais apertado, folga para imprevistos, o que o
   imprevisto faz e o custo real da compra.
5. **Uma frase** que diz em voz alta o que os números significam.
6. **Três caminhos para a mesma compra**: parcelado, à vista e juntar antes.
7. **Gráfico** do dinheiro guardado (roxo) e da dívida no cartão (vermelho).
8. **A conta mês a mês** e **Como calculamos**, com as fórmulas.
9. **Explicar com a FINCK AI**: a IA lê os números prontos e explica em
   linguagem simples. Só é chamada quando a pessoa pede.

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
| nov | −300 | — | — | 300,00 |
| dez | 100 | 45,06 (rotativo) | 100 | 245,06 |
| jan | 100 | 22,84 | 100 | 167,91 |
| fev | 100 | 15,65 | 100 | 83,56 |
| mar | 100 | 7,79 | 91,35 | 0 |

São R$ 91,35 de juros e quatro meses pagando dívida: a geladeira de
R$ 3.000 passa a custar R$ 3.091,35. Sem a geladeira, o mesmo imprevisto
caberia na sobra de R$ 400, sem juros. Juntando os R$ 400 por mês, daria
para comprar à vista no 8º mês.

Este exemplo é um teste automático em `js/testes.js` ("Linha do tempo da
compra").

## 5. Simplificações

- Renda, despesas fixas e gastos do dia a dia iguais todo mês.
- Entradas extras e lançamentos agendados não entram.
- Toda sobra vai para quitar a dívida, sem guardar nada até zerar.
- O teto de 100% é aplicado ao total devido, não a cada fatura.
- As taxas são médias do Banco Central; cada banco cobra a sua.
