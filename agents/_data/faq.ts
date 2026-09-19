/**
 * FAQ knowledge base — after-sales policies.
 * Stored as structured documents for RAG retrieval.
 */

export interface FaqDoc {
  id: string;
  title: string;
  category: "refund" | "exchange" | "shipping" | "warranty" | "general";
  content: string;
  keywords: string[];
}

export const FAQ_DOCS: FaqDoc[] = [
  {
    id: "faq-refund-policy",
    title: "退货退款政策",
    category: "refund",
    content: `【退货退款政策】
1. 收到商品后 7 天内可无理由退货（不影响二次销售）。
2. 质量问题 15 天内可退货，运费由我方承担。
3. 退款方式：原路退回（微信/支付宝/银行卡），3-5 个工作日到账。
4. 以下情况不支持退货：定制商品、已拆封的一次性耗材、下载类数字商品。
5. 退货需保留完整包装和配件，否则可能影响退款金额。`,
    keywords: ["退货", "退款", "七天无理由", "退货政策", "退钱", "不想要了"],
  },
  {
    id: "faq-refund-process",
    title: "退货流程",
    category: "refund",
    content: `【退货操作流程】
1. 在订单详情中提交退货申请（选择退货原因）。
2. 客服审核通过后，系统生成退货单号。
3. 将商品寄回指定地址（质量问题提供免费取件码）。
4. 仓库收到商品验收无误后，1-2 个工作日完成退款。
注：部分高价值商品需拍照确认外观后方可审核通过。`,
    keywords: ["退货流程", "怎么退", "退货步骤", "申请退货"],
  },
  {
    id: "faq-exchange-policy",
    title: "换货政策",
    category: "exchange",
    content: `【换货政策】
1. 收到商品 15 天内可申请换货。
2. 支持换同款不同规格（颜色/尺寸）或等价商品。
3. 质量问题换货运费由平台承担；非质量问题换货，用户承担来回运费。
4. 换货商品需保持全新状态，附带完整包装。
5. 换货处理周期：收到旧件后 3 个工作日内寄出新件。`,
    keywords: ["换货", "更换", "换一个", "换颜色", "换尺码"],
  },
  {
    id: "faq-shipping",
    title: "物流与配送",
    category: "shipping",
    content: `【物流配送说明】
1. 默认发顺丰/圆通/中通，不支持指定快递。
2. 下单后 24 小时内发货（预售/定制除外）。
3. 普通地区 2-4 天到达，偏远地区 5-7 天。
4. 物流查询：可在订单详情页实时查看物流轨迹。
5. 签收后如有破损，请 48 小时内拍照联系客服。`,
    keywords: ["物流", "快递", "发货", "几天到", "配送", "运费"],
  },
  {
    id: "faq-warranty",
    title: "保修政策",
    category: "warranty",
    content: `【保修政策】
1. 电子产品：整机 1 年保修，电池 6 个月。
2. 配件（耳套/表带/线材）：3 个月质保。
3. 保修范围：非人为损坏的质量问题（进水、摔坏、拆机不在保修范围内）。
4. 保修方式：寄修（用户承担寄出运费，返回运费平台承担）。
5. 超出保修期可付费维修，费用提前告知确认。`,
    keywords: ["保修", "质保", "维修", "坏了", "保修期"],
  },
  {
    id: "faq-shipping-fee",
    title: "运费规则",
    category: "shipping",
    content: `【运费规则】
1. 订单满 99 元包邮（偏远地区满 199 元）。
2. 未满包邮门槛，基础运费 8 元。
3. 偏远地区（新疆、西藏、海南等）加收 10 元。
4. 大件商品（> 5kg）单独计费，下单时展示实际运费。
5. 退货运费：质量问题免运费，非质量问题用户自付。`,
    keywords: ["运费", "邮费", "包邮", "快递费"],
  },
];

/**
 * Simple keyword-based FAQ retrieval.
 * Returns top-N matching documents based on keyword overlap.
 */
export function searchFaq(query: string, topK = 3): FaqDoc[] {
  const queryLower = query.toLowerCase();
  const scored = FAQ_DOCS.map(doc => {
    let score = 0;
    for (const kw of doc.keywords) {
      if (queryLower.includes(kw)) score += 3;
    }
    if (queryLower.includes(doc.category)) score += 2;
    // Fuzzy: check if any word in query appears in content
    const words = queryLower.split(/\s+/).filter(w => w.length >= 2);
    for (const w of words) {
      if (doc.content.toLowerCase().includes(w)) score += 1;
    }
    return { doc, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.doc);
}
