import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import { IdempotencyStore, QueueCraftLambdaProcessor } from "queuecraft";
import { createBookingHandler } from "../booking/handler";
import { createSupabaseBookingRepository } from "../booking/repository";
import { SesBarberEmailNotifier } from "../notifications/email";
import { MetaWhatsAppMessenger } from "../notifications/whatsapp";
import { loadLambdaWorkerConfig } from "./config";
import { createLambdaWorkerHandler } from "./lambda-handler";

const config = loadLambdaWorkerConfig(process.env);
const dynamodb = new DynamoDBClient({ region: config.AWS_REGION });
const ses = new SESv2Client({ region: config.AWS_REGION });
const repository = createSupabaseBookingRepository(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
);
const whatsapp = new MetaWhatsAppMessenger(
  config.META_ACCESS_TOKEN,
  config.META_GRAPH_API_VERSION,
);
const email = new SesBarberEmailNotifier(ses, config.SES_FROM_EMAIL);
const bookingHandler = createBookingHandler({ repository, whatsapp, email });

const processor = new QueueCraftLambdaProcessor({
  idempotency: new IdempotencyStore({
    client: dynamodb,
    tableName: config.DYNAMODB_TABLE_NAME,
    leaseDurationSeconds: 60,
  }),
  handler: bookingHandler,
  concurrency: 2,
  onError(error, record) {
    console.error("YallaQueue Lambda worker error.", {
      sqsMessageId: record?.messageId,
      error: error instanceof Error ? error.message : "Unknown worker error",
    });
  },
});

export const handler = createLambdaWorkerHandler(processor);
