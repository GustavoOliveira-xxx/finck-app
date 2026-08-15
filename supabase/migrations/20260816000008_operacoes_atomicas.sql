-- Fase 2 do relatório de conclusão: operações atômicas.
--
-- A partir daqui, alterar dinheiro tem porta única. Cada função recebe o fato,
-- valida a propriedade, grava tudo numa transação de banco e devolve o estado
-- final completo — para o front-end substituir o estado local pelo retorno do
-- servidor em vez de adivinhar o resultado.
--
-- Todas aceitam p_idem_key. Repetir a chamada com a mesma chave devolve o
-- resultado da primeira, sem criar um segundo lançamento.

-- Auxiliar: progresso da meta recalculado a partir do histórico ------------

create or replace function public.recalcular_meta(p_goal_id uuid)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total numeric(12,2);
begin
  select coalesce(sum(amount), 0) into v_total
    from public.goal_movements
   where goal_id = p_goal_id and user_id = auth.uid();

  update public.goals
     set current_amount = greatest(0, v_total)
   where id = p_goal_id and user_id = auth.uid();

  return v_total;
end;
$$;

comment on function public.recalcular_meta is
  'Reescreve o cache current_amount a partir da soma dos movimentos. É a prova de que o progresso é derivável.';

-- Auxiliar: meta antiga ganha a linha que explica o que ela já tinha ---------
-- Sem isso, o primeiro aporte numa meta anterior ao livro-razão apagaria o
-- progresso que o usuário já havia registrado — o recálculo veria zero
-- movimentos e concluiria zero. Nada é apagado: o valor vira um ajuste.

