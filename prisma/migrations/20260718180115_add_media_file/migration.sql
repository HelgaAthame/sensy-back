-- CreateEnum
CREATE TYPE "MediaFileStatus" AS ENUM ('Processing', 'Ready', 'Failed');

-- CreateTable
CREATE TABLE "MediaFile" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT,
    "storageKey" TEXT NOT NULL,
    "numChannels" INTEGER,
    "sampleRate" INTEGER,
    "duration" DOUBLE PRECISION,
    "operatorId" INTEGER,
    "projectId" INTEGER,
    "createDate" TIMESTAMP(3) NOT NULL,
    "lastAccessUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MediaFileStatus" NOT NULL DEFAULT 'Processing',
    "isFailed" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "outerId" TEXT,
    "clientId" TEXT,
    "clientNumber" TEXT,
    "direction" TEXT,
    "negativeLevelOverall" DOUBLE PRECISION,
    "keywordsCount" INTEGER DEFAULT 0,
    "maxSimultaneousSilenceDuration" DOUBLE PRECISION,
    "simultaneousSpeechCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaFile_createDate_idx" ON "MediaFile"("createDate");

-- CreateIndex
CREATE INDEX "MediaFile_operatorId_idx" ON "MediaFile"("operatorId");

-- CreateIndex
CREATE INDEX "MediaFile_projectId_idx" ON "MediaFile"("projectId");

-- AddForeignKey
ALTER TABLE "MediaFile" ADD CONSTRAINT "MediaFile_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaFile" ADD CONSTRAINT "MediaFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
