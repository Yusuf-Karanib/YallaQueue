-- Replace these example values before running this file in Supabase.
insert into public.shops (
  slug,
  name,
  timezone,
  whatsapp_phone_number_id,
  barber_email,
  default_appointment_minutes
) values (
  'pilot-shop',
  'Pilot Barbershop',
  'Asia/Dubai',
  'REPLACE_WITH_META_PHONE_NUMBER_ID',
  'barber@example.com',
  30
);

-- Sunday through Thursday: 09:00–21:00.
insert into public.working_hours (shop_id, day_of_week, opens_at, closes_at)
select id, day_number, time '09:00', time '21:00'
from public.shops
cross join generate_series(0, 4) as days(day_number)
where slug = 'pilot-shop';

-- Friday has a midday closure; Saturday uses normal hours.
insert into public.working_hours (shop_id, day_of_week, opens_at, closes_at)
select id, 5, time '09:00', time '12:00' from public.shops where slug = 'pilot-shop'
union all
select id, 5, time '14:00', time '21:00' from public.shops where slug = 'pilot-shop'
union all
select id, 6, time '09:00', time '21:00' from public.shops where slug = 'pilot-shop';
