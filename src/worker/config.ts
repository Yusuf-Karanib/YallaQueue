import { z } from "zod";

const workerConfigSchema = z.object({
  AWS_REGION: z.string().trim().min(1),
  SQS_QUEUE_URL: z.url(),
  DYNAMODB_TABLE_NAME: z.string().trim().min(3),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(20),
  META_ACCESS_TOKEN: z.string().trim().min(20),
  META_GRAPH_API_VERSION: z.string().trim().regex(/^v\d+\.\d+$/),
  SES_FROM_EMAIL: z.email(),
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

export function loadWorkerConfig(
  environment: Record<string, string | undefined>,
): WorkerConfig {
  const result = workerConfigSchema.safeParse(environment);

  if (!result.success) {
    const fields = [
      ...new Set(
        result.error.issues.map((issue) => issue.path.join(".") || "environment"),
      ),
    ];
    throw new Error(`Invalid worker configuration: ${fields.join(", ")}.`);
  }

  if (
    result.data.WORKER_HEARTBEAT_INTERVAL_MS >=
    result.data.WORKER_VISIBILITY_TIMEOUT_SECONDS * 1_000
  ) {
    throw new Error(
      "WORKER_HEARTBEAT_INTERVAL_MS must be shorter than the visibility timeout.",
    );
  }

  return result.data;
}
