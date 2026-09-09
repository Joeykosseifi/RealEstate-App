import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { ApiEnv } from '../config/env';
import { MailService, type MailMessage } from './mail.service';

/**
 * Real email delivery via any SMTP server/relay — Gmail (with an app
 * password), Amazon SES's SMTP endpoint, SendGrid/Mailgun/Postmark's SMTP
 * relay, or a private company mail server all work through this one
 * implementation, since they all speak SMTP. Selected with
 * EMAIL_PROVIDER=smtp (see MailModule).
 *
 * SMTP_HOST/SMTP_USER/SMTP_PASSWORD are validated here — at construction
 * — rather than in the Zod env schema, so they stay optional for every
 * deployment still using the 'console' default. Choosing EMAIL_PROVIDER=
 * smtp without them fails loudly at boot rather than silently dropping
 * mail later.
 */
@Injectable()
export class SmtpMailProvider implements MailService {
  private readonly logger = new Logger('MailService');
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(configService: ConfigService<ApiEnv, true>) {
    const host = configService.get('SMTP_HOST', { infer: true });
    const user = configService.get('SMTP_USER', { infer: true });
    const password = configService.get('SMTP_PASSWORD', { infer: true });

    if (!host || !user || !password) {
      throw new Error(
        'EMAIL_PROVIDER=smtp requires SMTP_HOST, SMTP_USER, and SMTP_PASSWORD to be set.',
      );
    }

    this.from = configService.get('SMTP_FROM', { infer: true }) || user;
    this.transporter = createTransport({
      host,
      port: configService.get('SMTP_PORT', { infer: true }),
      secure: configService.get('SMTP_SECURE', { infer: true }),
      auth: { user, pass: password },
    });
  }

  async send(message: MailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    } catch (error) {
      // Never throw into the caller (EmailVerificationService /
      // PasswordResetService) — a transient SMTP failure must not fail
      // registration itself, nor let a caller probing "resend" for an
      // unregistered address distinguish a delivery failure from the
      // deliberate "always 204" no-op. Logged server-side so a real
      // outage is still visible to an operator.
      this.logger.error(
        `Failed to send email to ${message.to}: ${(error as Error).message}`,
      );
    }
  }
}
