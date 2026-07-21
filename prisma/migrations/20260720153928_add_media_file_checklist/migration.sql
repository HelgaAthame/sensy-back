-- CreateTable
CREATE TABLE "MediaFileChecklist" (
    "mediaFileId" INTEGER NOT NULL,
    "checklistId" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaFileChecklist_pkey" PRIMARY KEY ("mediaFileId","checklistId")
);

-- AddForeignKey
ALTER TABLE "MediaFileChecklist" ADD CONSTRAINT "MediaFileChecklist_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "MediaFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaFileChecklist" ADD CONSTRAINT "MediaFileChecklist_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
