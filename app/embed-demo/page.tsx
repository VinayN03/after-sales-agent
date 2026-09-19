"use client";

/**
 * A mock third-party storefront that embeds the assistant with a single script tag —
 * shows what a customer's own website looks like with the widget dropped in.
 */
import { useEffect, useState } from "react";
import Script from "next/script";

const PRODUCTS = [
  { name: "Wireless Noise-Cancelling Headphones", price: "$127.40", tint: "from-indigo-100 to-violet-100" },
  { name: "USB-C Cable Set (3-pack)", price: "$29.99", tint: "from-emerald-100 to-teal-100" },
  { name: "27in 4K Monitor", price: "$389.00", tint: "from-sky-100 to-blue-100" },
  { name: "Smart Watch Series 5", price: "$219.00", tint: "from-amber-100 to-orange-100" },
];

export default function EmbedDemoPage() {
  const [origin, setOrigin] = useState("https://your-site");
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <main className="min-h-screen bg-[#fafaf9] text-stone-800">
      <nav className="flex items-center justify-between border-b border-stone-200 bg-white px-8 py-4">
        <span className="text-lg font-bold tracking-tight">Acme Store</span>
        <div className="flex gap-6 text-sm text-stone-500">
          <span>Shop</span><span>Deals</span><span>Support</span><span>Cart (0)</span>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-8 py-14">
        <div className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Demo · third-party website</div>
        <h1 className="mt-2 max-w-xl text-4xl font-bold tracking-tight">Everything you love, delivered fast.</h1>
        <p className="mt-3 max-w-xl text-stone-500">
          This page is a stand-in for a customer&apos;s own site. Click the chat bubble in the corner — the
          after-sales assistant is embedded with a single script tag.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {PRODUCTS.map(p => (
            <div key={p.name} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className={`h-28 bg-gradient-to-br ${p.tint}`} />
              <div className="p-3">
                <div className="text-sm font-medium leading-snug">{p.name}</div>
                <div className="mt-1 text-sm text-stone-500">{p.price}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-stone-200 bg-white p-5">
          <div className="text-sm font-semibold">Add the assistant to any site</div>
          <p className="mt-1 text-sm text-stone-500">One line, no build step. The chat runs in an isolated iframe.</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-stone-900 p-4 text-[13px] text-stone-100">
            {`<script src="${origin}/embed.js" async></script>`}
          </pre>
          <p className="mt-3 text-xs text-stone-400">
            Optional: <code>data-position=&quot;left&quot;</code> · <code>data-color=&quot;#0ea5e9&quot;</code>
          </p>
        </div>
      </section>

      <Script src="/embed.js" strategy="afterInteractive" data-demo="1" />
    </main>
  );
}
