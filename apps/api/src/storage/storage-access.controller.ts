import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { LocalDiskStorageService } from './local-disk-storage.service';

/**
 * Serves private media only via a short-lived signed URL (see
 * `LocalDiskStorageService.getSignedAccessUrl`) — never a permanent
 * public path. No `@RequireWorkspacePermission` here on purpose: the
 * authorization decision already happened once, when
 * `PropertyMediaService`/`PublicationsService`/`MarketplaceService`
 * issued the signed URL to an already-verified/eligible caller; this
 * endpoint only verifies the signature/expiry, exactly like a real S3
 * presigned URL would.
 */
@Controller('storage')
export class StorageAccessController {
  constructor(private readonly storage: LocalDiskStorageService) {}

  @Get('access')
  async access(
    @Query('key') key: string | undefined,
    @Query('exp') expiresAtRaw: string | undefined,
    @Query('sig') signature: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!key || !expiresAtRaw || !signature) {
      throw new UnauthorizedException('Missing signed access parameters.');
    }

    const expiresAt = Number(expiresAtRaw);
    if (
      !Number.isFinite(expiresAt) ||
      !this.storage.verifySignature(key, expiresAt, signature)
    ) {
      throw new UnauthorizedException('Invalid or expired access link.');
    }

    try {
      const buffer = await this.storage.readObject(key);
      // A signed URL is deliberately meant to be embeddable wherever it's
      // handed out — property media previews in admin-web (a different
      // origin) and, in production, a CDN in front of this endpoint. The
      // helmet() default `Cross-Origin-Resource-Policy: same-origin`
      // would otherwise have browsers silently block exactly that
      // legitimate cross-origin `<img>` load — found via a real browser
      // check against admin-web during the Milestone 5 smoke test. The
      // signature/expiry check above is what actually gates access, not
      // this header.
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.send(buffer);
    } catch {
      throw new NotFoundException('Media not found.');
    }
  }
}
