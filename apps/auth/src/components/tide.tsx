import { useEffect, useRef } from "react";

/**
 * A live water surface: domain-warped fBm noise sharpened into caustic ridges,
 * drifting slowly. It fills the inset panel beside the form.
 *
 * `calm` is the radius, in uv space, inside which the water is quieted — useful
 * when content sits over it. A negative value means no calm at all, which is what
 * the panel wants: alive edge to edge.
 *
 * Colours come from CSS custom properties as plain RGB triples, so the theme —
 * not this file — decides what the water is made of.
 *
 * ponytail: single full-screen triangle, one draw call, DPR capped at 1.5. If
 * this ever shows up in a profile, drop to a half-resolution buffer and upscale.
 */

const VERTEX = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uBase;
uniform vec3 uLight;
uniform float uCalm;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i), f), dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = uv;
  p.x *= uResolution.x / uResolution.y;

  float t = uTime * 0.05;

  // Two rounds of domain warping give the surface its folded, liquid structure.
  vec2 q = vec2(fbm(p * 1.9 + t), fbm(p * 1.9 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(
    fbm(p * 1.9 + 2.6 * q + vec2(1.7, 9.2) + t * 0.62),
    fbm(p * 1.9 + 2.6 * q + vec2(8.3, 2.8) - t * 0.44)
  );
  float f = fbm(p * 1.9 + 2.6 * r);

  // Sharpen the level sets into caustic lines.
  float caustic = 1.0 - abs(sin(f * 6.2831 + t * 1.6));
  caustic = pow(caustic, 3.4);

  // Calm where the form is; alive toward the edges.
  float d = distance(uv, vec2(0.5, 0.5));
  float mask = smoothstep(uCalm, uCalm + 0.42, d);

  float intensity = caustic * mask * 0.85 + (f + 0.5) * 0.1 * mask;
  gl_FragColor = vec4(mix(uBase, uLight, clamp(intensity, 0.0, 1.0)), 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[tide] shader failed:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function readRgb(
  styles: CSSStyleDeclaration,
  name: string,
): [number, number, number] {
  const parts = styles
    .getPropertyValue(name)
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return [0.5, 0.5, 0.5];
  return [parts[0]! / 255, parts[1]! / 255, parts[2]! / 255];
}

export function Tide({ calm, theme }: { calm: number; theme: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) return; // The CSS gradient underneath stays visible.

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return;

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("[tide] link failed:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // One triangle large enough to cover the clip volume — no quad, no indices.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uBase = gl.getUniformLocation(program, "uBase");
    const uLight = gl.getUniformLocation(program, "uLight");
    const uCalm = gl.getUniformLocation(program, "uCalm");

    const styles = getComputedStyle(canvas);
    gl.uniform3fv(uBase, readRgb(styles, "--tide-base"));
    gl.uniform3fv(uLight, readRgb(styles, "--tide-light"));

    // Tracked per-effect, never read back off the canvas: a remount builds a new
    // program whose uniforms are zero while the canvas keeps its old dimensions,
    // and a guard that trusted canvas.width would skip setting them.
    let lastWidth = -1;
    let lastHeight = -1;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.round(canvas.clientWidth * dpr);
      const height = Math.round(canvas.clientHeight * dpr);
      // The panel is display:none below lg, so the canvas measures 0. Rendering
      // into a zero-sized drawing buffer burns frames and stalls the compositor.
      if (width === 0 || height === 0) return;
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uResolution, width, height);
      gl.uniform1f(uCalm, calm);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let start = performance.now();

    const draw = (time: number) => {
      gl.uniform1f(uTime, (time - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (time: number) => {
      if (gl.isContextLost() || !visible()) {
        frame = 0;
        return;
      }
      draw(time);
      frame = requestAnimationFrame(loop);
    };

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const visible = () => canvas.clientWidth > 0 && canvas.clientHeight > 0;

    const play = () => {
      if (frame || reduced.matches || document.hidden || !visible()) return;
      start = performance.now() - 8000; // Begin mid-tide, never from a flat field.
      frame = requestAnimationFrame(loop);
    };

    // A driver can drop the context at any time; take it back when it returns.
    const onRestored = () => window.location.reload();
    canvas.addEventListener("webglcontextrestored", onRestored);

    resize();
    // Reduced motion still gets the water — one frozen frame of it.
    if (reduced.matches) draw(performance.now() + 8000);
    else play();

    const observer = new ResizeObserver(() => {
      // A driver can drop the context at any time; take it back when it returns.
      const onRestored = () => window.location.reload();
      canvas.addEventListener("webglcontextrestored", onRestored);

      resize();
      if (reduced.matches) draw(performance.now() + 8000);
    });
    observer.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : play());
    document.addEventListener("visibilitychange", onVisibility);

    const onReducedChange = () => {
      stop();
      if (reduced.matches) draw(performance.now() + 8000);
      else play();
    };
    reduced.addEventListener("change", onReducedChange);

    // The context deliberately outlives this effect: getContext() hands back the
    // same object for a given canvas, so losing it here would kill the surface
    // for the remount that follows (StrictMode, fast refresh, a theme change).
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onReducedChange);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [calm, theme]);

  return (
    <canvas
      aria-hidden="true"
      className="tide inset-0 pointer-events-none absolute h-full w-full rounded-2xl"
      ref={canvasRef}
    />
  );
}
