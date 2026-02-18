import { createExtractor } from '../extractor';
import { MisdirectionSchema } from '../../../schemas';

export const MISDIRECTION_PROMPT = `从以下剧本杀文本中提取误导手段（Misdirection）信息。

请识别并提取以下字段：
- name: 误导手段名称
- type: 误导类型，必须为以下之一：false_clue（虚假线索）、time_misdirection（时间误导）、identity_disguise（身份伪装）、motive_misdirection（动机误导）
- target: 误导目标，描述该手段试图让玩家相信的错误结论
- resolution: 破解方式描述，说明如何识破该误导

对每个字段提供置信度分数（0-1），并将结果放入 confidence 字段。
如果文本中未包含误导手段相关信息，所有字段返回 null，置信度设为 0。`;

export const extractMisdirection = createExtractor(MisdirectionSchema, MISDIRECTION_PROMPT);
