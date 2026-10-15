# Validação com usuários

Protocolo para demonstrar, com evidências, a contribuição educativa do FinCK
para a ODS 12 (seção 6 do relatório geral de avaliação). O objetivo não é
provar que o consumo de alguém caiu no longo prazo, e sim verificar se as
pessoas entendem as informações e se elas favorecem decisões mais
informadas.

A coleta é feita em `validacao.html` (link em Perfil, "Avaliação do
projeto"). As respostas ficam só no aparelho do pesquisador, sem nome: cada
participante vira um código (P01, P02...). A página calcula os indicadores
e exporta CSV e JSON para o relatório.

## 1. Participantes

- De 5 a 10 voluntários que não conhecem o projeto. Com cinco pessoas, a
  maior parte dos problemas de uso já aparece (Nielsen, 2000).
- De preferência estudantes e jovens adultos, o público do FinCK.
- Menores de idade só com autorização do responsável, conforme a escola.

## 2. Ética e LGPD

- Participação voluntária, com explicação antes de começar e a opção de
  parar a qualquer momento.
- Nenhum dado financeiro real: o teste usa a demonstração do FinCK e uma
  situação fictícia.
- Nenhum dado pessoal identificável é registrado: só faixa etária
  (opcional), se usa aplicativo de finanças e as respostas.
- O pesquisador apaga as sessões do aparelho depois de exportar.

Texto para ler ao participante: "Este é um teste do aplicativo, não de
você. Não existe resposta certa. Você pode parar quando quiser, e nada do
que disser leva o seu nome."

## 3. Roteiro (10 a 15 minutos por pessoa)

Antes: abrir o FinCK em outro aparelho ou aba e entrar em "Experimentar com
dados de exemplo".

1. **Situação fictícia.** Ler: "Você recebe R$ 3.500,00 por mês e já tem
   R$ 1.354,00 em contas fixas. Nos últimos 30 dias, gastou R$ 695,60 em
   pequenos gastos (delivery, lanche, transporte). Você quer comprar um fone
   de ouvido de R$ 800,00."
2. **Sem o FinCK.** Perguntar: "Você compraria agora? O que pesou na sua
   resposta?" Registrar a escolha e os fatores citados.
3. **Com o FinCK.** Pedir: "Analise esse fone no FinCK e depois abra a
   Revisão financeira." Sem explicar o aplicativo. Medir o tempo até a
   pessoa ver o impacto e anotar se precisou de ajuda.
4. **Depois do FinCK.** Perguntar: "E agora, o que você faria?" e "Qual é a
   diferença entre o preço e o impacto dessa compra?" Registrar a escolha,
   os fatores, se explicou a diferença e se percebeu gastos acumulados
   (pequenos gastos, categoria em alta).
5. **Questionário** (1 = discordo totalmente, 5 = concordo totalmente):
   - As informações foram claras.
   - Foi fácil fazer as tarefas.
   - As informações ajudariam a decidir uma compra.
   - Entendi de onde vieram os números.
   - O FinCK me ajudou a perceber hábitos de consumo.
   - Perguntas abertas: o que mais ajudou? O que confundiu?

Fatores que o pesquisador marca nas etapas 2 e 4: o preço, a renda do mês,
horas de trabalho, o peso no orçamento do mês, contas fixas e parcelas,
metas e reserva, gastos acumulados, alternativas (esperar, usado, conserto)
e durabilidade e descarte (ODS 12).

## 4. Indicadores

Calculados pela página a partir das sessões salvas
(`FinckValidacao.indicadores`, com testes em `js/testes-habitos.js`):

| Indicador | Como é medido | Meta sugerida |
|---|---|---|
| Compreenderam o impacto da compra | Depois do FinCK, citaram horas de trabalho, peso no mês ou efeito nas metas | 80% |
| Identificaram despesas acumuladas | Perceberam pequenos gastos que somam ou uma categoria em alta | 70% |
| Explicaram a diferença entre preço e impacto | Marcado "sim" pelo pesquisador (e "em parte" à parte) | 70% |
| Fatores considerados | Média de fatores antes e depois | Aumento |
| Concluíram a tarefa sem ajuda | Etapa 3 | 80% |
| Clareza, facilidade, utilidade, origem dos números e hábitos | Médias de 1 a 5 | 4 ou mais |
| Mudaram a escolha | Escolha diferente antes e depois | Só informação |

"Mudaram a escolha" não é medida de acerto: comprar também pode ser uma
escolha consciente, e o FinCK não diz o que fazer. As metas são referências
do projeto para orientar a discussão, não critérios estatísticos.

## 5. Como registrar os resultados

Depois das sessões, exporte o CSV em `validacao.html` e preencha:

| Indicador | Resultado | Meta | Atingida? |
|---|---|---|---|
| Participantes | | 5 a 10 | |
| Compreenderam o impacto | | 80% | |
| Identificaram despesas acumuladas | | 70% | |
| Explicaram a diferença entre preço e impacto | | 70% | |
| Fatores antes e depois (média) | | aumento | |
| Concluíram sem ajuda | | 80% | |
| Clareza (média) | | 4 | |
| Facilidade (média) | | 4 | |
| Utilidade (média) | | 4 | |

Registre também os problemas que apareceram em mais de uma sessão ou que
bloquearam a tarefa, e o que foi corrigido por causa deles.

## 6. Limitações

- Amostra pequena e por conveniência: os percentuais são indícios, não
  medidas estatísticas.
- Situação fictícia: decidir sobre um fone imaginário não é o mesmo que
  decidir com o próprio dinheiro.
- Efeito do observador: com o pesquisador ao lado, as pessoas tendem a
  responder com mais cuidado.
- Curto prazo: o teste mede compreensão e reflexão na hora, não mudança de
  hábito ao longo dos meses.

## Referências

- BRASIL. Lei nº 13.709, de 14 de agosto de 2018. Lei Geral de Proteção de
  Dados Pessoais (LGPD).
- NIELSEN, J. Why you only need to test with 5 users. Nielsen Norman Group,
  2000. Disponível em: https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/.
- ONU. Objetivo de Desenvolvimento Sustentável 12: consumo e produção
  responsáveis. Disponível em: https://brasil.un.org/pt-br/sdgs/12.
