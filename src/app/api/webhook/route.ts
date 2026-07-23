import { NextRequest, NextResponse } from "next/server";
import { SQSClient } from "@aws-sdk/client-sqs";
import { QueueCraftPublisher } from "queuecraft";
import crypto from "node:crypto";

// AWS SDK + node:crypto require the Node.js runtime (not Edge).
export const runtime = "nodejs";

/**
 * Publisher is memoized across warm invocations so we reuse one SQS connection
 * pool instead of reconnecting per request.
 */
let publisher: QueueCraftPublisher | null = null;
function getPublisher(): QueueCraftPublisher {
  if (!publisher) {
    const queueUrl = process.env.SQS_QUEUE_URL;
    if (!queueUrl) {
      throw new Error("SQS_QUEUE_URL is not configured.");
    }
    publisher = new QueueCraftPublisher({
      sqsClient: new SQSClient({ region: process.env.AWS_REGION }),
      queueUrl,
    });
  }
  return publisher;
}

interface Booking {
  phoneNumber: string;
  requestedTime: string;
  waMessageId?: string;
}

/** Pull the sender's number and requested time out of a WhatsApp webhook. */
function extractBooking(payload: unknown): Booking | null {
  const value = (payload as any)?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  // Delivery/read receipts and other events carry no `messages` array.
  if (!message) return null;

  const phoneNumber: string | undefined =
    message.from ?? value?.contacts?.[0]?.wa_id;

  const requestedTime = extractText(message);
  if (!phoneNumber || !requestedTime) return null;

  return { phoneNumber, requestedTime, waMessageId: message.id };
}

/** Booking time from a free-text message or an interactive reply. */
function extractText(message: any): string | undefined {
  if (message.type === "text") {
    return message.text?.body?.trim() || undefined;
  }
  if (message.type === "interactive") {
    const i = message.interactive;
    const label = i?.button_reply?.title ?? i?.list_reply?.title;
    return (label as string | undefined)?.trim() || undefined;
  }
  return undefined;
}

/**
 * Verify Meta's `X-Hub-Signature-256` HMAC so we only accept genuine webhook
 * calls. Skipped only when no secret is configured (e.g. local dev).
 */
function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true;
  if (!header) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const received = Buffer.from(header);
  const digest = Buffer.from(expected);

  return (
    received.length === digest.length &&
    crypto.timingSafeEqual(received, digest)
  );
}

/**
 * Meta webhook verification handshake. Called once when you register the
 * callback URL: Meta sends a challenge we must echo back verbatim, but only
 * if the mode is "subscribe" and the verify token matches ours.
 */
export function GET(req: NextRequest): NextResponse {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Read the raw body once — the signature check needs the exact bytes.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!verifySignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // --- Debug logging -------------------------------------------------------
  // Gated so production logs don't accumulate customer phone numbers.
  // Set WEBHOOK_DEBUG=true in Replit to see traffic; leave unset in prod.
  const debug = process.env.WEBHOOK_DEBUG === "true";

  if (debug) {
    console.log(
      "[webhook] raw payload:\n" + JSON.stringify(payload, null, 2),
    );
  }

  const booking = extractBooking(payload);

  if (debug) {
    console.log("[webhook] extracted booking:", booking);
  }

  // Nothing actionable (status update, unsupported message type). Acknowledge
  // with 200 so Meta doesn't retry a webhook there's nothing to do about.
  if (!booking) {
    if (debug) {
      console.log(
        "[webhook] no actionable message — likely a status/receipt event.",
      );
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    const result = await getPublisher().publish({
      type: "booking_request",
      phoneNumber: booking.phoneNumber,
      requestedTime: booking.requestedTime,
      waMessageId: booking.waMessageId,
      receivedAt: Date.now(),
    });
    if (debug) {
      console.log("[webhook] published to SQS:", result);
    }
  } catch (err) {
    // Log full detail server-side; never surface AWS/internal specifics to Meta.
    // Returning non-200 asks Meta to redeliver, so a transient SQS failure
    // doesn't drop the booking.
    console.error("QueueCraft publish failed:", err);
    return NextResponse.json(
      { ok: false, error: "Unable to process booking right now." },
      { status: 502 },
    );
  }

  // Enqueued. Return 200 immediately so Meta's webhook doesn't time out; the
  // slow work (availability check, confirmation reply) runs in the SQS worker.
  return NextResponse.json({ ok: true }, { status: 200 });
}