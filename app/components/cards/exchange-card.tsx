/**
 * Exchange confirmation card.
 */
"use client";

import { useT } from "../../../lib/i18n";

interface Order {
  orderId: string;
  status: string;
  items: Array<{ name: string; specs: string }>;
  exchangeReason?: string;
  updatedAt: string;
}

export function ExchangeCard({ order }: { order: Order }) {
  const { t, locale } = useT();
  const sep = locale === "en" ? ", " : "、";
  return (
    <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden max-w-sm">
      <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <span className="text-purple-500 text-lg">🔄</span>
          <span className="text-sm font-medium text-purple-800">{t("ui.card.exchange.title")}</span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">{t("ui.card.exchange.orderId")}</span>
          <span className="font-mono text-gray-700">{order.orderId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t("ui.card.exchange.product")}</span>
          <span className="text-gray-700">{order.items.map(i => `${i.name}(${i.specs})`).join(sep)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t("ui.card.exchange.status")}</span>
          <span className="text-purple-600 font-medium">
            {order.status === "exchange_shipped" ? t("ui.card.exchange.shipped") : t("ui.card.exchange.pending")}
          </span>
        </div>

        <div className="mt-3 p-2 rounded-lg bg-purple-50 text-xs text-purple-700">
          <p className="font-medium mb-1">{t("ui.card.exchange.notesTitle")}</p>
          <ul className="list-disc list-inside space-y-0.5 text-purple-600">
            <li>{t("ui.card.exchange.note1")}</li>
            <li>{t("ui.card.exchange.note2")}</li>
            <li>{t("ui.card.exchange.note3")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
