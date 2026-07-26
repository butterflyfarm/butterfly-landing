import './App.css'

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span className="wing wing--left" />
      <span className="wing wing--right" />
      <span className="brand-mark__body" />
    </span>
  )
}

function Arrow() {
  return (
    <span className="arrow" aria-hidden="true">
      ↗
    </span>
  )
}

function App() {
  const year = new Date().getFullYear()

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="nav-wrap">
        <nav className="nav container" aria-label="Main navigation">
          <a className="brand" href="#top" aria-label="Butterfly Farm Studio, home">
            <BrandMark />
            <span>Butterfly Farm</span>
          </a>

          <div className="nav-links">
            <a href="#growing">What’s next</a>
            <a href="mailto:hello@butterfly.farm">Email us <Arrow /></a>
          </div>
        </nav>
      </header>

      <main id="main">
        <section className="hero container" id="top" aria-labelledby="hero-title">
          <div className="hero__eyebrow reveal reveal--one">
            <span className="pulse-dot" />
            Independent software studio
          </div>

          <div className="hero__copy">
            <h1 className="reveal reveal--two" id="hero-title">
              We make thoughtful
              <br />
              <em>mobile experiences.</em>
            </h1>
            <p className="hero__intro reveal reveal--three">
              Butterfly Farm Studio designs and builds useful software for
              everyday life.
            </p>
          </div>

          <div className="hero__footer reveal reveal--four">
            <a className="text-link" href="#growing">
              Something is growing <span aria-hidden="true">↓</span>
            </a>
            <a href="mailto:hello@butterfly.farm">hello@butterfly.farm</a>
          </div>
        </section>

        <section className="growing-section" id="growing" aria-labelledby="growing-title">
          <div className="growing container">
            <div className="growing__copy">
              <p className="kicker">Coming soon</p>
              <h2 id="growing-title">
                Something is
                <br />
                <em>growing.</em>
              </h2>
              <p className="growing__body">
                A new mobile app is taking shape. We’re keeping the details
                close for now.
              </p>
              <a className="outline-link" href="mailto:hello@butterfly.farm?subject=Keep%20me%20in%20the%20loop">
                Keep me in the loop
                <Arrow />
              </a>
            </div>

            <div className="growth-visual" aria-label="A seed becoming a new shoot">
              <div className="growth-visual__top">
                <span>BF — 001</span>
                <span>In progress</span>
              </div>
              <div className="growth-visual__stage" aria-hidden="true">
                <span className="soil-line" />
                <span className="stem" />
                <span className="leaf leaf--left" />
                <span className="leaf leaf--right" />
                <span className="seed" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <a className="brand brand--footer" href="#top">
            <BrandMark />
            <span>Butterfly Farm Studio</span>
          </a>
          <p>
            © {year} Butterfly Farm Studio Limited. Made with love.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
