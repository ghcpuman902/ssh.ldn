/**
 * iOS 120 Hz input pilot (rida.dev/blog/bypassing-ios-safari-60-fps-limit).
 * Off unless asked for: `?fps120=1` turns the controller on and remembers it,
 * `?fps120=0` turns it off and forgets it. `?fpsmeter=1` shows the meter
 * alone, so the plain map can be measured with the same numbers.
 */
export type Fps120Flags = { controller: boolean; meter: boolean }

const STORAGE_KEY = "ssh-ldn:fps120"

export const readFps120Flags = (search: string, storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null): Fps120Flags => {
  const params = new URLSearchParams(search)
  const param = params.get("fps120")
  if (param === "1") storage?.setItem(STORAGE_KEY, "1")
  if (param === "0") storage?.removeItem(STORAGE_KEY)
  const controller = param === "1" || (param === null && storage?.getItem(STORAGE_KEY) === "1")
  return { controller, meter: controller || params.get("fpsmeter") === "1" }
}

/** Next sample time: one refresh interval grid, phase-locked to the last rAF timestamp. */
export const nextSampleDelay = (now: number, lastFrame: number, interval: number) => {
  const k = Math.floor((now - lastFrame) / interval) + 1
  let delay = lastFrame + k * interval - now
  // iOS rounds performance.now() to 1 ms: never schedule closer than that.
  if (delay < 1.5) delay += interval
  return delay
}
