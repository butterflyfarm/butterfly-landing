// The farm's light. Given the hour and how wet the weather is, work out the
// sky gradient, the colour of the light falling on the land (applied as a
// multiply tint), and how much of the night has arrived.

type RGB = readonly [number, number, number]

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
const times = (a: RGB, b: RGB): RGB => [(a[0] * b[0]) / 255, (a[1] * b[1]) / 255, (a[2] * b[2]) / 255]
const css = (c: RGB) => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`

type Key = { at: number; sky: RGB[]; tint: RGB; cloud: RGB; night: number }

const key = (at: number, sky: string[], tint: string, cloud: string, night: number): Key => ({
  at,
  sky: sky.map(hex),
  tint: hex(tint),
  cloud: hex(cloud),
  night,
})

const NIGHT = ['#141c36', '#1a2746', '#243558', '#31466a', '#41587a']
const DAY = ['#86a7bd', '#9dbac9', '#bccfcf', '#d9dcc8', '#e8dcc0']

// sky colours run from the top of the sky down to the horizon
const KEYS: Key[] = [
  key(0, NIGHT, '#56689e', '#6c7cab', 1),
  key(4.5, NIGHT, '#56689e', '#6c7cab', 1),
  key(5.5, ['#2b3659', '#4c5079', '#8a6f8e', '#d19a8e', '#eebf99'], '#8f88a8', '#a99aae', 0.4),
  key(6.6, ['#7391b2', '#a1b3c6', '#d6c2c0', '#efd0ac', '#f5dcb0'], '#e6cbb8', '#f3ddd0', 0),
  key(9, DAY, '#fdf6ea', '#ffffff', 0),
  key(12, DAY, '#ffffff', '#ffffff', 0),
  key(16, DAY, '#fff5e4', '#fff6ea', 0),
  key(17.6, ['#7d94b5', '#aea4b6', '#dcb09e', '#f0bd88', '#f5cb90'], '#f1c8a0', '#f6d2b4', 0),
  key(18.6, ['#4a5788', '#77689a', '#b07c92', '#dc917c', '#eaac7e'], '#b093aa', '#c9a2a6', 0.2),
  key(19.6, ['#252f55', '#333d68', '#514e7c', '#7a6388', '#a37a88'], '#7479a6', '#8a86ac', 0.65),
  key(21, NIGHT, '#56689e', '#6c7cab', 1),
  key(24, NIGHT, '#56689e', '#6c7cab', 1),
]

const STOPS = [0, 32, 64, 88, 100]
const RAIN_LIGHT: RGB = [205, 214, 224]
const RAIN_CLOUD: RGB = [180, 189, 204]
const LAMP: RGB = [226, 186, 134]

export type Light = {
  sky: string
  tint: string
  cloudTint: string
  signTint: string
  /** 0 by day, 1 in full night */
  night: number
  /** true when the light is plain daylight and nothing needs tinting */
  flat: boolean
}

export function lightAt(hour: number, wet: number): Light {
  let i = 0
  while (i < KEYS.length - 2 && hour >= KEYS[i + 1].at) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const t = Math.min(1, Math.max(0, (hour - a.at) / (b.at - a.at)))

  const night = a.night + (b.night - a.night) * t
  const overcast = mix([150, 160, 166], [34, 42, 60], night)
  const sky = a.sky.map((c, j) => {
    const clear = mix(c, b.sky[j], t)
    return css(mix(clear, mix(clear, overcast, 0.8), wet))
  })
  const tint = times(mix(a.tint, b.tint, t), mix([255, 255, 255], RAIN_LIGHT, wet))
  const cloud = times(mix(a.cloud, b.cloud, t), mix([255, 255, 255], RAIN_CLOUD, wet))
  const lamps = Math.min(1, night * 1.8)

  return {
    sky: `linear-gradient(180deg, ${sky.map((c, j) => `${c} ${STOPS[j]}%`).join(', ')})`,
    tint: css(tint),
    cloudTint: css(cloud),
    // the farm sign hangs under a lantern, so it never gets as dark as the fields
    signTint: css(mix(tint, LAMP, lamps * 0.75)),
    night,
    flat: tint.every((c) => c > 253.5),
  }
}
