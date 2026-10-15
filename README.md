# FinCK: educação financeira e consumo consciente

O FinCK é uma aplicação web de educação financeira ligada à **ODS 12 da ONU
(consumo e produção responsáveis)**. Ele não serve só para anotar receitas e
despesas: mostra o que os valores significam para a pessoa (em horas de
trabalho, no orçamento do mês e nas metas) e ajuda a perceber hábitos de
consumo antes que eles virem aperto.

Projeto escolar de Desenvolvimento de Sistemas / Informática para Internet,
de Gustavo Oliveira dos Santos.

> **O FinCK calcula primeiro, você decide, e a IA só ajuda se você pedir.**

## O que o FinCK faz

- **FinCK of Reality**: antes de comprar, o preço vira horas de trabalho,
  peso no mês, atraso nas metas, próximos meses (à vista, parcelado, juros
  do cartão) e, desde esta versão, o histórico da mesma categoria: quanto já
  saiu no mês, a média dos meses e as compras parecidas já analisadas. Também
  compara durabilidade, reparo, usado e descarte.
- **Hábitos de consumo** (Análises): pequenos gastos que somam, um gasto
  que se repete, categoria em alta, o peso de uma categoria na renda, quando
  o dinheiro sai, o que já tem destino todo mês, a sobra do mês e compras
  frequentes de itens duráveis. Cada padrão mostra a conta, o efeito em 12
  meses e uma simulação de 10%, 15% ou 20% a menos.
- **Revisão financeira com o Espelho financeiro**: os meses lado a lado, o
  que mudou, os hábitos que mais pesam, seis dimensões (fluxo, poupança,
  reserva, compromissos, metas e consumo), o Índice FinCK e as próximas ações.
- **Decisões**: o histórico do que foi analisado, a retrospectiva das
  escolhas sem ordem de mérito (comprar o que é necessário e planejado
  também é consumo consciente) e o acompanhamento do que aconteceu depois.
- **Controle financeiro**: lançamentos, contas, recorrências com previsão,
  parcelas, metas, relatórios e fechamento do mês.
- **IA opcional (Gemini)**: explica os hábitos e as próximas ações e
  responde dúvidas, só quando a pessoa pede, a partir dos números que o
  FinCK já calculou.
- **Demonstração** com quatro meses de dados de exemplo, sem cadastro.

## Como experimentar

Abra o site e escolha **"Experimentar com dados de exemplo"**. Nada é
cadastrado: a demonstração fica no navegador e some ao sair.

## Arquitetura

Três camadas, para nenhuma conta depender de um modelo de linguagem:

1. **Sistema financeiro** (JavaScript no navegador, determinístico): saldo,
   lançamentos, metas, parcelas, recorrências, previsões, horas de trabalho,
   impacto no mês e nas metas (`js/finance.js`, `js/reality.js`,
   `js/linha-tempo-engine.js`).
2. **Regras do FinCK** (determinísticas): pontos de atenção do Reality,
   diagnóstico da Revisão, padrões de hábitos e simulações
   (`js/inteligencia-engine.js`, `js/diagnostico-engine.js`,
   `js/habitos-engine.js`).
3. **IA opcional**, nas funções da Vercel (`api/`): recebe só números
   agregados, responde num esquema conferido no servidor e nunca decide
   pela pessoa.

```
dados registrados -> cálculos do FinCK -> padrões de hábito -> Gemini (se pedir) -> explicação
```

Se a IA falhar ou estiver sem chave, tudo continua funcionando.

## Tecnologias

- HTML, CSS e JavaScript, sem framework e sem etapa de build.
- Supabase (PostgreSQL, autenticação e Row Level Security) para contas
  reais; `localStorage` na demonstração.
- Funções serverless na Vercel (Node.js) para a IA: Gemini, do Google, com o
  OpenRouter de reserva; Claude, da Anthropic, opcional na Revisão.
- PWA (manifesto e ícones) para instalar no celular.

