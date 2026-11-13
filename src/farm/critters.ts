// The animals who wander across the farm. Every ten seconds or so one sets
// off from one side and crosses to the other: who comes depends on the hour
// and the weather. They are drawn in world units, facing right, feet at y = 0.

type Part = { d: string; fill: string }
type Leg = { x: number; y: number; len: number; w: number; phase: number }

type Kind = {
  parts: readonly Part[]
  legs: readonly Leg[]
  legFill: string
  gait: 'walk' | 'hop' | 'waddle'
  /** world units per second, at full size */
  speed: number
  /** strides (or hops) per second */
  beat: number
  /** how far the legs reach in a stride, in radians */
  reach?: number
  /** how high a hop goes */
  hop?: number
  size: number
  /** near: along the front of the meadow; far: higher up, smaller, behind the garden */
  lane: 'near' | 'far'
  /** stops for a while partway, head down */
  grazes?: boolean
  /** radius of the shadow on the grass */
  shadow: number
  /** little ones who follow behind */
  family?: { kind: Kind; count: number; gap: number }
  /** how glad it is to be out by day, at dusk, at night, and how much rain changes that */
  likes: readonly [day: number, dusk: number, night: number, rain: number]
}

export type Shade = { lean: number; stretch: number; strength: number }
type Point = { x: number; y: number }

const legs4 = (front: number, back: number, y: number, len: number, w: number): Leg[] => [
  { x: back - 3, y, len, w, phase: 0 },
  { x: front + 3, y, len, w, phase: Math.PI },
  { x: back, y, len, w, phase: Math.PI },
  { x: front, y, len, w, phase: 0 },
]
const dot = (x: number, y: number, r: number) => `M${x + r} ${y}a${r} ${r} 0 1 0 -0.01 0Z`

const FOX: Kind = {
  parts: [
    { d: 'M-22 -21C-34 -26 -50 -24 -57 -15C-52 -11 -40 -12 -24 -15Z', fill: '#b9724b' },
    { d: 'M-50 -20.5C-53 -19 -55.5 -17 -57 -15C-54 -13 -51 -13 -47.5 -14Z', fill: '#ece2cf' },
    { d: 'M-25 -19C-25 -29 -10 -31 6 -29C18 -28 25 -24 25 -18C25 -13 18 -11 6 -11C-10 -11 -25 -11 -25 -19Z', fill: '#c47b50' },
    { d: 'M14 -26C22 -24 24 -18 22 -12C18 -11 15 -12 14 -15Z', fill: '#ece2cf' },
    { d: 'M17 -24C19 -33 27 -37 32 -35L34 -44L38 -34C41 -33 45 -30 51 -27C47 -23 41 -21 34 -21C27 -20 20 -20 17 -24Z', fill: '#c47b50' },
    { d: 'M34 -27C38 -26 44 -26 50 -27C46 -23 40 -22 35 -22Z', fill: '#ece2cf' },
    { d: 'M34.6 -40.5L36.3 -35L34 -35Z', fill: '#5a4236' },
    { d: dot(49.6, -27.6, 1.6), fill: '#3a2e28' },
    { d: dot(37.5, -30.5, 1.2), fill: '#3a2e28' },
  ],
  legs: legs4(17, -16, -15, 15, 3),
  legFill: '#5a4236',
  gait: 'walk',
  speed: 62,
  beat: 1.6,
  reach: 0.34,
  size: 1,
  lane: 'near',
  shadow: 30,
  likes: [0.5, 1.5, 1.1, 0.4],
}

