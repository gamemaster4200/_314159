const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const state = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  canvasRect: null,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  time: 0,
  running: false,
  muted: false,
  flash: 0,
  hoverSlice: -1,
  lastFrame: 0,
  pulsePhase: 0,
  beatClock: 0,
  beatInterval: 0.72,
  controlsOpen: false,
  pointerType: "mouse",
  params: {
    noise: 0.45,
    pulse: 0.58,
    slices: 12,
    mode: "random"
  },
  pointer: {
    x: 0,
    y: 0,
    active: false
  },
  scene: {
    cx: 0,
    cy: 0,
    baseRadius: 0,
    drawRadius: 0,
    rotation: 0,
    sliceAngle: TAU / 12
  },
  particles: [],
  sparks: [],
  audio: null,
  debug: false
};

const ui = {};

window.addEventListener("load", () => {
  initCanvas();
  initUI();
  resize();
  seedParticles(180);
  requestAnimationFrame(frame);
});

function initCanvas() {
  state.canvas = document.getElementById("scene");
  state.ctx = state.canvas.getContext("2d");

  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", resize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
    window.visualViewport.addEventListener("scroll", resize);
  }

  state.canvas.addEventListener("pointerdown", handleCanvasPointerDown);
  state.canvas.addEventListener("pointermove", handlePointerMove);
  state.canvas.addEventListener("pointerleave", () => {
    state.pointer.active = false;
    state.hoverSlice = -1;
  });
}

function initUI() {
  ui.noise = document.getElementById("noise");
  ui.pulse = document.getElementById("pulse");
  ui.slices = document.getElementById("slices");
  ui.mode = document.getElementById("mode");
  ui.modeNote = document.getElementById("modeNote");
  ui.audioToggle = document.getElementById("audioToggle");
  ui.piemButton = document.getElementById("piemButton");
  ui.overlay = document.getElementById("piemOverlay");
  ui.closeOverlay = document.getElementById("closeOverlay");
  ui.startHint = document.getElementById("startHint");
  ui.controls = document.getElementById("controlsPanel");
  ui.controlsToggle = document.getElementById("controlsToggle");

  ui.noise.addEventListener("input", () => {
    state.params.noise = Number(ui.noise.value) / 100;
    respawnParticles();
    updateAudioMix();
  });

  ui.pulse.addEventListener("input", () => {
    state.params.pulse = Number(ui.pulse.value) / 100;
    state.beatInterval = pulseToInterval();
  });

  ui.slices.addEventListener("input", () => {
    state.params.slices = Number(ui.slices.value);
    updateSceneGeometry();
    updateHoverState();
  });

  ui.mode.addEventListener("change", () => {
    state.params.mode = ui.mode.value;
    updateModeNote();
    respawnParticles();
    spawnBurst(14);
    updateHoverState();
  });

  ui.audioToggle.addEventListener("click", () => {
    if (!state.running) {
      startExperience();
      return;
    }

    state.muted = !state.muted;
    updateAudioButton();
    updateAudioMix();
  });

  ui.controlsToggle.addEventListener("click", () => {
    state.controlsOpen = !state.controlsOpen;
    syncResponsiveUI();
  });

  ui.piemButton.addEventListener("click", openOverlay);
  ui.closeOverlay.addEventListener("click", closeOverlay);
  ui.overlay.addEventListener("click", (event) => {
    if (event.target.dataset.close) {
      closeOverlay();
    }
  });
  ui.startHint.addEventListener("click", handleGesture);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && ui.overlay.classList.contains("is-open")) {
      closeOverlay();
    }
  });

  state.params.noise = Number(ui.noise.value) / 100;
  state.params.pulse = Number(ui.pulse.value) / 100;
  state.params.slices = Number(ui.slices.value);
  state.beatInterval = pulseToInterval();
  updateModeNote();
  updateAudioButton();
}

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewportHeight = Math.max(320, Math.round(getViewportHeight()));
  document.documentElement.style.setProperty("--app-height", `${viewportHeight}px`);

  state.canvasRect = state.canvas.getBoundingClientRect();
  state.width = Math.max(320, Math.round(state.canvasRect.width));
  state.height = Math.max(320, Math.round(state.canvasRect.height));

  state.canvas.width = Math.round(state.canvasRect.width * state.dpr);
  state.canvas.height = Math.round(state.canvasRect.height * state.dpr);
  state.canvas.style.width = `${state.canvasRect.width}px`;
  state.canvas.style.height = `${state.canvasRect.height}px`;
  state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  updateSceneGeometry();
  updateHoverState();
  syncResponsiveUI();
}

