# AWS operations checklist

Complete this before production and review it after any account, repository, or
staff change. Record owners, dates, and decisions in the approved operations
system. Never put passwords, tokens, customer data, private keys, or secret
values in this file.

## Account security

- Protect the AWS root user with hardware-backed MFA, do not create a root
  access key, and reserve root for account recovery tasks.
- Give people short-lived access through IAM Identity Center or an equivalent
  federation system. Remove unused identities and do not share accounts.
- Enable an organization trail or account CloudTrail trail, protect its storage,
  and assign owners for security findings and sign-in alerts.
- Set current security, billing, and operations contacts.
- Keep the GitHub OIDC trust limited to the expected audience, `main`, and the
  numeric GitHub owner and repository IDs. Reuse the account's existing GitHub
  provider; creating a second provider with the same URL will fail.
- Treat the web Function URL as public. Keep Meta signature verification on,
  monitor rejected requests, and add a suitable edge rate-limiting layer if the
  measured abuse risk exceeds what reserved concurrency can contain.

## Credential rotation

- Maintain an inventory for the Meta verify token, Meta app secret, Meta access
  token, Supabase service-role key, GitHub trusts, SES identity, and any human
  access. Record the owner and rotation trigger, not the value.
- Prefer roles and OIDC over AWS access keys. Remove unused keys and rotate any
  unavoidable key through the system that owns it.
- Test rotation in non-production. After a Secrets Manager update, increment
  the affected stack's `ApplicationSecretVersion` so CloudFormation refreshes
  the Lambda environment.
- Revoke and rotate immediately after suspected disclosure, staff departure,
  repository ownership change, or unexpected authentication activity.

## Cost and overload controls

- Create an AWS Budget with multiple alert thresholds and at least two suitable
  recipients. Enable cost-anomaly monitoring and review spend on a fixed
  schedule.
- Tag resources with project, environment, and owner. Include retained and
  manually created resources in teardown reviews.
- Leave reserved concurrency at zero when the account quota cannot support a
  function reservation. After raising the quota, enable a measured value and
  test overload handling. Alarm on Lambda throttles and errors. Reserved
  concurrency is not a request budget.
- Estimate Secrets Manager, provisioned DynamoDB, CloudWatch alarms and logs,
  ECR storage and scanning, SQS retries, SNS, SES, data transfer, and any edge
  service. An idle worker does not make these costs zero.
- Review service quotas and overload behavior. Confirm that webhook retries,
  queue growth, and DLQ redrive cannot create an uncontrolled loop.

## AWS retention and recovery

- Confirm the intended 30-day Lambda log retention. The templates retain log
  groups when stacks are deleted, so assign an owner to review or remove them.
- Confirm ECR lifecycle rules: untagged images expire after seven days and only
  the newest ten images are kept. Keep enough known-good digests for the agreed
  rollback window.
- Choose SQS and DLQ retention from the incident-response window and assign a
  DLQ owner. Test replay without exposing message bodies.
- Decide whether QueueCraft's DynamoDB table needs point-in-time recovery,
  backups, deletion protection, on-demand capacity, or retained data. Test a
  restore rather than assuming a backup is usable.
- Set a recovery window and deletion process for Secrets Manager. Inventory ECR
  repositories and other resources retained after CloudFormation teardown.
- Write and test rollback, backup restore, credential compromise, provider
  outage, and Region failure procedures. Record recovery-time and recovery-point
  targets.
