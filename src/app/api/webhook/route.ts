import { NextRequest, NextResponse } from "next/server";
import { SQSClient } from "@aws-sdk/client-sqs";
import { QueueCraftPublisher } from "@yusufkaranib/queuecraft";
import {
  extractBookingRequests,
  verifyMetaSignature,
} from "../../../lib/whatsapp-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

class WebhookBodyTooLargeError extends Error {}
class InvalidContentLengthError extends Error {}

async function readWebhookBody(req: NextRequest): Promise<Uint8Array> {
  const contentLength = req.headers.get("content-length");

  if (contentLength !== null) {
    const normalizedLength = contentLength.trim();
    if (!/^\d+$/.test(normalizedLength)) {
      throw new InvalidContentLengthError();
    }

    const declaredBytes = Number(normalizedLength);
    if (
      !Number.isSafeInteger(declaredBytes) ||
      declaredBytes > MAX_WEBHOOK_BODY_BYTES
    ) {
      throw new WebhookBodyTooLargeError();
    }
  }

  if (!req.body) {
    return new Uint8Array();
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_WEBHOOK_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new WebhookBodyTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

let publisher: QueueCraftPublisher | null = null;

function getPublisher(): QueueCraftPublisher {
  if (!publisher) {
    const queueUrl = process.env.SQS_QUEUE_URL;

    if (!queueUrl) {
      throw new Error("SQS_QUEUE_URL is not configured.");
    }

    publisher = new QueueCraftPublisher({
      sqsClient: new SQSClient({
        region: process.env.AWS_REGION,
      }),
      queueUrl,
    });
  }

  return publisher;
}

export function GET(req: NextRequest): NextResponse {
  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error("META_VERIFY_TOKEN is not configured.");
    return new NextResponse("Server configuration error", {
      status: 500,
    });
  }

  const params = req.nextUrl.searchParams;

  const mode = params.get("hub.mode");
  const receivedToken = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  console.log("Webhook verification request:", {
    mode,
    hasToken: receivedToken !== null,
    hasChallenge: challenge !== null,
  });

  if (
    mode === "subscribe" &&
    receivedToken === verifyToken &&
    challenge !== null
  ) {
    console.log("Webhook verification successful.");

    return new NextResponse(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  console.error("Webhook verification failed.");

  return new NextResponse("Forbidden", {
    status: 403,
  });
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse> {
  let rawBodyBytes: Uint8Array;

  try {
    rawBodyBytes = await readWebhookBody(req);
  } catch (error) {
    if (error instanceof WebhookBodyTooLargeError) {
      return NextResponse.json(
        { ok: false, error: "Webhook body is too large." },
        { status: 413 },
      );
    }

    if (error instanceof InvalidContentLengthError) {
      return NextResponse.json(
        { ok: false, error: "Invalid Content-Length header." },
        { status: 400 },
      );
    }

    console.error("Unable to read webhook body:", error);

    return NextResponse.json(
      { ok: false, error: "Unable to read request body." },
      { status: 400 },
    );
  }

  let rawBody: string;
  try {
    rawBody = new TextDecoder("utf-8", { fatal: true }).decode(rawBodyBytes);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Webhook body must be valid UTF-8." },
      { status: 400 },
    );
  }

  if (!rawBody.trim()) {
    console.error("Webhook body was completely empty.");

    return NextResponse.json(
      { ok: false, error: "Empty body." },
      { status: 400 },
    );
  }

  const signatureHeader = req.headers.get("x-hub-signature-256");
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    console.error("META_APP_SECRET is not configured.");
    return NextResponse.json(
      { ok: false, error: "Server configuration error." },
      { status: 500 },
    );
  }

  if (!verifyMetaSignature(rawBodyBytes, signatureHeader, appSecret)) {
    console.error("Webhook signature verification failed.");

    return NextResponse.json(
      { ok: false, error: "Invalid signature." },
      { status: 401 },
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error("Webhook contained invalid JSON:", error);

    return NextResponse.json(
      { ok: false, error: "Invalid JSON." },
      { status: 400 },
    );
  }

  const bookings = extractBookingRequests(payload);

  // This could be a valid status update instead of an incoming message.
  if (bookings.length === 0) {
    console.log("No supported incoming booking message was found.");

    return NextResponse.json(
      { ok: true },
      { status: 200 },
    );
  }

  try {
    const receivedAt = Date.now();

    await Promise.all(
      bookings.map((booking) =>
        getPublisher().publish(
          {
            type: "booking_request",
            businessPhoneNumberId: booking.businessPhoneNumberId,
            customerPhoneNumber: booking.customerPhoneNumber,
            messageText: booking.messageText,
            waMessageId: booking.waMessageId,
            receivedAt,
          },
          { idempotencyKey: booking.waMessageId },
        ),
      ),
    );

    console.log("Published WhatsApp booking messages to AWS SQS.", {
      count: bookings.length,
    });
  } catch (error) {
    console.error("QueueCraft publish failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to process booking right now.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { ok: true },
    { status: 200 },
  );
}
