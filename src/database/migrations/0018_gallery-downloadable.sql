ALTER TABLE "pitaya"."galleries" ADD COLUMN "downloadable" boolean DEFAULT false NOT NULL;
UPDATE "pitaya"."galleries" SET "downloadable" = true WHERE "visibility" = 'PRIVATE';
