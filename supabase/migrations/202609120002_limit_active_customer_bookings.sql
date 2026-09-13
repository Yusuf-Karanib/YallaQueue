begin;

create index appointments_active_customer_idx
  on public.appointments (shop_id, customer_phone, ends_at)
  where status = 'confirmed';

alter function public.reserve_whatsapp_booking(text, text, text, text, timestamptz)
  rename to reserve_whatsapp_booking_without_customer_limit;

create or replace function public.enforce_active_customer_booking_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_booking_count integer;
begin
  if new.status <> 'confirmed' or new.ends_at <= now() then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.shop_id is not distinct from old.shop_id
     and new.customer_phone is not distinct from old.customer_phone
     and new.ends_at is not distinct from old.ends_at
     and new.status is not distinct from old.status then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'yallaqueue:active-booking:' || new.shop_id::text || ':' || new.customer_phone,
      0
    )
  );

  select count(*)::integer
    into v_active_booking_count
    from public.appointments as appointment
   where appointment.shop_id = new.shop_id
     and appointment.customer_phone = new.customer_phone
     and appointment.status = 'confirmed'
     and appointment.ends_at > now()
     and appointment.id <> new.id;

  if v_active_booking_count >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'active_booking_limit_reached',
      detail = 'A customer may have at most three active bookings per shop.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_active_customer_booking_limit()
  from public, anon, authenticated, service_role;

create trigger enforce_active_customer_booking_limit
before insert or update of shop_id, customer_phone, ends_at, status
on public.appointments
for each row
execute function public.enforce_active_customer_booking_limit();

create or replace function public.reserve_whatsapp_booking(
  p_business_phone_number_id text,
  p_customer_phone_number text,
  p_message_text text,
  p_wa_message_id text,
  p_scheduled_for timestamptz
)
returns table (
  outcome text,
  booking_id uuid,
  shop_id uuid,
  shop_name text,
  shop_timezone text,
  barber_email text,
  queue_number integer,
  scheduled_for timestamptz,
  customer_notified_at timestamptz,
  barber_notified_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop public.shops%rowtype;
begin
  -- Reuse the deployed validation and reservation rules. The trigger takes the
  -- per-customer lock immediately before any confirmed row is written, so it
  -- remains the single enforcement point for RPC calls and direct writes.
  begin
    return query
    select result.*
      from public.reserve_whatsapp_booking_without_customer_limit(
        p_business_phone_number_id,
        p_customer_phone_number,
        p_message_text,
        p_wa_message_id,
        p_scheduled_for
      ) as result;
    return;
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'active_booking_limit_reached' then
        raise;
      end if;
  end;

  -- Only the cap trigger raises active_booking_limit_reached. Looking up the
  -- shop after the rolled-back insert gives the worker the same safe metadata
  -- as the other non-booking outcomes.
  select shop.*
    into strict v_shop
    from public.shops as shop
   where shop.whatsapp_phone_number_id = p_business_phone_number_id
     and shop.active = true;

  return query select
    'booking_limit'::text,
    null::uuid,
    v_shop.id,
    v_shop.name,
    v_shop.timezone,
    v_shop.barber_email,
    null::integer,
    p_scheduled_for,
    null::timestamptz,
    null::timestamptz;
end;
$$;

-- The old implementation remains private so the wrapper can reuse the already
-- deployed booking rules without leaving a limit-bypass callable by the worker.
revoke all on function public.reserve_whatsapp_booking_without_customer_limit(
  text,
  text,
  text,
  text,
  timestamptz
) from public, anon, authenticated, service_role;

revoke all on function public.reserve_whatsapp_booking(
  text,
  text,
  text,
  text,
  timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.reserve_whatsapp_booking(
  text,
  text,
  text,
  text,
  timestamptz
) to service_role;

commit;
