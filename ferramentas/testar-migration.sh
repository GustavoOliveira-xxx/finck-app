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

su postgres -s /bin/bash -c "export PATH=$PATH; pg_ctl -D $DADOS stop" >/dev/null 2>&1 || true
rm -rf "$DADOS" "$SOCK"
echo
[ $FALHOU -eq 0 ] && echo "migration validada" || { echo "migration com falhas"; exit 1; }
