import { useEffect, useRef } from "react";

// greyscale surfaces inspired by the ascii.rest
// planet scale piece by @bas3line


const SCALE = " ·•●"; // halftone palette

export function PlanetScale() {
  const preRef = useRef(null);

  useEffect(() => {
    const el = preRef.current;
    if (!el) return;

    let frame = 0;
    let rafId;
    let lastTime = 0;
    const FPS = 24; // smooth yet super light on CPU

    const render = (now) => {
      rafId = requestAnimationFrame(render);
      if (now - lastTime < 1000 / FPS) return;
      lastTime = now;

      // Adapt character grid to viewport size
      const cols = Math.max(60, Math.floor(window.innerWidth / 8.5));
      const rows = Math.max(24, Math.floor(window.innerHeight / 15));
      const aspect = 0.52; // monospace characters are ~2x taller than wide

      const cx = cols * 0.5;
      const cy = rows * 0.55;
      const R = Math.min(cols * aspect, rows) * 0.36;

      // Orbiting moon coordinates (3D ellipse around the planet)
      const angle = frame * 0.025;
      const orbitX = R * 1.65;
      const orbitY = R * 0.38;
      const moonX = cx + (Math.cos(angle) * orbitX) / aspect;
      const moonY = cy + Math.sin(angle) * orbitY;
      const moonZ = Math.sin(angle); // > 0 means in front of planet, < 0 behind
      const moonR = R * 0.14;

      let out = "";

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const dx = (x - cx) * aspect;
          const dy = y - cy;
          const dist = Math.hypot(dx, dy);

          // Moon distance
          const mdx = (x - moonX) * aspect;
          const mdy = y - moonY;
          const mDist = Math.hypot(mdx, mdy);

          let shade = 0; // 0 = empty space, 1 = '·', 2 = '•', 3 = '●'

          // 1. Subtle drifting starfield in background
          const starHash = Math.sin((x + Math.floor(frame * 0.04)) * 12.9898 + y * 78.233) * 43758.5453;
          if ((starHash - Math.floor(starHash)) > 0.996) {
            shade = 1;
          }

          // 2. Backlit corona glow just outside the planet's rim
          if (dist >= R && dist < R * 1.16) {
            const halo = 1 - (dist - R) / (R * 0.16);
            if (halo > 0.65) shade = 2;
            else if (halo > 0.25) shade = Math.max(shade, 1);
          }

          // 3. Planet body (dark interior with bright rim & two glowing chasms)
          const onPlanet = dist < R;
          if (onPlanet) {
            const edge = dist / R; // 0 at center, 1 at rim
            // Rotate surface coordinates slowly
            const rot = frame * 0.008;
            const sx = (dx * Math.cos(rot) - dy * Math.sin(rot)) / R;
            const sy = (dx * Math.sin(rot) + dy * Math.cos(rot)) / R;

            // Two jagged chasms cutting across the planet
            const chasm1 = Math.abs(sx + sy * 0.55 - 0.18 + Math.sin(sy * 5) * 0.05);
            const chasm2 = Math.abs(sx - sy * 0.7 + 0.28 + Math.cos(sx * 4) * 0.04);

            if (chasm1 < 0.045 || chasm2 < 0.038) {
              // Glowing chasm core
              shade = chasm1 < 0.02 || chasm2 < 0.018 ? 3 : 2;
            } else if (edge > 0.93) {
              // Crisp backlit limb
              shade = 3;
            } else if (edge > 0.84) {
              shade = 2;
            } else if (edge > 0.72) {
              shade = 1;
            } else {
              // Dark silhouette interior
              shade = 0;
            }
          }

          // 4. Moon (drawn over planet when in front, or when not occluded behind it)
          if (mDist < moonR && (moonZ > 0 || !onPlanet)) {
            const mEdge = mDist / moonR;
            // Crescent lighting from the backlit center
            const lit = (mdx / moonR) * (cx - moonX > 0 ? 1 : -1);
            if (lit > 0.25 || mEdge > 0.82) shade = 3;
            else if (lit > -0.2) shade = 2;
            else shade = 1;
          }

          out += SCALE[shade];
        }
        out += "\n";
      }

      el.textContent = out;
      frame++;
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return <pre ref={preRef} className="ascii-bg" aria-hidden="true" />;
}