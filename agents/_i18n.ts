/**
 * Backend i18n module — translation tables shared by agents and cloud-functions.
 *
 * Usage:
 *   import { t, getLocale, languageDirective, STATUS_LABELS } from "../_i18n";
 *   const msg = t(locale, "ai.refundSubmitted", { orderId });
 *
 * The frontend (lib/i18n.tsx) maintains a parallel translation table with the
 * same keys for client-side rendering.
 */

export type Locale = "zh" | "en";

export function getLocale(body: any): Locale {
  return body?.locale === "en" ? "en" : "zh";
}

/** Append to LLM system prompts to force response language. */
export function languageDirective(locale: Locale): string {
  return locale === "en"
    ? "\n\nIMPORTANT: Respond entirely in English. Even if the source documents are in Chinese, translate your answer to English."
    : "\n\n请全部用中文回答。";
}

// ─── Translation tables ───

const ZH: Record<string, string> = {
  // Status labels
  "status.pending": "待发货",
  "status.shipped": "运输中",
  "status.delivered": "已签收",
  "status.refund_requested": "退款申请中",
  "status.refund_approved": "退款已批准",
  "status.refund_rejected": "退款已拒绝",
  "status.refund_completed": "退款已完成",
  "status.exchange_requested": "换货申请中",
  "status.exchange_shipped": "换货已寄出",
  "status.unknown": "状态未知",

  // Workflow steps (chat agent SSE labels)
  "step.intent_recognition": "正在理解您的问题...",
  "step.faq_search": "正在查找相关政策...",
  "step.lookup_order": "正在查询订单...",
  "step.request_refund": "正在处理退款申请...",
  "step.request_exchange": "正在处理换货申请...",
  "step.general_chat": "正在思考...",

  // AI static response templates
  "ai.kbEmpty": "抱歉，知识库中暂无相关文档。您可以换个方式描述问题，或者直接告诉我您的订单号，我来帮您处理。",
  "ai.faqNotFound": "抱歉，我没有找到与您问题相关的文档信息。您可以换个方式描述问题，或者直接告诉我您的订单号，我来帮您处理。",
  "ai.noOrders": "暂无订单记录。如需帮助，请提供订单号，或先在知识库导入 Demo 数据。",
  "ai.orderListPrompt": "您有以下订单，请告诉我要查询哪一个：\n\n{lines}",
  "ai.orderFound": "已找到您的订单 {orderId}，当前状态：**{statusLabel}**。{tracking}",
  "ai.trackingLine": "\n快递：{carrier} {trackingNumber}",
  "ai.orderNotFound": "抱歉，没有找到订单 {orderId}。请确认订单号是否正确，或先通过知识库导入 Demo 数据。",
  "ai.orderFoundFromBlob": "已找到订单 **{orderId}** 的信息：\n\n{content}",
  "ai.refundNoOrders": "暂无订单记录，无法申请退款。请先导入 Demo 数据或提供订单号。",
  "ai.refundOrderListPrompt": "请选择需要退款的订单（运输中或已签收的订单支持退款申请）：\n\n{lines}\n\n请回复订单号即可。",
  "ai.refundDuplicate": "订单 {orderId} 已有退款记录，无需重复申请。\n\n订单详情：\n{content}",
  "ai.refundDuplicateShort": "订单 {orderId} 已有退款记录（当前状态：{statusLabel}），无需重复申请。",
  "ai.refundIneligible": "订单 {orderId} 当前状态为「{statusLabel}」，暂不支持退款。已签收或运输中的订单方可申请退款。",
  "ai.refundIneligibleWithDetail": "订单 {orderId} 当前状态为「{statusLabel}」，暂不支持退款。已签收或运输中的订单方可申请退款。\n\n订单详情：\n{content}",
  "ai.refundSubmittedSimple": "退款申请已提交，正在等待人工审批。\n\n- 订单：{orderId}\n\n客服经理审核通过后，将在 3-5 个工作日内退回原支付方式。",
  "ai.refundSubmitted": "退款申请已提交，正在等待人工审批。\n\n- 订单：{orderId}\n- 退款金额：¥{amount}\n\n客服经理审核通过后，将在 3-5 个工作日内退回原支付方式。",
  "ai.exchangeNoOrders": "暂无订单记录，无法申请换货。请先导入 Demo 数据或提供订单号。",
  "ai.exchangeOrderListPrompt": "请选择需要换货的订单（仅已签收的订单支持换货申请）：\n\n{lines}\n\n请回复订单号即可。",
  "ai.exchangeDuplicate": "订单 {orderId} 已有换货申请记录，无需重复申请。\n\n订单详情：\n{content}",
  "ai.exchangeIneligible": "订单 {orderId} 当前状态为「{statusLabel}」，仅已签收的商品支持换货。\n\n订单详情：\n{content}",
  "ai.exchangeIneligibleShort": "订单 {orderId} 当前状态为「{statusLabel}」，仅已签收的商品支持换货。",
  "ai.exchangeSubmittedNoItems": "换货申请已提交！\n\n- 订单：{orderId}\n- 处理周期：收到旧件后 3 个工作日寄出新件\n\n请将商品保持全新状态并附带完整包装寄回。",
  "ai.exchangeSubmitted": "换货申请已提交！\n\n- 订单：{orderId}\n- 商品：{items}\n- 处理周期：收到旧件后 3 个工作日寄出新件\n\n请将商品保持全新状态并附带完整包装寄回。",
  "ai.orderNotFoundShort": "未找到订单 {orderId}，请核实订单号。",

  // Suggestion buttons (post-action follow-ups)
  "sug.refund": "我要退款",
  "sug.exchange": "我要换货",
  "sug.refundActionTpl": "我要退 {orderId} 的款",
  "sug.exchangeActionTpl": "我要换 {orderId} 的货",
  "sug.delivery": "预计什么时候到？",
  "sug.deliveryActionTpl": "{orderId} 预计什么时候到？",
  "sug.eta": "什么时候发货？",
  "sug.etaActionTpl": "{orderId} 什么时候发货？",
  "sug.cancel": "我想取消订单",
  "sug.cancelActionTpl": "我想取消订单 {orderId}",
  "sug.status": "最新进度怎么样？",
  "sug.statusActionTpl": "{orderId} 最新进度怎么样？",
  "sug.lookupOther": "查询其他订单",
  "sug.faqGeneral": "售后政策咨询",
  "sug.refundApply": "我要申请退款",
  "sug.timelineRefund": "退款多久到账？",
  "sug.address": "寄回地址是哪里？",
  "sug.timelineExchange": "换货需要多久？",
  "sug.lookupMyOrders": "查询我的订单",

  // SSE: seed-demo
  "seed.start": "开始导入 {docs} 篇文档 + {orders} 个订单...",
  "seed.indexing": "[{i}/{n}] 正在生成索引: {title}",
  "seed.importingOrder": "[{i}/{n}] 导入订单: {orderId}",
  "seed.failure": "导入失败，共 {failed} 条数据写入出错，请检查存储配置。",
  "seed.successOnly": "导入完成！成功 {imported} 条",
  "seed.successWithFailures": "导入完成！成功 {imported} 条，失败 {failed} 条",

  // SSE: upload
  "upload.parsing": "正在解析文档: {filename}",
  "upload.parseDone": "解析完成，提取 {chars} 字符",
  "upload.summarizing": "正在生成摘要和关键词...",
  "upload.saving": "正在保存文档...",
  "upload.noText": "无法从文档中提取有效文本内容。",
  "upload.failure": "上传失败: {error}",
};

