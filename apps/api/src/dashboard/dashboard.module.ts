import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module';
import { ClientsModule } from '../clients/clients.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PropertiesModule, ClientsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
