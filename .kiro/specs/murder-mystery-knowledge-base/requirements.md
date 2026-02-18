# 需求文档

## 简介

剧本杀知识库系统是一个基于 AI 的文档处理与知识管理平台，其核心目标是为后续 AI 生成剧本杀提供全面的知识基础。系统能够读取大量剧本杀 PDF 文档，利用 LLM 自动提取结构化信息（剧本元数据、诡计与案例、角色信息、剧本结构、故事背景、剧本格式、推理与线索系统、游戏机制、叙事技法与情感设计等），将数据存入关系型数据库和向量数据库，并支持多维度结构化查询与语义搜索的混合检索，以及基于知识库的智能问答。

参考架构来自 [ai-pdf-chatbot-langchain](https://github.com/mayooear/ai-pdf-chatbot-langchain)，采用 Next.js + LangGraph + Supabase + OpenAI 技术栈，并在此基础上增加结构化信息提取环节和混合检索能力。

## 术语表

- **知识库系统（Knowledge_Base_System）**：整个剧本杀知识库平台，包含前端、后端、数据库和 AI 工作流
- **摄入管线（Ingestion_Pipeline）**：负责 PDF 文档上传、解析、分块和向量化存储的工作流
- **提取管线（Extraction_Pipeline）**：负责使用 LLM 从文档文本中按预定义 Schema 提取结构化数据的工作流
- **检索管线（Retrieval_Pipeline）**：负责接收用户查询，执行混合检索（结构化查询 + 语义搜索），并生成回答的工作流
- **诡计（Trick）**：剧本杀中的作案手法，包括密室设计、不在场证明构造、凶器隐藏等
- **角色（Character）**：剧本杀中的人物，包含姓名、身份、动机、与其他角色的关系等
- **剧本结构（Script_Structure）**：剧本的叙事框架，包括时间线、场景列表、线索分布等
- **故事背景（Story_Background）**：剧本的世界观设定，包括时代、地点、社会环境等
- **剧本格式（Script_Format）**：剧本的编排格式信息，包括分幕结构、各幕内容组成、每个玩家的剧本字数、排版风格等
- **幕（Act）**：剧本的主要叙事单元，一个剧本通常分为多幕，每幕包含不同的剧情阶段和玩家行动
- **玩家剧本（Player_Script）**：分配给单个玩家角色的独立剧本文本，包含该角色视角的故事、线索和任务
- **线索（Clue）**：剧本中用于推动推理的信息片段，包含名称、类型、位置、关联角色和指向性
- **推理链（Reasoning_Chain）**：从线索到结论的逻辑推导路径，描述玩家如何通过线索组合得出推理结果
- **误导手段（Misdirection）**：剧本中故意设置的干扰信息或虚假线索，用于增加推理难度
- **游戏机制（Game_Mechanics）**：剧本杀的玩法规则和互动机制，包括玩法类型、特殊环节、技能系统等
- **叙事技法（Narrative_Technique）**：剧本杀中使用的写作和叙事手法，包括叙事视角、叙事结构、悬念设置、伏笔与呼应等
- **情感设计（Emotional_Design）**：剧本中针对玩家情感体验的设计，包括角色情感弧线、情感高潮点分布、目标情感类型等
- **剧本元数据（Script_Metadata）**：剧本的基础描述信息，包括剧本名称、作者、发行商、发行年份、适合人数、游戏时长、难度评级、剧本类型标签等
- **混合检索（Hybrid_Retrieval）**：结合关系型数据库的结构化查询与向量数据库的语义搜索的检索方式
- **文档块（Document_Chunk）**：PDF 文档经过分割后的文本片段，用于向量化和语义搜索

## 需求

### 需求 1：PDF 文档上传与解析

**用户故事：** 作为知识库管理员，我希望上传剧本杀 PDF 文档并自动解析其内容，以便系统能够处理和存储文档信息。

#### 验收标准

1. WHEN 管理员通过前端界面上传一个或多个 PDF 文件，THE Ingestion_Pipeline SHALL 接收文件并启动文档处理流程
2. WHEN Ingestion_Pipeline 接收到 PDF 文件，THE Ingestion_Pipeline SHALL 提取文档中的全部文本内容
3. WHEN 文本内容被提取后，THE Ingestion_Pipeline SHALL 将文本按语义边界分割为 Document_Chunk，每个 Document_Chunk 保留来源文档的元数据（文件名、页码范围）
4. WHEN Document_Chunk 生成完毕，THE Ingestion_Pipeline SHALL 调用 OpenAI Embedding API 将每个 Document_Chunk 转换为向量，并存入 Supabase 向量数据库
5. IF 上传的文件不是有效的 PDF 格式，THEN THE Knowledge_Base_System SHALL 返回明确的错误提示，说明文件格式不受支持
6. IF PDF 文件内容为空或无法提取文本，THEN THE Knowledge_Base_System SHALL 返回错误提示，说明文档内容无法解析

### 需求 2：结构化信息提取——诡计与案例

**用户故事：** 作为知识库管理员，我希望系统能从剧本杀文档中自动提取诡计与案例信息，以便构建可查询的诡计知识库。

#### 验收标准

1. WHEN Document_Chunk 生成完毕，THE Extraction_Pipeline SHALL 使用 LLM 按照预定义的 Trick Schema 从文本中提取诡计数据
2. WHEN 提取 Trick 信息时，THE Extraction_Pipeline SHALL 识别并提取诡计名称、类型（密室、不在场证明、凶器隐藏、毒杀、伪装、其他）、核心机制描述、关键要素列表、破绽描述和所属剧本引用
3. WHEN Trick 数据提取完成，THE Extraction_Pipeline SHALL 将提取结果存入关系型数据库，并建立与源 Document_Chunk 的关联
4. IF LLM 对某个 Trick 字段的提取置信度低于阈值，THEN THE Extraction_Pipeline SHALL 将该字段标记为"待审核"状态

### 需求 3：结构化信息提取——角色信息

**用户故事：** 作为知识库管理员，我希望系统能从剧本杀文档中自动提取角色信息，以便构建角色关系网络。

#### 验收标准

1. WHEN Document_Chunk 生成完毕，THE Extraction_Pipeline SHALL 使用 LLM 按照预定义的 Character Schema 从文本中提取角色数据
2. WHEN 提取 Character 信息时，THE Extraction_Pipeline SHALL 识别并提取角色名称、身份标签（凶手、侦探、嫌疑人、受害者、NPC）、动机描述、性格特征列表和与其他 Character 的关系列表（含关系类型和关系描述）
3. WHEN Character 数据提取完成，THE Extraction_Pipeline SHALL 将提取结果存入关系型数据库，并建立与源 Document_Chunk 的关联
4. IF LLM 对某个 Character 字段的提取置信度低于阈值，THEN THE Extraction_Pipeline SHALL 将该字段标记为"待审核"状态

### 需求 4：结构化信息提取——剧本结构

**用户故事：** 作为知识库管理员，我希望系统能从剧本杀文档中自动提取剧本结构信息，以便分析剧本的叙事框架。

#### 验收标准

1. WHEN Document_Chunk 生成完毕，THE Extraction_Pipeline SHALL 使用 LLM 按照预定义的 Script_Structure Schema 从文本中提取剧本结构数据
2. WHEN 提取 Script_Structure 信息时，THE Extraction_Pipeline SHALL 识别并提取时间线事件列表（含时间戳和事件描述）、场景列表（含场景名称和场景描述）、Act 数量及每个 Act 的名称和主题
3. WHEN Script_Structure 数据提取完成，THE Extraction_Pipeline SHALL 将提取结果存入关系型数据库，并建立与源 Document_Chunk 的关联
4. IF LLM 对某个 Script_Structure 字段的提取置信度低于阈值，THEN THE Extraction_Pipeline SHALL 将该字段标记为"待审核"状态

### 需求 5：结构化信息提取——故事背景

**用户故事：** 作为知识库管理员，我希望系统能从剧本杀文档中自动提取故事背景信息，以便按时代和地点分类管理剧本。

#### 验收标准

1. WHEN Document_Chunk 生成完毕，THE Extraction_Pipeline SHALL 使用 LLM 按照预定义的 Story_Background Schema 从文本中提取故事背景数据
2. WHEN 提取 Story_Background 信息时，THE Extraction_Pipeline SHALL 识别并提取时代设定、地理位置、世界观描述和社会环境描述
3. WHEN Story_Background 数据提取完成，THE Extraction_Pipeline SHALL 将提取结果存入关系型数据库，并建立与源 Document_Chunk 的关联
4. IF LLM 对某个 Story_Background 字段的提取置信度低于阈值，THEN THE Extraction_Pipeline SHALL 将该字段标记为"待审核"状态

### 需求 6：结构化信息提取——剧本格式与玩家剧本

**用户故事：** 作为知识库管理员，我希望系统能从剧本杀文档中自动提取剧本格式和玩家剧本信息，以便分析剧本的编排方式。

#### 验收标准

1. WHEN Document_Chunk 生成完毕，THE Extraction_Pipeline SHALL 使用 LLM 按照预定义的 Script_Format Schema 从文本中提取剧本格式数据
2. WHEN 提取 Script_Format 信息时，THE Extraction_Pipeline SHALL 识别并提取分幕数量及每幕的名称和主题、每幕包含的内容组成部分（剧情描述、线索卡、任务卡、投票环节等）、剧本整体排版风格（是否有独立线索册、是否有公共信息页等）
3. WHEN 提取 Player_Script 信息时，THE Extraction_Pipeline SHALL 识别并提取每个 Player_Script 所包含的部分（角色背景、各幕剧情、角色任务、角色线索、角色关系提示等）及各部分的字数统计
4. WHEN Script_Format 和 Player_Script 数据提取完成，THE Extraction_Pipeline SHALL 将提取结果存入关系型数据库，并建立与源 Document_Chunk 的关联
5. IF LLM 对某个 Script_Format 或 Player_Script 字段的提取置信度低于阈值，THEN THE Extraction_Pipeline SHALL 将该字段标记为"待审核"状态

### 需求 7：结构化信息提取——推理与线索系统

**用户故事：** 作为知识库管理员，我希望系统能从剧本杀文档中自动提取推理与线索系统信息，以便分析剧本的推理设计质量。

#### 验收标准

1. WHEN Document_Chunk 生成完毕，THE Extraction_Pipeline SHALL 使用 LLM 按照预定义的 Clue Schema 从文本中提取线索数据
2. WHEN 提取 Clue 信息时，THE Extraction_Pipeline SHALL 识别并提取线索名称、线索类型（物证、证言、文件、环境线索）、获取位置、关联 Character 列表、指向性描述（该线索指向的嫌疑人或事件）
3. WHEN 提取 Reasoning_Chain 信息时，THE Extraction_Pipeline SHALL 识别并提取推理链名称、起始线索列表、推理步骤序列（每步包含输入线索和推导结论）、最终结论
4. WHEN 提取 Misdirection 信息时，THE Extraction_Pipeline SHALL 识别并提取误导手段名称、类型（虚假线索、时间误导、身份伪装、动机误导）、目标（误导玩家相信的错误结论）、破解方式描述
5. WHEN 推理与线索数据提取完成，THE Extraction_Pipeline SHALL 将提取结果存入关系型数据库，并建立与源 Document_Chunk 和相关 Character、Trick 的关联
6. IF LLM 对某个 Clue、Reasoning_Chain 或 Misdirection 字段的提取置信度低于阈值，THEN THE Extraction_Pipeline SHALL 将该字段标记为"待审核"状态

### 需求 8：结构化信息提取——剧本元数据

**用户故事：** 作为知识库管理员，我希望系统能从剧本杀文档中自动提取剧本元数据，以便按基础维度分类和筛选剧本。

#### 验收标准

1. WHEN Document_Chunk 生成完毕，THE Extraction_Pipeline SHALL 使用 LLM 按照预定义的 Script_Metadata Schema 从文本中提取剧本元数据
2. WHEN 提取 Script_Metadata 信息时，THE Extraction_Pipeline SHALL 识别并提取剧本名称、作者、发行商、发行年份、适合人数（最小和最大）、预估游戏时长、难度评级（新手、进阶、硬核）、剧本类型标签列表（硬核推理、情感沉浸、阵营对抗、机制本、恐怖、欢乐等）
3. WHEN Script_Metadata 数据提取完成，THE Extraction_Pipeline SHALL 将提取结果存入关系型数据库，并建立与源文档的关联
4. IF LLM 对某个 Script_Metadata 字段的提取置信度低于阈值，THEN THE Extraction_Pipeline SHALL 将该字段标记为"待审核"状态

### 需求 9：结构化信息提取——游戏机制

**用户故事：** 作为知识库管理员，我希望系统能从剧本杀文档中自动提取游戏机制信息，以便分析不同剧本的玩法设计。

#### 验收标准

1. WHEN Document_Chunk 生成完毕，THE Extraction_Pipeline SHALL 使用 LLM 按照预定义的 Game_Mechanics Schema 从文本中提取游戏机制数据
2. WHEN 提取 Game_Mechanics 信息时，THE Extraction_Pipeline SHALL 识别并提取核心玩法类型（推理投凶、阵营对抗、任务达成等）、特殊环节列表（搜证环节、私聊环节、投票环节、技能使用环节等，每个环节含名称、规则描述和触发时机）、胜利条件描述（按角色类型分别描述）
3. WHEN Game_Mechanics 数据提取完成，THE Extraction_Pipeline SHALL 将提取结果存入关系型数据库，并建立与源 Document_Chunk 的关联
4. IF LLM 对某个 Game_Mechanics 字段的提取置信度低于阈值，THEN THE Extraction_Pipeline SHALL 将该字段标记为"待审核"状态

### 需求 10：结构化信息提取——叙事技法与情感设计

**用户故事：** 作为知识库管理员，我希望系统能从剧本杀文档中自动提取叙事技法和情感设计信息，以便为 AI 生成高质量剧本提供写作参考。

#### 验收标准

1. WHEN Document_Chunk 生成完毕，THE Extraction_Pipeline SHALL 使用 LLM 按照预定义的 Narrative_Technique Schema 从文本中提取叙事技法数据
2. WHEN 提取 Narrative_Technique 信息时，THE Extraction_Pipeline SHALL 识别并提取叙事视角（第一人称、第三人称、多视角切换）、叙事结构类型（线性、非线性、多线交织、倒叙）、悬念设置手法列表（每个含手法名称和应用描述）、伏笔与呼应列表（每个含伏笔内容、呼应位置和效果描述）
3. WHEN 提取 Emotional_Design 信息时，THE Extraction_Pipeline SHALL 识别并提取目标情感类型列表（恐惧、感动、紧张、悬疑、欢乐等）、情感高潮点列表（每个含所在 Act、触发事件和目标情感）、角色情感弧线列表（每个含 Character 引用、情感变化阶段序列）
4. WHEN Narrative_Technique 和 Emotional_Design 数据提取完成，THE Extraction_Pipeline SHALL 将提取结果存入关系型数据库，并建立与源 Document_Chunk 的关联
5. IF LLM 对某个 Narrative_Technique 或 Emotional_Design 字段的提取置信度低于阈值，THEN THE Extraction_Pipeline SHALL 将该字段标记为"待审核"状态

### 需求 11：结构化数据存储与管理

**用户故事：** 作为知识库管理员，我希望提取的结构化数据被妥善存储和管理，以便支持高效的多维度查询。

#### 验收标准

1. THE Knowledge_Base_System SHALL 使用 Supabase PostgreSQL 存储所有结构化数据，包括 Script_Metadata、Trick、Character、Script_Structure、Story_Background、Script_Format、Player_Script、Clue、Reasoning_Chain、Misdirection、Game_Mechanics、Narrative_Technique 和 Emotional_Design
2. THE Knowledge_Base_System SHALL 为每条结构化数据记录维护与源文档和源 Document_Chunk 的关联关系
3. WHEN 同一 Character 或 Trick 出现在多个剧本中，THE Knowledge_Base_System SHALL 支持跨剧本的数据关联和去重
4. THE Knowledge_Base_System SHALL 为 Trick 类型、Character 身份标签、Story_Background 时代设定、Clue 类型、Misdirection 类型、Script_Metadata 剧本类型标签、Game_Mechanics 核心玩法类型、Narrative_Technique 叙事结构类型等高频查询字段建立数据库索引

### 需求 12：多维度检索与查询

**用户故事：** 作为用户，我希望通过多种方式检索知识库中的信息，以便快速找到所需的剧本杀知识。

#### 验收标准

1. WHEN 用户提交结构化查询条件（如 Trick 类型、Character 身份、Story_Background 时代设定、Act 数量、Player_Script 字数范围、Clue 类型、Misdirection 类型、Script_Metadata 剧本类型标签、Script_Metadata 适合人数、Game_Mechanics 核心玩法类型、Narrative_Technique 叙事结构类型），THE Retrieval_Pipeline SHALL 在关系型数据库中执行精确匹配查询并返回结果
2. WHEN 用户提交自然语言查询，THE Retrieval_Pipeline SHALL 将查询文本向量化，在向量数据库中执行语义相似度搜索并返回相关 Document_Chunk
3. WHEN 用户的查询同时包含结构化条件和自然语言描述，THE Retrieval_Pipeline SHALL 执行 Hybrid_Retrieval，将结构化查询结果与语义搜索结果合并排序后返回
4. WHEN 返回检索结果时，THE Retrieval_Pipeline SHALL 包含结果的来源信息（源剧本名称、页码）和相关度评分
5. IF 检索结果为空，THEN THE Retrieval_Pipeline SHALL 返回提示信息，建议用户调整查询条件

### 需求 13：智能问答与聊天

**用户故事：** 作为用户，我希望通过聊天界面与知识库进行自然语言交互，获取关于剧本杀的专业回答。

#### 验收标准

1. WHEN 用户在聊天界面发送问题，THE Retrieval_Pipeline SHALL 分析问题意图，执行相应的检索策略，并使用 LLM 基于检索结果生成回答
2. WHEN 生成回答时，THE Retrieval_Pipeline SHALL 以流式方式将回答内容逐步返回给前端，减少用户等待时间
3. WHEN 回答中引用了知识库内容，THE Retrieval_Pipeline SHALL 在回答中标注引用来源（剧本名称、具体章节或页码）
4. WHILE 用户处于同一聊天会话中，THE Knowledge_Base_System SHALL 维护对话上下文，支持多轮对话和追问
5. IF 用户的问题超出知识库覆盖范围，THEN THE Retrieval_Pipeline SHALL 明确告知用户当前知识库中没有相关信息，避免生成无依据的回答

### 需求 14：前端用户界面

**用户故事：** 作为用户，我希望通过直观的 Web 界面使用知识库系统的所有功能。

#### 验收标准

1. THE Knowledge_Base_System SHALL 提供基于 Next.js 和 React 的 Web 前端界面
2. THE Knowledge_Base_System SHALL 在前端提供文档上传区域，支持拖拽上传和文件选择，并显示上传进度和处理状态
3. THE Knowledge_Base_System SHALL 在前端提供聊天界面，支持用户输入自然语言问题并实时显示流式回答
4. THE Knowledge_Base_System SHALL 在前端提供结构化检索界面，支持按 Trick 类型、Character 身份、Story_Background 时代设定、Act 数量、Player_Script 字数范围、Clue 类型、Misdirection 类型、Script_Metadata 剧本类型标签、Script_Metadata 适合人数、Game_Mechanics 核心玩法类型、Narrative_Technique 叙事结构类型等条件进行筛选查询
5. WHEN 检索结果返回时，THE Knowledge_Base_System SHALL 在前端以卡片或列表形式展示结果，包含摘要信息和来源引用

### 需求 15：AI 工作流编排与可观测性

**用户故事：** 作为开发者，我希望 AI 工作流具有清晰的编排结构和可观测性，以便调试和优化系统。

#### 验收标准

1. THE Knowledge_Base_System SHALL 使用 LangGraph 编排三条核心工作流：Ingestion_Pipeline、Extraction_Pipeline 和 Retrieval_Pipeline
2. WHEN 任意工作流执行时，THE Knowledge_Base_System SHALL 通过 LangSmith 记录每个节点的输入输出和执行耗时
3. IF 工作流中任一节点执行失败，THEN THE Knowledge_Base_System SHALL 记录错误详情并支持从失败节点重试
