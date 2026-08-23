# YallaQueue

YallaQueue is an early-stage WhatsApp booking demo. Its webhook verifies requests from Meta and safely places supported incoming messages onto AWS SQS through QueueCraft.

## What works

- Meta webhook verification with `GET /api/webhook`
- SHA-256 signature verification for webhook `POST` requests
- Text, button, and list-reply message extraction
- Batched webhook message handling
- Stable QueueCraft idempotency keys based on Meta message IDs
- No raw webhook body or customer phone number logging

## What is not built yet

- The worker that consumes booking jobs
- Booking time parsing and validation
- A database for bookings
- WhatsApp replies to customers
- An admin dashboard
- AWS or application deployment

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in the Meta and AWS values.
3. Run `npm install`.
4. Run `npm run dev`.

Do not commit `.env.local` or AWS secrets.

## Checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```
