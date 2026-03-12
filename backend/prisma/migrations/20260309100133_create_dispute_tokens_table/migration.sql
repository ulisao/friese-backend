-- CreateTable
CREATE TABLE "dispute_tokens" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "visual_token" VARCHAR(255) NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "dispute_tokens_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "dispute_tokens" ADD CONSTRAINT "dispute_tokens_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
