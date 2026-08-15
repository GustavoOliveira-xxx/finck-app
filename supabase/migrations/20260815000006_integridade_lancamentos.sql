-- Fecha as invariantes de contabilidade apontadas na análise lógica do FinCK.
-- Regra de ouro: cada fato financeiro tem uma fonte de verdade, um vínculo
-- rastreável e uma transição idempotente.

-- 1. Vínculo rastreável entre ocorrência e movimentação -------------------

-- account_id já existe desde 20260809000004; aqui entra só o vínculo com a previsão.
alter table public.transactions
  add column if not exists source_occurrence_id uuid
    references public.recurring_occurrences (id) on delete set null;

comment on column public.transactions.source_occurrence_id is
  'Ocorrência que originou esta movimentação. Permite reconciliar confirmações repetidas em vez de duplicar lançamentos.';

-- Uma previsão vira no máximo UMA transação. Esta é a trava que impede que
-- uma falha entre o insert e o update crie um segundo lançamento no retry.
create unique index if not exists transacao_unica_por_ocorrencia
  on public.transactions (source_occurrence_id)
  where source_occurrence_id is not null;

-- 2. Conta e categoria fazem parte da regra recorrente --------------------

alter table public.recurring_transactions
  add column if not exists category text,
  add column if not exists account_id uuid references public.accounts (id) on delete set null;

comment on column public.recurring_transactions.category is
  'Categoria da regra. Copiada para cada ocorrência e daí para a transação confirmada.';
comment on column public.recurring_transactions.account_id is
  'Conta padrão da regra. Sem ela, a confirmação entra no saldo global sem aparecer em nenhuma conta.';

-- 3. A ocorrência congela conta e categoria do ciclo ----------------------

alter table public.recurring_occurrences
  add column if not exists account_id uuid references public.accounts (id) on delete set null;

comment on column public.recurring_occurrences.account_id is
  'Conta congelada no ciclo. Mudar a regra não reescreve para onde o dinheiro já foi.';

-- 4. Estado por parcela, com vínculo à movimentação -----------------------

create table if not exists public.installment_payments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  purchase_id    uuid not null references public.installment_purchases (id) on delete cascade,

  installment_no smallint not null check (installment_no > 0),
  due_date       date not null,
  amount         numeric(12,2) not null check (amount > 0),

  status         text not null default 'aberta'
                   check (status in ('aberta', 'paga')),

  transaction_id uuid references public.transactions (id) on delete set null,
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),

  constraint parcela_unica_por_compra unique (purchase_id, installment_no),

  constraint parcela_aberta_nao_move_saldo check (
    status <> 'aberta' or transaction_id is null
  )
);

comment on table public.installment_payments is
  'Parcela individual de um parcelamento. Enquanto aberta é compromisso previsto; ao ser paga vira transação e sai da projeção.';
comment on constraint parcela_aberta_nao_move_saldo on public.installment_payments is
  'Mesma regra das ocorrências: previsão não move saldo.';

create unique index if not exists parcela_transacao_unica
  on public.installment_payments (transaction_id)
  where transaction_id is not null;

create index if not exists parcelas_abertas_idx
  on public.installment_payments (user_id, status, due_date)
  where status = 'aberta';

alter table public.installment_payments enable row level security;

drop policy if exists "parcelas proprias: ler"     on public.installment_payments;
drop policy if exists "parcelas proprias: criar"   on public.installment_payments;
drop policy if exists "parcelas proprias: alterar" on public.installment_payments;
drop policy if exists "parcelas proprias: apagar"  on public.installment_payments;

create policy "parcelas proprias: ler"     on public.installment_payments
  for select using (auth.uid() = user_id);
create policy "parcelas proprias: criar"   on public.installment_payments
  for insert with check (auth.uid() = user_id);
create policy "parcelas proprias: alterar" on public.installment_payments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "parcelas proprias: apagar"  on public.installment_payments
  for delete using (auth.uid() = user_id);

-- 5. Saldo inicial tem uma fonte só ---------------------------------------

alter table public.profiles
  add column if not exists initial_balance_source text
    default 'perfil'
    check (initial_balance_source in ('perfil', 'contas'));

comment on column public.profiles.initial_balance_source is
  'De onde vem o saldo inicial. Com contas cadastradas passa a ser "contas" e o valor do perfil deixa de ser somado, para não duplicar patrimônio.';

-- 6. Confirmação de ocorrência como operação atômica ----------------------
-- Cria ou reaproveita exatamente uma transação para a ocorrência e devolve o
-- estado final. Repetir a chamada é seguro: nunca gera um segundo lançamento.

create or replace function public.confirmar_ocorrencia(
  p_occurrence_id uuid,
  p_amount        numeric,
  p_account_id    uuid default null
)
returns public.recurring_occurrences
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_oc     public.recurring_occurrences;
  v_tx_id  uuid;
  v_status text;
