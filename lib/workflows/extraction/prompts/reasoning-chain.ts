import { createExtractor } from '../extractor';
import { ReasoningChainSchema } from '../../../schemas';

export const REASONING_CHAIN_PROMPT = `从以下剧本杀文本中提取推理链（Reasoning Chain）信息。

请识别并提取以下字段：
- name: 推理链名称，概括该推理路径的主题
- steps: 推理步骤序列，每步包含：
  - input_clues: 该步骤使用的输入线索名称列表
  - deduction: 该步骤的推导结论
- conclusion: 最终结论，描述整条推理链得出的最终推理结果

对每个字段提供置信度分数（0-1），并将结果放入 confidence 字段。
如果文本中未包含推理链相关信息，所有字段返回 null 或空数组，置信度设为 0。`;

export const extractReasoningChain = createExtractor(ReasoningChainSchema, REASONING_CHAIN_PROMPT);
