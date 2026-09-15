-- =====================================================================
--  FinCK — migration a aplicar no Supabase
--  Gerada em 15/09/2026
--
--  Cole este arquivo inteiro no SQL Editor do projeto e rode uma vez.
--  É seguro rodar de novo: a constraint é derrubada antes de recriada.
--
--  O QUE ISTO CONSERTA
--  -------------------
--  Em conta real (logada no Supabase), salvar as decisões "Pesquisar
--  alternativa", "Comprar usado" e "Reparar o item atual" falhava com
--  violação de check constraint. O modo demonstração não usa o banco,
--  então o erro não aparecia nos testes locais — só para quem estivesse
--  logado de verdade, e justamente nas três decisões que ligam o app à
--  meta 12.5 da ODS 12.
--
--  COMO CONFERIR DEPOIS DE RODAR
--  -----------------------------
--  Entre no app com uma conta real, faça um cálculo no FinCK of Reality
--  e salve a decisão "Comprar usado". Ela tem que aparecer em Decisões.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 20260915000013_decisoes_conscientes.sql
-- ---------------------------------------------------------------------

alter table public.purchase_analyses
  drop constraint if exists purchase_analyses_decision_check;

alter table public.purchase_analyses
  add constraint purchase_analyses_decision_check
  check (decision is null or decision in (
    'comprar', 'adiar', 'alternativa', 'usado', 'reparar', 'desistir', 'substituir'
  ));


-- =====================================================================
--  VERIFICAÇÃO — rode junto e confira a saída.
--  A primeira consulta deve listar os sete valores aceitos.
--  A segunda deve devolver zero linhas (nenhuma decisão fora da lista).
-- =====================================================================

select pg_get_constraintdef(oid) as constraint_decision
  from pg_constraint
 where conname = 'purchase_analyses_decision_check';

select decision, count(*) as linhas
  from public.purchase_analyses
 where decision is not null
   and decision not in ('comprar','adiar','alternativa','usado','reparar','desistir','substituir')
 group by decision;