create or replace function public.garantir_historico_meta(p_goal_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_guardado numeric(12,2);
begin
  if exists (select 1 from public.goal_movements
              where goal_id = p_goal_id and user_id = auth.uid()) then
    return;
  end if;

  select current_amount into v_guardado
    from public.goals
   where id = p_goal_id and user_id = auth.uid();

  if v_guardado is null or abs(v_guardado) < 0.005 then
    return;
  end if;

  insert into public.goal_movements (user_id, goal_id, kind, amount, date, note)
  values (auth.uid(), p_goal_id, 'ajuste', v_guardado, current_date,
          'Valor guardado antes do livro-razão');
end;
$$;

comment on function public.garantir_historico_meta is
  'Semeia o livro-razão com o valor que a meta já tinha, antes do primeiro movimento novo. Idempotente.';

-- 1. Aporte em meta ---------------------------------------------------------

create or replace function public.aportar_meta(
  p_goal_id     uuid,
  p_amount      numeric,
  p_description text default 'Aporte em meta',
  p_account_id  uuid default null,
  p_date        date default null,
  p_unallocated boolean default false,
  p_idem_key    text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_goal  public.goals;
  v_tx_id uuid;
  v_mov   public.goal_movements;
  v_out   jsonb;
begin
  if p_idem_key is not null then
    select result into v_out from public.operation_keys
     where user_id = auth.uid() and key = p_idem_key;
    if found then return v_out; end if;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor maior que zero.' using errcode = 'check_violation';
  end if;

  select * into v_goal from public.goals
   where id = p_goal_id and user_id = auth.uid()
     for update;

  if not found then
    raise exception 'Meta não encontrada.' using errcode = 'no_data_found';
  end if;

  perform public.garantir_historico_meta(p_goal_id);

  insert into public.transactions
    (user_id, type, description, amount, date, category, goal_id, account_id, unallocated, source)
  values
    (auth.uid(), 'saida', coalesce(p_description, 'Aporte em meta'), p_amount,
     coalesce(p_date, current_date), 'Reserva', p_goal_id, p_account_id,
     p_account_id is null and p_unallocated, 'meta')
  returning id into v_tx_id;

  insert into public.goal_movements
    (user_id, goal_id, transaction_id, kind, amount, date, note)
  values
    (auth.uid(), p_goal_id, v_tx_id, 'aporte', p_amount,
     coalesce(p_date, current_date), p_description)
  returning * into v_mov;

  perform public.recalcular_meta(p_goal_id);
  select * into v_goal from public.goals where id = p_goal_id;

  v_out := jsonb_build_object(
    'goal', to_jsonb(v_goal),
    'movement', to_jsonb(v_mov),
    'transaction_id', v_tx_id);

  if p_idem_key is not null then
    insert into public.operation_keys (user_id, key, operation, result)
    values (auth.uid(), p_idem_key, 'aportar_meta', v_out)
    on conflict (user_id, key) do nothing;
  end if;

  return v_out;
end;
$$;

comment on function public.aportar_meta is
  'Cria a saída, o movimento de meta e recalcula o progresso numa transação só. O progresso muda exatamente uma vez.';

-- 2. Retirada ou gasto associado à meta --------------------------------------

create or replace function public.retirar_meta(
  p_goal_id     uuid,
  p_amount      numeric,
  p_description text default 'Retirada da meta',
  p_account_id  uuid default null,
  p_date        date default null,
  p_unallocated boolean default false,
  p_idem_key    text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_goal  public.goals;
  v_tx_id uuid;
  v_mov   public.goal_movements;
  v_out   jsonb;
begin
  if p_idem_key is not null then
    select result into v_out from public.operation_keys
     where user_id = auth.uid() and key = p_idem_key;
    if found then return v_out; end if;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor maior que zero.' using errcode = 'check_violation';
  end if;

  select * into v_goal from public.goals
   where id = p_goal_id and user_id = auth.uid()
     for update;

  if not found then
    raise exception 'Meta não encontrada.' using errcode = 'no_data_found';
  end if;

  perform public.garantir_historico_meta(p_goal_id);

  insert into public.transactions
    (user_id, type, description, amount, date, category, goal_id, account_id, unallocated, source)
  values
    (auth.uid(), 'entrada', coalesce(p_description, 'Retirada da meta'), p_amount,
     coalesce(p_date, current_date), null, p_goal_id, p_account_id,
     p_account_id is null and p_unallocated, 'meta')
  returning id into v_tx_id;

  insert into public.goal_movements
    (user_id, goal_id, transaction_id, kind, amount, date, note)
  values
    (auth.uid(), p_goal_id, v_tx_id, 'retirada', -p_amount,
     coalesce(p_date, current_date), p_description)
  returning * into v_mov;

  perform public.recalcular_meta(p_goal_id);
  select * into v_goal from public.goals where id = p_goal_id;

  v_out := jsonb_build_object(
    'goal', to_jsonb(v_goal),
    'movement', to_jsonb(v_mov),
    'transaction_id', v_tx_id);

  if p_idem_key is not null then
    insert into public.operation_keys (user_id, key, operation, result)
    values (auth.uid(), p_idem_key, 'retirar_meta', v_out)
    on conflict (user_id, key) do nothing;
  end if;

  return v_out;
end;
$$;

comment on function public.retirar_meta is
  'Devolve dinheiro da meta ao caixa. Mesma porta do aporte, sinal invertido no livro-razão.';

-- 3. Estorno que preserva o histórico ----------------------------------------
-- A versão antiga apagava a linha e devolvia void. Esta marca, registra motivo
-- e escreve o movimento de estorno na meta.

drop function if exists public.estornar_transacao(uuid);

create or replace function public.estornar_transacao(
  p_transaction_id uuid,
  p_reason         text default null,
  p_idem_key       text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tx       public.transactions;
  v_original public.goal_movements;
  v_estorno  public.goal_movements;
  v_goal     public.goals;
  v_out      jsonb;
begin
  if p_idem_key is not null then
    select result into v_out from public.operation_keys
     where user_id = auth.uid() and key = p_idem_key;
    if found then return v_out; end if;
  end if;

  select * into v_tx from public.transactions
   where id = p_transaction_id and user_id = auth.uid()
     for update;

  if not found then
    return jsonb_build_object('encontrada', false, 'estornada', false);
  end if;

  -- Idempotência natural: estornar de novo devolve o mesmo estado.
  if v_tx.reversed_at is not null then
    return jsonb_build_object(
      'encontrada', true, 'estornada', true, 'repetida', true,
      'transaction', to_jsonb(v_tx),
      'goal', case when v_tx.goal_id is null then null
                   else to_jsonb((select g from public.goals g
                                   where g.id = v_tx.goal_id and g.user_id = auth.uid())) end);
  end if;

  update public.transactions
     set reversed_at     = now(),
         reversal_reason = p_reason,
         reversed_by     = auth.uid()
   where id = p_transaction_id and user_id = auth.uid()
  returning * into v_tx;

  -- A ocorrência que originou o lançamento volta a ser uma previsão em aberto.
  update public.recurring_occurrences
     set status         = 'pendente',
         actual_amount  = null,
         transaction_id = null,
         decided_at     = now()
   where transaction_id = p_transaction_id and user_id = auth.uid();

  -- A parcela paga por este lançamento volta a ser compromisso.
  update public.installment_payments
     set status         = 'aberta',
         transaction_id = null,
         paid_at        = null
   where transaction_id = p_transaction_id and user_id = auth.uid();

  if v_tx.goal_id is not null then
    select * into v_original from public.goal_movements
     where transaction_id = p_transaction_id
       and user_id = auth.uid()
       and kind <> 'estorno'
     limit 1;

    if found then
      insert into public.goal_movements
        (user_id, goal_id, transaction_id, kind, amount, date, note, reverses_id)
      values
        (auth.uid(), v_tx.goal_id, p_transaction_id, 'estorno', -v_original.amount,
         current_date, coalesce(p_reason, 'Estorno'), v_original.id)
      returning * into v_estorno;

      update public.goal_movements
         set reversed_at = now()
       where id = v_original.id;
    else
      -- Aporte antigo, sem linha de histórico: cria a contrapartida mesmo assim
      -- para o progresso poder ser recalculado a partir de agora.
      insert into public.goal_movements
        (user_id, goal_id, transaction_id, kind, amount, date, note)
      values
        (auth.uid(), v_tx.goal_id, p_transaction_id, 'estorno',
         case when v_tx.type = 'saida' then -v_tx.amount else v_tx.amount end,
         current_date, coalesce(p_reason, 'Estorno de lançamento sem histórico'))
      returning * into v_estorno;
    end if;

    perform public.recalcular_meta(v_tx.goal_id);
    select * into v_goal from public.goals where id = v_tx.goal_id;
  end if;

  v_out := jsonb_build_object(
    'encontrada', true,
    'estornada', true,
    'repetida', false,
    'transaction', to_jsonb(v_tx),
    'movement', to_jsonb(v_estorno),
    'goal', to_jsonb(v_goal));

  if p_idem_key is not null then
    insert into public.operation_keys (user_id, key, operation, result)
    values (auth.uid(), p_idem_key, 'estornar_transacao', v_out)
    on conflict (user_id, key) do nothing;
  end if;

  return v_out;
end;
$$;

comment on function public.estornar_transacao is
  'Marca a movimentação como estornada, devolve ocorrência e parcela ao estado aberto e escreve o estorno no livro da meta. Nada é apagado.';

-- 4. Confirmação de parcela --------------------------------------------------

create or replace function public.confirmar_parcela(
  p_purchase_id    uuid,
  p_installment_no smallint,
  p_amount         numeric,
  p_due_date       date,
  p_description    text default null,
  p_account_id     uuid default null,
  p_unallocated    boolean default false,
  p_idem_key       text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_compra   public.installment_purchases;
  v_parcela  public.installment_payments;
  v_tx_id    uuid;
  v_pagas    smallint;
  v_out      jsonb;
begin
  if p_idem_key is not null then
    select result into v_out from public.operation_keys
     where user_id = auth.uid() and key = p_idem_key;
    if found then return v_out; end if;
  end if;

  select * into v_compra from public.installment_purchases
   where id = p_purchase_id and user_id = auth.uid()
     for update;

  if not found then
    raise exception 'Parcelamento não encontrado.' using errcode = 'no_data_found';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor maior que zero.' using errcode = 'check_violation';
  end if;

  select * into v_parcela from public.installment_payments
   where purchase_id = p_purchase_id
     and installment_no = p_installment_no
     and user_id = auth.uid()
     for update;

  -- Já quitada: devolve o que existe em vez de lançar de novo.
  if found and v_parcela.status = 'paga' then
    return jsonb_build_object(
      'ja_paga', true,
      'payment', to_jsonb(v_parcela),
      'transaction_id', v_parcela.transaction_id);
  end if;

  insert into public.transactions
    (user_id, type, description, amount, date, category, account_id, unallocated, source)
  values
    (auth.uid(), 'saida',
     coalesce(p_description,
       format('%s (%s/%s)', v_compra.description, p_installment_no, v_compra.installments_count)),
     p_amount, p_due_date, coalesce(v_compra.category, 'Outros'),
     coalesce(p_account_id, v_compra.account_id),
     coalesce(p_account_id, v_compra.account_id) is null and p_unallocated,
     'parcela')
  returning id into v_tx_id;

  if v_parcela.id is null then
    insert into public.installment_payments
      (user_id, purchase_id, installment_no, due_date, amount, status, transaction_id, paid_at)
    values
      (auth.uid(), p_purchase_id, p_installment_no, p_due_date, p_amount,
       'paga', v_tx_id, now())
    returning * into v_parcela;
  else
    update public.installment_payments
       set status = 'paga', transaction_id = v_tx_id, paid_at = now(), amount = p_amount
     where id = v_parcela.id and user_id = auth.uid()
    returning * into v_parcela;
  end if;

  -- paid_count segue sendo derivado: quantas parcelas iniciais estão pagas
  -- em sequência. Continua útil para telas antigas, sem ser fonte de verdade.
  select count(*)::smallint into v_pagas
    from generate_series(1, v_compra.installments_count) n
   where not exists (
     select 1 from generate_series(1, n) k
      where not exists (
        select 1 from public.installment_payments ip
         where ip.purchase_id = p_purchase_id
           and ip.installment_no = k
           and ip.status = 'paga'
      )
   );

  update public.installment_purchases
     set paid_count = v_pagas
   where id = p_purchase_id and user_id = auth.uid();

  v_out := jsonb_build_object(
    'ja_paga', false,
    'payment', to_jsonb(v_parcela),
    'transaction_id', v_tx_id,
    'paid_count', v_pagas);

  if p_idem_key is not null then
    insert into public.operation_keys (user_id, key, operation, result)
    values (auth.uid(), p_idem_key, 'confirmar_parcela', v_out)
    on conflict (user_id, key) do nothing;
  end if;

  return v_out;
end;
$$;

comment on function public.confirmar_parcela is
  'Paga uma parcela: cria a movimentação, muda o estado da parcela e recalcula o contador, tudo junto.';

-- 5. Desfazer o pagamento de uma parcela -------------------------------------

create or replace function public.desfazer_parcela(
  p_purchase_id    uuid,
  p_installment_no smallint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_compra  public.installment_purchases;
  v_parcela public.installment_payments;
  v_tx_id   uuid;
  v_pagas   smallint;
begin
  select * into v_compra from public.installment_purchases
   where id = p_purchase_id and user_id = auth.uid()
     for update;

  if not found then
    raise exception 'Parcelamento não encontrado.' using errcode = 'no_data_found';
  end if;

  select * into v_parcela from public.installment_payments
   where purchase_id = p_purchase_id
     and installment_no = p_installment_no
     and user_id = auth.uid()
     for update;

  if not found then
    return jsonb_build_object('desfeita', false);
  end if;

  v_tx_id := v_parcela.transaction_id;

  -- Solta o vínculo antes de mexer na transação: a parcela nunca fica
  -- apontando para o que já não vale.
  update public.installment_payments
     set status = 'aberta', transaction_id = null, paid_at = null
   where id = v_parcela.id and user_id = auth.uid()
  returning * into v_parcela;

  if v_tx_id is not null then
    update public.transactions
       set reversed_at     = now(),
           reversal_reason = 'Pagamento de parcela desfeito',
           reversed_by     = auth.uid()
     where id = v_tx_id and user_id = auth.uid() and reversed_at is null;
  end if;

  select count(*)::smallint into v_pagas
    from generate_series(1, v_compra.installments_count) n
   where not exists (
     select 1 from generate_series(1, n) k
      where not exists (
        select 1 from public.installment_payments ip
         where ip.purchase_id = p_purchase_id
           and ip.installment_no = k
           and ip.status = 'paga'
      )
   );

  update public.installment_purchases
     set paid_count = v_pagas
   where id = p_purchase_id and user_id = auth.uid();

  return jsonb_build_object(
    'desfeita', true,
    'payment', to_jsonb(v_parcela),
    'transaction_id', v_tx_id,
    'paid_count', v_pagas);
end;
$$;

comment on function public.desfazer_parcela is
  'Devolve a parcela ao compromisso e estorna a movimentação que a quitou, sem apagar o histórico.';

-- 6. Transferência entre contas ----------------------------------------------

create or replace function public.transferir_contas(
  p_from_account_id uuid,
  p_to_account_id   uuid,
  p_amount          numeric,
  p_date            date default null,
  p_description     text default null,
  p_idem_key        text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transfer public.transfers;
  v_out      jsonb;
begin
  if p_idem_key is not null then
    select result into v_out from public.operation_keys
     where user_id = auth.uid() and key = p_idem_key;
    if found then return v_out; end if;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor maior que zero.' using errcode = 'check_violation';
  end if;

  if p_from_account_id = p_to_account_id then
    raise exception 'A conta de destino precisa ser diferente da origem.' using errcode = 'check_violation';
  end if;

  -- O gatilho conta_do_dono já barra conta de outro usuário; travar as duas
  -- linhas aqui evita que uma transferência simultânea leia saldo velho.
  perform 1 from public.accounts
   where id in (p_from_account_id, p_to_account_id) and user_id = auth.uid()
   for update;

  insert into public.transfers
    (user_id, from_account_id, to_account_id, amount, date, description)
  values
    (auth.uid(), p_from_account_id, p_to_account_id, p_amount,
     coalesce(p_date, current_date), p_description)
  returning * into v_transfer;

  v_out := jsonb_build_object('transfer', to_jsonb(v_transfer));

  if p_idem_key is not null then
    insert into public.operation_keys (user_id, key, operation, result)
    values (auth.uid(), p_idem_key, 'transferir_contas', v_out)
    on conflict (user_id, key) do nothing;
  end if;

  return v_out;
end;
$$;

comment on function public.transferir_contas is
  'Move dinheiro entre contas do mesmo dono. O patrimônio total não muda; origem e destino mudam juntos.';

-- 7. Confirmação de ocorrência: idempotência por chave e alocação explícita ---
-- A versão de 15.08 já era idempotente pelo vínculo. Esta acrescenta a chave
-- de operação (retry depois de timeout) e a declaração de não alocada.

drop function if exists public.confirmar_ocorrencia(uuid, numeric, uuid);

create or replace function public.confirmar_ocorrencia(
  p_occurrence_id uuid,
  p_amount        numeric,
  p_account_id    uuid default null,
  p_unallocated   boolean default false,
  p_idem_key      text default null
)
returns public.recurring_occurrences
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_oc     public.recurring_occurrences;
  v_tx_id  uuid;
  v_status text;
  v_conta  uuid;
  v_cache  jsonb;
begin
  if p_idem_key is not null then
    select result into v_cache from public.operation_keys
     where user_id = auth.uid() and key = p_idem_key;
    if found then
      select * into v_oc from public.recurring_occurrences
       where id = (v_cache->>'occurrence_id')::uuid and user_id = auth.uid();
      if found then return v_oc; end if;
    end if;
  end if;

  select * into v_oc
    from public.recurring_occurrences
   where id = p_occurrence_id and user_id = auth.uid()
     for update;

  if not found then
    raise exception 'Ocorrência não encontrada.' using errcode = 'no_data_found';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor maior que zero.' using errcode = 'check_violation';
  end if;

  v_status := case
    when abs(p_amount - v_oc.planned_amount) < 0.005 then 'confirmado'
    else 'ajustado'
  end;

  v_conta := coalesce(p_account_id, v_oc.account_id);

  select id into v_tx_id
    from public.transactions
   where source_occurrence_id = p_occurrence_id
     and user_id = auth.uid()
     and reversed_at is null
   limit 1;

  if v_tx_id is null then
    insert into public.transactions
      (user_id, type, description, amount, date, category, account_id, unallocated,
       source, source_occurrence_id)
    values
      (v_oc.user_id, v_oc.type, v_oc.description, p_amount, v_oc.due_date,
       case when v_oc.type = 'saida' then coalesce(v_oc.category, 'Outros') else null end,
       v_conta, v_conta is null and p_unallocated, 'recorrente', p_occurrence_id)
    returning id into v_tx_id;
  else
    update public.transactions
       set amount      = p_amount,
           account_id  = v_conta,
           unallocated = v_conta is null and p_unallocated,
           date        = v_oc.due_date
     where id = v_tx_id and user_id = auth.uid();
  end if;

  update public.recurring_occurrences
     set status         = v_status,
         actual_amount  = p_amount,
         account_id     = v_conta,
         transaction_id = v_tx_id,
         decided_at     = now()
   where id = p_occurrence_id
  returning * into v_oc;

  if p_idem_key is not null then
    insert into public.operation_keys (user_id, key, operation, result)
    values (auth.uid(), p_idem_key, 'confirmar_ocorrencia',
            jsonb_build_object('occurrence_id', p_occurrence_id, 'transaction_id', v_tx_id))
    on conflict (user_id, key) do nothing;
  end if;

  return v_oc;
end;
$$;

comment on function public.confirmar_ocorrencia is
  'Confirma uma ocorrência em uma transação única. Idempotente pelo vínculo e pela chave de operação.';

-- 7b. Desfazer uma ocorrência também preserva o histórico --------------------
-- A versão de 15.08 apagava a transação vinculada. Se ela existia, dinheiro se
-- moveu: o registro fica, estornado, com motivo.

create or replace function public.desfazer_ocorrencia(
  p_occurrence_id uuid,
  p_status        text
)
returns public.recurring_occurrences
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_oc public.recurring_occurrences;
begin
  if p_status not in ('nao_realizado', 'nao_pago', 'pendente') then
    raise exception 'Estado inválido para desfazer.' using errcode = 'check_violation';
  end if;

  -- Solta o vínculo antes de mexer na transação: a ocorrência nunca fica
  -- apontando para um lançamento que já não conta.
  update public.recurring_occurrences
     set status         = p_status,
         actual_amount  = null,
         transaction_id = null,
         decided_at     = now()
   where id = p_occurrence_id and user_id = auth.uid()
  returning * into v_oc;

  if not found then
    raise exception 'Ocorrência não encontrada.' using errcode = 'no_data_found';
  end if;

  update public.transactions
     set reversed_at     = now(),
         reversal_reason = case p_status
                             when 'nao_realizado' then 'Previsão marcada como não realizada'
                             when 'nao_pago'      then 'Previsão marcada como não paga'
                             else 'Decisão adiada'
                           end,
         reversed_by     = auth.uid()
   where source_occurrence_id = p_occurrence_id
     and user_id = auth.uid()
     and reversed_at is null;

  return v_oc;
end;
$$;

comment on function public.desfazer_ocorrencia is
  'Volta a ocorrência para um estado sem movimentação e estorna o lançamento vinculado, sem apagá-lo.';

-- 8. Migração do saldo inicial do perfil para uma conta ----------------------
-- Converte o valor legado em saldo de conta e marca o perfil como migrado,
-- para o mesmo dinheiro nunca ser contado duas vezes.

create or replace function public.migrar_saldo_inicial(
  p_account_id uuid,
  p_modo       text default 'somar'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_perfil public.profiles;
  v_conta  public.accounts;
  v_valor  numeric(12,2);
  v_ajuste public.balance_adjustments;
begin
  select * into v_perfil from public.profiles
   where id = auth.uid() for update;

  if not found then
    raise exception 'Perfil não encontrado.' using errcode = 'no_data_found';
  end if;

  if v_perfil.initial_balance_migrated_at is not null then
    return jsonb_build_object('migrado', false, 'motivo', 'ja_migrado',
                              'profile', to_jsonb(v_perfil));
  end if;

  v_valor := coalesce(v_perfil.initial_balance, 0);
  if v_valor = 0 then
    update public.profiles
       set initial_balance_migrated_at = now(),
           initial_balance_source      = 'contas'
     where id = auth.uid()
    returning * into v_perfil;
    return jsonb_build_object('migrado', true, 'valor', 0, 'profile', to_jsonb(v_perfil));
  end if;

  select * into v_conta from public.accounts
   where id = p_account_id and user_id = auth.uid()
     for update;

  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'no_data_found';
  end if;

  if p_modo = 'ajuste' then
    insert into public.balance_adjustments
      (user_id, account_id, amount, new_balance, date, reason)
    values
      (auth.uid(), p_account_id, v_valor,
       coalesce(v_conta.initial_balance, 0) + v_valor, current_date,
       'Saldo inicial migrado do perfil')
    returning * into v_ajuste;
  else
    update public.accounts
       set initial_balance = coalesce(initial_balance, 0) + v_valor
     where id = p_account_id and user_id = auth.uid()
    returning * into v_conta;
  end if;

  update public.profiles
     set initial_balance_migrated_at = now(),
         initial_balance_account_id  = p_account_id,
         initial_balance_source      = 'contas'
   where id = auth.uid()
  returning * into v_perfil;

  update public.reconciliation_queue
     set status = 'resolvido', resolved_at = now()
   where user_id = auth.uid()
     and kind = 'saldo_inicial_duplicado'
     and status = 'aberto';

  return jsonb_build_object(
    'migrado', true,
    'valor', v_valor,
    'modo', p_modo,
    'account', to_jsonb(v_conta),
    'adjustment', to_jsonb(v_ajuste),
    'profile', to_jsonb(v_perfil));
end;
$$;

comment on function public.migrar_saldo_inicial is
  'Leva o saldo inicial do perfil para uma conta escolhida e marca o perfil como migrado. Rodar de novo não soma de novo.';
