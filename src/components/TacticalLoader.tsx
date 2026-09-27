import { useEffect, useRef, useState, useId } from "react";

const LOGO_URL = "/logo.webp";

export interface TacticalLoaderProps {
  /**
   * Controlled loading flag.
   * While true (or omitted/default), the loader runs continuous ambient glowing and telemetry.
   * When switched to false, it seamlessly executes the exit wipe and calls onComplete.
   */
  isLoading?: boolean;
  /**
   * Optional callback fired once the exit wipe animation completes and the loader unmounts.
   */
  onComplete?: () => void;
  /**
   * Presentation variant:
   * - 'fullscreen': Full-screen fixed overlay with split-curtain iris reveal.
   * - 'page': Contained inside a page/card container.
   * - 'inline': Compact inline element.
   */
  variant?: "fullscreen" | "page" | "inline";
  /**
   * Primary technical status text. Defaults to "SYSTEM SYNCHRONIZING".
   */
  label?: string;
  /**
   * Secondary status description or coordinates.
   */
  subtext?: string;
  /**
   * Custom additional className.
   */
  className?: string;
}

// ── Circuit trace paths (viewBox 0 0 1261 1247 — matches logo aspect) ─────────
const circuits = [
  "M 639 118 L 639 1206",
  "M 402 391 L 402 561 L 625 782",
  "M 870 391 L 870 561 L 652 782",
  "M 144 635 L 302 797 L 510 978 L 510 1200",
  "M 1125 635 L 974 797 L 760 978 L 760 1200",
  "M 230 970 L 354 1081 L 510 1200",
  "M 1040 970 L 914 1081 L 760 1200",
];
const nodes: [number, number][] = [
  [639, 170], [402, 398], [870, 398], [144, 635],
  [1125, 635], [230, 970], [1040, 970],
];

const FRAGMENT_SEEDS = [
  ["0x4F2A", "0x91B3", "0x77E1", "0x3C09", "0xA8D4"],
  ["0x00FF", "0x6E12", "0xF204", "0x88BC", "0x19E0"],
  ["0x5B7C", "0x2A19", "0xDF41", "0x0982", "0xC3E7"],
  ["0x33A1", "0x8F90", "0x12EC", "0x7D5B", "0x4402"],
];

