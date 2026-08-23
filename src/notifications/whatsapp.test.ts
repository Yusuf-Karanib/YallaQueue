import { describe, expect, it, vi } from "vitest";
import { MetaWhatsAppMessenger } from "./whatsapp";

describe("MetaWhatsAppMessenger", () => {
  it("sends a WhatsApp text through the configured Graph API version", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    const messenger = new MetaWhatsAppMessenger(
      "secret-access-token",
      "v25.0",
      request,
    );

    await messenger.sendText({
      businessPhoneNumberId: "business-1",
      customerPhoneNumber: "971501234567",
      text: "Your booking is confirmed.",
    });

    expect(request).toHaveBeenCalledTimes(1);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe(
      "https://graph.facebook.com/v25.0/business-1/messages",
    );
    expect(options?.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer secret-access-token" }),
    );
    expect(JSON.parse(String(options?.body))).toEqual(
      expect.objectContaining({
        messaging_product: "whatsapp",
        to: "971501234567",
        type: "text",
      }),
    );
  });

  it("fails the job when Meta rejects the message", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 400 }),
    );
    const messenger = new MetaWhatsAppMessenger(
      "secret-access-token",
      "v25.0",
      request,
    );

    await expect(
      messenger.sendText({
        businessPhoneNumberId: "business-1",
        customerPhoneNumber: "971501234567",
        text: "Your booking is confirmed.",
      }),
    ).rejects.toThrow("status 400");
  });
});
