-- ============================================================
-- Migration: 011_documents
-- Description: Document/knowledge base system.
-- Raw files stored on R2, metadata + AI summaries in Supabase.
-- Enables Obsidian-like neural knowledge graph within notes.
-- ============================================================

-- Documents (file metadata + AI-generated knowledge)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- File identity
    filename TEXT NOT NULL,                          -- Original filename (e.g. "Q2_report.pdf")
    file_hash TEXT NOT NULL,                         -- SHA-256 of file content (dedup)
    mime_type TEXT NOT NULL,                          -- MIME type
    file_size BIGINT NOT NULL,                       -- Size in bytes

    -- R2 storage
    r2_key TEXT NOT NULL,                             -- R2 object key (path in bucket)

    -- AI-generated knowledge (populated after processing)
    summary TEXT,                                     -- One-line AI summary
    key_points TEXT,                                  -- Markdown key points / structured notes
    content_text TEXT,                                -- Extracted plain text (for search)
    tags TEXT[] DEFAULT '{}',                          -- AI-suggested + user tags

    -- Processing state
    processing_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    processing_error TEXT,                            -- Error message if failed
    processed_at TIMESTAMPTZ,                         -- When AI processing completed

    -- Metadata
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(user_id, file_hash)                        -- One file per hash per user
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_filename ON public.documents(user_id, filename);
CREATE INDEX IF NOT EXISTS idx_documents_user_hash ON public.documents(user_id, file_hash);
CREATE INDEX IF NOT EXISTS idx_documents_user_status ON public.documents(user_id, processing_status);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own documents" ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own documents" ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documents" ON public.documents FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trigger_update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Document Links (many-to-many: notes <-> documents)
-- Created when a user references a document in a note via /file
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(note_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_document_links_note ON public.document_links(note_id);
CREATE INDEX IF NOT EXISTS idx_document_links_document ON public.document_links(document_id);
ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own document links"
    ON public.document_links FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.notes WHERE id = document_links.note_id AND user_id = auth.uid()));

CREATE POLICY "Users can insert their own document links"
    ON public.document_links FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.notes WHERE id = document_links.note_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete their own document links"
    ON public.document_links FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.notes WHERE id = document_links.note_id AND user_id = auth.uid()));
