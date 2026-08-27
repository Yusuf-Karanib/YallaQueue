import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import { SQSClient } from "@aws-sdk/client-sqs";
import {
  IdempotencyStore,
  QueueCraftPoller,
  Semaphore,
} from "queuecraft";
import { createBookingHandler } from "../booking/handler";
import { createSupabaseBookingRepository } from "../booking/repository";
import { SesBarberEmailNotifier } from "../notifications/email";
import { MetaWhatsAppMessenger } from "../notifications/whatsapp";
import { loadWorkerConfig } from "./config";

const config = loadWorkerConfig(process.env);
const sqs = new SQSClient({ region: config.AWS_REGION });
const dynamodb = new DynamoDBClient({ region: config.AWS_REGION });
const ses = new SESv2Client({ region: config.AWS_REGION });

const repository = createSupabaseBookingRepository(
  config.SUPABASE_URL,
  config.SUPABASE_SECRET_KEY,
);
const whatsapp = new MetaWhatsAppMessenger(
  config.META_ACCESS_TOKEN,
  config.META_GRAPH_API_VERSION,
);
const email = new SesBarberEmailNotifier(ses, config.SES_FROM_EMAIL);
const handler = createBookingHandler({ repository, whatsapp, email });

const poller = new QueueCraftPoller({
  sqsClient: sqs,
  queueUrl: config.SQS_QUEUE_URL,
  semaphore: new Semaphore(config.WORKER_CONCURRENCY),
  idempotency: new IdempotencyStore({
    client: dynamodb,
    tableName: config.DYNAMODB_TABLE_NAME,
    leaseDurationSeconds: config.WORKER_VISIBILITY_TIMEOUT_SECONDS,
  }),
  handler,
  worker: {
    concurrency: config.WORKER_CONCURRENCY,
    pollIntervalMs: config.WORKER_POLL_INTERVAL_MS,
    waitTimeSeconds: config.WORKER_WAIT_TIME_SECONDS,
    visibilityTimeoutSeconds: config.WORKER_VISIBILITY_TIMEOUT_SECONDS,
    heartbeatIntervalMs: config.WORKER_HEARTBEAT_INTERVAL_MS,
  },
  onError(error, message) {
    console.error("YallaQueue worker error.", {
      sqsMessageId: message?.MessageId,
      error: error instanceof Error ? error.message : "Unknown worker error",
    });
  },
});

let shutdownStarted = false;

async function shutdown(signal: string): Promise<void> {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  console.log("Stopping YallaQueue worker.", { signal });
  await poller.stop();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

console.log("YallaQueue worker started.");
try {
  await poller.start();
} finally {
  sqs.destroy();
  dynamodb.destroy();
  ses.destroy();
}
