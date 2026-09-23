import { FC, useEffect, useRef, useState } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';
import './LightRays.css';

export type RaysOrigin =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface LightRaysProps {
  raysOrigin?: RaysOrigin;
  raysColor?: string;
  raysSpeed?: number;
  lightSpread?: number;
  rayLength?: number;
  pulsating?: boolean;
  fadeDistance?: number;
  saturation?: number;
  followMouse?: boolean;
  mouseInfluence?: number;
  noiseAmount?: number;
  distortion?: number;
  lightMode?: boolean;
  className?: string;
}

const DEFAULT_COLOR = '#CBFF00';

const hexToRgb = (hex: string): [number, number, number] => {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m
    ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
    : [0.796, 1.0, 0.0];
};

const getAnchorAndDir = (
  origin: RaysOrigin,
  w: number,
  h: number
): { anchor: [number, number]; dir: [number, number] } => {
  const outside = 0.2;
  switch (origin) {
    case 'top-left':
      return { anchor: [0, -outside * h], dir: [0, 1] };
    case 'top-right':
      return { anchor: [w, -outside * h], dir: [0, 1] };
    case 'left':
      return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
    case 'center':
      return { anchor: [0.5 * w, 0.5 * h], dir: [0, 1] };
    case 'right':
      return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
    case 'bottom-left':
      return { anchor: [0, (1 + outside) * h], dir: [0, -1] };
    case 'bottom-center':
      return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
    case 'bottom-right':
      return { anchor: [w, (1 + outside) * h], dir: [0, -1] };
    default: // "top-center"
      return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
  }
};

