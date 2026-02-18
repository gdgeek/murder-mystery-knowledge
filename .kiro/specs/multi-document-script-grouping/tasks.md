# 实现计划：多文档剧本归组

## 概述

基于设计文档，将改动分为数据库迁移、后端服务/API、提取管线、搜索服务、前端 UI 五个阶段，逐步实现并测试。

## 任务

- [x] 1. 数据库迁移与数据模型
  - [x] 1.1 创建数据库迁移文件 `supabase/migrations/00002_add_scripts_table.sql`
    - 创建 `scripts` 表（id, name, description, created_at）
    - 为 `documents` 表添加 `script_id` 外键列和索引
    - 为 13 张结构化数据表各添加 `script_id` 外键列和索引
    - _Requirements: 1.5, 2.1, 3.1_

  - [x] 1.2 更新 Zod schema (`lib/schemas/index.ts`)
    - 为所有实体 schema 添加可选的 `script_id` 字段
    - 新增 `ScriptSchema` 定义
    - _Requirements: 1.5, 3.1_

- [x] 2. Scripts API 与 Document Service
  - [x] 2.1 创建 Scripts API (`app/api/scripts/route.ts`)
    - 实现 POST（创建剧本，含名称非空验证）和 GET（列表，含文档数量）
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 2.2 创建 Scripts 详情 API (`app/api/scripts/[id]/route.ts`)
    - 实现 GET（单个剧本详情，含关联文档列表）
    - _Requirements: 1.3_

  - [ ]* 2.3 编写 Scripts API 属性测试
    - **Property 1: 剧本 CRUD 往返一致性**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 2.4 修改 Document Service (`lib/services/document.ts`)
    - `createDocument` 增加可选 `scriptId` 参数
    - 新增 `listDocumentsByScriptId` 函数
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ]* 2.5 编写 Document Service 单元测试
    - 测试 createDocument 带/不带 scriptId
    - 测试 listDocumentsByScriptId 过滤正确性
    - _Requirements: 2.2, 2.3, 2.5_

- [x] 3. Upload API 修改
  - [x] 3.1 修改 Upload API (`app/api/upload/route.ts`)
    - 从 FormData 读取可选 `script_id`
    - 传递 `scriptId` 给 ingestion pipeline 的 `createDocument` 调用
    - 传递 `scriptId` 给 extraction pipeline
    - _Requirements: 2.2, 2.3_

  - [ ]* 3.2 编写 Upload API 属性测试
    - **Property 2: 上传文档关联剧本**
    - **Validates: Requirements 2.2**

- [x] 4. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 5. Extraction Pipeline 修改
  - [x] 5.1 修改 Extraction Service (`lib/services/extraction.ts`)
    - `upsertEntity` 增加 `scriptId` 参数，写入 `script_id` 字段
    - `findDuplicate` 增加 `scriptId` 参数，优先按 `script_id` 范围去重
    - `upsertEntityWithDedup` 传递 `scriptId`
    - _Requirements: 3.2, 3.3, 5.1, 5.2, 5.3_

  - [ ]* 5.2 编写跨文档去重属性测试
    - **Property 7: 跨文档按剧本去重**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 5.3 修改 Store Results Node (`lib/workflows/extraction/nodes/store-results.ts`)
    - `StoreInput` 增加 `scriptId` 字段
    - 传递 `scriptId` 给 `upsertEntity` / `upsertEntityWithDedup`
    - _Requirements: 3.2_

  - [x] 5.4 修改 Extraction Graph (`lib/workflows/extraction/graph.ts`)
    - State 增加 `scriptId` 字段
    - `loadChunksNode` 从 document 记录查找 `script_id`
    - `storeAllNode` 传递 `scriptId`
    - _Requirements: 3.2, 3.3_

  - [ ]* 5.5 编写提取管线 script_id 传播属性测试
    - **Property 5: 提取管线传播 script_id**
    - **Validates: Requirements 3.2, 3.3**

- [x] 6. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 7. Search Service 修改
  - [x] 7.1 修改 Search Service (`lib/services/search.ts`)
    - `structuredSearch` 支持 `script_id` 过滤条件
    - 搜索结果来源信息增加 `script_name` 字段
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 7.2 编写搜索过滤属性测试
    - **Property 8: 搜索按剧本过滤**
    - **Validates: Requirements 6.1, 6.3**

  - [ ]* 7.3 编写搜索结果剧本名称属性测试
    - **Property 9: 搜索结果包含剧本名称**
    - **Validates: Requirements 6.2**

  - [x] 7.4 修改 Search API (`app/api/search/route.ts`)
    - `SearchFilters` 增加 `script_id` 字段
    - `mapFiltersToIntent` 处理 `script_id` 过滤
    - _Requirements: 6.3_

  - [ ]* 7.5 编写 Search API 单元测试
    - 测试带 script_id 过滤的搜索请求
    - _Requirements: 6.3_

- [x] 8. Documents API 修改
  - [x] 8.1 修改 Documents API (`app/api/documents/route.ts`)
    - 支持 `script_id` 查询参数过滤
    - 支持 `group_by_script` 查询参数按剧本分组
    - 文档列表中包含剧本名称
    - _Requirements: 2.4, 2.5, 7.1, 7.2, 7.3_

  - [ ]* 8.2 编写文档分组属性测试
    - **Property 10: 文档按剧本分组**
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [ ]* 8.3 编写文档列表剧本名称属性测试
    - **Property 3: 文档列表包含剧本名称**
    - **Validates: Requirements 2.4**

  - [ ]* 8.4 编写文档过滤属性测试
    - **Property 4: 按剧本过滤文档**
    - **Validates: Requirements 2.5**

- [x] 9. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 10. Upload UI 重构
  - [x] 10.1 创建 ScriptSelector 组件 (`components/ScriptSelector.tsx`)
    - 下拉选择已有剧本，含「新建剧本」选项
    - 新建剧本时显示名称/描述输入表单
    - 调用 Scripts API 获取列表和创建剧本
    - _Requirements: 4.1, 4.2_

  - [x] 10.2 重构上传页面 (`app/upload/page.tsx`)
    - 集成 ScriptSelector 组件
    - 支持多文件选择和拖拽（`multiple` 属性）
    - 逐个上传文件，每个文件独立进度状态
    - 未选择剧本时保持单文件上传向后兼容
    - 单个文件失败不影响其余文件上传
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

  - [ ]* 10.3 编写批量上传容错属性测试
    - **Property 6: 批量上传容错**
    - **Validates: Requirements 4.6**

- [x] 11. 最终 Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选，可跳过以加速 MVP
- 每个任务引用了具体的需求编号以便追溯
- Checkpoint 确保增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
