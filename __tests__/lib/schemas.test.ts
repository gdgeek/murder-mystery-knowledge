import { describe, it, expect } from "vitest";
import {
  TrickSchema,
  CharacterSchema,
  ScriptStructureSchema,
  StoryBackgroundSchema,
  ScriptFormatSchema,
  PlayerScriptSchema,
  ClueSchema,
  ReasoningChainSchema,
  MisdirectionSchema,
  ScriptMetadataSchema,
  GameMechanicsSchema,
  NarrativeTechniqueSchema,
  EmotionalDesignSchema,
  EntitySchemas,
  ConfidenceSchema,
  ReviewStatusSchema,
  ScriptSchema,
} from "../../lib/schemas";

describe("Shared schemas", () => {
  it("ConfidenceSchema accepts valid field-to-score records", () => {
    const result = ConfidenceSchema.safeParse({ name: 0.9, type: 0.5 });
    expect(result.success).toBe(true);
  });

  it("ConfidenceSchema rejects scores outside 0-1", () => {
    expect(ConfidenceSchema.safeParse({ x: 1.5 }).success).toBe(false);
    expect(ConfidenceSchema.safeParse({ x: -0.1 }).success).toBe(false);
  });

  it("ReviewStatusSchema defaults to pending_review", () => {
    const result = ReviewStatusSchema.parse(undefined);
    expect(result).toBe("pending_review");
  });
});

