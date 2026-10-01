-- LOCKDOWN (was: "fix storage permissions" — granted FOR ALL to `public`)
--
-- Anonymous full access to the media bucket allowed anyone to upload,
-- overwrite and delete objects. This version keeps the bucket private and
-- drops every anonymous policy. When the reels/media feature ships, grant
-- access to `authenticated` users scoped by owner instead.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', false, 52428800, ARRAY['video/mp4', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['video/mp4', 'image/jpeg', 'image/png'];

DROP POLICY IF EXISTS "Media Public Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Media Public Viewing" ON storage.objects;
DROP POLICY IF EXISTS "Media Public Update" ON storage.objects;
DROP POLICY IF EXISTS "Media Public Deletion" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public Viewing" ON storage.objects;
DROP POLICY IF EXISTS "Public Deletion" ON storage.objects;