## Rodar localmente

O site é estático. Qualquer servidor serve:

```
npx serve .
# ou
python3 -m http.server 8000
```

Abra `http://localhost:8000` e use a demonstração. Sem as funções da
Vercel, a ajuda opcional da IA diz que não está disponível, e o resto do app
funciona normalmente.

## Testes

- **No navegador**: abra `testes.html` (457 testes de cálculo, contabilidade,
  previsões, Reality, hábitos, painel, demonstração e linguagem).
- **Por linha de comando** (sem rede, com respostas simuladas):

```
npm ci
node ferramentas/testar-assistente.mjs   # Revisão financeira e modo hábitos
node ferramentas/testar-ia.mjs           # rota geral, Gemini e reserva
node ferramentas/testar-impacto.mjs      # impacto ambiental (ODS 12)
node ferramentas/testar-print.mjs        # leitura de preço em print
node ferramentas/testar-extracao.mjs     # leitura de preço em página
node ferramentas/testar-locais.mjs       # lugares de conserto, usado e descarte
node ferramentas/testar-ocorrencias.mjs  # recorrências
node ferramentas/testar-programacao.mjs  # projeção e calendário
```

## Publicar na Vercel

O repositório é publicado como site estático com as funções de `api/`.
Variáveis de ambiente (Vercel, Settings, Environment Variables):

| Variável | Para quê |
|---|---|
| `GEMINI_API_KEY` | IA do Google: leitura de preço, impacto ambiental, lugares, Revisão financeira e a rota geral `/api/ia` |
| `ASSISTENTE_GEMINI_API_KEY` | Opcional: chave separada só para a Revisão e a rota geral, com cota própria |
| `OPENROUTER_API_KEY` | Opcional: reserva quando o Gemini fica sem cota |
| `ANTHROPIC_API_KEY` | Opcional: Claude na Revisão financeira |
| `IA_TETO_DIA` | Opcional: teto diário da rota geral (padrão 150 com o Gemini) |

Detalhes, limites e códigos de erro em `api/README.md`. O banco está em
`supabase/README.md`.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `*.html` | Telas: entrada, home, Reality, Análises, Revisão financeira, Decisões, metas, contas e as demais |
| `js/` | Motores (`*-engine.js`), telas e testes do navegador (`testes*.js`) |
| `css/` | Estilos; `habitos.css` para hábitos, Espelho e validação |
| `api/` | Funções da Vercel para a IA |
| `supabase/` | Migrations e políticas de acesso |
| `ferramentas/` | Testes por linha de comando |
| `docs/` | Decisões de projeto e documentação |

## Documentação

- `docs/habitos-e-espelho.md`: hábitos de consumo, Espelho financeiro e a IA
  na medida (esta versão).
- `docs/validacao-com-usuarios.md`: protocolo do teste com participantes.
- `docs/criterios-de-entrega.md`: os critérios de pronto e onde conferir.
- `docs/ux-sem-cara-de-ia.md`, `docs/ux-melhorias.md`: rodadas de UX.
- `docs/analise-finck.md`, `docs/assistente-ia.md`, `docs/linha-do-tempo.md`:
  Reality, Revisão financeira e linha do tempo.

## Validação com usuários

`validacao.html` (link em Perfil, "Avaliação do projeto") guia o teste com
participantes voluntários e calcula os indicadores: compreensão do impacto,
percepção de gastos acumulados, diferença entre preço e impacto, clareza,
facilidade e utilidade. As respostas ficam só no aparelho do pesquisador.

## Limitações

- O FinCK não acessa banco: tudo depende do que a pessoa registra.
- Referências como a regra 50/30/20, a reserva de 3 a 6 meses e os limites
  dos hábitos são didáticas, escolhidas pelo projeto.
- Estimativas ambientais são feitas por IA e aparecem como estimativa.
- É educativo: não é consultoria financeira nem recomendação de
  investimento, banco ou crédito.
