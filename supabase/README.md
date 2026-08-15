# Banco de dados do FinCK

O aplicativo fala com o Supabase direto do navegador, usando a chave
anônima que está em `js/config.js`. Essa chave é pública por natureza —
qualquer pessoa consegue lê-la vendo o código da página.

O que protege os dados **não é a chave**: é a Row Level Security
definida em `migrations/20260809000002_rls.sql`. Com ela desligada,
uma consulta com a chave anônima devolveria as movimentações de todos
os usuários. O filtro `.eq("user_id", ...)` que existe no `store.js` é
conveniência de interface, nunca segurança: quem chama a API
diretamente simplesmente não envia esse filtro.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `migrations/20260809000001_schema_inicial.sql` | Cria as 7 tabelas, restrições e índices |
| `migrations/20260809000002_rls.sql` | Liga RLS, cria as políticas e o gatilho de perfil |

## Como aplicar

**Pelo painel do Supabase** — abra o projeto do FinCK, vá em *SQL
Editor*, cole o conteúdo de cada arquivo na ordem numérica e execute.

**Pela CLI**, com o projeto já vinculado:

```bash
supabase db push
```

## Depois de aplicar, confira

RLS precisa estar ligada em todas as tabelas:

```sql
select relname, relrowsecurity
  from pg_class
 where relnamespace = 'public'::regnamespace and relkind = 'r'
 order by relname;
```

E cada tabela precisa das 4 políticas (ler, criar, alterar, apagar):

```sql
select tablename, count(*)
  from pg_policies
 where schemaname = 'public'
 group by tablename
 order by tablename;
```

O teste que importa de verdade: entre com dois usuários diferentes e
confirme que nenhum enxerga o dado do outro.

## Confirmação de e-mail

O `store.js` já trata o cadastro que exige confirmação: ele detecta a
resposta sem sessão, mostra a tela de "confirme seu e-mail" e oferece
reenvio. Para isso funcionar, no painel do Supabase:

- *Authentication → Providers → Email*: manter **Confirm email** ligado.
- *Authentication → URL Configuration*: incluir a URL do site em
  **Redirect URLs**, senão o link do e-mail não volta para o app.
  São dois destinos: `.../index.html` (confirmação) e
  `.../nova-senha.html` (redefinição de senha).

O gatilho `ao_criar_usuario` cria o perfil no momento do cadastro. Ele
existe porque, com confirmação ligada, não há sessão logo após o
`signUp` — e sem sessão a própria policy de insert barraria o cliente
de criar o perfil.

## Atenção ao projeto de destino

`js/config.js` aponta para o projeto `iruqoghylxgopbopxjbi`. Confirme
que é nele que você está aplicando: rodar estas migrations em outro
projeto cria as tabelas do FinCK onde elas não deveriam existir.

## Migration de integridade (20260815000006)

Fecha as invariantes de contabilidade apontadas na análise lógica de
15.08. Além de colunas e índices, ela cria três funções que o app usa
quando estão disponíveis:

- `confirmar_ocorrencia(p_occurrence_id, p_amount, p_account_id)` —
  cria **ou reaproveita** a transação da ocorrência e atualiza o
  estado, tudo numa transação de banco. Repetir a chamada nunca gera um
  segundo lançamento.
- `desfazer_ocorrencia(p_occurrence_id, p_status)` — solta o vínculo e
  apaga a transação na mesma operação.
- `estornar_transacao(p_transaction_id)` — remove a movimentação e
  reverte o progresso da meta de uma vez só.

O app **degrada com elegância**: `FinckStore.rpc()` detecta a ausência
das funções (banco antigo, modo demonstração ou modo local) e cai para
o caminho equivalente em JavaScript, que reconcilia e compensa no
cliente. Ou seja, o app funciona com ou sem esta migration — com ela, a
garantia passa a ser do Postgres.

Se, logo após aplicar, o app parecer ignorar as funções, é o cache de
esquema do PostgREST: em *Settings → API*, use **Reload schema cache**
(ou espere alguns segundos).

A migration é idempotente: rodar de novo não quebra nada. Ela termina
com um backfill que amarra transações e ocorrências já existentes.

