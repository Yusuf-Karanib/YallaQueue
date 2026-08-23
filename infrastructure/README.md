# Production infrastructure

The templates prepare separate web and worker services. They are not deployed automatically.

Deployment order:

1. Deploy `container-registry.yaml` to create immutable, scan-on-push ECR repositories.
2. Deploy QueueCraft's `infrastructure/cloudformation.yaml`, including an `AlarmEmail`.
3. Create one Secrets Manager JSON secret containing `META_VERIFY_TOKEN`, `META_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `META_ACCESS_TOKEN`.
4. Build `Dockerfile.web-lambda` and `Dockerfile.worker`, then push commit-tagged images to their ECR repositories.
5. Deploy `web-lambda.yaml` using the web image digest and QueueCraft producer outputs.
6. Verify the SES sender email or domain.
7. Deploy `worker-service.yaml` using the worker image digest and QueueCraft consumer outputs.
8. Pass QueueCraft's `AlarmTopicArn` to both application stacks.
9. Choose public subnets that route to an internet gateway. The worker has no inbound security-group rules.
10. Review the estimated Lambda, Fargate, CloudWatch, ECR, SQS, DynamoDB, Secrets Manager, SNS, and SES costs.

The webhook runs behind a stable Lambda Function URL and checks Meta's signature before publishing. Reserved concurrency limits unexpected usage. The worker runs continuously on ECS Fargate.

Both processes receive AWS permissions from execution roles. Do not put AWS access keys in the application secret. Updating a Secrets Manager value requires a CloudFormation update before Lambda receives the new value.

`Dockerfile.web` remains a portable local container. `Dockerfile.web-lambda` adds AWS's Lambda Web Adapter for the production webhook.
