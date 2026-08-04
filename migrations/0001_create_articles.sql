CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE articles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (length(btrim(slug)) > 0),
  source_path text NOT NULL UNIQUE CHECK (length(btrim(source_path)) > 0),
  content_markdown text NOT NULL,
  source_hash char(64) NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  excerpt text NOT NULL DEFAULT '',
  collection text NOT NULL CHECK (length(btrim(collection)) > 0),
  status text NOT NULL CHECK (status IN ('published', 'draft', 'archived')),
  published_at timestamptz NOT NULL,
  source_updated_at timestamptz NOT NULL CHECK (source_updated_at >= published_at),
  word_count integer NOT NULL CHECK (word_count >= 0),
  reading_minutes integer NOT NULL CHECK (reading_minutes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX articles_published_order_idx
  ON articles (published_at DESC, slug ASC)
  WHERE status = 'published';

CREATE INDEX articles_published_collection_idx
  ON articles (collection, published_at DESC, slug ASC)
  WHERE status = 'published';

-- pg_trgm tokenizes arbitrary character trigrams, so this expression index also
-- accelerates Chinese ILIKE searches without language-specific segmentation.
CREATE INDEX articles_published_search_trgm_idx
  ON articles USING gin (
    (title || E'\n' || excerpt || E'\n' || content_markdown) gin_trgm_ops
  )
  WHERE status = 'published';
