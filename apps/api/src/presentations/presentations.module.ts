import { Module } from '@nestjs/common';
import { PresentationsController } from './presentations.controller';
import { PresentationsService } from './presentations.service';
import { PdfGeneratorService } from './pdf-generator.service';

@Module({
  controllers: [PresentationsController],
  providers: [PresentationsService, PdfGeneratorService],
})
export class PresentationsModule {}
