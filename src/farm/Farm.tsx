import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  H,
  HALF,
  cumulus,
  field,
  foliage,
  landPath,
  makeRng,
  meadowFlowers,
  pathRibbon,
  ridges,
  skyline,
  tuftPaths,
  type Dot,
  type Foliage,
} from './scene'
import { startLife, type Flier, type Life, type Spots, type View } from './life'
import './farm.css'

/**
 * What is planted in the garden bed, left to right. The farm grows apps:
 * a plot with a name is sprouting, a plot without one is resting soil.
 * A seedling says nothing until it is touched; then its tag shows `kind`,
 * `name` and `note`. When an app is grown, its story goes here.
 */
type Plot = { name?: string; kind?: string; note?: string; thanks?: string }
const PLOTS: readonly Plot[] = [
  {},
  {
    name: 'Nicety',
    kind: 'First seedling',
    note: 'Still growing. More when it blooms.',
    // shown once a visitor has brought it rain and light
    thanks: 'Thank you for the rain and the light. More when it blooms.',
  },
  {},
]

/** How much bigger the seedling stands after each bit of care. */
const GROWN = [1, 1.16, 1.3, 1.42]

const BED_Y = 752

/** `n` world units as a CSS length */
const U = (n: number) => `calc(${Math.round(n * 10) / 10} * var(--u))`

function measure(): View {
  // never trust a zero-sized window (a hidden tab, a pane still opening)
  const vw = Math.max(window.innerWidth, 320)
  const vh = Math.max(window.innerHeight, 240)
  let u = vh / H
  const wide = vw / u
  // very wide windows crop the top of the sky; narrow ones gain more of it
  if (wide > HALF * 2) u = vw / (HALF * 2)
  else if (wide < 600) u = vw / 600
  const tall = vh / u
  // on a tall (phone) screen, raise the farm a little and let grass fill in below
  const lift = Math.round(Math.min(170, Math.max(0, (tall - H) * 0.4)))
  return { vw, vh, u, vis: vw / u, tall, lift }
}

/** How far apart things stand: gathered in on a phone, spread out on a desk. */
const spreadFor = (vis: number) =>
  Math.round((0.6 + 0.4 * Math.min(1, Math.max(0, (vis - 600) / 900))) * 50) / 50

function Dots({ dots, fill, opacity }: { dots: Dot[]; fill: string; opacity?: number }) {
  return (
    <g fill={fill} opacity={opacity}>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} />
      ))}
    </g>
  )
}

type Tones = readonly [dark: string, mid: string, light: string]

function Leaves({ f, tones }: { f: Foliage; tones: Tones }) {
  return (
    <>
      <Dots dots={f.dark} fill={tones[0]} />
      <Dots dots={f.mid} fill={tones[1]} />
      <Dots dots={f.shade} fill={tones[0]} opacity={0.55} />
      <Dots dots={f.light} fill={tones[2]} />
    </>
  )
}

const HILL_TREE: Tones = ['#5a7960', '#70916f', '#93b37e']
const BIG_TREE: Tones = ['#4a6853', '#628764', '#8aae74']
const FLOWER_TONES = ['#eee6c4', '#e0d394', '#deacb6', '#c3b4d7']

// ---------------------------------------------------------------- the land

