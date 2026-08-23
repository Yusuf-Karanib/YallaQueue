import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
}));

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn(),
}));

vi.mock("queuecraft", () => ({
  QueueCraftPublisher: vi.fn().mockImplementation(() => ({
    publish: mocks.publish,
  })),
}));

const appSecret = "test-app-secret";

function signedRequest(payload: unknown): NextRequest {
  const rawBody = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  return new NextRequest("http://localhost/api/webhook", {
    method: "POST",
    body: rawBody,
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${signature}`,
    },
  });
}

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

beforeEach(() => {
  mocks.publish.mockReset();
  mocks.publish.mockResolvedValue({ messageId: "sqs-message-id" });
  process.env.META_VERIFY_TOKEN = "verify-me";
  process.env.META_APP_SECRET = appSecret;
  process.env.SQS_QUEUE_URL = "https://sqs.example.test/queue";
  process.env.AWS_REGION = "me-central-1";
});

describe("WhatsApp webhook", () => {
  it("answers Meta's valid verification challenge", async () => {
    const { GET } = await loadRoute();
    const request = new NextRequest(
      "http://localhost/api/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345",
    );

    const response = GET(request);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("12345");
  });

  it("rejects a POST with an invalid Meta signature", async () => {
    const { POST } = await loadRoute();
    const request = new NextRequest("http://localhost/api/webhook", {
      method: "POST",
      body: JSON.stringify({ entry: [] }),
      headers: { "x-hub-signature-256": "sha256=not-valid" },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("publishes every supported message with Meta's ID as the stable key", async () => {
    const { POST } = await loadRoute();
    const request = signedRequest({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "971500000000" }],
                messages: [
                  {
                    id: "wamid.text-1",
                    from: "971511111111",
                    type: "text",
                    text: { body: "Tomorrow at 3 PM" },
                  },
                  {
                    id: "wamid.list-2",
                    type: "interactive",
                    interactive: {
                      list_reply: { title: "Sunday at 10 AM" },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledTimes(2);
    expect(mocks.publish).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        phoneNumber: "971511111111",
        requestedTime: "Tomorrow at 3 PM",
        waMessageId: "wamid.text-1",
      }),
      { idempotencyKey: "wamid.text-1" },
    );
    expect(mocks.publish).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        phoneNumber: "971500000000",
        requestedTime: "Sunday at 10 AM",
        waMessageId: "wamid.list-2",
      }),
      { idempotencyKey: "wamid.list-2" },
    );
  });

  it("accepts a valid status callback without publishing a job", async () => {
    const { POST } = await loadRoute();
    const request = signedRequest({
      entry: [{ changes: [{ value: { statuses: [{ id: "wamid.sent" }] } }] }],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});
