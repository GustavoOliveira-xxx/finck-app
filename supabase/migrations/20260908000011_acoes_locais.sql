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
