import { Resend } from "resend";
import type { EmailService, SendEmailInput } from "./types";

/**
 * Production email service backed by Resend. Accepts the unified
 * `SendEmailInput` shape (subject + html + text + optional attachments).
 *
 * `replyTo` is applied to every outbound send so customer replies route
 * to a real inbox even though we send 'from' the brand alias (which is
 * not a real mailbox on its own). Wired from RESEND_REPLY_TO in env.
 */
export class ResendEmailService implements EmailService {
  private client: Resend;
  private from: string;
  private replyTo: string | undefined;

  constructor(apiKey: string, from: string, replyTo?: string) {
    this.client = new Resend(apiKey);
    this.from = from;
    this.replyTo = replyTo;
  }

  async send(input: SendEmailInput): Promise<{ id: string }> {
    const result = await this.client.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: this.replyTo,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });
    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }
    return { id: result.data!.id };
  }
}
