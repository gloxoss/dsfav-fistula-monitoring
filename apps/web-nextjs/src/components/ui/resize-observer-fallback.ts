// Radix measures slider thumbs in browsers and in test DOMs that expose this API.
// The no-op fallback keeps non-visual test environments from failing at mount.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserverFallback implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
