/*
  Warnings:

  - A unique constraint covering the columns `[tracking_token]` on the table `shipments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expires_at` to the `dispute_tokens` table without a default value. This is not possible if the table is not empty.
  - The required column `tracking_token` was added to the `shipments` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "dispute_tokens" ADD COLUMN     "expires_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "tracking_token" VARCHAR(100) NOT NULL;

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "operator_name" VARCHAR(255) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipments_tracking_token_key" ON "shipments"("tracking_token");
