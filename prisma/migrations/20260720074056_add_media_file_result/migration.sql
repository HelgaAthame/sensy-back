-- CreateTable
CREATE TABLE "MediaFileResult" (
    "mediaFileId" INTEGER NOT NULL,
    "stt" JSONB,
    "tonal" JSONB,
    "simultaneousSpeech" JSONB,
    "simultaneousSilence" JSONB,
    "keywordsSearchResult" JSONB,
    "gptSummary" TEXT,
    "gptChecklist" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaFileResult_pkey" PRIMARY KEY ("mediaFileId")
);

-- AddForeignKey
ALTER TABLE "MediaFileResult" ADD CONSTRAINT "MediaFileResult_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "MediaFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
