/**
 * LangGraph State Schema for after-sales assistant.
 */
import { Annotation } from "@langchain/langgraph";
import type { Order } from "../_shared";
import type { Locale } from "../_i18n";

export const AfterSalesState = Annotation.Root({
  userInput: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),

  // User locale (for i18n response generation)
  locale: Annotation<Locale>({ reducer: (_, n) => n, default: () => "zh" }),

  // Intent classification
  intent: Annotation<"faq" | "lookup_order" | "refund" | "exchange" | "general" | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),

  // Order context (extracted from user message or lookup)
  orderId: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),
  currentOrder: Annotation<Order | null>({ reducer: (_, n) => n, default: () => null }),

  // FAQ search results
  faqResults: Annotation<Array<{ id: string; title: string; content: string }>>({
    reducer: (_, n) => n,
    default: () => [],
  }),

  // Refund/Exchange state
  refundReason: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),
  exchangeTarget: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),

  // AI response
  aiResponse: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),

  // Whether to emit a card
  cardEvent: Annotation<{ type: string; data: Record<string, unknown> } | null>({
    reducer: (_, n) => n,
    default: () => null,
  }),

  // Whether to wait for user
  waitingForUser: Annotation<boolean>({ reducer: (_, n) => n, default: () => false }),
});

export type AfterSalesStateType = typeof AfterSalesState.State;
