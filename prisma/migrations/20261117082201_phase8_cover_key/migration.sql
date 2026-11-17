-- The cover becomes a storage key in the public bucket, like previewKey,
-- instead of a URL. A rename (not drop + add) keeps any existing value.
ALTER TABLE "Beat" RENAME COLUMN "coverUrl" TO "coverKey";