const Land = memo(function Land({ spread }: { spread: number }) {
  const s = spread
  const art = useMemo(() => {
    const rand = makeRng(101)
    const { far, mid, near, front } = ridges

    const forest: Dot[] = []
    for (const [x0, x1] of [
      [-1150, -790],
      [-430, -140],
      [500, 930],
    ]) {
      for (let x = x0; x < x1; x += 9 + rand() * 9) {
        const r = 8 + rand() * 9
        forest.push({ x, y: far(x) - r * 0.25 + rand() * 4, r })
      }
    }

    const hx = -330 * s
    const hy = mid(hx) + 12
    const treeX = 500 * s
    const treeY = near(treeX) + 8

    const trees = [-985, -770, -705, -615, hx - 200, 215, 290, 630, 705, 890, 965]
      .map((x) => {
        const R = 22 + rand() * 16
        const y = mid(x) + 5 + rand() * 8
        return { x, y, R, f: foliage(rand, x, y - R * 1.45, R, 7) }
      })
    const bushes = [-1010, -890, -560, 880, 1040].map((x) => {
      const R = 26 + rand() * 14
      const y = near(x) + 14 + rand() * 20
      return foliage(rand, x, y - R * 0.5, R, 7)
    })

    return {
      forest,
      hx,
      hy,
      treeX,
      treeY,
      trees,
      bushes,
      fields: {
        farWheat: field(far, 120, 430, 5, 22, 5),
        farGreen: field(far, -720, -470, 5, 20, 4),
        lavender: field(mid, -110, 200, 9, 42, 7),
        wheat: field(mid, -930, -650, 9, 40, 6),
        green: field(mid, 640, 930, 9, 40, 6),
      },
      tufts: {
        far: tuftPaths(3, far, 560, 150, 2, 3.4),
        mid: tuftPaths(5, mid, 650, 260, 2.6, 5),
        near: tuftPaths(9, near, front(0) + 6, 520, 3.4, 8.5),
      },
      flowers: meadowFlowers(13, near, 790, 26),
      lane: pathRibbon(
        [
          [hx - 33, hy + 1],
          [hx - 22, hy + 30],
          [hx + 92, hy + 38],
          [hx + 148, near(hx + 148) + 8],
        ],
        4,
        11,
      ),
      path: pathRibbon(
        [
          [hx + 150, near(hx + 150) + 1],
          [hx + 260, 690],
          [-420 * s - 80, 716],
          [-330 * s - 150, 812],
        ],
        9,
        58,
      ),
    }
  }, [s])

  const bedRx = 300 * s
  const mounds = PLOTS.map((p, i) => ({ ...p, x: (i - (PLOTS.length - 1) / 2) * 185 * s }))
  const { hx, hy, treeX, treeY } = art

  return (
    <svg
      className="land"
      viewBox={`${-HALF} 0 ${HALF * 2} ${H}`}
      preserveAspectRatio="none"
      style={{ left: U(-HALF), top: 0, width: U(HALF * 2), height: U(H) }}
    >
      <defs>
        <linearGradient id="g-peaks-back" gradientUnits="userSpaceOnUse" x1="0" y1="380" x2="0" y2="500">
          <stop offset="0" stopColor="#9cb1bf" />
          <stop offset="1" stopColor="#b4c6cb" />
        </linearGradient>
        <linearGradient id="g-peaks-front" gradientUnits="userSpaceOnUse" x1="0" y1="430" x2="0" y2="520">
          <stop offset="0" stopColor="#8ba3ac" />
          <stop offset="1" stopColor="#a9bdbc" />
        </linearGradient>
        <linearGradient id="g-haze" gradientUnits="userSpaceOnUse" x1="0" y1="420" x2="0" y2="560">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#e9e3c1" stopOpacity="0.4" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="g-far" gradientUnits="userSpaceOnUse" x1="0" y1="470" x2="0" y2="570">
          <stop offset="0" stopColor="#b1c392" />
          <stop offset="1" stopColor="#9db385" />
        </linearGradient>
        <linearGradient id="g-mid" gradientUnits="userSpaceOnUse" x1="0" y1="510" x2="0" y2="660">
          <stop offset="0" stopColor="#95b47b" />
          <stop offset="1" stopColor="#7ea06f" />
        </linearGradient>
        <linearGradient id="g-near" gradientUnits="userSpaceOnUse" x1="0" y1="600" x2="0" y2="820">
          <stop offset="0" stopColor="#83ac6f" />
          <stop offset="1" stopColor="#6c9165" />
        </linearGradient>
        <linearGradient id="g-front" gradientUnits="userSpaceOnUse" x1="0" y1="790" x2="0" y2="900">
          <stop offset="0" stopColor="#60855c" />
          <stop offset="1" stopColor="#49694d" />
        </linearGradient>
        <linearGradient id="g-soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#86705d" />
          <stop offset="1" stopColor="#6d5a4b" />
        </linearGradient>
        <radialGradient id="g-sunpatch">
          <stop offset="0" stopColor="#b5cd89" stopOpacity="0.55" />
          <stop offset="1" stopColor="#b5cd89" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* distant blue mountains, softened by haze */}
      <path d={landPath(ridges.peaksBack)} fill="url(#g-peaks-back)" />
      <path d={landPath(ridges.peaksFront)} fill="url(#g-peaks-front)" />

      {/* far hill: a hazy wood and two small fields */}
      <path d={landPath(ridges.far)} fill="url(#g-far)" />
      <Dots dots={art.forest} fill="#7a977e" />
      <Dots
        dots={art.forest.map((d) => ({ x: d.x - d.r * 0.2, y: d.y - d.r * 0.28, r: d.r * 0.72 }))}
        fill="#8fac8c"
      />
      <path d={art.fields.farWheat.outline} fill="#cac18e" />
      <path d={art.fields.farWheat.furrows} fill="none" stroke="#b6ad7c" strokeWidth="1" />
      <path d={art.fields.farGreen.outline} fill="#bbc992" />
      <path d={art.fields.farGreen.furrows} fill="none" stroke="#a7b784" strokeWidth="1" />
      <path d={art.tufts.far[0]} fill="#bccb9a" opacity="0.7" />
      <path d={art.tufts.far[1]} fill="#92a97e" opacity="0.7" />
      <rect x={-HALF} y="420" width={HALF * 2} height="140" fill="url(#g-haze)" />

      {/* middle hill: crop rows, the cottage, scattered trees */}
      <path d={landPath(ridges.mid)} fill="url(#g-mid)" />
      <path d={art.fields.lavender.outline} fill="#b4a5c7" />
      <path d={art.fields.lavender.furrows} fill="none" stroke="#9c8fb3" strokeWidth="1.6" />
      <path d={art.fields.wheat.outline} fill="#cdc188" />
      <path d={art.fields.wheat.furrows} fill="none" stroke="#b6a973" strokeWidth="1.6" />
      <path d={art.fields.green.outline} fill="#a9c184" />
      <path d={art.fields.green.furrows} fill="none" stroke="#91ae74" strokeWidth="1.6" />
      <path d={art.tufts.mid[0]} fill="#a6c087" opacity="0.8" />
      <path d={art.tufts.mid[1]} fill="#74946b" opacity="0.7" />
      <path d={art.tufts.mid[2]} fill="#9eba81" opacity="0.8" />
      <path d={art.lane} fill="#d2c49f" />

      {art.trees.map((t, i) => (
        <g key={i}>
          <ellipse cx={t.x + t.R * 0.5} cy={t.y + 1} rx={t.R * 1.1} ry={t.R * 0.16} fill="#658563" opacity="0.4" />
          <rect x={t.x - t.R * 0.08} y={t.y - t.R} width={t.R * 0.16} height={t.R + 1} fill="#6d5a4c" />
          <Leaves f={t.f} tones={HILL_TREE} />
        </g>
      ))}

      <g transform={`translate(${hx} ${hy}) scale(1.2)`}>
        <ellipse cx="14" cy="2" rx="88" ry="7" fill="#658563" opacity="0.4" />
        {/* two poplars behind the cottage */}
        {[
          [-74, 76],
          [-93, 58],
        ].map(([x, h]) => (
          <g key={x}>
            <path
              d={`M${x} 0C${x - h * 0.2} ${-h * 0.3} ${x - h * 0.14} ${-h * 0.9} ${x} ${-h}C${x + h * 0.14} ${-h * 0.9} ${x + h * 0.2} ${-h * 0.3} ${x} 0Z`}
              fill="#56745d"
            />
            <path
              d={`M${x - 1} ${-h * 0.05}C${x - h * 0.18} ${-h * 0.3} ${x - h * 0.12} ${-h * 0.86} ${x - 1} ${-h * 0.97}C${x + h * 0.03} ${-h * 0.7} ${x + h * 0.05} ${-h * 0.3} ${x - 1} ${-h * 0.05}Z`}
              fill="#709070"
            />
          </g>
        ))}
        <rect x="14" y="-80" width="10" height="24" fill="#9f7969" />
        <rect x="13" y="-82" width="12" height="4" fill="#8a695e" />
        <path d="M-50 0V-36L-28 -62L-6 -36V0Z" fill="#e5d8b9" />
        <path d="M-6 -36H52V0H-6Z" fill="#d2c7ad" />
        <path d="M-28 -62H34L58 -34H-4Z" fill="#af705b" />
        <path d="M-28 -62H34L37 -58H-25Z" fill="#be8168" />
        <path d="M-55 -33L-28 -66L-2 -33L-6 -31L-28 -58L-51 -30Z" fill="#956252" />
        <rect x="-34" y="-20" width="12" height="20" rx="1" fill="#806754" />
        <circle cx="-28" cy="-41" r="4.2" fill="#7a939c" stroke="#e5d8b9" strokeWidth="1.2" />
        <rect x="8" y="-27" width="11" height="12" fill="#7a939c" stroke="#e5d8b9" strokeWidth="1.4" />
        <rect x="30" y="-27" width="11" height="12" fill="#7a939c" stroke="#e5d8b9" strokeWidth="1.4" />
        <rect x="6" y="-13" width="15" height="3" fill="#c98a7e" />
        <rect x="28" y="-13" width="15" height="3" fill="#c98a7e" />
        {/* shed and a short run of fence */}
        <path d="M58 0V-22H88V0Z" fill="#cabd9f" />
        <path d="M54 -21L73 -36L92 -21Z" fill="#916657" />
        <rect x="68" y="-14" width="10" height="14" fill="#806754" />
        <path d="M98 -9H150M98 -4H150" stroke="#dbceb1" strokeWidth="1.3" />
        <path d="M100 0V-12M112 0V-12M124 0V-12M136 0V-12M148 0V-12" stroke="#dbceb1" strokeWidth="2" />
      </g>

      {/* the near meadow, where the garden is */}
      <path d={landPath(ridges.near)} fill="url(#g-near)" />
      <ellipse cx={-380} cy="700" rx="330" ry="34" fill="url(#g-sunpatch)" />
      <ellipse cx={160} cy="690" rx="300" ry="30" fill="url(#g-sunpatch)" />
      <ellipse cx={760} cy="730" rx="320" ry="36" fill="url(#g-sunpatch)" />
      <path d={art.tufts.near[0]} fill="#98bd7b" opacity="0.85" />
      <path d={art.tufts.near[1]} fill="#668c61" opacity="0.75" />
      <path d={art.tufts.near[2]} fill="#a7c685" opacity="0.8" />
      <path d={art.path} fill="#d4c7a0" />
      <path d={art.path} fill="none" stroke="#bdae87" strokeWidth="1.5" opacity="0.7" />
      {art.flowers.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={FLOWER_TONES[b.tone]} />
      ))}
      {art.bushes.map((f, i) => (
        <Leaves key={i} f={f} tones={['#517258', '#678c66', '#8db076']} />
      ))}
      <ellipse cx={treeX + 46} cy={treeY + 6} rx={230 * (0.7 + 0.15 * s)} ry="22" fill="#4f7254" opacity="0.38" />

      {/* the garden bed */}
      <g transform={`translate(0 ${BED_Y})`}>
        <ellipse cx="0" cy="7" rx={bedRx + 3} ry="47" fill="#5e5042" opacity="0.55" />
        <ellipse cx="0" cy="0" rx={bedRx} ry="44" fill="url(#g-soil)" />
        {[-26, -10, 8, 26].map((y) => {
          const w = bedRx * Math.sqrt(1 - (y / 44) ** 2) - 14
          return (
            <path
              key={y}
              d={`M${-w} ${y}Q0 ${y + 7} ${w} ${y}`}
              fill="none"
              stroke="#615244"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.45"
            />
          )
        })}
        {mounds.map((m) => (
          <g key={m.x} transform={`translate(${m.x} -2)`}>
            <path d="M-36 4Q-22 -19 0 -20Q22 -19 36 4Z" fill="#766250" />
            <path d="M-30 0Q-18 -17 2 -18Q-10 -10 -16 2Z" fill="#917c66" opacity="0.8" />
            <circle cx="14" cy="-4" r="1.6" fill="#615244" />
            <circle cx="-8" cy="-2" r="1.2" fill="#615244" />
            {!m.name && (
              // resting soil: a blank marker, waiting for a name
              <g transform="translate(13 -12) rotate(5)">
                <rect x="-1.2" y="-16" width="2.4" height="20" fill="#806c58" />
                <rect x="-8" y="-22" width="16" height="10" rx="1.5" fill="#d5c49e" stroke="#a48f71" strokeWidth="0.7" />
              </g>
            )}
          </g>
        ))}
        {/* a watering can left by the bed */}
        <g transform={`translate(${-bedRx * 0.82} 44)`}>
          <ellipse cx="3" cy="1" rx="24" ry="4" fill="#4f7254" opacity="0.45" />
          <path d="M-11 -17C-24 -18 -24 -3 -12 -4" fill="none" stroke="#708588" strokeWidth="3" strokeLinecap="round" />
          <path d="M10 -7L29 -22" stroke="#7b9498" strokeWidth="4.5" strokeLinecap="round" />
          <ellipse cx="30.5" cy="-23.5" rx="5" ry="2.6" transform="rotate(-52 30.5 -23.5)" fill="#91aaae" />
          <path d="M-13 0L-11 -21H11L13 0Z" fill="#86a1a6" />
          <path d="M-9 -2L-8 -19H-3L-4 -2Z" fill="#a2bcbe" />
          <ellipse cx="0" cy="-21" rx="11" ry="2.6" fill="#708588" />
        </g>
      </g>

      {/* the bank the foreground grass grows from */}
      <path d={landPath(ridges.front)} fill="url(#g-front)" />
    </svg>
  )
})

