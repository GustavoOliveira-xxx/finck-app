-- =====================================================================
--  FinCK — migrations a aplicar no Supabase
--  Cole este arquivo inteiro no SQL Editor do painel e clique em RUN.
--
--  São as três migrations novas, na ordem:
--    20260908000010  indicador de decisão responsável + acompanhamento
--    20260908000011  ações locais (aplicabilidade local)
--    20260908000012  quantidade, vida útil e destino do item
--
--  É seguro rodar mais de uma vez: tudo usa "if not exists" / "if not
--  exists (select 1 from pg_constraint ...)". Rodar duas vezes não
--  duplica coluna, índice nem política.
--
--  Nada aqui apaga, altera ou move dado existente: só acrescenta colunas
--  (todas opcionais, começando nulas) e uma tabela nova.
--
--  Depois de rodar, confira em Table Editor:
--    purchase_analyses  →  8 colunas novas
--    local_actions      →  tabela nova, com RLS ligada
-- =====================================================================


-- ---------------------------------------------------------------------
-- 20260908000010_ods12_indicador_e_acompanhamento.sql
-- ---------------------------------------------------------------------

-- FinCK — ODS 12: indicador de decisão responsável e acompanhamento da decisão.
--
-- Duas colunas guardam a síntese das seis perguntas de reflexão no momento da
-- análise (responsibility_score, responsibility_label) e duas guardam o que o
-- usuário disse ter acontecido depois (outcome, outcome_at).
--
-- O indicador resume apenas respostas declaradas. Ele não é medida de impacto
-- ambiental: o FinCK não calcula CO2, água nem resíduo.

alter table public.purchase_analyses
  add column if not exists responsibility_score smallint,
  add column if not exists responsibility_label text,
  add column if not exists outcome              text,
  add column if not exists outcome_at           timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'purchase_analyses_responsibility_score_check'
  ) then
    alter table public.purchase_analyses
      add constraint purchase_analyses_responsibility_score_check
      check (responsibility_score is null or responsibility_score between 0 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'purchase_analyses_responsibility_label_check'
  ) then
    alter table public.purchase_analyses
      add constraint purchase_analyses_responsibility_label_check
      check (responsibility_label is null or responsibility_label in ('alta', 'media', 'baixa'));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'purchase_analyses_outcome_check'
  ) then
    alter table public.purchase_analyses
      add constraint purchase_analyses_outcome_check
      check (outcome is null or outcome in ('mantive', 'resolvi_reparo_reuso', 'comprei_depois', 'nao_sei'));
  end if;
end $$;

-- Um acompanhamento sem data, ou uma data sem acompanhamento, deixaria a
-- economia confirmada ambígua. As duas colunas andam juntas.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'purchase_analyses_outcome_at_check'
  ) then
    alter table public.purchase_analyses
      add constraint purchase_analyses_outcome_at_check
      check ((outcome is null) = (outcome_at is null));
  end if;
end $$;

create index if not exists purchase_analyses_outcome_idx
  on public.purchase_analyses (user_id, outcome);

-- ---------------------------------------------------------------------
-- 20260908000011_acoes_locais.sql
-- ---------------------------------------------------------------------

-- FinCK — ODS 12: aplicabilidade local.
--
-- Pontos de reparo, doação, troca e descarte correto que o próprio usuário (ou
-- a turma) cadastra para a sua cidade, bairro ou escola. O FinCK não traz base
-- de parceiros, não usa mapa nem API paga: o conteúdo é sempre declarado por
-- quem usa, e por isso vive sob RLS como qualquer outro dado pessoal.

create table if not exists public.local_actions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  kind        text not null default 'reparo'
              check (kind in ('reparo', 'doacao', 'troca', 'descarte', 'aluguel', 'usado')),
  address     text,
  contact     text,
  notes       text,
  verified_at date,
  created_at  timestamptz not null default now()
);

create index if not exists local_actions_user_idx
  on public.local_actions (user_id, kind, created_at desc);

alter table public.local_actions enable row level security;

drop policy if exists "acoes locais proprias: ler"     on public.local_actions;
drop policy if exists "acoes locais proprias: criar"   on public.local_actions;
drop policy if exists "acoes locais proprias: alterar" on public.local_actions;
drop policy if exists "acoes locais proprias: apagar"  on public.local_actions;

create policy "acoes locais proprias: ler"     on public.local_actions
  for select using (auth.uid() = user_id);
create policy "acoes locais proprias: criar"   on public.local_actions
  for insert with check (auth.uid() = user_id);
create policy "acoes locais proprias: alterar" on public.local_actions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "acoes locais proprias: apagar"  on public.local_actions
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on table public.local_actions to authenticated;

-- ---------------------------------------------------------------------
-- 20260908000012_vida_util_da_compra.sql
-- ---------------------------------------------------------------------

-- FinCK — ODS 12: quantidade, vida útil esperada e destino do item.
--
-- Só com o preço, o app não distingue um item barato descartável comprado dez
-- vezes de um item caro que dura anos — e essa distinção é o centro do consumo
-- desenfreado. Estes campos são opcionais: quando existem, o app deriva o custo
-- por mês de uso; quando não existem, nada muda.

alter table public.purchase_analyses
  add column if not exists quantity        smallint,
  add column if not exists expected_months smallint,
  add column if not exists end_of_life     text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'purchase_analyses_quantity_check') then
    alter table public.purchase_analyses
      add constraint purchase_analyses_quantity_check
      check (quantity is null or quantity between 1 and 999);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'purchase_analyses_expected_months_check') then
    alter table public.purchase_analyses
      add constraint purchase_analyses_expected_months_check
      check (expected_months is null or expected_months between 1 and 600);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'purchase_analyses_end_of_life_check') then
    alter table public.purchase_analyses
      add constraint purchase_analyses_end_of_life_check
      check (end_of_life is null or end_of_life in ('doar_revender', 'reciclar', 'guardar', 'descartar', 'nao_sei'));
  end if;
end $$;


-- =====================================================================
--  Conferência rápida — o resultado deve trazer 9 linhas.
-- =====================================================================

select 'purchase_analyses' as tabela, column_name as coluna
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'purchase_analyses'
   and column_name in ('responsibility_score','responsibility_label',
                       'outcome','outcome_at',
                       'quantity','expected_months','end_of_life')
union all
select 'local_actions', 'tabela criada'
  from information_schema.tables
 where table_schema = 'public' and table_name = 'local_actions'
union all
select 'local_actions', 'RLS ligada'
  from pg_tables
 where schemaname = 'public' and tablename = 'local_actions' and rowsecurity
 order by 1, 2;
