# Melhorias de UX do FinCK

Este documento registra o ciclo de melhoria de experiência de usuário feito
em outubro de 2026, a partir de duas avaliações heurísticas do app:

- **Relatório 1**: análise do app inteiro (entrada, onboarding, home,
  FinCK of Reality, navegação, visual, acessibilidade, conteúdo,
  performance), com critérios de aceite e plano em três entregas.
- **Relatório 2**: análise focada no FinCK of Reality, com dez prioridades
  ordenadas por impacto.

As duas partem do mesmo diagnóstico: o problema do FinCK não é estético, é
de **orientação**. O app tem identidade própria (roxo e amarelo sobre fundo
escuro, Space Grotesk, Inter e JetBrains Mono, logos 3D, cofre de
carregamento, prisma das faces do dinheiro) e isso foi preservado. O que
mudou foi hierarquia, sequência, linguagem, feedback, estados vazios e
acessibilidade.

> Princípio adotado: quanto mais importante o conteúdo, mais estável e
> contrastado o plano atrás dele. A decoração continua, mas é percebida
> depois da informação.

## 1. Rastreabilidade: recomendação → decisão → implementação

### Entrada e primeiro acesso

| Recomendação | Origem | O que foi feito | Onde |
|---|---|---|---|
| Separar "experimentar" de "entrar" | R1 P0, 2.1 | Botão principal da coluna esquerda vira "Experimentar com dados de exemplo"; a direita vira "Entrar na minha conta", com o link "Criar minha conta" | `index.html` |
| Explicar a demonstração | R1 P0 | Microtexto: "A demonstração não envia seus dados e pode ser encerrada a qualquer momento" | `index.html` |
| Legenda da vitrine | R1 2.1 | "Exemplo calculado com a renda informada abaixo. Não é recomendação nem avaliação da compra" | `index.html`, `css/style-auth.css` |
| CAPTCHA deslizante com alternativa de teclado anunciada | R1 2.1, 4 | Rótulo visível "Confirme que você é uma pessoa", instrução "Arraste o controle até o fim ou, pelo teclado, selecione-o com Tab e pressione Enter", `aria-labelledby` e `aria-describedby`, foco visível; o "›" virou seta com contexto | `index.html`, `cadastro.html`, `js/auth.js` |
| Contraste do CSS de autenticação | R1 4 | `--texto-fraquissimo` de `#6d6579` (3,6:1) para `#8b8397` (acima de 4,5:1), igual ao CSS principal | `css/style-auth.css` |
| Zona de leitura atrás do formulário | R1 2.1 | Halo escuro suave atrás das duas colunas, sem apagar o fundo | `css/style-auth.css` |

### Onboarding

| Recomendação | Origem | O que foi feito | Onde |
|---|---|---|---|
| Progresso real, com nome e estado | R1 2.2 | Indicador "1 Renda → 2 Despesas fixas → 3 Saldo → Concluído", cada etapa com estado (concluída, agora, a seguir, para depois) e `aria-current="step"` | `onboarding.html`, `js/onboarding.js` |
| Por que cada campo existe | R1 2.2 | Linha de ajuda ligada por `aria-describedby` em renda, dia do recebimento, dias, horas e saldo | `onboarding.html` |
| "Pode ser zero" sem consequência | R1 2.2 | Texto neutro: sem renda o FinCK registra gastos, mas não converte em horas | `onboarding.html`, `js/onboarding.js` |
| Adiar configurações avançadas | R1 2.2 | "Como organizar a renda" virou "Planejamento opcional", recolhido | `onboarding.html` |
| Resumo antes de concluir | R1 2.2 | "Revise antes de concluir" em destaque, com "Editar" em cada linha voltando à etapa certa | `js/onboarding.js`, `css/clareza.css` |

### Home

