import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { ConsoleMailProvider } from './console-mail.provider';

@Module({
  providers: [{ provide: MailService, useClass: ConsoleMailProvider }],
  exports: [MailService],
})
export class MailModule {}
