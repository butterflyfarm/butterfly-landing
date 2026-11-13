// Everything that moves on its own clock: the hour and the weather, wind in
// the grass, rain, fireflies, dandelion seeds, and the butterflies.
// One requestAnimationFrame loop drives all of it.

import { lightAt } from './light'
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
  /** the draggable hit area that follows the sun or moon */
  handle: HTMLElement
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
type Seed = Point & { vx: number; vy: number; age: number; life: number; phase: number }
type Streak = Point & { age: number }
type Bird = Point & { vx: number; vy: number; age: number; phase: number; size: number }

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

  // --- the hour --------------------------------------------------------
  // The hour drives the light. Left alone, the sun and moon ride their arc as
  // it passes; dragged, a body goes exactly where it is put, and the hour is
  // read back from where it sits: height for how full the day is, side for
  // morning or evening. Below the hills it sets, and the other one rises.
  type Body = 'sun' | 'moon'
  let hour = wrap(o.hour)
  let hourLeft = 0 // hours still to glide through after a tap or key press
  let saidHour = -1
  let dragging: Body | null = null
  let press: { x: number; y: number; moved: boolean; dx: number; dy: number } | null = null
  // where a visitor left the sun or moon; null while it rides its usual arc
  let placed: { body: Body; p: Point } | null = null
  // once let go, a body eases from where it was back onto its arc
  let ease: { body: Body; from: Point; k: number } | null = null
  /** how far below the horizon a body can be pushed, as a share of the arc's height */
  const SINK = 0.32

  // the sun and moon each cross the sky on the same arc, twelve hours apart
  const arc = (v: View) => {
    const top = 900 + v.lift - v.tall // world y of the top of the screen
    return { xL: -v.vis * 0.43, xR: v.vis * 0.43, base: 486, h: clamp(486 - top - 70, 160, 520), top }
  }
  const along = (v: View, t: number): Point => {
    const a = arc(v)
    return { x: a.xL + (a.xR - a.xL) * t, y: a.base - Math.sin(Math.PI * t) * a.h }
  }
  const sunT = () => (hour - 6) / 12
  const moonT = () => {
    const m = ((hour + 6) % 24) / 12
    return m > 1.5 ? m - 2 : m
  }
  const posOf = (body: Body): Point => {
    if (placed?.body === body) return placed.p
    const p = along(o.getView(), body === 'sun' ? sunT() : moonT())
    if (ease?.body !== body) return p
    const k = ease.k * ease.k * (3 - 2 * ease.k)
    return { x: p.x + (ease.from.x - p.x) * k, y: p.y + (ease.from.y - p.y) * k }
  }
  /** how high a body stands: 1 at the top of its arc, 0 on the horizon, below 0 behind the hills */
  const elevation = (body: Body) => {
    const a = arc(o.getView())
    return (a.base - posOf(body).y) / a.h
  }
  const sunHeight = () => clamp(elevation('sun'))
  const body = (): Body => dragging ?? placed?.body ?? (hour >= 6 && hour < 18 ? 'sun' : 'moon')
  const bodyAt = () => posOf(body())

  /** The hour a body standing at `p` would mean. */
  const hourFor = (b: Body, p: Point) => {
    const a = arc(o.getView())
    const e = (a.base - p.y) / a.h
    const start = b === 'sun' ? 6 : 18
    const side = (left: boolean) => {
      if (e >= 0) {
        const up = (Math.asin(clamp(e)) / Math.PI) * 12 // 0 on the horizon, 6 at the top
        return left ? start + up : start + 12 - up
      }
      const down = clamp(-e / SINK)
      return left ? start - down * 1.5 : start + 12 + down * 3
    }
    // morning on the left, evening on the right, blended across the middle
    const mid = (a.xL + a.xR) / 2
    const k = clamp(0.5 + (p.x - mid) / ((a.xR - a.xL) * 0.16))
    const blend = k * k * (3 - 2 * k)
    return wrap(side(true) + (side(false) - side(true)) * blend)
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
      ease.k -= o.still ? 1 : dt / 1.6
      if (ease.k <= 0) ease = null
    }
    if (hourLeft === 0) return
    const step = o.still || Math.abs(hourLeft) < 0.004 ? hourLeft : hourLeft * Math.min(1, dt * 2.2)
    hour = wrap(hour + step)
    hourLeft -= step
    sayHour()
  }

  /** Put a body at a spot in the sky, kept on screen and no deeper than the hills allow. */
  function put(b: Body, x: number, y: number) {
    const v = o.getView()
    const a = arc(v)
    placed = {
      body: b,
      p: {
        x: clamp(x, -v.vis / 2 + 36, v.vis / 2 - 36),
        y: clamp(y, a.top + 44, a.base + a.h * SINK),
      },
    }
    hour = hourFor(b, placed.p)
    hourLeft = 0
    sayHour()
  }
  /** Let go of a placed body. Behind the hills, it sets and the night (or day) comes on. */
  function release() {
    if (!placed) return
    const { body: b, p } = placed
    if (elevation(b) < 0.02) {
      const left = p.x < 0
      const target = b === 'sun' ? (left ? 3 : 21) : left ? 15 : 9
      hourLeft = target - hour
      ease = { body: b, from: p, k: 1 }
      placed = null
    }
  }
  /** A tap on the sun or moon: let a quarter of the day slip by. */
  function tap() {
    if (placed) ease = { body: placed.body, from: placed.p, k: 1 }
    placed = null
    hourLeft = 6
  }

  const onHandleDown = (e: PointerEvent) => {
    dragging = body()
    const at = posOf(dragging)
    const hand = toWorld(e.clientX, e.clientY)
    // keep hold of the sun where it was grabbed, so it never jumps to the finger
    press = { x: e.clientX, y: e.clientY, moved: false, dx: at.x - hand.x, dy: at.y - hand.y }
    hourLeft = 0
    ease = null
    o.root.toggleAttribute('data-holding', true)
    o.handle.setPointerCapture(e.pointerId)
  }
  const onHandleMove = (e: PointerEvent) => {
    if (!press || !dragging) return
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) press.moved = true
    if (!press.moved) return
    const a = arc(o.getView())
    const hand = toWorld(e.clientX, e.clientY)
    let y = hand.y + press.dy
    // the hills push back: below the horizon it sinks only half as far as the hand goes
    if (y > a.base) y = a.base + (y - a.base) * 0.5
    put(dragging, hand.x + press.dx, y)
  }
  const onHandleUp = () => {
    if (!press) return
    if (press.moved) release()
    else tap()
    press = null
    dragging = null
    o.root.removeAttribute('data-holding')
    lightKey = ''
  }
  const onHandleKey = (e: KeyboardEvent) => {
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -28, y: 0 },
      ArrowRight: { x: 28, y: 0 },
      ArrowUp: { x: 0, y: -28 },
      ArrowDown: { x: 0, y: 28 },
    }
    const m = moves[e.key]
    if (m) {
      e.preventDefault()
      const b = body()
      const at = posOf(b)
      ease = null
      put(b, at.x + m.x, at.y + m.y)
      release()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      tap()
    }
  }

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
    const key = `${hour.toFixed(3)}|${wet.toFixed(3)}|${v.u}|${v.vis}|${v.lift}|${sp.x.toFixed(1)},${sp.y.toFixed(1)}|${mp.x.toFixed(1)},${mp.y.toFixed(1)}`
    if (key === lightKey) return
    lightKey = key

    const light = lightAt(hour, wet)
    night = light.night
    o.sky.style.background = light.sky
    const s = o.root.style
    s.setProperty('--tint', light.tint)
    s.setProperty('--cloud-tint', light.cloudTint)
    s.setProperty('--sign-tint', light.signTint)
    s.setProperty('--stars', (night * (1 - wet)).toFixed(3))
    s.setProperty('--lamps', Math.min(1, night * 1.8).toFixed(3))
    s.setProperty('--day', (1 - night).toFixed(3))
    o.root.toggleAttribute('data-flat', light.flat)

    const place = (els: readonly HTMLElement[], b: Body, p: Point) => {
      const t = b === 'sun' ? sunT() : moonT()
      const shown = placed?.body === b || ease?.body === b || (t > -0.12 && t < 1.12)
      for (const el of els) {
        el.style.transform = `translate3d(${(p.x * v.u).toFixed(1)}px, ${(p.y * v.u).toFixed(1)}px, 0)`
        el.style.opacity = shown ? (1 - wet * 0.85).toFixed(3) : '0'
      }
    }
    place(o.suns, 'sun', sp)
    place(o.moons, 'moon', mp)

    // shadows lean away from the light and lengthen as it sinks; clouds are lit on its side
    const a = arc(v)
    const lit = night < 0.5 ? sp : mp
    const dir = clamp(lit.x / (v.vis * 0.45), -1, 1)
    const e = clamp((a.base - lit.y) / a.h)
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
    const h = bodyAt()
    o.handle.style.transform = `translate3d(${(h.x * v.u).toFixed(1)}px, ${(h.y * v.u).toFixed(1)}px, 0)`
  }

  // --- small wonders: seeds, shooting stars, birds -----------------------
  const seeds: Seed[] = []
  const streaks: Streak[] = []
  const birds: Bird[] = []

  const seed = (x: number, y: number) =>
    seeds.push({
      x,
      y,
      vx: (rand() - 0.3) * 50,
      vy: -(24 + rand() * 46),
      age: 0,
      life: 7 + rand() * 4,
      phase: rand() * Math.PI * 2,
    })
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
  function flock(p: Point) {
    for (let i = 0, n = 3 + Math.floor(rand() * 3); i < n; i++) {
      birds.push({
        x: p.x - i * 26 + (rand() - 0.5) * 20,
        y: p.y + i * 12 + (rand() - 0.5) * 16,
        vx: 62 + rand() * 30,
        vy: -(16 + rand() * 18),
        age: 0,
        phase: rand() * Math.PI * 2,
        size: 7 + rand() * 4,
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
    // a hand brushed through the grass shakes a few seeds loose
    if ((e.buttons || e.pointerType === 'touch') && p.y > 792 && rand() < 0.35) seed(p.x, p.y - 30)
    if (e.pointerType === 'mouse') Object.assign(pointer, p, { at: now })
  }
  const onDown = (e: PointerEvent) => {
    // the seedling, sun, clouds and weathervane answer for themselves
    if (e.target instanceof Element && e.target.closest('[data-farm-control]')) return
    const p = toWorld(e.clientX, e.clientY)
    if (animals.startle(p)) {
      // nothing else: it was the animal they meant
    } else if (p.y < skyline(p.x) - 4) {
      if (night > 0.5) streaks.push({ x: p.x - 130, y: p.y - 66, age: 0 })
      else flock(p)
    } else if (p.y > 792) burst(p)
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

    garden.rows.forEach((buckets, r) => {
      buckets.forEach((blades, ci) => {
        c.fillStyle = garden.meta[r].colors[ci]
        c.beginPath()
        for (const bl of blades) {
          const bend = bl.lean + wind(bl.x, t) * gusty + 0.035 * Math.sin(t * 3.1 + bl.phase)
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
        const bend = wind(fl.x, t) * gusty + 0.04 * Math.sin(t * 2.2 + fl.phase)
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
    const busy = wet > 0.01 || glowing > 0.03 || seeds.length + streaks.length + birds.length > 0
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

    // dandelion seeds: a little parachute over a hanging seed
    const pale = 0.55 + 0.45 * (1 - night)
    for (let i = seeds.length - 1; i >= 0; i--) {
      const sd = seeds[i]
      sd.age += dt
      if (sd.age > sd.life) {
        seeds.splice(i, 1)
        continue
      }
      sd.vx += (14 + wind(sd.x, t) * 70 - sd.vx) * Math.min(1, dt * 0.8)
      sd.vy += (-12 + Math.sin(t * 1.3 + sd.phase) * 9 + wet * 60 - sd.vy) * Math.min(1, dt * 0.9)
      sd.x += sd.vx * dt
      sd.y += sd.vy * dt
      const alpha = Math.min(1, sd.age * 4, (sd.life - sd.age) / 2) * pale
      const tilt = Math.sin(t * 1.7 + sd.phase) * 0.3 + sd.vx * 0.006
      c.strokeStyle = `rgba(250, 247, 232, ${(alpha * 0.9).toFixed(3)})`
      c.lineWidth = 0.7
      c.beginPath()
      for (let k = -2; k <= 2; k++) {
        const a = -Math.PI / 2 + tilt + k * 0.42
        c.moveTo(sd.x, sd.y)
        c.lineTo(sd.x + Math.cos(a) * 5.2, sd.y + Math.sin(a) * 5.2)
      }
      c.moveTo(sd.x, sd.y)
      c.lineTo(sd.x - Math.sin(tilt) * 5.5, sd.y + Math.cos(tilt) * 5.5)
      c.stroke()
    }

    // shooting stars
    for (let i = streaks.length - 1; i >= 0; i--) {
      const st = streaks[i]
      st.age += dt
      if (st.age > 1) {
        streaks.splice(i, 1)
        continue
      }
      const hx = st.x + st.age * 420
      const hy = st.y + st.age * 210
      const alpha = Math.sin(Math.PI * st.age)
      const tail = c.createLinearGradient(hx, hy, hx - 110, hy - 55)
      tail.addColorStop(0, `rgba(255, 250, 230, ${alpha.toFixed(3)})`)
      tail.addColorStop(1, 'rgba(255, 250, 230, 0)')
      c.strokeStyle = tail
      c.lineWidth = 2
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(hx, hy)
      c.lineTo(hx - 110, hy - 55)
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
      bd.x += bd.vx * dt
      bd.y += bd.vy * dt
      const size = bd.size * (1 - bd.age * 0.06)
      const lift = Math.sin(t * 8 + bd.phase) * size * 0.55
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
  o.handle.addEventListener('pointerdown', onHandleDown)
  o.handle.addEventListener('pointermove', onHandleMove)
  o.handle.addEventListener('pointerup', onHandleUp)
  o.handle.addEventListener('pointercancel', onHandleUp)
  o.handle.addEventListener('keydown', onHandleKey)

  return {
    stop: () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      o.handle.removeEventListener('pointerdown', onHandleDown)
      o.handle.removeEventListener('pointermove', onHandleMove)
      o.handle.removeEventListener('pointerup', onHandleUp)
      o.handle.removeEventListener('pointercancel', onHandleUp)
      o.handle.removeEventListener('keydown', onHandleKey)
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
