-- ============================================================================
-- 剧本杀知识库系统 - 初始数据库迁移
-- 启用 pgvector 扩展，创建所有表、外键约束和索引
-- ============================================================================

-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 核心文档表
-- ============================================================================

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'parsing', 'chunking', 'embedding', 'extracting', 'completed', 'failed')),
  page_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536),
  page_start integer NOT NULL,
  page_end integer NOT NULL,
  chunk_index integer NOT NULL
);

-- ============================================================================
-- 剧本元数据
-- ============================================================================

CREATE TABLE script_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  title text,
  author text,
  publisher text,
  publish_year integer,
  min_players integer,
  max_players integer,
  duration_minutes integer,
  difficulty text CHECK (difficulty IN ('beginner', 'intermediate', 'hardcore')),
  confidence jsonb,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('approved', 'pending_review'))
);

CREATE TABLE script_metadata_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_metadata_id uuid NOT NULL REFERENCES script_metadata(id) ON DELETE CASCADE,
  tag text NOT NULL
);


-- ============================================================================
-- 诡计与案例
-- ============================================================================

CREATE TABLE tricks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  name text,
  type text CHECK (type IN ('locked_room', 'alibi', 'weapon_hiding', 'poisoning', 'disguise', 'other')),
  mechanism text,
  key_elements jsonb,
  weakness text,
  confidence jsonb,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('approved', 'pending_review'))
);

-- ============================================================================
-- 角色信息
-- ============================================================================

CREATE TABLE characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  name text,
  role text CHECK (role IN ('murderer', 'detective', 'suspect', 'victim', 'npc')),
  motivation text,
  personality_traits jsonb,
  confidence jsonb,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('approved', 'pending_review'))
);

CREATE TABLE character_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  related_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  relationship_type text,
  description text
);

-- ============================================================================
-- 剧本结构
-- ============================================================================

CREATE TABLE script_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  confidence jsonb,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('approved', 'pending_review'))
);

CREATE TABLE timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_structure_id uuid NOT NULL REFERENCES script_structures(id) ON DELETE CASCADE,
  timestamp text,
  description text,
  sort_order integer NOT NULL
);

CREATE TABLE scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_structure_id uuid NOT NULL REFERENCES script_structures(id) ON DELETE CASCADE,
  name text,
  description text
);

CREATE TABLE acts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_structure_id uuid NOT NULL REFERENCES script_structures(id) ON DELETE CASCADE,
  name text,
  theme text,
  sort_order integer NOT NULL
);


-- ============================================================================
-- 故事背景
-- ============================================================================

CREATE TABLE story_backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  era text,
  location text,
  worldview text,
  social_environment text,
  confidence jsonb,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('approved', 'pending_review'))
);

-- ============================================================================
-- 剧本格式
-- ============================================================================

CREATE TABLE script_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  act_count integer,
  has_separate_clue_book boolean,
  has_public_info_page boolean,
  layout_style text,
  confidence jsonb,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('approved', 'pending_review'))
);

CREATE TABLE act_compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_format_id uuid NOT NULL REFERENCES script_formats(id) ON DELETE CASCADE,
  act_name text,
  act_theme text,
  components jsonb
);

-- ============================================================================
-- 玩家剧本
-- ============================================================================

CREATE TABLE player_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  character_name text,
  total_word_count integer,
  confidence jsonb,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('approved', 'pending_review'))
);

CREATE TABLE player_script_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_script_id uuid NOT NULL REFERENCES player_scripts(id) ON DELETE CASCADE,
  section_name text,
  word_count integer
);

-- ============================================================================
-- 线索系统
-- ============================================================================

CREATE TABLE clues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  name text,
  type text CHECK (type IN ('physical_evidence', 'testimony', 'document', 'environmental')),
  location text,
  direction text,
  confidence jsonb,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('approved', 'pending_review'))
);

CREATE TABLE clue_characters (
  clue_id uuid NOT NULL REFERENCES clues(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  PRIMARY KEY (clue_id, character_id)
);


-- ============================================================================
-- 推理链
-- ============================================================================

CREATE TABLE reasoning_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  name text,
  conclusion text,
  confidence jsonb,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('approved', 'pending_review'))
);

CREATE TABLE reasoning_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reasoning_chain_id uuid NOT NULL REFERENCES reasoning_chains(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  input_clues jsonb,
  deduction text
);

-- ============================================================================
-- 误导手段
-- ============================================================================

CREATE TABLE misdirections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  name text,
  type text CHECK (type IN ('false_clue', 'time_misdirection', 'identity_disguise', 'motive_misdirection')),
  target text,
  resolution text,
  confidence jsonb,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('approved', 'pending_review'))
);

-- ============================================================================
-- 游戏机制
-- ============================================================================

CREATE TABLE game_mechanics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  core_gameplay_type text,
  victory_conditions jsonb,
  confidence jsonb,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('approved', 'pending_review'))
);