const RABBIT: Kind = {
  parts: [
    { d: 'M9 -21C6 -30 7 -36 9 -36C11 -36 12 -30 12 -22Z', fill: '#8f7c6b' },
    { d: 'M-12 0C-12 -2.5 -4 -2.5 2 -1.2C3 0 2 0.6 0 0.6H-10Z', fill: '#8f7c6b' },
    { d: 'M-13 -4C-15 -14 -7 -21 3 -19C10 -18 13 -12 13 -6C13 -2 9 0 3 0H-8C-11 0 -13 -2 -13 -4Z', fill: '#a99683' },
    { d: 'M-4 -1C2 -1 8 -2 10.5 -5C8.5 -2 4 0 -2 0Z', fill: '#e6ddcc' },
    { d: 'M7 -16C7 -22 12 -25 17 -23C20 -22 21 -18 19 -15C17 -13 11 -12 7 -16Z', fill: '#a99683' },
    { d: 'M12 -22C10 -31 12 -37 14 -37C16 -37 16 -30 15 -22Z', fill: '#b4a18e' },
    { d: 'M13 -24C12.2 -30 13 -34 14 -34C15 -34 15 -30 14.4 -24Z', fill: '#d6b8ab' },
    { d: dot(16.3, -19, 1.1), fill: '#2e2622' },
    { d: dot(-13, -9, 3.4), fill: '#f0ebdf' },
  ],
  legs: [{ x: 7, y: -5, len: 5, w: 2.6, phase: 0 }],
  legFill: '#958270',
  gait: 'hop',
  speed: 78,
  beat: 1.7,
  hop: 10,
  size: 1,
  lane: 'near',
  grazes: true,
  shadow: 14,
  likes: [1.5, 1.1, 0.2, 0.15],
}

const duckParts = (body: string, wing: string): Part[] => [
  { d: 'M-13 -10L-19 -15L-12 -14Z', fill: wing },
  { d: 'M-14 -8C-16 -16 -8 -20 2 -18C10 -17 14 -14 14 -10C14 -5 8 -3 0 -3H-8C-12 -3 -14 -5 -14 -8Z', fill: body },
  { d: 'M-10 -12C-4 -16 4 -15 8 -11C2 -8 -6 -8 -10 -12Z', fill: wing },
  { d: 'M6 -15C5 -23 8 -30 13 -30C17 -30 19 -27 18 -24C17 -21 14 -19 12 -14Z', fill: body },
  { d: 'M17 -26.5L23.5 -25L17.5 -23Z', fill: '#d6a25e' },
  { d: dot(14.6, -26.4, 1), fill: '#2e2622' },
]
const duckLegs: Leg[] = [
  { x: -2, y: -4, len: 4, w: 2.2, phase: 0 },
  { x: 3, y: -4, len: 4, w: 2.2, phase: Math.PI },
]

const DUCKLING: Kind = {
  parts: duckParts('#e4d08c', '#d3be78'),
  legs: duckLegs,
  legFill: '#d6a25e',
  gait: 'waddle',
  speed: 30,
  beat: 3.6,
  size: 0.5,
  lane: 'near',
  shadow: 8,
  likes: [0, 0, 0, 0],
}

const DUCK: Kind = {
  parts: duckParts('#ebe5d6', '#d5cebd'),
  legs: duckLegs,
  legFill: '#d6a25e',
  gait: 'waddle',
  speed: 30,
  beat: 2.6,
  size: 1.05,
  lane: 'near',
  shadow: 16,
  family: { kind: DUCKLING, count: 3, gap: 20 },
  likes: [1.2, 0.6, 0, 2.6],
}

const HEDGEHOG: Kind = {
  parts: [
    { d: 'M-13 -1L-15 -5L-12 -6L-14 -10L-10 -10L-10 -14L-6 -12L-4 -16L-1 -12L2 -15L4 -11L7 -12L7 -8L9 -4L7 -1Z', fill: '#7d6853' },
    { d: 'M-10 -6L-8 -9.5L-6 -6L-3 -10.5L-1 -6L2 -9.5L3 -5Z', fill: '#9a8468' },
    { d: 'M5 -9C9 -10 12 -7 16 -3C13 -1 9 -1 5 -2Z', fill: '#cdb894' },
    { d: dot(16, -3.2, 1.3), fill: '#2e2622' },
    { d: dot(9.5, -6.5, 0.9), fill: '#2e2622' },
  ],
  legs: [
    { x: -8, y: -2, len: 2, w: 2.4, phase: 0 },
    { x: 5, y: -2, len: 2, w: 2.4, phase: Math.PI },
  ],
  legFill: '#6a5747',
  gait: 'walk',
  speed: 26,
  beat: 3.4,
  size: 1.1,
  lane: 'near',
  shadow: 13,
  likes: [0.1, 0.9, 1.7, 0.6],
}

