import { createExtractor } from '../extractor';
import { PlayerScriptSchema } from '../../../schemas';

export const PLAYER_SCRIPT_PROMPT = `从以下剧本杀文本中提取玩家剧本（Player Script）信息。

请识别并提取以下字段：
- character_name: 该玩家剧本对应的角色名称
- total_word_count: 该玩家剧本的总字数（估算）
- sections: 剧本包含的部分列表，每部分包含：
  - section_name: 部分名称（如"角色背景"、"第一幕剧情"、"角色任务"、"角色线索"、"角色关系提示"等）
  - word_count: 该部分的字数（估算）

对每个字段提供置信度分数（0-1），并将结果放入 confidence 字段。
如果文本中未包含玩家剧本相关信息，所有字段返回 null 或空数组，置信度设为 0。`;

export const extractPlayerScript = createExtractor(PlayerScriptSchema, PLAYER_SCRIPT_PROMPT);
