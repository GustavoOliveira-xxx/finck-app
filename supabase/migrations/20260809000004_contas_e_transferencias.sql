

alter table public.accounts
  add column if not exists institution_name    text,
  add column if not exists account_type        text not null default 'corrente',
  add column if not exists initial_balance     numeric(12,2) not null default 0,
  add column if not exists initial_balance_date date,
  add column if not exists last_four_digits    text,
  add column if not exists color               text,
  add column if not exists notes               text,
  add column if not exists is_default          boolean not null default false,
  add column if not exists active              boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_tipo_valido'
  ) then
    alter table public.accounts
      add constraint accounts_tipo_valido
      check (account_type in ('corrente', 'poupanca', 'carteira', 'digital', 'investimento'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accounts_ultimos_digitos'
  ) then
    alter table public.accounts
      add constraint accounts_ultimos_digitos
      check (last_four_digits is null or last_four_digits ~ '^[0-9]{1,4}$');
  end if;
end $$;

comment on column public.accounts.institution_name is
  'Rótulo informado pelo usuário (Inter, Bradesco...). Não é conexão nem credencial.';
comment on column public.accounts.last_four_digits is
  'Somente os 4 últimos dígitos, para identificação visual. Nunca o número completo.';
comment on column public.accounts.initial_balance is
  'Pode ser negativo quando o usuário quer representar saldo devedor, por decisão explícita.';

alter table public.transactions
  add column if not exists account_id uuid references public.accounts (id) on delete set null;

create index if not exists transactions_account_idx
  on public.transactions (user_id, account_id);

create table if not exists public.transfers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  from_account_id uuid not null references public.accounts (id) on delete cascade,
  to_account_id   uuid not null references public.accounts (id) on delete cascade,
  amount          numeric(12,2) not null check (amount > 0),
  date            date not null,
  description     text,
  created_at      timestamptz not null default now(),

  constraint transferencia_entre_contas_distintas check (from_account_id <> to_account_id)
);

create index if not exists transfers_user_date_idx
  on public.transfers (user_id, date desc);

create table if not exists public.balance_adjustments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  account_id  uuid not null references public.accounts (id) on delete cascade,
  amount      numeric(12,2) not null,
  new_balance numeric(12,2) not null,
  date        date not null,
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists ajustes_user_idx
  on public.balance_adjustments (user_id, date desc);

create or replace function public.conta_pertence_ao_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'transactions' then
    if new.account_id is not null and not exists (
      select 1 from public.accounts a
       where a.id = new.account_id and a.user_id = new.user_id
    ) then
      raise exception 'A conta informada não pertence a este usuário.';
    end if;

  elsif tg_table_name = 'transfers' then
    if not exists (
      select 1 from public.accounts a
       where a.id = new.from_account_id and a.user_id = new.user_id
    ) or not exists (
      select 1 from public.accounts a
       where a.id = new.to_account_id and a.user_id = new.user_id
    ) then
      raise exception 'As contas da transferência precisam ser do mesmo usuário.';
    end if;

  elsif tg_table_name = 'balance_adjustments' then
    if not exists (
      select 1 from public.accounts a
       where a.id = new.account_id and a.user_id = new.user_id
    ) then
      raise exception 'A conta ajustada não pertence a este usuário.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists conta_do_dono on public.transactions;
create trigger conta_do_dono
  before insert or update on public.transactions
  for each row execute function public.conta_pertence_ao_usuario();

drop trigger if exists conta_do_dono on public.transfers;
create trigger conta_do_dono
  before insert or update on public.transfers
  for each row execute function public.conta_pertence_ao_usuario();

drop trigger if exists conta_do_dono on public.balance_adjustments;
create trigger conta_do_dono
  before insert or update on public.balance_adjustments
  for each row execute function public.conta_pertence_ao_usuario();

alter table public.transfers            enable row level security;
alter table public.balance_adjustments  enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['transfers', 'balance_adjustments'] loop
    execute format('drop policy if exists "dono: ler" on public.%I', t);
    execute format('drop policy if exists "dono: criar" on public.%I', t);
    execute format('drop policy if exists "dono: alterar" on public.%I', t);
    execute format('drop policy if exists "dono: apagar" on public.%I', t);

    execute format(
      'create policy "dono: ler" on public.%I for select using (auth.uid() = user_id)', t);
    execute format(
      'create policy "dono: criar" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "dono: alterar" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "dono: apagar" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;