// ------------------------------------------------------------------ clouds

const CLOUDS = [
  { fx: 0.34, base: 482, w: 560, h: 300, seed: 11, speed: 5, always: true, rise: 0 },
  { fx: -0.72, base: 474, w: 470, h: 205, seed: 23, speed: 4.4, always: true, rise: 0 },
  { fx: 0.98, base: 470, w: 420, h: 180, seed: 37, speed: 4.2, always: false, rise: 0 },
  { fx: -0.18, base: 262, w: 230, h: 74, seed: 41, speed: 7, always: true, rise: 0.5 },
  { fx: 0.7, base: 196, w: 190, h: 58, seed: 53, speed: 8, always: false, rise: 0.92 },
  { fx: -1.05, base: 336, w: 270, h: 92, seed: 67, speed: 6, always: false, rise: 0.3 },
] as const

const lit = (p: Dot): Dot => ({ x: p.x - p.r * 0.14, y: p.y - p.r * 0.2, r: p.r * 0.93 })
const asCircle = (d: Dot) => ({ cx: d.x, cy: d.y, r: d.r })

const Clouds = memo(function Clouds({
  vis,
  spread,
  sky,
  onTap,
}: {
  vis: number
  spread: number
  /** extra sky above the 900-unit world, on tall screens */
  sky: number
  /** a cloud was touched: it rains */
  onTap: () => void
}) {
  const size = 0.4 + 0.6 * spread
  return (
    <>
      {CLOUDS.filter((c) => c.always || vis > 900 || (sky > 150 && c.rise > 0.8)).map((c) => {
        const w = c.w * size
        const h = c.h * size
        const pad = w * 0.12
        const x = (c.fx * vis) / 2
        const from = -vis / 2 - w * 0.62 - 30
        const to = vis / 2 + w * 0.62 + 30
        const seconds = (to - from) / c.speed
        const puffs = cumulus(c.seed, w, h)
        return (
          <svg
            key={c.seed}
            className="cloud"
            data-farm-control
            onClick={onTap}
            aria-hidden="true"
            viewBox={`${-w / 2 - pad} ${-h - pad} ${w + pad * 2} ${h + pad + 6}`}
            style={
              {
                left: U(x - w / 2 - pad),
                top: U(c.base - sky * c.rise - h - pad),
                width: U(w + pad * 2),
                height: U(h + pad + 6),
                '--from': U(from - x),
                '--to': U(to - x),
                animationDuration: `${seconds.toFixed(0)}s`,
                animationDelay: `${(-seconds * ((x - from) / (to - from))).toFixed(0)}s`,
              } as CSSProperties
            }
          >
            <defs>
              <clipPath id={`cloud-${c.seed}`}>
                {puffs.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={p.r} />
                ))}
              </clipPath>
              <linearGradient id={`cloud-shade-${c.seed}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0.45" stopColor="#a7b1be" stopOpacity="0" />
                <stop offset="1" stopColor="#a7b1be" stopOpacity="0.75" />
              </linearGradient>
            </defs>
            {/* a shaded silhouette, lit from the upper left, with a few billows inside */}
            <Dots dots={puffs} fill="#b9c1cb" />
            <Dots dots={puffs.map(lit)} fill="#eee8d9" />
            {puffs
              .filter((p, i) => i % 3 === 0 && p.y > -h * 0.62)
              .map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={p.r} fill="#c6ccd2" />
                  <circle {...asCircle(lit(p))} fill="#eee8d9" />
                </g>
              ))}
            <rect
              x={-w / 2 - pad}
              y={-h - pad}
              width={w + pad * 2}
              height={h + pad + 6}
              fill={`url(#cloud-shade-${c.seed})`}
              clipPath={`url(#cloud-${c.seed})`}
            />
            <rect
              className="tint tint--cloud"
              x={-w / 2 - pad}
              y={-h - pad}
              width={w + pad * 2}
              height={h + pad + 6}
              clipPath={`url(#cloud-${c.seed})`}
            />
          </svg>
        )
      })}
    </>
  )
})

