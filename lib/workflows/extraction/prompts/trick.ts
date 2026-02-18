import { createExtractor } from '../extractor';
import { TrickSchema } from '../../../schemas';

export const TRICK_PROMPT = `从以下剧本杀文本中提取诡计（Trick）信息。

请识别并提取以下字段：
- name: 诡计名称
- type: 诡计类型，必须为以下之一：locked_room（密室）、alibi（不在场证明）、weapon_hiding（凶器隐藏）、poisoning（毒杀）、disguise（伪装）、other（其他）
- mechanism: 核心机制描述，详细说明诡计的实现方式
- key_elements: 关键要素列表，列出实现该诡计所需的关键条件或道具
- weakness: 破绽描述，说明该诡计可被识破的关键点

对每个字段提供置信度分数（0-1），并将结果放入 confidence 字段。
如果文本中未包含诡计相关信息，所有字段返回 null，置信度设为 0。`;

export const extractTrick = createExtractor(TrickSchema, TRICK_PROMPT);
