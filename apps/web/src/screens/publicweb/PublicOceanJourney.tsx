import { useEffect, useRef } from 'react';
import { OceanWhale } from '../../components/auth/OceanScene';
import { measureOceanEnvironment } from './whale/OceanEnvironment';
import type { OceanSceneHandle } from './whale/OceanWhaleScene';
import '../../components/auth/ocean-auth.css';
import './public-ocean.css';

export default function PublicOceanJourney() {
  const layerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current, stage = stageRef.current, fallback = fallbackRef.current;
    const site = layer?.parentElement;
    if (!layer || !stage || !fallback || !site) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false, generation = 0, scene: OceanSceneHandle | null = null;
    const placeFallback = () => {
      const { x, y, size } = measureOceanEnvironment(site).fallback;
      fallback.style.width = `${size}px`;
      fallback.style.left = `${x}px`; fallback.style.top = `${y}px`;
    };
    const unavailable = () => {
      scene?.dispose(); scene = null;
      layer.dataset.renderer = 'fallback'; layer.dataset.active = 'false'; placeFallback();
    };
    const configure = async () => {
      const current = ++generation;
      scene?.dispose(); scene = null;
      layer.dataset.active = 'false';
      placeFallback();
      if (reduced.matches) { layer.dataset.renderer = 'reduced'; return; }
      layer.dataset.renderer = 'pending';
      try {
        const { createOceanWhaleScene } = await import('./whale/OceanWhaleScene');
        if (disposed || generation !== current) return;
        scene = createOceanWhaleScene(stage, site, unavailable);
        if (scene) layer.dataset.renderer = 'webgl'; else unavailable();
      } catch { if (!disposed && generation === current) unavailable(); }
    };
    // Read-only diagnostics expose real geometry and simulation state for visual tests.
    Object.defineProperty(layer, 'oceanSnapshot', { configurable: true,
      value: () => scene?.snapshot() ?? { renderer: layer.dataset.renderer, disposed } });
    const observer = new ResizeObserver(placeFallback);
    observer.observe(site);
    window.addEventListener('resize', placeFallback);
    reduced.addEventListener('change', configure);
    void document.fonts.ready.then(() => { if (!disposed) placeFallback(); });
    void configure();
    return () => {
      disposed = true; generation++; scene?.dispose(); scene = null;
      observer.disconnect(); window.removeEventListener('resize', placeFallback);
      reduced.removeEventListener('change', configure);
      delete (layer as HTMLDivElement & { oceanSnapshot?: unknown }).oceanSnapshot;
    };
  }, []);

  return <div ref={layerRef} className="public-ocean-journey" aria-hidden="true" data-renderer="pending" data-active="false">
    <div className="public-ocean-atmosphere"><div className="public-ocean-rays" /></div>
    <div ref={stageRef} className="public-ocean-stage" />
    <div ref={fallbackRef} className="public-ocean-fallback"><OceanWhale /></div>
  </div>;
}
