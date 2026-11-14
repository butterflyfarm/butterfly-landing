// Everything that moves on its own clock: the hour and the weather, wind in
// the grass, rain, fireflies, dandelion seeds, and the butterflies.
// One requestAnimationFrame loop drives all of it.

import { lightAt, lightBetween } from './light'
import { makeCritters, type Shade } from './critters'
import { makeRng, skyline } from './scene'

export type View = {
  vw: number
  vh: number
  /** CSS pixels per world unit */
  u: number
  /** visible width in world units */
  vis: number
  /** visible height in world units (900 or more) */
  tall: number
  /** how far the farm is raised on tall screens, leaving deeper grass below */
  lift: number
}

export type Point = { x: number; y: number }
export type Flier = { el: HTMLElement; wings: readonly [SVGElement, SVGElement] }

/** Named places on the farm, in world units. */
export type Spots = {
  /** a leaf of the seedling, where a butterfly can sit */
  leaf: Point
  /** the seedling's bud */
  bud: Point
  /** the weathervane on the cottage roof */
  vane: Point
  /** anywhere else the butterfly may settle */
  perches: Point[]
}

export type LifeOptions = {
  /** the farm element: receives the light as CSS variables */
  root: HTMLElement
  sky: HTMLElement
  grass: HTMLCanvasElement
  fx: HTMLCanvasElement
  /** the animals who wander across the farm */
  critters: HTMLCanvasElement
  /** the sun and moon: each drawn behind the clouds, and again in front while held */
  suns: readonly HTMLElement[]
  moons: readonly HTMLElement[]
  /** what you take hold of: the sun (or its glow on the ridge once it has set), and the moon */
  handles: { sun: HTMLElement; moon: HTMLElement }
  /** the warm glow on the ridge where the sun went down */
  ember: HTMLElement
  rainbow: HTMLElement
  /** the first flier is the farm's own butterfly; the rest arrive when the seedling is nearly in bloom */
  fliers: readonly Flier[]
  getView: () => View
  getSpots: () => Spots
  /** the hour to open at, 0 to 24 */
  hour: number
  /** true when the visitor prefers reduced motion */
  still: boolean
  onGrow: (stage: number) => void
  onWeather: (raining: boolean) => void
  onHour: (hour: number) => void
}

export type Life = {
  stop: () => void
  /** send the butterfly to settle on a particular spot */
  visit: (p: Point) => void
  toggleRain: () => void
}

type Row = { y: number; hMin: number; hMax: number; gap: number; colors: readonly string[] }
type Blade = { x: number; y: number; h: number; w: number; lean: number; phase: number }
type Flower = Point & { h: number; r: number; color: string; phase: number; after: number; puff: boolean }
type Mote = Point & { r: number; vx: number; vy: number; phase: number }
/** `k` is its size (smaller further off); `held` is the way it points while still on its clock */
type Seed = Point & { vx: number; vy: number; age: number; life: number; phase: number; k: number; held: number | null }
type Streak = Point & { age: number; life: number; vx: number; vy: number; len: number }
/** a touch in the grass, pushing the blades aside */
type Part = Point & { at: number; s: number }
type Hopper = Point & { vx: number; vy: number; ground: number; hops: number; age: number; dir: 1 | -1 }
type Spark = Point & { vx: number; vy: number; age: number; life: number; phase: number }
type Bird = Point & {
  vx: number
  vy: number
  age: number
  phase: number
  size: number
  /** how fast its path bends, in radians a second */
  turn: number
  /** wingbeats, in radians a second */
  flap: number
}

const ROWS: readonly Row[] = [
  { y: 824, hMin: 30, hMax: 58, gap: 6.5, colors: ['#658a61', '#6f9568', '#7aa36c', '#99b677'] },
  { y: 860, hMin: 46, hMax: 84, gap: 6.5, colors: ['#567b59', '#5f8460', '#698e65', '#89ac70'] },
  { y: 906, hMin: 66, hMax: 118, gap: 7, colors: ['#45654a', '#4d6f51', '#547758', '#658862'] },
]
// tall screens get more rows of deeper, nearer grass beneath the farm
const DEEP = ['#3c5a43', '#43634a', '#4a6b4f', '#5a7b58'] as const
const PETALS = ['#eee6c5', '#e2d598', '#dfacb5', '#c1b1d5', '#eee6c5']

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n))
const wrap = (h: number) => ((h % 24) + 24) % 24

function wind(x: number, t: number) {
  const gust = Math.max(0, Math.sin(x * 0.0016 - t * 0.33)) ** 6
  return (
    0.1 +
    0.15 * Math.sin(x * 0.0045 - t * 0.8) +
    0.08 * Math.sin(x * 0.013 - t * 1.5 + 2) +
    0.42 * gust
  )
}

