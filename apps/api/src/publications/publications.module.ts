import { Module } from '@nestjs/common';
import { PublicationsService } from './publications.service';
import { PublicationsController } from './publications.controller';
import { AdminPublicationsService } from './admin-publications.service';
import { AdminPublicationsController } from './admin-publications.controller';

@Module({
  controllers: [PublicationsController, AdminPublicationsController],
  providers: [PublicationsService, AdminPublicationsService],
  exports: [PublicationsService],
})
export class PublicationsModule {}
