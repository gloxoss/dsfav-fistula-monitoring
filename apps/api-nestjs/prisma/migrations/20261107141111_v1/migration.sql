-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('NURSE', 'NEPHROLOGIST', 'INTERN', 'ADMIN');

-- CreateEnum
CREATE TYPE "FistulaType" AS ENUM ('RADIO_CEPHALIC', 'BRACHIO_CEPHALIC', 'BRACHIO_BASILIC');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('NORMAL', 'TO_CONFIRM', 'UNUSUAL_EVOLUTION', 'REJECTED_QUALITY', 'BASELINE_BUILDING');

-- CreateEnum
CREATE TYPE "RejectReason" AS ENUM ('ARTIFACT', 'PRESSURE', 'NONE');

-- CreateEnum
CREATE TYPE "PerceivedThrill" AS ENUM ('CONTINUOUS_SOFT', 'SYSTOLIC_ROUGH', 'WEAK_DAMPENED', 'HYPERPULSATILE', 'ABSENT');

-- CreateEnum
CREATE TYPE "MeasurementSource" AS ENUM ('PATIENT', 'BENCH');

-- CreateEnum
CREATE TYPE "SyncState" AS ENUM ('SYNCED', 'SYNCING', 'QUEUED_OFFLINE', 'FAILED');

-- CreateEnum
CREATE TYPE "ConfigStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'NURSE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientPseudo" (
    "id" TEXT NOT NULL,
    "idPseudo" TEXT NOT NULL,
    "fistulaType" "FistulaType" NOT NULL DEFAULT 'RADIO_CEPHALIC',
    "armSide" TEXT NOT NULL DEFAULT 'LEFT',
    "baselineVector" JSONB,
    "baselineLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientPseudo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "macAddress" TEXT NOT NULL,
    "deviceTokenHash" TEXT,
    "calibrationOffsetRms" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "calibrationGain" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "lastBatteryPct" INTEGER NOT NULL DEFAULT 100,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineVersion" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "rmsMean" DOUBLE PRECISION NOT NULL,
    "rmsStd" DOUBLE PRECISION NOT NULL,
    "ratioMean" DOUBLE PRECISION NOT NULL,
    "ratioStd" DOUBLE PRECISION NOT NULL,
    "fpeakMean" DOUBLE PRECISION NOT NULL,
    "fpeakStd" DOUBLE PRECISION NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "reason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaselineVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "values" JSONB NOT NULL,
    "authorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "source" "MeasurementSource" NOT NULL DEFAULT 'PATIENT',
    "patientId" TEXT,
    "deviceId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'NORMAL',
    "rejectReason" "RejectReason" NOT NULL DEFAULT 'NONE',
    "captureDurationSec" DOUBLE PRECISION NOT NULL,
    "cleanDurationSec" DOUBLE PRECISION NOT NULL,
    "deviceGain" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "configVersionId" TEXT,
    "idempotencyKey" TEXT,
    "raw" BYTEA,
    "avgPressureKpa" DOUBLE PRECISION NOT NULL,
    "pressureCompliant" BOOLEAN NOT NULL DEFAULT true,
    "artifactRatioPct" DOUBLE PRECISION NOT NULL,
    "rmsValue" DOUBLE PRECISION,
    "peakAmplitude" DOUBLE PRECISION,
    "dominantFreqHz" DOUBLE PRECISION,
    "highLowEnergyRatio" DOUBLE PRECISION,
    "baselineDeviationScore" DOUBLE PRECISION,
    "rawSignalUri" TEXT,
    "spectrogramJson" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "measurementId" TEXT,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpIntent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "measurementId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncQueueItem" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "state" "SyncState" NOT NULL DEFAULT 'QUEUED_OFFLINE',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchSession" (
    "id" TEXT NOT NULL,
    "internId" TEXT NOT NULL,
    "measurementId" TEXT,
    "pumpFlowMlMin" DOUBLE PRECISION NOT NULL,
    "clampStenosisPct" INTEGER NOT NULL,
    "perceivedThrill" "PerceivedThrill",
    "perceivedIntensity" INTEGER,
    "expectedProfile" TEXT,
    "concordanceScore" DOUBLE PRECISION,
    "concordanceBreakdown" JSONB,
    "internNotes" TEXT,
    "palpationLockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenchSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PatientPseudo_idPseudo_key" ON "PatientPseudo"("idPseudo");

-- CreateIndex
CREATE INDEX "PatientPseudo_idPseudo_idx" ON "PatientPseudo"("idPseudo");

-- CreateIndex
CREATE UNIQUE INDEX "Device_serialNumber_key" ON "Device"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Device_macAddress_key" ON "Device"("macAddress");

-- CreateIndex
CREATE INDEX "BaselineVersion_patientId_active_idx" ON "BaselineVersion"("patientId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigVersion_version_key" ON "ConfigVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "Measurement_idempotencyKey_key" ON "Measurement"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Measurement_patientId_recordedAt_idx" ON "Measurement"("patientId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "Measurement_deviceId_recordedAt_idx" ON "Measurement"("deviceId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "ClinicalNote_patientId_createdAt_idx" ON "ClinicalNote"("patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FollowUpIntent_patientId_createdAt_idx" ON "FollowUpIntent"("patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditEvent_entity_at_idx" ON "AuditEvent"("entity", "at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SyncQueueItem_idempotencyKey_key" ON "SyncQueueItem"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SyncQueueItem_deviceId_state_idx" ON "SyncQueueItem"("deviceId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "BenchSession_measurementId_key" ON "BenchSession"("measurementId");

-- AddForeignKey
ALTER TABLE "BaselineVersion" ADD CONSTRAINT "BaselineVersion_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientPseudo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineVersion" ADD CONSTRAINT "BaselineVersion_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigVersion" ADD CONSTRAINT "ConfigVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigVersion" ADD CONSTRAINT "ConfigVersion_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientPseudo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "ConfigVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientPseudo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "Measurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpIntent" ADD CONSTRAINT "FollowUpIntent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientPseudo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpIntent" ADD CONSTRAINT "FollowUpIntent_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "Measurement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpIntent" ADD CONSTRAINT "FollowUpIntent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncQueueItem" ADD CONSTRAINT "SyncQueueItem_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchSession" ADD CONSTRAINT "BenchSession_internId_fkey" FOREIGN KEY ("internId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchSession" ADD CONSTRAINT "BenchSession_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "Measurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
