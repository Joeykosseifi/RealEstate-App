import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientRequirementsController } from './client-requirements.controller';
import { ClientRequirementsService } from './client-requirements.service';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { ShortlistController } from './shortlist.controller';
import { ShortlistService } from './shortlist.service';

@Module({
  controllers: [
    ClientsController,
    ClientRequirementsController,
    MatchingController,
    ShortlistController,
  ],
  providers: [
    ClientsService,
    ClientRequirementsService,
    MatchingService,
    ShortlistService,
  ],
  exports: [ClientsService],
})
export class ClientsModule {}