| Recomendação | Origem | O que foi feito | Onde |
|---|---|---|---|
| Uma ação principal | R1 P0 | "Analisar uma compra" é o único botão principal; o Reality vem logo depois da saudação, e cabe na primeira tela do celular (375 px) | `home.html`, `css/clareza.css` |
| Ordem por decisão | R1 P0, 2.3 | Saudação → Reality → Sua situação hoje → Atenção necessária → raio-X → O que vem por aí → metas → movimentações → O que seus números dizem → Mais ferramentas | `home.html` |
| Papel de cada resumo | R1 2.3 | Cada grupo ganhou um rótulo: "Fotografia de hoje", "Próximo passo", "Previsão", "Interpretação", "Decisão de compra" | `home.html` |
| Números autoexplicativos | R1 P0 | Linha de contexto visível sob cada número (saldo, entradas, saídas, sobra após fixos, "Pode sobrar depois dos compromissos", indicadores); nada depende de `title` | `home.html`, `css/clareza.css` |
| Alertas viram tarefas | R1 2.3 | "Atenção necessária" lista tarefas com verbo ("Confirmar saída de R$ 1.200,00 · Aluguel, venceu em 04/10"); sem pendência aparece "Você está em dia" | `js/home.js`, `js/fechamento-ui.js` |
| Autonomia depois da ação | R1 2.3 | "O que fazer com isso é decisão sua" virou orientação concreta seguida da autonomia | `js/programacao-home.js` |
| Estados vazios com motivo e próximo passo | R1 2.3 | Metas, contas e movimentações dizem o que é, por que importa e qual o passo | `js/home.js`, `home.html` |
| Prisma sem depender de hover | R1 2.3 | "Arraste ou use as setas para explorar as quatro faces"; setas giram o prisma; sem movimento, as faces viram quatro cartões | `js/finck-fx.js`, `css/clareza.css` |
| Uma só navegação secundária | R1 2.5 | Os atalhos soltos viraram "Mais ferramentas", com descrição de cada área e peso visual menor | `home.html` |

### FinCK of Reality

| Recomendação | Origem | O que foi feito | Onde |
|---|---|---|---|
| Duas informações bastam | R2 #2, R1 2.4 | Obrigatórios: item e preço. Categoria, vida útil, quantidade, destino e observação ficam em "Quer deixar a análise mais precisa?" | `reality.html` |
| Categoria como confirmação | R2 #3 | O FinCK sugere pelo nome ("Categoria identificada: Eletrônicos · Alterar") | `js/reality.js` (`inferirCategoria`), `js/reality-page.js` |
| Preço sem explicar centavos | R2 #4, R1 2.4 | O campo aceita "800", "800,00" e "R$ 800,00"; o erro diz "Digite um valor válido, como R$ 800,00" | `js/moeda-input.js` |
| Print e link como alternativa | R2 #5 | "Não quer digitar o preço?" com "Ler preço de um print" e "Buscar pelo link da loja" | `reality.html` |
| Confirmar antes de alterar dados | R2 #6 | O botão virou "Buscar preço neste link"; o resultado mostra "✓ Preço encontrado" e só muda o campo em "Usar este preço" | `js/buscar-preco.js` |
| Botão desabilitado explicado | R1 2.4 | "Cole um link de produto para habilitar a busca" | `reality.html`, `js/buscar-preco.js` |
| Vida útil vendida pelo benefício | R2 #7 | "Quer saber se o barato realmente compensa? Informe a vida útil do produto" | `reality.html` |
| Resposta no topo, tempo de trabalho protagonista | R2 #8, #9, R1 2.4 | "Este produto custa **37 h 20 min** de trabalho · ≈ 4 dias e 5 h · Isso representa X% da sua renda" e uma frase-síntese que dá para dizer em voz alta | `js/reality-page.js`, `js/reality.js` (`formatarTempo`, `sintese`) |
| Semáforo como impacto | R2 #10, R1 2.4 | "Impacto baixo / moderado / alto" com o título contextual e "Isso não significa que você não deva comprar" | `js/reality.js`, `js/reality-page.js` |
| Orçamento concreto | R2 #11 | Compra, sobra do mês após os fixos, impacto e "Depois desta compra, ainda sobram R$ X"; o restante dos números fica recolhido, com a definição visível | `js/reality-page.js` |
| Metas em impacto temporal | R2 #12 | "Progresso atual R$ 400 / R$ 3.200 · Se comprar R$ 600, ela atrasa cerca de 2 meses, no seu ritmo de R$ 300 por mês" (ritmo real dos últimos 90 dias, ou o ritmo que o prazo pede) | `js/metas-engine.js` (`ritmoMensal`, `necessarioPorMes`), `js/reality.js` |
| Sustentabilidade enriquece, não interrompe | R2 #13 | Ordem: financeiro, tempo, metas, depois "Sustentabilidade ODS 12" | `reality.html` |
| Placeholder do conteúdo assíncrono | R1 2.4 | "Calculando uma estimativa ambiental… É uma estimativa, não uma medição" | `js/impacto-ambiental.js` |
| Reflexão sem virar questionário | R2 #14 | "Quer ir além? Três perguntas rápidas, menos de 30 segundos"; as outras três ficam a um toque | `js/reality-page.js` |
| Decisão como conclusão, com consequência | R2 #15, R1 2.4 | "Depois de ver tudo, o que você decidiu?": Comprar agora, Esperar, Não comprar e Buscar alternativa (usado, conserto, aluguel), cada uma dizendo o que acontece ao salvar; confirmação visível antes de gravar; "Por quê? (opcional)" | `js/config.js`, `js/reality-page.js` |
| "Cálculos" viram "análises" | R2 #16, #17, R1 5 | "Salvar esta análise", "Nova análise / Minhas análises", "Minhas análises salvas" | `reality.html`, `js/calculos.js`, `calculos.html`, `manifest.json` |
| Histórico como retorno de comportamento | R2 #18 | "Suas decisões": análises, valor analisado, dias de trabalho representados e compras não feitas na hora, com a ressalva de que é a decisão registrada, não prova | `js/calculos.js` |
| Comparar com outra opção | R2 #19, #20 | Mantém categoria, quantidade e parâmetros; compara preço, horas, uso e custo por mês, e avisa quando o barato perde por mês de uso | `js/reality.js` (`comparar`), `js/reality-page.js` |
| O que mudou | R2 #21 | Ao refazer a conta do mesmo item: "antes 42 h, agora 35 h" para preço, horas e custo por mês | `js/reality.js` (`oQueMudou`) |
| Feedback durante o processamento | R2 #22 | Etapas reais na tela: "Lendo seus dados financeiros… → Calculando o seu impacto… → Conferindo metas e alternativas…"; na busca: "Abrindo a página da loja… → Lendo o preço… → Conferindo parcelas…" | `js/reality-page.js`, `js/buscar-preco.js` |
| Erros humanos, com ação | R2 #23 | "Não conseguimos ler esse preço. Você pode digitar o valor manualmente ou tentar outro print", com os botões "Digitar o preço" e "Tentar outro print" | `js/buscar-preco.js` |
| CTA que antecipa o resultado | R2 #24 | "Ver o impacto da compra" (e "Atualizar o impacto" depois do primeiro resultado) | `reality.html` |
| Onde estou | R2 #25, R1 2.4 | Indicador fixo "1 Dados → 2 Impacto → 3 Reflexão → 4 Decisão", com estado e `aria-current` | `reality.html`, `js/reality-page.js` |
| Mobile | R2 #26 | O formulário começa na primeira tela do celular; campos e botões com 44 px; comparação empilhada em telas estreitas | `css/clareza.css` |

