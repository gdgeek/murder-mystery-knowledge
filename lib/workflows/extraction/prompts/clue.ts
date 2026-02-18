import { createExtractor } from '../extractor';
import { ClueSchema } from '../../../schemas';

export const CLUE_PROMPT = `从以下剧本杀文本中提取线索（Clue）信息。

请识别并提取以下字段：
- name: 线索名称
- type: 线索类型，必须为以下之一：physical_evidence（物证）、testimony（证言）、document（文件）、environmental（环境线索）
- location: 获取位置，说明该线索在哪里可以被发现
- direction: 指向性描述，说明该线索指向的嫌疑人或事件
- associated_characters: 关联角色名称列表

对每个字段提供置信度分数（0-1），并将结果放入 confidence 字段。
如果文本中未包含线索相关信息，所有字段返回 null 或空数组，置信度设为 0。`;

export const extractClue = createExtractor(ClueSchema, CLUE_PROMPT);
