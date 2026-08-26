import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { ConsoleSmsProvider } from './console-sms.provider';

@Module({
  providers: [{ provide: SmsService, useClass: ConsoleSmsProvider }],
  exports: [SmsService],
})
export class SmsModule {}