const DEER: Kind = {
  parts: [
    { d: 'M-24 -46L-28.5 -42L-24 -40Z', fill: '#efe4d2' },
    { d: 'M-25 -38C-27 -48 -14 -52 4 -50C16 -49 22 -44 22 -38C22 -32 14 -30 2 -30C-12 -30 -25 -30 -25 -38Z', fill: '#a9825f' },
    { d: 'M-16 -31C-6 -30 8 -30 16 -32C12 -30 4 -29.5 -4 -29.5Z', fill: '#e7d8c2' },
    { d: 'M12 -46C14 -56 18 -64 22 -68L28 -63C25 -58 23 -50 21 -42Z', fill: '#a9825f' },
    { d: 'M20 -67C23 -71 30 -70 36 -64C35 -61 31 -60 27 -60C23 -61 20 -64 20 -67Z', fill: '#a9825f' },
    { d: 'M22 -68L15.5 -75.5L24.5 -71Z', fill: '#93704f' },
    { d: dot(27, -66, 1.1), fill: '#2e2622' },
    { d: dot(35.6, -63.4, 1.2), fill: '#2e2622' },
  ],
  legs: legs4(13, -18, -33, 33, 2.8),
  legFill: '#8d6b4f',
  gait: 'walk',
  speed: 40,
  beat: 1.1,
  reach: 0.24,
  size: 1,
  lane: 'far',
  grazes: true,
  shadow: 26,
  likes: [0.5, 1.7, 0.6, 0.5],
}

const CAT: Kind = {
  parts: [
    { d: 'M-15 -15C-22 -17 -25 -25 -23 -32C-22 -35 -19 -34 -19.5 -31C-21 -26 -19 -21 -14 -18Z', fill: '#8f8a84' },
    { d: 'M-16 -13C-17 -19 -8 -21 4 -20C12 -19 15 -16 15 -12C15 -8 10 -7 2 -7H-10C-14 -7 -16 -9 -16 -13Z', fill: '#8f8a84' },
    { d: 'M-14 -16C-10 -20 4 -21 10 -18C4 -17 -6 -16.5 -14 -16Z', fill: '#77726d' },
    { d: 'M15 -26.5L15 -31L18 -27Z', fill: '#77726d' },
    { d: 'M11 -19C11 -26 17 -28 21 -26L22 -31L24 -26C26 -25 27 -22 26 -19C25 -16 21 -15 17 -15C13 -15 11 -16 11 -19Z', fill: '#8f8a84' },
    { d: dot(21.5, -21.5, 1.1), fill: '#3a3a2a' },
  ],
  legs: legs4(10, -11, -8, 8, 2.6),
  legFill: '#7f7a74',
  gait: 'walk',
  speed: 36,
  beat: 1.7,
  size: 1,
  lane: 'near',
  grazes: true,
  shadow: 18,
  likes: [1, 1, 0.6, 0.1],
}

const SHEEP: Kind = {
  parts: [
    { d: 'M-18 -12C-24 -12 -24 -22 -18 -24C-18 -30 -10 -32 -6 -28C-2 -33 6 -33 9 -28C14 -31 20 -27 18 -21C23 -18 21 -11 16 -11C14 -7 8 -7 6 -10C2 -6 -6 -6 -8 -10C-12 -7 -18 -8 -18 -12Z', fill: '#ebe5d6' },
    { d: 'M-16 -12C-10 -9 0 -9 8 -10C14 -10 17 -12 18 -14C18 -11 14 -9 10 -9C4 -7 -6 -7 -16 -10Z', fill: '#d7d0bf' },
    { d: 'M15 -23C17 -27 23 -27 25 -23C27 -19 25 -14 21 -13C17 -13 15 -17 15 -23Z', fill: '#4a423b' },
    { d: 'M16 -22L11 -20.5L15.5 -19.5Z', fill: '#4a423b' },
    { d: dot(22, -21, 0.9), fill: '#ebe5d6' },
  ],
  legs: legs4(11, -12, -10, 10, 2.6),
  legFill: '#4a423b',
  gait: 'walk',
  speed: 24,
  beat: 1.3,
  size: 1.1,
  lane: 'near',
  grazes: true,
  shadow: 22,
  likes: [1.2, 0.5, 0.05, 0.6],
}

