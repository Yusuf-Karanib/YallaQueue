# Worker infrastructure

`worker-service.yaml` prepares the long-running QueueCraft worker for AWS ECS Fargate. It is not deployed automatically.

Before deployment:

1. Build `Dockerfile.worker` and push an immutable image to Amazon ECR.
2. Deploy the QueueCraft infrastructure stack first.
3. Create one Secrets Manager JSON secret containing `SUPABASE_SERVICE_ROLE_KEY` and `META_ACCESS_TOKEN`.
4. Verify the SES sender email or domain.
5. Choose public subnets that route to an internet gateway. The worker has no inbound security-group rules.
6. Review the estimated Fargate, CloudWatch, SQS, DynamoDB, Secrets Manager, and SES costs.

The worker receives AWS permissions from its ECS task role. Do not put AWS access keys in the worker secret.

`Dockerfile.web` creates a portable standalone image for the Next.js webhook. The web and worker processes should be deployed separately.
