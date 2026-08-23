create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  timezone text not null default 'Asia/Dubai',
  whatsapp_phone_number_id text not null unique,
  barber_email text not null,
  default_appointment_minutes smallint not null default 30
    check (default_appointment_minutes between 5 and 240),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.working_hours (
  shop_id uuid not null references public.shops(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  primary key (shop_id, day_of_week, opens_at),
  check (opens_at < closes_at)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  wa_message_id text not null unique,
  customer_phone text not null,
  requested_text text not null,
  scheduled_for timestamptz not null,
  service_date date not null,
  duration_minutes smallint not null check (duration_minutes between 5 and 240),
  queue_number integer not null check (queue_number > 0),
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  customer_notified_at timestamptz,
  barber_notified_at timestamptz,
  created_at timestamptz not null default now(),
  slot tstzrange generated always as (
    tstzrange(
      scheduled_for,
      scheduled_for + make_interval(mins => duration_minutes),
      '[)'
    )
  ) stored,
  unique (shop_id, service_date, queue_number),
  exclude using gist (
    shop_id with =,
    slot with &&
  ) where (status = 'confirmed')
);

create index appointments_shop_service_date_idx
  on public.appointments (shop_id, service_date, queue_number);

alter table public.shops enable row level security;
alter table public.working_hours enable row level security;
alter table public.appointments enable row level security;

revoke all on public.shops from anon, authenticated;
revoke all on public.working_hours from anon, authenticated;
revoke all on public.appointments from anon, authenticated;

grant select on public.shops to service_role;
grant select on public.working_hours to service_role;
grant select, insert, update on public.appointments to service_role;

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
set search_path = ''
as $$
declare
  v_shop public.shops%rowtype;
  v_existing public.appointments%rowtype;
  v_booking public.appointments%rowtype;
  v_local_start timestamp;
  v_local_end timestamp;
  v_service_date date;
  v_day_of_week smallint;
  v_next_queue_number integer;
begin
  select appointment.*
    into v_existing
    from public.appointments as appointment
   where appointment.wa_message_id = p_wa_message_id;

  if found then
    select shop.* into v_shop
      from public.shops as shop
     where shop.id = v_existing.shop_id;

    return query select
      'duplicate'::text,
      v_existing.id,
      v_shop.id,
      v_shop.name,
      v_shop.timezone,
      v_shop.barber_email,
      v_existing.queue_number,
      v_existing.scheduled_for,
      v_existing.customer_notified_at,
      v_existing.barber_notified_at;
    return;
  end if;

  select shop.*
    into v_shop
    from public.shops as shop
   where shop.whatsapp_phone_number_id = p_business_phone_number_id
     and shop.active = true;

  if not found then
    return query select
      'unknown_business'::text,
      null::uuid,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::integer,
      null::timestamptz,
      null::timestamptz,
      null::timestamptz;
    return;
  end if;

  if p_scheduled_for <= now()
     or p_scheduled_for > now() + interval '90 days' then
    return query select
      'invalid_time'::text,
      null::uuid,
      v_shop.id,
      v_shop.name,
      v_shop.timezone,
      v_shop.barber_email,
      null::integer,
      p_scheduled_for,
      null::timestamptz,
      null::timestamptz;
    return;
  end if;

  v_local_start := p_scheduled_for at time zone v_shop.timezone;
  v_local_end := v_local_start + make_interval(mins => v_shop.default_appointment_minutes);
  v_service_date := v_local_start::date;
  v_day_of_week := extract(dow from v_local_start)::smallint;

  if not exists (
    select 1
      from public.working_hours as hours
     where hours.shop_id = v_shop.id
       and hours.day_of_week = v_day_of_week
       and v_local_start::time >= hours.opens_at
       and v_local_end::time <= hours.closes_at
  ) then
    return query select
      'outside_hours'::text,
      null::uuid,
      v_shop.id,
      v_shop.name,
      v_shop.timezone,
      v_shop.barber_email,
      null::integer,
      p_scheduled_for,
      null::timestamptz,
      null::timestamptz;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_shop.id::text || ':' || v_service_date::text, 0)
  );

  select coalesce(max(appointment.queue_number), 0) + 1
    into v_next_queue_number
    from public.appointments as appointment
   where appointment.shop_id = v_shop.id
     and appointment.service_date = v_service_date;

  begin
    insert into public.appointments (
      shop_id,
      wa_message_id,
      customer_phone,
      requested_text,
      scheduled_for,
      service_date,
      duration_minutes,
      queue_number
    ) values (
      v_shop.id,
      p_wa_message_id,
      p_customer_phone_number,
      p_message_text,
      p_scheduled_for,
      v_service_date,
      v_shop.default_appointment_minutes,
      v_next_queue_number
    )
    returning * into v_booking;
  exception
    when exclusion_violation then
      return query select
        'unavailable'::text,
        null::uuid,
        v_shop.id,
        v_shop.name,
        v_shop.timezone,
        v_shop.barber_email,
        null::integer,
        p_scheduled_for,
        null::timestamptz,
        null::timestamptz;
      return;
    when unique_violation then
      select appointment.*
        into v_existing
        from public.appointments as appointment
       where appointment.wa_message_id = p_wa_message_id;

      if not found then
        raise;
      end if;

      return query select
        'duplicate'::text,
        v_existing.id,
        v_shop.id,
        v_shop.name,
        v_shop.timezone,
        v_shop.barber_email,
        v_existing.queue_number,
        v_existing.scheduled_for,
        v_existing.customer_notified_at,
        v_existing.barber_notified_at;
      return;
  end;

  return query select
    'confirmed'::text,
    v_booking.id,
    v_shop.id,
    v_shop.name,
    v_shop.timezone,
    v_shop.barber_email,
    v_booking.queue_number,
    v_booking.scheduled_for,
    v_booking.customer_notified_at,
    v_booking.barber_notified_at;
end;
$$;

create or replace function public.mark_booking_notification(
  p_booking_id uuid,
  p_channel text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_channel = 'customer' then
    update public.appointments
       set customer_notified_at = coalesce(customer_notified_at, now())
     where id = p_booking_id;
  elsif p_channel = 'barber' then
    update public.appointments
       set barber_notified_at = coalesce(barber_notified_at, now())
     where id = p_booking_id;
  else
    raise exception 'Unsupported notification channel';
  end if;

  if not found then
    raise exception 'Booking not found';
  end if;
end;
$$;

revoke all on function public.reserve_whatsapp_booking(text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.mark_booking_notification(uuid, text)
  from public, anon, authenticated;

grant execute on function public.reserve_whatsapp_booking(text, text, text, text, timestamptz)
  to service_role;
grant execute on function public.mark_booking_notification(uuid, text)
  to service_role;