function getViewportHeight() {
  if (window.visualViewport) {
    return window.visualViewport.height;
  }
  return window.innerHeight;
}

function syncResponsiveUI() {
  const compact = isCompactLayout();

  if (!compact) {
    state.controlsOpen = true;
  }

  ui.controls.classList.toggle("is-open", compact ? state.controlsOpen : true);
  ui.controlsToggle.setAttribute("aria-expanded", compact ? String(state.controlsOpen) : "true");
  ui.controlsToggle.textContent = compact && state.controlsOpen ? "Close" : "Controls";
}

function isCompactLayout() {
  return state.width <= 900 || state.height <= 560;
}

function isPhoneLayout() {
  return state.width <= 600;
}

function isLandscape() {
  return state.width > state.height;
}

function updateModeNote() {
  ui.modeNote.textContent = state.params.mode === "random"
    ? "Random scatters. Quasi settles."
    : "Random scatters. Quasi settles.";
}

function updateAudioButton() {
  ui.audioToggle.textContent = state.running && !state.muted ? "Mute" : "Play";
}

function getBaseSceneMetrics() {
  const compact = isCompactLayout();
  const phone = isPhoneLayout();
  const landscape = isLandscape();

  let cx = state.width * 0.5;
  let cy = state.height * 0.54;
  let radius = Math.min(state.width, state.height) * 0.18;

  if (compact) {
    cx = state.width * 0.5;
    cy = landscape ? state.height * 0.49 : state.height * 0.42;
    radius = Math.min(state.width * (phone ? 0.34 : 0.27), state.height * (landscape ? 0.28 : 0.23));
  }

  if (phone) {
    radius = Math.min(state.width * 0.35, state.height * 0.24);
    cy = landscape ? state.height * 0.48 : state.height * 0.4;
  }

  return { cx, cy, radius };
}

function updateSceneGeometry() {
  const base = getBaseSceneMetrics();
  const pulse = state.running ? 1 + Math.sin(state.pulsePhase * TAU) * (0.03 + state.params.pulse * 0.05) : 1;
  state.scene.cx = base.cx;
  state.scene.cy = base.cy;
  state.scene.baseRadius = base.radius;
  state.scene.drawRadius = base.radius * pulse;
  state.scene.rotation = state.time * (state.running ? 0.08 : 0.02);
  state.scene.sliceAngle = TAU / state.params.slices;
}

function seedParticles(count) {
  state.particles.length = 0;
  for (let i = 0; i < count; i += 1) {
    state.particles.push(createParticle(i, true));
  }
}

function respawnParticles() {
  const targetCount = Math.floor(120 + state.params.noise * 180);
  seedParticles(targetCount);
}

function handleCanvasPointerDown(event) {
  state.pointerType = event.pointerType || "mouse";
  handlePointerMove(event);
  handleGesture();
}

function handleGesture() {
  if (!state.running) {
    startExperience();
  } else {
    spawnBurst(18);
    triggerPing(520 + Math.random() * 220, 0.12);
  }
}

function startExperience() {
  state.running = true;
  state.muted = false;
  state.flash = 1;
  state.beatClock = 0;
  ui.startHint.style.display = "none";

  const audio = initAudio();
  if (audio && audio.ctx.state === "suspended") {
    audio.ctx.resume();
  }

  updateAudioButton();
  updateAudioMix();
  triggerBeat(true);
  spawnBurst(32);
}

