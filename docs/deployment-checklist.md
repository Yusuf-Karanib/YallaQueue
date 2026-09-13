# Deployment checklist

No production deployment should happen until every item is complete.

## Meta

- A WhatsApp business phone number is connected to the correct Meta app.
- The callback URL ends in `/api/webhook` and passes verification.
- The app is subscribed to the `messages` webhook field.
- A non-expiring production access token is stored only in the worker environment.
- The Graph API version is explicitly configured.

## AWS

- The chosen Region has been checked against the current public AWS Health
  Dashboard, the account's Personal Health Dashboard, data-location needs, and
  the recovery plan. The current pilot configuration uses `eu-central-1`.
- The QueueCraft CloudFormation stack has created SQS, its dead-letter queue, and DynamoDB.
- The web and worker images passed ECR scanning and use immutable commit tags or digests.
- The GitHub ECR role reuses the account's existing GitHub OIDC provider. Its
  trust is limited to the expected numeric owner and repository IDs and `main`.
- The public webhook uses the Lambda Function URL produced by `web-lambda.yaml`, not the stale Replit snapshot.
- The web process has only `sqs:SendMessage` permission.
- Reserved concurrency is enabled only when the account quota can retain AWS's
  required unreserved capacity. If enabled, overload and `429` handling have
  been tested. It is not treated as a budget or request-rate limit.
- The web throttle alarm reaches a named operator through the supplied alarm
  topic, and its response runbook distinguishes legitimate load from abuse.
- The Lambda worker has only the QueueCraft consumer permissions plus `ses:SendEmail` for the approved sender identity.
- The source queue visibility timeout is at least 180 seconds: six times the
  worker Lambda's 30-second timeout.
- The SES sender identity is verified.
- If SES is still in sandbox mode, the pilot barber email is also verified.
- The AWS budget, billing recipients, cost-anomaly monitoring, log retention,
  backup choices, and teardown ownership are recorded in the
  [AWS operations checklist](aws-operations-checklist.md).

## Supabase

- The initial migration has been applied.
- The dashboard access migration has been applied.
- All three `20260912000*` migrations have been applied in filename order.
- The pilot shop and its working hours have been inserted using a private copy of the example seed.
- Every dashboard user is assigned to the correct shop in `shop_members`.
- Dashboard table grants and row-level security policies have been reviewed.
- A signed-in shop user cannot select customer phone numbers, message text,
  WhatsApp message IDs, retention holds, or other worker-only columns.
- The service-role key exists only in the worker Lambda environment. The web
  Lambda has only the publishable key.
- Database backups and point-in-time recovery match the pilot's recovery requirements.
- A named operator has tested and owns the weekly 90-day anonymization runbook
  in `docs/data-retention.md`; no scheduler is assumed to exist.

## Application

- `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- The current Next.js security release has been checked immediately before deployment.
- The web process and worker process are deployed separately.
- `/api/health` returns `200` from the live Lambda URL.
- An assigned shop user can sign in, view only that shop, and update an appointment status.
- The SQS event source is enabled with partial-batch failure reporting.
- A signed test webhook reaches SQS and produces one Supabase appointment.
- A declared or streamed webhook body larger than 64 KiB receives `413` and is
  not published.
- The customer receives one WhatsApp confirmation and the barber receives one email.
- A duplicate webhook does not create a second appointment.
- An occupied slot receives an unavailable response.
- A fourth future confirmed booking for one phone number and shop receives the
  active-booking-limit reply and creates no appointment.
- The dead-letter queue has an alarm and a named person responsible for checking it.

## Rotation and release

- Every Meta, Supabase, GitHub, AWS, and SES trust or credential has an owner and
  a rotation trigger. No secret values are stored in this checklist.
- A non-production rotation test confirmed that updating Secrets Manager and
  incrementing `ApplicationSecretVersion` refreshes each Lambda environment.
- `main` requires CI. Image-publish workflows are started only from `main`, and
  their recorded image digest is the digest passed to CloudFormation.
- Rollback uses a previously scanned image digest and does not change or reuse
  an immutable ECR tag.
