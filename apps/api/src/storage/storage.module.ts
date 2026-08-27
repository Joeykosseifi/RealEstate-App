import { Global, Module } from '@nestjs/common';
import { LocalDiskStorageService } from './local-disk-storage.service';
import { STORAGE_SERVICE } from './storage.service';
import { StorageAccessController } from './storage-access.controller';

/**
 * `@Global()` so any feature module (properties today, others later) can
 * inject `STORAGE_SERVICE` without importing this module directly —
 * mirrors the AuditModule/AuthorizationModule pattern.
 */
@Global()
@Module({
  controllers: [StorageAccessController],
  providers: [
    LocalDiskStorageService,
    { provide: STORAGE_SERVICE, useExisting: LocalDiskStorageService },
  ],
  exports: [STORAGE_SERVICE, LocalDiskStorageService],
})
export class StorageModule {}
