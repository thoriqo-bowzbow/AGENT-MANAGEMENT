/*
  Warnings:

  - A unique constraint covering the columns `[userId,email]` on the table `GoogleAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "GoogleAccount_userId_email_key" ON "GoogleAccount"("userId", "email");
