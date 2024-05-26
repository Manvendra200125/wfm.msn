/*
  Warnings:

  - You are about to drop the column `woker_id` on the `Submission` table. All the data in the column will be lost.
  - Added the required column `worker_id` to the `Submission` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_woker_id_fkey";

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "woker_id",
ADD COLUMN     "worker_id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
