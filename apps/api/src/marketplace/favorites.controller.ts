import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { MarketplaceFavoriteItem, Paginated } from '@real-estate/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { FavoritesService } from './favorites.service';

class ListFavoritesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post('marketplace/properties/:publicationId/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  async add(
    @Param('publicationId') publicationId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.favorites.add(user.userId, publicationId);
  }

  @Delete('marketplace/properties/:publicationId/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('publicationId') publicationId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<void> {
    await this.favorites.remove(user.userId, publicationId);
  }

  @Get('marketplace/favorites')
  async list(
    @Query() query: ListFavoritesQueryDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Paginated<MarketplaceFavoriteItem>> {
    return this.favorites.list(
      user.userId,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }
}
