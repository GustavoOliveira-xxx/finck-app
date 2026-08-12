

alter table public.profiles              enable row level security;
alter table public.accounts              enable row level security;
alter table public.goals                 enable row level security;
alter table public.transactions          enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.purchase_analyses     enable row level security;
alter table public.gamification          enable row level security;

drop policy if exists "perfil proprio: ler"     on public.profiles;
drop policy if exists "perfil proprio: criar"   on public.profiles;
drop policy if exists "perfil proprio: alterar" on public.profiles;
drop policy if exists "perfil proprio: apagar"  on public.profiles;

create policy "perfil proprio: ler"     on public.profiles
  for select using (auth.uid() = id);
create policy "perfil proprio: criar"   on public.profiles
  for insert with check (auth.uid() = id);
create policy "perfil proprio: alterar" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "perfil proprio: apagar"  on public.profiles
  for delete using (auth.uid() = id);

drop policy if exists "gamificacao propria: ler"     on public.gamification;
drop policy if exists "gamificacao propria: criar"   on public.gamification;
drop policy if exists "gamificacao propria: alterar" on public.gamification;
drop policy if exists "gamificacao propria: apagar"  on public.gamification;

create policy "gamificacao propria: ler"     on public.gamification
  for select using (auth.uid() = user_id);
create policy "gamificacao propria: criar"   on public.gamification
  for insert with check (auth.uid() = user_id);
create policy "gamificacao propria: alterar" on public.gamification
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gamificacao propria: apagar"  on public.gamification
  for delete using (auth.uid() = user_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'goals', 'transactions',
    'recurring_transactions', 'purchase_analyses'
  ] loop
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

create or replace function public.criar_perfil_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_do_usuario();
