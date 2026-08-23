export interface SendWhatsAppTextInput {
  businessPhoneNumberId: string;
  customerPhoneNumber: string;
  text: string;
  signal?: AbortSignal;
}

export interface WhatsAppMessenger {
  sendText(input: SendWhatsAppTextInput): Promise<void>;
}

export class MetaWhatsAppMessenger implements WhatsAppMessenger {
  constructor(
    private readonly accessToken: string,
    private readonly graphApiVersion: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  async sendText(input: SendWhatsAppTextInput): Promise<void> {
    const response = await this.request(
      `https://graph.facebook.com/${this.graphApiVersion}/${encodeURIComponent(input.businessPhoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: input.customerPhoneNumber,
          type: "text",
          text: {
            preview_url: false,
            body: input.text,
          },
        }),
        signal: input.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Meta WhatsApp send failed with status ${response.status}.`);
    }
  }
}
