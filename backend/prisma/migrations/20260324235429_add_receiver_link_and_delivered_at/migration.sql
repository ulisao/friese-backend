/*
  Warnings:

  - You are about to drop the column `tracking_token` on the `shipments` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "shipments_tracking_token_key";

-- AlterTable
ALTER TABLE "shipments" DROP COLUMN "tracking_token",
ADD COLUMN     "delivered_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "receiver_links" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "token" VARCHAR(100) NOT NULL,
    "acknowledged_at" TIMESTAMP(3),
    "invalidated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receiver_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receiver_links_shipment_id_key" ON "receiver_links"("shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "receiver_links_token_key" ON "receiver_links"("token");

-- AddForeignKey
ALTER TABLE "receiver_links" ADD CONSTRAINT "receiver_links_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
