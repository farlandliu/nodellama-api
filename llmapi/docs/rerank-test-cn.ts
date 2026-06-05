import { describe, it, expect } from 'vitest';

// ==========================================
// 1. 类型定义
// ==========================================

export interface RerankResult {
  index: number;      // 候选文档在原始数组中的索引 (0 代表 Candidate A, 1 代表 Candidate B)
  text: string;       // 文档内容
  score: number;      // 相关性得分
}

export interface Reranker {
  /**
   * 对给定查询和候选文档进行重排打分
   * @param query 用户查询
   * @param documents 候选文档列表
   * @returns 按得分降序排列的结果列表
   */
  rerank(query: string, documents: string[]): Promise<RerankResult[]>;
}

// ==========================================
// 2. 测试数据集 (10个核心场景)
// ==========================================

const testCases = [
  {
    name: "1. 语义匹配 vs. 词汇匹配",
    query: "如何缓解长时间看电脑屏幕引起的眼睛干涩和疲劳？",
    candidates: [
      "遵循“20-20-20”法则能有效减轻视疲劳：每看显示器20分钟，就向20英尺（约6米）外远眺20秒，并可适当使用人工泪液。", // A (预期高分)
      "电脑屏幕的分辨率和刷新率对眼睛的影响其实不大，主要问题在于环境光线过暗或屏幕亮度过高。" // B (预期低分)
    ]
  },
  {
    name: "2. 硬负样本识别 (Hard Negative)",
    query: "特斯拉 Model 3 的电池保修期是多久？",
    candidates: [
      "特斯拉为 Model 3 的电池和驱动单元提供 8 年或 16 万公里的保修服务，以先到者为准，且保证保修期内电池容量不低于 70%。", // A
      "特斯拉 Model 3 搭载的磷酸铁锂电池容量为 60 kWh，支持超级快充，但如果在保修期外损坏，电池更换成本非常高昂。" // B
    ]
  },
  {
    name: "3. 多约束条件过滤",
    query: "推荐一款适合在 macOS 上运行、支持完全离线使用且开源的 Markdown 编辑器。",
    candidates: [
      "Obsidian 是一款强大的本地优先（Local-first）笔记应用，完美支持 macOS，所有数据均保存在本地，且核心功能完全免费开源。", // A
      "Notion 是一款极其优秀的 Markdown 编辑器，支持 macOS 客户端，界面美观，但必须保持网络连接才能同步和正常使用。" // B
    ]
  },
  {
    name: "4. 否定意图理解",
    query: "寻找一款适合孕妇饮用、且绝对不含咖啡因的提神花草茶。",
    candidates: [
      "南非博士茶（Rooibos tea）天然不含咖啡因，富含抗氧化剂，口感温和，是孕期下午提神和补充水分的理想安全选择。", // A
      "绿茶含有适量的咖啡因和茶氨酸，能有效提神醒脑，但由于咖啡因可能影响胎儿，不建议孕妇在孕早期大量饮用。" // B
    ]
  },
  {
    name: "5. 专业领域/实体消歧",
    query: "在 Python 中，`yield` 关键字的具体作用是什么？",
    candidates: [
      "在 Python 中，`yield` 用于定义生成器（Generator）函数。它会在每次调用时暂停函数执行并返回一个值，同时保留函数的局部状态，以便下次从中断处继续执行。", // A
      "Python 中的 `return` 关键字用于结束当前函数的执行，并将指定的值返回给调用者，之后函数内的局部变量会被销毁。" // B
    ]
  },
  {
    name: "6. 长查询与复杂逻辑",
    query: "2023年之后发布的，支持 Wi-Fi 7 技术，且目前市场售价低于 3000 元人民币的国产智能手机有哪些？",
    candidates: [
      "红米 K70 Pro 于 2023 年 11 月底正式发布，首发搭载了 Wi-Fi 7 技术，目前电商平台补贴后售价约为 2999 元起，符合高性价比需求。", // A
      "华为 Mate 60 Pro 是 2023 年下半年发布的重磅国产旗舰手机，支持双向北斗卫星消息，但官方起售价在 6999 元。" // B
    ]
  },
  {
    name: "7. 指代消解与上下文依赖",
    query: "这部电影的导演是谁？他还执导过哪些著名的科幻作品？",
    candidates: [
      "《奥本海默》由克里斯托弗·诺兰（Christopher Nolan）执导，他此前还执导过《星际穿越》、《盗梦空间》和《信条》等著名科幻电影。", // A
      "基里安·墨菲在《奥本海默》中贡献了影帝级的表演，他凭借此片获得了奥斯卡最佳男主角奖，此前还出演过《浴血黑帮》。" // B
    ]
  },
  {
    name: "8. 数值与时间推理",
    query: "第 33 届夏季奥林匹克运动会（巴黎奥运会）的具体开幕日期是哪一天？",
    candidates: [
      "巴黎 2024 年夏季奥运会定于当地时间 2024 年 7 月 26 日正式开幕，并将于 8 月 11 日闭幕。", // A
      "2024 年巴黎奥运会将新增霹雳舞等项目，预计将有来自 200 多个国家和地区的超过 10000 名运动员参赛。" // B
    ]
  },
  {
    name: "9. 跨语言/混合语言查询",
    query: "怎么在 Excel 里使用 VLOOKUP 函数进行精确匹配？",
    candidates: [
      "VLOOKUP 函数用于在表格首列查找指定内容。精确匹配的语法为：`=VLOOKUP(查找值, 数据表, 列序数, FALSE)`，其中最后一个参数设为 FALSE 或 0 即代表精确匹配。", // A
      "在 Excel 中，INDEX 和 MATCH 函数的组合通常比 VLOOKUP 更灵活，因为它们可以实现从右向左的反向查找，且不受插入列的影响。" // B
    ]
  },
  {
    name: "10. 情感与主观意图匹配",
    query: "请客观中立地分析一下《黑神话：悟空》的战斗系统优缺点。",
    candidates: [
      "《黑神话：悟空》的战斗系统深度融合了动作角色扮演与资源管理。其优点是“识破”和“闪避”机制反馈极佳；缺点是部分 Boss 战数值难度曲线陡峭，对新手玩家存在一定门槛。", // A
      "《黑神话：悟空》的画面表现力堪称世界顶级，美术风格极具中国神话色彩，战斗起来非常爽快，绝对是今年最值得购买的年度游戏，强烈推荐大家入手！" // B
    ]
  }
];

