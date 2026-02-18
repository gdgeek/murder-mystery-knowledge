# 需求文档：多文档剧本归组

## 简介

当前剧本杀知识库系统将每个上传的 PDF 视为独立文档。然而，一个剧本杀剧本通常由多个 PDF 文件组成（如主持人手册、各玩家剧本、线索卡等）。本功能引入「剧本」（Script）作为顶层聚合实体，将多个 PDF 文档归组到同一剧本下，并在提取、去重、搜索和聊天等环节实现跨文档的剧本维度聚合。

## 术语表

- **Script（剧本）**：顶层聚合实体，代表一个完整的剧本杀作品，包含多个 PDF 文档
- **Document（文档）**：单个上传的 PDF 文件，隶属于某个剧本
- **Upload_UI（上传界面）**：用户上传 PDF 文件并管理剧本归组的前端页面
- **Extraction_Pipeline（提取管线）**：从文档块中提取结构化数据的后端流程
- **Search_Service（搜索服务）**：执行结构化搜索和语义搜索的后端服务
- **Documents_API（文档接口）**：返回文档列表的后端 API
- **Scripts_API（剧本接口）**：管理剧本 CRUD 操作的后端 API
- **Upload_API（上传接口）**：处理文件上传的后端 API

## 需求

### 需求 1：剧本实体管理

**用户故事：** 作为知识库用户，我希望能创建和管理剧本实体，以便将多个相关 PDF 文档归组到同一剧本下。

#### 验收标准

1. THE Scripts_API SHALL 提供创建剧本的端点，接受剧本名称和可选描述
2. THE Scripts_API SHALL 提供查询剧本列表的端点，返回每个剧本的名称、描述、创建时间和关联文档数量
3. THE Scripts_API SHALL 提供查询单个剧本详情的端点，返回剧本信息及其关联的所有文档
4. WHEN 创建剧本时名称为空, THEN THE Scripts_API SHALL 返回验证错误
5. THE 数据库 SHALL 包含 scripts 表，具有 id、name、description 和 created_at 字段

### 需求 2：文档与剧本关联

**用户故事：** 作为知识库用户，我希望上传的文档能关联到指定剧本，以便系统知道哪些文档属于同一剧本。

#### 验收标准

1. THE documents 表 SHALL 包含可空的 script_id 外键，引用 scripts 表
2. WHEN 上传文档时指定了 script_id, THEN THE Upload_API SHALL 将该文档关联到对应剧本
3. WHEN 上传文档时未指定 script_id, THEN THE Upload_API SHALL 正常创建文档，script_id 保持为空
4. THE Documents_API SHALL 在文档列表中返回每个文档所属的剧本名称（如有）
5. WHEN 查询某剧本下的文档时, THEN THE Documents_API SHALL 仅返回属于该剧本的文档

### 需求 3：结构化数据的剧本维度关联

**用户故事：** 作为知识库用户，我希望所有提取的结构化数据同时关联到剧本和文档，以便在剧本维度进行聚合查询。

#### 验收标准

1. THE 所有结构化数据表（tricks、characters、clues 等共 13 张表）SHALL 各自新增可空的 script_id 外键
2. WHEN Extraction_Pipeline 存储提取结果时, THEN THE Extraction_Pipeline SHALL 从文档记录中查找 script_id 并写入结构化数据行
3. WHEN 文档未关联剧本时, THEN THE Extraction_Pipeline SHALL 将结构化数据的 script_id 保持为空

### 需求 4：批量上传与剧本归组界面

**用户故事：** 作为知识库用户，我希望在上传界面中选择或创建剧本，然后批量上传多个 PDF 文件，以便高效地将多个文档归组到同一剧本。

#### 验收标准

1. WHEN 用户进入上传页面, THEN THE Upload_UI SHALL 显示剧本选择器，包含已有剧本列表和「新建剧本」选项
2. WHEN 用户选择「新建剧本」, THEN THE Upload_UI SHALL 显示剧本名称和描述的输入表单
3. WHEN 用户选择已有剧本或创建新剧本后, THEN THE Upload_UI SHALL 允许用户拖拽或选择多个 PDF 文件进行批量上传
4. WHEN 批量上传多个文件时, THEN THE Upload_UI SHALL 逐个上传文件并显示每个文件的独立上传进度
5. WHEN 用户未选择任何剧本时, THEN THE Upload_UI SHALL 仍允许上传单个文件（保持向后兼容）
6. IF 批量上传中某个文件失败, THEN THE Upload_UI SHALL 继续上传剩余文件并标记失败文件的错误信息

### 需求 5：跨文档去重

**用户故事：** 作为知识库用户，我希望同一剧本下不同文档中出现的相同角色和诡计能被自动去重，以避免重复数据。

#### 验收标准

1. WHEN 提取角色或诡计时, THEN THE Extraction_Pipeline SHALL 在同一 script_id 范围内按名称进行去重
2. WHEN 文档未关联剧本时, THEN THE Extraction_Pipeline SHALL 退回到按 document_id 范围去重（保持现有行为）
3. WHEN 同一剧本下多个文档包含同名角色时, THEN THE Extraction_Pipeline SHALL 仅保留第一次出现的记录

### 需求 6：搜索结果的剧本维度聚合

**用户故事：** 作为知识库用户，我希望搜索结果能按剧本维度聚合展示，以便快速了解某个剧本的整体信息。

#### 验收标准

1. THE Search_Service 的结构化搜索 SHALL 支持按 script_id 过滤结果
2. THE Search_Service 的搜索结果 SHALL 在来源信息中包含剧本名称（如有）
3. WHEN 搜索 API 接收到 script_id 过滤条件时, THEN THE Search_Service SHALL 仅返回属于该剧本的结果

### 需求 7：剧本列表展示

**用户故事：** 作为知识库用户，我希望在文档列表页面能看到按剧本分组的文档视图，以便直观了解每个剧本包含哪些文档。

#### 验收标准

1. THE Documents_API SHALL 支持按剧本分组返回文档列表
2. WHEN 文档列表按剧本分组时, THEN THE Documents_API SHALL 返回每个剧本的名称、文档数量和文档详情
3. WHEN 存在未归组的文档时, THEN THE Documents_API SHALL 将未归组文档单独归入「未归组」分类
