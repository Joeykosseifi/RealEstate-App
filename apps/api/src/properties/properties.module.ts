import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PropertyMediaController } from './property-media.controller';
import { PropertyMediaService } from './property-media.service';

@Module({
  controllers: [PropertiesController, PropertyMediaController],
  providers: [PropertiesService, PropertyMediaService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
