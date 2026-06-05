import {load} from './storage.js';
import {rerank} from './llama-service.js';

const testCases = [
  {
    name: "1. 语义匹配 vs. 词汇匹配",
    query: "如何缓解长时间看电脑屏幕引起的眼睛干涩和疲劳？",
    candidates: [
      "遵循“20-20-20”法则能有效减轻视疲劳：每看显示器20分钟，就向20英尺（约6米）外远眺20秒，并可适当使用人工泪液。",
      "电脑屏幕的分辨率和刷新率对眼睛的影响其实不大，主要问题在于环境光线过暗或屏幕亮度过高。"
    ],
    highIndices: [0],
    lowIndices: [1]
  },
  {
    name: "2. 硬负样本识别 (Hard Negative)",
    query: "特斯拉 Model 3 的电池保修期是多久？",
    candidates: [
      "特斯拉为 Model 3 的电池和驱动单元提供 8 年或 16 万公里的保修服务，以先到者为准，且保证保修期内电池容量不低于 70%。",
      "特斯拉 Model 3 搭载的磷酸铁锂电池容量为 60 kWh，支持超级快充，但如果在保修期外损坏，电池更换成本非常高昂。"
    ],
    highIndices: [0],
    lowIndices: [1]
  },
  {
    name: "3. 多约束条件过滤",
    query: "推荐一款适合在 macOS 上运行、支持完全离线使用且开源的 Markdown 编辑器。",
    candidates: [
      "Obsidian 是一款强大的本地优先（Local-first）笔记应用，完美支持 macOS，所有数据均保存在本地，且核心功能完全免费开源。",
      "Notion 是一款极其优秀的 Markdown 编辑器，支持 macOS 客户端，界面美观，但必须保持网络连接才能同步和正常使用。"
    ],
    highIndices: [0],
    lowIndices: [1]
  },
  {
    name: "4. 否定意图理解",
    query: "寻找一款适合孕妇饮用、且绝对不含咖啡因的提神花草茶。",
    candidates: [
      "南非博士茶（Rooibos tea）天然不含咖啡因，富含抗氧化剂，口感温和，是孕期下午提神和补充水分的理想安全选择。",
      "绿茶含有适量的咖啡因和茶氨酸，能有效提神醒脑，但由于咖啡因可能影响胎儿，不建议孕妇在孕早期大量饮用。"
    ],
    highIndices: [0],
    lowIndices: [1]
  },
  {
    name: "5. 专业领域/实体消歧",
    query: "在 Python 中，`yield` 关键字的具体作用是什么？",
    candidates: [
      "在 Python 中，`yield` 用于定义生成器（Generator）函数。它会在每次调用时暂停函数执行并返回一个值，同时保留函数的局部状态，以便下次从中断处继续执行。",
      "Python 中的 `return` 关键字用于结束当前函数的执行，并将指定的值返回给调用者，之后函数内的局部变量会被销毁。"
    ],
    highIndices: [0],
    lowIndices: [1]
  },
  {
    name: "6. 长查询与复杂逻辑",
    query: "2023年之后发布的，支持 Wi-Fi 7 技术，且目前市场售价低于 3000 元人民币的国产智能手机有哪些？",
    candidates: [
      "红米 K70 Pro 于 2023 年 11 月底正式发布，首发搭载了 Wi-Fi 7 技术，目前电商平台补贴后售价约为 2999 元起，符合高性价比需求。",
      "华为 Mate 60 Pro 是 2023 年下半年发布的重磅国产旗舰手机，支持双向北斗卫星消息，但官方起售价在 6999 元。"
    ],
    highIndices: [0],
    lowIndices: [1]
  },
  {
    name: "7. 指代消解与上下文依赖",
    query: "这部电影的导演是谁？他还执导过哪些著名的科幻作品？",
    candidates: [
      "《奥本海默》由克里斯托弗·诺兰（Christopher Nolan）执导，他此前还执导过《星际穿越》、《盗梦空间》和《信条》等著名科幻电影。",
      "基里安·墨菲在《奥本海默》中贡献了影帝级的表演，他凭借此片获得了奥斯卡最佳男主角奖，此前还出演过《浴血黑帮》。"
    ],
    highIndices: [0],
    lowIndices: [1]
  },
  {
    name: "8. 数值与时间推理",
    query: "第 33 届夏季奥林匹克运动会（巴黎奥运会）的具体开幕日期是哪一天？",
    candidates: [
      "巴黎 2024 年夏季奥运会定于当地时间 2024 年 7 月 26 日正式开幕，并将于 8 月 11 日闭幕。",
      "2024 年巴黎奥运会将新增霹雳舞等项目，预计将有来自 200 多个国家和地区的超过 10000 名运动员参赛。"
    ],
    highIndices: [0],
    lowIndices: [1]
  },
  {
    name: "9. 跨语言/混合语言查询",
    query: "怎么在 Excel 里使用 VLOOKUP 函数进行精确匹配？",
    candidates: [
      "VLOOKUP 函数用于在表格首列查找指定内容。精确匹配的语法为：`=VLOOKUP(查找值, 数据表, 列序数, FALSE)`，其中最后一个参数设为 FALSE 或 0 即代表精确匹配。",
      "在 Excel 中，INDEX 和 MATCH 函数的组合通常比 VLOOKUP 更灵活，因为它们可以实现从右向左的反向查找，且不受插入列的影响。"
    ],
    highIndices: [0],
    lowIndices: [1]
  },
  {
    name: "10. 情感与主观意图匹配",
    query: "请客观中立地分析一下《黑神话：悟空》的战斗系统优缺点。",
    candidates: [
      "《黑神话：悟空》的战斗系统深度融合了动作角色扮演与资源管理。其优点是“识破”和“闪避”机制反馈极佳；缺点是部分 Boss 战数值难度曲线陡峭，对新手玩家存在一定门槛。",
      "《黑神话：悟空》的画面表现力堪称世界顶级，美术风格极具中国神话色彩，战斗起来非常爽快，绝对是今年最值得购买的年度游戏，强烈推荐大家入手！"
    ],
    highIndices: [0],
    lowIndices: [1]
  }
];

