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

As seções 1 a 4 descrevem a primeira rodada como ela foi entregue. A seção
5 registra a segunda rodada, feita no mesmo mês a partir de três análises
atualizadas, que substituiu parte do que está nas seções anteriores: o
número "Pode sobrar depois dos compromissos" saiu da home, as etapas do
Reality passaram de "1 Dados → 2 Impacto → 3 Reflexão → 4 Decisão" para
"1 Compra → 2 Revelação → 3 Reflexão → 4 Decisão", o resumo "Suas
decisões" virou "Seu histórico" e a home passou a abrir com três perguntas
antes do Reality. Quando as duas seções divergem, vale a seção 5.

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

## 5. Segunda rodada (outubro de 2026): análises atualizadas

### 5.1 Contexto

Depois da primeira rodada, o app passou por três novas avaliações:

- **IA1**: nova leitura do app inteiro. Parte da ideia de que o FinCK tem
  dois produtos, o controle financeiro e o FinCK of Reality (uma ferramenta
  de decisão), e pede que o valor do que já existe fique visível: painel que
  responde a três perguntas, um momento de revelação no resultado do
  Reality, "análise" no lugar de "cálculo", estados vazios como estado
  inicial, histórico que vira aprendizado e IA nos bastidores. Também lista
  o que não deve mudar (identidade visual, 3D, animações, sustentabilidade,
  reflexão e histórico).
- **IA2**: segunda auditoria, feita sobre a versão 7cd2c6c. Reconhece a
  evolução, mas aponta quatro bloqueadores: dois P0 (o botão "Ver o impacto
  da compra" ficava sob a navegação inferior; a home mostrava números de
  disponibilidade que pareciam contradizer a programação de 60 dias) e dois
  P1 (a demonstração parecia incompleta, com todas as movimentações "sem
  conta"; o Assistente só revelava depois do clique se o plano vinha da IA
  ou das regras locais). Traz ainda pontos sobre o Reality, a home longa, o
  convite de instalação, a acessibilidade e um critério final de prontidão.
- **IAF**: avaliação dedicada só à FINCK AI. Pede que a IA não seja um chat
  genérico, mas uma consultora dentro do resultado do Reality, que explique
  de onde vem cada conclusão, separe dado confirmado de estimativa, pergunte
  quando falta informação e nunca dê ordem de compra.

As três chegam ao mesmo diagnóstico: o visual não é o problema. Faltavam
confiança operacional (agir sem que algo cubra o botão), consistência
semântica (cada número com um nome e uma janela de tempo) e transparência
sobre o que é conta do FinCK e o que é texto de IA. A identidade (paleta,
logos 3D, prisma, cofre e fundo) foi mantida.

O trabalho foi organizado por área do app (base e navegação; painel; dados
de exemplo e demais telas; FinCK of Reality; Análise FinCK; Assistente e
rotas de IA), seguido de uma integração entre as áreas e de uma revisão
adversarial (seção 5.6). A Análise FinCK, que concentra a avaliação da IAF,
está descrita em `docs/analise-finck.md`.

### 5.2 Rastreabilidade: IA2 (segunda auditoria)

