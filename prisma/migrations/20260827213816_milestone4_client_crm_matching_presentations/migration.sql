-- CreateEnum
CREATE TYPE "ClientRecordStatus" AS ENUM ('LEAD', 'ACTIVE', 'QUALIFIED', 'VIEWING', 'NEGOTIATING', 'WON', 'LOST', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('REFERRAL', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'WEBSITE', 'PHONE', 'WALK_IN', 'PROPERTY_INQUIRY', 'OTHER');

-- CreateEnum
CREATE TYPE "PreferredContactMethod" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientRequirementStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FULFILLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PresentationStatus" AS ENUM ('DRAFT', 'GENERATED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "client_records" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "assignedToUserId" UUID,
    "platformUserId" UUID,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsappPhone" TEXT,
    "email" TEXT,
    "preferredContactMethod" "PreferredContactMethod",
    "source" "ClientSource",
    "status" "ClientRecordStatus" NOT NULL DEFAULT 'LEAD',
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_requirements" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "listingPurpose" "ListingPurpose" NOT NULL,
    "propertyTypes" "PropertyType"[],
    "minPrice" DECIMAL(14,2),
    "maxPrice" DECIMAL(14,2),
    "currency" CHAR(3),
    "minBedrooms" INTEGER,
    "maxBedrooms" INTEGER,
    "minBathrooms" INTEGER,
    "minAreaSqm" DECIMAL(10,2),
    "maxAreaSqm" DECIMAL(10,2),
    "countries" TEXT[],
    "cities" TEXT[],
    "areas" TEXT[],
    "requiredFeatures" TEXT[],
    "preferredFeatures" TEXT[],
    "notes" TEXT,
    "status" "ClientRequirementStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "archivedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_property_shortlists" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "requirementId" UUID,
    "propertyId" UUID NOT NULL,
    "addedByUserId" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_property_shortlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_presentations" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "clientId" UUID,
    "requirementId" UUID,
    "createdByUserId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PresentationStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3),
    "storageKey" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_presentations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_presentation_items" (
    "id" UUID NOT NULL,
    "presentationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "agentNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_presentation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_records_workspaceId_idx" ON "client_records"("workspaceId");

-- CreateIndex
CREATE INDEX "client_records_workspaceId_status_idx" ON "client_records"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "client_records_assignedToUserId_idx" ON "client_records"("assignedToUserId");

-- CreateIndex
CREATE INDEX "client_records_createdByUserId_idx" ON "client_records"("createdByUserId");

-- CreateIndex
CREATE INDEX "client_records_phone_idx" ON "client_records"("phone");

-- CreateIndex
CREATE INDEX "client_records_email_idx" ON "client_records"("email");

-- CreateIndex
CREATE INDEX "client_requirements_clientId_idx" ON "client_requirements"("clientId");

-- CreateIndex
CREATE INDEX "client_requirements_workspaceId_idx" ON "client_requirements"("workspaceId");

-- CreateIndex
CREATE INDEX "client_requirements_workspaceId_status_idx" ON "client_requirements"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "client_property_shortlists_workspaceId_idx" ON "client_property_shortlists"("workspaceId");

-- CreateIndex
CREATE INDEX "client_property_shortlists_requirementId_idx" ON "client_property_shortlists"("requirementId");

-- CreateIndex
CREATE INDEX "client_property_shortlists_propertyId_idx" ON "client_property_shortlists"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "client_property_shortlists_clientId_propertyId_key" ON "client_property_shortlists"("clientId", "propertyId");

-- CreateIndex
CREATE INDEX "property_presentations_workspaceId_idx" ON "property_presentations"("workspaceId");

-- CreateIndex
CREATE INDEX "property_presentations_clientId_idx" ON "property_presentations"("clientId");

-- CreateIndex
CREATE INDEX "property_presentations_requirementId_idx" ON "property_presentations"("requirementId");

-- CreateIndex
CREATE INDEX "property_presentations_status_idx" ON "property_presentations"("status");

-- CreateIndex
CREATE INDEX "property_presentations_workspaceId_createdAt_idx" ON "property_presentations"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "property_presentation_items_presentationId_idx" ON "property_presentation_items"("presentationId");

-- CreateIndex
CREATE INDEX "property_presentation_items_propertyId_idx" ON "property_presentation_items"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "property_presentation_items_presentationId_propertyId_key" ON "property_presentation_items"("presentationId", "propertyId");

-- AddForeignKey
ALTER TABLE "client_records" ADD CONSTRAINT "client_records_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_records" ADD CONSTRAINT "client_records_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_requirements" ADD CONSTRAINT "client_requirements_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_property_shortlists" ADD CONSTRAINT "client_property_shortlists_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_property_shortlists" ADD CONSTRAINT "client_property_shortlists_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "client_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_property_shortlists" ADD CONSTRAINT "client_property_shortlists_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_presentations" ADD CONSTRAINT "property_presentations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_presentations" ADD CONSTRAINT "property_presentations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_presentations" ADD CONSTRAINT "property_presentations_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "client_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_presentations" ADD CONSTRAINT "property_presentations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_presentation_items" ADD CONSTRAINT "property_presentation_items_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "property_presentations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_presentation_items" ADD CONSTRAINT "property_presentation_items_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