## Fundação de dados (20260816000007)

Fecha os três buracos que sobraram: o progresso da meta era um número
independente, estornar apagava o histórico, e um retry depois de timeout
não tinha como se reconhecer.

| Tabela | Papel |
|---|---|
| `goal_movements` | Livro-razão da meta. `goals.current_amount` vira **cache**: o valor verdadeiro é a soma assinada destes movimentos |
| `operation_keys` | Resultado já entregue para uma chave de operação. Repetir a chamada devolve isto em vez de gravar de novo |
| `reconciliation_queue` | Pendências que o sistema não decide sozinho: transação sem conta, meta sem histórico, parcela paga só por contador |
| `integrity_events` | Diário técnico de erros de confirmação e divergências de reconciliação |

Colunas novas em `transactions`: `reversed_at`, `reversal_reason`,
`reversed_by` (estorno preserva o histórico) e `unallocated` (a
movimentação declara que fica fora das contas, em vez de simplesmente
não ter conta). A constraint `alocacao_explicita` impede estar em uma
conta e fora de todas ao mesmo tempo.

`installment_purchases.account_id` finalmente existe — o app já lia essa
coluna, mas ela nunca tinha sido criada: toda parcela paga caía no saldo
global sem aparecer em conta nenhuma.

O backfill reconstrói o livro-razão a partir das transações que já
apontavam para metas, declara como não alocado só o que não tem como ser
outra coisa (usuário sem nenhuma conta cadastrada) e manda o resto para a
fila de reconciliação. **Nenhum dado ambíguo é apagado ou corrigido por
adivinhação.**

## Operações atômicas (20260816000008)

Alterar dinheiro passa a ter porta única. Cada função valida a
propriedade, grava tudo numa transação de banco e devolve o estado final
completo — o front-end substitui o estado local pelo retorno do servidor
em vez de adivinhar o resultado.

| Função | O que garante |
|---|---|
| `aportar_meta` / `retirar_meta` | Movimentação + movimento de meta + recálculo do progresso, tudo junto |
| `estornar_transacao` | Marca a movimentação, libera ocorrência e parcela, escreve o estorno no livro da meta. **Nada é apagado** |
| `confirmar_parcela` / `desfazer_parcela` | Estado próprio da parcela, vínculo com a transação e `paid_count` derivado |
| `transferir_contas` | As duas pontas mudam juntas; o patrimônio total não muda |
| `confirmar_ocorrencia` | Idempotente pelo vínculo **e** pela chave de operação |
| `desfazer_ocorrencia` | Estorna o lançamento vinculado em vez de apagá-lo |
| `recalcular_meta` | Reescreve o cache a partir da soma dos movimentos |
| `garantir_historico_meta` | Semeia o livro-razão com o que a meta já tinha, antes do primeiro movimento novo |
| `migrar_saldo_inicial` | Leva o saldo do perfil para uma conta e marca o perfil como migrado |

Todas aceitam `p_idem_key`. Repetir a chamada com a mesma chave devolve o
resultado da primeira, sem criar um segundo lançamento — é isso que torna
seguro o retry depois de timeout, o duplo clique e a segunda aba.

O app continua degradando com elegância: sem estas funções, o
`FinckStore.operacao()` faz o mesmo controle de idempotência no cliente e
o caminho em JavaScript reproduz o comportamento (com compensação em caso
de falha no meio).

### Por que `garantir_historico_meta` existe

Uma meta criada antes do livro-razão tem valor guardado e zero
movimentos. Sem essa função, o primeiro aporte recalcularia o progresso,
veria zero movimentos, e **apagaria** o valor que o usuário já tinha. A
função transforma esse valor num movimento de ajuste antes de qualquer
coisa nova entrar. É idempotente e existe nas duas camadas (SQL e JS).

## Como validar

```bash
bash ferramentas/testar-migration.sh
```

Sobe um Postgres descartável, aplica as migrations na ordem e exercita as
invariantes: aporte idempotente, estorno que preserva histórico, parcela
com estado próprio, transferência que não muda patrimônio e saldo inicial
que não migra duas vezes.
