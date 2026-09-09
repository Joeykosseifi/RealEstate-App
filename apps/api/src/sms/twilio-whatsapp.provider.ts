import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import type { ApiEnv } from '../config/env';
import { SmsService } from './sms.service';

type TwilioClient = ReturnType<typeof twilio>;

/**
 * Real phone-verification delivery via Twilio's WhatsApp Business API —
 * WhatsApp is the preferred channel over plain SMS per product decision.
 * Selected with SMS_PROVIDER=twilio-whatsapp (see SmsModule). Requires an
 * approved WhatsApp sender — Twilio's sandbox number for testing, or a
 * real Business-approved number in production — see TWILIO_WHATSAPP_FROM.
 *
 * TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM are validated
 * here — at construction — rather than in the Zod env schema, so they
 * stay optional for every deployment still using the 'console' default.
 * Choosing SMS_PROVIDER=twilio-whatsapp without them fails loudly at
 * boot rather than silently dropping messages later.
 */
@Injectable()
export class TwilioWhatsAppProvider implements SmsService {
  private readonly logger = new Logger('SmsService');
  private readonly client: TwilioClient;
  private readonly from: string;

  constructor(configService: ConfigService<ApiEnv, true>) {
    const accountSid = configService.get('TWILIO_ACCOUNT_SID', { infer: true });
    const authToken = configService.get('TWILIO_AUTH_TOKEN', { infer: true });
    const from = configService.get('TWILIO_WHATSAPP_FROM', { infer: true });

    if (!accountSid || !authToken || !from) {
      throw new Error(
        'SMS_PROVIDER=twilio-whatsapp requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM to be set.',
      );
    }

    this.from = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
    this.client = twilio(accountSid, authToken);
  }

  async send(toPhone: string, body: string): Promise<void> {
    try {
      await this.client.messages.create({
        from: this.from,
        to: `whatsapp:${toPhone}`,
        body,
      });
    } catch (error) {
      // Never throw into the caller — same rationale as SmtpMailProvider:
      // a transient delivery failure must not fail registration/login,
      // nor let a caller probing "resend"/"request-otp" distinguish a
      // delivery failure from the deliberate "always succeeds" no-op.
      this.logger.error(
        `Failed to send WhatsApp message to ${toPhone}: ${(error as Error).message}`,
      );
    }
  }
}