| Recomendação | Decisão tomada | Onde no código | Status |
|---|---|---|---|
| §1 (P0) O botão "Ver o impacto da compra" não pode ficar sob a navegação inferior | A altura da navegação e a do header passam a ser medidas de verdade e publicadas em variáveis CSS; o fim de toda página reserva essa área, com a área segura do celular, e o `scroll-padding` do `html` faz foco e rolagem pararem fora das barras | `js/nav.js`, `css/style-principal.css` | feito |
| §1 Depois do Enter, título e resposta visíveis, fora das etapas presas | A altura das etapas do Reality entra no `scroll-padding` por `--altura-barra-presa`; a rolagem até o resultado calcula o alvo (a rolagem suave do navegador parava cerca de 80 px acima) e a liberação da etapa 2 é anunciada | `css/clareza.css`, `js/reality-page.js` | feito |
| §1 Botões de modais perto do rodapé | Os modais ficam acima da navegação; o último botão foi conferido em 375×812, 320×568 e 640×400 | `css/style-principal.css` | feito (já existia) |
| §2 (P0) Números de disponibilidade com duas leituras | Projeções com nome explícito em `ctx.projecoes`. Na home: Saldo atual (dinheiro registrado), Sobra da renda após fixos (por mês), Caixa depois das saídas previstas (próximos 60 dias, com a data final) e Parcelas ainda a pagar. Saem "Pode sobrar depois dos compromissos" e "Não comprometido"; no Reality, "Disponível projetado" vira "Saldo depois das parcelas" | `js/finance.js`, `home.html`, `js/home.js`, `js/programacao-home.js`, `js/reality.js` | feito |
| §2 A mesma lista de compromissos no caixa e na programação | A programação de 60 dias junta recorrentes, lançamentos agendados (sem duplicar) e parcelas; o aviso de falta de dinheiro só aparece quando o caixa corrido, com as entradas previstas, fica negativo | `js/programacao.js`, `js/home.js` | feito |
| §3 (P1) Demonstração com contas fictícias | Opção recomendada pela auditoria: Conta corrente (Banco exemplo) e Carteira, movimentações vinculadas e saldo conciliado | `js/store.js`, `js/finance.js`, `js/config.js` | feito |
| §3 A demonstração deve parecer deliberada | Sem contas, a etiqueta "sem conta" sai de cada linha e vira um aviso único; salário e aluguel de exemplo entram como previsões já confirmadas, para a home não pedir a confirmação de algo que já aconteceu | `js/home.js`, `js/store.js` | feito |
| §4 (P1) Declarar o modo da IA antes do clique | Três modos com título, texto e botão próprios: Plano demonstrativo, Plano local e Plano com IA. Selo de origem antes e depois; ficha visível com quem escreve, o que é enviado, o que fazer se a FINCK AI falhar e onde o plano fica salvo | `assistente.html`, `js/assistente.js` | feito |
| §4 Aviso perto do campo da conversa; "O que é enviado" cobrindo plano e conversa | Aviso com o texto sugerido; "O que é enviado" mostra o formato dos dois pedidos e o retrato | `assistente.html`, `js/assistente.js` | feito |
| §4 Conversa desligada na demonstração | Decisão diferente: a conversa responde também na demonstração, só com os números de exemplo e com aviso antes do envio (seção 5.5) | `js/assistente.js`, `api/ia.js` | feito, com outra decisão |
| §5A Estado de processamento no botão | "Lendo seus dados…", "Calculando o impacto…" e "Análise pronta", com `aria-busy`; a lista de etapas acompanha o que de fato roda | `js/reality-page.js`, `reality.html` | feito |
| §5B Resultado visível depois da rolagem automática | Título logo abaixo das etapas presas e frase-síntese na tela em 375×812, 390×844, 768×1024 e 1280×900 | `js/reality-page.js`, `css/reality-fluxo.css` | feito (em 320×568 a síntese termina no limite da navegação) |
| §5C Linha do tempo densa | Conclusão curta primeiro, quatro cartões, aviso de simulação e a frase dos juros no próprio cartão; comparação, gráfico, conta mês a mês e fórmulas em "Ver a simulação completa", recolhida | `js/linha-tempo.js`, `js/linha-tempo-engine.js` | feito |
| §5D Rotativo sem reprimenda | A frase sugerida pela auditoria, como consequência do cenário | `js/linha-tempo-engine.js`, `js/inteligencia-engine.js` | feito |
| §6 Home longa na primeira visita | Faixa "Comece pelo Reality"; "O que seus números dizem" e "Mais ferramentas" recolhidas só na primeira visita, depois vale a escolha da pessoa | `home.html`, `js/home.js` | feito |
| §6 Uma ação principal por seção | "Ver programação completa" passou a secundária; o Reality é a única ação principal do topo | `home.html`, `js/programacao-home.js` | feito na home |
| §7 Convite de instalação | Só depois da primeira análise salva, com o texto "Adicionar o FinCK à tela inicial", no fluxo da página (não flutua sobre nada) e 30 dias de espera ao dispensar | `js/home.js`, `js/programacao-home.js` | feito (instalação real não testada) |
| §8 Acessibilidade | Teclado, 320 px sem rolagem horizontal, zoom de 200% simulado (640×400 e 320×568), animação desligada, contraste dos estados desabilitados e da nota do saldo, foco visível nos chips, regiões vivas que só falam quando o texto muda | CSS e telas | parcial: falta leitor de tela real |
| §8 Último elemento focável alcançável | Conferido em home, Reality, metas, perfil e assistente, em cinco tamanhos: o último focável fica acima da navegação e o Tab percorre a página sem foco atrás das barras | `css/style-principal.css` | feito |
| §9 O que não alterar | Logos 3D, fundo, prisma, cofre, paleta, sustentabilidade, gamificação e horas de trabalho continuam | todo o app | feito |

### 5.3 Rastreabilidade: IA1 (app inteiro)

