/**
 * Conditional edge functions for the after-sales graph.
 */
import type { AfterSalesStateType } from "./state";

export function routeByIntent(state: AfterSalesStateType): string {
  switch (state.intent) {
    case "faq": return "faq_search";
    case "lookup_order": return "lookup_order";
    case "refund": return "request_refund";
    case "exchange": return "request_exchange";
    default: return "general_chat";
  }
}
