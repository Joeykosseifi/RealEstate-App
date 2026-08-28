import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { MarketplaceFavoriteItem, Paginated } from '@real-estate/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  MarketplaceService,
  PUBLICATION_VISIBILITY_WHERE,
} from './marketplace.service';
import { toMarketplaceFavoriteItem } from './marketplace.mapper';

/**
 * Favorites a `PropertyPublication` (the marketplace listing), never the
 * private `Property` — structurally impossible to grant private access,
 * since nothing here ever reads `Property`/`PropertyOwner`/
 * `PropertyPrivateDetails`. See docs/PERMISSIONS.md "Marketplace
 * favorite vs. CRM shortlist."
 */
@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly marketplace: MarketplaceService,
  ) {}

  /** Only a currently-PUBLISHED, business-eligible listing may be favorited — same eligibility rule as browsing. */
  private async assertListingFavoritable(publicationId: string): Promise<void> {
    const listing = await this.prisma.propertyPublication.findFirst({
      where: { id: publicationId, ...PUBLICATION_VISIBILITY_WHERE },
      select: { id: true },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found.');
    }
  }

  async add(userId: string, publicationId: string): Promise<void> {
    await this.assertListingFavoritable(publicationId);
    try {
      await this.prisma.marketplaceFavorite.create({
        data: { userId, publicationId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return; // idempotent — already favorited
      }
      throw error;
    }

    await this.audit.log({
      actorUserId: userId,
      action: 'marketplace.favorite_added',
      targetType: 'PropertyPublication',
      targetId: publicationId,
    });
  }

  async remove(userId: string, publicationId: string): Promise<void> {
    const result = await this.prisma.marketplaceFavorite.deleteMany({
      where: { userId, publicationId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Favorite not found.');
    }

    await this.audit.log({
      actorUserId: userId,
      action: 'marketplace.favorite_removed',
      targetType: 'PropertyPublication',
      targetId: publicationId,
    });
  }

  /**
   * A favorite whose listing has since become unpublished/ineligible is
   * never silently resurrected — `listing` comes back `null` rather than
   * exposing stale or private data, per docs/PERMISSIONS.md "Favorite of
   * an unpublished listing."
   */
  async list(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<MarketplaceFavoriteItem>> {
    const [favorites, totalItems] = await Promise.all([
      this.prisma.marketplaceFavorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.marketplaceFavorite.count({ where: { userId } }),
    ]);

    const items = await Promise.all(
      favorites.map(async (favorite) => {
        const listing = await this.marketplace
          .findOneOrThrow(favorite.publicationId, userId)
          .catch(() => null);
        return toMarketplaceFavoriteItem(
          favorite.id,
          favorite.createdAt,
          favorite.publicationId,
          listing,
        );
      }),
    );

    return {
      items,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }
}
