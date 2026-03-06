-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('DEPARTURE', 'COMPLAINT');

-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_hash" VARCHAR(64) NOT NULL,
    "metadata_json" JSONB NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
