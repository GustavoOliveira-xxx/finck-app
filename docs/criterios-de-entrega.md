# Critérios para considerar o FinCK pronto

A lista da seção 8 do relatório geral de avaliação, com o que existe hoje no
projeto e onde conferir. "Pronto" quer dizer implementado e testado; o que
depende de pessoas ou de infraestrutura está marcado como pendente.

| # | Critério | Situação | Evidência |
|---|---|---|---|
| 1 | O usuário entende a proposta do FinCK logo na entrada | Pronto, a confirmar com pessoas | `index.html`: "Experimentar com dados de exemplo" como ação principal; home com "Resumo financeiro" e "Quer comprar alguma coisa?" |
| 2 | Dá para usar uma demonstração sem cadastrar informações pessoais | Pronto | Demonstração com quatro meses de histórico, contas, metas e análises de exemplo (`js/finance.js`, `FIXTURE_DEMO`); testes em `js/testes-dados.js` e `js/testes-habitos.js` |
| 3 | O registro de receitas e despesas funciona | Pronto | Registro rápido na home (valor e descrição, categoria sugerida); testes de contabilidade, estornos e conciliação em `js/testes.js` |
| 4 | A página inicial apresenta um resumo financeiro compreensível | Pronto | "Como estou?", "Para onde vai meu dinheiro?", "Próximo passo", o hábito que mais pesa e a comparação com o mês anterior; testes em `js/testes-painel.js` |
| 5 | A Revisão financeira usa os dados cadastrados corretamente | Pronto | Seis dimensões, Índice FinCK e Espelho financeiro calculados no aparelho (`js/diagnostico-engine.js`, `js/habitos-engine.js`); testes em `ferramentas/testar-assistente.mjs` e `js/testes-habitos.js` |
| 6 | O Reality mostra como uma compra afeta a situação financeira | Pronto | Horas de trabalho, peso no mês, atraso nas metas, próximos meses e "No seu histórico de <categoria>"; testes em `js/testes-reality.js`, `js/testes-inteligencia.js` e `js/testes-linha-tempo.js` |
| 7 | Há informações claras sobre hábitos de consumo e seus efeitos acumulados | Pronto | "Hábitos de consumo" em Análises, com o efeito em 12 meses, a simulação e a conta de cada padrão (`docs/habitos-e-espelho.md`) |
| 8 | A IA interpreta informações reais e não inventa resultados matemáticos | Pronto | Respostas em esquema, conferidas no servidor (padrões que existem, sem veredito, meta dentro da sobra); contexto só com os números do FinCK. Testes em `ferramentas/testar-assistente.mjs` e `ferramentas/testar-ia.mjs` |
| 9 | O sistema funciona quando a IA está indisponível | Pronto | Hábitos, Espelho, simulação, Reality e Revisão são regras do FinCK; a ajuda opcional some ou explica o erro. Testes de rota ausente e sem chave |
| 10 | O vínculo com a ODS 12 é compreensível e demonstrável | Pronto | Selo ODS 12 no Reality (durabilidade, reparo, reuso, descarte e o lembrete de compras frequentes de duráveis), no padrão de itens duráveis, no consumo consciente do Espelho e em "Alternativas perto de você" |
| 11 | As principais telas funcionam no computador e no celular | Pronto | Sem rolagem horizontal em 320 e 390 px nas telas novas; "Analisar uma compra" acima da navegação em 360 × 740, 375 × 667, 375 × 812, 390 × 844 e 412 × 915 |
| 12 | Os dados financeiros têm proteção adequada | Pronto no código, sem teste automático no banco | Row Level Security por usuário (`supabase/migrations/20260809000002_rls.sql`), chaves de IA só na Vercel, rotas de IA da Revisão exigem conta, nada de descrição de lançamento vai para a IA |
| 13 | Há testes documentados das funcionalidades principais | Pronto | `testes.html` (457 testes no navegador) e `ferramentas/testar-*.mjs`; lista em `README.md` |
| 14 | O projeto apresenta evidências de avaliação com usuários | Pendente: falta aplicar | Roteiro e ferramenta prontos (`docs/validacao-com-usuarios.md`, `validacao.html`); faltam as sessões com participantes |
| 15 | O repositório tem instruções e documentação atualizadas | Pronto | `README.md`, `api/README.md`, `supabase/README.md` e os documentos em `docs/` |

## O que falta antes da entrega

1. Aplicar o teste com 5 a 10 participantes e registrar os resultados na
   tabela de `docs/validacao-com-usuarios.md`.
2. Conferir na Vercel que `GEMINI_API_KEY` está configurada e, para o dia
   da apresentação ou do teste, aumentar `IA_TETO_DIA` se muitas pessoas
   forem usar a ajuda opcional da mesma rede.
3. Fazer uma pergunta real na Revisão financeira e no Reality depois da
   publicação, para confirmar a IA ao vivo (as rotas foram testadas com
   respostas simuladas).
