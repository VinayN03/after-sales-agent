/*!
 * After-Sales Assistant — embeddable chat widget.
 *
 * Add ONE line to any page:
 *   <script src="https://YOUR-SITE/embed.js" async></script>
 *
 * Optional attributes on the script tag:
 *   data-position="left"   put the launcher bottom-left (default: bottom-right)
 *   data-color="#4f46e5"   launcher colour
 *
 * The chat runs in an iframe served from the same origin as this script, so the host page
 * never sees conversation data and its own styles/scripts can't interfere with the widget.
 */
(function () {
  if (window.__afterSalesWidget) return;
  window.__afterSalesWidget = true;

  var script = document.currentScript || document.querySelector('script[src*="embed.js"]');
  var origin = new URL(script.src, location.href).origin;
  var left = script.getAttribute("data-position") === "left";
  var color = script.getAttribute("data-color") || "#4f46e5";
  var side = left ? "left" : "right";

  var css = [
    ".asw-launcher{position:fixed;bottom:20px;" + side + ":20px;z-index:2147483000;width:56px;height:56px;border:0;border-radius:50%;cursor:pointer;color:#fff;background:linear-gradient(135deg," + color + ",#7c3aed);box-shadow:0 8px 24px rgba(79,70,229,.35);display:flex;align-items:center;justify-content:center;transition:transform 160ms cubic-bezier(.23,1,.32,1),box-shadow 160ms ease}",
    ".asw-launcher:active{transform:scale(.95)}",
    "@media (hover:hover) and (pointer:fine){.asw-launcher:hover{box-shadow:0 10px 28px rgba(79,70,229,.45)}}",
    ".asw-panel{position:fixed;bottom:88px;" + side + ":20px;z-index:2147483000;width:380px;height:min(640px,calc(100vh - 110px));max-width:calc(100vw - 24px);border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 20px 60px rgba(15,23,42,.25);opacity:0;pointer-events:none;transform:translateY(8px) scale(.96);transform-origin:bottom " + side + ";transition:opacity 200ms cubic-bezier(.23,1,.32,1),transform 200ms cubic-bezier(.23,1,.32,1)}",
    ".asw-panel.asw-open{opacity:1;pointer-events:auto;transform:none}",
    ".asw-panel iframe{width:100%;height:100%;border:0;display:block}",
    "@media (max-width:480px){.asw-panel{" + side + ":12px;bottom:84px}}",
    "@media (prefers-reduced-motion:reduce){.asw-panel{transform:none}}"
  ].join("");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var panel = document.createElement("div");
  panel.className = "asw-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "After-sales chat");

  var launcher = document.createElement("button");
  launcher.className = "asw-launcher";
  launcher.setAttribute("aria-label", "Open chat");
  launcher.setAttribute("aria-expanded", "false");
  var chatIcon = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/></svg>';
  var closeIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  launcher.innerHTML = chatIcon;

  var frame = null;
  function setOpen(open) {
    if (open && !frame) {
      // Load the chat lazily, the first time it is opened.
      frame = document.createElement("iframe");
      frame.src = origin + "/widget" + (script.getAttribute("data-demo") ? "?demo=1" : "");
      frame.title = "After-sales assistant";
      panel.appendChild(frame);
    }
    panel.classList.toggle("asw-open", open);
    launcher.innerHTML = open ? closeIcon : chatIcon;
    launcher.setAttribute("aria-expanded", String(open));
    launcher.setAttribute("aria-label", open ? "Close chat" : "Open chat");
  }

  launcher.addEventListener("click", function () {
    setOpen(!panel.classList.contains("asw-open"));
  });
  window.addEventListener("message", function (e) {
    if (e.origin === origin && e.data && e.data.source === "after-sales-widget" && e.data.type === "close") setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });

  document.body.appendChild(panel);
  document.body.appendChild(launcher);
})();
