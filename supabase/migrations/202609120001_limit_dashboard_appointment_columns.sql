begin;

-- Keep row-level shop isolation, but do not let authenticated clients select
-- message text, phone numbers, WhatsApp IDs, or other worker-only fields.
revoke select on public.appointments from public, anon, authenticated;

grant select (
  id,
  shop_id,
  scheduled_for,
  service_date,
  duration_minutes,
  queue_number,
  status,
  customer_notified_at,
  barber_notified_at
) on public.appointments to authenticated;

commit;