export function TacticalLoader({
  isLoading = true,
  onComplete,
  variant = "fullscreen",
  label = "SYSTEM SYNCHRONIZING",
  subtext = "TRANSMISSION IN PROGRESS // MEDI-CAPS CHAPTER",
  className = "",
}: TacticalLoaderProps) {
  const root = useRef<HTMLDivElement>(null);
  const mark = useRef<SVGSVGElement>(null);
  const fragments = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  const [exiting, setExiting] = useState(false);
  const isExitingRef = useRef(false);
  const maskId = useId().replace(/:/g, "-");

  onCompleteRef.current = onComplete;

  // Watch for isLoading transitioning to false to begin the exit wipe
  useEffect(() => {
    if (!isLoading && !isExitingRef.current) {
      isExitingRef.current = true;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        onCompleteRef.current?.();
        return undefined;
      }

      setExiting(true);
      const exitTimer = window.setTimeout(() => {
        onCompleteRef.current?.();
      }, 550);

      return () => {
        window.clearTimeout(exitTimer);
      };
    }
    return undefined;
  }, [isLoading]);

  // Continuous ambient loop for sparks & data fragments
  useEffect(() => {
    const host = root.current;
    const logo = mark.current;
    if (!host || !logo) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const paths = Array.from(logo.querySelectorAll<SVGPathElement>(".tactical-trace"));
    const sparks = Array.from(logo.querySelectorAll<SVGCircleElement>(".spark"));

    const lengths = paths.map((p) => {
      try {
        const len = p.getTotalLength();
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = "0";
        return len;
      } catch {
        return 500;
      }
    });

    let raf = 0;
    const start = performance.now();
    let lastFragmentTick = 0;

    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;

      // ── Animate traveling lime sparks along circuit paths in infinite loop ──
      sparks.forEach((spark, i) => {
        const pathIndex = ([0, 3, 4] as const)[i] ?? 0;
        const path = paths[pathIndex];
        const len = lengths[pathIndex];
        if (!path || len === undefined) return;

        // Speed staggered per spark
        const speed = 0.35 + i * 0.12;
        const offset = (elapsed * speed + i * 0.33) % 1;
        try {
          const pt = path.getPointAtLength(offset * len);
          spark.setAttribute("cx", String(pt.x));
          spark.setAttribute("cy", String(pt.y));
          spark.style.opacity = "1";
        } catch {
          spark.style.opacity = "0";
        }
      });

      // ── Ambient breathing drop-shadow pulse on the emblem ──────────────────
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.8);
      logo.style.filter = `drop-shadow(0 0 ${14 + 10 * pulse}px rgba(204,255,0,${0.5 + 0.35 * pulse})) drop-shadow(0 0 ${32 + 16 * pulse}px rgba(204,255,0,${0.2 + 0.2 * pulse}))`;

      // ── Cycling telemetry data fragments every ~120ms ─────────────────────
      if (now - lastFragmentTick > 120) {
        lastFragmentTick = now;
        const seedIndex = Math.floor(elapsed * 6) % FRAGMENT_SEEDS.length;
        const activeSeed = FRAGMENT_SEEDS[seedIndex] ?? FRAGMENT_SEEDS[0]!;
        fragments.current?.querySelectorAll("span").forEach((el, idx) => {
          el.textContent = activeSeed[idx] ?? "0x0000";
        });
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── INLINE / PAGE VARIANT ──────────────────────────────────────────────────
  if (variant === "page" || variant === "inline") {
    return (
      <div
        ref={root}
        className={`boot-page-container ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="boot-center" style={{ maxWidth: 360 }}>
          {/* Overline label */}
          <div className="boot-overline technical">
            <span className="pulse-square" />
            <span>{label}</span>
            <span className="boot-status-tag">BUSY</span>
          </div>

          {/* Logo SVG with glowing circuits */}
          <svg
            ref={mark}
            className="boot-mark boot-glow-emblem"
            viewBox="0 0 1261 1247"
            role="img"
            aria-label="Chaos Computer Club emblem glowing"
            style={{ width: "min(200px, 50vw)" }}
          >
            {/* Logo image base */}
            <image href={LOGO_URL} width="1261" height="1247" opacity="0.95" />

            {/* Glowing neon circuit traces */}
            <g fill="none" stroke="#CCFF00" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" opacity="0.75">
              {circuits.map((d, i) => (
                <path key={i} d={d} className="tactical-trace" />
              ))}
            </g>

            {/* Circuit node terminals */}
            <g fill="#CCFF00">
              {nodes.map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="28" />
              ))}
            </g>

            {/* Animated traveling sparks */}
            <g className="mark-sparks" fill="#CCFF00">
              <circle className="spark" r="16" opacity="0" />
              <circle className="spark" r="14" opacity="0" />
              <circle className="spark" r="14" opacity="0" />
            </g>
          </svg>

          {/* Data fragments stream */}
          <div ref={fragments} className="data-fragments technical">
            <span>0x4F2A</span>
            <span>0x91B3</span>
            <span>0x77E1</span>
            <span>0x3C09</span>
            <span>0xA8D4</span>
          </div>

          {subtext && (
            <div className="technical text-[10px] text-zinc-500 tracking-wider text-center mt-1">
              {subtext}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── FULLSCREEN VARIANT ─────────────────────────────────────────────────────
  return (
    <div
      ref={root}
      className={`boot-screen ${className}`}
      role="status"
      aria-label={`${label} — Please wait`}
      aria-live="polite"
      style={{
        pointerEvents: exiting ? "none" : "auto",
      }}
    >
      {/* Top curtain half — wipes up on exit */}
      <div
        className="boot-top"
        style={{
          transition: exiting ? "transform 0.45s cubic-bezier(0.65, 0, 0.35, 1), clip-path 0.45s cubic-bezier(0.65, 0, 0.35, 1)" : "none",
          transform: exiting ? "translateY(-100%)" : "translateY(0%)",
          clipPath: exiting ? "inset(0 0 100% 0)" : "inset(0 0 0 0)",
        }}
      />
      {/* Bottom curtain half — wipes down on exit */}
      <div
        className="boot-bottom"
        style={{
          transition: exiting ? "transform 0.45s cubic-bezier(0.65, 0, 0.35, 1), clip-path 0.45s cubic-bezier(0.65, 0, 0.35, 1)" : "none",
          transform: exiting ? "translateY(100%)" : "translateY(0%)",
          clipPath: exiting ? "inset(100% 0 0 0)" : "inset(0 0 0 0)",
        }}
      />

      {/* Main content wrapper */}
      <div
        className="boot-content"
        style={{
          transition: exiting ? "opacity 0.25s ease-out, transform 0.25s ease-out, filter 0.25s ease-out" : "none",
          opacity: exiting ? 0 : 1,
          transform: exiting ? "scale(1.05)" : "scale(1)",
          filter: exiting ? "blur(8px)" : "none",
        }}
      >
        {/* Header */}
        <div className="boot-head technical">
          <span>CCC / SYSTEM 001</span>
          <span>EST. 1981 — EVERYWHERE</span>
        </div>

        {/* Left telemetry pod (desktop) */}
        <div className="boot-side boot-side-left technical">
          <span>CHAOS PROTOCOL</span>
          <span>
            NODE 01 / <i className="boot-ok">ACTIVE</i><br />
            NODE 02 / <i className="boot-ok">ACTIVE</i><br />
            NODE 03 / <i className="boot-dim">STANDBY</i>
          </span>
        </div>

        {/* Right telemetry pod (desktop) */}
        <div className="boot-side boot-side-right technical">
          <span>SIGNAL DETECTED</span>
          <span className="boot-cyan">NETWORK STATUS: CONNECTED</span>
        </div>

        {/* Centre column */}
        <div className="boot-center">
          {/* Overline with status indicator (NO NUMERICAL PERCENTAGE) */}
          <div className="boot-overline technical">
            <span className="pulse-square" />
            <span>{label}</span>
            <span className="boot-status-tag">BUSY</span>
          </div>

          {/* Logo SVG with glowing circuits */}
          <svg
            ref={mark}
            className="boot-mark boot-glow-emblem"
            viewBox="0 0 1261 1247"
            role="img"
            aria-label="Chaos Computer Club emblem glowing"
          >
            {/* Full-color logo base */}
            <image href={LOGO_URL} width="1261" height="1247" opacity="0.92" />

            {/* Glowing neon circuit traces */}
            <g fill="none" stroke="#CCFF00" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
              {circuits.map((d, i) => (
                <path key={i} d={d} className="tactical-trace" />
              ))}
            </g>

            {/* Circuit node terminals */}
            <g fill="#CCFF00">
              {nodes.map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="34" />
              ))}
            </g>

            {/* Spark dots — travel along paths via getPointAtLength() */}
            <g className="mark-sparks" fill="#CCFF00">
              <circle className="spark" r="18" opacity="0" />
              <circle className="spark" r="16" opacity="0" />
              <circle className="spark" r="16" opacity="0" />
            </g>
          </svg>

          {/* Data fragments (NO 100% COUNTER) */}
          <div ref={fragments} className="data-fragments technical">
            <span>0x4F2A</span>
            <span>0x91B3</span>
            <span>0x77E1</span>
            <span>0x3C09</span>
            <span>0xA8D4</span>
          </div>

          {subtext && (
            <div className="technical text-[10px] text-zinc-500 tracking-wider text-center">
              {subtext}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="boot-foot technical">
          <span>TRANSMISSION IN PROGRESS</span>
          <span>DO NOT PANIC.</span>
          <span className="boot-cyan">51° 22′ 45″ N / 12° 22′ 26″ E</span>
        </div>
      </div>
    </div>
  );
}

export default TacticalLoader;
