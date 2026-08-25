# YallaQueue

YallaQueue is a WhatsApp appointment and queue system for a UAE barbershop pilot.

## Implemented

- Signed Meta webhook verification and message ingestion
- Batched text, button, and list-reply handling
- Stable QueueCraft jobs based on Meta message IDs
- An event-driven QueueCraft Lambda worker with duplicate protection and partial retries
- English natural-language date and time parsing
- Supabase booking storage with duplicate, overlap, working-hours, and queue-number protection
- WhatsApp customer confirmations
- AWS SES email alerts for the barber
- Production templates for immutable container registries, Lambda web and
  worker functions, alarms, logs, and least-privilege roles
- Automated tests with no real cloud calls
- No customer phone numbers or raw webhook bodies in application logs

## Not deployed yet

The code is production-shaped, but no Supabase schema, AWS resource, Meta token, or email sender has been connected to a live account yet.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the values.
2. Run `npm install`.
3. Run the web process with `npm run dev`.
4. Run the optional long-polling development worker separately with `npm run worker:local`.

Do not commit `.env.local`, the Supabase service-role key, Meta tokens, or AWS secrets.

## Database

Follow `supabase/README.md` to apply the schema and insert the pilot shop.

## Checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

See `docs/architecture.md` for the system design and `docs/deployment-checklist.md` before using a real barbershop account.
