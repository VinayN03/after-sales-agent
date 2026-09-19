/**
 * Refund progress card — shows refund status and timeline.
 * (Cases handled by the multi-agent pipeline use case-card.tsx; this is the plain status card.)
 */
"use client";

import { useT } from "../../../lib/i18n";

interface Order {
  orderId: string;
  status: string;
  refundReason?: string;
  refundAmount?: number;
  totalAmount: number;
  items: Array<{ name: string }>;
  updatedAt: string;
}

export function RefundCard({ order }: { order: Order }) {
  const { t, locale } = useT();
  const sep = locale === "en" ? ", " : "、";
  const steps = [
    { label: t("ui.card.refund.step.submit"), done: true },
    { label: t("ui.card.refund.step.review"), done: order.status !== "refund_requested" },
    { label: t("ui.card.refund.step.complete"), done: order.status === "refund_completed" },
  ];

  return (
    <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden max-w-sm">
      <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
        <div className="flex items-center gap-2">
          <span className="text-orange-500 text-lg">💰</span>
          <span className="text-sm font-medium text-orange-800">{t("ui.card.refund.title")}</span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">{t("ui.card.refund.orderId")}</span>
            <span className="font-mono text-gray-700">{order.orderId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t("ui.card.refund.product")}</span>
            <span className="text-gray-700">{order.items.map(i => i.name).join(sep)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t("ui.card.refund.amount")}</span>
            <span className="font-semibold text-orange-600">¥{order.refundAmount || order.totalAmount}</span>
          </div>
          {order.refundReason && (
            <div className="flex justify-between">
              <span className="text-gray-500">{t("ui.card.refund.reason")}</span>
              <span className="text-gray-700">{order.refundReason}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-2 pt-2">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                step.done ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-400"
              }`}>
                {step.done ? "✓" : i + 1}
              </div>
              <span className={`text-xs ${step.done ? "text-orange-700" : "text-gray-400"}`}>{step.label}</span>
              {i < steps.length - 1 && (
                <div className={`w-6 h-0.5 mx-1 ${step.done ? "bg-orange-300" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
