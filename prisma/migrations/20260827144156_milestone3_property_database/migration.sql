-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'VILLA', 'HOUSE', 'LAND', 'OFFICE', 'SHOP', 'COMMERCIAL', 'WAREHOUSE', 'BUILDING', 'CHALET', 'OTHER');

-- CreateEnum
CREATE TYPE "ListingPurpose" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "PropertyBusinessStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'RENTED', 'OFF_MARKET', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PropertyLocationSource" AS ENUM ('GOOGLE_SEARCH', 'MAP_PIN', 'CURRENT_LOCATION', 'MANUAL');

-- CreateEnum
CREATE TYPE "PropertyLocationVisibility" AS ENUM ('PRIVATE', 'WORKSPACE', 'PUBLIC_APPROXIMATE', 'PUBLIC_EXACT');

-- CreateEnum
CREATE TYPE "PropertyMediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "listingPurpose" "ListingPurpose" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "areaSqm" DECIMAL(10,2),
    "floor" INTEGER,
    "totalFloors" INTEGER,
    "yearBuilt" INTEGER,
    "propertyStatus" "PropertyBusinessStatus" NOT NULL DEFAULT 'AVAILABLE',
    "archivedAt" TIMESTAMP(3),
    "archivedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_locations" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "area" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "googlePlaceId" TEXT,
    "locationSource" "PropertyLocationSource" NOT NULL DEFAULT 'MANUAL',
    "locationVisibility" "PropertyLocationVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_features" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "featureKey" TEXT NOT NULL,
    "value" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_media" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "mediaType" "PropertyMediaType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "uploadedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_owners" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "whatsappPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_private_details" (
    "propertyId" UUID NOT NULL,
    "internalNotes" TEXT,
    "commissionNotes" TEXT,
    "acquisitionSource" TEXT,
    "internalReference" TEXT,
    "privateStatusNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_private_details_pkey" PRIMARY KEY ("propertyId")
);

-- CreateIndex
CREATE INDEX "properties_workspaceId_idx" ON "properties"("workspaceId");

-- CreateIndex
CREATE INDEX "properties_workspaceId_propertyStatus_idx" ON "properties"("workspaceId", "propertyStatus");

-- CreateIndex
CREATE INDEX "properties_workspaceId_propertyType_idx" ON "properties"("workspaceId", "propertyType");

-- CreateIndex
CREATE INDEX "properties_workspaceId_listingPurpose_idx" ON "properties"("workspaceId", "listingPurpose");

-- CreateIndex
CREATE INDEX "properties_workspaceId_price_idx" ON "properties"("workspaceId", "price");

-- CreateIndex
CREATE INDEX "properties_createdByUserId_idx" ON "properties"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "property_locations_propertyId_key" ON "property_locations"("propertyId");

-- CreateIndex
CREATE INDEX "property_locations_city_idx" ON "property_locations"("city");

-- CreateIndex
CREATE INDEX "property_locations_area_idx" ON "property_locations"("area");

-- CreateIndex
CREATE INDEX "property_locations_country_city_area_idx" ON "property_locations"("country", "city", "area");

-- CreateIndex
CREATE UNIQUE INDEX "property_features_propertyId_featureKey_key" ON "property_features"("propertyId", "featureKey");

-- CreateIndex
CREATE INDEX "property_media_propertyId_sortOrder_idx" ON "property_media"("propertyId", "sortOrder");

-- CreateIndex
CREATE INDEX "property_owners_propertyId_idx" ON "property_owners"("propertyId");

-- CreateIndex
-- Hand-added: guarantees at most one PropertyMedia row per property can
-- have isPrimary = true, at the database level (not just application
-- logic) — the same partial-unique-index pattern used for system role
-- keys in the Milestone 2 migration. A plain unique index on
-- (propertyId, isPrimary) would not work here since Postgres allows
-- unlimited rows with isPrimary = false to share a propertyId; scoping
-- the index to WHERE "isPrimary" = true is what makes only the "true"
-- case unique per property.
CREATE UNIQUE INDEX "property_media_one_primary_per_property" ON "property_media"("propertyId") WHERE "isPrimary" = true;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_locations" ADD CONSTRAINT "property_locations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_features" ADD CONSTRAINT "property_features_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_owners" ADD CONSTRAINT "property_owners_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_private_details" ADD CONSTRAINT "property_private_details_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
