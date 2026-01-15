-- =============================================================================
-- Element Clips Schema for AgentDB
-- Option B: Separate tables for element clips and binary assets
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: element_clips
-- Stores element clip metadata and content (mirrors ElementClip TypeScript type)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS element_clips (
    -- Primary key
    id TEXT PRIMARY KEY,
    
    -- Source page info
    url TEXT NOT NULL,
    page_title TEXT NOT NULL,
    
    -- Element identification
    selector TEXT NOT NULL,
    
    -- DOM and styling (stored as text, can be large)
    dom_structure TEXT NOT NULL,
    scoped_styles TEXT NOT NULL,
    
    -- Extracted text content
    text_content TEXT NOT NULL,
    markdown_content TEXT NOT NULL,
    
    -- Structured data (JSON blobs)
    structured_data TEXT,  -- JSON: { jsonLd, microdata, openGraph, ariaAttributes }
    media_assets TEXT,     -- JSON array: MediaAssetReference[]
    element_meta TEXT,     -- JSON: ElementMetadata
    
    -- AI-generated content
    ai_summary TEXT,
    ai_summary_status TEXT DEFAULT 'pending' CHECK (ai_summary_status IN ('pending', 'complete', 'error')),
    ai_title TEXT,
    ai_description TEXT,
    
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- Sync metadata
    sync_status TEXT DEFAULT 'local' CHECK (sync_status IN ('local', 'synced', 'pending', 'conflict')),
    last_synced_at TEXT,
    device_id TEXT
);

-- -----------------------------------------------------------------------------
-- Table: clip_blobs
-- Stores binary assets (screenshots, downloaded images, videos)
-- These are stored separately to avoid bloating the main clips table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clip_blobs (
    -- Primary key
    id TEXT PRIMARY KEY,
    
    -- Reference to parent clip
    clip_id TEXT NOT NULL,
    
    -- Asset type for filtering and display
    type TEXT NOT NULL CHECK (type IN ('screenshot', 'image', 'video', 'background')),
    
    -- MIME type for proper rendering
    mime_type TEXT NOT NULL,
    
    -- Binary data (stored as BLOB in SQLite)
    -- For very large assets, consider external storage with path reference instead
    data BLOB NOT NULL,
    
    -- Original source URL (for images/videos extracted from the page)
    original_url TEXT,
    
    -- File size for quota management
    size_bytes INTEGER,
    
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- Foreign key to element_clips
    FOREIGN KEY (clip_id) REFERENCES element_clips(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Table: webpages
-- Stores full webpage snapshots (for page-level clips, not element-specific)
-- Used for storing complete page content with metadata
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webpages (
    -- Primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Page identification
    url TEXT NOT NULL,
    title TEXT,
    
    -- Content (stored as text, can be large)
    dom_content TEXT,
    text_content TEXT,
    
    -- Metadata (stored as JSON string)
    metadata TEXT,  -- JSON: Record<string, unknown>
    highlights TEXT,  -- JSON: Highlight[]

    -- HTTP response metadata
    status_code INTEGER,
    content_type TEXT,
    content_length INTEGER,
    last_modified TEXT,
    
    -- Timestamps
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Table: embedding_chunks
-- Stores text chunks from webpages for vector/embedding search
-- These are stored separately to enable semantic search across page content
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS embedding_chunks (
    -- Primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Reference to parent webpage
    webpage_id INTEGER NOT NULL,
    
    -- Chunk content and position
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    start_position INTEGER,
    end_position INTEGER,
    
    -- Embedding vector (stored as BLOB)
    embedding_vector BLOB,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to webpages
    FOREIGN KEY (webpage_id) REFERENCES webpages(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Indexes for common query patterns
-- -----------------------------------------------------------------------------

-- Find clips by source URL (e.g., "all clips from this page")
CREATE INDEX IF NOT EXISTS idx_element_clips_url ON element_clips(url);

-- Sort clips by creation date (most recent first)
CREATE INDEX IF NOT EXISTS idx_element_clips_created_at ON element_clips(created_at DESC);

-- Filter clips by sync status (e.g., find all pending uploads)
CREATE INDEX IF NOT EXISTS idx_element_clips_sync_status ON element_clips(sync_status);

-- Find all blobs for a clip (for loading clip detail view)
CREATE INDEX IF NOT EXISTS idx_clip_blobs_clip_id ON clip_blobs(clip_id);

-- Find blobs by type (e.g., "get all screenshots")
CREATE INDEX IF NOT EXISTS idx_clip_blobs_type ON clip_blobs(type);

-- Find clips by AI summary status (for processing queue)
CREATE INDEX IF NOT EXISTS idx_element_clips_ai_status ON element_clips(ai_summary_status);

-- Find webpages by URL (e.g., "check if page already captured")
CREATE INDEX IF NOT EXISTS idx_webpages_url ON webpages(url);

-- Sort webpages by capture date (most recent first)
CREATE INDEX IF NOT EXISTS idx_webpages_captured_at ON webpages(captured_at);

-- Find all chunks for a webpage (for loading embeddings)
CREATE INDEX IF NOT EXISTS idx_embedding_chunks_webpage_id ON embedding_chunks(webpage_id);

-- Find chunks by index (for ordered retrieval)
CREATE INDEX IF NOT EXISTS idx_embedding_chunks_chunk_index ON embedding_chunks(chunk_index);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Auto-update updated_at timestamp for element_clips
CREATE TRIGGER IF NOT EXISTS element_clips_updated_at
AFTER UPDATE ON element_clips
FOR EACH ROW
BEGIN
    UPDATE element_clips SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Auto-update updated_at timestamp for webpages
CREATE TRIGGER IF NOT EXISTS webpages_updated_at
AFTER UPDATE ON webpages
FOR EACH ROW
BEGIN
    UPDATE webpages SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- -----------------------------------------------------------------------------
-- Views for common queries
-- -----------------------------------------------------------------------------

-- Clips with their screenshot data (for list views with thumbnails)
CREATE VIEW IF NOT EXISTS element_clips_with_screenshot AS
SELECT 
    c.*,
    b.data as screenshot_data,
    b.mime_type as screenshot_mime_type
FROM element_clips c
LEFT JOIN clip_blobs b ON b.clip_id = c.id AND b.type = 'screenshot';

-- Clip summary for list views (lightweight, no binary data)
CREATE VIEW IF NOT EXISTS element_clips_summary AS
SELECT 
    id,
    url,
    page_title,
    selector,
    ai_title,
    ai_description,
    ai_summary_status,
    created_at,
    updated_at,
    sync_status,
    (SELECT COUNT(*) FROM clip_blobs WHERE clip_id = element_clips.id) as blob_count
FROM element_clips;