### Visual, acessibilidade e performance

| Recomendação | Origem | O que foi feito | Onde |
|---|---|---|---|
| Fundo "Órbita de decisões" | R1 3.2 | Três órbitas finas (dinheiro, tempo, metas) com opacidade de 0,06 a 0,14; ciclo de 35 a 60 s; um ponto maior a cada 8 a 12; trilhas curtas; grade pontilhada só no primeiro terço; vinheta na coluna do conteúdo; verde só quando a tela sinaliza equilíbrio (`FinckFundo.tom("positivo")`) | `js/ui-fx.js`, `css/clareza.css` |
| Comportamento do fundo | R1 3.2 | Ponteiro desloca no máximo 6 px; toque não move o fundo; 35% menos partículas em telas de formulário; versão expressiva no login e no topo do Reality; pausa em aba oculta; quadro parado com movimento reduzido | `js/ui-fx.js` |
| Controle visível de movimento | R1 3.2, WCAG 2.3.3 | Perfil → "Animações visuais": Completa, Reduzida, Desligada; vale na hora e em todas as telas | `perfil.html`, `js/preferencias.js` |
| Foco preso no modal, Esc só no de cima | R1 4 | Pilha de modais, Tab circula dentro do modal aberto, foco volta para quem abriu | `js/utils.js` |
| Abas pelo teclado | R1 4, R2 #27 | Setas, Home e End; só a aba ativa entra no Tab | `js/abas-reality.js` |
| Erro junto ao campo | R1 4 | `U.erroCampo()`: mensagem abaixo do campo com `role="alert"`, `aria-invalid` e `aria-describedby`, e foco no campo; aplicado em todos os formulários do app | `js/utils.js` e telas |
| Alvos de toque | R1 4, WCAG 2.5.8 | 44 px em ponteiro grosso para navegação, abas, chips, ajuda, datas, estorno | `css/clareza.css` |
| Cofre que não parece travamento | R1 6 | Abertura completa só na primeira tela da sessão; depois, um relance; a tela aceita clique assim que o cofre destrava | `js/finck-fx.js`, `css/finck-fx.css` |

### Demais telas

| Recomendação | Origem | O que foi feito |
|---|---|---|
| Metas: ação principal = Criar meta | R1 P0 | Botão "Criar meta"; `metas.html#nova` abre o formulário direto dos estados vazios |
| Jornada: "Conquistas e hábitos" e "Ver próxima conquista" | R1 P0, 2.5 | Subtítulo e botão principal |
| Análises e Relatórios com papéis claros | R1 2.5 | Análises = entender para onde vai o dinheiro; Relatórios = fechar o mês e exportar; cada tela aponta para a outra |
| Cenários explica que compara alternativas | R1 2.5 | Novo texto do herói |
| "Ações locais" → "Alternativas perto de você" | R1 5 | Título da tela e atalho |

