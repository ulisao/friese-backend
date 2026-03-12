/*
  Warnings:

  - The values [pending,in_transit,delivered,cancelled] on the enum `ShipmentStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ShipmentStatus_new" AS ENUM ('PENDING_EVIDENCE', 'PENDING_FLETE', 'IN_TRANSIT', 'DELIVERED', 'CLOSED', 'DISPUTE', 'DISPUTE_RESOLVED');
ALTER TABLE "public"."shipments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "shipments" ALTER COLUMN "status" TYPE "ShipmentStatus_new" USING ("status"::text::"ShipmentStatus_new");
ALTER TABLE "audit_logs" ALTER COLUMN "from_status" TYPE "ShipmentStatus_new" USING ("from_status"::text::"ShipmentStatus_new");
ALTER TABLE "audit_logs" ALTER COLUMN "to_status" TYPE "ShipmentStatus_new" USING ("to_status"::text::"ShipmentStatus_new");
ALTER TYPE "ShipmentStatus" RENAME TO "ShipmentStatus_old";
ALTER TYPE "ShipmentStatus_new" RENAME TO "ShipmentStatus";
DROP TYPE "public"."ShipmentStatus_old";
ALTER TABLE "shipments" ALTER COLUMN "status" SET DEFAULT 'PENDING_EVIDENCE';
COMMIT;

-- AlterTable
ALTER TABLE "shipments" ALTER COLUMN "status" SET DEFAULT 'PENDING_EVIDENCE';