// ---------------------------------------------------------------- big tree

const Tree = memo(function Tree({ x, y, k }: { x: number; y: number; k: number }) {
  const { back, front } = useMemo(() => {
    const rand = makeRng(77)
    const grow = (c: readonly (readonly [number, number, number])[]) =>
      c.map(([cx, cy, R]) => foliage(rand, cx, cy, R, 18))
    return {
      back: grow([
        [0, -395, 96],
        [-152, -242, 96],
        [152, -246, 100],
        [-208, -186, 60],
        [198, -190, 62],
      ]),
      front: grow([
        [-86, -326, 104],
        [82, -334, 108],
        [-8, -250, 116],
      ]),
    }
  }, [])
  const box = {
    left: U(x - 290 * k),
    top: U(y - 520 * k),
    width: U(580 * k),
    height: U(544 * k),
  }
  const viewBox = '-290 -520 580 544'
  const trunk =
    'M-44 6C-26 -8 -22 -70 -19 -160L-66 -238L-52 -246L-6 -186L-2 -300H10L12 -190L60 -250L72 -242L22 -160C24 -70 30 -8 50 6Z'
  return (
    <>
      <svg className="tree" viewBox={viewBox} style={box} aria-hidden="true">
        <path d={trunk} fill="#7a6350" />
        <path d="M6 6C10 -60 10 -120 12 -190L60 -250L72 -242L22 -160C24 -70 30 -8 50 6Z" fill="#655243" />
        <path d="M-30 -2C-20 -30 -16 -90 -14 -150" fill="none" stroke="#927d67" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
        <path className="tint" d={trunk} />
      </svg>
      <svg className="tree tree--sway-a" viewBox={viewBox} style={box} aria-hidden="true">
        {back.map((f, i) => (
          <Leaves key={i} f={f} tones={BIG_TREE} />
        ))}
        <LeafTint id="tree-back" groups={back} />
      </svg>
      <svg className="tree tree--sway-b" viewBox={viewBox} style={box} aria-hidden="true">
        {front.map((f, i) => (
          <Leaves key={i} f={f} tones={BIG_TREE} />
        ))}
        <LeafTint id="tree-front" groups={front} />
      </svg>
    </>
  )
})

