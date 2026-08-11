/* Well Destination Foundations — living atmosphere over the hero photograph.
   A WebGL mist-and-light pass composited onto the real Pitons image with
   mix-blend-mode: screen (black = invisible, light = added). Morning mist
   drifts across the water and a soft gold shimmer breathes on the surface;
   scrolling clears the mist via the uSun uniform (0 = misted dawn,
   1 = clear morning). Fully procedural, no assets, pointer parallax.
   Reduced-motion users get a single still frame; no WebGL = photo only. */
(function () {
  'use strict';

  var canvas = document.getElementById('hero-sky');
  if (!canvas) return;
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { canvas.remove(); return; }

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform vec2 uPar;',
    'uniform float uSun;', /* 0 = misted dawn, 1 = clear morning */

    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float noise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }',
    '  return v;',
    '}',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  float aspect = uRes.x / uRes.y;',
    '  float t = uTime * 0.045;',
    '  float clear = smoothstep(0.0, 1.0, uSun);',
    '  vec3 col = vec3(0.0);',

    /* ── Morning mist: two drifting layers, hugging the water band ── */
    '  vec2 pm = uv + uPar * 0.02;',
    '  float m1 = fbm(vec2(pm.x * 2.6 - t, pm.y * 6.0));',
    '  float m2 = fbm(vec2(pm.x * 4.2 + t * 0.6, pm.y * 9.0) + 4.7);',
    /* water band sits in the lower-middle of the cover image */
    '  float band = exp(-pow((uv.y - 0.30) * 3.4, 2.0)) * 0.85',
    '             + exp(-pow((uv.y - 0.52) * 5.0, 2.0)) * 0.55;',
    '  float mist = (m1 * 0.65 + m2 * 0.45) * band;',
    '  float mistAmt = mix(0.50, 0.07, clear);',
    /* pale warm-grey mist, brightened faintly by the morning */
    '  col += vec3(0.86, 0.88, 0.86) * mist * mistAmt;',

    /* ── Gold shimmer breathing on the water as the light arrives ── */
    '  float streak = fbm(vec2(uv.x * 30.0, uv.y * 130.0 + t * 2.4));',
    '  float waterBand = exp(-pow((uv.y - 0.24) * 4.2, 2.0));',
    '  float sparkle = smoothstep(0.62, 0.92, streak) * waterBand;',
    '  col += vec3(0.851, 0.627, 0.235) * sparkle * mix(0.05, 0.30, clear);',

    /* ── A soft sun-warmth blooming from the upper right sky ── */
    '  vec2 sunPos = vec2(0.62 + uPar.x * 0.01, 0.78);',
    '  float sd = distance(vec2(uv.x * aspect, uv.y), vec2(sunPos.x * aspect, sunPos.y));',
    '  col += vec3(0.851, 0.66, 0.32) * exp(-sd * sd * 5.5) * mix(0.02, 0.14, clear);',

    /* ── Filmic grain so the pass marries into the photograph ── */
    '  col += (hash(uv * uRes + fract(uTime) * 61.7) * 2.0 - 1.0) * 0.012;',

    '  gl_FragColor = vec4(max(col, 0.0), 1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, 'uRes');
  var uTime = gl.getUniformLocation(prog, 'uTime');
  var uPar = gl.getUniformLocation(prog, 'uPar');
  var uSun = gl.getUniformLocation(prog, 'uSun');

  /* Scroll choreography (experience.js) clears the mist through this API.
     Without it, the scene rests at a light, mostly-clear morning. */
  var sunLevel = 0.72;
  window.WDF_ATMOS = {
    setSun: function (v) { sunLevel = Math.min(Math.max(v, 0), 1); }
  };

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    var pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw; canvas.height = ph;
      gl.viewport(0, 0, pw, ph);
    }
  }

  /* Pointer parallax, eased */
  var targetPar = { x: 0, y: 0 }, par = { x: 0, y: 0 };
  var hero = canvas.closest('.hero') || canvas.parentElement;
  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect();
    targetPar.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    targetPar.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  hero.addEventListener('pointerleave', function () { targetPar.x = 0; targetPar.y = 0; });

  function draw(timeSec) {
    resize();
    par.x += (targetPar.x - par.x) * 0.04;
    par.y += (targetPar.y - par.y) * 0.04;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, timeSec);
    gl.uniform2f(uPar, par.x, par.y);
    gl.uniform1f(uSun, sunLevel);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  if (reduced) {
    var still = function () { draw(26.0); };
    still();
    window.addEventListener('resize', still);
    return;
  }

  var running = false, rafId = 0, start = performance.now();
  function loop(now) {
    draw((now - start) / 1000);
    rafId = requestAnimationFrame(loop);
  }
  function setRunning(on) {
    if (on && !running) { running = true; rafId = requestAnimationFrame(loop); }
    if (!on && running) { running = false; cancelAnimationFrame(rafId); }
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      setRunning(entries[0].isIntersecting && !document.hidden);
    }, { threshold: 0 }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () {
    setRunning(!document.hidden);
  });
  /* Paint one frame synchronously so the canvas is never blank */
  draw(26.0);
  setRunning(true);
})();
