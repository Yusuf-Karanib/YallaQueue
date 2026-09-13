# AWS deployment infrastructure

The templates prepare separate event-driven web and worker functions. They are
not deployed automatically and are not, by themselves, proof of production
readiness. QueueCraft's included queue stack is intentionally limited to
development and test environments; adapt and review it before using real
customer data.

## Region

The existing pilot configuration uses `eu-central-1` (Frankfurt). Before every
deployment, confirm the chosen Region in the AWS Health Dashboard and the
account's Personal Health Dashboard, then review latency, data-location, and
recovery requirements. A dated statement in this repository is not evidence
that a Region is currently healthy.

Deployment order:

1. Deploy `container-registry.yaml` to create immutable, scan-on-push ECR repositories.
2. Deploy `github-actions-ecr.yaml` if container images will be built by GitHub
   Actions instead of a trusted local machine. An AWS account can have only one
   provider for `token.actions.githubusercontent.com`. For a new YallaQueue
   stack, set `CreateGitHubOidcProvider=false` and pass the existing provider
   ARN when QueueCraft or another stack already created it. Keep the default
   `true` when this stack already owns the provider; changing an existing stack
   from `true` to `false` would remove its provider resource.
3. Deploy QueueCraft's `infrastructure/cloudformation.yaml`, including an `AlarmEmail`.
4. Create one Secrets Manager JSON secret containing `META_VERIFY_TOKEN`, `META_APP_SECRET`, `SUPABASE_SECRET_KEY`, and `META_ACCESS_TOKEN`.
5. Build `Dockerfile.web-lambda` and `Dockerfile.worker-lambda` for `linux/amd64` with provenance disabled, then push commit-tagged images to their ECR repositories. Lambda requires a single-architecture image manifest. The manual `Publish worker image` GitHub workflow can build the worker without permanent AWS credentials.
6. Deploy `web-lambda.yaml` using the web image digest, QueueCraft producer
   outputs, Supabase project URL, Supabase publishable key, and a measured
   `ReservedConcurrentExecutions` ceiling. The pilot default is five.
7. Verify the SES sender email or domain.
8. Deploy `worker-lambda.yaml` using the worker image digest and QueueCraft consumer outputs.
   The source SQS queue visibility timeout must be at least six times the
   worker Lambda timeout. With the template's 30-second worker timeout, use at
   least 180 seconds.
9. Pass QueueCraft's `AlarmTopicArn` to both application stacks.
10. Review the estimated Lambda, CloudWatch, ECR, SQS, DynamoDB, Secrets Manager, SNS, and SES costs.

The web stack always creates an error alarm. Supplying `AlarmTopicArn` sends
errors to that SNS topic and also creates a throttle alarm with the same
notification target. Without a topic, errors remain visible only in CloudWatch
and the optional throttle alarm and its output are omitted.

The webhook runs behind a stable public Lambda Function URL and checks Meta's
signature before publishing. The reserved-concurrency setting limits
simultaneous web execution, which helps contain compute growth and protects
account concurrency. It is not a request-rate limiter or a hard spending
budget; excess requests can receive `429` responses, and other AWS services can
still charge.

SQS starts Lambda worker compute only when a job exists, so there is no
continuously running worker server or public IPv4 charge. An idle system can
still incur charges for services such as Secrets Manager, provisioned DynamoDB,
CloudWatch alarms and stored logs, and ECR storage.

Both processes receive AWS permissions from execution roles. The public web
Lambda receives only the Supabase publishable key; the private worker Lambda
receives the Supabase service-role key. Do not put AWS access keys in the
application secret. After updating a Secrets Manager value, increment the
corresponding stack's `ApplicationSecretVersion` parameter so Lambda receives
the new value.

`Dockerfile.web` remains a portable local container. `Dockerfile.web-lambda` adds AWS's Lambda Web Adapter for the production webhook.

Build the deployable images with commands equivalent to:

```text
docker buildx build --platform linux/amd64 --provenance=false --file Dockerfile.web-lambda --tag WEB_REPOSITORY:COMMIT --push .
docker buildx build --platform linux/amd64 --provenance=false --file Dockerfile.worker-lambda --tag WORKER_REPOSITORY:COMMIT --push .
```

## Expected pilot cost

An earlier low-traffic pilot estimate was about `$0–$2 USD per month`, but that
is not a guarantee or a control. Pricing, free-tier eligibility, log volume,
image size, provisioned capacity, retries, and abusive traffic can change the
bill. The estimate excludes taxes, Meta WhatsApp charges, and any paid Supabase
plan. Set account budgets and alerts before deployment.

Supabase can start on the free plan, but free projects may pause after a week without activity. Upgrade only when the pilot needs guaranteed continuous database availability.

Complete [`../docs/aws-operations-checklist.md`](../docs/aws-operations-checklist.md)
and [`../docs/deployment-checklist.md`](../docs/deployment-checklist.md) before
using real customer data.
