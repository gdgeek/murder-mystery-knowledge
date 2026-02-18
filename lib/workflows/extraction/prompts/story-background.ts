import { createExtractor } from '../extractor';
import { StoryBackgroundSchema } from '../../../schemas';

export const STORY_BACKGROUND_PROMPT = `从以下剧本杀文本中提取故事背景（Story Background）信息。

请识别并提取以下字段：
- era: 时代设定（如"民国时期"、"现代"、"唐朝"等）
- location: 地理位置（如"上海租界"、"某偏远山村"等）
- worldview: 世界观描述，说明故事所处世界的基本设定和规则
- social_environment: 社会环境描述，说明故事发生时的社会背景、阶层关系等

对每个字段提供置信度分数（0-1），并将结果放入 confidence 字段。
如果文本中未包含故事背景相关信息，所有字段返回 null，置信度设为 0。`;

export const extractStoryBackground = createExtractor(StoryBackgroundSchema, STORY_BACKGROUND_PROMPT);
