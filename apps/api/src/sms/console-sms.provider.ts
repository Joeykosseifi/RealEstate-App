import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../config/env';
import { SmsService } from './sms.service';

/**
 * Development-only SMS provider — same production-safety rule as
 * ConsoleMailProvider: never sends or logs OTP content when
 * NODE_ENV === 'production'. Wire a real provider (Twilio/SNS/etc.)
 * here before launch.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsService {
  private readonly logger = new Logger('SmsService');

  constructor(private readonly configService: ConfigService<ApiEnv, true>) {}

  send(toPhone: string, body: string): Promise<void> {
    if (this.configService.get('NODE_ENV', { infer: true }) === 'production') {
      this.logger.warn(
        `No production SMS provider is configured; SMS to ${toPhone} was not sent.`,
      );
      return Promise.resolve();
    }

    this.logger.log(`[DEV SMS] to=${toPhone} body="${body}"`);
    return Promise.resolve();
  }
}