| Recomendação | Decisão tomada | Onde no código | Status |
|---|---|---|---|
| §2 e §23 Duas famílias: Minha vida financeira e FinCK of Reality | As famílias ficam registradas na navegação (`FinckNav.FAMILIAS` e `data-familia`) e dividem "Mais ferramentas" da home; o nome acessível do Reality na navegação é "Reality: antes de comprar, descubra o impacto" | `js/nav.js`, `home.html` | parcial: a barra inferior de cinco itens não foi redesenhada |
| §3 e §8 Informação seguida de ação | Cada bloco do painel termina numa ação (o cartão do saldo ganhou "Ver as saídas previstas") | `home.html`, `js/home.js` | parcial: nas demais telas, só nos estados vazios |
| §4 O painel responde a três perguntas | "Como estou?", "Para onde meu dinheiro está indo?" e "O que fazer agora?", seguidas de "Quer comprar alguma coisa?" com o Reality como ação principal | `home.html`, `js/home.js` | feito |
| §5 e §6 Momento de revelação | Cadeia preço → horas do seu trabalho → dias de trabalho → peso na sobra do mês → prazo da meta, com o selo de impacto e a frase-síntese; cada número aparece por inteiro num lugar só | `js/reality.js` (`cadeiaDoImpacto`), `js/reality-page.js` | feito |
| §7 O 3D participa do resultado | O logo 3D do Reality é a âncora visual da revelação e fica parado com movimento reduzido | `js/finck-fx.js`, `js/reality-page.js` | feito |
| §9 Lançamento rápido | Valor, descrição e Registrar; categoria, data, conta e meta em "Mais detalhes (opcional)"; categoria sugerida pela descrição e confirmada ao registrar; confirmação e Desfazer no próprio painel | `home.html`, `js/home.js` | feito |
| §10 e §11 Estado vazio como estado inicial | "Sua conta está pronta", "Você ainda não definiu uma meta", "Seu extrato está limpo" e "Você ainda não analisou nenhuma compra", cada um com uma ação | home, metas, contas, análises, relatórios, decisões e Reality | feito |
| §12 e §13 "Análise" no lugar de "cálculo"; "real" fora do nome da análise | Textos visíveis do Reality, da Jornada, do perfil, das conquistas e de Cenários; identificadores internos mantidos | várias telas | feito |
| §14 Narrativa do Reality | Etapas 1 Compra, 2 Revelação, 3 Reflexão e 4 Decisão; metas, orçamento, próximos meses e sustentabilidade em "Quer olhar mais fundo?" | `reality.html` | feito, com nomes ajustados (seção 5.5) |
| §15 Reflexão sem cara de prova | "3. Pense na sua compra", perguntas em cartões, "O que suas respostas mostram" e a nota como "67 de 100"; "Nenhuma resposta bloqueia a compra" continua | `js/reality-page.js`, `js/reality.js` | feito |
| §16 O ciclo da decisão | "Quero comprar → Analiso → Entendo → Reflito → Decido → Registro", marcado só quando cada passo acontece, e a frase "O FinCK não decide por você" | `reality.html`, `js/reality-page.js` | feito |
| §17 Histórico como aprendizado | "Seu histórico" em Minhas análises (seção 5.7) | `js/reality.js`, `js/abas-reality.js`, `js/calculos.js` | feito |
| §18 Reality conversa com Metas | Antes de decidir, o prazo a mais na meta; depois de comprar, "continua com R$ Y guardados; prazo estimado +N" | `js/reality.js` | feito |
| §19 Confirmação clara no extrato | "✓ Compra registrada. R$ X adicionados ao seu extrato como saída…"; nas outras decisões, "Nada foi lançado no extrato". A frase "Sua meta foi atualizada" não foi usada (seção 5.5) | `js/reality.js` (`confirmacaoRegistro`) | feito |
| §20 IA invisível | O nome FINCK AI aparece só onde a IA escreve; conta do FinCK nunca é chamada de IA | Reality e Assistente | parcial: onde a IA pode ser chamada, a origem é declarada antes (seção 5.5) |
| §21 O que não mexer | Identidade, paleta, 3D, vidro, animações, sustentabilidade, reflexão e histórico mantidos | todo o app | feito |
| §22 Fase 2: repetir análise e comparar | "Analisar de novo" em Minhas análises; Cenários abre o Reality com item e preço preenchidos; "Comparar com outra opção" já existia | `js/calculos.js`, `js/reality-page.js` | feito |

### 5.4 Rastreabilidade: IAF (FINCK AI)

O detalhe de cada capacidade está em `docs/analise-finck.md`.

| Recomendação | Decisão tomada | Onde no código | Status |
|---|---|---|---|
| §1 Identidade própria | "✦ Análise FinCK" no resultado; o nome FINCK AI só onde a IA escreve | `js/inteligencia.js`, `js/assistente.js` | feito |
| §2 Três níveis de participação | Invisível (sugestões confirmáveis), explicativa (Análise FinCK, por regra) e conversacional (só quando a pessoa pergunta) | Reality e Assistente | feito |
| §3 Área especial no resultado do Reality | Pontos numerados, "Nossa leitura", perguntas, cenários e conversa | `js/inteligencia-engine.js`, `js/inteligencia.js`, `reality.html` | feito |
| §4 e §20 Consultor, não juiz nem vendedor | A leitura por regra termina em "A decisão continua sendo sua."; prompts de consultora e filtro de respostas com cara de veredito | `js/inteligencia-engine.js`, `api/ia.js`, `api/_openrouter.js`, `api/assistente-ia.js` | feito |
| §5 e §19 "Por quê?" e "Como chegamos nisso?" | Em cada ponto da Análise FinCK; "Por que o FinCK diz isso?" também em cada prioridade do plano do Assistente | `js/inteligencia.js`, `js/assistente.js` | feito |
| §6 Dado confirmado x Estimativa | Selos na Análise FinCK, na linha do tempo e no raio-X; cenários com o selo Simulação; nenhum percentual de confiança | `js/inteligencia.js`, `js/linha-tempo.js`, `js/assistente.js` | feito |
| §7 e §8 Perguntar quando falta | Vida útil (12, 24 ou 36 meses) na Análise FinCK; forma de pagamento uma vez só, na linha do tempo; gastos do dia a dia quando não há histórico | `js/inteligencia-engine.js`, `js/linha-tempo-engine.js` | feito |
| §9 e §10 IA com o contexto do FinCK | Contexto só com números e campo `contexto` na `/api/ia` | `js/inteligencia-engine.js`, `api/ia.js` | feito |
| §11 Conversa contextual com sugestões | "Converse sobre esta compra" no Reality e "Pergunte sobre o seu raio-X" no Assistente | `js/inteligencia.js`, `js/assistente.js` | feito |
| §12 Cenários "E se...?" | Agora, Daqui a 2 meses e Parcelado, pela regra única do atraso | `js/inteligencia-engine.js`, `js/reality.js` | feito |
| §13 Detectar oportunidade | A compra comparada ao que já está guardado nas metas | `js/inteligencia-engine.js` | feito |
| §14 e §15 IA sugere, pessoa confirma | Categoria com Confirmar e Alterar; preço lido só entra com "Usar este preço"; meta sugerida só vira meta com "Criar esta meta"; a Análise FinCK não grava nada | `js/reality-page.js`, `js/buscar-preco.js`, `js/home.js`, `js/assistente.js` | feito |
| §16 Não interromper | No máximo três pontos acima da relevância mínima e nenhum aviso flutuante | `js/inteligencia-engine.js` | feito |
| §17 e §18 Carregamento com etapas reais | Etapas do Reality e da conversa seguem o que de fato roda, sem "pensando" | `js/reality-page.js`, `js/inteligencia.js`, `js/assistente.js` | feito |
| §22 e §23 Não chamar cálculo de IA | Rótulos distintos: "Cálculo do FinCK" e "✦ FINCK AI" | Reality e Assistente | feito |
| §24, prioridade 7: IA integrada ao histórico, metas e extrato | A ligação com metas e extrato é por cálculo, e o histórico é lido por regra | `js/reality.js` | parcial: a FINCK AI não lê o histórico |
| Introdução: preço comparado à média de produtos semelhantes | Não implementado | | não feito: o app não tem base de preços confiável, e inventar a média contrariaria a regra de não inventar números |

