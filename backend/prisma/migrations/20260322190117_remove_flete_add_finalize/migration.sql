/*
  Warnings:

  - The values [PENDING_FLETE] on the enum `ShipmentStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `flete_validations` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UsageEventType" AS ENUM ('SHIPMENT_CREATED', 'EMAIL_SENT', 'EVIDENCE_UPLOADED');

-- AlterEnum
BEGIN;
CREATE TYPE "ShipmentStatus_new" AS ENUM ('PENDING_EVIDENCE', 'IN_TRANSIT', 'DELIVERED', 'CLOSED', 'DISPUTE', 'DISPUTE_RESOLVED');
ALTER TABLE "public"."shipments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "shipments" ALTER COLUMN "status" TYPE "ShipmentStatus_new" USING ("status"::text::"ShipmentStatus_new");
ALTER TABLE "audit_logs" ALTER COLUMN "from_status" TYPE "ShipmentStatus_new" USING ("from_status"::text::"ShipmentStatus_new");
ALTER TABLE "audit_logs" ALTER COLUMN "to_status" TYPE "ShipmentStatus_new" USING ("to_status"::text::"ShipmentStatus_new");
ALTER TYPE "ShipmentStatus" RENAME TO "ShipmentStatus_old";
ALTER TYPE "ShipmentStatus_new" RENAME TO "ShipmentStatus";
DROP TYPE "public"."ShipmentStatus_old";
ALTER TABLE "shipments" ALTER COLUMN "status" SET DEFAULT 'PENDING_EVIDENCE';
COMMIT;

-- DropForeignKey
ALTER TABLE "flete_validations" DROP CONSTRAINT "flete_validations_shipment_id_fkey";

-- AlterTable
ALTER TABLE "evidence" ADD COLUMN     "file_size_bytes" INTEGER;

-- DropTable
DROP TABLE "flete_validations";

-- CreateTable
CREATE TABLE "usage_events" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "type" "UsageEventType" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_events_company_id_created_at_idx" ON "usage_events"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "usage_events_company_id_type_idx" ON "usage_events"("company_id", "type");

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
