-- CreateEnum
CREATE TYPE "Roles" AS ENUM ('USER', 'GUEST', 'CLIENT', 'ADMIN', 'SUPERADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Roles" NOT NULL DEFAULT 'USER';
