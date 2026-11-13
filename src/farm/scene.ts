// The farm is painted in "world units": 900 tall, centred on x = 0, and wide
// enough (±HALF) to cover an ultra-wide window. Everything here is seeded, so
// the same farm is drawn on every visit.

export const HALF = 1150
export const H = 900

export type Dot = { x: number; y: number; r: number }
export type Foliage = { dark: Dot[]; mid: Dot[]; light: Dot[]; shade: Dot[] }
type Wave = readonly [amp: number, freq: number, phase: number]
type Ridge = (x: number) => number

export function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const n1 = (v: number) => Math.round(v * 10) / 10

const ridge =
  (base: number, waves: readonly Wave[]): Ridge =>
  (x) =>
    waves.reduce((y, [amp, freq, phase]) => y + amp * Math.sin(x * freq + phase), base)

export const ridges = {
  peaksBack: ridge(428, [
    [36, 0.0034, 0.6],
    [15, 0.0091, 2.2],
    [6, 0.023, 4.1],
  ]),
  peaksFront: ridge(462, [
    [24, 0.0042, 3.3],
    [10, 0.011, 0.4],
    [4, 0.027, 1.2],
  ]),
  far: ridge(498, [
    [20, 0.0027, 1.4],
    [8, 0.0071, 0.2],
  ]),
  mid: ridge(545, [
    [26, 0.0022, 3.6],
    [9, 0.0063, 1.0],
  ]),
  near: ridge(632, [
    [22, 0.0019, 0.5],
    [7, 0.0051, 2.5],
  ]),
  front: ridge(802, [
    [8, 0.004, 1.0],
    [4, 0.011, 0.3],
  ]),
} satisfies Record<string, Ridge>

/** A filled silhouette from a ridge line down to the bottom of the world. */
export function landPath(fn: Ridge): string {
  let d = `M${-HALF} ${n1(fn(-HALF))}`
  for (let x = -HALF + 20; x <= HALF; x += 20) d += `L${x} ${n1(fn(x))}`
  return `${d}L${HALF} ${H}L${-HALF} ${H}Z`
}

/** Little three-bladed brush marks, grouped by tone so each tone is one path. */
export function tuftPaths(
  seed: number,
  fn: Ridge,
  yMax: number,
  count: number,
  sFar: number,
  sNear: number,
): string[] {
  const rand = makeRng(seed)
  const d = ['', '', '']
  for (let i = 0; i < count; i++) {
    const x = -HALF + rand() * HALF * 2
    const top = fn(x) + 3
    const k = rand()
    const tone = Math.floor(rand() * 3)
    if (top >= yMax) continue
    const y = top + (yMax - top) * k
    const s = sFar + (sNear - sFar) * k
    d[tone] +=
      `M${n1(x - s * 0.7)} ${n1(y)}` +
      `l${n1(s * 0.25)} ${n1(-s * 1.2)}l${n1(s * 0.2)} ${n1(s * 1.2)}` +
      `l${n1(s * 0.3)} ${n1(-s * 1.7)}l${n1(s * 0.25)} ${n1(s * 1.7)}` +
      `l${n1(s * 0.25)} ${n1(-s)}l${n1(s * 0.2)} ${n1(s)}z`
  }
  return d
}

export type Bloom = Dot & { tone: number }

/** Drifts of wildflowers on the near meadow. */
export function meadowFlowers(seed: number, fn: Ridge, yMax: number, clusters: number): Bloom[] {
  const rand = makeRng(seed)
  const out: Bloom[] = []
  for (let c = 0; c < clusters; c++) {
    const cx = -HALF + rand() * HALF * 2
    const top = fn(cx) + 10
    const k = rand()
    const cy = top + (yMax - top) * k
    const tone = Math.floor(rand() * 4)
    const size = 1.3 + k * 1.7
    const n = 5 + Math.floor(rand() * 8)
    for (let i = 0; i < n; i++) {
      out.push({
        x: n1(cx + (rand() - 0.5) * (50 + k * 60)),
        y: n1(cy + (rand() - 0.5) * (8 + k * 14)),
        r: n1(size * (0.7 + rand() * 0.6)),
        tone,
      })
    }
  }
  return out
}