const FROG: Kind = {
  parts: [
    { d: 'M-7 -2C-12 -3 -12 1 -7 1Z', fill: '#5f8a4f' },
    { d: 'M-8 0C-10 -5 -6 -10 0 -10C5 -10 9 -7 8 -2C8 0 6 0 4 0Z', fill: '#78a05f' },
    { d: 'M-4 0C0 -2 4 -2 6 0Z', fill: '#c9d6a0' },
    { d: dot(1, -10.4, 2.4), fill: '#78a05f' },
    { d: dot(1.6, -10.8, 1), fill: '#2e2622' },
  ],
  legs: [{ x: 5, y: -2, len: 2, w: 1.6, phase: 0 }],
  legFill: '#5f8a4f',
  gait: 'hop',
  speed: 42,
  beat: 1.4,
  hop: 13,
  size: 1.2,
  lane: 'near',
  shadow: 9,
  likes: [0.1, 0.25, 0.25, 9],
}

const KINDS = [FOX, RABBIT, DUCK, HEDGEHOG, DEER, CAT, SHEEP, FROG]

const paths = new Map<string, Path2D>()
const path = (d: string) => {
  let p = paths.get(d)
  if (!p) paths.set(d, (p = new Path2D(d)))
  return p
}

type Critter = {
  kind: Kind
  x: number
  y: number
  dir: 1 | -1
  s: number
  phase: number
  /** where it means to stop and graze, if it does */
  pauseAt: number | null
  pauseLeft: number
  /** a burst of speed after being startled, fading to 0 */
  hurry: number
  jump: number
  jv: number
}

function figure(c: CanvasRenderingContext2D, k: Kind, x: number, y: number, dir: number, s: number, phase: number, still: boolean, jump: number) {
  const cycle = phase * Math.PI * 2
  let lift = jump
  let tilt = 0
  let tuck = 0
  if (still) {
    tilt = k.grazes ? 0.16 : 0
  } else if (k.gait === 'hop') {
    const h = Math.max(0, Math.sin(cycle))
    lift += h * (k.hop ?? 8)
    tilt = -0.14 * h
    tuck = 0.8 * h
  } else if (k.gait === 'waddle') {
    tilt = Math.sin(cycle) * 0.08
  } else {
    lift += Math.abs(Math.sin(cycle)) * 0.8
  }

  c.save()
  c.translate(x, y - lift * s)
  c.scale(dir * s, s)
  c.rotate(tilt)
  c.fillStyle = k.legFill
  for (const leg of k.legs) {
    const swing = still ? 0 : k.gait === 'hop' ? tuck : Math.sin(cycle + leg.phase) * (k.reach ?? (k.gait === 'waddle' ? 0.3 : 0.42))
    c.save()
    c.translate(leg.x, leg.y)
    c.rotate(swing)
    c.fillRect(-leg.w / 2, 0, leg.w, leg.len + 0.4)
    c.restore()
  }
  for (const part of k.parts) {
    c.fillStyle = part.fill
    c.fill(path(part.d))
  }
  c.restore()
}

