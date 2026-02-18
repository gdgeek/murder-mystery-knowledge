import { createExtractor } from '../extractor';
import { ScriptFormatSchema } from '../../../schemas';

export const SCRIPT_FORMAT_PROMPT = `从以下剧本杀文本中提取剧本格式（Script Format）信息。

请识别并提取以下字段：
- act_count: 分幕数量
- has_separate_clue_book: 是否有独立线索册（true/false）
- has_public_info_page: 是否有公共信息页（true/false）
- layout_style: 排版风格描述
- act_compositions: 每幕的内容组成，每幕包含：
  - act_name: 幕名称
  - act_theme: 幕主题
  - components: 内容组成部分列表（如"剧情描述"、"线索卡"、"任务卡"、"投票环节"等）

对每个字段提供置信度分数（0-1），并将结果放入 confidence 字段。
如果文本中未包含剧本格式相关信息，所有字段返回 null 或空数组，置信度设为 0。`;

export const extractScriptFormat = createExtractor(ScriptFormatSchema, SCRIPT_FORMAT_PROMPT);
