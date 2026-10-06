ALTER TABLE "pitaya"."galleries" ADD COLUMN "slug" text;--> statement-breakpoint
DO $$
DECLARE
  gallery_row record;
  base_slug text;
  candidate text;
  suffix integer;
BEGIN
  FOR gallery_row IN
    SELECT id, name, visibility
    FROM "pitaya"."galleries"
    ORDER BY created_at, id
  LOOP
    base_slug := trim(both '-' from regexp_replace(lower(coalesce(gallery_row.name, '')), '[^a-z0-9]+', '-', 'g'));
    IF base_slug = '' THEN
      base_slug := 'galerie';
    END IF;
    base_slug := trim(trailing '-' from left(base_slug, 180));

    IF gallery_row.visibility = 'UNLISTED' THEN
      base_slug := base_slug || '-' || substr(md5(gallery_row.id::text || random()::text), 1, 16);
    END IF;

    candidate := base_slug;
    suffix := 2;
    WHILE EXISTS (SELECT 1 FROM "pitaya"."galleries" WHERE slug = candidate) LOOP
      candidate := base_slug || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;

    UPDATE "pitaya"."galleries" SET slug = candidate WHERE id = gallery_row.id;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "pitaya"."galleries" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pitaya"."galleries" ADD CONSTRAINT "galleries_slug_unique" UNIQUE("slug");
