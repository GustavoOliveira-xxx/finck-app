-- Fase 1 do relatório de conclusão: fundação de dados.
--
-- Fecha os três buracos que sobraram depois da migration de integridade:
--   1. o progresso da meta era uma verdade independente, não derivável;
--   2. estornar apagava o histórico em vez de preservá-lo;
--   3. um retry depois de timeout não tinha como se reconhecer.
--
-- Regra de ouro que continua valendo: cada fato financeiro tem uma fonte de
-- verdade, um vínculo rastreável e uma transição idempotente.

-- 1. Movimentos de meta: o progresso vira histórico, não um número solto -----

create table if not exists public.goal_movements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  goal_id        uuid not null references public.goals (id) on delete cascade,

  transaction_id uuid references public.transactions (id) on delete set null,

  kind           text not null
                   check (kind in ('aporte', 'retirada', 'estorno', 'ajuste')),

  -- Assinado: aporte entra positivo, retirada negativa, estorno com o sinal
  -- oposto ao do movimento que ele reverte. O progresso é a soma, nada mais.
  amount         numeric(12,2) not null check (amount <> 0),

  date           date not null,
  note           text,

  reverses_id    uuid references public.goal_movements (id) on delete set null,
  reversed_at    timestamptz,

  created_at     timestamptz not null default now()
);

comment on table public.goal_movements is
  'Livro-razão da meta. current_amount passa a ser cache: o valor verdadeiro é a soma destes movimentos.';
comment on column public.goal_movements.amount is
  'Valor com sinal. Somar a coluna inteira devolve o progresso — sem filtro, sem caso especial.';
comment on column public.goal_movements.reversed_at is
  'Marca de exibição no movimento original. O que desfaz o valor é a linha de estorno, não este campo.';

create unique index if not exists estorno_unico_por_movimento
  on public.goal_movements (reverses_id)
  where reverses_id is not null;

create index if not exists movimentos_meta_idx
  on public.goal_movements (user_id, goal_id, date desc);

create unique index if not exists movimento_unico_por_transacao
  on public.goal_movements (transaction_id)
  where transaction_id is not null and kind <> 'estorno';

alter table public.goal_movements enable row level security;

drop policy if exists "movimentos de meta: ler"     on public.goal_movements;
drop policy if exists "movimentos de meta: criar"   on public.goal_movements;
drop policy if exists "movimentos de meta: alterar" on public.goal_movements;
drop policy if exists "movimentos de meta: apagar"  on public.goal_movements;

create policy "movimentos de meta: ler"     on public.goal_movements
  for select using (auth.uid() = user_id);
create policy "movimentos de meta: criar"   on public.goal_movements
  for insert with check (auth.uid() = user_id);
create policy "movimentos de meta: alterar" on public.goal_movements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "movimentos de meta: apagar"  on public.goal_movements
  for delete using (auth.uid() = user_id);

-- 2. Estorno preserva o histórico -------------------------------------------
-- Excluir destruía a prova de que o dinheiro se moveu. A partir daqui a
-- movimentação continua na tabela, marcada, fora do saldo e com motivo.

alter table public.transactions
  add column if not exists reversed_at     timestamptz,
  add column if not exists reversal_reason text,
  add column if not exists reversed_by     uuid references auth.users (id) on delete set null;

comment on column public.transactions.reversed_at is
  'Quando foi estornada. Preenchido, a linha sai de todo cálculo de saldo mas continua no histórico.';
comment on column public.transactions.reversal_reason is
  'Por que foi estornada. Texto do usuário, guardado junto do fato.';

create index if not exists transacoes_vigentes_idx
  on public.transactions (user_id, date desc)
  where reversed_at is null;

-- A trava de "uma ocorrência, uma transação" precisa ignorar as estornadas:
-- senão uma confirmação estornada impediria confirmar o mesmo ciclo de novo.
drop index if exists transacao_unica_por_ocorrencia;
create unique index transacao_unica_por_ocorrencia
  on public.transactions (source_occurrence_id)
  where source_occurrence_id is not null and reversed_at is null;

-- 3. Alocação explícita ------------------------------------------------------
-- O relatório é direto: ou a transação tem conta, ou o usuário assumiu que ela
-- é não alocada. O que o produto não pode fazer é esconder a diferença.

