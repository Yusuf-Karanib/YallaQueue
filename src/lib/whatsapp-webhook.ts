import crypto from "node:crypto";

type JsonObject = Record<string, unknown>;

export interface BookingRequest {
  businessPhoneNumberId: string;
  customerPhoneNumber: string;
  messageText: string;
  waMessageId: string;
}

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim() || undefined;
}

function extractMessageText(message: JsonObject): string | undefined {
  const messageType = nonEmptyString(message.type);

  if (messageType === "text") {
    return nonEmptyString(asObject(message.text)?.body);
  }

  if (messageType !== "interactive") {
    return undefined;
  }

  const interactive = asObject(message.interactive);
  const buttonReply = asObject(interactive?.button_reply);
  const listReply = asObject(interactive?.list_reply);

  return (
    nonEmptyString(buttonReply?.title) ?? nonEmptyString(listReply?.title)
  );
}

export function extractBookingRequests(payload: unknown): BookingRequest[] {
  const root = asObject(payload);
  const bookings: BookingRequest[] = [];
  const seenMessageIds = new Set<string>();

  for (const entryValue of asArray(root?.entry)) {
    const entry = asObject(entryValue);

    for (const changeValue of asArray(entry?.changes)) {
      const change = asObject(changeValue);
      const value = asObject(change?.value);
      const metadata = asObject(value?.metadata);
      const businessPhoneNumberId = nonEmptyString(metadata?.phone_number_id);
      const firstContact = asObject(asArray(value?.contacts)[0]);
      const contactPhoneNumber = nonEmptyString(firstContact?.wa_id);

      for (const messageValue of asArray(value?.messages)) {
        const message = asObject(messageValue);

        if (!message) {
          continue;
        }

        const waMessageId = nonEmptyString(message.id);
        const customerPhoneNumber =
          nonEmptyString(message.from) ?? contactPhoneNumber;
        const messageText = extractMessageText(message);

        if (
          !businessPhoneNumberId ||
          !waMessageId ||
          !customerPhoneNumber ||
          !messageText ||
          seenMessageIds.has(waMessageId)
        ) {
          continue;
        }

        seenMessageIds.add(waMessageId);
        bookings.push({
          businessPhoneNumberId,
          customerPhoneNumber,
          messageText,
          waMessageId,
        });
      }
    }
  }

  return bookings;
}

export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const receivedHex = signatureHeader.slice("sha256=".length);

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
