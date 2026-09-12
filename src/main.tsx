import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { resolveLayout } from './engine/resolver';
import { adSpec, surfaces } from './demo/spec';
import type { ResolvedElement } from './engine/types';

function App() {
  const [surfaceId, setSurfaceId] = useState(surfaces[0].id);
  const [ctaClicked, setCtaClicked] = useState(false);
  const surface = surfaces.find(item => item.id === surfaceId) ?? surfaces[0];

  const handleSurfaceChange = (id: string) => {
    setSurfaceId(id);
    setCtaClicked(false);
  };
  const layout = useMemo(() => resolveLayout(adSpec, surface), [surface]);

  const scale = Math.min(900 / surface.width, 560 / surface.height, 1);
  const canvasWidth = surface.width * scale;
  const canvasHeight = surface.height * scale;

  return (
    <main className="app">
      <header className="header">
        <div>
          <p className="eyebrow">FLAM SDE Assignment</p>
          <h1>Adaptive Layout Engine</h1>
          <p className="subtitle">One declarative ad spec → constraint-resolved layouts across multiple surfaces.</p>
        </div>
        <div className={layout.report.feasible ? 'status good' : 'status warn'}>
          {layout.report.feasible ? '✓ Feasible' : '⚠ Constrained'}
        </div>
      </header>

      <section className="surface-tabs">
        {surfaces.map(item => (
          <button
            key={item.id}
            className={item.id === surface.id ? 'tab active' : 'tab'}
            onClick={() => handleSurfaceChange(item.id)}
          >
            <strong>{item.name}</strong>
            <span>{item.width} × {item.height}</span>
          </button>
        ))}
      </section>

      <section className="workspace">
        <div className="preview-card">
          <div className="preview-header">
            <span>Resolved output</span>
            <span>{surface.input} · {surface.minTextSize}px min text · constraints visible in report</span>
          </div>

          <div className="canvas-wrap">
            <div
              className="ad-canvas"
              style={{
                width: canvasWidth,
                height: canvasHeight,
                background: adSpec.background,
              }}
            >
              {layout.elements.map(element => (
                <AdItem key={element.id} element={element} scale={scale} onCtaClick={() => setCtaClicked(true)} ctaClicked={ctaClicked} />
              ))}
            </div>
          </div>
        </div>

        <aside className="report-card">
          {ctaClicked && <div className="cta-success" role="status">✓ Buy now clicked — demo action triggered.</div>}
          <h2>Resolution report</h2>
          <div className="constraint-summary">
            <span>Safe area {surface.safeArea.left}px</span>
            <span>Min text {surface.minTextSize}px</span>
            {surface.minTapTarget > 0 && <span>Min tap {surface.minTapTarget}px</span>}
            {surface.maxElements && <span>Max elements {surface.maxElements}</span>}
          </div>
          <div className="metric">
            <span>Visible elements</span>
            <strong>{layout.elements.length}</strong>
          </div>
          <div className="metric">
            <span>Dropped</span>
            <strong>{layout.report.dropped.length}</strong>
          </div>
          <div className="metric">
            <span>Truncated</span>
            <strong>{layout.report.truncated.length}</strong>
          </div>

          <h3>Why this layout?</h3>
          <p>Hard constraints are enforced first. When space runs out, lower-priority optional content is removed or shortened before headline and CTA.</p>

          {layout.report.decisions.length > 0 ? (
            <div className="decision-list">
              {layout.report.decisions.map((decision) => (
                <div className={`decision ${decision.action}`} key={`${decision.action}-${decision.elementId}`}>
                  <div className="decision-top">
                    <span className="decision-badge">{decision.action === 'dropped' ? 'DROP' : 'TRUNCATE'}</span>
                    <strong>{decision.elementId}</strong>
                    <span className="decision-priority">P{decision.priority}</span>
                  </div>
                  <p>{decision.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-degradation">✓ No degradation required on this surface.</div>
          )}

          {layout.report.dropped.length > 0 && (
            <>
              <h3>Degraded elements</h3>
              <div className="chips">
                {layout.report.dropped.map(id => <span key={id} className="chip">{id} dropped</span>)}
                {layout.report.truncated.map(id => <span key={id} className="chip">{id} truncated</span>)}
              </div>
            </>
          )}

          {layout.report.warnings.length > 0 && (
            <>
              <h3>Warnings</h3>
              {layout.report.warnings.map((warning, i) => <p className="warning" key={i}>{warning}</p>)}
            </>
          )}
        </aside>
      </section>

      <section className="legend">
        {layout.elements.map(e => (
          <div className="legend-item" key={e.id}>
            <span className="dot" />
            <span>{e.id}</span>
            <small>priority {e.priority}</small>
          </div>
        ))}
      </section>
    </main>
  );
}

function AdItem({ element, scale, onCtaClick, ctaClicked }: { element: ResolvedElement; scale: number; onCtaClick: () => void; ctaClicked: boolean }) {
  const { rect } = element;
  const style = {
    left: rect.x * scale,
    top: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
    fontSize: element.fontSize * scale,
  };

  if (element.role === 'image') {
    return <div className="ad-item hero" style={style}><div className="phone">NOVA<br /><span>X</span></div></div>;
  }

  if (element.role === 'brand') {
    return <div className="ad-item brand" style={style}>{element.content}</div>;
  }

  if (element.role === 'cta') {
    return (
      <button
        type="button"
        className="ad-item cta"
        style={style}
        onClick={onCtaClick}
        aria-label={element.content}
      >
        {ctaClicked ? '✓ Added' : element.content}
      </button>
    );
  }

  return (
    <div className={`ad-item text ${element.role}`} style={style}>
      {element.truncated ? `${element.content.slice(0, 24)}…` : element.content}
    </div>
  );
}

export default App;


const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root was not found.');
}
createRoot(root).render(<App />);
