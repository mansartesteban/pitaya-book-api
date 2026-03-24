-- Custom SQL migration file, put your code below! --
ALTER TABLE pitaya.services
  DROP COLUMN location,
  ADD COLUMN location jsonb;