describe("TrickSchema", () => {
  it("parses a valid trick", () => {
    const result = TrickSchema.safeParse({
      name: "密室诡计",
      type: "locked_room",
      mechanism: "通过暗门进出",
      key_elements: ["暗门", "时间差"],
      weakness: "暗门有磨损痕迹",
      confidence: { name: 0.95, type: 0.9 },
      review_status: "approved",
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimal input with defaults", () => {
    const result = TrickSchema.parse({});
    expect(result.key_elements).toEqual([]);
    expect(result.review_status).toBe("pending_review");
  });
});

describe("CharacterSchema", () => {
  it("parses a character with relationships", () => {
    const result = CharacterSchema.safeParse({
      name: "张三",
      role: "murderer",
      motivation: "复仇",
      personality_traits: ["冷静", "聪明"],
      relationships: [
        {
          related_character_name: "李四",
          relationship_type: "仇人",
          description: "张三与李四有深仇大恨",
        },
      ],
      confidence: { name: 0.9 },
      review_status: "approved",
    });
    expect(result.success).toBe(true);
  });
});

describe("ScriptStructureSchema", () => {
  it("parses with timeline events, scenes, and acts", () => {
    const result = ScriptStructureSchema.safeParse({
      timeline_events: [{ timestamp: "1920-01-01", description: "案发" }],
      scenes: [{ name: "客厅", description: "豪华客厅" }],
      acts: [{ name: "第一幕", theme: "相聚" }],
      confidence: { timeline_events: 0.8 },
      review_status: "approved",
    });
    expect(result.success).toBe(true);
  });
});

describe("StoryBackgroundSchema", () => {
  it("parses a valid story background", () => {
    const result = StoryBackgroundSchema.safeParse({
      era: "民国",
      location: "上海",
      worldview: "乱世",
      social_environment: "租界时期",
    });
    expect(result.success).toBe(true);
  });
});

describe("ScriptFormatSchema", () => {
  it("parses with act compositions", () => {
    const result = ScriptFormatSchema.safeParse({
      act_count: 3,
      has_separate_clue_book: true,
      has_public_info_page: false,
      layout_style: "标准",
      act_compositions: [
        { act_name: "第一幕", act_theme: "开场", components: ["剧情描述", "线索卡"] },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("PlayerScriptSchema", () => {
  it("parses with sections", () => {
    const result = PlayerScriptSchema.safeParse({
      character_name: "张三",
      total_word_count: 5000,
      sections: [
        { section_name: "角色背景", word_count: 1000 },
        { section_name: "第一幕剧情", word_count: 2000 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("ClueSchema", () => {
  it("parses with associated characters as strings", () => {
    const result = ClueSchema.safeParse({
      name: "血迹",
      type: "physical_evidence",
      location: "客厅",
      direction: "指向张三",
      associated_characters: ["张三", "李四"],
    });
    expect(result.success).toBe(true);
  });
});

describe("ReasoningChainSchema", () => {
  it("parses with steps containing input clues", () => {
    const result = ReasoningChainSchema.safeParse({
      name: "凶手推理链",
      steps: [
        { input_clues: ["血迹", "指纹"], deduction: "张三到过现场" },
        { input_clues: ["动机"], deduction: "张三有作案动机" },
      ],
      conclusion: "张三是凶手",
    });
    expect(result.success).toBe(true);
  });
});

describe("MisdirectionSchema", () => {
  it("parses all misdirection types", () => {
    for (const type of ["false_clue", "time_misdirection", "identity_disguise", "motive_misdirection"] as const) {
      const result = MisdirectionSchema.safeParse({
        name: `${type}误导`,
        type,
        target: "误导目标",
        resolution: "破解方式",
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("ScriptMetadataSchema", () => {
  it("parses full metadata", () => {
    const result = ScriptMetadataSchema.safeParse({
      title: "迷雾庄园",
      author: "作者A",
      publisher: "发行商B",
      publish_year: 2023,
      min_players: 4,
      max_players: 8,
      duration_minutes: 240,
      difficulty: "hardcore",
      tags: ["硬核推理", "恐怖"],
    });
    expect(result.success).toBe(true);
  });
});

describe("GameMechanicsSchema", () => {
  it("parses with special phases and victory conditions", () => {
    const result = GameMechanicsSchema.safeParse({
      core_gameplay_type: "推理投凶",
      special_phases: [
        { name: "搜证环节", rules: "每人搜证两次", trigger_timing: "第二幕开始" },
      ],
      victory_conditions: { murderer: "不被投出", detective: "找出凶手" },
    });
    expect(result.success).toBe(true);
  });
});

describe("NarrativeTechniqueSchema", () => {
  it("parses with suspense techniques and foreshadowings", () => {
    const result = NarrativeTechniqueSchema.safeParse({
      perspective: "multi_perspective",
      structure_type: "nonlinear",
      suspense_techniques: [{ name: "悬念", description: "开场设置悬念" }],
      foreshadowings: [{ content: "伏笔内容", echo_location: "第三幕", effect: "揭示真相" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("EmotionalDesignSchema", () => {
  it("parses with climaxes and arcs", () => {
    const result = EmotionalDesignSchema.safeParse({
      target_emotions: ["恐惧", "感动"],
      emotional_climaxes: [
        { act_reference: "第三幕", trigger_event: "真相揭露", target_emotion: "震惊" },
      ],
      emotional_arcs: [
        { character_name: "张三", phases: ["平静", "愤怒", "释然"] },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("EntitySchemas registry", () => {
  it("contains all 13 entity types", () => {
    const keys = Object.keys(EntitySchemas);
    expect(keys).toHaveLength(13);
    expect(keys).toContain("trick");
    expect(keys).toContain("character");
    expect(keys).toContain("script_structure");
    expect(keys).toContain("story_background");
    expect(keys).toContain("script_format");
    expect(keys).toContain("player_script");
    expect(keys).toContain("clue");
    expect(keys).toContain("reasoning_chain");
    expect(keys).toContain("misdirection");
    expect(keys).toContain("script_metadata");
    expect(keys).toContain("game_mechanics");
    expect(keys).toContain("narrative_technique");
    expect(keys).toContain("emotional_design");
  });

  it("every schema has confidence and review_status fields", () => {
    for (const [name, schema] of Object.entries(EntitySchemas)) {
      const result = schema.safeParse({});
      if (result.success) {
        expect(result.data).toHaveProperty("review_status");
        // confidence is optional, so just check the schema accepts it
        const withConfidence = schema.safeParse({ confidence: { field: 0.5 } });
        expect(withConfidence.success).toBe(true);
      }
    }
  });

  it("every schema accepts an optional script_id field", () => {
    for (const [name, schema] of Object.entries(EntitySchemas)) {
      const withScriptId = schema.safeParse({
        script_id: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(withScriptId.success).toBe(true);
      if (withScriptId.success) {
        expect(withScriptId.data.script_id).toBe(
          "550e8400-e29b-41d4-a716-446655440000"
        );
      }

      // Also works without script_id
      const withoutScriptId = schema.safeParse({});
      expect(withoutScriptId.success).toBe(true);
      if (withoutScriptId.success) {
        expect(withoutScriptId.data.script_id).toBeUndefined();
      }
    }
  });
});

describe("ScriptSchema", () => {
  it("parses a valid script", () => {
    const result = ScriptSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "迷雾庄园",
      description: "一个恐怖推理剧本",
      created_at: "2024-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null description", () => {
    const result = ScriptSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "迷雾庄园",
      description: null,
      created_at: "2024-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = ScriptSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "",
      created_at: "2024-01-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(ScriptSchema.safeParse({}).success).toBe(false);
    expect(ScriptSchema.safeParse({ name: "test" }).success).toBe(false);
  });
});
