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