/** A small green grasshopper in mid-leap, nose tipped along its flight, in world units. */
function hopper(c: CanvasRenderingContext2D, h: { x: number; y: number; vx: number; vy: number; dir: number }, alpha: number) {
  if (alpha <= 0.01) return
  const tilt = clamp(Math.atan2(h.vy, Math.abs(h.vx)) * 0.5, -0.5, 0.5)
  c.save()
  c.globalAlpha = alpha
  c.translate(h.x, h.y)
  c.scale(h.dir * 1.15, 1.15)
  c.rotate(tilt)
  c.lineCap = 'round'
  // the long hind leg, stretched out behind from the leap
  c.strokeStyle = '#5c7a3c'
  c.lineWidth = 1.7
  c.beginPath()
  c.moveTo(-1, 0.5)
  c.lineTo(-9, -3.5)
  c.lineTo(-14, 2.5)
  c.stroke()
  // the little front legs and the feelers
  c.lineWidth = 0.9
  c.beginPath()
  c.moveTo(3.5, 1.5)
  c.lineTo(5.5, 4.5)
  c.moveTo(1, 1.8)
  c.lineTo(-0.5, 4.8)
  c.stroke()
  c.lineWidth = 0.6
  c.beginPath()
  c.moveTo(8.6, -2.6)
  c.quadraticCurveTo(12, -8, 16.5, -8.5)
  c.stroke()
  // body, folded wings, head and eye
  c.fillStyle = '#86a752'
  c.beginPath()
  c.ellipse(0, 0, 7.6, 2.7, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#9fbb68'
  c.beginPath()
  c.ellipse(-1.5, -1.5, 6.2, 1.3, -0.06, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#86a752'
  c.beginPath()
  c.arc(7.2, -0.8, 2.7, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#33361f'
  c.beginPath()
  c.arc(8.3, -1.5, 0.85, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

function plant(vis: number, lift: number) {
  const rand = makeRng(7)
  const half = vis / 2 + 40
  const meta: Row[] = [...ROWS]
  for (let y = 964; y < 900 + lift + 46; y += 58) {
    meta.push({ y, hMin: 84, hMax: 140, gap: 8, colors: DEEP })
  }
  const rows = meta.map((row) => {
    const buckets: Blade[][] = row.colors.map(() => [])
    for (let x = -half; x < half; x += row.gap * (0.6 + rand() * 0.8)) {
      const pick = rand()
      // the last colour is a sunlit highlight, used sparingly
      const c = pick > 0.93 ? 3 : Math.floor(pick * 3.2) % 3
      buckets[c].push({
        x,
        y: row.y + (rand() - 0.5) * 14,
        h: row.hMin + rand() * (row.hMax - row.hMin),
        w: 2.4 + rand() * 2.6,
        lean: (rand() - 0.5) * 0.36,
        phase: rand() * Math.PI * 2,
      })
    }
    return buckets
  })

  const flowers: Flower[] = []
  for (let i = 0, n = Math.round((vis / 52) * (1 + lift / 120)); i < n; i++) {
    // each flower stands just in front of one row, and behind the next
    const after = Math.min(meta.length - 2, Math.floor(rand() * (meta.length - 1)))
    const row = meta[after]
    flowers.push({
      x: (rand() - 0.5) * half * 2,
      y: row.y + 2 + rand() * 10,
      h: row.hMin * 1.1 + rand() * (row.hMax - row.hMin) * 0.7,
      r: 2.6 + after * 0.7 + rand() * 1.2,
      color: PETALS[Math.floor(rand() * PETALS.length)],
      phase: rand() * Math.PI * 2,
      after,
      // some have gone to seed: dandelion clocks, waiting for a breath
      puff: rand() < 0.3,
    })
  }

  const motes: Mote[] = []
  for (let i = 0, n = Math.round(vis / 80); i < n; i++) {
    motes.push({
      x: (rand() - 0.5) * half * 2,
      y: 420 + rand() * 420,
      r: 1.1 + rand() * 1.5,
      vx: 5 + rand() * 9,
      vy: -(2 + rand() * 5),
      phase: rand() * Math.PI * 2,
    })
  }

  const flies = Array.from({ length: Math.round(vis / 70) }, () => ({
    x: (rand() - 0.5) * vis,
    y: 610 + rand() * 210,
    a: 0.3 + rand() * 0.5,
    b: 0.4 + rand() * 0.6,
    c: 0.7 + rand() * 0.9,
    phase: rand() * Math.PI * 2,
  }))

  return { meta, rows, flowers, motes, flies, half }
}

export function startLife(o: LifeOptions): Life {
  const g = o.grass.getContext('2d')
  const f = o.fx.getContext('2d')
  const k = o.critters.getContext('2d')
  if (!g || !f || !k) return { stop: () => {}, visit: () => {}, toggleRain: () => {} }
  const rand = makeRng(Date.now() & 0xffff)
  const animals = makeCritters(rand)

  const first = o.getView()
  let garden = plant(first.vis, first.lift)
  let plantedFor = `${first.vis}/${first.lift}`
  let now = 0

  const toWorld = (cx: number, cy: number): Point => {
    const v = o.getView()
    return { x: (cx - v.vw / 2) / v.u, y: (cy - (v.vh - (900 + v.lift) * v.u)) / v.u }
  }

  // --- the sun, the moon and the hour -----------------------------------
  // Left alone, the sun and moon keep to their paths for the hour: across the
  // sky by day (or night), and just below the hills while they are down.
  //
  // Picked up, a body goes exactly where the hand takes it, and stays there
  // when let go: nothing glides or springs back. The time is read from where
  // it sits. Height is how full the day is, the side is morning or evening, and
  // below the hills it is twilight deepening into night. A set sun leaves a glow
  // on the ridge where it went down: take hold of that glow to pull it back up.
  type Body = 'sun' | 'moon'
  /** how far below the hills a body can go, as a share of the sky's height: about six hours of night */
  const SINK = 0.4
  /**
   * The sun keeps the day and the moon the night. Pushed down behind the hills,
   * either one stops once it is just out of sight, and never reads later than
   * this share of SINK (about an hour and a half into dusk, or into the
   * morning); the rest of the night is the moon's to move, and of the day the sun's.
   */
  const SET = 0.25
  /** how far below the ridge a body sits once it is just out of sight, in world units */
  const hidden = (b: Body) => (b === 'sun' ? 46 : 34)
  let nudging = 0
  let hour = wrap(o.hour)
  let saidHour = -1
  /** a body the visitor has put somewhere. `p` is where it is drawn; it follows `goal`, the hand. */
  let placed: { body: Body; p: Point; goal: Point } | null = null
  /** the time as read from the placed body: a morning and an evening reading, and the blend between */
  let reading = { a: hour, b: hour, w: 0 }
  /** the other body, easing over from wherever it was when the visitor switched to it */
  let ease: { body: Body; from: Point; k: number } | null = null
  let dragging: Body | null = null
  let press: { x: number; y: number; dx: number; dy: number; moved: boolean } | null = null

  const span = (v: View) => {
    const top = 900 + v.lift - v.tall // world y of the top of the screen
    return { xL: -v.vis * 0.43, xR: v.vis * 0.43, h: clamp(486 - top - 70, 160, 520), top }
  }
  /** The ridge line a body sets behind, smoothed so the path doesn't follow every bump. */
  const horizon = (x: number) => (skyline(x - 60) + skyline(x) + skyline(x + 60)) / 3 + 8
  const lerp = (a: Point, b: Point, k: number): Point => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })

  /** Where a body keeps to at a given hour when nobody is holding it. */
  const pathPos = (b: Body, h: number): Point => {
    const s = span(o.getView())
    let t = b === 'sun' ? (wrap(h) - 6) / 12 : ((wrap(h) + 6) % 24) / 12
    if (t >= 1.5) t -= 2
    if (t >= 0 && t <= 1) {
      const x = s.xL + (s.xR - s.xL) * t
      return { x, y: horizon(x) - Math.sin(Math.PI * t) * s.h }
    }
    // down: just under the hills where it set (or will rise), sinking as the night goes on
    const x = t > 1 ? s.xR : s.xL
    const d = t > 1 ? (t - 1) / 0.5 : -t / 0.5
    return { x, y: horizon(x) + d * SINK * s.h }
  }
  const posOf = (b: Body): Point => {
    if (placed?.body === b) return placed.p
    // the other body sits where the time read from the placed one puts it
    const p = placed ? lerp(pathPos(b, reading.a), pathPos(b, reading.b), reading.w) : pathPos(b, hour)
    if (ease?.body !== b) return p
    const k = ease.k * ease.k * (3 - 2 * ease.k)
    return lerp(p, ease.from, k)
  }
  /** 1 at the top of the sky, 0 on the ridge, below 0 behind the hills */
  const elevation = (b: Body) => {
    const p = posOf(b)
    return (horizon(p.x) - p.y) / span(o.getView()).h
  }
  const sunHeight = () => clamp(elevation('sun'))
  /** Where the sun can be taken hold of: itself, or its glow on the ridge once it has set. */
  const sunGrip = (): Point => {
    const p = posOf('sun')
    return { x: p.x, y: Math.min(p.y, horizon(p.x) - 18) }
  }
  /** What the butterfly points out: whichever of them is up, or the glow where the sun went down. */
  const bodyAt = (): Point =>
    elevation('sun') > -0.02 ? posOf('sun') : elevation('moon') > 0.04 ? posOf('moon') : sunGrip()

  /** The time a body at `p` stands for, read as morning and as evening, with the blend between. */
  const readingsAt = (b: Body, p: Point) => {
    const s = span(o.getView())
    const e = (horizon(p.x) - p.y) / s.h
    const start = b === 'sun' ? 6 : 18
    let a: number
    let z: number
    if (e >= 0) {
      const up = (Math.asin(clamp(e)) / Math.PI) * 12 // 0 on the ridge, 6 at the top
      a = start + up
      z = start + 12 - up
    } else {
      const d = Math.min(clamp(-e / SINK), SET)
      a = start - 6 * d
      z = start + 12 + 6 * d
    }
    // left of the middle is morning, right is evening; the light is mixed across the middle
    const k = clamp(0.5 + p.x / ((s.xR - s.xL) * 0.16))
    let w = k * k * (3 - 2 * k)
    // but going down is always forward in time, wherever it happens: the sun's setting
    // brings the evening and the moon's the morning, so the other one comes up on the
    // morning side, low on the left and clear of the big tree
    if (e < 0) w += (1 - w) * clamp((-e * s.h) / hidden(b))
    return { a: wrap(a), b: wrap(z), w }
  }

  const sayHour = () => {
    const h = (Math.round(hour * 2) / 2) % 24
    if (h !== saidHour) {
      saidHour = h
      o.onHour(h)
    }
  }
  function stepHour(dt: number) {
    if (ease) {
      ease.k -= o.still ? 1 : dt / 1.2
      if (ease.k <= 0) ease = null
    }
    if (!placed) return
    // the body catches up with the hand quickly but smoothly, so the light never jumps
    const f = o.still ? 1 : Math.min(1, dt * 14)
    placed.p = lerp(placed.p, placed.goal, f)
    reading = readingsAt(placed.body, placed.p)
    hour = reading.w < 0.5 ? reading.a : reading.b
    sayHour()
  }

  /** How deep a body goes behind the hills at `x` before it is out of reach. */
  const floorAt = (b: Body, x: number) => horizon(x) + Math.min(hidden(b), SINK * span(o.getView()).h)

  /**
   * Move a body toward a spot, kept on screen and no deeper than the hills allow.
   * Returns true when this sets it: behind the hills it stays put until taken up again.
   */
  function put(b: Body, x: number, y: number): boolean {
    const v = o.getView()
    const s = span(v)
    const cx = clamp(x, -v.vis / 2 + 36, v.vis / 2 - 36)
    const floor = floorAt(b, cx)
    const sets = y >= floor
    // already down: pushing it further, or along under the hills, does nothing
    const was = placed?.body === b ? placed.goal : posOf(b)
    if (sets && was.y >= floorAt(b, was.x) - 0.5) return true
    const goal = { x: cx, y: clamp(y, s.top + 44, floor) }
    // as it goes down, the other one, up in the sky, calls softly
    const other: Body = b === 'sun' ? 'moon' : 'sun'
    if (sets && elevation(other) > 0.04) {
      o.root.dataset.nudge = other
      window.clearTimeout(nudging)
      nudging = window.setTimeout(() => o.root.removeAttribute('data-nudge'), 1800)
    }
    if (placed?.body !== b) {
      // the other body was in hand before: it eases over to where this one's time puts it
      if (placed) ease = { body: placed.body, from: posOf(placed.body), k: 1 }
      placed = { body: b, p: posOf(b), goal }
    } else placed.goal = goal
    return sets
  }

  const handleOf = (b: Body) => (b === 'sun' ? o.handles.sun : o.handles.moon)
  const grabbed = (b: Body) => (e: PointerEvent) => {
    dragging = b
    const at = posOf(b)
    const hand = toWorld(e.clientX, e.clientY)
    // keep hold of it where it was grabbed, so it never leaps to the finger; but a sun
    // that is down comes straight up to the hand that reaches for its glow
    press = { x: e.clientX, y: e.clientY, dx: at.x - hand.x, dy: Math.min(at.y - hand.y, 24), moved: false }
    o.root.dataset.holding = b
    handleOf(b).setPointerCapture(e.pointerId)
  }
  const onHandleMove = (e: PointerEvent) => {
    if (!press || !dragging) return
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 5) press.moved = true
    if (!press.moved) return
    const hand = toWorld(e.clientX, e.clientY)
    // once it has gone down behind the hills it slips out of the hand
    if (put(dragging, hand.x + press.dx, hand.y + press.dy)) {
      const h = handleOf(dragging)
      if (h.hasPointerCapture(e.pointerId)) h.releasePointerCapture(e.pointerId)
      onHandleUp()
    }
  }
  const onHandleUp = () => {
    if (!press) return
    // let go: it stays exactly where it was left, and so does the time
    press = null
    dragging = null
    o.root.removeAttribute('data-holding')
  }
  const keyed = (b: Body) => (e: KeyboardEvent) => {
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -28, y: 0 },
      ArrowRight: { x: 28, y: 0 },
      ArrowUp: { x: 0, y: -28 },
      ArrowDown: { x: 0, y: 28 },
    }
    const m = moves[e.key]
    if (!m) return
    e.preventDefault()
    const at = placed?.body === b ? placed.goal : posOf(b)
    put(b, at.x + m.x, at.y + m.y)
  }
  const onSunDown = grabbed('sun')
  const onMoonDown = grabbed('moon')
  const onSunKey = keyed('sun')
  const onMoonKey = keyed('moon')

  // --- the weather, and what it does for the seedling --------------------
  let raining = false
  let wet = 0
  let rainbowUntil = -1
  let rainbowShown = false
  const care = { stage: 0, rainFor: 0, counted: false, damp: false, sunFor: 0 }
  let drops: { x: number; y: number; l: number; s: number }[] = []

  function grow() {
    if (care.stage >= 3) return
    care.stage++
    o.onGrow(care.stage)
    if (care.stage === 3) {
      gather()
      // nearly in bloom: let the shower pass so the light comes back for it
      if (raining) care.rainFor = Math.max(care.rainFor, 9.4)
    }
  }
  function setRain(on: boolean) {
    if (raining === on) return
    raining = on
    o.onWeather(on)
    if (!on && sunHeight() > 0.15 && wet > 0.5) {
      // sun after rain: a rainbow, on the far side of the sky from the sun
      const v = o.getView()
      const x = posOf('sun').x > 0 ? -v.vis * 0.2 : v.vis * 0.2
      o.rainbow.style.transform = `translate3d(${(x * v.u).toFixed(1)}px, 0, 0)`
      rainbowUntil = now + 13
    }
  }
  function stepWeather(dt: number) {
    const goal = raining ? 1 : 0
    wet += (goal - wet) * (o.still ? 1 : Math.min(1, dt * 0.9))
    if (Math.abs(goal - wet) < 0.004) wet = goal

    if (raining) {
      care.rainFor += dt
      if (care.rainFor > 3 && !care.counted) {
        care.counted = true
        care.damp = true
        grow()
      }
      // a shower, not a storm: it passes on its own
      if (care.rainFor > 11) setRain(false)
    } else {
      care.rainFor = 0
      care.counted = false
      // sunshine on damp ground is the other thing a seedling needs
      if (care.damp && wet < 0.25 && sunHeight() > 0.2) {
        care.sunFor += dt
        if (care.sunFor > 2.5) {
          care.damp = false
          care.sunFor = 0
          grow()
        }
      } else care.sunFor = 0
    }

    const show = !raining && now < rainbowUntil && sunHeight() > 0.1
    if (show !== rainbowShown) {
      rainbowShown = show
      o.rainbow.style.opacity = show ? '1' : '0'
    }
  }

  // --- the light ---------------------------------------------------------
  let lightKey = ''
  let night = 0
  const shade: Shade = { lean: 0.6, stretch: 1.2, strength: 1 }

  function shine() {
    const v = o.getView()
    const sp = posOf('sun')
    const mp = posOf('moon')
    const key = `${hour.toFixed(3)}|${wet.toFixed(3)}|${v.u}|${v.vis}|${v.lift}|${sp.x.toFixed(1)},${sp.y.toFixed(1)}|${mp.x.toFixed(1)},${mp.y.toFixed(1)}|${dragging}`
    if (key === lightKey) return
    lightKey = key

    const light = placed ? lightBetween(reading.a, reading.b, reading.w, wet) : lightAt(hour, wet)
    night = light.night
    o.sky.style.background = light.sky
    const s = o.root.style
    s.setProperty('--tint', light.tint)
    s.setProperty('--cloud-tint', light.cloudTint)
    s.setProperty('--sign-tint', light.signTint)
    s.setProperty('--stars', (night * (1 - wet)).toFixed(3))
    s.setProperty('--lamps', Math.min(1, night * 1.8).toFixed(3))
    s.setProperty('--day', (1 - night).toFixed(3))
    s.setProperty('--night', night.toFixed(3))
    o.root.toggleAttribute('data-flat', light.flat)
    o.root.toggleAttribute('data-night', night > 0.6)

    const at = (el: HTMLElement, p: Point) => {
      el.style.transform = `translate3d(${(p.x * v.u).toFixed(1)}px, ${(p.y * v.u).toFixed(1)}px, 0)`
    }
    // the hills hide whichever of them is down, so both are always drawn where they are
    for (const el of o.suns) {
      at(el, sp)
      el.style.opacity = (1 - wet * 0.85).toFixed(3)
    }
    for (const el of o.moons) {
      at(el, mp)
      el.style.opacity = (1 - wet * 0.85).toFixed(3)
    }

    // a set sun glows on the ridge where it went down: bright just after, faint by midnight
    const se = elevation('sun')
    const depth = clamp(-se / SINK)
    const ember = clamp(-se * 12) * (0.14 + 0.8 * (1 - depth) ** 1.6) * (1 - 0.6 * wet)
    at(o.ember, { x: sp.x, y: horizon(sp.x) })
    o.ember.style.opacity = Math.min(1, ember + (dragging === 'sun' ? 0.25 * clamp(-se * 12) : 0)).toFixed(3)

    // you can always reach the sun; the moon only while it is up
    at(o.handles.sun, sunGrip())
    const moonUp = elevation('moon') > -0.04
    at(o.handles.moon, mp)
    o.handles.moon.style.visibility = moonUp || dragging === 'moon' ? 'visible' : 'hidden'

    // shadows lean away from the light and lengthen as it sinks; clouds are lit on its side
    const lit = night < 0.5 ? sp : mp
    const dir = clamp(lit.x / (v.vis * 0.45), -1, 1)
    const e = clamp((horizon(lit.x) - lit.y) / span(v).h)
    shade.lean = -dir
    shade.stretch = 1 + (1 - e) * 0.9
    shade.strength = Math.max(0.12, (night < 0.5 ? clamp(e * 4) : 0.35 * clamp(e * 4)) * (1 - 0.7 * wet))
    s.setProperty('--sun-dir', dir.toFixed(3))
    s.setProperty('--lean', shade.lean.toFixed(3))
    s.setProperty('--stretch', shade.stretch.toFixed(3))
    s.setProperty('--shadow-a', shade.strength.toFixed(3))
    // a low sun is amber, a high sun pale
    const high = Math.min(1, sunHeight() * 1.7)
    s.setProperty(
      '--sun',
      `rgb(${Math.round(244 + 4 * high)}, ${Math.round(170 + 64 * high)}, ${Math.round(116 + 80 * high)})`,
    )

    // the moon's crescent turns its lit side to the sun, wherever the sun is
    s.setProperty('--moon-turn', `${((Math.atan2(sp.y - mp.y, sp.x - mp.x) * 180) / Math.PI).toFixed(1)}deg`)
    // a moon that is up rims the clouds with silver on its side
    s.setProperty('--moonlit', (night * clamp(elevation('moon') * 4) * (1 - wet)).toFixed(3))
  }

  // --- small wonders: seeds, shooting stars, birds -----------------------
  const seeds: Seed[] = []
  const streaks: Streak[] = []
  const birds: Bird[] = []
  const parts: Part[] = []
  const hoppers: Hopper[] = []
  const sparks: Spark[] = []

  /** A touch in the grass: the blades around it lean away, then spring back. */
  function part(p: Point, s: number) {
    if (o.still) return
    const last = parts[parts.length - 1]
    // a hand moving through the grass leaves a trail of these, not one every frame
    if (last && now - last.at < 0.07 && Math.hypot(last.x - p.x, last.y - p.y) < 24 && s <= last.s) return
    parts.push({ x: p.x, y: p.y, at: now, s })
    if (parts.length > 8) parts.shift()
  }
  /** How far recent touches push a blade whose middle is at (x, y), as extra bend. */
  function parted(x: number, y: number) {
    let bend = 0
    for (const q of parts) {
      const dx = x - q.x
      const near = Math.exp(-((dx / 80) ** 2) - ((y - q.y) / 84) ** 2)
      if (near < 0.02) continue
      // the push reaches blades further out a moment later, so it runs outward like a ripple
      const a = now - q.at - Math.abs(dx) / 300
      if (a <= 0) continue
      const away = dx / (Math.abs(dx) + 10)
      bend += away * q.s * near * 1.25 * (1 - Math.exp(-a * 22)) * Math.exp(-a * 2.2) * Math.cos(a * 7.5)
    }
    return bend
  }
  /** Something that lives in the grass comes out: a grasshopper by day, fireflies at night. */
  function stir(p: Point) {
    if (o.still) return
    const ground = clamp(p.y + 18, 812, 880)
    if (night > 0.5) {
      for (let i = 0; i < 7; i++) {
        sparks.push({
          x: p.x + (rand() - 0.5) * 50,
          y: Math.min(p.y, ground) - rand() * 20,
          vx: (rand() - 0.5) * 34,
          vy: -(48 + rand() * 30),
          age: -i * 0.14,
          life: 4 + rand() * 2.5,
          phase: rand() * Math.PI * 2,
        })
      }
      if (sparks.length > 30) sparks.splice(0, sparks.length - 30)
    } else if (!hoppers.length) {
      const dir = rand() < 0.5 ? 1 : -1
      hoppers.push({ x: p.x, y: ground, ground, vx: dir * (70 + rand() * 50), vy: -(240 + rand() * 50), hops: 2, age: 0, dir })
    }
  }

  /** A shooting star that crosses near the tap, falling either way at its own slant and pace. */
  const shoot = (p: Point) => {
    const dir = rand() < 0.5 ? 1 : -1
    const slant = 0.12 + rand() * 0.75 // from nearly level to steep, always falling
    const speed = 340 + rand() * 260
    const life = 0.7 + rand() * 0.6
    const vx = dir * Math.cos(slant) * speed
    const vy = Math.sin(slant) * speed
    // it passes the tapped point about a third of the way through its flight
    const lead = life * (0.25 + rand() * 0.15)
    streaks.push({ x: p.x - vx * lead, y: p.y - vy * lead, age: 0, life, vx, vy, len: 80 + rand() * 70 })
  }

  const seed =(x: number, y: number) =>
    seeds.push({
      x,
      y,
      vx: (rand() - 0.3) * 50,
      vy: -(24 + rand() * 46),
      age: 0,
      life: 7 + rand() * 4,
      phase: rand() * Math.PI * 2,
      k: 1,
      held: null,
    })
  /**
   * A dandelion clock where the meadow was touched: a ball of seeds that lets go
   * a few at a time, downwind side first, and drifts off over the farm.
   */
  function clock(p: Point) {
    if (o.still) return
    const k = 0.55 + 0.4 * clamp((p.y - 640) / 150)
    const n = 18 + Math.floor(rand() * 5)
    const ways = Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.2)
    ways.sort((a, b) => Math.cos(b) - Math.cos(a))
    ways.forEach((a, i) => {
      // each lets go at its own pace, so they scatter rather than keep their ring
      const push = 8 + rand() * 38
      const off = a + (rand() - 0.5) * 1.4
      seeds.push({
        x: p.x + Math.cos(a) * 5.5 * k,
        y: p.y + Math.sin(a) * 5.5 * k,
        vx: Math.cos(off) * push + 4 + rand() * 18,
        vy: Math.sin(off) * push - 12 - rand() * 22,
        age: -(0.35 + i * 0.045 + rand() * 0.12),
        life: 7 + rand() * 4,
        phase: rand() * Math.PI * 2,
        k,
        held: a,
      })
    })
    if (seeds.length > 260) seeds.splice(0, seeds.length - 260)
  }
  function burst(p: Point) {
    // every dandelion clock near the touch lets go
    for (const fl of garden.flowers) {
      if (!fl.puff || Math.hypot(fl.x - p.x, fl.y - fl.h - p.y) > 90) continue
      fl.puff = false
      for (let i = 0; i < 7; i++) seed(fl.x + (rand() - 0.5) * 8, fl.y - fl.h + (rand() - 0.5) * 8)
    }
    for (let i = 0; i < 9; i++) seed(p.x + (rand() - 0.5) * 30, Math.min(p.y, 860) - 30 - rand() * 40)
    if (seeds.length > 260) seeds.splice(0, seeds.length - 260)
  }
  /**
   * A few birds lifting off where the sky was touched. Each flock picks its own
   * way (left or right, climbing steeply or nearly level), and within it every
   * bird keeps its own pace, wingbeat and slowly bending line. Now and then one
   * goes its own way.
   */
  function flock(p: Point) {
    const dir = rand() < 0.5 ? -1 : 1
    const climb = 0.08 + rand() * 0.5 // radians above level
    const bend = (rand() - 0.5) * 0.24 // the whole flock curves a little, one way or the other
    for (let i = 0, n = 3 + Math.floor(rand() * 4); i < n; i++) {
      const stray = i > 0 && rand() < 0.2
      const way = stray ? -dir : dir
      const a = stray ? 0.2 + rand() * 0.6 : climb + (rand() - 0.5) * 0.5
      const speed = 52 + rand() * 46
      birds.push({
        // loosely strung out behind the leader, above and below
        x: p.x - way * i * (16 + rand() * 16) + (rand() - 0.5) * 18,
        y: p.y + (rand() - 0.4) * (14 + i * 10),
        vx: way * Math.cos(a) * speed,
        vy: -Math.sin(a) * speed,
        age: -rand() * 0.35 * i, // they don't all leave at once
        phase: rand() * Math.PI * 2,
        size: 6.5 + rand() * 4.5,
        turn: bend * way + (rand() - 0.5) * 0.3,
        flap: 6.5 + rand() * 3.5,
      })
    }
  }

  // --- the butterflies ---------------------------------------------------
  const me = o.fliers[0]
  const b = {
    x: -first.vis / 2 - 70,
    y: 540,
    vx: 70,
    vy: 0,
    tx: -first.vis * 0.12,
    ty: 600,
    mode: 'wander' as 'wander' | 'land' | 'rest' | 'orbit',
    until: 6, // seconds until it next looks for somewhere to go
    spot: (): Point => o.getSpots().leaf,
    orbit: false,
    angle: 0.5,
    flap: 0,
  }
  // with no words on the page, the butterfly shows what can be touched:
  // the seedling, then the sun or moon, then the weathervane
  const tour: ('leaf' | 'body' | 'vane')[] = ['leaf', 'body', 'vane']
  const pointer = { x: 0, y: 0, at: -100 }

  const friends = o.fliers.slice(1).map((fl, i) => ({
    fl,
    here: false,
    x: 0,
    y: 0,
    a: i * 2.1,
    r: 58 + i * 26,
    speed: 0.7 + i * 0.17,
    flap: i * 1.3,
    angle: 0,
  }))
  function gather() {
    const v = o.getView()
    friends.forEach((fr, i) => {
      fr.here = true
      fr.x = (i % 2 ? 1 : -1) * (v.vis / 2 + 60)
      fr.y = 320 + i * 110
      fr.fl.el.style.opacity = '1'
    })
  }

  function pose(fl: Flier, x: number, y: number, angle: number, wing: number) {
    const v = o.getView()
    const scale = 0.82 + 0.34 * clamp((y - 420) / 380)
    fl.el.style.transform = `translate3d(${(x * v.u).toFixed(1)}px, ${(y * v.u).toFixed(1)}px, 0) rotate(${angle.toFixed(3)}rad) scale(${scale.toFixed(3)})`
    fl.wings[0].style.transform = fl.wings[1].style.transform = `scaleX(${wing.toFixed(3)})`
  }

  const roam = () => {
    const v = o.getView()
    // on a tall screen there is a lot more sky to explore
    const skyTop = Math.min(300, 900 + v.lift - v.tall + 150)
    b.tx = (rand() - 0.5) * v.vis * 0.82
    b.ty = rand() < 0.3 ? skyTop + rand() * (440 - skyTop) : 470 + rand() * 290
  }
  const choose = () => {
    const next = tour.shift()
    b.orbit = next === 'body'
    if (next === 'body') b.spot = bodyAt
    else if (next) b.spot = () => o.getSpots()[next]
    else {
      const i = Math.floor(rand() * o.getSpots().perches.length)
      b.spot = () => o.getSpots().perches[i] ?? o.getSpots().leaf
    }
    b.mode = 'land'
  }
  const leave = (t: number) => {
    b.mode = 'wander'
    b.until = t + (tour.length ? 4 : 16 + rand() * 12)
    roam()
  }

  function moveButterflies(dt: number, t: number) {
    let wing: number
    let ox = 0
    let oy = 0

    if (o.still) {
      const p = b.spot()
      b.x = p.x
      b.y = p.y
      b.angle = -0.3
      wing = 0.85
    } else if (b.mode === 'rest') {
      const p = b.spot()
      b.x = p.x
      b.y = p.y
      // slow, sun-warming wingbeats
      wing = 0.3 + 0.62 * (0.5 + 0.5 * Math.sin(t * 1.4))
      b.angle += (-0.3 - b.angle) * Math.min(1, dt * 3)
      if (t > b.until) {
        b.vx = (rand() - 0.5) * 40
        b.vy = -50
        leave(t)
      }
    } else {
      const curious = b.mode === 'wander' && t - pointer.at < 2.5
      if (curious) {
        b.tx = pointer.x + Math.cos(t * 0.9) * 46
        b.ty = pointer.y - 26 + Math.sin(t * 1.3) * 22
      }
      if (b.mode === 'wander' && t > b.until && !curious) choose()
      if (b.mode === 'land') {
        const p = b.spot()
        b.tx = p.x
        b.ty = p.y
      }
      if (b.mode === 'orbit') {
        // circle the sun or moon for a while, as if to say: this one moves
        const p = b.spot()
        b.tx = p.x + Math.cos(t * 1.5) * 46
        b.ty = p.y + Math.sin(t * 2.1) * 28
        if (t > b.until) leave(t)
      }
      const dx = b.tx - b.x
      const dy = b.ty - b.y
      const d = Math.hypot(dx, dy) || 1
      if (b.mode === 'wander' && d < 36 && !curious) roam()

      const landing = b.mode === 'land' && !b.orbit
      const speed = landing ? Math.min(96, 14 + d * 1.3) : 78 * (0.8 + 0.3 * Math.sin(t * 0.7))
      const ease = Math.min(1, dt * (landing ? 3 : 1.7))
      b.vx += ((dx / d) * speed - b.vx) * ease
      b.vy += ((dy / d) * speed - b.vy) * ease
      b.x += b.vx * dt
      b.y += b.vy * dt

      if (b.mode === 'land' && b.orbit && d < 56) {
        b.mode = 'orbit'
        b.until = t + 7
      } else if (landing && d < 2.5) {
        b.mode = 'rest'
        b.until = t + 6 + rand() * 4
      }

      // the wobble that makes it a butterfly rather than a bird
      const amp = landing ? Math.min(1, d / 90) : 1
      ox = Math.sin(t * 2.3 + 1) * 7 * amp
      oy = (Math.sin(t * 6.4) * 4 + Math.sin(t * 1.7) * 6) * amp

      // lean into the direction of travel, but always stay roughly upright
      b.angle += (Math.atan2(b.vx, 115 - b.vy) - b.angle) * Math.min(1, dt * 4)
      b.flap += dt * Math.PI * 2 * (3.1 + 0.9 * Math.sin(t * 0.9))
      wing = 0.57 + 0.43 * Math.cos(b.flap)
    }
    pose(me, b.x + ox, b.y + oy, b.angle, wing)

    // friends who come when the seedling is nearly in bloom
    const bud = o.getSpots().bud
    for (const fr of friends) {
      if (!fr.here) continue
      fr.a += dt * fr.speed
      const tx = bud.x + Math.cos(fr.a) * fr.r
      const ty = bud.y - 24 + Math.sin(fr.a * 1.4) * fr.r * 0.45
      if (o.still) {
        pose(fr.fl, tx, ty, 0.2, 0.85)
        continue
      }
      const px = fr.x
      const py = fr.y
      fr.x += (tx - fr.x) * Math.min(1, dt * 0.9)
      fr.y += (ty - fr.y) * Math.min(1, dt * 0.9)
      const vx = dt ? (fr.x - px) / dt : 0
      const vy = dt ? (fr.y - py) / dt : 0
      fr.angle += (Math.atan2(vx, 115 - vy) - fr.angle) * Math.min(1, dt * 4)
      fr.flap += dt * Math.PI * 2 * 3.3
      pose(fr.fl, fr.x, fr.y + Math.sin(t * 6 + fr.a) * 3, fr.angle, 0.57 + 0.43 * Math.cos(fr.flap))
    }
  }

  // --- touching the farm -------------------------------------------------
  const onMove = (e: PointerEvent) => {
    const p = toWorld(e.clientX, e.clientY)
    // a hand brushed through the grass parts it and shakes a few seeds loose; a mouse
    // passing over just ruffles it
    const pressing = Boolean(e.buttons) || e.pointerType === 'touch'
    if (p.y > 792) part(p, pressing ? 0.7 : 0.35)
    if (pressing && p.y > 792 && rand() < 0.35) seed(p.x, p.y - 30)
    if (e.pointerType === 'mouse') Object.assign(pointer, p, { at: now })
  }
  const onDown = (e: PointerEvent) => {
    // the seedling, sun, clouds and weathervane answer for themselves
    if (e.target instanceof Element && e.target.closest('[data-farm-control]')) return
    const p = toWorld(e.clientX, e.clientY)
    if (animals.startle(p)) {
      // nothing else: it was the animal they meant
    } else if (p.y < skyline(p.x) - 4) {
      if (night > 0.5) shoot(p)
      else flock(p)
    } else if (p.y > 792) {
      part(p, 1)
      burst(p)
      stir(p)
    } else {
      clock(p)
    }
    // and wherever it was, the butterfly comes to look
    Object.assign(pointer, p, { at: now + 1.5 })
    if (b.mode !== 'wander') leave(now)
  }

  // --- painting ----------------------------------------------------------
  function fit(canvas: HTMLCanvasElement, c: CanvasRenderingContext2D) {
    const v = o.getView()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pw = Math.round(v.vw * dpr)
    const ph = Math.round(v.vh * dpr)
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, pw, ph)
    c.setTransform(dpr * v.u, 0, 0, dpr * v.u, (dpr * v.vw) / 2, dpr * (v.vh - (900 + v.lift) * v.u))
  }

  function paintGrass(t: number, dt: number) {
    const v = o.getView()
    const key = `${v.vis}/${v.lift}`
    if (key !== plantedFor) {
      garden = plant(v.vis, v.lift)
      plantedFor = key
      drops = []
    }
    const c = g!
    fit(o.grass, c)
    // rain flattens the grass a little and hurries the wind
    const gusty = 1 + wet * 0.5
    while (parts.length && now - parts[0].at > 3) parts.shift()
    const touched = parts.length > 0

    garden.rows.forEach((buckets, r) => {
      buckets.forEach((blades, ci) => {
        c.fillStyle = garden.meta[r].colors[ci]
        c.beginPath()
        for (const bl of blades) {
          const bend =
            bl.lean +
            wind(bl.x, t) * gusty +
            0.035 * Math.sin(t * 3.1 + bl.phase) +
            (touched ? parted(bl.x, bl.y - bl.h * 0.5) : 0)
          const tipX = bl.x + bend * bl.h * 0.55
          const tipY = bl.y - bl.h * (1 - 0.22 * bend * bend)
          const midX = bl.x + bend * bl.h * 0.14
          const midY = bl.y - bl.h * 0.58
          c.moveTo(bl.x - bl.w / 2, bl.y)
          c.quadraticCurveTo(midX - bl.w * 0.35, midY, tipX, tipY)
          c.quadraticCurveTo(midX + bl.w * 0.35, midY, bl.x + bl.w / 2, bl.y)
        }
        c.fill()
      })

      for (const fl of garden.flowers) {
        if (fl.after !== r) continue
        const bend =
          wind(fl.x, t) * gusty + 0.04 * Math.sin(t * 2.2 + fl.phase) + (touched ? parted(fl.x, fl.y - fl.h * 0.5) * 0.8 : 0)
        const hx = fl.x + bend * fl.h * 0.5
        const hy = fl.y - fl.h * (1 - 0.2 * bend * bend)
        c.strokeStyle = '#527b55'
        c.lineWidth = 1.3
        c.beginPath()
        c.moveTo(fl.x, fl.y)
        c.quadraticCurveTo(fl.x + bend * fl.h * 0.12, fl.y - fl.h * 0.6, hx, hy)
        c.stroke()
        if (fl.puff) {
          // a dandelion clock: a soft ball of seeds
          c.fillStyle = 'rgba(244, 240, 222, 0.5)'
          c.beginPath()
          c.arc(hx, hy, fl.r * 1.9, 0, 7)
          c.fill()
          c.fillStyle = 'rgba(250, 247, 232, 0.9)'
          c.beginPath()
          for (let p = 0; p < 9; p++) {
            const a = (p / 9) * Math.PI * 2 + fl.phase
            const px = hx + Math.cos(a) * fl.r * 1.35
            const py = hy + Math.sin(a) * fl.r * 1.35
            c.moveTo(px + 0.9, py)
            c.arc(px, py, 0.9, 0, 7)
          }
          c.fill()
          c.fillStyle = '#a89a6c'
          c.beginPath()
          c.arc(hx, hy, fl.r * 0.4, 0, 7)
          c.fill()
          continue
        }
        c.fillStyle = fl.color
        c.beginPath()
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2 + fl.phase
          const px = hx + Math.cos(a) * fl.r * 0.8
          const py = hy + Math.sin(a) * fl.r * 0.8
          c.moveTo(px + fl.r * 0.72, py)
          c.arc(px, py, fl.r * 0.72, 0, 7)
        }
        c.fill()
        c.fillStyle = '#d2a955'
        c.beginPath()
        c.arc(hx, hy, fl.r * 0.5, 0, 7)
        c.fill()
      }
    })

    if (o.still) return
    for (const m of garden.motes) {
      m.x += (m.vx + wind(m.x, t) * 26) * dt
      m.y += (m.vy + Math.sin(t * 0.8 + m.phase) * 5) * dt
      if (m.x > garden.half) m.x = -garden.half
      if (m.y < 380) m.y = 840
      const glow = (0.14 + 0.34 * Math.sin(t * 0.9 + m.phase) ** 2) * (1 - wet)
      c.fillStyle = `rgba(250, 240, 208, ${glow.toFixed(3)})`
      c.beginPath()
      c.arc(m.x, m.y, m.r, 0, 7)
      c.fill()
    }
  }

  let fxUsed = false
  function paintFx(t: number, dt: number) {
    const glowing = night * (1 - wet)
    const busy =
      wet > 0.01 || glowing > 0.03 || seeds.length + streaks.length + birds.length + hoppers.length + sparks.length > 0
    if (!busy && !fxUsed) return
    const v = o.getView()
    const c = f!
    fit(o.fx, c)
    fxUsed = busy
    if (!busy) return
    const top = 900 + v.lift - v.tall

    if (wet > 0.01) {
      if (!drops.length) {
        const n = Math.min(260, Math.round((v.vis * v.tall) / 5200))
        drops = Array.from({ length: n }, () => ({
          x: (rand() - 0.5) * (v.vis + 200),
          y: top + rand() * v.tall,
          l: 16 + rand() * 20,
          s: 560 + rand() * 300,
        }))
      }
      c.strokeStyle = `rgba(212, 223, 234, ${(0.36 * wet).toFixed(3)})`
      c.lineWidth = 1.3
      c.beginPath()
      for (const d of drops) {
        if (!o.still) {
          d.y += d.s * dt
          d.x += d.s * 0.2 * dt
          if (d.y > 900 + v.lift) {
            d.y = top - d.l
            d.x = (rand() - 0.5) * (v.vis + 200) - 60
          }
        }
        c.moveTo(d.x, d.y)
        c.lineTo(d.x - d.l * 0.2, d.y - d.l)
      }
      c.stroke()
    }

    if (glowing > 0.03 && !o.still) {
      for (const fy of garden.flies) {
        const x = fy.x + Math.sin(t * fy.a + fy.phase) * 46 + Math.sin(t * fy.c) * 12
        const y = fy.y + Math.cos(t * fy.b + fy.phase) * 20
        const pulse = Math.max(0, Math.sin(t * fy.c + fy.phase)) ** 3
        const alpha = glowing * (0.12 + 0.88 * pulse)
        c.fillStyle = `rgba(232, 238, 150, ${(alpha * 0.22).toFixed(3)})`
        c.beginPath()
        c.arc(x, y, 6.5, 0, 7)
        c.fill()
        c.fillStyle = `rgba(244, 246, 190, ${alpha.toFixed(3)})`
        c.beginPath()
        c.arc(x, y, 1.9, 0, 7)
        c.fill()
      }
    }

    // fireflies stirred up out of the grass, rising slowly and drifting off
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      s.age += dt
      if (s.age < 0) continue
      if (s.age > s.life) {
        sparks.splice(i, 1)
        continue
      }
      s.vx += Math.sin(t * 0.9 + s.phase) * 10 * dt
      s.vy *= 1 - 0.22 * dt
      s.x += (s.vx + Math.sin(t * 1.3 + s.phase) * 8) * dt
      s.y += s.vy * dt
      // bright as they lift off, then glowing on and off like the others
      const pulse = Math.max(clamp(1.6 - s.age), 0.45 + 0.55 * Math.max(0, Math.sin(t * 2.2 + s.phase)) ** 2)
      const alpha = Math.min(1, s.age * 2, (s.life - s.age) / 1.2) * pulse * (1 - 0.7 * wet)
      c.fillStyle = `rgba(232, 238, 150, ${(alpha * 0.26).toFixed(3)})`
      c.beginPath()
      c.arc(s.x, s.y, 8, 0, 7)
      c.fill()
      c.fillStyle = `rgba(246, 248, 196, ${alpha.toFixed(3)})`
      c.beginPath()
      c.arc(s.x, s.y, 2.2, 0, 7)
      c.fill()
    }

    // a grasshopper, springing out of the grass in a hop or two and dropping back in
    for (let i = hoppers.length - 1; i >= 0; i--) {
      const h = hoppers[i]
      h.age += dt
      h.vy += 620 * dt
      h.x += h.vx * dt
      h.y += h.vy * dt
      if (h.y >= h.ground && h.vy > 0) {
        if (--h.hops <= 0) {
          hoppers.splice(i, 1)
          continue
        }
        h.y = h.ground
        h.vy = -(190 + rand() * 50)
        h.vx *= 0.8
      }
      // it fades in as it leaves the grass and out as it drops back into it
      const fading = h.age < 0.25 || (h.hops === 1 && h.vy > 0)
      hopper(c, h, fading ? clamp((h.ground - h.y) / 12) : 1)
    }

    // dandelion seeds: a little parachute over a hanging seed
    const pale = 0.55 + 0.45 * (1 - night)
    for (let i = seeds.length - 1; i >= 0; i--) {
      const sd = seeds[i]
      sd.age += dt
      if (sd.age > sd.life) {
        seeds.splice(i, 1)
        continue
      }
      let tilt = Math.sin(t * 1.7 + sd.phase) * 0.3 + sd.vx * 0.006
      let alpha: number
      if (sd.held !== null && sd.age < 0) {
        // still on the clock, its parachute pointing outward
        tilt = Math.atan2(Math.cos(sd.held), -Math.sin(sd.held))
        alpha = 1
      } else {
        // each seed rides its own little current, so a cloud of them spreads as it goes
        const own = sd.held === null ? 0 : 1
        sd.vx += (14 + wind(sd.x, t) * 70 + own * Math.sin(sd.phase * 3) * 16 - sd.vx) * Math.min(1, dt * 0.8)
        sd.vy += (-12 + Math.sin(t * 1.3 + sd.phase) * 9 + own * Math.cos(sd.phase * 5) * 9 + wet * 60 - sd.vy) * Math.min(1, dt * 0.9)
        sd.x += sd.vx * dt
        sd.y += sd.vy * dt
        if (sd.held !== null) {
          // a loosed seed turns its parachute up to the sky
          const from = Math.atan2(Math.cos(sd.held), -Math.sin(sd.held))
          tilt = from + (tilt - from) * clamp(sd.age / 0.6)
          alpha = Math.min(1, (sd.life - sd.age) / 2)
        } else alpha = Math.min(1, sd.age * 4, (sd.life - sd.age) / 2)
      }
      alpha *= pale
      const r = 5.2 * sd.k
      c.strokeStyle = `rgba(250, 247, 232, ${(alpha * 0.9).toFixed(3)})`
      c.lineWidth = 0.7 * Math.sqrt(sd.k)
      c.beginPath()
      for (let k = -2; k <= 2; k++) {
        const a = -Math.PI / 2 + tilt + k * 0.42
        c.moveTo(sd.x, sd.y)
        c.lineTo(sd.x + Math.cos(a) * r, sd.y + Math.sin(a) * r)
      }
      c.moveTo(sd.x, sd.y)
      c.lineTo(sd.x - Math.sin(tilt) * r * 1.06, sd.y + Math.cos(tilt) * r * 1.06)
      c.stroke()
    }

    // shooting stars
    for (let i = streaks.length - 1; i >= 0; i--) {
      const st = streaks[i]
      st.age += dt
      if (st.age > st.life) {
        streaks.splice(i, 1)
        continue
      }
      const hx = st.x + st.age * st.vx
      const hy = st.y + st.age * st.vy
      const v = Math.hypot(st.vx, st.vy)
      const tx = hx - (st.vx / v) * st.len
      const ty = hy - (st.vy / v) * st.len
      const alpha = Math.sin((Math.PI * st.age) / st.life)
      const tail = c.createLinearGradient(hx, hy, tx, ty)
      tail.addColorStop(0, `rgba(255, 250, 230, ${alpha.toFixed(3)})`)
      tail.addColorStop(1, 'rgba(255, 250, 230, 0)')
      c.strokeStyle = tail
      c.lineWidth = 2
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(hx, hy)
      c.lineTo(tx, ty)
      c.stroke()
      c.lineCap = 'butt'
    }

    // birds
    c.lineWidth = 1.6
    c.lineCap = 'round'
    for (let i = birds.length - 1; i >= 0; i--) {
      const bd = birds[i]
      bd.age += dt
      if (bd.age > 9) {
        birds.splice(i, 1)
        continue
      }
      if (bd.age < 0) continue // still waiting to take off
      // the line bends slowly; a bird never turns back on itself or dives
      const r = bd.turn * dt
      const vx = bd.vx * Math.cos(r) - bd.vy * Math.sin(r)
      const vy = bd.vx * Math.sin(r) + bd.vy * Math.cos(r)
      if (Math.sign(vx) === Math.sign(bd.vx) && vy < Math.abs(vx) * 0.3) {
        bd.vx = vx
        bd.vy = vy
      } else bd.turn = -bd.turn
      bd.x += bd.vx * dt
      bd.y += bd.vy * dt
      const size = bd.size * (1 - bd.age * 0.06)
      const lift = Math.sin(t * bd.flap + bd.phase) * size * 0.55
      const alpha = Math.min(1, bd.age * 3, (9 - bd.age) / 3) * 0.7
      c.strokeStyle = `rgba(62, 70, 80, ${alpha.toFixed(3)})`
      c.beginPath()
      c.moveTo(bd.x - size, bd.y - lift)
      c.quadraticCurveTo(bd.x - size * 0.4, bd.y - size * 0.5 - lift * 0.4, bd.x, bd.y)
      c.quadraticCurveTo(bd.x + size * 0.4, bd.y - size * 0.5 - lift * 0.4, bd.x + size, bd.y - lift)
      c.stroke()
    }
    c.lineCap = 'butt'
  }

  let crittersUsed = false
  function paintCritters(dt: number) {
    if (!o.still) animals.step(dt, o.getView().vis, night, wet)
    const busy = animals.count() > 0
    if (!busy && !crittersUsed) return
    fit(o.critters, k!)
    crittersUsed = busy
    animals.draw(k!, shade)
  }

  // --- the loop ----------------------------------------------------------
  let raf = 0
  let last = 0
  const frame = (ms: number) => {
    const dt = last ? Math.min(0.05, (ms - last) / 1000) : 0
    last = ms
    now += dt
    const t = o.still ? 0 : now
    stepHour(dt)
    stepWeather(dt)
    shine()
    paintCritters(dt)
    paintGrass(t, dt)
    paintFx(t, dt)
    moveButterflies(dt, now)
    raf = requestAnimationFrame(frame)
  }
  sayHour()
  raf = requestAnimationFrame(frame)

  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  const { sun: sunHandle, moon: moonHandle } = o.handles
  sunHandle.addEventListener('pointerdown', onSunDown)
  moonHandle.addEventListener('pointerdown', onMoonDown)
  sunHandle.addEventListener('keydown', onSunKey)
  moonHandle.addEventListener('keydown', onMoonKey)
  for (const h of [sunHandle, moonHandle]) {
    h.addEventListener('pointermove', onHandleMove)
    h.addEventListener('pointerup', onHandleUp)
    h.addEventListener('pointercancel', onHandleUp)
  }

  return {
    stop: () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(nudging)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      sunHandle.removeEventListener('pointerdown', onSunDown)
      moonHandle.removeEventListener('pointerdown', onMoonDown)
      sunHandle.removeEventListener('keydown', onSunKey)
      moonHandle.removeEventListener('keydown', onMoonKey)
      for (const h of [sunHandle, moonHandle]) {
        h.removeEventListener('pointermove', onHandleMove)
        h.removeEventListener('pointerup', onHandleUp)
        h.removeEventListener('pointercancel', onHandleUp)
      }
    },
    visit: (p) => {
      tour.splice(0, tour.indexOf('leaf') + 1) // no need to point at the seedling now
      b.spot = () => p
      b.orbit = false
      b.mode = 'land'
      pointer.at = -100
    },
    toggleRain: () => setRain(!raining),
  }
}