async function findRerankerModel(): Promise<string | null> {
  const db = await load();
  for (const [name, entry] of Object.entries(db.models)) {
    if (name === db.activeModel) continue;
    if (name.toLowerCase().includes('reranker')) {
      return entry.downloadedFiles.model;
    }
  }
  return null;
}

async function writeResult(filePath: string, content: string): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true});
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

async function main() {
  await load();

  const rerankerPath = await findRerankerModel();
  if (!rerankerPath) {
    const msg = 'No reranker model found. Run `pnpm cli install` with a reranker model first.';
    console.error(msg);
    await writeResult('./temp/rerank-test-cn_error.txt', msg + '\n');
    process.exit(1);
  }
  console.log(`Reranker model: ${rerankerPath}\n`);

  let passCount = 0;
  let failCount = 0;

  for (const tc of testCases) {
    const results = await rerank(tc.query, tc.candidates, rerankerPath);
    const sorted = [...results].sort((a, b) => b.relevance_score - a.relevance_score);

    const highScores = tc.highIndices.map(i => results.find(r => r.index === i)!.relevance_score);
    const lowScores = tc.lowIndices.map(i => results.find(r => r.index === i)!.relevance_score);
    const minHigh = Math.min(...highScores);
    const maxLow = Math.max(...lowScores);
    const passed = minHigh > maxLow;

    console.log(`--- ${tc.name} ---`);
    console.log(`Query: ${tc.query}`);
    const lines: string[] = [];
    for (const r of sorted) {
      const label = tc.highIndices.includes(r.index) ? '(high)' : tc.lowIndices.includes(r.index) ? '(low)' : '';
      console.log(`  [${r.relevance_score.toFixed(4)}] doc[${r.index}] ${label}`);
      lines.push(`  [${r.relevance_score.toFixed(4)}] doc[${r.index}] ${label}`);
    }
    console.log(`Result: ${passed ? 'PASS' : 'FAIL'}\n`);

    const testName = tc.name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
    await writeResult(`./temp/${testName}.txt`, [
      `Case: ${tc.name}`,
      `Query: ${tc.query}`,
      ...lines,
      `Result: ${passed ? 'PASS' : 'FAIL'}`
    ].join('\n'));

    if (passed) passCount++;
    else failCount++;
  }

  const summary = `\n=== Summary: ${passCount} passed, ${failCount} failed (total ${testCases.length}) ===`;
  console.log(summary);
}

main().catch((err) => {
  console.error('Rerank test failed:', err);
  process.exit(1);
});
