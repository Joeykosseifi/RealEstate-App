import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../config/env';
import { SmsService } from './sms.service';
import { ConsoleSmsProvider } from './console-sms.provider';
import { TwilioWhatsAppProvider } from './twilio-whatsapp.provider';

@Module({
  providers: [
    {
      provide: SmsService,
      useFactory: (configService: ConfigService<ApiEnv, true>): SmsService =>
        configService.get('SMS_PROVIDER', { infer: true }) === 'twilio-whatsapp'
          ? new TwilioWhatsAppProvider(configService)
          : new ConsoleSmsProvider(configService),
      inject: [ConfigService],
    },
  ],
  exports: [SmsService],
})
export class SmsModule {}
