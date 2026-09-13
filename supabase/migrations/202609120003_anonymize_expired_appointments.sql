begin;

alter table public.appointments
  add column retention_hold boolean not null default false;

create or replace function public.anonymize_expired_appointments(
  p_retention_days integer default 90
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anonymized_rows bigint;
begin
  if p_retention_days is null
     or p_retention_days < 30
     or p_retention_days > 3650 then
    raise exception 'Retention must be between 30 and 3650 days.';
  end if;

  update public.appointments as appointment
     set customer_phone = 'redacted:' || appointment.id::text,
         requested_text = '[redacted]',
         wa_message_id = 'redacted:' || appointment.id::text
   where appointment.retention_hold = false
     and appointment.ends_at < now() - make_interval(days => p_retention_days)
     and (
       appointment.customer_phone not like 'redacted:%'
       or appointment.requested_text <> '[redacted]'
       or appointment.wa_message_id not like 'redacted:%'
     );

  get diagnostics v_anonymized_rows = row_count;
  return v_anonymized_rows;
end;
$$;

revoke all on function public.anonymize_expired_appointments(integer)
  from public, anon, authenticated, service_role;

grant execute on function public.anonymize_expired_appointments(integer)
  to service_role;

comment on function public.anonymize_expired_appointments(integer) is
  'Irreversibly removes customer identifiers and message text after the retention window unless a row is on hold.';

commit;
