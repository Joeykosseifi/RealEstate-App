/**
 * Provider-independent SMS abstraction, mirroring MailService. Business
 * logic (phone OTP) depends only on this.
 */
export abstract class SmsService {
  abstract send(toPhone: string, body: string): Promise<void>;
}
