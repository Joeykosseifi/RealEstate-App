import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type {
  Paginated,
  PublicPropertyDetail,
  PublicPropertyListItem,
} from '@real-estate/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/auth.types';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceSearchQueryDto } from './dto/marketplace-search-query.dto';

/**
 * Marketplace browsing is open to ANY authenticated platform user
 * (CLIENT, AGENT, or COMPANY account) — deliberately NOT gated by
 * `@RequireWorkspacePermission`, since browsing published listings has
 * nothing to do with workspace membership (see docs/PERMISSIONS.md
 * "Marketplace authorization is not workspace authorization"). The
 * existing product requires authentication everywhere else, so this
 * stays consistent rather than introducing anonymous access.
 */
@Controller('marketplace/properties')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get()
  async list(
    @Query() query: MarketplaceSearchQueryDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Paginated<PublicPropertyListItem>> {
    return this.marketplace.findMany(query, user.userId);
  }

  @Get(':publicationId')
  async detail(
    @Param('publicationId') publicationId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<PublicPropertyDetail> {
    return this.marketplace.findOneOrThrow(publicationId, user.userId);
  }
}
