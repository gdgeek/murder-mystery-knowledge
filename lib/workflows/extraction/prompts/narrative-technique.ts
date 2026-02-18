import { createExtractor } from '../extractor';
import { NarrativeTechniqueSchema } from '../../../schemas';

export const NARRATIVE_TECHNIQUE_PROMPT = `从以下剧本杀文本中提取叙事技法（Narrative Technique）信息。

请识别并提取以下字段：
- perspective: 叙事视角，必须为以下之一：first_person（第一人称）、third_person（第三人称）、multi_perspective（多视角切换）
- structure_type: 叙事结构类型，必须为以下之一：linear（线性）、nonlinear（非线性）、multi_threaded（多线交织）、flashback（倒叙）
- suspense_techniques: 悬念设置手法列表，每个包含：
  - name: 手法名称（如"信息不对称"、"时间压力"、"身份悬念"等）
  - description: 应用描述，说明该手法在剧本中的具体运用
- foreshadowings: 伏笔与呼应列表，每个包含：
  - content: 伏笔内容
  - echo_location: 呼应位置（如"第三幕揭示"）
  - effect: 效果描述

对每个字段提供置信度分数（0-1），并将结果放入 confidence 字段。
如果文本中未包含叙事技法相关信息，所有字段返回 null 或空数组，置信度设为 0。`;

export const extractNarrativeTechnique = createExtractor(NarrativeTechniqueSchema, NARRATIVE_TECHNIQUE_PROMPT);
