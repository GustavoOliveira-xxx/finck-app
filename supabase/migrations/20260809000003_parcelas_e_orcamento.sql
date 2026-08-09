-- ============================================================
-- FinCK — parcelamentos e orçamento por categoria
--
-- Duas tabelas novas, cada uma com RLS ligada e as mesmas quatro
-- políticas das demais: dono lê e mexe apenas no que é seu.
--
-- Seguro rodar mais de uma vez (if not exists / drop policy if
-- exists) e seguro rodar num banco que já tem dados.
-- ============================================================

-- ------------------------------------------------------------
-- installment_purchases — compras parceladas
--
-- Guarda o plano, não cada parcela: 12x de R$ 250 é uma linha, e
-- o cronograma sai por cálculo. Gravar 12 linhas obrigaria a
-- corrigir 12 registros a cada edição e abriria espaço para o
-- conjunto ficar inconsistente.
--
-- installment_amount é gravado, e não derivado de
-- total_amount / installments_count, porque a divisão quase nunca
-- é exata: 100 em 3x vira 33,33 + 33,33 + 33,34. O app arredonda
-- uma vez e joga a diferença na última parcela.
-- ------------------------------------------------------------
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

  -- não dá para ter pago mais parcelas do que existem
  constraint parcelas_pagas_validas check (paid_count <= installments_count)
);

comment on table  public.installment_purchases is 'Compras parceladas: guarda o plano; o cronograma é calculado.';
comment on column public.installment_purchases.paid_count is 'Quantas parcelas já venceram e foram quitadas.';

-- ------------------------------------------------------------
-- category_budgets — teto de gasto por categoria
--
-- Um teto por categoria por usuário. A unicidade evita dois
-- limites concorrentes para "Alimentação", que deixaria o alerta
-- dependendo de qual linha o app leu primeiro.
-- ------------------------------------------------------------
create table if not exists public.category_budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  category     text not null,
  limit_amount numeric(12,2) not null check (limit_amount > 0),
  created_at   timestamptz   not null default now(),

  constraint orcamento_categoria_unica unique (user_id, category)
);

comment on table public.category_budgets is 'Teto mensal de gasto por categoria, para avisar antes de estourar.';

-- ------------------------------------------------------------
-- Índices: toda leitura filtra por dono
-- ------------------------------------------------------------
create index if not exists parcelas_user_idx
  on public.installment_purchases (user_id, first_due_date);
create index if not exists orcamento_user_idx
  on public.category_budgets (user_id, category);

-- ------------------------------------------------------------
-- RLS: mesmo desenho das outras tabelas de dados
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Conferência
--   select tablename, rowsecurity from pg_tables
--    where schemaname='public'
--      and tablename in ('installment_purchases','category_budgets');
--
--   select tablename, count(*) from pg_policies
--    where schemaname='public'
--      and tablename in ('installment_purchases','category_budgets')
--    group by tablename;   -- deve dar 4 para cada
-- ------------------------------------------------------------
