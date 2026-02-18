import { createExtractor } from '../extractor';
import { EmotionalDesignSchema } from '../../../schemas';

export const EMOTIONAL_DESIGN_PROMPT = `从以下剧本杀文本中提取情感设计（Emotional Design）信息。

请识别并提取以下字段：
- target_emotions: 目标情感类型列表（如"恐惧"、"感动"、"紧张"、"悬疑"、"欢乐"等）
- emotional_climaxes: 情感高潮点列表，每个包含：
  - act_reference: 所在幕（如"第二幕"）
  - trigger_event: 触发事件描述
  - target_emotion: 目标情感
- emotional_arcs: 角色情感弧线列表，每个包含：
  - character_name: 角色名称
  - phases: 情感变化阶段序列（如["平静", "怀疑", "愤怒", "释然"]）

对每个字段提供置信度分数（0-1），并将结果放入 confidence 字段。
如果文本中未包含情感设计相关信息，所有列表返回空数组，置信度设为 0。`;

export const extractEmotionalDesign = createExtractor(EmotionalDesignSchema, EMOTIONAL_DESIGN_PROMPT);
