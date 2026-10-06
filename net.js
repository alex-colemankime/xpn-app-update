// Keep requests bounded on older web views too. A caller's cancellation
// always wins, including when it was already cancelled before the request.
export function withTimeout(signal, ms = 10000) {
  if (signal?.aborted) return signal;
  if (typeof AbortSignal !== "undefined" && AbortSignal.any && AbortSignal.timeout) {
    const timeout = AbortSignal.timeout(ms);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
  }
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  const timer = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    ms,
  );
  // Node tests should not be kept alive solely by a request deadline.
  timer.unref?.();
  signal?.addEventListener("abort", cancel, { once: true });
  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    },
    { once: true },
  );
  return controller.signal;
}
