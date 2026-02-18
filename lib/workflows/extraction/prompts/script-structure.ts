import { createExtractor } from '../extractor';
import { ScriptStructureSchema } from '../../../schemas';

export const SCRIPT_STRUCTURE_PROMPT = `从以下剧本杀文本中提取剧本结构（Script Structure）信息。

请识别并提取以下字段：
- timeline_events: 时间线事件列表，每个事件包含：
  - timestamp: 时间戳（如"第一天上午"、"1920年春"等）
  - description: 事件描述
- scenes: 场景列表，每个场景包含：
  - name: 场景名称（如"客厅"、"书房"等）
  - description: 场景描述
- acts: 幕列表，每幕包含：
  - name: 幕名称（如"第一幕"、"序幕"等）
  - theme: 幕主题

对每个字段提供置信度分数（0-1），并将结果放入 confidence 字段。
如果文本中未包含剧本结构相关信息，所有列表返回空数组，置信度设为 0。`;

export const extractScriptStructure = createExtractor(ScriptStructureSchema, SCRIPT_STRUCTURE_PROMPT);