/** One multiply-tint over a canopy, clipped to its leaves, so the hour's light falls on it. */
function LeafTint({ id, groups }: { id: string; groups: Foliage[] }) {
  return (
    <>
      <defs>
        <clipPath id={id}>
          {groups
            .flatMap((f) => [...f.dark, ...f.mid])
            .map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={d.r} />
            ))}
        </clipPath>
      </defs>
      <rect className="tint" x="-290" y="-520" width="580" height="544" clipPath={`url(#${id})`} />
    </>
  )
}

// ---------------------------------------------------------- the farm sign

const SIGN_BOX = '-34 -264 284 284'

/** A hanging wooden sign by the lane, under a lantern: the only words on the farm. */
const FarmSign = memo(function FarmSign({ x, y, k }: { x: number; y: number; k: number }) {
  const box = { left: U(x - 34 * k), top: U(y - 264 * k), width: U(284 * k), height: U(284 * k) }
  return (
    <>
      <svg className="sign" viewBox={SIGN_BOX} style={box} aria-hidden="true">
        <defs>
          <clipPath id="sign-frame">
            <path d="M-8 4L-7 -252H7L8 4Z" />
            <path d="M-10 -252H10L7 -260H-7Z" />
            <rect x="-18" y="-240" width="256" height="12" rx="2" />
            <path d="M3 -181L55 -233L61 -227L9 -175Z" />
            <path d="M221 -219H235L232 -224H224ZM222 -219H234V-204H222Z" />
          </clipPath>
        </defs>
        <ellipse cx="14" cy="2" rx="46" ry="6" fill="#3f5c45" opacity="0.4" />
        {/* post, arm and brace */}
        <path d="M-8 4L-7 -252H7L8 4Z" fill="#7b6350" />
        <path d="M1 4L1 -252H7L8 4Z" fill="#63503f" />
        <path d="M-10 -252H10L7 -260H-7Z" fill="#8a715c" />
        <rect x="-18" y="-240" width="256" height="12" rx="2" fill="#7b6350" />
        <rect x="-18" y="-233" width="256" height="5" rx="2" fill="#63503f" />
        <path d="M3 -181L55 -233L61 -227L9 -175Z" fill="#6d5745" />
        {/* the lantern */}
        <path d="M228 -228V-223" stroke="#55483c" strokeWidth="1.4" />
        <path d="M222 -219H234V-204H222Z" fill="#e3c78e" />
        <path d="M221 -219H235L232 -224H224Z" fill="#55483c" />
        <path d="M221 -204H235V-202H221ZM228 -219V-204" stroke="#55483c" strokeWidth="1" fill="#55483c" />
        {/* grass gathered at its foot */}
        <path
          d="M-30 6l5 -24 4 20 5 -30 5 28 6 -22 4 24 6 -32 5 30 6 -20 4 22 6 -26 5 28Z"
          fill="#547758"
        />
        <path className="tint" d="M-30 6l5 -24 4 20 5 -30 5 28 6 -22 4 24 6 -32 5 30 6 -20 4 22 6 -26 5 28Z" />
        <rect className="tint tint--sign" x="-34" y="-264" width="284" height="284" clipPath="url(#sign-frame)" />
      </svg>
      <svg className="sign sign--board" viewBox={SIGN_BOX} style={box} aria-hidden="true">
        <defs>
          <clipPath id="sign-board">
            <path d="M25 -206H205A7 7 0 0 1 212 -199V-122A7 7 0 0 1 205 -115H26A7 7 0 0 1 19 -122V-199A7 7 0 0 1 25 -206Z" />
          </clipPath>
        </defs>
        <path d="M44 -228V-206M186 -228V-206" stroke="#8d8068" strokeWidth="2.2" />
        <rect x="19" y="-203" width="194" height="88" rx="7" fill="#9b8466" />
        <rect x="18" y="-206" width="194" height="88" rx="7" fill="#d9c9a6" />
        <path d="M26 -178H204M26 -147H204" stroke="#c9b892" strokeWidth="1" />
        <circle cx="44" cy="-198" r="2.2" fill="#8d7556" />
        <circle cx="186" cy="-198" r="2.2" fill="#8d7556" />
        <text x="115" y="-156" textAnchor="middle" className="sign__name">
          Butterfly Farm
        </text>
        <path d="M46 -135H82M148 -135H184" stroke="#6b5744" strokeWidth="0.9" />
        <text x="117" y="-131" textAnchor="middle" className="sign__kind">
          STUDIO
        </text>
        <rect className="tint tint--sign" x="-34" y="-264" width="284" height="284" clipPath="url(#sign-board)" />
      </svg>
    </>
  )
})

// ------------------------------------------------------- the growing plot

const LEAF = 'M0 0C8 -15 30 -19 44 -7C32 5 10 8 0 0Z'
const SPROUT_Y = BED_Y - 22

/**
 * The seedling. It carries no label: touch it to read its tag.
 * `stage` is how much care it has had (0 to 3); each stage adds a little growth.
 */
