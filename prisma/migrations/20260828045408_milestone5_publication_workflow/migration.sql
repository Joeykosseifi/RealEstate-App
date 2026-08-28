-- CreateEnum
CREATE TYPE "PropertyPublicationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'PUBLISHED', 'REJECTED', 'ADMIN_UNPUBLISHED', 'OWNER_UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PropertyPublicationVersionStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "property_publications" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "status" "PropertyPublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "latestVersionId" UUID,
    "publishedVersionId" UUID,
    "submittedByUserId" UUID,
    "submittedAt" TIMESTAMP(3),
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" UUID,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "changesRequestedByUserId" UUID,
    "changesRequestedAt" TIMESTAMP(3),
    "changesRequestedReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "unpublishedByUserId" UUID,
    "unpublishReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_publication_versions" (
    "id" UUID NOT NULL,
    "publicationId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "PropertyPublicationVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "publicTitle" TEXT NOT NULL,
    "publicDescription" TEXT,
    "publicPrice" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "listingPurpose" "ListingPurpose" NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "areaSqm" DECIMAL(10,2),
    "publicFeatureKeys" TEXT[],
    "locationVisibility" "PropertyLocationVisibility" NOT NULL,
    "publicCountry" TEXT,
    "publicCity" TEXT,
    "publicArea" TEXT,
    "publicLatitude" DECIMAL(9,6),
    "publicLongitude" DECIMAL(9,6),
    "submittedByUserId" UUID,
    "submittedAt" TIMESTAMP(3),
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_publication_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_publication_media" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "propertyMediaId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isMain" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "property_publication_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_favorites" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "publicationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "property_publications_propertyId_key" ON "property_publications"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "property_publications_latestVersionId_key" ON "property_publications"("latestVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "property_publications_publishedVersionId_key" ON "property_publications"("publishedVersionId");

-- CreateIndex
CREATE INDEX "property_publications_workspaceId_idx" ON "property_publications"("workspaceId");

-- CreateIndex
CREATE INDEX "property_publications_status_idx" ON "property_publications"("status");

-- CreateIndex
CREATE INDEX "property_publications_workspaceId_status_idx" ON "property_publications"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "property_publications_submittedAt_idx" ON "property_publications"("submittedAt");

-- CreateIndex
CREATE INDEX "property_publications_publishedAt_idx" ON "property_publications"("publishedAt");

-- CreateIndex
CREATE INDEX "property_publication_versions_publicationId_idx" ON "property_publication_versions"("publicationId");

-- CreateIndex
CREATE INDEX "property_publication_versions_status_idx" ON "property_publication_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "property_publication_versions_publicationId_versionNumber_key" ON "property_publication_versions"("publicationId", "versionNumber");

-- CreateIndex
CREATE INDEX "property_publication_media_versionId_sortOrder_idx" ON "property_publication_media"("versionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "property_publication_media_versionId_propertyMediaId_key" ON "property_publication_media"("versionId", "propertyMediaId");

-- CreateIndex
CREATE INDEX "marketplace_favorites_userId_idx" ON "marketplace_favorites"("userId");

-- CreateIndex
CREATE INDEX "marketplace_favorites_publicationId_idx" ON "marketplace_favorites"("publicationId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_favorites_userId_publicationId_key" ON "marketplace_favorites"("userId", "publicationId");

-- AddForeignKey
ALTER TABLE "property_publications" ADD CONSTRAINT "property_publications_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_publications" ADD CONSTRAINT "property_publications_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_publications" ADD CONSTRAINT "property_publications_latestVersionId_fkey" FOREIGN KEY ("latestVersionId") REFERENCES "property_publication_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_publications" ADD CONSTRAINT "property_publications_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "property_publication_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_publication_versions" ADD CONSTRAINT "property_publication_versions_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "property_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_publication_media" ADD CONSTRAINT "property_publication_media_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "property_publication_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_publication_media" ADD CONSTRAINT "property_publication_media_propertyMediaId_fkey" FOREIGN KEY ("propertyMediaId") REFERENCES "property_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_favorites" ADD CONSTRAINT "marketplace_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_favorites" ADD CONSTRAINT "marketplace_favorites_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "property_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
