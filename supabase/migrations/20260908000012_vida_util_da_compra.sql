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
