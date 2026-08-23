import {
  SendEmailCommand,
  type SESv2Client,
} from "@aws-sdk/client-sesv2";

export interface BarberBookingEmail {
  to: string;
  shopName: string;
  queueNumber: number;
  scheduledTime: string;
  signal?: AbortSignal;
}

export interface BarberEmailNotifier {
  sendBooking(input: BarberBookingEmail): Promise<void>;
}

export class SesBarberEmailNotifier implements BarberEmailNotifier {
  constructor(
    private readonly client: SESv2Client,
    private readonly fromEmail: string,
  ) {}

  async sendBooking(input: BarberBookingEmail): Promise<void> {
    const subject = `New YallaQueue booking #${input.queueNumber}`;
    const body = [
      `A new appointment was confirmed for ${input.shopName}.`,
      "",
      `Queue number: ${input.queueNumber}`,
      `Arrival time: ${input.scheduledTime}`,
    ].join("\n");

    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.fromEmail,
        Destination: { ToAddresses: [input.to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: { Text: { Data: body, Charset: "UTF-8" } },
          },
        },
      }),
      { abortSignal: input.signal },
    );
  }
}