const EN: Record<string, string> = {
  // Status labels
  "status.pending": "Pending",
  "status.shipped": "Shipped",
  "status.delivered": "Delivered",
  "status.refund_requested": "Refund Requested",
  "status.refund_approved": "Refund Approved",
  "status.refund_rejected": "Refund Rejected",
  "status.refund_completed": "Refund Completed",
  "status.exchange_requested": "Exchange Requested",
  "status.exchange_shipped": "Exchange Shipped",
  "status.unknown": "Unknown",

  // Workflow steps
  "step.intent_recognition": "Understanding your question...",
  "step.faq_search": "Searching policies...",
  "step.lookup_order": "Looking up your order...",
  "step.request_refund": "Processing refund request...",
  "step.request_exchange": "Processing exchange request...",
  "step.general_chat": "Thinking...",

  // AI static responses
  "ai.kbEmpty": "Sorry, no relevant documents found in the knowledge base. Please rephrase your question or share your order ID and I'll help.",
  "ai.faqNotFound": "Sorry, I couldn't find any documents matching your question. Please rephrase or share your order ID.",
  "ai.noOrders": "No orders found. Please provide an order ID, or import the demo data from the Knowledge Base.",
  "ai.orderListPrompt": "You have the following orders. Which one would you like to look up?\n\n{lines}",
  "ai.orderFound": "Found your order {orderId}. Current status: **{statusLabel}**.{tracking}",
  "ai.trackingLine": "\nShipping: {carrier} {trackingNumber}",
  "ai.orderNotFound": "Sorry, order {orderId} was not found. Please double-check the ID, or import the demo data from the Knowledge Base.",
  "ai.orderFoundFromBlob": "Found details for order **{orderId}**:\n\n{content}",
  "ai.refundNoOrders": "No orders found, can't process refund. Please import demo data or provide an order ID.",
  "ai.refundOrderListPrompt": "Please choose the order to refund (only Shipped or Delivered orders are eligible):\n\n{lines}\n\nReply with the order ID.",
  "ai.refundDuplicate": "Order {orderId} already has a refund record, no need to apply again.\n\nDetails:\n{content}",
  "ai.refundDuplicateShort": "Order {orderId} already has a refund record (current status: {statusLabel}). No need to apply again.",
  "ai.refundIneligible": "Order {orderId} is currently \"{statusLabel}\" and not eligible for refund. Only Shipped or Delivered orders can be refunded.",
  "ai.refundIneligibleWithDetail": "Order {orderId} is currently \"{statusLabel}\" and not eligible for refund. Only Shipped or Delivered orders can be refunded.\n\nDetails:\n{content}",
  "ai.refundSubmittedSimple": "Refund request submitted and is **awaiting human approval**.\n\n- Order: {orderId}\n\nA support manager will review it shortly. Once approved, funds return to your original payment method in 3-5 business days.",
  "ai.refundSubmitted": "Refund request submitted and is **awaiting human approval**.\n\n- Order: {orderId}\n- Refund amount: ¥{amount}\n\nA support manager will review it shortly. Once approved, funds return to your original payment method in 3-5 business days.",
  "ai.exchangeNoOrders": "No orders found, can't process exchange. Please import demo data or provide an order ID.",
  "ai.exchangeOrderListPrompt": "Please choose the order to exchange (only Delivered orders are eligible):\n\n{lines}\n\nReply with the order ID.",
  "ai.exchangeDuplicate": "Order {orderId} already has an exchange record, no need to apply again.\n\nDetails:\n{content}",
  "ai.exchangeIneligible": "Order {orderId} is currently \"{statusLabel}\". Only Delivered items can be exchanged.\n\nDetails:\n{content}",
  "ai.exchangeIneligibleShort": "Order {orderId} is currently \"{statusLabel}\". Only Delivered items can be exchanged.",
  "ai.exchangeSubmittedNoItems": "Exchange submitted!\n\n- Order: {orderId}\n- Processing time: new item ships within 3 business days of receiving the old one\n\nPlease return the item in pristine condition with original packaging.",
  "ai.exchangeSubmitted": "Exchange submitted!\n\n- Order: {orderId}\n- Items: {items}\n- Processing time: new item ships within 3 business days of receiving the old one\n\nPlease return the item in pristine condition with original packaging.",
  "ai.orderNotFoundShort": "Order {orderId} not found, please verify the order ID.",

  // Suggestions
  "sug.refund": "Refund this order",
  "sug.exchange": "Exchange this order",
  "sug.refundActionTpl": "I want a refund for {orderId}",
  "sug.exchangeActionTpl": "I want to exchange {orderId}",
  "sug.delivery": "When will it arrive?",
  "sug.deliveryActionTpl": "When will {orderId} arrive?",
  "sug.eta": "When will it ship?",
  "sug.etaActionTpl": "When will {orderId} ship?",
  "sug.cancel": "Cancel this order",
  "sug.cancelActionTpl": "I want to cancel order {orderId}",
  "sug.status": "What's the latest status?",
  "sug.statusActionTpl": "What's the latest status of {orderId}?",
  "sug.lookupOther": "Look up another order",
  "sug.faqGeneral": "After-sales policies",
  "sug.refundApply": "Apply for a refund",
  "sug.timelineRefund": "How long for refund?",
  "sug.address": "What's the return address?",
  "sug.timelineExchange": "How long for exchange?",
  "sug.lookupMyOrders": "Look up my orders",

  // SSE: seed-demo
  "seed.start": "Importing {docs} docs + {orders} orders...",
  "seed.indexing": "[{i}/{n}] Indexing: {title}",
  "seed.importingOrder": "[{i}/{n}] Importing order: {orderId}",
  "seed.failure": "Import failed: {failed} entries had errors. Check storage configuration.",
  "seed.successOnly": "Done! Imported {imported} entries",
  "seed.successWithFailures": "Done! Imported {imported}, failed {failed}",

  // SSE: upload
  "upload.parsing": "Parsing document: {filename}",
  "upload.parseDone": "Parsed, extracted {chars} chars",
  "upload.summarizing": "Generating summary and keywords...",
  "upload.saving": "Saving document...",
  "upload.noText": "Could not extract text from the document.",
  "upload.failure": "Upload failed: {error}",
};

const TABLES: Record<Locale, Record<string, string>> = { zh: ZH, en: EN };

/** Translate `key` to target locale, with optional `{name}` template params. */
export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
  let str = TABLES[locale]?.[key] ?? TABLES.zh[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.split(`{${k}}`).join(String(v));
    }
  }
  return str;
}

/** Get the localized status label. */
export function statusLabel(locale: Locale, status: string): string {
  return t(locale, `status.${status}`);
}
