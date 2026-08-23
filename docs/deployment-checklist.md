# Deployment checklist

No production deployment should happen until every item is complete.

## Meta

- A WhatsApp business phone number is connected to the correct Meta app.
- The callback URL ends in `/api/webhook` and passes verification.
- The app is subscribed to the `messages` webhook field.
- A non-expiring production access token is stored only in the worker environment.
- The Graph API version is explicitly configured.

## AWS

- All stacks use `eu-central-1` while AWS's UAE-region migration recommendation remains active.
- The QueueCraft CloudFormation stack has created SQS, its dead-letter queue, and DynamoDB.
- The web and worker images passed ECR scanning and use immutable commit tags or digests.
- The public webhook uses the Lambda Function URL produced by `web-lambda.yaml`, not the stale Replit snapshot.
- The web process has only `sqs:SendMessage` permission.
- The worker has only the QueueCraft consumer permissions plus `ses:SendEmail` for the approved sender identity.
- The SES sender identity is verified.
- If SES is still in sandbox mode, the pilot barber email is also verified.
- The AWS budget and billing alarms are enabled.

## Supabase

- The initial migration has been applied.
- The pilot shop and its working hours have been inserted using a private copy of the example seed.
- The service-role key exists only in the worker environment.
- Database backups and point-in-time recovery match the pilot's recovery requirements.

## Application

- `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- The current Next.js security release has been checked immediately before deployment.
- The web process and worker process are deployed separately.
- `/api/health` returns `200` from the live Lambda URL.
- The worker is configured to restart automatically.
- A signed test webhook reaches SQS and produces one Supabase appointment.
- The customer receives one WhatsApp confirmation and the barber receives one email.
- A duplicate webhook does not create a second appointment.
- An occupied slot receives an unavailable response.
- The dead-letter queue has an alarm and a named person responsible for checking it.
