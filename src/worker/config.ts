import { z } from "zod";

const workerDependencyConfigSchema = z.object({
  AWS_REGION: z.string().trim().min(1),
  DYNAMODB_TABLE_NAME: z.string().trim().min(3),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().trim().min(20),
  META_ACCESS_TOKEN: z.string().trim().min(20),
  META_GRAPH_API_VERSION: z.string().trim().regex(/^v\d+\.\d+$/),
  SES_FROM_EMAIL: z.email(),
});

const workerConfigSchema = workerDependencyConfigSchema.extend({
  SQS_QUEUE_URL: z.url(),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(0).max(60_000).default(1_000),
  WORKER_WAIT_TIME_SECONDS: z.coerce.number().int().min(0).max(20).default(20),
  WORKER_VISIBILITY_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .min(10)
    .max(43_200)
    .default(60),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(3_600_000)
    .default(20_000),
});

export type WorkerConfig = z.infer<typeof workerConfigSchema>;
export type LambdaWorkerConfig = z.infer<typeof workerDependencyConfigSchema>;

function parseConfiguration<T>(
  schema: z.ZodType<T>,
  environment: Record<string, string | undefined>,
): T {
  const result = schema.safeParse(environment);

  if (!result.success) {
    const fields = [
      ...new Set(
        result.error.issues.map((issue) => issue.path.join(".") || "environment"),
      ),
    ];
    throw new Error(`Invalid worker configuration: ${fields.join(", ")}.`);
  }

  return result.data;
}

export function loadWorkerConfig(
  environment: Record<string, string | undefined>,
): WorkerConfig {
  const config = parseConfiguration(workerConfigSchema, environment);

  if (
    config.WORKER_HEARTBEAT_INTERVAL_MS >=
    config.WORKER_VISIBILITY_TIMEOUT_SECONDS * 1_000
  ) {
    throw new Error(
      "WORKER_HEARTBEAT_INTERVAL_MS must be shorter than the visibility timeout.",
    );
  }

  return config;
}

export function loadLambdaWorkerConfig(
  environment: Record<string, string | undefined>,
): LambdaWorkerConfig {
  return parseConfiguration(workerDependencyConfigSchema, environment);
}
