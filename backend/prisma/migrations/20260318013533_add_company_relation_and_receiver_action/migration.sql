/*
  Warnings:

  - You are about to drop the column `sender_id` on the `shipments` table. All the data in the column will be lost.
  - Added the required column `company_id` to the `shipments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReceiverActionType" AS ENUM ('CONFIRMED', 'DISPUTED');

-- AlterTable
ALTER TABLE "shipments" DROP COLUMN "sender_id",
ADD COLUMN     "company_id" UUID NOT NULL,
ADD COLUMN     "created_by_device" UUID;

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiver_actions" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "action" "ReceiverActionType" NOT NULL,
    "dispute_token_id" UUID,
    "evidence_id" UUID,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receiver_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_email_key" ON "companies"("email");

-- CreateIndex
CREATE UNIQUE INDEX "receiver_actions_shipment_id_key" ON "receiver_actions"("shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "receiver_actions_dispute_token_id_key" ON "receiver_actions"("dispute_token_id");

-- CreateIndex
CREATE UNIQUE INDEX "receiver_actions_evidence_id_key" ON "receiver_actions"("evidence_id");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_device_fkey" FOREIGN KEY ("created_by_device") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiver_actions" ADD CONSTRAINT "receiver_actions_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiver_actions" ADD CONSTRAINT "receiver_actions_dispute_token_id_fkey" FOREIGN KEY ("dispute_token_id") REFERENCES "dispute_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiver_actions" ADD CONSTRAINT "receiver_actions_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