### 5.5 Decisões e conflitos

| Ponto | O que as análises pediam | Decisão e motivo |
|---|---|---|
| Nomes das etapas do Reality | IA1 §14: Entrada, Revelação, Contexto e Decisão; a rodada anterior usava Dados, Impacto, Reflexão e Decisão | **1 Compra, 2 Revelação, 3 Reflexão e 4 Decisão.** "Entrada" virou "Compra" porque no app "entrada" é dinheiro que entra. Uma primeira versão chamou a etapa 3 de "Contexto" e pôs a reflexão nela; a revisão apontou que a IA1 define contexto como metas, sustentabilidade e vida útil. Por isso o contexto foi para "Quer olhar mais fundo?", dentro da revelação, e a etapa 3 voltou a ser a reflexão ("Pense na sua compra"). |
| IA invisível ou origem declarada | IA1 §20: IA nos bastidores, sem "agora a IA vai…"; IA2 §4: dizer antes do clique se a resposta vem de regras ou de IA; IAF §1 e §22: o nome aparece onde explica a função | As regras valem em lugares diferentes. Conta e regra do FinCK aparecem sem rótulo de IA (a Análise FinCK diz que é feita "sem IA"). Onde a IA pode ser chamada (plano e conversas), a origem é declarada antes do clique e repetida na resposta. O título "Plano com IA" foi mantido porque a IA2 pede a origem explícita. |
| FINCK AI na demonstração | IA2 §4 achava correto desligar a conversa na demonstração; a IAF pede conversa contextual; a revisão encontrou uma regra no Reality e outra no Assistente | **Uma regra só.** A FINCK AI responde também na demonstração, pela `/api/ia`, só com números (os de exemplo) e com aviso antes do envio. O plano do Assistente na demonstração continua pelas regras do FinCK ("Plano demonstrativo"), sem chamada. A demonstração mostra a conversa funcionando sem fingir que o plano foi escrito pela IA. |
| Demonstração sem contas | IA2 §3: contas fictícias (recomendada) ou declarar "sem contas" | **Contas fictícias**, porque mostram a consolidação e a conciliação. Fora da demonstração nenhuma conta é criada, e quem já cadastrou uma conta própria na demonstração não recebe as fictícias. |
| Tamanho do resultado do Reality | IA1 §5: não reduzir o Reality, torná-lo memorável; IA2 §5C e IAF §16: densidade e excesso de destaques. A revisão mediu o resultado 72% mais longo, com números repetidos em três a seis blocos | **Encurtar sem apagar conteúdo.** Cada número aparece por inteiro num lugar só; a Análise FinCK mostra só o que a revelação ainda não mostrou; metas, orçamento, próximos meses e sustentabilidade ficam recolhidos em "Quer olhar mais fundo?"; "Ver todos os números do orçamento" e "Ver a simulação completa" guardam os detalhes. Critério adotado: no máximo cerca de 1,3 vez a altura da versão anterior (tabela abaixo). |
| Onde perguntar a forma de pagamento | IAF §7 sugere perguntar; a linha do tempo já pergunta "Como você pagaria?" | Uma vez só, na linha do tempo. Até a pessoa escolher, o parcelamento aparece como exemplo, tanto na linha do tempo quanto nos cenários. |
| "Sua meta foi atualizada" | IA1 §19 | Não usada: nenhuma decisão move dinheiro de meta, e a frase descreveria algo que não acontece. |

Altura do resultado do Reality na demonstração, em 375×812:

| Compra analisada | Versão 7cd2c6c | Versão atual |
|---|---|---|
| Notebook de R$ 4.000 | 6.548 px | 3.431 px |
| Fone de R$ 800 | 6.403 px | 3.072 px |
| Livro de R$ 45 | 6.319 px | 2.375 px |

### 5.6 Revisão adversarial

