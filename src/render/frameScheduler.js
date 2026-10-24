// Keep only the newest pointer update; continuous input must never postpone a frame.
export function createFrameScheduler(draw, request = requestAnimationFrame, cancel = cancelAnimationFrame) {
  let frame = null, pending = null;
  function flush() {
    if (frame !== null) cancel(frame);
    frame = null;
    const value = pending;
    pending = null;
    if (value !== null) draw(value);
  }
  return {
    schedule(value) {
      pending = value;
      if (frame === null) frame = request(flush);
    },
    flush,
    cancel() {
      if (frame !== null) cancel(frame);
      frame = null;
      pending = null;
    },
  };
}
