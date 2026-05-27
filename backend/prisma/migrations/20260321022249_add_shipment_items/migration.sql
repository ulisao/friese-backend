/*
  Warnings:

  - Added the required column `destinatario` to the `shipments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "evidence" ADD COLUMN     "shipment_item_id" UUID;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "destinatario" VARCHAR(255) NOT NULL;

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "lote" VARCHAR(100),
    "cantidad" INTEGER NOT NULL,
    "marca" VARCHAR(100),
    "material" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_shipment_item_id_fkey" FOREIGN KEY ("shipment_item_id") REFERENCES "shipment_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
