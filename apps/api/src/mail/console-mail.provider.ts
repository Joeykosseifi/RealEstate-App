import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../config/env';
import { MailService, type MailMessage } from './mail.service';

/**
 * Development-only mail provider. It is the sole place a verification
 * link or reset link may become visible outside the database — and only
 * when NODE_ENV !== 'production'. In production it deliberately does NOT
 * send or log the message content, since no real provider is wired up
 * yet; wire a real provider (SendGrid/SES/etc.) here before launch.
 */
@Injectable()
export class ConsoleMailProvider implements MailService {
  private readonly logger = new Logger('MailService');

  constructor(private readonly configService: ConfigService<ApiEnv, true>) {}

  send(message: MailMessage): Promise<void> {
    if (this.configService.get('NODE_ENV', { infer: true }) === 'production') {
      this.logger.warn(
        `No production email provider is configured; email to ${message.to} was not sent.`,
      );
      return Promise.resolve();
    }

    this.logger.log(
      `[DEV EMAIL] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );
    return Promise.resolve();
  }
}
