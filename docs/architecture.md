# YallaQueue architecture

YallaQueue is currently designed for one UAE pilot barbershop, while keeping shop data separated so more shops can be added later.

The pilot AWS services are deployed in Frankfurt (`eu-central-1`) while AWS's UAE Region remains disrupted. The booking timezone remains `Asia/Dubai`; infrastructure location does not change appointment times.

```text
Customer WhatsApp message
        |
        v
Meta signed webhook --> AWS Lambda Function URL --> Next.js /api/webhook
                                                        |
                                                        v
                                                     AWS SQS
                                                        |
                                                        v
                                     QueueCraft Lambda worker (on demand)
                                                |      |      |
                                                v      v      v
                                           Supabase  WhatsApp  AWS SES
                                           booking   reply     barber email
```

## Ownership

- Supabase is the source of truth for shops, working hours, appointments, and notification progress.
- SQS holds unfinished work.
- DynamoDB is used only by QueueCraft for worker leases and completed-job detection.
- Meta message IDs connect webhook retries to the same logical job.
- The public web Lambda can enqueue jobs and serve the authenticated shop
  dashboard. Dashboard database requests use a Supabase user session and
  row-level security. Only this web Lambda lacks the Supabase service-role key;
  it receives the publishable key. The private worker Lambda receives the
  service-role key because it performs server-side booking work.
- The signed-in dashboard registers WebMCP tools in the browser. Tool calls reuse
  the active login through protected same-origin routes, return minimal queue data,
  and remain limited by the same row-level security policies.
- SQS invokes worker Lambda compute only when a booking job arrives. The idle
  system can still incur non-Lambda charges, including Secrets Manager,
  provisioned DynamoDB, CloudWatch alarms and log storage, and ECR storage.
- The public web Lambda has reserved concurrency to limit simultaneous compute.
  This can produce `429` responses during overload and is not a full rate limit
  or spending cap.

## Booking safety

- The database rejects overlapping confirmed appointments.
- Queue numbers are allocated inside a database transaction and are unique per shop and day.
- A WhatsApp message ID can create only one appointment.
- One phone number can hold at most three future confirmed appointments per
  shop. The database serializes this check so simultaneous requests cannot
  bypass it.
- The worker asks for another time when a request is unclear, outside working hours, or already occupied.
- Dashboard status changes do not send a WhatsApp message; the operator must
  contact the customer separately when that is required.

## Current MVP limits

- Natural-language booking requests are English only.
- Appointment length is fixed per shop.
- Dashboard access is invitation-only. Public shop self-service onboarding is not
  included yet.
- Customer and barber notifications are at-least-once. A process crash after a provider accepts a message but before Supabase records it can cause a rare duplicate notification. The appointment itself remains unique.