alter table public.transactions
  add column if not exists unallocated boolean not null default false;

comment on column public.transactions.unallocated is
  'Verdadeiro quando o usuário declarou que a movimentação não pertence a nenhuma conta. Sem conta e sem esta marca, a linha é ambígua e entra na fila de reconciliação.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'alocacao_explicita') then
    alter table public.transactions
      add constraint alocacao_explicita
      check (not (unallocated and account_id is not null));
  end if;
end $$;

comment on constraint alocacao_explicita on public.transactions is
  'Não dá para estar em uma conta e fora de todas ao mesmo tempo.';

-- 4. Chave de idempotência ---------------------------------------------------
-- Um retry depois de timeout precisa se reconhecer e devolver o mesmo
-- resultado, em vez de criar um segundo fato financeiro.

create table if not exists public.operation_keys (
  user_id    uuid not null references auth.users (id) on delete cascade,
  key        text not null,
  operation  text not null,
  result     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  primary key (user_id, key)
);

comment on table public.operation_keys is
  'Resultado já entregue para uma chave de operação. Repetir a chamada devolve isto em vez de gravar de novo.';

alter table public.operation_keys enable row level security;

drop policy if exists "chaves proprias: ler"   on public.operation_keys;
drop policy if exists "chaves proprias: criar" on public.operation_keys;

create policy "chaves proprias: ler"   on public.operation_keys
  for select using (auth.uid() = user_id);
create policy "chaves proprias: criar" on public.operation_keys
  for insert with check (auth.uid() = user_id);

-- 5. Fila de reconciliação ---------------------------------------------------
-- Dado ambíguo não é apagado nem corrigido por adivinhação: ele espera decisão
-- do usuário aqui.

create table if not exists public.reconciliation_queue (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,

  kind         text not null,
  entity_table text not null,
  entity_id    uuid,

  detail       jsonb not null default '{}'::jsonb,

  status       text not null default 'aberto'
                 check (status in ('aberto', 'resolvido', 'ignorado')),

  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.reconciliation_queue is
  'Pendências que o sistema não pode decidir sozinho: transação sem conta, aporte sem vínculo, parcela paga só por contador, possível duplicata.';

create unique index if not exists pendencia_unica_por_entidade
  on public.reconciliation_queue (user_id, kind, entity_table, entity_id)
  where entity_id is not null;

create index if not exists pendencias_abertas_idx
  on public.reconciliation_queue (user_id, status, created_at desc)
  where status = 'aberto';

alter table public.reconciliation_queue enable row level security;

drop policy if exists "pendencias proprias: ler"     on public.reconciliation_queue;
drop policy if exists "pendencias proprias: criar"   on public.reconciliation_queue;
drop policy if exists "pendencias proprias: alterar" on public.reconciliation_queue;
drop policy if exists "pendencias proprias: apagar"  on public.reconciliation_queue;

create policy "pendencias proprias: ler"     on public.reconciliation_queue
  for select using (auth.uid() = user_id);
create policy "pendencias proprias: criar"   on public.reconciliation_queue
  for insert with check (auth.uid() = user_id);
create policy "pendencias proprias: alterar" on public.reconciliation_queue
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pendencias proprias: apagar"  on public.reconciliation_queue
  for delete using (auth.uid() = user_id);

-- 6. Observabilidade ---------------------------------------------------------
-- Erro de confirmação e divergência de reconciliação deixam rastro técnico.

create table if not exists public.integrity_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  level      text not null default 'erro' check (level in ('erro', 'aviso', 'info')),
  scope      text not null,
  message    text not null,
  context    jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

comment on table public.integrity_events is
  'Diário técnico dos fluxos críticos. Serve para explicar o que aconteceu depois, não para o usuário ler no dia a dia.';

create index if not exists eventos_integridade_idx
  on public.integrity_events (user_id, created_at desc);

alter table public.integrity_events enable row level security;

drop policy if exists "eventos proprios: ler"    on public.integrity_events;
drop policy if exists "eventos proprios: criar"  on public.integrity_events;
drop policy if exists "eventos proprios: apagar" on public.integrity_events;

create policy "eventos proprios: ler"    on public.integrity_events
  for select using (auth.uid() = user_id);
create policy "eventos proprios: criar"  on public.integrity_events
  for insert with check (auth.uid() = user_id);
create policy "eventos proprios: apagar" on public.integrity_events
  for delete using (auth.uid() = user_id);

-- 7. Saldo inicial com política única ----------------------------------------

alter table public.profiles
  add column if not exists initial_balance_migrated_at timestamptz,
  add column if not exists initial_balance_account_id  uuid
    references public.accounts (id) on delete set null;

comment on column public.profiles.initial_balance_migrated_at is
  'Quando o saldo inicial do perfil virou saldo de uma conta. Preenchido, o valor do perfil é legado e nunca mais é somado.';
comment on column public.profiles.initial_balance_account_id is
  'Conta que recebeu o saldo inicial na migração. O usuário consegue conferir a composição, não só o número final.';

-- 7b. Conta padrão do parcelamento -------------------------------------------
-- O app já lia installment_purchases.account_id (o importador inclusive
-- reaponta esse vínculo), mas a coluna nunca chegou a existir: toda parcela
-- paga caía no saldo global sem aparecer em conta nenhuma.

alter table public.installment_purchases
  add column if not exists account_id uuid references public.accounts (id) on delete set null;

comment on column public.installment_purchases.account_id is
  'Conta padrão do parcelamento. Cada parcela paga nasce vinculada a ela, salvo escolha diferente na confirmação.';

create index if not exists parcelamentos_conta_idx
  on public.installment_purchases (user_id, account_id);

-- 8. Parcela estornada é um estado, não um apagamento ------------------------

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'installment_payments_status_check'
       and conrelid = 'public.installment_payments'::regclass
  ) then
    alter table public.installment_payments
      drop constraint installment_payments_status_check;
  end if;

  alter table public.installment_payments
    add constraint installment_payments_status_check
    check (status in ('aberta', 'paga', 'estornada'));
