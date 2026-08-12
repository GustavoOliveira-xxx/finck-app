

create table if not exists public.installment_purchases (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  description        text not null,
  category           text not null default 'Outros',
  total_amount       numeric(12,2) not null check (total_amount > 0),
  installments_count smallint      not null check (installments_count between 1 and 120),
  installment_amount numeric(12,2) not null check (installment_amount > 0),
  first_due_date     date not null,
  paid_count         smallint      not null default 0 check (paid_count >= 0),
  active             boolean       not null default true,
  note               text,
  created_at         timestamptz   not null default now(),

  constraint parcelas_pagas_validas check (paid_count <= installments_count)
);

comment on table  public.installment_purchases is 'Compras parceladas: guarda o plano; o cronograma é calculado.';
comment on column public.installment_purchases.paid_count is 'Quantas parcelas já venceram e foram quitadas.';

create table if not exists public.category_budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  category     text not null,
  limit_amount numeric(12,2) not null check (limit_amount > 0),
  created_at   timestamptz   not null default now(),

  constraint orcamento_categoria_unica unique (user_id, category)
);

comment on table public.category_budgets is 'Teto mensal de gasto por categoria, para avisar antes de estourar.';

create index if not exists parcelas_user_idx
  on public.installment_purchases (user_id, first_due_date);
create index if not exists orcamento_user_idx
  on public.category_budgets (user_id, category);

alter table public.installment_purchases enable row level security;
alter table public.category_budgets      enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['installment_purchases', 'category_budgets'] loop
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