## 2. Quando os relatórios discordam

| Ponto | Relatório 1 | Relatório 2 | Decisão e motivo |
|---|---|---|---|
| Categoria | Obrigatória junto com item e preço | Secundária, inferida | **Inferida e confirmável.** Atende os dois: a categoria continua no resultado, mas deixa de ser uma tarefa antes dele. |
| Reflexão antes de decidir | "Decidir bloqueado até responder" | Reflexão opcional, para não virar questionário | **Opcional.** O app promete "sem julgar a sua escolha" e já dizia "nenhuma resposta bloqueia a compra"; bloquear contradiria essa promessa. |
| Etapas do Reality | Analisar, Refletir, Decidir, Acompanhar | Dados, Impacto, Reflexão, Decisão | **As do relatório 2** na tela do Reality, porque espelham as quatro seções que a pessoa vê. O ciclo Analisar → Refletir → Decidir → Acompanhar segue na home, onde descreve a jornada completa (o acompanhamento acontece 30 dias depois, em Decisões). |
| Campo de preço | Trocar a explicação, mantendo centavos como alternativa | Aceitar tudo, sem explicar | **Aceitar o preço como se lê** ("800" = R$ 800). Manter a máscara de centavos tornaria falsa a instrução "digite como você vê o preço". A troca vale para o app inteiro, para não haver dois comportamentos. |
| Nomes da tabela de microcopy | Direção para testar, não ordem | Nomes diretos ("Minhas análises") | Adotados os nomes que não mudam o sentido; os demais ficam para o teste com usuários (seção 4). |

## 3. Critérios de aceite e como verificar

| Critério (relatório 1) | Como verificar |
|---|---|
| Em cada tela, dizer em menos de 5 s qual é a ação mais importante | Teste com usuários, tarefa 1 e pergunta "o que você faria agora?" |
| A primeira tela permite iniciar o valor principal sem ler o dashboard | Print 375 × 812 da home: "Analisar uma compra" aparece sem rolar |
| Nenhum número essencial exige mouse para ser entendido | Inspeção: nenhum `title` é o único canal de explicação na home e no resultado do Reality |
| Uma pessoa sem conta começa a demonstração sem confundir com login | Teste com usuários na tela de entrada |
| No onboarding, saber em que etapa está, quanto falta e por quê | Indicador de etapas e linhas de ajuda |
| Explicar em voz alta o resultado da análise sem interpretar os cartões | Frase-síntese no topo do resultado |
| Ler qualquer texto sem uma partícula parecer estar por cima | Vinheta da coluna de conteúdo e opacidade das órbitas; conferir com "Animações: Completa" |

Testes automatizados que cobrem a camada de UX: suítes "Campo de dinheiro",
"Reality: categoria, tempo, síntese e comparação (UX)" e "Metas: ritmo de
aportes e atraso de uma compra" em `testes.html`.

## 4. Teste com usuários (antes da entrega)

Com pelo menos três pessoas que não participaram do desenvolvimento, no
celular, sem explicar o caminho:

1. "Você quer descobrir se pode comprar um fone de R$ 800. Onde começaria?"
2. "Quanto dinheiro você tem disponível depois dos compromissos?"
3. "Como você descobriria quantas horas de trabalho essa compra custa?"
4. "Crie uma meta para um notebook."
5. "Você lançou uma compra errada. Como corrigiria?"

Observar: onde a pessoa toca primeiro; se lê a navegação ou procura o botão
principal; quais números interpreta errado; se entende a diferença entre
análise, decisão e lançamento; se percebe que "Comprar agora" altera o
extrato; se a decoração ajuda, distrai ou passa despercebida.

Perguntar, além de "você gostou?": "O que você acha que este número
significa?", "O que aconteceria se tocasse aqui?", "O que você faria
agora?", "O que te deixou inseguro?".

Ao final, aplicar o questionário SUS (System Usability Scale, Brooke, 1996):
dez afirmações em escala de 1 a 5, nota de 0 a 100. Registrar o tempo de
cada tarefa, os erros e a nota SUS por pessoa; comparar com uma rodada
feita na versão anterior, se houver.

## Referências

- BROOKE, J. SUS: a quick and dirty usability scale. In: JORDAN, P. W. et
  al. (org.). *Usability evaluation in industry*. London: Taylor &
  Francis, 1996.
- NIELSEN, J. *Usability engineering*. Boston: Academic Press, 1993.
- W3C. *Web Content Accessibility Guidelines (WCAG) 2.2*. 2023. Critérios
  1.4.3 (contraste mínimo), 2.3.3 (animação a partir de interações),
  2.5.8 (tamanho mínimo do alvo), 3.3.1 (identificação do erro).
  https://www.w3.org/TR/WCAG22/