exception
  when duplicate_object then null;
end $$;

-- 9. Guarda de propriedade nos vínculos novos --------------------------------
-- Mesmo padrão do gatilho de contas: o vínculo nunca atravessa o usuário.

create or replace function public.vinculo_pertence_ao_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'goal_movements' then
    if not exists (
      select 1 from public.goals g
       where g.id = new.goal_id and g.user_id = new.user_id
    ) then
      raise exception 'A meta informada não pertence a este usuário.';
    end if;

    if new.transaction_id is not null and not exists (
      select 1 from public.transactions t
       where t.id = new.transaction_id and t.user_id = new.user_id
    ) then
      raise exception 'A movimentação informada não pertence a este usuário.';
    end if;

  elsif tg_table_name = 'installment_payments' then
    if not exists (
      select 1 from public.installment_purchases p
       where p.id = new.purchase_id and p.user_id = new.user_id
    ) then
      raise exception 'O parcelamento informado não pertence a este usuário.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists vinculo_do_dono on public.goal_movements;
create trigger vinculo_do_dono
  before insert or update on public.goal_movements
  for each row execute function public.vinculo_pertence_ao_usuario();

drop trigger if exists vinculo_do_dono on public.installment_payments;
create trigger vinculo_do_dono
  before insert or update on public.installment_payments
  for each row execute function public.vinculo_pertence_ao_usuario();

-- 10. Relatório ANTES de alterar qualquer registro ---------------------------
-- O relatório de conclusão é explícito: a migração gera um relatório antes de
-- tocar em qualquer linha, apontando transações sem conta, aportes sem vínculo,
-- ocorrências sem categoria, parcelas pagas apenas por contador e possíveis
-- duplicidades. Este bloco roda antes do backfill e guarda a foto do estado
-- anterior — é a referência para conferir depois o que a migração fez.