begin
  select * into v_oc
    from public.recurring_occurrences
   where id = p_occurrence_id and user_id = auth.uid()
     for update;

  if not found then
    raise exception 'Ocorrência não encontrada.' using errcode = 'no_data_found';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor maior que zero.' using errcode = 'check_violation';
  end if;

  v_status := case
    when abs(p_amount - v_oc.planned_amount) < 0.005 then 'confirmado'
    else 'ajustado'
  end;

  select id into v_tx_id
    from public.transactions
   where source_occurrence_id = p_occurrence_id and user_id = auth.uid()
   limit 1;

  if v_tx_id is null then
    insert into public.transactions
      (user_id, type, description, amount, date, category, account_id, source, source_occurrence_id)
    values
      (v_oc.user_id, v_oc.type, v_oc.description, p_amount, v_oc.due_date,
       case when v_oc.type = 'saida' then coalesce(v_oc.category, 'Outros') else null end,
       coalesce(p_account_id, v_oc.account_id), 'recorrente', p_occurrence_id)
    returning id into v_tx_id;
  else
    update public.transactions
       set amount     = p_amount,
           account_id = coalesce(p_account_id, v_oc.account_id),
           date       = v_oc.due_date
     where id = v_tx_id and user_id = auth.uid();
  end if;

  update public.recurring_occurrences
     set status         = v_status,
         actual_amount  = p_amount,
         account_id     = coalesce(p_account_id, account_id),
         transaction_id = v_tx_id,
         decided_at     = now()
   where id = p_occurrence_id
  returning * into v_oc;

  return v_oc;
end;
$$;

comment on function public.confirmar_ocorrencia is
  'Confirma uma ocorrência em uma transação única. Idempotente: repetir a chamada atualiza o mesmo lançamento em vez de criar outro.';

-- 7. Desfazer é igualmente atômico ----------------------------------------

create or replace function public.desfazer_ocorrencia(
  p_occurrence_id uuid,
  p_status        text
)
returns public.recurring_occurrences
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_oc public.recurring_occurrences;
begin
  if p_status not in ('nao_realizado', 'nao_pago', 'pendente') then
    raise exception 'Estado inválido para desfazer.' using errcode = 'check_violation';
  end if;

  -- Solta o vínculo antes de apagar: a ocorrência nunca fica apontando
  -- para uma transação que já não existe.
  update public.recurring_occurrences
     set status         = p_status,
         actual_amount  = null,
         transaction_id = null,
         decided_at     = now()
   where id = p_occurrence_id and user_id = auth.uid()
  returning * into v_oc;

  if not found then
    raise exception 'Ocorrência não encontrada.' using errcode = 'no_data_found';
  end if;

  delete from public.transactions
   where source_occurrence_id = p_occurrence_id and user_id = auth.uid();

  return v_oc;
end;
$$;

comment on function public.desfazer_ocorrencia is
  'Volta a ocorrência para um estado sem movimentação e apaga a transação vinculada na mesma operação.';

-- 8. Estorno de movimentação vinculada a meta ------------------------------
-- Excluir um aporte devolve o valor ao progresso da meta exatamente uma vez.

create or replace function public.estornar_transacao(p_transaction_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tx public.transactions;
begin
  select * into v_tx
    from public.transactions
   where id = p_transaction_id and user_id = auth.uid()
     for update;

  if not found then
    return;
  end if;

  if v_tx.goal_id is not null then
    update public.goals
       set current_amount = greatest(
             0,
             current_amount - case when v_tx.type = 'saida' then v_tx.amount else -v_tx.amount end)
     where id = v_tx.goal_id and user_id = auth.uid();
  end if;

  delete from public.transactions where id = p_transaction_id and user_id = auth.uid();
end;
$$;

comment on function public.estornar_transacao is
  'Remove a movimentação e reverte o progresso da meta na mesma transação de banco.';

-- 9. Reconciliação dos dados que já existem --------------------------------
-- Confirmações feitas antes desta migration não têm o vínculo novo. Estes
-- dois updates reconstroem o que dá para reconstruir com segurança. São
-- idempotentes: rodar de novo não muda nada.

-- Amarra a transação à ocorrência que já apontava para ela.
update public.transactions t
   set source_occurrence_id = o.id
  from public.recurring_occurrences o
 where o.transaction_id = t.id
   and o.user_id = t.user_id
   and t.source_occurrence_id is null;

-- Herda para a ocorrência a conta em que o lançamento realmente caiu.
update public.recurring_occurrences o
   set account_id = t.account_id
  from public.transactions t
 where o.transaction_id = t.id
   and o.user_id = t.user_id
   and o.account_id is null
   and t.account_id is not null;

-- Marca de onde vem o saldo inicial de quem já tem contas cadastradas,
-- para o app não somar o valor do perfil por cima do saldo das contas.
update public.profiles p
   set initial_balance_source = 'contas'
 where exists (
   select 1 from public.accounts a
    where a.user_id = p.id and coalesce(a.active, true)
 );

-- Parcelamentos antigos não precisam de backfill: sem registro explícito de
-- pagamento, o app continua lendo paid_count como antes.
