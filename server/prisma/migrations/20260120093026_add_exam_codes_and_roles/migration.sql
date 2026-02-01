/*
  Warnings:

  - A unique constraint covering the columns `[roll_number]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `exam_code` to the `exams` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN "roll_number" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_exams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exam_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration_min" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "template" TEXT NOT NULL DEFAULT 'mcq',
    "professor_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "exams_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_exams" ("created_at", "description", "duration_min", "id", "professor_id", "status", "template", "title", "updated_at") SELECT "created_at", "description", "duration_min", "id", "professor_id", "status", "template", "title", "updated_at" FROM "exams";
DROP TABLE "exams";
ALTER TABLE "new_exams" RENAME TO "exams";
CREATE UNIQUE INDEX "exams_exam_code_key" ON "exams"("exam_code");
CREATE TABLE "new_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exam_id" TEXT NOT NULL,
    "device_id" TEXT,
    "user_id" TEXT,
    "roll_number" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" DATETIME,
    "score" INTEGER,
    "total" INTEGER,
    "flags_json" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "sessions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_sessions" ("device_id", "exam_id", "flags_json", "id", "roll_number", "score", "started_at", "submitted_at", "total") SELECT "device_id", "exam_id", "flags_json", "id", "roll_number", "score", "started_at", "submitted_at", "total" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
CREATE UNIQUE INDEX "sessions_exam_id_roll_number_key" ON "sessions"("exam_id", "roll_number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "users_roll_number_key" ON "users"("roll_number");
