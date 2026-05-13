-- CreateEnum
CREATE TYPE "MemorySuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MemorySuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceConversationId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "scope" "MemoryScope" NOT NULL DEFAULT 'USER',
    "reason" TEXT,
    "status" "MemorySuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemorySuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemorySuggestion_userId_status_createdAt_idx" ON "MemorySuggestion"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MemorySuggestion_sourceConversationId_idx" ON "MemorySuggestion"("sourceConversationId");

-- CreateIndex
CREATE INDEX "Embedding_memoryId_idx" ON "Embedding"("memoryId");

-- CreateIndex
CREATE INDEX "Embedding_documentChunkId_idx" ON "Embedding"("documentChunkId");

-- AddForeignKey
ALTER TABLE "MemorySuggestion" ADD CONSTRAINT "MemorySuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorySuggestion" ADD CONSTRAINT "MemorySuggestion_sourceConversationId_fkey" FOREIGN KEY ("sourceConversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
