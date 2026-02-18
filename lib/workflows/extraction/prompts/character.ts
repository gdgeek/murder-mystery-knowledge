import { createExtractor } from '../extractor';
import { CharacterSchema } from '../../../schemas';

export const CHARACTER_PROMPT = `从以下剧本杀文本中提取角色（Character）信息。

请识别并提取以下字段：
- name: 角色名称
- role: 身份标签，必须为以下之一：murderer（凶手）、detective（侦探）、suspect（嫌疑人）、victim（受害者）、npc
- motivation: 动机描述，说明该角色的行为动机
- personality_traits: 性格特征列表
- relationships: 与其他角色的关系列表，每条关系包含：
  - related_character_name: 关联角色名称
  - relationship_type: 关系类型（如亲属、朋友、仇人、恋人、同事等）
  - description: 关系描述

对每个字段提供置信度分数（0-1），并将结果放入 confidence 字段。
如果文本中未包含角色相关信息，所有字段返回 null，置信度设为 0。`;

export const extractCharacter = createExtractor(CharacterSchema, CHARACTER_PROMPT);
