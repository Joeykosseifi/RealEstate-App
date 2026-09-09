import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../config/env';
import { MailService } from './mail.service';
import { ConsoleMailProvider } from './console-mail.provider';
import { SmtpMailProvider } from './smtp-mail.provider';

@Module({
  providers: [
    {
      provide: MailService,
      useFactory: (configService: ConfigService<ApiEnv, true>): MailService =>
        configService.get('EMAIL_PROVIDER', { infer: true }) === 'smtp'
          ? new SmtpMailProvider(configService)
          : new ConsoleMailProvider(configService),
      inject: [ConfigService],
    },
  ],
  exports: [MailService],
})
export class MailModule {}