export const LightRays: FC<LightRaysProps> = ({
  raysOrigin = 'top-center',
  raysColor = DEFAULT_COLOR,
  raysSpeed = 1,
  lightSpread = 1,
  rayLength = 2,
  pulsating = false,
  fadeDistance = 1.0,
  saturation = 1.0,
  followMouse = false,
  mouseInfluence = 0,
  noiseAmount = 0.0,
  distortion = 0.0,
  lightMode = false,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uniformsRef = useRef<any>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });
  const [isVisible, setIsVisible] = useState(false);

  // 1. Intersection Observer to halt rendering when off-screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        setIsVisible(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  // 2. WebGL Lifecycle: Uses React-managed canvas ref (ZERO appendChild/removeChild)
  useEffect(() => {
    if (!isVisible || !containerRef.current || !canvasRef.current) return;

    let isMounted = true;
    let animationId: number | null = null;
    let renderer: Renderer | null = null;
    const container = containerRef.current;
    const canvas = canvasRef.current;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    try {
      renderer = new Renderer({
        canvas,
        dpr: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2),
        alpha: true,
        powerPreference: 'low-power'
      });
    } catch (err) {
      console.warn('WebGL init skipped:', err);
      return;
    }

    rendererRef.current = renderer;
    const gl = renderer.gl;
    if (!gl) return;

    const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

    const frag = `precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;
uniform float lightMode;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  
  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  
  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
                           1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
                           1.1 * raysSpeed);

  fragColor = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;

  if (lightColor(raysColor) > 0.0) {
    fragColor.rgb *= raysColor;
  }

  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }

  float alpha = clamp(fragColor.a, 0.0, 1.0);
  if (lightMode > 0.5) {
    fragColor.rgb = 1.0 - fragColor.rgb;
    fragColor.a = alpha;
  } else {
    fragColor.a = (fragColor.r + fragColor.g + fragColor.b) / 3.0;
  }
}

bool lightColor(vec3 color) {
  return (color.r + color.g + color.b) > 0.0;
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}`;

    const geometry = new Triangle(gl);
    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [canvas.width, canvas.height] },
      rayPos: { value: [0, 0] },
      rayDir: { value: [0, 1] },
      raysColor: { value: hexToRgb(raysColor) },
      raysSpeed: { value: raysSpeed },
      lightSpread: { value: lightSpread },
      rayLength: { value: rayLength },
      pulsating: { value: pulsating ? 1.0 : 0.0 },
      fadeDistance: { value: fadeDistance },
      saturation: { value: saturation },
      mousePos: { value: [0.5, 0.5] },
      mouseInfluence: { value: mouseInfluence },
      noiseAmount: { value: noiseAmount },
      distortion: { value: distortion },
      lightMode: { value: lightMode ? 1.0 : 0.0 }
    };
    uniformsRef.current = uniforms;

    const program = new Program(gl, {
      vertex: vert,
      fragment: frag,
      uniforms
    });

    const mesh = new Mesh(gl, { geometry, program });
    meshRef.current = mesh;

    const updatePlacement = () => {
      if (!container || !renderer || !isMounted) return;
      const wCSS = container.clientWidth || 300;
      const hCSS = container.clientHeight || 300;
      renderer.setSize(wCSS, hCSS);
      uniforms.iResolution.value = [canvas.width, canvas.height];
      const dpr = renderer.dpr;
      const { anchor, dir } = getAnchorAndDir(raysOrigin, wCSS * dpr, hCSS * dpr);
      uniforms.rayPos.value = anchor;
      uniforms.rayDir.value = dir;
    };

    updatePlacement();
    window.addEventListener('resize', updatePlacement, { passive: true });

    if (prefersReducedMotion) {
      try {
        renderer.render({ scene: mesh });
      } catch {}
    } else {
      const loop = (t: number) => {
        if (!isMounted) return;
        try {
          uniforms.iTime.value = t * 0.001;
          if (mouseInfluence > 0) {
            const sm = smoothMouseRef.current;
            const m = mouseRef.current;
            sm.x += (m.x - sm.x) * 0.05;
            sm.y += (m.y - sm.y) * 0.05;
            uniforms.mousePos.value = [sm.x, sm.y];
          }
          renderer?.render({ scene: mesh });
          animationId = requestAnimationFrame(loop);
        } catch {
          // ignore render error on teardown
        }
      };
      animationId = requestAnimationFrame(loop);
    }

    return () => {
      isMounted = false;
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      window.removeEventListener('resize', updatePlacement);
      if (renderer) {
        try {
          const loseContext = renderer.gl?.getExtension('WEBGL_lose_context');
          if (loseContext) loseContext.loseContext();
        } catch {}
      }
      rendererRef.current = null;
      uniformsRef.current = null;
      meshRef.current = null;
    };
  }, [isVisible]);

  // 3. Dynamic Uniform Updates without tearing down WebGL
  useEffect(() => {
    const u = uniformsRef.current;
    const r = rendererRef.current;
    const c = containerRef.current;
    if (!u || !r || !c) return;

    u.raysColor.value = hexToRgb(raysColor);
    u.raysSpeed.value = raysSpeed;
    u.lightSpread.value = lightSpread;
    u.rayLength.value = rayLength;
    u.pulsating.value = pulsating ? 1.0 : 0.0;
    u.fadeDistance.value = fadeDistance;
    u.saturation.value = saturation;
    u.mouseInfluence.value = mouseInfluence;
    u.noiseAmount.value = noiseAmount;
    u.distortion.value = distortion;
    u.lightMode.value = lightMode ? 1.0 : 0.0;

    const wCSS = c.clientWidth || 300;
    const hCSS = c.clientHeight || 300;
    const dpr = r.dpr;
    const { anchor, dir } = getAnchorAndDir(raysOrigin, wCSS * dpr, hCSS * dpr);
    u.rayPos.value = anchor;
    u.rayDir.value = dir;
  }, [
    raysColor,
    raysSpeed,
    lightSpread,
    raysOrigin,
    rayLength,
    pulsating,
    fadeDistance,
    saturation,
    mouseInfluence,
    noiseAmount,
    distortion,
    lightMode
  ]);

  // 4. Mouse Move Listener: Only attached if followMouse=true AND mouseInfluence > 0
  useEffect(() => {
    if (!followMouse || mouseInfluence <= 0) return;

    let rafId: number | null = null;
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const c = containerRef.current;
        if (!c) return;
        const rect = c.getBoundingClientRect();
        const x = (e.clientX - rect.left) / (rect.width || 1);
        const y = (e.clientY - rect.top) / (rect.height || 1);
        mouseRef.current = { x, y };
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [followMouse, mouseInfluence]);

  return (
    <div ref={containerRef} className={`light-rays-container ${className}`.trim()}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
};

export default LightRays;
