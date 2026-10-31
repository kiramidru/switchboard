import { useEffect, useRef, useState } from "react";

export function useScanner({
  root,
  scope,
  delay,
  running,
  setRunning,
  collapsed,
  restore,
  onPress,
}: {
  root: React.RefObject<HTMLElement | null>;
  scope: string;
  delay: number;
  running: boolean;
  setRunning: (running: boolean) => void;
  collapsed: boolean;
  restore: () => void;
  onPress: () => void;
}) {
  const current = useRef("");
  const [label, setLabel] = useState("Start scanning when you’re ready.");
  const state = useRef({ running, collapsed, restore, onPress, setRunning });
  state.current = { running, collapsed, restore, onPress, setRunning };

  function targets() {
    return Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>(
        "button[data-sb-scan]:not(:disabled)",
      ) || [],
    );
  }
  function selectTarget(target: HTMLButtonElement | undefined, focus: boolean) {
    for (const item of targets()) item.removeAttribute("data-sb-current");
    current.current = target?.dataset.sbScan || "";
    if (target) {
      target.setAttribute("data-sb-current", "true");
      setLabel(
        target.getAttribute("aria-label") ||
          target.innerText.replace(/\s+/g, " ").trim(),
      );
      if (focus) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
    }
  }
  useEffect(() => {
    selectTarget(targets()[0], running);
    // Scope changes reset to the first choice, not unrelated website updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  useEffect(() => {
    if (!running || collapsed) {
      for (const item of targets()) item.removeAttribute("data-sb-current");
      return;
    }
    const list = targets();
    selectTarget(
      list.find((item) => item.dataset.sbScan === current.current) || list[0],
      true,
    );
    const timer = setInterval(() => {
      const list = targets();
      const index = list.findIndex(
        (item) => item.dataset.sbScan === current.current,
      );
      selectTarget(list[(index + 1) % list.length], true);
    }, delay);
    return () => clearInterval(timer);
  }, [running, collapsed, delay, scope]);

  useEffect(() => {
    let handled = false;
    function keydown(event: KeyboardEvent) {
      const settings = state.current;
      if (event.isComposing) return;
      if (event.key === "Escape") {
        if (settings.collapsed) settings.restore();
        settings.setRunning(false);
        return;
      }
      if (!(event.code === "Space" || event.key === " ")) return;
      if (event.repeat) {
        if (settings.running || handled) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      const origin = event.composedPath()[0];
      const isTyping =
        origin instanceof HTMLInputElement ||
        origin instanceof HTMLTextAreaElement ||
        (origin instanceof HTMLElement && origin.isContentEditable);
      const focused = root.current?.getRootNode() as ShadowRoot | undefined;
      const startButton =
        focused?.activeElement instanceof HTMLElement &&
        focused.activeElement.dataset.sbScan === "scan-toggle";
      if (
        settings.collapsed ||
        settings.running ||
        (!isTyping && startButton)
      ) {
        handled = true;
        event.preventDefault();
        event.stopImmediatePropagation();
        settings.onPress();
        if (settings.collapsed) settings.restore();
        else if (!settings.running) settings.setRunning(true);
        else
          targets()
            .find((item) => item.dataset.sbScan === current.current)
            ?.click();
      }
    }
    function keyup(event: KeyboardEvent) {
      if (handled && (event.code === "Space" || event.key === " ")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        handled = false;
      }
    }
    // Capture before the host page can treat the switch press as typing or a shortcut.
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup, true);
    return () => {
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("keyup", keyup, true);
    };
  }, []);

  return label;
}
