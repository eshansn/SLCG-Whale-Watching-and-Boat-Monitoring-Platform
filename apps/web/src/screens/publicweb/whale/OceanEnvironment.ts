/** Viewport sizing and a static Home fallback; no section/progress/navigation data. */
export function measureOceanEnvironment(site: HTMLElement) {
  const width = site.clientWidth, height = window.innerHeight;
  const siteBounds = site.getBoundingClientRect();
  const headingTop = site.querySelector('#home h1')!.getBoundingClientRect().top - siteBounds.top;
  const size = Math.min(width < 768 ? width * .82 : Math.min(640, width * .48),
    Math.max(160, (headingTop - 144) * 2));
  return { width, height, fallback: { x: width * .56, y: (112 + headingTop) / 2, size } };
}
