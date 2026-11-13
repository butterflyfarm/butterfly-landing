// Everything that moves on its own clock: wind through the foreground grass,
// drifting motes of light, and the butterfly. One requestAnimationFrame loop.

import { makeRng } from './scene'

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

type Point = { x: number; y: number }

export type LifeOptions = {
  canvas: HTMLCanvasElement
  butterfly: HTMLElement
  wings: readonly [SVGElement, SVGElement]
  getView: () => View
  /** places the butterfly may settle, in world units */
  getPerches: () => Point[]
  /** true when the visitor prefers reduced motion: draw one calm frame */
  still: boolean
}

export type Life = {
  stop: () => void
  /** send the butterfly to settle on a particular spot */
  visit: (p: Point) => void
}

type Row = { y: number; hMin: number; hMax: number; gap: number; colors: readonly string[] }
type Blade = { x: number; y: number; h: number; w: number; lean: number; phase: number }
type Flower = Point & { h: number; r: number; color: string; phase: number; after: number }
type Mote = Point & { r: number; vx: number; vy: number; phase: number }

const ROWS: readonly Row[] = [
  { y: 824, hMin: 30, hMax: 58, gap: 6.5, colors: ['#658a61', '#6f9568', '#7aa36c', '#99b677'] },
  { y: 860, hMin: 46, hMax: 84, gap: 6.5, colors: ['#567b59', '#5f8460', '#698e65', '#89ac70'] },
  { y: 906, hMin: 66, hMax: 118, gap: 7, colors: ['#45654a', '#4d6f51', '#547758', '#658862'] },
]
// tall screens get more rows of deeper, nearer grass beneath the farm
const DEEP = ['#3c5a43', '#43634a', '#4a6b4f', '#5a7b58'] as const

const PETALS = ['#eee6c5', '#e2d598', '#dfacb5', '#c1b1d5', '#eee6c5']

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
  for (let i = 0, n = Math.round((vis / 60) * (1 + lift / 120)); i < n; i++) {
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
  return { meta, rows, flowers, motes, half }
}

