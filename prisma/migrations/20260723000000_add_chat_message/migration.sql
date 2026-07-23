-- CreateEnum
CREATE TYPE "ChatType" AS ENUM ('Notification', 'Alert');

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "chatType" "ChatType" NOT NULL,
    "chatId" INTEGER NOT NULL DEFAULT 0,
    "createDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT,
    "attachmentsCount" INTEGER NOT NULL DEFAULT 0,
    "seen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_chatType_createDate_idx" ON "ChatMessage"("chatType", "createDate");
