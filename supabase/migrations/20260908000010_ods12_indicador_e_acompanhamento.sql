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
