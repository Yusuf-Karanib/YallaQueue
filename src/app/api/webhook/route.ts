import { NextRequest, NextResponse } from "next/server";
import { SQSClient } from "@aws-sdk/client-sqs";
import { QueueCraftPublisher } from "queuecraft";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

interface Booking {
  phoneNumber: string;
  requestedTime: string;
  waMessageId?: string;
}

function extractBooking(payload: unknown): Booking | null {
  const value = (payload as any)?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  // Valid status webhooks may not contain an incoming message.
  if (!message) {
    return null;
  }

  const phoneNumber: string | undefined =
    message.from ?? value?.contacts?.[0]?.wa_id;

  const requestedTime = extractText(message);

  if (!phoneNumber || !requestedTime) {
    return null;
  }

  return {
    phoneNumber,
    requestedTime,
    waMessageId: message.id,
  };
}

function extractText(message: any): string | undefined {
  if (message.type === "text") {
    return message.text?.body?.trim() || undefined;
  }

  if (message.type === "interactive") {
    const interactive = message.interactive;

    const label =
      interactive?.button_reply?.title ??
      interactive?.list_reply?.title;

    return typeof label === "string"
      ? label.trim() || undefined
      : undefined;
  }

  return undefined;
}

function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    throw new Error("META_APP_SECRET is not configured.");
  }

  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const receivedHex = signatureHeader.slice("sha256=".length);

  // A SHA-256 hexadecimal digest must contain exactly 64 hex characters.
  if (!/^[a-f0-9]{64}$/i.test(receivedHex)) {
    return false;
  }

  const expectedDigest = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest();

  const receivedDigest = Buffer.from(receivedHex, "hex");

  return (
    receivedDigest.length === expectedDigest.length &&
    crypto.timingSafeEqual(receivedDigest, expectedDigest)
  );
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
  let rawBody: string;

  try {
    rawBody = await req.text();
  } catch (error) {
    console.error("Unable to read webhook body:", error);

    return NextResponse.json(
      { ok: false, error: "Unable to read request body." },
      { status: 400 },
    );
  }

  const signatureHeader = req.headers.get("x-hub-signature-256");

  console.log("--- WEBHOOK POST RECEIVED ---");
  console.log("Request information:", {
    contentType: req.headers.get("content-type"),
    contentLength: req.headers.get("content-length"),
    userAgent: req.headers.get("user-agent"),
    hasMetaSignature: Boolean(signatureHeader),
    bodyLength: Buffer.byteLength(rawBody, "utf8"),
  });

  console.log("RAW BODY:", rawBody);

  if (!rawBody.trim()) {
    console.error("Webhook body was completely empty.");

    return NextResponse.json(
      { ok: false, error: "Empty body." },
      { status: 400 },
    );
  }

  let validSignature: boolean;

  try {
    validSignature = verifySignature(rawBody, signatureHeader);
  } catch (error) {
    console.error("Signature configuration error:", error);

    return NextResponse.json(
      { ok: false, error: "Server configuration error." },
      { status: 500 },
    );
  }

  if (!validSignature) {
    console.error(
      "Signature verification failed. Check META_APP_SECRET and request headers.",
    );

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

  const booking = extractBooking(payload);

  console.log("EXTRACTED BOOKING DATA:", booking);

  // This could be a valid status update instead of an incoming message.
  if (!booking) {
    console.log("No supported incoming booking message was found.");

    return NextResponse.json(
      { ok: true },
      { status: 200 },
    );
  }

  try {
    await getPublisher().publish({
      type: "booking_request",
      phoneNumber: booking.phoneNumber,
      requestedTime: booking.requestedTime,
      waMessageId: booking.waMessageId,
      receivedAt: Date.now(),
    });

    console.log("Successfully published booking to AWS SQS.");
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