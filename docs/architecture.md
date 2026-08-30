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
- The public Lambda endpoint can enqueue jobs and serve the authenticated shop
  dashboard. Dashboard database requests use a Supabase user session and row-level
  security; the Lambda never receives the Supabase service-role key.
- The signed-in dashboard registers WebMCP tools in the browser. Tool calls reuse
  the active login through protected same-origin routes, return minimal queue data,
  and remain limited by the same row-level security policies.
- The booking worker costs nothing while the queue is empty. SQS wakes it only
  when a booking job arrives.

## Booking safety

- The database rejects overlapping confirmed appointments.
- Queue numbers are allocated inside a database transaction and are unique per shop and day.
- A WhatsApp message ID can create only one appointment.
- The worker asks for another time when a request is unclear, outside working hours, or already occupied.

## Current MVP limits

- Natural-language booking requests are English only.
- Appointment length is fixed per shop.
- Dashboard access is invitation-only. Public shop self-service onboarding is not
  included yet.
- Customer and barber notifications are at-least-once. A process crash after a provider accepts a message but before Supabase records it can cause a rare duplicate notification. The appointment itself remains unique.
