import { createRoot } from "react-dom/client";
import Panel from "./Panel";
import { FormAdapter } from "./adapter";
import styles from "./panel.css?inline";

export function mountSwitchboard(mode: "demo" | "extension" = "demo"): void {
  const existing = document.getElementById("switchboard-root");
  if (existing) {
    existing.dispatchEvent(new Event("switchboard:focus"));
    return;
  }
  const body = document.body;
  if (!body) return;
  const priorFocus = document.activeElement as HTMLElement | null;
  const host = document.createElement("div");
  host.id = "switchboard-root";
  const shadow = host.attachShadow({ mode: "open" });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(styles);
  shadow.adoptedStyleSheets = [sheet];
  const container = document.createElement("div");
  shadow.append(container);
  body.append(host);
  const adapter = new FormAdapter();
  const root = createRoot(container);
  const oldPadding = body.style.getPropertyValue("padding-right");
  const oldPriority = body.style.getPropertyPriority("padding-right");
  const computedPadding = parseFloat(getComputedStyle(body).paddingRight) || 0;
  let collapsed = false;
  let closed = false;
  function restorePadding() {
    if (oldPadding)
      body.style.setProperty("padding-right", oldPadding, oldPriority);
    else body.style.removeProperty("padding-right");
  }
  function reserveSpace() {
    if (!collapsed && window.innerWidth >= 1000)
      body.style.setProperty("padding-right", `${computedPadding + 444}px`);
    else restorePadding();
  }
  const onCollapse = (next: boolean) => {
    collapsed = next;
    reserveSpace();
  };
  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener("resize", reserveSpace);
    adapter.destroy();
    root.unmount();
    host.remove();
    restorePadding();
    if (priorFocus?.isConnected) priorFocus.focus({ preventScroll: true });
  }
  host.addEventListener("switchboard:focus", () => {
    const button =
      shadow.querySelector<HTMLButtonElement>(
        ".sb-return-bar>button:not(.sb-icon-button)",
      ) ||
      shadow.querySelector<HTMLButtonElement>('[data-sb-scan="scan-toggle"]');
    if (collapsed) button?.click();
    else button?.focus();
  });
  window.addEventListener("resize", reserveSpace);
  reserveSpace();
  root.render(
    <Panel
      adapter={adapter}
      mode={mode}
      onClose={close}
      onCollapse={onCollapse}
    />,
  );
}
