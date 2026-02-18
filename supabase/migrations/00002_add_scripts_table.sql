-- ============================================================================
-- 多文档剧本归组 - 新增 scripts 表及 script_id 外键
-- ============================================================================

-- ============================================================================
-- 1. 创建 scripts 表
-- ============================================================================

CREATE TABLE scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scripts_created_at ON scripts(created_at);

-- ============================================================================
-- 2. 为 documents 表添加 script_id 外键
-- ============================================================================

ALTER TABLE documents
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;

CREATE INDEX idx_documents_script_id ON documents(script_id);

-- ============================================================================
-- 3. 为 13 张结构化数据表各添加 script_id 外键和索引
-- ============================================================================

-- tricks
ALTER TABLE tricks
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;
CREATE INDEX idx_tricks_script_id ON tricks(script_id);

-- characters
ALTER TABLE characters
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;
CREATE INDEX idx_characters_script_id ON characters(script_id);

-- script_structures
ALTER TABLE script_structures
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;
CREATE INDEX idx_script_structures_script_id ON script_structures(script_id);

-- story_backgrounds
ALTER TABLE story_backgrounds
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;
CREATE INDEX idx_story_backgrounds_script_id ON story_backgrounds(script_id);

-- script_formats
ALTER TABLE script_formats
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;
CREATE INDEX idx_script_formats_script_id ON script_formats(script_id);

-- player_scripts
ALTER TABLE player_scripts
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;
CREATE INDEX idx_player_scripts_script_id ON player_scripts(script_id);

-- clues
ALTER TABLE clues
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;
CREATE INDEX idx_clues_script_id ON clues(script_id);

-- reasoning_chains
ALTER TABLE reasoning_chains
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;
CREATE INDEX idx_reasoning_chains_script_id ON reasoning_chains(script_id);

-- misdirections
ALTER TABLE misdirections
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;
CREATE INDEX idx_misdirections_script_id ON misdirections(script_id);

-- script_metadata
ALTER TABLE script_metadata
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;
CREATE INDEX idx_script_metadata_script_id ON script_metadata(script_id);

-- game_mechanics
ALTER TABLE game_mechanics
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;
CREATE INDEX idx_game_mechanics_script_id ON game_mechanics(script_id);

-- narrative_techniques
ALTER TABLE narrative_techniques
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;
CREATE INDEX idx_narrative_techniques_script_id ON narrative_techniques(script_id);

-- emotional_designs
ALTER TABLE emotional_designs
  ADD COLUMN script_id uuid REFERENCES scripts(id) ON DELETE SET NULL;
CREATE INDEX idx_emotional_designs_script_id ON emotional_designs(script_id);
