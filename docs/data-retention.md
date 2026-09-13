# Appointment data retention

YallaQueue keeps customer phone numbers, WhatsApp message IDs, and message text
for 90 days after an appointment ends. The migration
`202609120003_anonymize_expired_appointments.sql` adds the controlled cleanup
function. It does not create a scheduler.

Assign a named operator and a recurring weekly operations task before production.
Because this is an operator-run control, eligible data remains in place until a
weekly run completes successfully.

## Weekly runbook

Run these steps from a trusted Supabase SQL session. Never expose the service-role
key to the web application.

1. Preview how many rows are eligible:

   ```sql
   select count(*) as eligible_rows
   from public.appointments
   where retention_hold = false
     and ends_at < now() - interval '90 days'
     and (
       customer_phone not like 'redacted:%'
       or requested_text <> '[redacted]'
       or wa_message_id not like 'redacted:%'
     );
   ```

2. If the count is expected, anonymize them:

   ```sql
   select public.anonymize_expired_appointments(90) as anonymized_rows;
   ```

3. Record the run date and returned row count in the private operations log.
4. Investigate a failed run before trying it again. Do not weaken the function's
   permissions or give the web runtime a service-role key.

The cleanup irreversibly replaces `customer_phone`, `wa_message_id`, and
`requested_text`. It keeps the appointment time, queue number, and status so the
shop can still use anonymous operational totals.

## Retention holds

Before a cleanup, a trusted operator can protect a row needed for an active legal
or support case:

```sql
update public.appointments
set retention_hold = true
where id = 'APPOINTMENT_UUID';
```

Remove the hold after the case closes. The next weekly run will then anonymize
the row once it is older than 90 days.

## Deletion requests

Verify the requester's identity first. If no legal or security hold applies, a
trusted operator can redact the matching rows immediately in a private SQL
session:

Resolve or cancel any future appointment with the requester first. Redaction
removes the contact route, so YallaQueue cannot send that appointment another
WhatsApp message.

```sql
begin;

update public.appointments
set customer_phone = 'redacted:' || id::text,
    requested_text = '[redacted]',
    wa_message_id = 'redacted:' || id::text
where shop_id = 'SHOP_UUID'
  and customer_phone = 'CUSTOMER_WHATSAPP_NUMBER'
  and retention_hold = false;

commit;
```

Record only the changed row count in the private operations log. Never copy raw
phone numbers or message text into tickets, source control, or shared logs.