Depois da integração, a versão passou por uma revisão adversarial em quatro
lentes. Em cada uma, o objetivo era quebrar o produto de um ângulo, lendo o
código e usando o app em demonstração em vários tamanhos de tela, sempre em
comparação com a versão 7cd2c6c.

| Lente | Achados | Bloqueadores | Importantes | Menores |
|---|---|---|---|---|
| Funcionamento | 17 | 2 | 9 | 6 |
| Conformidade com as análises | 16 | 3 | 12 | 1 |
| Acessibilidade e mobile | 16 | 0 | 7 | 9 |
| Segurança, privacidade e textos | 12 | 0 | 4 | 8 |
| **Total** | **61** | **5** | **32** | **24** |

**Bloqueadores.** Os cinco achados descrevem quatro problemas, porque dois
deles tratam do mesmo fluxo de decisão:

1. *O Reality ainda dizia "Disponível projetado" e "o que pode sobrar
   depois dos compromissos"*, o que deixava o P0 da IA2 §2 aberto fora da
   home. Resolvido com o mesmo vocabulário da home ("Saldo depois das
   parcelas") e um teste que proíbe os textos antigos.
2. *O atraso na meta se contradizia dentro do mesmo resultado*, e os
   cenários diziam usar "a mesma regra" sem usá-la. Resolvido com a regra
   única do atraso (seção 5.7), usada pela revelação, pelo bloco de metas,
   pelos pontos da Análise FinCK, pelos cenários e pelas respostas
   calculadas, e com um formato só para o prazo. Os testes conferem que a
   mesma compra dá o mesmo atraso em todos esses lugares e que uma compra
   que cabe na folga não mostra atraso em nenhum.
3. *Salvar e trocar a decisão* (dois achados): depois de "Comprar agora",
   "Salvar esta análise" apagava a decisão e dizia "Nada foi lançado no
   extrato" com a saída já lançada, e trocar a decisão deixava a saída no
   extrato com a mesma frase. Agora a confirmação lê o que foi gravado de
   fato; "Salvar esta análise" fica desligado depois de uma decisão salva;
   trocar uma decisão de compra pergunta se é para estornar a saída
   ("Estornar a saída e salvar") ou mantê-la ("Manter a compra"), e o
   estorno preserva o histórico; uma análise nova (outro preço ou outro
   item) começa sem decisão marcada, para não lançar uma segunda saída sem
   escolha.
4. *"Apagar tudo" deixava previsões fantasmas* e pedia para confirmar
   salário e aluguel já apagados. A limpeza passou a levar também previsões,
   fechamentos e conciliações, e previsões em aberto de recorrentes que não
   existem mais deixam de contar.

**Importantes, agrupados por tema** (achado → como foi resolvido):

- *Home e dados*: alarme falso de falta de dinheiro na demonstração, que
  ignorava R$ 7.000 de entradas previstas → caixa corrido com as entradas;
  "Analisar uma compra" fora da primeira tela em 360×740 e 375×667 → faixas
  de altura que só reduzem espaçamentos e, abaixo de 760 px, escondem notas
  que não são alerta, mais o ajuste para telas de toque descrito na nota
  adiante; seções
  recolhíveis fechadas para sempre → fechadas só na primeira visita; avisos
  empilhados sobre botões → um aviso só para conquistas, recusas de XP sem
  aviso e confirmações dentro do próprio painel, no registro rápido e no
  Reality; Desfazer que quebrava quando o estorno falhava → o botão é
  guardado antes da espera; o prisma dizendo 77% de uma meta ao lado de
  13% da mesma meta → "do que ainda falta".
- *Reality e FINCK AI*: regra da FINCK AI diferente entre telas e o link
  "Ver como esta compra cabe no seu planejamento" levando o nome do item e
  uma pergunta de veredito → uma regra só (seção 5.5) e a pergunta neutra
  "Como uma compra de R$ 800,00 mexe no meu planejamento?"; Cenários perdia
  item e preço ao abrir o Reality → passados no endereço e preenchidos; a
  linha do tempo chamava de "sua escolha" um parcelamento em 10x que a
  pessoa não escolheu e concluía "cabe" logo abaixo de "Impacto alto" →
  "exemplo" até a escolha, e uma frase explica que o selo mede o dinheiro
  de agora e a simulação mede o fôlego dos próximos meses; cenários que
  faziam o parcelamento com juros parecer de graça → total pago e juros
  sempre à vista; três valores diferentes para "aportes nas metas por mês"
  → fonte única, contando meses de calendário como a tela de Metas; dois
  "custo real" com valores diferentes → um deles passou a dizer "sem
  imprevisto"; a categoria lida pelo leitor da página chamada de "IA do
  Google" → "lida na página da loja"; a etapa "Contexto" com a reflexão e
  o resultado 72% mais longo → seção 5.5; duas recomendações sem
  responsável (repetir a análise, da IA1, e a prioridade 7 da IAF) →
  "Analisar de novo" e a leitura do histórico por regra.
- *Assistente e rotas*: plano pelas regras que mandava reforçar uma
  reserva já acima do primeiro degrau e sugeria uma meta que já existia →
  aponta o próximo alvo e não repete a meta; filtro de tom que recusava
  respostas de consultora no subjuntivo ("caso você compre") e deixava
  passar vereditos ("pode comprar tranquilo") → filtro refeito, com casos
  de teste dos dois lados.
- *Textos*: "cálculo" ainda na Jornada → "análise".
- *Acessibilidade e mobile*: sugestão de categoria anunciada a cada tecla
  e várias regiões vivas falando juntas → só falam quando o texto muda;
  contraste de 2,63:1 nos desabilitados e de 3,90:1 na nota do saldo →
  sem opacidade reduzida, com a cor de texto secundário e borda tracejada;
  sinal de menos quebrado numa linha separada do valor → valor negativo
  sem quebra; foco invisível nas opções da reflexão → regra geral de foco
  nos chips; frase-síntese atrás da navegação em 320×568 depois do Enter →
  em celulares de até 700 px de altura, a revelação fica mais compacta (a
  linha do preço, que já está no campo, e a dos dias de trabalho saem da
  cadeia, e o logo 3D diminui); agora a síntese termina no limite da
  navegação.

**Menores.** Quase todos corrigidos: resumos com 44 px no toque, contraste
da sigla da Carteira, selo da programação coberto pelas torres 3D,
formatos diferentes para o mesmo atraso, contas como "= 1,0" na resposta
calculada, erros de português, o gênero de "o FinCK" na pergunta "Por que o
FinCK diz isso?", análise de exemplo sem renda ("Salário base na época:
R$ 0,00"), a memória de 10 minutos do plano declarada na ficha e o aviso de
conquista sem link quando a pessoa já está na Jornada.

**Descartados ou resolvidos de outro jeito:**

- *Home em 320×568*: "Analisar uma compra" continua abaixo da navegação na
  primeira tela. A versão 7cd2c6c já era assim, e caber nessa altura
  exigiria esconder as respostas das três perguntas, o que seria pior. O
  critério adotado foi 360×740 e 375×667.
- *Selo da programação sobre as torres 3D*: a alternativa sugerida (tirar o
  selo da posição absoluta) não funciona, porque a câmera 3D é pintada por
  cima; o selo ganhou uma camada acima dela, com fundo escuro.
- *Contraste do link "Ver os números que vão junto" da linha do tempo*: o
  bloco deixou de existir no corte de densidade (a explicação da linha do
  tempo passou para a conversa da Análise FinCK), e o mesmo link na
  conversa já passava (4,63:1).
- *Passar a pergunta do Reality ao Assistente por fragmento ou por
  armazenamento de sessão*: mantido o parâmetro `?pergunta=`, que agora
  leva só valores, sem o nome do item.
- *Ajustes do Assistente para a conversa desligada na demonstração*:
  substituídos pela decisão de a conversa responder na demonstração.
- *Frase com os números do caixa no "Como estou?"*: ficou só no cartão da
  programação; o topo usa uma frase curta, para não repetir o número nem
  empurrar o botão do Reality para baixo da navegação.
- *Marcadores de célula vazia herdados* em tabelas que esta rodada não
  tocou: não são texto novo, e nenhuma linha nova os usa.

**Nota sobre o botão da home.** A conferência final, feita para este
documento, mostrou que o resultado dependia do tipo de ponteiro. Com toque
emulado, os links das três perguntas ganhavam a altura mínima de 44 px,
cada cartão crescia e a parte de baixo de "Analisar uma compra" ficava sob
a navegação (34 px em 375×812 e quase o botão inteiro em 375×667). A
correção mantém a área de toque de 44 px dos links, mas uma margem negativa
devolve a altura extra ao cartão (`css/painel.css`). Medido de novo com
toque emulado, o botão fica inteiro acima da navegação em 375×812 (649 a
703 px, navegação a partir de 731 px), 375×667 (522 a 576, navegação em
586), 360×740, 390×844 e 412×915. Em 320×568 ele continua abaixo da
primeira tela, como já acontecia na versão 7cd2c6c.

**Testes ao final.** Suíte do navegador (`testes.html`) com 400 testes
verdes e nenhuma falha, incluindo as suítes novas `js/testes-reality.js`,
`js/testes-inteligencia.js`, `js/testes-linha-tempo.js`,
`js/testes-painel.js` e `js/testes-dados.js`. Ferramentas que rodam sem
rede: `testar-ia` (66), `testar-assistente` (80), `testar-programacao`
(55), `testar-ocorrencias` (53), `testar-extracao` (95), `testar-impacto`
(31), `testar-locais` (22) e `testar-print` (51), todas verdes.
`testar-busca-ia` e `testar-lojas` dependem de rede e de credenciais e não
rodaram neste ambiente.

### 5.7 Notas técnicas

**Barras fixas.** `js/nav.js` mede a navegação inferior e o header com um
`ResizeObserver` e publica `--altura-nav-inferior` e `--altura-header`,
porque as duas alturas mudam com a fonte, o zoom e os alvos de toque; os
valores do CSS valem só até a medição. `--espaco-nav-inferior` soma a
altura da navegação, o recuo da borda (o maior entre 0,85 rem e a área
segura do celular, `env(safe-area-inset-bottom)`) e uma folga, e é o
`padding-bottom` do
`body`: o fim de toda página fica livre. Uma página com outra barra presa
logo abaixo do header informa a altura dela em `--altura-barra-presa`; no
Reality, é a altura das etapas (fixa em rem, maior com toque).

**`scroll-padding`.** O `html` tem `scroll-padding-top` igual ao header
mais a barra presa e `scroll-padding-bottom` igual a
`--espaco-nav-inferior`. Com isso o foco pelo Tab (nos dois sentidos), os
links de âncora e o `scrollIntoView` param entre as barras, sem que cada
tela precise de margens próprias.

**Tela baixa.** Até 500 px de altura (celular deitado ou zoom de 200%),
header e etapas voltam ao fluxo da página e o `scroll-padding-top` é
reduzido. A navegação inferior continua fixa.

**`ctx.projecoes` e o caixa corrido.** `FinckFinance.carregarContexto()`
devolve projeções com nome: `saldoAtual`, `parcelasAPagar`,
`saldoAposParcelas`, `sobraRendaAposFixos`, `saidasPrevistas60Dias`,
`entradasPrevistas60Dias`, `caixaAposPrevisoes60Dias` (saldo menos as
saídas previstas) e `menorCaixaComEntradas60Dias`, o menor saldo do
período percorrendo entradas e saídas na ordem das datas. É este último
que decide se a home avisa que vai faltar dinheiro: as entradas previstas
contam no dia em que entram. Nas telas que não carregam a programação
(`js/programacao.js`), os campos de 60 dias ficam nulos em vez de
inventados.

**Âncoras.** `home.html#novo-lancamento` abre o registro rápido, tanto ao
carregar a página quanto por mudança de endereço, e limpa o endereço para
que recarregar não reabra o formulário; é o destino de "Adicionar
lançamento" nos estados vazios de outras telas. `home.html#movimentacoes`
leva às últimas movimentações e é o destino de "Ver no extrato" depois de
uma compra registrada no Reality.

**Convite de instalação.** `FinckPainel.deveConvidarInstalacao` só libera o
convite quando o app ainda não está instalado, o navegador oferece a
instalação e existe pelo menos uma análise salva pela própria pessoa (a de
exemplo da demonstração não conta). Dispensado, ele espera 30 dias.

**`prepararContasDemo`.** Em `js/store.js`, roda uma vez por versão, de
forma síncrona, quando o store carrega em demonstração (antes de qualquer
tela ler os dados) e depois de carregar a demonstração. Cria a Conta
corrente (Banco exemplo) e a Carteira, divide entre elas o saldo inicial
do perfil, vincula movimentações e recorrentes sem conta, registra um saque
de R$ 200 para a carteira e marca o saldo do perfil como migrado. O
resultado é conciliado: saldo geral de R$ 2.880 = R$ 2.580 na corrente +
R$ 300 na carteira. Quem já tinha a demonstração antiga ganha as contas
sem perder nada.

**Histórico como aprendizado.** `FinckReality.resumoHistorico` conta
análises, valor avaliado, adiadas, descartadas, com alternativa, realizadas
e decisões diferentes de comprar na hora; `fraseHistorico` diz "O FinCK
ajudou você a tomar N decisões diferentes de comprar na hora", contando só
as decisões salvas (não o que aconteceu depois); `leituraHistorico`, por
regra e sem IA, aponta a categoria em que a pessoa mais adiou ou desistiu,
com o valor e as horas de trabalho. Em Minhas análises, "Seu histórico"
substitui o antigo "Suas decisões" da primeira rodada.

**Impacto sobre o total com quantidade.** `FinckReality.calcular` faz todas
as contas sobre o total (preço da unidade × quantidade): horas, dias,
percentual da renda, saldo depois, metas, selo e alternativas. O campo
`price` gravado continua sendo o preço da unidade, e `quantity`,
`work_hours`, `balance_after` e o nível de impacto valem para o total.
`R.valorTotal` é usado no histórico, nas listas de Minhas análises, de
Decisões e de Relatórios, e o CSV ganhou a coluna da quantidade. Exemplo:
três pneus de R$ 300 viram uma compra de R$ 900 e uma única saída de
R$ 900 no extrato.

**Regra única do atraso de meta.** Em `js/reality.js`:

- *folga fora das metas hoje*: o que o saldo tem acima de um mês de
  despesas fixas, mais a sobra deste mês que não vai para as metas, sem
  passar do saldo depois das parcelas (`folgaForaDasMetas`);
- *parte que sai das metas*: cada pagamento usa primeiro a folga de hoje e
  a sobra fora das metas dos meses até ele; só o que passa disso sai do que
  iria para a meta (`parteDasMetas`);
- *atraso*: essa parte dividida pelo ritmo da meta, em dias de calendário
  (`atrasoDias`). O ritmo é o dos aportes reais dos últimos 90 dias ou, sem
  eles, o que o prazo da meta pede, contado em meses de calendário como na
  tela de Metas. Sem ritmo, não há atraso a mostrar, e o FinCK não inventa
  um;
- *formato*: "+12 dias", "+2,5 meses" ou "sem atraso", igual em todo o app
  (`textoAtraso`).

Comprar agora é um pagamento hoje; esperar, um pagamento daqui a dois
meses; parcelar, uma parcela por mês, com os juros dentro de cada uma.

### 5.8 Critérios de aceite da IA2

| Seção | Critério | Situação |
|---|---|---|
| 1 | Nenhum botão importante sob a navegação em 375×812, 390×844, 768×1024 e desktop | Atendido no Reality. Rolando até "Ver o impacto da compra", ele fica acima da navegação em todos esses tamanhos (em 375×812 com toque, entre 652 e 707 px, com a navegação a partir de 731 px), e o mesmo vale para o último botão de cada página |
| 1 | O último botão de cada etapa fica completamente visível | Atendido |
| 1 | Enter num campo não empurra o botão para trás da barra fixa | Atendido; com erro de validação, o foco vai ao campo com o erro |
| 1 | Depois da rolagem automática, título e botão visíveis, fora do header e da navegação | Atendido: o título fica por volta de 165 a 190 px, abaixo das etapas presas (que terminam entre 112 e 120 px), e a frase-síntese logo abaixo; em 320×568 ela termina exatamente onde a navegação começa |
| 2 | Responder sem outra tela: quanto tem agora, quanto sobra da renda do mês, quanto fica depois das saídas previstas em 60 dias e o que é dinheiro real ou previsão | Atendido na home, com o mesmo vocabulário no Reality |
| 3 | A demonstração não parece uma sequência de erros ou de dados faltantes | Atendido: duas contas conciliadas, nenhum "sem conta" e nenhuma previsão vencida que não deveria existir |
| 4 | Antes de chamar a IA: demonstração ou conta, regras ou IA, dados enviados, o que fazer se falhar e onde fica salvo | Atendido no plano do Assistente, cuja ficha traz os cinco itens antes do clique. Nas duas conversas (Assistente e Análise FinCK), o caminho (cálculo do FinCK ou FINCK AI), os dados enviados, o aviso da demonstração e o aviso de privacidade vêm antes do envio; o que fazer quando a FINCK AI falha aparece na própria mensagem de falha, que lembra que os números continuam valendo |
| 10 | O primeiro botão de cada jornada é alcançável sem rolagem confusa | Atendido no Reality e na home, com e sem toque, de 360×740 a 412×915; em 320×568, "Analisar uma compra" ainda fica abaixo da primeira tela (seção 5.6) |
| 10 | Nenhum elemento fixo cobre controles | Atendido nos fluxos principais; o aviso flutuante ainda não limita quantos aparecem ao mesmo tempo nas demais telas |
| 10 | Todo número com definição e janela de tempo | Parcial: faltam as tabelas de Planejamento, Recorrentes e Cenários e contagens simples, como metas ativas |
| 10 | A demonstração parece intencional | Atendido |
| 10 | A origem das respostas de IA é visível antes e depois da ação | Atendido |
| 10 | O resultado do Reality pode ser explicado em uma frase | Atendido (frase-síntese) |
| 10 | Fundo e 3D presentes sem atrapalhar a leitura | Atendido |
| 10 | Três pessoas externas completam as tarefas sem instruções | Não feito: depende do teste com pessoas |
| 10 | Testes automatizados verdes | Atendido |

### 5.9 O que ainda depende de pessoas e de leitor de tela

- **Teste com pessoas.** Pelo menos três pessoas que não participaram do
  desenvolvimento, no celular e sem explicação do caminho, com as cinco
  tarefas da seção 4. Registrar tempo, erros, hesitações e interpretações
  erradas e aplicar o SUS ao final; corrigir só o que aparecer em mais de
  uma pessoa ou bloquear o fluxo, como pede a IA2. Perguntas próprias desta
  rodada: a pessoa entende a diferença entre "Saldo atual" e "Caixa depois
  das saídas previstas"? Lê o cenário "Agora" como esperado (o preço
  inteiro conta logo, enquanto esperar e parcelar usam a sobra dos meses)?
  Distingue "Cálculo do FinCK" de "✦ FINCK AI"? O protocolo da Análise
  FinCK está em `docs/analise-finck.md`.