function initAudio() {
  if (state.audio) {
    return state.audio;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  const ctx = new AudioContextClass();
  const master = ctx.createGain();
  const pulseGain = ctx.createGain();
  const noiseGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const analyser = ctx.createAnalyser();

  master.gain.value = 0.7;
  pulseGain.gain.value = 0.0001;
  noiseGain.gain.value = 0.0001;
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  filter.Q.value = 0.8;
  analyser.fftSize = 256;

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i += 1) {
    noiseData[i] = Math.random() * 2 - 1;
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;

  noiseSource.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(master);
  pulseGain.connect(master);
  master.connect(analyser);
  analyser.connect(ctx.destination);
  noiseSource.start();

  state.audio = {
    ctx,
    master,
    pulseGain,
    noiseGain,
    filter,
    analyser
  };

  updateAudioMix();
  return state.audio;
}

function updateAudioMix() {
  if (!state.audio) {
    return;
  }

  const { ctx, master, noiseGain, filter } = state.audio;
  const time = ctx.currentTime;
  const active = state.running && !state.muted ? 1 : 0;

  master.gain.cancelScheduledValues(time);
  master.gain.setValueAtTime(master.gain.value, time);
  master.gain.linearRampToValueAtTime(active ? 0.82 : 0.0, time + 0.08);

  noiseGain.gain.cancelScheduledValues(time);
  noiseGain.gain.setValueAtTime(noiseGain.gain.value, time);
  noiseGain.gain.linearRampToValueAtTime(active ? 0.02 + state.params.noise * 0.06 : 0.0001, time + 0.1);

  filter.frequency.cancelScheduledValues(time);
  filter.frequency.setValueAtTime(filter.frequency.value, time);
  filter.frequency.linearRampToValueAtTime(700 + state.params.noise * 2400, time + 0.1);
}

function pulseToInterval() {
  return 1.15 - state.params.pulse * 0.78;
}

function handlePointerMove(event) {
  state.pointerType = event.pointerType || state.pointerType;
  const point = getPointerPosition(event);
  state.pointer.x = point.x;
  state.pointer.y = point.y;
  state.pointer.active = true;
  updateHoverState();
}

function createParticle(index, initial) {
  const baseRadius = state.scene.baseRadius * 1.04;
  const band = 42 + state.params.noise * 130;
  let angle;
  let ring;

  if (state.params.mode === "quasi") {
    angle = index * GOLDEN_ANGLE + state.time * 0.07;
    ring = 24 + ((index * 0.61803398875) % 1) * band;
  } else {
    angle = Math.random() * TAU;
    ring = Math.random() * band;
  }

  return {
    index,
    angle,
    radius: baseRadius + 28 + ring,
    size: initial ? 1 + Math.random() * 2.2 : 1.6 + Math.random() * 2.8,
    alpha: initial ? 0.14 + Math.random() * 0.26 : 0.3 + Math.random() * 0.34,
    drift: (Math.random() - 0.5) * 0.9,
    life: initial ? 999 : 1.2 + Math.random() * 1.8
  };
}

function spawnBurst(amount) {
  for (let i = 0; i < amount; i += 1) {
    const quasi = state.params.mode === "quasi";
    state.sparks.push({
      angle: quasi ? (state.sparks.length + i) * GOLDEN_ANGLE : Math.random() * TAU,
      radius: quasi ? (i % 3) * 4 : 0,
      speed: 100 + Math.random() * (quasi ? 160 : 240),
      life: 0.55 + Math.random() * 0.7,
      maxLife: 0.55 + Math.random() * 0.7,
      size: 1 + Math.random() * 2.5
    });
  }
}

function updateState(dt) {
  state.time += dt;
  state.flash = Math.max(0, state.flash - dt * 1.8);
  state.pulsePhase += dt * (0.8 + state.params.pulse * 2.4);
  state.beatInterval = pulseToInterval();
  updateSceneGeometry();
  updateHoverState();

  if (state.running) {
    state.beatClock += dt;
    if (state.beatClock >= state.beatInterval) {
      state.beatClock -= state.beatInterval;
      triggerBeat();
    }
  }

  const targetCount = Math.floor(120 + state.params.noise * 180);
  while (state.particles.length < targetCount) {
    state.particles.push(createParticle(state.particles.length, false));
  }
  if (state.particles.length > targetCount) {
    state.particles.length = targetCount;
  }

  state.particles.forEach((particle, index) => {
    const angularSpeed = state.params.mode === "quasi" ? 0.18 : 0.03;
    particle.angle += dt * (particle.drift * 0.7 + angularSpeed);
    particle.radius += state.params.mode === "quasi"
      ? Math.sin(state.time * 1.2 + particle.index * 0.4) * 0.08
      : Math.sin(state.time * 1.8 + particle.index) * state.params.noise * 0.24;
    particle.life -= dt;

    if (particle.life <= 0) {
      state.particles[index] = createParticle(index, false);
    }
  });

  state.sparks = state.sparks.filter((spark) => {
    spark.life -= dt;
    spark.radius += spark.speed * dt;
    return spark.life > 0;
  });
}

function triggerBeat(initial) {
  state.flash = initial ? 1 : 0.7;
  spawnBurst(initial ? 22 : 10);
  triggerThump();
  triggerPing(780 + Math.random() * 280, 0.08 + state.params.noise * 0.06);
}

function triggerThump() {
  if (!state.audio || state.muted) {
    return;
  }

  const { ctx, pulseGain } = state.audio;
  const time = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(92, time);
  osc.frequency.exponentialRampToValueAtTime(48, time + 0.18);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.42 + state.params.pulse * 0.2, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);

  osc.connect(gain);
  gain.connect(pulseGain);
  osc.start(time);
  osc.stop(time + 0.24);
}

