

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.accounts,
  public.gamification,
  public.goals,
  public.purchase_analyses,
  public.recurring_transactions,
  public.transactions,
  public.balance_adjustments,
  public.category_budgets,
  public.installment_payments,
  public.installment_purchases,
  public.monthly_closings,
  public.reconciliation_queue,
  public.recurring_occurrences,
  public.transfers,
  public.goal_movements
to authenticated;

grant select, insert, delete on table public.integrity_events to authenticated;
grant select, insert on table public.operation_keys to authenticated;

revoke all on table public.migration_reports from anon, authenticated;

alter table public.profiles enable row level security;
create policy "perfil autenticado: ler" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "perfil autenticado: criar" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "perfil autenticado: alterar" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "perfil autenticado: apagar" on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'gamification', 'goals', 'purchase_analyses',
    'recurring_transactions', 'transactions', 'balance_adjustments',
    'category_budgets', 'installment_payments', 'installment_purchases',
    'monthly_closings', 'reconciliation_queue', 'recurring_occurrences',
    'transfers', 'goal_movements'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "dono autenticado: ler" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "dono autenticado: criar" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "dono autenticado: alterar" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "dono autenticado: apagar" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

alter table public.integrity_events enable row level security;
create policy "eventos autenticados: ler" on public.integrity_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "eventos autenticados: criar" on public.integrity_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "eventos autenticados: apagar" on public.integrity_events
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.operation_keys enable row level security;
create policy "chaves autenticadas: ler" on public.operation_keys
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "chaves autenticadas: criar" on public.operation_keys
  for insert to authenticated with check ((select auth.uid()) = user_id);

alter table public.migration_reports enable row level security;

revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function public.aportar_meta(uuid, numeric, text, uuid, date, boolean, text) to authenticated;
grant execute on function public.confirmar_ocorrencia(uuid, numeric, uuid, boolean, text) to authenticated;
grant execute on function public.confirmar_parcela(uuid, smallint, numeric, date, text, uuid, boolean, text) to authenticated;
grant execute on function public.desfazer_ocorrencia(uuid, text) to authenticated;
grant execute on function public.desfazer_parcela(uuid, smallint) to authenticated;
grant execute on function public.estornar_transacao(uuid, text, text) to authenticated;
grant execute on function public.garantir_historico_meta(uuid) to authenticated;
grant execute on function public.migrar_saldo_inicial(uuid, text) to authenticated;
grant execute on function public.recalcular_meta(uuid) to authenticated;
grant execute on function public.retirar_meta(uuid, numeric, text, uuid, date, boolean, text) to authenticated;
grant execute on function public.transferir_contas(uuid, uuid, numeric, date, text, text) to authenticated;

create index if not exists balance_adjustments_account_id_idx
  on public.balance_adjustments (account_id);
create index if not exists goal_movements_goal_id_idx
  on public.goal_movements (goal_id);
create index if not exists installment_purchases_account_id_idx
  on public.installment_purchases (account_id);
create index if not exists profiles_initial_balance_account_id_idx
  on public.profiles (initial_balance_account_id);
create index if not exists recurring_occurrences_account_id_idx
  on public.recurring_occurrences (account_id);
create index if not exists recurring_transactions_account_id_idx
  on public.recurring_transactions (account_id);
create index if not exists transactions_account_id_fk_idx
  on public.transactions (account_id);
create index if not exists transactions_goal_id_idx
  on public.transactions (goal_id);
create index if not exists transactions_reversed_by_idx
  on public.transactions (reversed_by);
create index if not exists transfers_from_account_id_idx
  on public.transfers (from_account_id);
create index if not exists transfers_to_account_id_idx
  on public.transfers (to_account_id);
