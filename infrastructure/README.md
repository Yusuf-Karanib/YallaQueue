# Production infrastructure

The templates prepare separate event-driven web and worker functions. They are not deployed automatically.

## Region

Use `eu-central-1` (Frankfurt) for the pilot. As of 2026-08-23, AWS still marks `me-central-1` (UAE) as disrupted and recommends moving workloads to another Region. Do not switch back until the AWS Health Dashboard and the account's Personal Health Dashboard confirm recovery, and the data-location decision has been reviewed.

Deployment order:

1. Deploy `container-registry.yaml` to create immutable, scan-on-push ECR repositories.
2. Deploy QueueCraft's `infrastructure/cloudformation.yaml`, including an `AlarmEmail`.
3. Create one Secrets Manager JSON secret containing `META_VERIFY_TOKEN`, `META_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `META_ACCESS_TOKEN`.
4. Build `Dockerfile.web-lambda` and `Dockerfile.worker-lambda` for `linux/amd64` with provenance disabled, then push commit-tagged images to their ECR repositories. Lambda requires a single-architecture image manifest.
5. Deploy `web-lambda.yaml` using the web image digest and QueueCraft producer outputs.
6. Verify the SES sender email or domain.
7. Deploy `worker-lambda.yaml` using the worker image digest and QueueCraft consumer outputs.
8. Pass QueueCraft's `AlarmTopicArn` to both application stacks.
9. Review the estimated Lambda, CloudWatch, ECR, SQS, DynamoDB, Secrets Manager, SNS, and SES costs.

The webhook runs behind a stable Lambda Function URL and checks Meta's signature before publishing. SQS starts the booking worker only when a job exists, so there is no continuously running server or public IPv4 charge.

Both processes receive AWS permissions from execution roles. Do not put AWS access keys in the application secret. After updating a Secrets Manager value, increment the corresponding stack's `ApplicationSecretVersion` parameter so Lambda receives the new value.

`Dockerfile.web` remains a portable local container. `Dockerfile.web-lambda` adds AWS's Lambda Web Adapter for the production webhook.

Build the deployable images with commands equivalent to:

```text
docker buildx build --platform linux/amd64 --provenance=false --file Dockerfile.web-lambda --tag WEB_REPOSITORY:COMMIT --push .
docker buildx build --platform linux/amd64 --provenance=false --file Dockerfile.worker-lambda --tag WORKER_REPOSITORY:COMMIT --push .
```

## Expected pilot cost

At low pilot traffic, the AWS portion should normally remain around `$0–$2 USD per month`. Lambda and SQS include large monthly free allowances, DynamoDB usage is tiny, and the main fixed AWS items are the application secret, alarms, logs, and small ECR images. This estimate excludes taxes, Meta WhatsApp charges, and an optional paid Supabase plan.

Supabase can start on the free plan, but free projects may pause after a week without activity. Upgrade only when the pilot needs guaranteed continuous database availability.
