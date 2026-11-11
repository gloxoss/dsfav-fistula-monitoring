-- CreateEnum
CREATE TYPE "MeasurementState" AS ENUM ('INIT', 'UPLOADED', 'ANALYSED', 'ABANDONED');

-- AlterTable
ALTER TABLE "Measurement" ADD COLUMN     "state" "MeasurementState" NOT NULL DEFAULT 'INIT',
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" DROP DEFAULT;
