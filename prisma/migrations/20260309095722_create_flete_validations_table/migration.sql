-- CreateTable
CREATE TABLE "flete_validations" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "phone_sent_to" VARCHAR(20) NOT NULL,
    "otp_code" VARCHAR(255) NOT NULL,
    "validated_at" TIMESTAMP(3),
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flete_validations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "flete_validations" ADD CONSTRAINT "flete_validations_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