CREATE TABLE special_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_mechanics_id uuid NOT NULL REFERENCES game_mechanics(id) ON DELETE CASCADE,
  name text,
  rules text,
  trigger_timing text
);

-- ============================================================================
-- 叙事技法
-- ============================================================================

CREATE TABLE narrative_techniques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  perspective text CHECK (perspective IN ('first_person', 'third_person', 'multi_perspective')),
  structure_type text CHECK (structure_type IN ('linear', 'nonlinear', 'multi_threaded', 'flashback')),
  confidence jsonb,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('approved', 'pending_review'))
);

CREATE TABLE suspense_techniques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  narrative_technique_id uuid NOT NULL REFERENCES narrative_techniques(id) ON DELETE CASCADE,
  name text,
  description text
);

CREATE TABLE foreshadowings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  narrative_technique_id uuid NOT NULL REFERENCES narrative_techniques(id) ON DELETE CASCADE,
  content text,
  echo_location text,
  effect text
);


-- ============================================================================
-- 情感设计
-- ============================================================================

CREATE TABLE emotional_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  target_emotions jsonb,
  confidence jsonb,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('approved', 'pending_review'))
);

CREATE TABLE emotional_climaxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emotional_design_id uuid NOT NULL REFERENCES emotional_designs(id) ON DELETE CASCADE,
  act_reference text,
  trigger_event text,
  target_emotion text
);

CREATE TABLE emotional_arcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emotional_design_id uuid NOT NULL REFERENCES emotional_designs(id) ON DELETE CASCADE,
  character_name text,
  phases jsonb
);

-- ============================================================================
-- 聊天会话
-- ============================================================================

CREATE TABLE chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  sources jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 索引：高频查询字段
-- ============================================================================

-- 文档表索引
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);

-- 剧本元数据索引
CREATE INDEX idx_script_metadata_document_id ON script_metadata(document_id);
CREATE INDEX idx_script_metadata_difficulty ON script_metadata(difficulty);
CREATE INDEX idx_script_metadata_tags_tag ON script_metadata_tags(tag);
CREATE INDEX idx_script_metadata_tags_script_metadata_id ON script_metadata_tags(script_metadata_id);

-- 诡计索引
CREATE INDEX idx_tricks_type ON tricks(type);
CREATE INDEX idx_tricks_document_id ON tricks(document_id);

-- 角色索引
CREATE INDEX idx_characters_role ON characters(role);
CREATE INDEX idx_characters_document_id ON characters(document_id);
CREATE INDEX idx_character_relationships_character_id ON character_relationships(character_id);

-- 剧本结构索引
CREATE INDEX idx_script_structures_document_id ON script_structures(document_id);
CREATE INDEX idx_timeline_events_script_structure_id ON timeline_events(script_structure_id);
CREATE INDEX idx_scenes_script_structure_id ON scenes(script_structure_id);
CREATE INDEX idx_acts_script_structure_id ON acts(script_structure_id);

-- 故事背景索引
CREATE INDEX idx_story_backgrounds_era ON story_backgrounds(era);
CREATE INDEX idx_story_backgrounds_document_id ON story_backgrounds(document_id);

-- 剧本格式索引
CREATE INDEX idx_script_formats_document_id ON script_formats(document_id);

-- 玩家剧本索引
CREATE INDEX idx_player_scripts_document_id ON player_scripts(document_id);

-- 线索索引
CREATE INDEX idx_clues_type ON clues(type);
CREATE INDEX idx_clues_document_id ON clues(document_id);

-- 推理链索引
CREATE INDEX idx_reasoning_chains_document_id ON reasoning_chains(document_id);
CREATE INDEX idx_reasoning_steps_reasoning_chain_id ON reasoning_steps(reasoning_chain_id);

-- 误导手段索引
CREATE INDEX idx_misdirections_type ON misdirections(type);
CREATE INDEX idx_misdirections_document_id ON misdirections(document_id);

-- 游戏机制索引
CREATE INDEX idx_game_mechanics_core_gameplay_type ON game_mechanics(core_gameplay_type);
CREATE INDEX idx_game_mechanics_document_id ON game_mechanics(document_id);
CREATE INDEX idx_special_phases_game_mechanics_id ON special_phases(game_mechanics_id);

-- 叙事技法索引
CREATE INDEX idx_narrative_techniques_structure_type ON narrative_techniques(structure_type);
CREATE INDEX idx_narrative_techniques_document_id ON narrative_techniques(document_id);
CREATE INDEX idx_suspense_techniques_narrative_technique_id ON suspense_techniques(narrative_technique_id);
CREATE INDEX idx_foreshadowings_narrative_technique_id ON foreshadowings(narrative_technique_id);

-- 情感设计索引
CREATE INDEX idx_emotional_designs_document_id ON emotional_designs(document_id);
CREATE INDEX idx_emotional_climaxes_emotional_design_id ON emotional_climaxes(emotional_design_id);
CREATE INDEX idx_emotional_arcs_emotional_design_id ON emotional_arcs(emotional_design_id);

-- 聊天索引
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