// ==========================================
// 3. Reranker 实现 (请根据实际情况替换)
// ==========================================

/**
 * [示例 A] 模拟的 Reranker (用于演示代码逻辑，始终让 A 得分高于 B)
 * 实际使用时，请替换为下方的 [示例 B] 真实 API 调用
 */
class MockReranker implements Reranker {
  async rerank(query: string, documents: string[]): Promise<RerankResult[]> {
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 10)); 
    
    return documents.map((text, index) => ({
      index,
      text,
      // mock 逻辑：索引 0 (Candidate A) 得分 0.9，索引 1 (Candidate B) 得分 0.4
      score: index === 0 ? 0.95 : 0.45 
    })).sort((a, b) => b.score - a.score);
  }
}

/**
 * [示例 B] 真实的 Reranker API 调用 (以 Jina AI Reranker 为例)
 * 取消注释并填入您的 API Key 即可进行真实测试
 */
/*
class JinaReranker implements Reranker {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'jina-reranker-v2-base-multilingual') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async rerank(query: string, documents: string[]): Promise<RerankResult[]> {
    const response = await fetch('https://api.jina.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        query: query,
        documents: documents,
        top_n: documents.length
      })
    });

    if (!response.ok) {
      throw new Error(`Reranker API Error: ${response.statusText}`);
    }

    const data = await response.json();
    // Jina 返回的 results 已经按 score 降序排列，且包含 index 和 relevance_score
    return data.results.map((result: any) => ({
      index: result.index,
      text: result.document.text,
      score: result.relevance_score
    }));
  }
}
*/

// 初始化 Reranker (当前使用 Mock，实际测试请切换为 JinaReranker 或您的自定义实现)
const reranker: Reranker = new MockReranker();
// const reranker: Reranker = new JinaReranker('YOUR_JINA_API_KEY');

// ==========================================
// 4. 测试执行逻辑
// ==========================================

describe('Reranker Model Performance Test', () => {
  // 设置较长的超时时间，以防真实 API 调用较慢
  jest.setTimeout ? jest.setTimeout(10000) : null; // 兼容 Jest
  // 如果是 Vitest，可以使用: // @ts-ignore
  // vi.setConfig({ testTimeout: 10000 })

  testCases.forEach((testCase, caseIndex) => {
    it(`应该正确排序: ${testCase.name}`, async () => {
      // 1. 调用 Reranker
      const results = await reranker.rerank(testCase.query, testCase.candidates);

      // 2. 提取 Candidate A (index 0) 和 Candidate B (index 1) 的得分
      const resultA = results.find(r => r.index === 0);
      const resultB = results.find(r => r.index === 1);

      // 3. 断言：确保两个结果都被正确返回
      expect(resultA).toBeDefined();
      expect(resultB).toBeDefined();

      // 4. 核心断言：Candidate A 的相关性得分必须严格大于 Candidate B
      // 容忍极小的浮点数误差 (1e-5)
      expect(resultA!.score).toBeGreaterThan(resultB!.score + 1e-5);

      // 5. (可选) 打印详细得分，方便在控制台查看模型表现
      console.log(`[${testCase.name}]`);
      console.log(`  Query: ${testCase.query}`);
      console.log(`  Score A (Expected High): ${resultA!.score.toFixed(4)}`);
      console.log(`  Score B (Expected Low) : ${resultB!.score.toFixed(4)}`);
      console.log(`  Margin: ${(resultA!.score - resultB!.score).toFixed(4)}\n`);
    });
  });
});