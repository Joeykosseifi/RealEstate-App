import { Module } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';

@Module({
  controllers: [MarketplaceController, FavoritesController],
  providers: [MarketplaceService, FavoritesService],
})
export class MarketplaceModule {}