export function startLife(o: LifeOptions): Life {
  const ctx = o.canvas.getContext('2d')
  if (!ctx) return { stop: () => {}, visit: () => {} }
  const rand = makeRng(Date.now() & 0xffff)

  const first = o.getView()
  let garden = plant(first.vis, first.lift)
  let plantedFor = `${first.vis}/${first.lift}`

  // --- butterfly ---------------------------------------------------------
  const b = {
    x: -first.vis / 2 - 70,
    y: 540,
    vx: 70,
    vy: 0,
    tx: -first.vis * 0.12,
    ty: 600,
    mode: 'wander' as 'wander' | 'land' | 'rest',
    until: 9, // seconds until it next looks for somewhere to sit
    perch: { x: 0, y: 0 },
    angle: 0.5,
    flap: 0,
  }
  const pointer = { x: 0, y: 0, at: -100 }
  let now = 0

  const toWorld = (cx: number, cy: number): Point => {
    const v = o.getView()
    return { x: (cx - v.vw / 2) / v.u, y: (cy - (v.vh - (900 + v.lift) * v.u)) / v.u }
  }
  const roam = () => {
    const v = o.getView()
    // on a tall screen there is a lot more sky to explore
    const skyTop = Math.min(300, 900 + v.lift - v.tall + 150)
    b.tx = (rand() - 0.5) * v.vis * 0.82
    b.ty = rand() < 0.3 ? skyTop + rand() * (440 - skyTop) : 470 + rand() * 290
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    Object.assign(pointer, toWorld(e.clientX, e.clientY), { at: now })
  }
  const onDown = (e: PointerEvent) => {
    // the seedling asks for the butterfly itself, through visit()
    if (e.target instanceof Element && e.target.closest('[data-farm-control]')) return
    // anywhere else, a tap or click invites the butterfly over
    Object.assign(pointer, toWorld(e.clientX, e.clientY), { at: now + 1.5 })
    if (b.mode !== 'wander') {
      b.mode = 'wander'
      b.until = now + 14 + rand() * 8
    }
  }

  function moveButterfly(dt: number, t: number) {
    const v = o.getView()
    let wing: number
    let ox = 0
    let oy = 0

    if (b.mode === 'rest') {
      b.x = b.perch.x
      b.y = b.perch.y
      // slow, sun-warming wingbeats
      wing = 0.3 + 0.62 * (0.5 + 0.5 * Math.sin(t * 1.4))
      b.angle += (-0.3 - b.angle) * Math.min(1, dt * 3)
      if (t > b.until) {
        b.mode = 'wander'
        b.until = t + 16 + rand() * 12
        b.vx = (rand() - 0.5) * 40
        b.vy = -50
        roam()
      }
    } else {
      const curious = b.mode === 'wander' && t - pointer.at < 2.5
      if (curious) {
        b.tx = pointer.x + Math.cos(t * 0.9) * 46
        b.ty = pointer.y - 26 + Math.sin(t * 1.3) * 22
      }
      if (b.mode === 'wander' && t > b.until && !curious) {
        const perches = o.getPerches()
        b.perch = perches[Math.floor(rand() * perches.length)]
        b.mode = 'land'
      }
      if (b.mode === 'land') {
        b.tx = b.perch.x
        b.ty = b.perch.y
      }
      const dx = b.tx - b.x
      const dy = b.ty - b.y
      const d = Math.hypot(dx, dy) || 1
      if (b.mode === 'wander' && d < 36 && !curious) roam()

      const speed =
        b.mode === 'land' ? Math.min(96, 14 + d * 1.3) : 78 * (0.8 + 0.3 * Math.sin(t * 0.7))
      const ease = Math.min(1, dt * (b.mode === 'land' ? 3 : 1.7))
      b.vx += ((dx / d) * speed - b.vx) * ease
      b.vy += ((dy / d) * speed - b.vy) * ease
      b.x += b.vx * dt
      b.y += b.vy * dt

      if (b.mode === 'land' && d < 2.5) {
        b.mode = 'rest'
        b.until = t + 7 + rand() * 5
      }

      // the wobble that makes it a butterfly rather than a bird
      const amp = b.mode === 'land' ? Math.min(1, d / 90) : 1
      ox = Math.sin(t * 2.3 + 1) * 7 * amp
      oy = (Math.sin(t * 6.4) * 4 + Math.sin(t * 1.7) * 6) * amp

      // lean into the direction of travel, but always stay roughly upright
      const lean = Math.atan2(b.vx, 115 - b.vy)
      b.angle += (lean - b.angle) * Math.min(1, dt * 4)

      b.flap += dt * Math.PI * 2 * (3.1 + 0.9 * Math.sin(t * 0.9))
      wing = 0.57 + 0.43 * Math.cos(b.flap)
    }

    const depth = Math.min(1, Math.max(0, (b.y - 420) / 380))
    const scale = 0.82 + 0.34 * depth
    const px = (b.x + ox) * v.u
    const py = (b.y + oy) * v.u
    o.butterfly.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) rotate(${b.angle.toFixed(3)}rad) scale(${scale.toFixed(3)})`
    o.wings[0].style.transform = `scaleX(${wing.toFixed(3)})`
    o.wings[1].style.transform = `scaleX(${wing.toFixed(3)})`
  }

  // --- grass, flowers, motes --------------------------------------------
  function paint(t: number, dt: number) {
    const v = o.getView()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pw = Math.round(v.vw * dpr)
    const ph = Math.round(v.vh * dpr)
    if (o.canvas.width !== pw || o.canvas.height !== ph) {
      o.canvas.width = pw
      o.canvas.height = ph
    }
    const key = `${v.vis}/${v.lift}`
    if (key !== plantedFor) {
      garden = plant(v.vis, v.lift)
      plantedFor = key
    }
    const c = ctx!
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, pw, ph)
    c.setTransform(dpr * v.u, 0, 0, dpr * v.u, (dpr * v.vw) / 2, dpr * (v.vh - (900 + v.lift) * v.u))

    garden.rows.forEach((buckets, r) => {
      buckets.forEach((blades, ci) => {
        c.fillStyle = garden.meta[r].colors[ci]
        c.beginPath()
        for (const g of blades) {
          const bend = g.lean + wind(g.x, t) + 0.035 * Math.sin(t * 3.1 + g.phase)
          const tipX = g.x + bend * g.h * 0.55
          const tipY = g.y - g.h * (1 - 0.22 * bend * bend)
          const midX = g.x + bend * g.h * 0.14
          const midY = g.y - g.h * 0.58
          c.moveTo(g.x - g.w / 2, g.y)
          c.quadraticCurveTo(midX - g.w * 0.35, midY, tipX, tipY)
          c.quadraticCurveTo(midX + g.w * 0.35, midY, g.x + g.w / 2, g.y)
        }
        c.fill()
      })

      for (const f of garden.flowers) {
        if (f.after !== r) continue
        const bend = wind(f.x, t) + 0.04 * Math.sin(t * 2.2 + f.phase)
        const hx = f.x + bend * f.h * 0.5
        const hy = f.y - f.h * (1 - 0.2 * bend * bend)
        c.strokeStyle = '#527b55'
        c.lineWidth = 1.3
        c.beginPath()
        c.moveTo(f.x, f.y)
        c.quadraticCurveTo(f.x + bend * f.h * 0.12, f.y - f.h * 0.6, hx, hy)
        c.stroke()
        c.fillStyle = f.color
        c.beginPath()
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2 + f.phase
          const px = hx + Math.cos(a) * f.r * 0.8
          const py = hy + Math.sin(a) * f.r * 0.8
          c.moveTo(px + f.r * 0.72, py)
          c.arc(px, py, f.r * 0.72, 0, 7)
        }
        c.fill()
        c.fillStyle = '#d2a955'
        c.beginPath()
        c.arc(hx, hy, f.r * 0.5, 0, 7)
        c.fill()
      }
    })

    if (!o.still) {
      for (const m of garden.motes) {
        m.x += (m.vx + wind(m.x, t) * 26) * dt
        m.y += (m.vy + Math.sin(t * 0.8 + m.phase) * 5) * dt
        if (m.x > garden.half) m.x = -garden.half
        if (m.y < 380) m.y = 840
        const glow = 0.14 + 0.34 * Math.sin(t * 0.9 + m.phase) ** 2
        c.fillStyle = `rgba(250, 240, 208, ${glow.toFixed(3)})`
        c.beginPath()
        c.arc(m.x, m.y, m.r, 0, 7)
        c.fill()
      }
    }
  }

  // --- the loop ----------------------------------------------------------
  if (o.still) {
    const settle = () => {
      if (b.mode !== 'rest') b.perch = o.getPerches()[0]
      Object.assign(b, { mode: 'rest', until: Infinity, angle: -0.3 })
      paint(0, 0)
      moveButterfly(0, 1.1)
    }
    settle()
    // wait a frame so the view has been re-measured before repainting
    const later = () => requestAnimationFrame(settle)
    window.addEventListener('resize', later)
    return {
      stop: () => window.removeEventListener('resize', later),
      visit: (p) => {
        b.perch = p
        settle()
      },
    }
  }

  let raf = 0
  let last = 0
  const frame = (ms: number) => {
    const dt = last ? Math.min(0.05, (ms - last) / 1000) : 0
    last = ms
    now += dt
    paint(now, dt)
    moveButterfly(dt, now)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })

  return {
    stop: () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
    },
    visit: (p) => {
      b.perch = p
      b.mode = 'land'
      pointer.at = -100
    },
  }
}
