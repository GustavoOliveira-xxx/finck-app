-- FinCK — ODS 12: as decisões conscientes precisam caber no banco.
--
-- O check de `decision` nasceu no esquema inicial com quatro valores:
-- 'comprar', 'adiar', 'substituir' e 'desistir'. Depois disso o app passou a
-- oferecer seis, e três deles — pesquisar alternativa, comprar usado e reparar
-- o item — são justamente as saídas que ligam o FinCK à meta 12.5 da ODS 12.
--
-- Como js/reality-page.js grava o id da decisão direto na coluna
-- (S.atualizar("purchase_analyses", id, { decision })), qualquer uma dessas
-- três era recusada pelo banco em conta real. O modo demonstração guarda em
-- localStorage e não tem constraint, então a falha só aparecia para quem
-- estivesse logado de verdade — e logo nas decisões que o projeto mais quer
-- registrar.
--
-- 'substituir' continua aceito: pode existir em linhas gravadas antes de o
-- app trocar esse rótulo por 'alternativa'.

alter table public.purchase_analyses
  drop constraint if exists purchase_analyses_decision_check;

alter table public.purchase_analyses
  add constraint purchase_analyses_decision_check
  check (decision is null or decision in (
    'comprar', 'adiar', 'alternativa', 'usado', 'reparar', 'desistir', 'substituir'
  ));
