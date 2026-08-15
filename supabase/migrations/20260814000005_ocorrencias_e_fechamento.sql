alter table public.transactions
  add column if not exists source text;

comment on column public.transactions.source is
  'Origem da movimentação: reality, recorrente, manual. Distingue o que veio de previsão confirmada do que foi lançado à mão.';

alter table public.profiles
  add column if not exists free_income_mode    text
    check (free_income_mode in ('percentual', 'valor')),
  add column if not exists free_income_percent numeric(5,2)
    check (free_income_percent >= 0 and free_income_percent <= 100),
  add column if not exists free_income_amount  numeric(12,2)
    check (free_income_amount >= 0),
  add column if not exists savings_mode        text
    check (savings_mode in ('percentual', 'valor')),
  add column if not exists savings_percent     numeric(5,2)
    check (savings_percent >= 0 and savings_percent <= 100),
  add column if not exists savings_amount      numeric(12,2)
    check (savings_amount >= 0);

comment on column public.profiles.free_income_mode is
  'Qual referência vale quando o usuário informa percentual e valor: nunca somar as duas.';

create table if not exists public.recurring_occurrences (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  recurring_id   uuid not null references public.recurring_transactions (id) on delete cascade,

  cycle          text not null check (cycle ~ '^\d{4}-\d{2}$'),
  due_date       date not null,

  description    text not null,
  type           text not null check (type in ('entrada', 'saida')),
  category       text,

  planned_amount numeric(12,2) not null check (planned_amount > 0),
  actual_amount  numeric(12,2) check (actual_amount >= 0),

  status         text not null default 'previsto'
                   check (status in ('previsto', 'pendente', 'confirmado',
                                     'ajustado', 'nao_realizado', 'nao_pago')),

  transaction_id uuid references public.transactions (id) on delete set null,

  decided_at     timestamptz,
  created_at     timestamptz not null default now(),

  constraint ocorrencia_unica_por_ciclo unique (recurring_id, cycle),

  constraint realizada_tem_valor check (
    status not in ('confirmado', 'ajustado') or actual_amount is not null
  ),

  constraint prevista_nao_move_saldo check (
    status not in ('previsto', 'pendente', 'nao_realizado', 'nao_pago')
    or transaction_id is null
  )
);

comment on table public.recurring_occurrences is
  'Ocorrência mensal de um recorrente. O recorrente é a regra; isto é o que aconteceu (ou não) num ciclo.';
comment on column public.recurring_occurrences.planned_amount is
  'Valor previsto congelado na geração. Editar o recorrente não altera ciclos já gerados.';
comment on column public.recurring_occurrences.actual_amount is
  'Valor real informado pelo usuário. Nulo enquanto a ocorrência não for confirmada.';
comment on constraint ocorrencia_unica_por_ciclo on public.recurring_occurrences is
  'Trava contra duplicação: recarregar a página ou reabrir o modal nunca cria uma segunda ocorrência do mesmo mês.';
comment on constraint prevista_nao_move_saldo on public.recurring_occurrences is
  'Previsão não vira dinheiro: sem movimentação vinculada, o saldo não muda.';

create unique index if not exists ocorrencia_transacao_unica
  on public.recurring_occurrences (transaction_id)
  where transaction_id is not null;

create index if not exists ocorrencias_user_ciclo_idx
  on public.recurring_occurrences (user_id, cycle, due_date);
create index if not exists ocorrencias_pendentes_idx
  on public.recurring_occurrences (user_id, status, due_date)
  where status in ('previsto', 'pendente');

create table if not exists public.monthly_closings (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  cycle               text not null check (cycle ~ '^\d{4}-\d{2}$'),

  expected_income     numeric(12,2) not null default 0,
  realized_income     numeric(12,2) not null default 0,
  expected_expense    numeric(12,2) not null default 0,
  realized_expense    numeric(12,2) not null default 0,

  free_income_planned numeric(12,2) not null default 0,
  free_income_pro_rata numeric(12,2) not null default 0,
  free_income_used    numeric(12,2) not null default 0,
  savings_planned     numeric(12,2) not null default 0,
  savings_pro_rata    numeric(12,2) not null default 0,
  savings_realized    numeric(12,2) not null default 0,

  pending_count       smallint not null default 0 check (pending_count >= 0),
  complete            boolean  not null default true,

  closed_at           timestamptz not null default now(),
  reopened_at         timestamptz,
  created_at          timestamptz not null default now(),

  constraint fechamento_unico_por_ciclo unique (user_id, cycle)
);

comment on table public.monthly_closings is
  'Fechamento de um ciclo: foto do previsto x realizado no momento em que foi fechado.';
comment on column public.monthly_closings.complete is
  'Falso quando o ciclo foi fechado com ocorrências ainda pendentes.';
comment on column public.monthly_closings.free_income_pro_rata is
  'Referência proporcional à receita realizada, não à esperada.';

alter table public.recurring_occurrences enable row level security;
alter table public.monthly_closings      enable row level security;

drop policy if exists "ocorrencias proprias: ler"     on public.recurring_occurrences;
drop policy if exists "ocorrencias proprias: criar"   on public.recurring_occurrences;
drop policy if exists "ocorrencias proprias: alterar" on public.recurring_occurrences;
drop policy if exists "ocorrencias proprias: apagar"  on public.recurring_occurrences;

create policy "ocorrencias proprias: ler"     on public.recurring_occurrences
  for select using (auth.uid() = user_id);
create policy "ocorrencias proprias: criar"   on public.recurring_occurrences
  for insert with check (auth.uid() = user_id);
create policy "ocorrencias proprias: alterar" on public.recurring_occurrences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ocorrencias proprias: apagar"  on public.recurring_occurrences
  for delete using (auth.uid() = user_id);

drop policy if exists "fechamentos proprios: ler"     on public.monthly_closings;
drop policy if exists "fechamentos proprios: criar"   on public.monthly_closings;
drop policy if exists "fechamentos proprios: alterar" on public.monthly_closings;
drop policy if exists "fechamentos proprios: apagar"  on public.monthly_closings;

create policy "fechamentos proprios: ler"     on public.monthly_closings
  for select using (auth.uid() = user_id);
create policy "fechamentos proprios: criar"   on public.monthly_closings
  for insert with check (auth.uid() = user_id);
create policy "fechamentos proprios: alterar" on public.monthly_closings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "fechamentos proprios: apagar"  on public.monthly_closings
  for delete using (auth.uid() = user_id);
