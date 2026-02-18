import { createExtractor } from '../extractor';
import { GameMechanicsSchema } from '../../../schemas';

export const GAME_MECHANICS_PROMPT = `从以下剧本杀文本中提取游戏机制（Game Mechanics）信息。

请识别并提取以下字段：
- core_gameplay_type: 核心玩法类型（如"推理投凶"、"阵营对抗"、"任务达成"等）
- special_phases: 特殊环节列表，每个环节包含：
  - name: 环节名称（如"搜证环节"、"私聊环节"、"投票环节"、"技能使用环节"等）
  - rules: 规则描述
  - trigger_timing: 触发时机
- victory_conditions: 胜利条件，按角色类型分别描述（如 {"凶手": "不被投出", "侦探": "找出凶手"}）

对每个字段提供置信度分数（0-1），并将结果放入 confidence 字段。
如果文本中未包含游戏机制相关信息，所有字段返回 null 或空数组，置信度设为 0。`;

export const extractGameMechanics = createExtractor(GameMechanicsSchema, GAME_MECHANICS_PROMPT);
