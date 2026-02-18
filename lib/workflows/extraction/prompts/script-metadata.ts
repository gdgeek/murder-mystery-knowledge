import { createExtractor } from '../extractor';
import { ScriptMetadataSchema } from '../../../schemas';

export const SCRIPT_METADATA_PROMPT = `从以下剧本杀文本中提取剧本元数据（Script Metadata）信息。

请识别并提取以下字段：
- title: 剧本名称
- author: 作者
- publisher: 发行商
- publish_year: 发行年份（整数）
- min_players: 最少适合人数（整数）
- max_players: 最多适合人数（整数）
- duration_minutes: 预估游戏时长（分钟，整数）
- difficulty: 难度评级，必须为以下之一：beginner（新手）、intermediate（进阶）、hardcore（硬核）
- tags: 剧本类型标签列表（如"硬核推理"、"情感沉浸"、"阵营对抗"、"机制本"、"恐怖"、"欢乐"等）

对每个字段提供置信度分数（0-1），并将结果放入 confidence 字段。
如果文本中未包含剧本元数据相关信息，所有字段返回 null 或空数组，置信度设为 0。`;

export const extractScriptMetadata = createExtractor(ScriptMetadataSchema, SCRIPT_METADATA_PROMPT);
