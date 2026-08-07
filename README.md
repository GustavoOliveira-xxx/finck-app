# FinCK v2 — reestruturação segundo o documento de evolução

Aplicação web estática (HTML + JS puro), reescrita a partir do `finck-app-main`
para colocar o **FinCK Reality** no centro do produto, conforme o documento
*"FINCK: Plataforma de Educação Financeira para o Consumo Consciente"*.

O CSS é intencionalmente um placeholder — veja `css/_contrato-css.css`, que
lista **todas** as classes e variáveis usadas pelo HTML/JS.

## Como rodar

```bash
cd finck-v2
python3 -m http.server 8080
# abra http://localhost:8080
```

Funciona sem banco (modo offline em `localStorage`). Para usar o seu banco,
preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `js/config.js` e rode
`sql/schema.sql` no SQL Editor. Nada mais precisa mudar: a camada `FinckStore`
troca de backend sozinha.

## Estrutura

| Arquivo | Função |
| --- | --- |
| `index.html` / `cadastro.html` | Login e cadastro (+ botão de demonstração) |
| `onboarding.html` | Perfil Financeiro Inicial, Configuração Manual e Modo Demonstrativo (item 6) |
| `home.html` | Dashboard: saldo, orçamento previsto, metas, indicadores conscientes e lançamentos |
| `reality.html` | **FinCK Reality**: dados → resultado → reflexão → decisão (item 5) |
| `decisoes.html` | Histórico de análises e decisões |
| `metas.html` | Metas, aportes e impacto em dias de trabalho |
| `recorrentes.html` | Lançamentos recorrentes como previsão do orçamento (item 6.2) |
| `analises.html` | Gastos por categoria, evolução mensal e consumo consciente |
| `relatorios.html` | Relatório mensal + exportação CSV / JSON / PDF |
| `gamificacao.html` | XP, níveis, sequência e conquistas |
| `perfil.html` | Perfil financeiro, conta, backup e limpeza de dados |

### Camadas JavaScript

| Arquivo | Responsabilidade |
| --- | --- |
| `js/config.js` | Credenciais, categorias, decisões e perguntas de reflexão |
| `js/store.js` | Camada única de dados: banco ou `localStorage`, auth, CRUD, backup |
| `js/reality.js` | Motor de cálculo do FinCK Reality (fórmulas do item 5.1) |
| `js/finance.js` | Saldo, orçamento, séries mensais, aportes e dados demo |
| `js/gamification-engine.js` | XP, níveis, streak e conquistas |
| `js/charts.js` | Gráficos em Canvas puro, sem bibliotecas |
| `js/nav.js` | Header, navegação e bootstrap das páginas |
| `js/*.js` restantes | Um controlador por página |

## Fórmulas do FinCK Reality

```
valor_dia   = renda_mensal / dias_trabalhados_mes
valor_hora  = valor_dia / horas_por_dia
dias        = preco / valor_dia
horas       = preco / valor_hora
% da renda  = preco / renda_mensal * 100
```

Cenário de teste do documento — renda R$ 3.500, 22 dias, 8 h, item de R$ 800:
**22,86% da renda · 5,03 dias · 40,22 horas.** Validado no código.

## Rastreabilidade dos requisitos

| Requisito | Onde foi implementado |
| --- | --- |
| RF01 cadastro/autenticação | `index.html`, `cadastro.html`, `js/auth.js`, `js/store.js` |
| RF02 renda fixa ou variável | `onboarding.html`, `perfil.html` |
| RF03 dias/horas de trabalho | `onboarding.html`, `perfil.html` |
| RF04 despesas fixas e categorias | `onboarding.html`, `recorrentes.html`, `js/config.js` |
| RF05 entradas e saídas | `home.html`, `js/home.js` |
| RF06 metas e progresso | `metas.html`, `js/metas.js` |
| RF07 analisar antes de registrar | `reality.html` (a despesa só entra se a decisão for "comprar") |
| RF08 preço em dias e horas | `js/reality.js` |
| RF09 percentual da renda | `js/reality.js`, cartões de indicadores |
| RF10 impacto em metas e orçamento | `js/reality.js` → `impactoMetas`, `impactoOrcamento` |
| Reflexão e decisão | `reality.html` passos 3 e 4 |
| Histórico de decisões | `decisoes.html`, tabela `purchase_analyses` |
| Relatórios e backup | `relatorios.html`, `perfil.html` |
| Gamificação de hábitos conscientes | `js/gamification-engine.js`, `gamificacao.html` |
| Banco com RLS por usuário | `sql/schema.sql` |
| Modo demonstrativo | `onboarding.html`, `js/finance.js` → `carregarDemo()` |

## O que mudou em relação ao FinCK original

- Senha deixa de ser comparada em `localStorage`: a autenticação passa pelo banco quando configurado.
- `localStorage` vira fallback offline, não fonte principal.
- Nomes de campos alinhados ao modelo de dados do documento (inglês, snake_case).
- Novo fluxo de onboarding com três caminhos e novo módulo FinCK Reality.
- Transações ganham categoria; despesas fixas viram recorrentes previstos.
- Gamificação passa a premiar decisões conscientes, não apenas registros.
- Todo o CSS foi extraído: nenhuma página tem `<style>` embutido.
