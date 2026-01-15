-- Add share_id column for shareable URLs
ALTER TABLE webpages ADD COLUMN share_id TEXT;

-- Create unique index for lookups
CREATE UNIQUE INDEX idx_webpages_share_id ON webpages(share_id);

