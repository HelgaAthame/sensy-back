/*
  Warnings:

  - You are about to drop the column `gptChecklist` on the `MediaFileResult` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ChatType" AS ENUM ('Notification', 'Alert');

-- AlterTable
ALTER TABLE "MediaFileResult" DROP COLUMN "gptChecklist";

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "chatType" "ChatType" NOT NULL,
    "chatId" INTEGER NOT NULL,
    "createDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT,
    "attachmentsCount" INTEGER NOT NULL DEFAULT 0,
    "seen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_chatType_createDate_idx" ON "ChatMessage"("chatType", "createDate");
