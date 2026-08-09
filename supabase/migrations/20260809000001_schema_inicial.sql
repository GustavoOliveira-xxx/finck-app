-- ============================================================
-- FinCK — schema inicial
--
-- Reconstruído a partir do que o aplicativo realmente grava
-- (js/store.js, js/reality.js, js/finance.js, js/metas.js).
-- Toda tabela de dados carrega user_id apontando para
-- auth.users, que é a base do isolamento definido na migration
-- 20260809000002_rls.sql.
--
-- Aplicar com:  supabase db push
-- ou colando no SQL Editor do projeto FinCK.
-- ============================================================

-- ------------------------------------------------------------
-- profiles — perfil financeiro, 1 por usuário
-- O id é o próprio id de auth.users: o perfil morre junto com a
-- conta e não existe perfil órfão.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  name             text,
  income_monthly   numeric(12,2) not null default 0 check (income_monthly >= 0),
  income_type      text          not null default 'fixa'
                     check (income_type in ('fixa', 'variavel', 'mista')),
  payday           smallint      check (payday between 1 and 31),
  work_days_month  smallint      not null default 22 check (work_days_month between 1 and 31),
  work_hours_day   numeric(4,2)  not null default 8  check (work_hours_day > 0 and work_hours_day <= 24),
  initial_balance  numeric(12,2) not null default 0,
  setup_mode       text,
  onboarded_at     timestamptz,
  created_at       timestamptz   not null default now()
);

comment on table  public.profiles is 'Perfil financeiro do usuário: base de todo cálculo de valor-hora.';
comment on column public.profiles.work_days_month is 'Dias trabalhados por mês; divide a renda para achar o valor do dia.';

-- ------------------------------------------------------------
-- accounts — contas/carteiras do usuário
-- ------------------------------------------------------------
create table if not exists public.accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  type       text,
  balance    numeric(12,2) not null default 0,
  created_at timestamptz   not null default now()
);

-- ------------------------------------------------------------
-- goals — metas financeiras
-- ------------------------------------------------------------
create table if not exists public.goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  target_amount  numeric(12,2) not null check (target_amount > 0),
  current_amount numeric(12,2) not null default 0 check (current_amount >= 0),
  deadline       date,
  rate           numeric(6,3)  not null default 0,
  created_at     timestamptz   not null default now()
);

comment on column public.goals.rate is 'Rendimento mensal estimado, em porcentagem.';

-- ------------------------------------------------------------
-- transactions — entradas e saídas
-- goal_id opcional: um aporte pode estar amarrado a uma meta.
-- on delete set null preserva o lançamento se a meta sumir.
-- ------------------------------------------------------------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('entrada', 'saida')),
  description text not null,
  amount      numeric(12,2) not null check (amount > 0),
  date        date not null,
  category    text,
  goal_id     uuid references public.goals (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- recurring_transactions — previsões fixas do mês
-- ------------------------------------------------------------
create table if not exists public.recurring_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  description  text not null,
  type         text not null check (type in ('entrada', 'saida')),
  amount       numeric(12,2) not null check (amount > 0),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  active       boolean  not null default true,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- purchase_analyses — o cálculo do FinCK of Reality
--
-- Guarda um retrato da realidade financeira no momento do
-- cálculo (income_base, hour_value, jornada). Sem isso, mudar a
-- renda no perfil reescreveria o passado: uma compra analisada
-- quando a hora valia R$ 20 passaria a "ter custado" outra
-- quantidade de horas.
-- ------------------------------------------------------------
create table if not exists public.purchase_analyses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  item_name       text not null,
  price           numeric(12,2) not null check (price > 0),
  category        text not null default 'Outros',
  item_link       text,
  note            text,

  work_days       numeric(10,2) not null default 0,
  work_hours      numeric(10,2) not null default 0,
  income_percent  numeric(10,2) not null default 0,
  impact_level    text check (impact_level in ('verde', 'atencao', 'alerta')),
  decision        text check (decision in ('comprar', 'adiar', 'substituir', 'desistir')),
  reflections     jsonb not null default '{}'::jsonb,

  income_base     numeric(12,2) not null default 0,
  hour_value      numeric(12,2) not null default 0,
  day_value       numeric(12,2) not null default 0,
  work_days_month smallint      not null default 22,
  work_hours_day  numeric(4,2)  not null default 8,
  income_type     text,
  balance_before  numeric(12,2) not null default 0,
  balance_after   numeric(12,2) not null default 0,
  free_income     numeric(12,2) not null default 0,

  analyzed_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- gamification — XP, nível, sequência e conquistas
-- Uma linha por usuário: o app faz upsert com onConflict user_id,
-- então a unicidade precisa existir de verdade no banco.
-- ------------------------------------------------------------
create table if not exists public.gamification (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  xp           integer not null default 0 check (xp >= 0),
  level        integer not null default 1 check (level >= 1),
  streak       integer not null default 0 check (streak >= 0),
  last_active  date,
  achievements jsonb   not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Índices
-- Toda listagem do app filtra por user_id e ordena por data.
-- ------------------------------------------------------------
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);
create index if not exists transactions_user_created_idx
  on public.transactions (user_id, created_at desc);
create index if not exists goals_user_idx
  on public.goals (user_id, created_at desc);
create index if not exists recurring_user_day_idx
  on public.recurring_transactions (user_id, day_of_month);
create index if not exists analyses_user_created_idx
  on public.purchase_analyses (user_id, created_at desc);
create index if not exists accounts_user_idx
  on public.accounts (user_id, created_at desc);
