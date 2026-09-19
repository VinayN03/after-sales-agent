/**
 * Order detail card — shows order info, items, status, tracking.
 */
"use client";

import { useT } from "../../../lib/i18n";

interface OrderItem {
  name: string;
  specs: string;
  quantity: number;
  price: number;
}

interface Order {
  orderId: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  createdAt: string;
  trackingNumber?: string;
  carrier?: string;
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pending: { color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  shipped: { color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  delivered: { color: "text-green-700", bg: "bg-green-50 border-green-200" },
  refund_requested: { color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  refund_approved: { color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  refund_rejected: { color: "text-red-700", bg: "bg-red-50 border-red-200" },
  refund_completed: { color: "text-gray-700", bg: "bg-gray-50 border-gray-200" },
  exchange_requested: { color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  exchange_shipped: { color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
};

export function OrderCard({ order }: { order: Order }) {
  const { t, locale } = useT();
  const colors = STATUS_COLORS[order.status] || { color: "text-gray-700", bg: "bg-gray-50 border-gray-200" };
  const label = t(`status.${order.status}`);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-w-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-mono text-gray-500">{order.orderId}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colors.bg} ${colors.color}`}>
          {label}
        </span>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-2">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-900">{item.name}</p>
              <p className="text-xs text-gray-500">{item.specs} x{item.quantity}</p>
            </div>
            <span className="text-sm font-medium text-gray-700">¥{item.price}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t("ui.card.order.total")}</span>
          <span className="font-semibold text-gray-900">¥{order.totalAmount}</span>
        </div>
        {order.trackingNumber && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>{t("ui.card.order.shipping")}</span>
            <span>{order.carrier} {order.trackingNumber}</span>
          </div>
        )}
        <div className="flex justify-between text-xs text-gray-400">
          <span>{t("ui.card.order.placedAt")}</span>
          <span>{new Date(order.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN")}</span>
        </div>
      </div>
    </div>
  );
}
