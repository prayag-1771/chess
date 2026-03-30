import Link from 'next/link'
import { HeroScene3D } from '@/components/3d/HeroScene3D'

export default function Home() {
  return (
    <main className="landing-root">
      <section className="hero-section">
        <div className="hero-canvas">
          <HeroScene3D />
        </div>

        <div className="hero-copy">
          <div className="hero-badge">
            <span className="badge-dot" />
            Live multiplayer · Real-time
          </div>

          <h1 className="hero-heading">
            Play Chess<br />
            <span className="hero-heading-accent">in 3D</span>
          </h1>

          <p className="hero-subheading">
            Experience the classic game like never before.<br />
            Beautifully rendered, silky smooth, and always free.
          </p>

          <div className="hero-actions">
            <Link href="/game" id="btn-play-now" className="btn-primary">
              ▶&nbsp; Play Now
            </Link>
            <a href="#features" className="btn-secondary">Learn More ↓</a>
          </div>

          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-value">3D</span>
              <span className="stat-label">Rendered board</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-value">Live</span>
              <span className="stat-label">Multiplayer</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-value">Free</span>
              <span className="stat-label">Always</span>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features-section">
        {[
          { icon: '♟', title: '3D Pieces', desc: 'Hand-crafted piece geometries with realistic materials and shadow casting.' },
          { icon: '🌐', title: 'Real-time Play', desc: 'WebSocket-powered matchmaking for instant online games against real players.' },
          { icon: '✨', title: 'Smooth Animations', desc: 'Pieces glide across the board with arc animations and hover effects.' },
        ].map((f) => (
          <div key={f.title} className="feature-card">
            <div className="feature-icon">{f.icon}</div>
            <h3 className="feature-title">{f.title}</h3>
            <p className="feature-desc">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
