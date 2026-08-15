#!/usr/bin/env bash
set -euo pipefail

PORTA=5433
DADOS=/tmp/pgfinck-teste
SOCK=/tmp/pgsock-teste
export PATH=/usr/lib/postgresql/16/bin:$PATH

rm -rf "$DADOS" "$SOCK"; mkdir -p "$DADOS" "$SOCK"
chown postgres:postgres "$DADOS" "$SOCK" 2>/dev/null || true

su postgres -s /bin/bash -c "export PATH=$PATH; initdb -D $DADOS -U postgres --auth=trust" >/dev/null
su postgres -s /bin/bash -c "export PATH=$PATH; pg_ctl -D $DADOS -o '-p $PORTA -k $SOCK' -l $DADOS/log start" >/dev/null
sleep 3

P="psql -h $SOCK -p $PORTA -U postgres -tA"
$P -c "create database finck" >/dev/null
$P -d finck -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create schema if not exists auth;
create table auth.users (id uuid primary key default gen_random_uuid(),
                         raw_user_meta_data jsonb not null default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$
  select '00000000-0000-0000-0000-000000000001'::uuid $$;
SQL

for f in supabase/migrations/*.sql; do
  psql -h "$SOCK" -p $PORTA -U postgres -d finck -v ON_ERROR_STOP=1 -f "$f" >/dev/null
  echo "ok  $(basename "$f")"
done

U=00000000-0000-0000-0000-000000000001
R=11111111-1111-1111-1111-111111111111
$P -d finck -c "insert into auth.users(id) values ('$U');" >/dev/null
$P -d finck -c "insert into recurring_transactions(id,user_id,description,type,amount,day_of_month)
                values ('$R','$U','Salário','entrada',2000,5);" >/dev/null
$P -d finck -c "update profiles set initial_balance=1000 where id='$U';" >/dev/null

saldo() { $P -d finck -c "select to_char(1000+coalesce((select sum(case when type='entrada' then amount else -amount end) from transactions),0),'FM999990.00');"; }
conferir() {
  if [ "$2" = "$3" ]; then echo "  ok    $1: $2"
  else echo "  FALHA $1: esperado $3, obtido $2"; FALHOU=1; fi
}
FALHOU=0

$P -d finck -c "insert into recurring_occurrences(user_id,recurring_id,cycle,due_date,description,type,planned_amount)
                values ('$U','$R','2026-08','2026-08-05','Salário','entrada',2000);" >/dev/null
conferir "previsto nao altera saldo" "$(saldo)" "1000.00"

$P -d finck -c "with t as (insert into transactions(user_id,type,description,amount,date,source)
   values ('$U','entrada','Salário',2000,'2026-08-05','recorrente') returning id)
 update recurring_occurrences set status='confirmado',actual_amount=2000,transaction_id=(select id from t)
 where cycle='2026-08';" >/dev/null
conferir "confirmado soma ao saldo" "$(saldo)" "3000.00"

$P -d finck -c "update transactions set amount=1850 where id=(select transaction_id from recurring_occurrences where cycle='2026-08');
 update recurring_occurrences set status='ajustado',actual_amount=1850 where cycle='2026-08';" >/dev/null
conferir "ajustado corrige o saldo" "$(saldo)" "2850.00"
conferir "sem movimentacao duplicada" "$($P -d finck -c 'select count(*) from transactions;')" "1"
conferir "valor previsto preservado" "$($P -d finck -c "select to_char(planned_amount,'FM999990.00') from recurring_occurrences where cycle='2026-08';")" "2000.00"

barra() {
  if $P -d finck -c "$2" >/dev/null 2>&1; then echo "  FALHA $1: passou e nao devia"; FALHOU=1
  else echo "  ok    $1: barrado"; fi
}
barra "duplicar ocorrencia do mesmo ciclo" \
  "insert into recurring_occurrences(user_id,recurring_id,cycle,due_date,description,type,planned_amount)
   values ('$U','$R','2026-08','2026-08-05','Salário','entrada',2000);"
barra "confirmar sem valor real" \
  "insert into recurring_occurrences(user_id,recurring_id,cycle,due_date,description,type,planned_amount,status)
   values ('$U','$R','2026-10','2026-10-05','x','entrada',10,'confirmado');"
barra "ciclo fora do formato" \
  "insert into recurring_occurrences(user_id,recurring_id,cycle,due_date,description,type,planned_amount)
   values ('$U','$R','ago/26','2026-08-05','x','entrada',10);"

# ---- Operações atômicas (fase 2 do relatório de conclusão) -----------------
echo
echo "Operações atômicas"

M=22222222-2222-2222-2222-222222222222
$P -d finck -c "insert into goals(id,user_id,name,target_amount) values ('$M','$U','Reserva',6000);" >/dev/null

# Aporte: uma transação, um movimento de meta, progresso derivado.
$P -d finck -c "select aportar_meta('$M',500,'Aporte',null,'2026-08-10',true,'k-aporte-1');" >/dev/null
conferir "aporte grava movimento" "$($P -d finck -c "select count(*) from goal_movements where goal_id='$M';")" "1"
conferir "aporte atualiza progresso" \
  "$($P -d finck -c "select to_char(current_amount,'FM999990.00') from goals where id='$M';")" "500.00"

# Idempotência: mesma chave, mesmo resultado, nenhum lançamento novo.
$P -d finck -c "select aportar_meta('$M',500,'Aporte',null,'2026-08-10',true,'k-aporte-1');" >/dev/null
conferir "aporte repetido com a mesma chave nao duplica" \
  "$($P -d finck -c "select count(*) from goal_movements where goal_id='$M';")" "1"
conferir "progresso apos retry continua unico" \
  "$($P -d finck -c "select to_char(current_amount,'FM999990.00') from goals where id='$M';")" "500.00"

# Progresso precisa ser recalculável a partir do histórico.
conferir "progresso e derivavel do livro-razao" \
  "$($P -d finck -c "select to_char(recalcular_meta('$M'),'FM999990.00');")" "500.00"

# Estorno preserva o histórico e reverte a meta exatamente uma vez.
TX=$($P -d finck -c "select id from transactions where goal_id='$M' limit 1;")
$P -d finck -c "select estornar_transacao('$TX','Lançamento errado',null);" >/dev/null
conferir "estorno nao apaga a movimentacao" \
  "$($P -d finck -c "select count(*) from transactions where id='$TX';")" "1"
conferir "estorno marca a movimentacao" \
  "$($P -d finck -c "select case when reversed_at is null then 'nao' else 'sim' end from transactions where id='$TX';")" "sim"
conferir "estorno guarda o motivo" \
  "$($P -d finck -c "select reversal_reason from transactions where id='$TX';")" "Lançamento errado"
conferir "estorno reverte a meta uma vez" \
  "$($P -d finck -c "select to_char(current_amount,'FM999990.00') from goals where id='$M';")" "0.00"

$P -d finck -c "select estornar_transacao('$TX','De novo',null);" >/dev/null
conferir "estornar duas vezes nao reverte duas vezes" \
  "$($P -d finck -c "select to_char(current_amount,'FM999990.00') from goals where id='$M';")" "0.00"
conferir "estorno repetido nao cria segundo movimento" \
  "$($P -d finck -c "select count(*) from goal_movements where goal_id='$M' and kind='estorno';")" "1"

# Meta anterior ao livro-razão não pode perder progresso no primeiro aporte.
M2=66666666-6666-6666-6666-666666666666
$P -d finck -c "insert into goals(id,user_id,name,target_amount,current_amount)
                values ('$M2','$U','Meta antiga',5000,1000);" >/dev/null
$P -d finck -c "select aportar_meta('$M2',300,'Aporte',null,'2026-08-16',true,null);" >/dev/null
conferir "meta antiga nao perde o progresso" \
  "$($P -d finck -c "select to_char(current_amount,'FM999990.00') from goals where id='$M2';")" "1300.00"
conferir "valor antigo virou ajuste no livro" \
  "$($P -d finck -c "select count(*) from goal_movements where goal_id='$M2' and kind='ajuste';")" "1"

# Confirmação de ocorrência: idempotente pela chave.
$P -d finck -c "insert into recurring_occurrences(user_id,recurring_id,cycle,due_date,description,type,planned_amount)
                values ('$U','$R','2026-09','2026-09-05','Salário','entrada',2000);" >/dev/null
OC=$($P -d finck -c "select id from recurring_occurrences where cycle='2026-09';")
$P -d finck -c "select confirmar_ocorrencia('$OC',2000,null,true,'k-conf-1');" >/dev/null
$P -d finck -c "select confirmar_ocorrencia('$OC',2000,null,true,'k-conf-1');" >/dev/null
conferir "confirmar duas vezes gera uma transacao" \
  "$($P -d finck -c "select count(*) from transactions where source_occurrence_id='$OC';")" "1"

# Parcela: estado próprio, vínculo com a transação, contador derivado.
C=33333333-3333-3333-3333-333333333333
$P -d finck -c "insert into installment_purchases(id,user_id,description,total_amount,installments_count,installment_amount,first_due_date)
                values ('$C','$U','Notebook',3000,3,1000,'2026-09-10');" >/dev/null
$P -d finck -c "select confirmar_parcela('$C',1::smallint,1000,'2026-09-10',null,null,true,'k-parc-1');" >/dev/null
$P -d finck -c "select confirmar_parcela('$C',1::smallint,1000,'2026-09-10',null,null,true,'k-parc-1');" >/dev/null
conferir "parcela paga uma vez so" \
  "$($P -d finck -c "select count(*) from transactions where source='parcela';")" "1"
conferir "contador de parcelas e derivado" \
  "$($P -d finck -c "select paid_count from installment_purchases where id='$C';")" "1"

$P -d finck -c "select desfazer_parcela('$C',1::smallint);" >/dev/null
conferir "desfazer devolve a parcela ao compromisso" \
  "$($P -d finck -c "select status from installment_payments where purchase_id='$C' and installment_no=1;")" "aberta"
conferir "desfazer estorna sem apagar" \
  "$($P -d finck -c "select count(*) from transactions where source='parcela' and reversed_at is not null;")" "1"

# Transferência: o patrimônio total não muda.
A1=44444444-4444-4444-4444-444444444444
A2=55555555-5555-5555-5555-555555555555
$P -d finck -c "insert into accounts(id,user_id,name,initial_balance) values ('$A1','$U','Corrente',1000),('$A2','$U','Poupança',0);" >/dev/null
$P -d finck -c "select transferir_contas('$A1','$A2',300,'2026-09-15','Reserva','k-transf-1');" >/dev/null
$P -d finck -c "select transferir_contas('$A1','$A2',300,'2026-09-15','Reserva','k-transf-1');" >/dev/null
conferir "transferencia repetida com a mesma chave nao duplica" \
  "$($P -d finck -c "select count(*) from transfers;")" "1"
barra "transferencia para a mesma conta" "select transferir_contas('$A1','$A1',100,'2026-09-15',null,null);"

# Alocação explícita: não dá para estar em uma conta e fora de todas.
barra "transacao alocada e nao alocada ao mesmo tempo" \
  "insert into transactions(user_id,type,description,amount,date,account_id,unallocated)
   values ('$U','saida','x',10,'2026-09-01','$A1',true);"

# Saldo inicial: migrar duas vezes não soma duas vezes.
$P -d finck -c "select migrar_saldo_inicial('$A1','somar');" >/dev/null
$P -d finck -c "select migrar_saldo_inicial('$A1','somar');" >/dev/null
conferir "saldo inicial migra uma vez so" \
  "$($P -d finck -c "select to_char(initial_balance,'FM999990.00') from accounts where id='$A1';")" "2000.00"
conferir "perfil marcado como migrado" \
  "$($P -d finck -c "select case when initial_balance_migrated_at is null then 'nao' else 'sim' end from profiles where id='$U';")" "sim"

su postgres -s /bin/bash -c "export PATH=$PATH; pg_ctl -D $DADOS stop" >/dev/null 2>&1 || true
rm -rf "$DADOS" "$SOCK"
echo
[ $FALHOU -eq 0 ] && echo "migration validada" || { echo "migration com falhas"; exit 1; }
