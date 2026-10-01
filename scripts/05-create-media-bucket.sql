-- LOCKDOWN (was: "create media bucket with public access")
--
-- The app never reads or writes Supabase Storage, and anonymous
-- INSERT/SELECT/DELETE on a bucket lets anyone with the URL upload or
-- delete files. This script creates the bucket as private and removes the
-- anonymous policies created by earlier versions of this file.

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', false)
ON CONFLICT (id) DO UPDATE SET public = false;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Media Public Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Media Public Viewing" ON storage.objects;
DROP POLICY IF EXISTS "Media Public Update" ON storage.objects;
DROP POLICY IF EXISTS "Media Public Deletion" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public Viewing" ON storage.objects;
DROP POLICY IF EXISTS "Public Deletion" ON storage.objects;