/** A clump of leaves: a dark mass, a mid mass nudged toward the light, highlights. */
export function foliage(rand: () => number, cx: number, cy: number, R: number, n = 12): Foliage {
  const out: Foliage = { dark: [], mid: [], light: [], shade: [] }
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2
    const dist = R * 0.72 * Math.sqrt(rand())
    const r = R * (0.26 + 0.22 * rand())
    const x = cx + Math.cos(a) * dist * 1.08
    const y = cy + Math.sin(a) * dist * 0.86
    out.dark.push({ x: n1(x), y: n1(y), r: n1(r) })
    out.mid.push({ x: n1(x - r * 0.16), y: n1(y - r * 0.24), r: n1(r * 0.86) })
    if ((x - cx) * 0.5 + (y - cy) < R * 0.12) {
      out.light.push({ x: n1(x - r * 0.3), y: n1(y - r * 0.42), r: n1(r * 0.36) })
    }
  }
  // sun-flecks toward the light, deeper pockets away from it
  for (let i = 0; i < n * 1.6; i++) {
    const a = rand() * Math.PI * 2
    const dist = R * 0.85 * Math.sqrt(rand())
    const x = cx + Math.cos(a) * dist
    const y = cy + Math.sin(a) * dist * 0.82
    const r = R * (0.05 + rand() * 0.07)
    const sunny = (x - cx) * 0.5 + (y - cy) < R * (rand() * 0.5 - 0.1)
    ;(sunny ? out.light : out.shade).push({ x: n1(x), y: n1(y), r: n1(r) })
  }
  // leafy edge: small dabs around the rim so the outline is not a clean circle
  for (let i = 0; i < 12; i++) {
    const a = rand() * Math.PI * 2
    const x = cx + Math.cos(a) * R * 0.98
    const y = cy + Math.sin(a) * R * 0.8
    const r = R * (0.08 + rand() * 0.07)
    const lit = Math.cos(a) * 0.5 + Math.sin(a) < -0.1
    ;(lit ? out.mid : out.dark).push({ x: n1(x), y: n1(y), r: n1(r) })
  }
  return out
}

/** A towering summer cloud as overlapping puffs, sorted top-first. */
export function cumulus(seed: number, w: number, h: number): Dot[] {
  const rand = makeRng(seed)
  const bumps = [
    { c: (rand() - 0.5) * 0.2 * w, h, s: 0.2 * w },
    { c: (-0.27 + (rand() - 0.5) * 0.1) * w, h: h * (0.5 + rand() * 0.2), s: 0.17 * w },
    { c: (0.28 + (rand() - 0.5) * 0.1) * w, h: h * (0.4 + rand() * 0.25), s: 0.18 * w },
    { c: 0, h: h * 0.3, s: 0.42 * w },
  ]
  const top = (x: number) =>
    Math.max(...bumps.map((b) => b.h * Math.exp(-(((x - b.c) / b.s) ** 2))))
  const puffs: Dot[] = []
  const span = w * 0.84
  // outline puffs follow the silhouette, the rest fill the body
  for (let i = 0; i <= 16; i++) {
    const x = (i / 16 - 0.5) * span
    const r = w * (0.05 + rand() * 0.035)
    puffs.push({ x, y: -Math.max(0, top(x) - r), r })
  }
  for (let i = 0; i < 40; i++) {
    const x = (rand() - 0.5) * span
    const k = rand() ** 0.8
    const r = w * (0.055 + rand() * 0.05) * (1.15 - 0.35 * k)
    puffs.push({ x, y: -Math.max(0, top(x) - r) * k, r })
  }
  return puffs
    .sort((a, b) => a.y - b.y)
    .map((p) => ({ x: n1(p.x), y: n1(p.y), r: n1(p.r) }))
}

/** A strip of crop rows that follows the curve of its hill. */
export function field(fn: Ridge, x0: number, x1: number, drop: number, depth: number, rows: number) {
  const skew = depth * 0.5
  const line = (j: number) => {
    const t = j / rows
    const pts: string[] = []
    for (let x = x0; x <= x1 + 0.1; x += (x1 - x0) / 14) {
      pts.push(`${n1(x - skew * t)} ${n1(fn(x) + drop + depth * t)}`)
    }
    return pts
  }
  const topEdge = line(0)
  const bottomEdge = line(rows).reverse()
  const furrows = Array.from({ length: rows - 1 }, (_, j) => `M${line(j + 1).join('L')}`).join('')
  return { outline: `M${topEdge.join('L')}L${bottomEdge.join('L')}Z`, furrows }
}

/** A winding dirt path, wider as it comes toward us. */
export function pathRibbon(
  p: readonly [number, number][],
  w0: number,
  w1: number,
): string {
  const [a, b, c, d] = p
  const left: string[] = []
  const right: string[] = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const m = 1 - t
    const x = m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c[0] + t * t * t * d[0]
    const y = m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c[1] + t * t * t * d[1]
    const w = (w0 + (w1 - w0) * t * t) / 2
    left.push(`${n1(x - w)} ${n1(y)}`)
    right.push(`${n1(x + w)} ${n1(y)}`)
  }
  return `M${left.join('L')}L${right.reverse().join('L')}Z`
}
