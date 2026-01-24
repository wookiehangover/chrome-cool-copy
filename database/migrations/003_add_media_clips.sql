-- Migration: Add media_clips table for storing clipped images
-- This table stores references to images uploaded to Vercel Blob storage

CREATE TABLE IF NOT EXISTS media_clips (
    -- Primary key (nanoid)
    id TEXT PRIMARY KEY,
    
    -- Blob storage reference
    blob_url TEXT NOT NULL,
    
    -- Original image metadata
    original_filename TEXT,
    mimetype TEXT NOT NULL,
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    alt_text TEXT,
    
    -- Source page information
    page_url TEXT NOT NULL,
    page_title TEXT,
    
    -- AI-generated description
    ai_description TEXT,
    ai_description_status TEXT DEFAULT 'pending' CHECK (ai_description_status IN ('pending', 'processing', 'complete', 'error')),
    
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for listing clips by date
CREATE INDEX IF NOT EXISTS idx_media_clips_created_at ON media_clips(created_at DESC);

-- Index for finding clips by page URL
CREATE INDEX IF NOT EXISTS idx_media_clips_page_url ON media_clips(page_url);