const Sprout = memo(function Sprout({ stage }: { stage: number }) {
  const steps = [1, 2, 3].filter((n) => stage >= n).map((n) => ` plot--s${n}`)
  return (
    <svg
      className={`plot${steps.join('')}`}
      data-stage={stage}
      viewBox="-80 -150 160 180"
      style={{ left: U(-80), top: U(SPROUT_Y - 150), width: U(160), height: U(180) }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="g-glow">
          <stop offset="0" stopColor="#f8eecb" stopOpacity="0.85" />
          <stop offset="1" stopColor="#f8eecb" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="g-bud" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3e6cd" />
          <stop offset="1" stopColor="#dca690" />
        </linearGradient>
      </defs>
      <g className="sprout">
        <g className="sprout__size">
          <circle className="sprout__glow" cx="1" cy="-98" r="42" fill="url(#g-glow)" />
          <path
            className="sprout__stem"
            d="M0 3C-6 -26 8 -54 1 -88"
            pathLength="1"
            fill="none"
            stroke="#5c8c58"
            strokeWidth="4.6"
            strokeLinecap="round"
          />
          {/* leaves that only come with rain and light */}
          <g transform="translate(-1 -22) rotate(-34) scale(0.7)">
            <g className="sprout__more sprout__more--1">
              <path d={LEAF} fill="#7aa66b" />
            </g>
          </g>
          <g transform="translate(-1 -24) scale(-0.62 0.62) rotate(-30)">
            <g className="sprout__more sprout__more--1">
              <path d={LEAF} fill="#6f9a64" />
            </g>
          </g>
          <g transform="translate(3 -74) scale(-0.7 0.7) rotate(-34)">
            <g className="sprout__more sprout__more--2">
              <path d={LEAF} fill="#8ab274" />
            </g>
          </g>
          <g transform="translate(0 -42) scale(-1.12 1.12) rotate(-20)">
            <g className="sprout__leaf sprout__leaf--1">
              <path d={LEAF} fill="#6f9a64" />
              <path d="M2 -1C16 -8 30 -9 42 -7" fill="none" stroke="#5c8c58" strokeWidth="1.2" />
            </g>
          </g>
          <g transform="translate(2 -60) rotate(-26)">
            <g className="sprout__leaf sprout__leaf--2">
              <path d={LEAF} fill="#8ab274" />
              <path d="M2 -1C16 -8 30 -9 42 -7" fill="none" stroke="#6a9a60" strokeWidth="1.2" />
            </g>
          </g>
          <g transform="translate(1 -86) scale(-0.42 0.42) rotate(-52)">
            <g className="sprout__leaf sprout__leaf--3">
              <path d={LEAF} fill="#8ab274" />
            </g>
          </g>
          <g transform="translate(1 -86) scale(0.42) rotate(-52)">
            <g className="sprout__leaf sprout__leaf--3">
              <path d={LEAF} fill="#9dc184" />
            </g>
          </g>
          <circle className="sprout__spark" cx="-9" cy="-106" r="1.7" fill="#fbf3d6" />
          <circle className="sprout__spark" cx="12" cy="-112" r="1.3" fill="#fbf3d6" />
          <circle className="sprout__spark" cx="3" cy="-118" r="1.5" fill="#fbf3d6" />
          {/* the bud: an app, not yet open. Nearly in bloom, its first petals show. */}
          <g transform="translate(1 -99)">
            <g className="sprout__budsize">
              <g transform="rotate(-38)">
                <path className="sprout__petal" d="M0 0C-9 -6 -9 -17 0 -21C9 -17 9 -6 0 0Z" fill="#e9bfae" />
              </g>
              <g transform="rotate(40)">
                <path className="sprout__petal" d="M0 0C-9 -6 -9 -17 0 -21C9 -17 9 -6 0 0Z" fill="#efcdb8" />
              </g>
              <g className="sprout__bud">
                <rect x="-9.5" y="-9.5" width="19" height="19" rx="6.2" fill="url(#g-bud)" transform="rotate(8)" />
                <path d="M-5 -3.5Q-2.5 -7 2 -6.5" fill="none" stroke="#fbf3e0" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  )
})

// ------------------------------------------------------------ night sky

const Stars = memo(function Stars() {
  const { still, twinkling } = useMemo(() => {
    const rand = makeRng(301)
    const all = Array.from({ length: 170 }, () => ({
      x: Math.round((rand() - 0.5) * HALF * 2),
      y: Math.round(-700 + rand() * 1150),
      r: 0.7 + rand() ** 3 * 1.9,
      a: 0.45 + rand() * 0.55,
    }))
    return { still: all.slice(14), twinkling: all.slice(0, 14) }
  }, [])
  return (
    <div className="stars" style={{ left: U(-HALF), top: U(-700), width: U(HALF * 2), height: U(1170) }}>
      <svg viewBox={`${-HALF} -700 ${HALF * 2} 1170`} aria-hidden="true">
        {still.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#f1eedc" opacity={s.a} />
        ))}
      </svg>
      {twinkling.map((s, i) => (
        <i
          key={i}
          style={{
            left: U(s.x + HALF),
            top: U(s.y + 700),
            animationDelay: `${(-i * 0.83).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  )
})

// ---------------------------------------------------------------- the farm

const WING_UPPER = 'M0.6 -2.5C5 -14 17 -19 19.5 -10.5C21 -4.5 11 1 0.6 1Z'
const WING_LOWER = 'M0.6 1C8 0.5 15.5 5 13.5 11C11.5 16.5 3.5 13.5 0.6 5.5Z'

function Wing() {
  return (
    <>
      <path d={WING_LOWER} fill="url(#g-wing-low)" stroke="#3d6652" strokeWidth="0.8" strokeLinejoin="round" />
      <path d={WING_UPPER} fill="url(#g-wing)" stroke="#3d6652" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M2 -1.5C7 -8 13 -12 18 -11M2 -0.5C8 -3 14 -4 19 -6" fill="none" stroke="#4f8068" strokeWidth="0.45" opacity="0.7" />
      <circle cx="15.6" cy="-11.4" r="1.5" fill="#f6f1d6" />
      <circle cx="12.4" cy="-14" r="1" fill="#f6f1d6" />
      <circle cx="10.6" cy="10" r="1.2" fill="#f6f1d6" />
    </>
  )
}

/** The farm's butterfly, and the friends who join it when the seedling is nearly in bloom. */
const Butterflies = memo(function Butterflies() {
  return (
    <>
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className={`butterfly${n ? ` butterfly--friend butterfly--friend-${n}` : ''}`} aria-hidden="true">
          <svg viewBox="-23 -23 46 46">
            {n === 0 && (
              <defs>
                <radialGradient id="g-wing" cx="0.1" cy="0.8" r="1">
                  <stop offset="0" stopColor="#dcecc6" />
                  <stop offset="0.62" stopColor="#9ccba0" />
                  <stop offset="1" stopColor="#5d9f86" />
                </radialGradient>
                <radialGradient id="g-wing-low" cx="0.1" cy="0.1" r="1">
                  <stop offset="0" stopColor="#e3efcd" />
                  <stop offset="1" stopColor="#7fb894" />
                </radialGradient>
              </defs>
            )}
            <g className="butterfly__wing">
              <g transform="scale(-1 1)">
                <Wing />
              </g>
            </g>
            <g className="butterfly__wing">
              <Wing />
            </g>
            <path d="M-0.7 -9.5Q-3 -14 -5.6 -15.6M0.7 -9.5Q3 -14 5.6 -15.6" fill="none" stroke="#2f4238" strokeWidth="0.7" strokeLinecap="round" />
            <ellipse cx="0" cy="0.6" rx="1.5" ry="7.6" fill="#2f4238" />
            <circle cx="0" cy="-8" r="1.9" fill="#2f4238" />
          </svg>
        </div>
      ))}
    </>
  )
})

const clockText = (h: number) => {
  const hh = Math.floor(h) % 24
  const mm = h % 1 ? '30' : '00'
  return `${hh % 12 || 12}:${mm} ${hh < 12 ? 'am' : 'pm'}`
}

export default function Farm() {
  const [view, setView] = useState(measure)
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState(0)
  const [raining, setRaining] = useState(false)
  const [hour, setHour] = useState(12)
  const root = useRef<HTMLElement>(null)
  const life = useRef<Life>(null)
  const viewRef = useRef(view)
  const spread = spreadFor(view.vis)
  const grown = GROWN[stage]

  // where things stand, in world units
  const treeX = 500 * spread
  const treeY = ridges.near(treeX) + 8
  const houseX = -330 * spread
  const houseY = ridges.mid(houseX) + 12
  const vaneX = houseX + 34 * 1.2
  const vaneY = houseY - 62 * 1.2
  const signK = 0.95 + 0.25 * ((spread - 0.6) / 0.4)
  const signX = Math.max(-view.vis / 2 + 46, -(300 * spread + 300))
  const signY = 838 + view.lift
  const spots = useMemo<Spots>(
    () => ({
      leaf: { x: 24 * grown, y: SPROUT_Y - 82 * grown },
      bud: { x: 1, y: SPROUT_Y - 99 * grown },
      vane: { x: vaneX + 2, y: vaneY - 34 },
      perches: [
        { x: 24 * grown, y: SPROUT_Y - 82 * grown },
        { x: signX + 130 * signK, y: signY - 248 * signK }, // the arm of the farm sign
        { x: 185 * spread + 14, y: BED_Y - 44 }, // the empty markers
        { x: -185 * spread + 14, y: BED_Y - 44 },
      ],
    }),
    [grown, vaneX, vaneY, signX, signY, signK, spread],
  )
  const spotsRef = useRef(spots)

  useEffect(() => {
    viewRef.current = view
    spotsRef.current = spots
  }, [view, spots])

  useEffect(() => {
    const onResize = () => setView(measure())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const find = <T extends Element = HTMLElement>(q: string) => el.querySelector<T>(q)!
    const fliers: Flier[] = [...el.querySelectorAll<HTMLElement>('.butterfly')].map((b) => {
      const wings = b.querySelectorAll<SVGElement>('.butterfly__wing')
      return { el: b, wings: [wings[0], wings[1]] }
    })
    const clock = new Date()
    let bloom = 0
    const started = startLife({
      root: el,
      sky: find('.sky'),
      grass: find<HTMLCanvasElement>('.grass'),
      fx: find<HTMLCanvasElement>('.fx'),
      sun: find('.sun'),
      moon: find('.moon'),
      handle: find('.time-handle'),
      rainbow: find('.rainbow'),
      fliers,
      getView: () => viewRef.current,
      getSpots: () => spotsRef.current,
      // the farm opens at the visitor's own time of day
      hour: clock.getHours() + clock.getMinutes() / 60,
      still: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      onGrow: (n) => {
        setStage(n)
        // nearly in bloom: the seedling shows its tag by itself
        if (n === 3) bloom = window.setTimeout(() => setOpen(true), 2200)
      },
      onWeather: setRaining,
      onHour: setHour,
    })
    life.current = started
    return () => {
      window.clearTimeout(bloom)
      started.stop()
    }
  }, [])

  // the tag closes when you touch anywhere else, or press Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest('.seedling, .tag')) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleTag = useCallback(() => {
    setOpen((was) => {
      // the butterfly comes to see what you found
      if (!was) life.current?.visit(spotsRef.current.leaf)
      return !was
    })
  }, [])
  const toggleRain = useCallback(() => life.current?.toggleRain(), [])

  const growing = PLOTS.find((p) => p.name)
  const sky = Math.max(0, Math.round(view.tall - H - view.lift))

  // the land's silhouette: cloud shadows and the hour's light fall only inside it
  const landClip = useMemo(() => {
    const box = H + view.lift + 12
    const pts: string[] = []
    for (let x = -HALF; x <= HALF; x += 12) {
      pts.push(`${(((x + HALF) / (HALF * 2)) * 100).toFixed(2)}% ${(((skyline(x) - 0.8) / box) * 100).toFixed(3)}%`)
    }
    return `polygon(${pts.join(',')},100% 100%,0 100%)`
  }, [view.lift])
  const overLand = { left: U(-HALF), top: 0, width: U(HALF * 2), height: U(H + view.lift + 12), clipPath: landClip }

  return (
    <main
      ref={root}
      className="farm"
      data-rain={raining || undefined}
      style={{ '--u': `${view.u.toFixed(4)}px`, '--lift': view.lift } as CSSProperties}
    >
      <h1 className="sr-only">Butterfly Farm Studio</h1>
      <p className="sr-only">
        A quiet painted farm: rolling hills, a cottage, a great tree, a hanging wooden sign, and a
        garden bed where a single seedling is growing while a green butterfly wanders by. The sun
        and moon can be moved to change the hour, the weathervane brings rain, and the seedling
        grows a little with rain and light.
      </p>

      <div className="sky" />
      <div className="deep" />
      <div className="world">
        <Stars />
        <div className="rainbow" />
        <div className="sun">
          <i />
        </div>
        <div className="moon">
          <i />
        </div>
        <Clouds vis={Math.round(view.vis)} spread={spread} sky={sky} onTap={toggleRain} />
        <Land spread={spread} />

        <div className="cloud-shadows" style={overLand}>
          <i style={{ top: '60%', animationDuration: '190s', animationDelay: '-40s' }} />
          <i style={{ top: '72%', animationDuration: '240s', animationDelay: '-150s' }} />
          <i style={{ top: '64%', animationDuration: '210s', animationDelay: '-115s' }} />
        </div>

        <div className="smoke" style={{ left: U(houseX + 19 * 1.2), top: U(houseY - 82 * 1.2) }}>
          <i />
          <i />
          <i />
          <i />
        </div>

        <svg
          className="vane"
          viewBox="-18 -36 36 38"
          style={{ left: U(vaneX - 18), top: U(vaneY - 36), width: U(36), height: U(38) }}
          aria-hidden="true"
        >
          <path d="M0 2V-28" stroke="#4f463c" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="0" cy="-30" r="2" fill="#4f463c" />
          <path d="M-6 -8H6M0 -14V-2" stroke="#4f463c" strokeWidth="1.1" strokeLinecap="round" />
          <g transform="translate(0 -21)">
            <path
              className="vane__arrow"
              d="M-14 0H9M9 -4.5L16 0L9 4.5ZM-14 0L-17 -5H-11L-8 0L-11 5H-17Z"
              fill="#4f463c"
              stroke="#4f463c"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </g>
        </svg>

        <Tree x={treeX} y={treeY} k={0.7 + 0.15 * spread} />

        {growing?.name && (
          <>
            <button
              type="button"
              className="seedling"
              data-farm-control
              aria-expanded={open}
              aria-controls="seedling-tag"
              aria-label={`A seedling. ${open ? 'Put its tag away' : 'Read its tag'}.`}
              onClick={toggleTag}
              style={{
                left: U(-52),
                top: U(SPROUT_Y - 128 * grown),
                width: U(104),
                height: U(22 + 128 * grown),
              }}
            />
            <Sprout stage={stage} />
            <div
              id="seedling-tag"
              className={`tag${open ? ' tag--open' : ''}`}
              data-farm-control
              aria-hidden={!open}
              style={{ left: U(1), top: U(SPROUT_Y - 118 * grown) }}
            >
              <div className="tag__card">
                {growing.kind && <p className="tag__kind">{growing.kind}</p>}
                <p className="tag__name">{growing.name}</p>
                <p className="tag__note">{(stage === 3 && growing.thanks) || growing.note}</p>
              </div>
            </div>
          </>
        )}

        <FarmSign x={signX} y={signY} k={signK} />

        {/* the hour's light, falling on the land */}
        <div className="veil" style={overLand} />

        {/* what glows after dark */}
        <div className="lamps">
          {[
            [8, -27, 11, 12],
            [30, -27, 11, 12],
            [-32.2, -45.2, 8.4, 8.4],
          ].map(([x, y, w, h], i) => (
            <i
              key={i}
              className={i === 2 ? 'lamp lamp--round' : 'lamp'}
              style={{ left: U(houseX + x * 1.2), top: U(houseY + y * 1.2), width: U(w * 1.2), height: U(h * 1.2) }}
            />
          ))}
          <i
            className="lamp"
            style={{
              left: U(signX + 222 * signK),
              top: U(signY - 219 * signK),
              width: U(12 * signK),
              height: U(15 * signK),
            }}
          />
          <i
            className="lamp-glow"
            style={{ left: U(signX + 228 * signK), top: U(signY - 208 * signK), '--r': U(170 * signK) } as CSSProperties}
          />
          <i className="lamp-glow lamp-glow--bud" style={{ left: U(1), top: U(SPROUT_Y - 99 * grown), '--r': U(46) } as CSSProperties} />
        </div>

        <Butterflies />

        <button
          type="button"
          className="vane-hit"
          data-farm-control
          aria-pressed={raining}
          aria-label={raining ? 'Weathervane. It is raining; let it clear.' : 'Weathervane. Bring a little rain.'}
          onClick={toggleRain}
          style={{ left: U(vaneX), top: U(vaneY - 18) }}
        />
        <div
          className="time-handle"
          data-farm-control
          role="slider"
          tabIndex={0}
          aria-label="Time of day. Drag the sun or moon across the sky, or use the arrow keys."
          aria-valuemin={0}
          aria-valuemax={24}
          aria-valuenow={hour}
          aria-valuetext={clockText(hour)}
        />
      </div>
      <canvas className="grass" aria-hidden="true" />
      <canvas className="fx" aria-hidden="true" />
      <div className="grain" />
    </main>
  )
}