export function makeCritters(rand: () => number) {
  const live: Critter[] = []
  let wait = 3.5 // the first one comes along soon after arrival
  let last: Kind | null = null
  let edge = 800

  function choose(night: number, wet: number): Kind {
    const day = Math.max(0, 1 - 2 * night)
    const dusk = 1 - Math.abs(2 * night - 1)
    const dark = Math.max(0, 2 * night - 1)
    const weights = KINDS.map((k) => {
      if (k === last) return 0
      const [d, u, n, r] = k.likes
      return (d * day + u * dusk + n * dark) * (wet > 0.4 ? r : 1)
    })
    let pick = rand() * weights.reduce((a, b) => a + b, 0)
    for (let i = 0; i < KINDS.length; i++) {
      pick -= weights[i]
      if (pick <= 0) return KINDS[i]
    }
    return FOX
  }

  function spawn(vis: number, night: number, wet: number) {
    const kind = choose(night, wet)
    last = kind
    const dir = rand() < 0.5 ? 1 : -1
    const far = kind.lane === 'far'
    const s = kind.size * (far ? 0.58 : 1)
    live.push({
      kind,
      x: -dir * (vis / 2 + 70),
      y: far ? 684 + rand() * 10 : 798 + rand() * 6,
      dir,
      s,
      phase: rand(),
      pauseAt: kind.grazes && rand() < 0.7 ? (rand() - 0.5) * vis * 0.6 : null,
      pauseLeft: 0,
      hurry: 0,
      jump: 0,
      jv: 0,
    })
    live.sort((a, b) => a.y - b.y)
  }

  return {
    count: () => live.length,

    step(dt: number, vis: number, night: number, wet: number) {
      edge = vis / 2 + 90
      wait -= dt
      if (wait <= 0) {
        if (live.length < 3) {
          spawn(vis, night, wet)
          wait = 9 + rand() * 3
        } else wait = 2
      }
      for (let i = live.length - 1; i >= 0; i--) {
        const a = live[i]
        if (a.pauseAt !== null && (a.dir > 0 ? a.x >= a.pauseAt : a.x <= a.pauseAt)) {
          a.pauseAt = null
          a.pauseLeft = 2.5 + rand() * 2
        }
        if (a.pauseLeft > 0 && a.hurry === 0) {
          a.pauseLeft -= dt
        } else {
          a.pauseLeft = 0
          const pace = 1 + a.hurry * 1.8
          a.x += a.dir * a.kind.speed * a.s * pace * dt
          a.phase += dt * a.kind.beat * (1 + a.hurry)
        }
        a.hurry = Math.max(0, a.hurry - dt / 2.6)
        if (a.jump > 0 || a.jv > 0) {
          a.jump += a.jv * dt
          a.jv -= 420 * dt
          if (a.jump <= 0) a.jump = a.jv = 0
        }
        const trail = a.kind.family ? a.kind.family.gap * (a.kind.family.count + 1) * a.s : 0
        if (a.dir > 0 ? a.x - trail > edge : a.x + trail < -edge) live.splice(i, 1)
      }
    },

    draw(c: CanvasRenderingContext2D, light: Shade) {
      for (const a of live) {
        const members: [Kind, number, number, number][] = [[a.kind, a.x, a.s, 0]]
        const fam = a.kind.family
        if (fam) {
          for (let i = 1; i <= fam.count; i++) {
            const s = (fam.kind.size / a.kind.size) * a.s
            members.push([fam.kind, a.x - a.dir * fam.gap * i * a.s, s, i * 0.31])
          }
        }
        for (const [k, x, s] of members) {
          const rx = k.shadow * s
          c.fillStyle = `rgba(36, 58, 40, ${(0.3 * light.strength).toFixed(3)})`
          c.beginPath()
          c.ellipse(x + light.lean * rx * 0.55, a.y + 0.5, rx * light.stretch, rx * 0.2, 0, 0, Math.PI * 2)
          c.fill()
        }
        const still = a.pauseLeft > 0 && a.hurry === 0
        for (const [k, x, s, offset] of members) {
          figure(c, k, x, a.y, a.dir, s, a.phase * (k.beat / a.kind.beat) + offset, still, a.jump)
        }
      }
    },

    /** A touch near an animal sends it on its way a little faster, with a hop. */
    startle(p: Point) {
      for (const a of live) {
        const reach = 34 * a.s + (a.kind.family ? a.kind.family.gap * a.kind.family.count * a.s : 0)
        const back = a.kind.family ? -a.dir * reach : 0
        const x0 = Math.min(a.x - 34 * a.s, a.x + Math.min(0, back))
        const x1 = Math.max(a.x + 34 * a.s, a.x + Math.max(0, back))
        if (p.x < x0 || p.x > x1 || p.y < a.y - 80 * a.s || p.y > a.y + 12) continue
        a.hurry = 1
        a.pauseLeft = 0
        a.pauseAt = null
        if (a.jump === 0) a.jv = a.kind.gait === 'hop' ? 150 : 90
        return true
      }
      return false
    },
  }
}
