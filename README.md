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
- A private shop dashboard with Supabase login, upcoming appointments, and status controls
- Browser-native WebMCP tools for reading the live queue and updating statuses
- Production templates for immutable container registries, Lambda web and
  worker functions, alarms, logs, and least-privilege roles
- Automated tests with no real cloud calls
- No customer phone numbers or raw webhook bodies in application logs

## Pilot deployment

The WhatsApp booking path is live against the Meta test account. A dedicated
business number is still required before real customers can use it.

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

## WebMCP demo

The signed-in dashboard registers two tools:

- `get_queue_summary` reads today's and upcoming queue without customer phone numbers.
- `update_queue_status` changes one appointment after the owner asks for it.

Open the deployed dashboard in ChatGPT's in-app browser, or enable
`chrome://flags/#enable-webmcp-testing` in Chrome. Try:

1. `Summarize today's queue.`
2. `Mark queue 1 completed.`

Every tool call re-checks the login, shop membership, input, and Supabase
row-level security.

See `docs/architecture.md` for the system design and `docs/deployment-checklist.md` before using a real barbershop account.
