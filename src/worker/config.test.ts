import { describe, expect, it } from "vitest";
import { loadLambdaWorkerConfig, loadWorkerConfig } from "./config";

const validEnvironment = {
  AWS_REGION: "me-central-1",
  SQS_QUEUE_URL: "https://sqs.me-central-1.amazonaws.com/123/jobs",
  DYNAMODB_TABLE_NAME: "queuecraft-jobs",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test-value-long-enough",
  META_ACCESS_TOKEN: "meta-access-token-value",
  META_GRAPH_API_VERSION: "v25.0",
  SES_FROM_EMAIL: "bookings@example.com",
};

describe("loadWorkerConfig", () => {
  it("loads safe worker defaults", () => {
    const config = loadWorkerConfig(validEnvironment);

    expect(config.WORKER_CONCURRENCY).toBe(5);
    expect(config.WORKER_VISIBILITY_TIMEOUT_SECONDS).toBe(60);
    expect(config.WORKER_HEARTBEAT_INTERVAL_MS).toBe(20_000);
  });

  it("loads Lambda dependencies without long-poller settings", () => {
    const lambdaEnvironment: Record<string, string> = { ...validEnvironment };
    delete lambdaEnvironment.SQS_QUEUE_URL;
    const config = loadLambdaWorkerConfig(lambdaEnvironment);

    expect(config.AWS_REGION).toBe("me-central-1");
    expect(config).not.toHaveProperty("WORKER_CONCURRENCY");
  });

  it("reports missing field names without exposing secret values", () => {
    expect(() =>
      loadWorkerConfig({
        ...validEnvironment,
        META_ACCESS_TOKEN: "short",
      }),
    ).toThrow("META_ACCESS_TOKEN");
  });

  it("requires the heartbeat to be shorter than message visibility", () => {
    expect(() =>
      loadWorkerConfig({
        ...validEnvironment,
        WORKER_VISIBILITY_TIMEOUT_SECONDS: "10",
        WORKER_HEARTBEAT_INTERVAL_MS: "10000",
      }),
    ).toThrow("must be shorter");
  });
});