- **Leitor de tela real** (NVDA no computador e VoiceOver no iPhone).
  Regiões vivas, etapas, cartões da reflexão e conversa foram conferidos
  só pela estrutura da página.
- **Zoom real de 200%** no navegador e orientação horizontal (o zoom foi
  simulado em 640×400 e 320×568).
- **Instalação real** do app (o pedido de instalação foi simulado) e a
  **FINCK AI ao vivo** na Vercel (as rotas foram testadas com respostas
  simuladas).
- **Capturas de tela** sem sobreposições de inspeção para a apresentação.

Pendências técnicas conhecidas: o botão "Analisar uma compra" da home em
320×568 (seção 5.6); o aviso flutuante sem limite
nas telas fora dos fluxos principais; definição e
janela nas tabelas citadas acima; análises gravadas antes desta rodada com
quantidade maior que 1 continuam com horas e saldo por unidade (só o valor
total fica certo nelas); o XP mínimo de uma análise ainda compara o preço
da unidade; o retrato do Assistente traz a média geral "guardado em metas"
ao lado do ritmo por meta.

## Referências

- BROOKE, J. SUS: a quick and dirty usability scale. In: JORDAN, P. W. et
  al. (org.). *Usability evaluation in industry*. London: Taylor &
  Francis, 1996.
- NIELSEN, J. *Usability engineering*. Boston: Academic Press, 1993.
- W3C. *Web Content Accessibility Guidelines (WCAG) 2.2*. 2023. Critérios
  1.4.3 (contraste mínimo), 2.3.3 (animação a partir de interações),
  2.5.8 (tamanho mínimo do alvo), 3.3.1 (identificação do erro).
  https://www.w3.org/TR/WCAG22/