create table if not exists public.migration_reports (
  id         uuid primary key default gen_random_uuid(),
  migration  text not null,
  fase       text not null default 'antes' check (fase in ('antes', 'depois')),
  resumo     jsonb not null default '{}'::jsonb,
  amostra    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.migration_reports is
  'Foto do estado antes e depois de uma migração de dados. Existe para a alteração ser conferível, não para ser confiada.';

alter table public.migration_reports enable row level security;

drop policy if exists "relatorios proprios: ler" on public.migration_reports;
create policy "relatorios proprios: ler" on public.migration_reports
  for select using (true);

do $$
declare
  v_sem_conta        bigint;
  v_aportes_sem_vinc bigint;
  v_oc_sem_categoria bigint;
  v_parc_contador    bigint;
  v_duplicatas       bigint;
  v_saldo_duplo      bigint;
  v_amostra          jsonb;
begin
  -- Transações sem conta vinculada (ainda sem declaração de não alocada).
  select count(*) into v_sem_conta
    from public.transactions where account_id is null;

  -- Aportes que apontam para meta mas não têm linha no livro-razão.
  select count(*) into v_aportes_sem_vinc
    from public.transactions t
   where t.goal_id is not null
     and not exists (select 1 from public.goal_movements m where m.transaction_id = t.id);

  -- Ocorrências de saída sem categoria: o gasto não será comparado a teto nenhum.
  select count(*) into v_oc_sem_categoria
    from public.recurring_occurrences
   where type = 'saida' and category is null;

  -- Parcelamentos com parcelas pagas só pelo contador agregado.
  select count(*) into v_parc_contador
    from public.installment_purchases p
   where coalesce(p.paid_count, 0) > 0
     and not exists (select 1 from public.installment_payments ip
                      where ip.purchase_id = p.id and ip.status = 'paga');

  -- Possíveis duplicidades: mesmo tipo, valor, data e descrição.
  select coalesce(count(*), 0) into v_duplicatas from (
    select 1 from public.transactions
     group by user_id, type, amount, date, lower(trim(description))
    having count(*) > 1
  ) d;

  -- Perfil e contas carregando o mesmo saldo inicial.
  select count(*) into v_saldo_duplo
    from public.profiles p
   where coalesce(p.initial_balance, 0) <> 0
     and exists (select 1 from public.accounts a
                  where a.user_id = p.id and coalesce(a.active, true));

  -- Amostra do que será tocado, para conferência linha a linha depois.
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_amostra from (
    select jsonb_build_object('id', t.id, 'descricao', t.description,
                              'valor', t.amount, 'data', t.date) as x
      from public.transactions t
     where t.account_id is null
     limit 100
  ) s;

  insert into public.migration_reports (migration, fase, resumo, amostra)
  values ('20260816000007', 'antes',
          jsonb_build_object(
            'transacoes_sem_conta',        v_sem_conta,
            'aportes_sem_vinculo',         v_aportes_sem_vinc,
            'ocorrencias_sem_categoria',   v_oc_sem_categoria,
            'parcelas_so_por_contador',    v_parc_contador,
            'possiveis_duplicidades',      v_duplicatas,
            'saldo_inicial_em_duas_fontes', v_saldo_duplo),
          v_amostra);

  raise notice '--- FinCK · relatório ANTES da migração 20260816000007 ---';
  raise notice 'transações sem conta.............: %', v_sem_conta;
  raise notice 'aportes sem vínculo no livro.....: %', v_aportes_sem_vinc;
  raise notice 'ocorrências sem categoria........: %', v_oc_sem_categoria;
  raise notice 'parcelas pagas só por contador...: %', v_parc_contador;
  raise notice 'possíveis duplicidades...........: %', v_duplicatas;
  raise notice 'saldo inicial em duas fontes.....: %', v_saldo_duplo;
  raise notice 'Nada foi alterado até aqui. O backfill começa a seguir e não apaga nenhum registro.';
end $$;

-- 11. Backfill: reconstrói o que dá para reconstruir com segurança -----------
-- Idempotente. Nada é apagado; o que for ambíguo vai para a fila.

-- Aportes e gastos que já apontavam para uma meta viram movimentos de meta.
insert into public.goal_movements (user_id, goal_id, transaction_id, kind, amount, date, note)
select t.user_id,
       t.goal_id,
       t.id,
       case when t.type = 'saida' then 'aporte' else 'retirada' end,
       case when t.type = 'saida' then t.amount else -t.amount end,
       t.date,
       'Reconstruído do histórico na migração de 16.08'
  from public.transactions t
 where t.goal_id is not null
   and t.reversed_at is null
   and not exists (
     select 1 from public.goal_movements m where m.transaction_id = t.id
   );

-- Sem conta cadastrada, "sem conta" é a única situação possível: declarar isso
-- é mais honesto do que deixar a linha ambígua.
update public.transactions t
   set unallocated = true
 where t.account_id is null
   and t.unallocated = false
   and not exists (
     select 1 from public.accounts a
      where a.user_id = t.user_id and coalesce(a.active, true)
   );

-- Com contas cadastradas, o sistema não adivinha: a linha espera decisão.
insert into public.reconciliation_queue (user_id, kind, entity_table, entity_id, detail)
select t.user_id,
       'transacao_sem_conta',
       'transactions',
       t.id,
       jsonb_build_object('descricao', t.description, 'valor', t.amount, 'data', t.date)
  from public.transactions t
 where t.account_id is null
   and t.unallocated = false
   and t.reversed_at is null
   and exists (
     select 1 from public.accounts a
      where a.user_id = t.user_id and coalesce(a.active, true)
   )
on conflict do nothing;

-- Meta cujo cache não bate com o histórico: divergência declarada, não corrigida
-- por baixo do pano.
insert into public.reconciliation_queue (user_id, kind, entity_table, entity_id, detail)
select g.user_id,
       'meta_sem_historico',
       'goals',
       g.id,
       jsonb_build_object(
         'meta', g.name,
         'cache', g.current_amount,
         'historico', coalesce(m.total, 0))
  from public.goals g
  left join (
    select goal_id, sum(amount) as total
      from public.goal_movements
     group by goal_id
  ) m on m.goal_id = g.id
 where abs(coalesce(g.current_amount, 0) - coalesce(m.total, 0)) > 0.005
on conflict do nothing;

-- Parcelamento com parcelas pagas só pelo contador, sem registro individual.
insert into public.reconciliation_queue (user_id, kind, entity_table, entity_id, detail)
select p.user_id,
       'parcela_por_contador',
       'installment_purchases',
       p.id,
       jsonb_build_object('descricao', p.description, 'pagas', p.paid_count)
  from public.installment_purchases p
 where coalesce(p.paid_count, 0) > 0
   and not exists (
     select 1 from public.installment_payments ip
      where ip.purchase_id = p.id and ip.status = 'paga'
   )
on conflict do nothing;

-- Perfil e contas com o mesmo dinheiro: o app já deixou de somar os dois, mas
-- a decisão de para onde vai o saldo inicial continua sendo do usuário.
insert into public.reconciliation_queue (user_id, kind, entity_table, entity_id, detail)
select p.id,
       'saldo_inicial_duplicado',
       'profiles',
       p.id,
       jsonb_build_object('saldo_perfil', p.initial_balance)
  from public.profiles p
 where coalesce(p.initial_balance, 0) <> 0
   and p.initial_balance_migrated_at is null
   and exists (
     select 1 from public.accounts a
      where a.user_id = p.id and coalesce(a.active, true)
   )
on conflict do nothing;

-- 12. Relatório DEPOIS: o que a migração de fato fez --------------------------
-- Comparado com a foto de antes, mostra o que mudou e o que ficou esperando
-- decisão. É assim que a alteração vira conferível em vez de confiável.

do $$
declare
  v_movimentos bigint;
  v_declaradas bigint;
  v_ambiguas   bigint;
  v_fila       bigint;
begin
  select count(*) into v_movimentos from public.goal_movements;
  select count(*) into v_declaradas from public.transactions where unallocated;
  select count(*) into v_ambiguas
    from public.transactions where account_id is null and not unallocated;
  select count(*) into v_fila
    from public.reconciliation_queue where status = 'aberto';

  insert into public.migration_reports (migration, fase, resumo)
  values ('20260816000007', 'depois',
          jsonb_build_object(
            'movimentos_de_meta_criados',      v_movimentos,
            'transacoes_declaradas_sem_conta', v_declaradas,
            'transacoes_ainda_ambiguas',       v_ambiguas,
            'pendencias_na_fila',              v_fila));

  raise notice '--- FinCK · relatório DEPOIS da migração ---';
  raise notice 'movimentos de meta reconstruídos.: %', v_movimentos;
  raise notice 'transações declaradas sem conta..: %', v_declaradas;
  raise notice 'transações ainda ambíguas........: %  (esperando sua decisão)', v_ambiguas;
  raise notice 'pendências na fila...............: %', v_fila;
  raise notice 'Nenhum registro foi apagado. Confira em Perfil -> Diagnóstico financeiro.';
end $$;