function triggerPing(frequency, gainAmount) {
  if (!state.audio || state.muted) {
    return;
  }

  const { ctx, pulseGain } = state.audio;
  const time = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(180, frequency * 0.55), time + 0.12);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(gainAmount, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);

  osc.connect(gain);
  gain.connect(pulseGain);
  osc.start(time);
  osc.stop(time + 0.18);
}

function render() {
  const ctx = state.ctx;
  const w = state.width;
  const h = state.height;
  const scene = state.scene;
  const radius = scene.drawRadius;
  const noise = state.params.noise;

  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createRadialGradient(scene.cx, scene.cy, 0, scene.cx, scene.cy, Math.max(w, h) * 0.65);
  bg.addColorStop(0, "rgba(14, 28, 53, 0.35)");
  bg.addColorStop(0.42, "rgba(5, 10, 24, 0.12)");
  bg.addColorStop(1, "rgba(2, 4, 10, 0)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  renderParticles(scene.cx, scene.cy, radius);
  renderPie(scene.cx, scene.cy, radius, noise);
  renderSparks(scene.cx, scene.cy, radius);
  renderHalo(scene.cx, scene.cy, radius);
  renderDebug();

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 244, 210, ${state.flash * 0.09})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function renderParticles(cx, cy, radius) {
  const ctx = state.ctx;
  const quasi = state.params.mode === "quasi";

  state.particles.forEach((particle) => {
    const jitter = quasi
      ? Math.sin(state.time * 1.6 + particle.index * 0.5) * 2.5
      : (Math.random() - 0.5) * state.params.noise * 28;
    const distance = particle.radius + jitter;
    const x = cx + Math.cos(particle.angle) * distance;
    const y = cy + Math.sin(particle.angle) * distance;
    const color = quasi ? "124, 247, 255" : "255, 123, 200";

    ctx.beginPath();
    ctx.fillStyle = `rgba(${color}, ${particle.alpha})`;
    ctx.arc(x, y, particle.size, 0, TAU);
    ctx.fill();

    if (quasi && particle.index % 7 === 0) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(124, 247, 255, ${particle.alpha * 0.18})`;
      ctx.lineWidth = 0.7;
      ctx.arc(cx, cy, distance, particle.angle - 0.08, particle.angle + 0.08);
      ctx.stroke();
    }

    if (distance < radius * 0.95) {
      particle.radius = radius + 50 + Math.random() * 120;
    }
  });
}

function renderPie(cx, cy, radius, noise) {
  const ctx = state.ctx;
  const slices = state.params.slices;
  const slowRotation = state.scene.rotation;
  const sliceAngle = state.scene.sliceAngle;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(slowRotation);

  const fill = ctx.createRadialGradient(0, 0, radius * 0.14, 0, 0, radius * 1.1);
  fill.addColorStop(0, "rgba(255, 240, 178, 0.95)");
  fill.addColorStop(0.26, "rgba(255, 198, 115, 0.9)");
  fill.addColorStop(0.7, "rgba(255, 121, 179, 0.58)");
  fill.addColorStop(1, "rgba(64, 224, 255, 0.16)");

  ctx.beginPath();
  ctx.fillStyle = fill;
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fill();

  for (let i = 0; i < slices; i += 1) {
    const start = i * sliceAngle;
    const end = start + sliceAngle;
    const active = i === state.hoverSlice;
    const wobble = state.running ? Math.sin(state.time * 2.6 + i * 0.8) * noise * 0.04 : 0;
    const outer = radius * (1 + wobble + (active ? 0.06 : 0));

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, outer, start, end);
    ctx.closePath();
    ctx.fillStyle = active
      ? "rgba(255, 248, 214, 0.18)"
      : i % 2 === 0
        ? "rgba(255, 251, 235, 0.08)"
        : "rgba(101, 224, 255, 0.045)";
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255, 250, 230, 0.18)";
  ctx.lineWidth = 1.1;
  for (let i = 0; i < slices; i += 1) {
    const angle = i * sliceAngle;
    const breath = state.running ? 1 + Math.sin(state.time * 2 + i * 0.6) * noise * 0.06 : 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * radius * breath, Math.sin(angle) * radius * breath);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.14, 0, TAU);
  ctx.fillStyle = "rgba(255, 250, 240, 0.7)";
  ctx.fill();

  ctx.restore();
}

function renderSparks(cx, cy, radius) {
  const ctx = state.ctx;
  const quasi = state.params.mode === "quasi";

  state.sparks.forEach((spark) => {
    const life = spark.life / spark.maxLife;
    const dist = radius * 0.95 + spark.radius;
    const x = cx + Math.cos(spark.angle) * dist;
    const y = cy + Math.sin(spark.angle) * dist;

    ctx.beginPath();
    ctx.fillStyle = quasi
      ? `rgba(124, 247, 255, ${life * 0.55})`
      : `rgba(255, 225, 149, ${life * 0.7})`;
    ctx.arc(x, y, spark.size * life + 0.5, 0, TAU);
    ctx.fill();
  });
}

function renderHalo(cx, cy, radius) {
  const ctx = state.ctx;
  const quasi = state.params.mode === "quasi";
  const outer = radius * (1.25 + state.params.noise * 0.16);
  const halo = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, outer);
  halo.addColorStop(0, "rgba(255, 199, 112, 0.18)");
  halo.addColorStop(0.55, "rgba(124, 247, 255, 0.13)");
  halo.addColorStop(1, "rgba(124, 247, 255, 0)");

  ctx.beginPath();
  ctx.fillStyle = halo;
  ctx.arc(cx, cy, outer, 0, TAU);
  ctx.fill();

  if (quasi) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(124, 247, 255, 0.12)";
    ctx.lineWidth = 0.9;
    ctx.arc(cx, cy, radius * 1.24, 0, TAU);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.strokeStyle = `rgba(124, 247, 255, ${0.15 + state.flash * 0.15})`;
  ctx.lineWidth = 1.4;
  ctx.arc(cx, cy, radius * 1.03, 0, TAU);
  ctx.stroke();
}

function getPointerPosition(event) {
  const rect = state.canvas.getBoundingClientRect();
  state.canvasRect = rect;
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function updateHoverState() {
  if (!state.pointer.active || state.pointerType === "touch") {
    state.hoverSlice = -1;
    return;
  }

  const dx = state.pointer.x - state.scene.cx;
  const dy = state.pointer.y - state.scene.cy;
  const dist = Math.hypot(dx, dy);

  if (dist > state.scene.drawRadius * 1.16) {
    state.hoverSlice = -1;
    return;
  }

  let angle = Math.atan2(dy, dx) - state.scene.rotation;
  angle %= TAU;
  if (angle < 0) {
    angle += TAU;
  }

  state.hoverSlice = Math.floor(angle / state.scene.sliceAngle) % state.params.slices;
}

function renderDebug() {
  if (!state.debug || !state.pointer.active) {
    return;
  }

  const ctx = state.ctx;
  ctx.save();
  ctx.strokeStyle = "rgba(124, 247, 255, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(state.scene.cx, state.scene.cy);
  ctx.lineTo(state.pointer.x, state.pointer.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = "rgba(255, 120, 200, 0.95)";
  ctx.arc(state.pointer.x, state.pointer.y, 4, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "12px monospace";
  ctx.fillText(`hover: ${state.hoverSlice}`, state.pointer.x + 10, state.pointer.y - 10);
  ctx.restore();
}

function openOverlay() {
  ui.overlay.classList.add("is-open");
  ui.overlay.setAttribute("aria-hidden", "false");
}

function closeOverlay() {
  ui.overlay.classList.remove("is-open");
  ui.overlay.setAttribute("aria-hidden", "true");
}

function frame(timestamp) {
  if (!state.lastFrame) {
    state.lastFrame = timestamp;
  }

  const dt = Math.min((timestamp - state.lastFrame) / 1000, 0.033);
  state.lastFrame = timestamp;

  updateState(dt);
  render();
  requestAnimationFrame(frame);
}
