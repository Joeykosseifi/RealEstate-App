export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Provider-independent mail abstraction. Business logic (verification,
 * password reset) depends only on this, never on a specific provider —
 * swap the binding in MailModule to add SendGrid/SES/etc. without
 * touching callers.
 */
export abstract class MailService {
  abstract send(message: MailMessage): Promise<void>;
}
