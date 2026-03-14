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
  beatGlow: 0,
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
    mode: "random",
    order: 5,
    noiseType: "white",
    beatLength: 0.35,
    beatPitch: 0.42
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
  ui.order = document.getElementById("order");
  ui.noiseType = document.getElementById("noiseType");
  ui.beatLength = document.getElementById("beatLength");
  ui.beatPitch = document.getElementById("beatPitch");
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

  ui.order.addEventListener("input", () => {
    state.params.order = Number(ui.order.value);
  });

  ui.noiseType.addEventListener("change", () => {
    state.params.noiseType = ui.noiseType.value;
    respawnParticles();
    updateAudioMix();
  });

  ui.beatLength.addEventListener("input", () => {
    state.params.beatLength = Number(ui.beatLength.value) / 100;
  });

  ui.beatPitch.addEventListener("input", () => {
    state.params.beatPitch = Number(ui.beatPitch.value) / 100;
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
  state.params.mode = ui.mode.value;
  state.params.order = Number(ui.order.value);
  state.params.noiseType = ui.noiseType.value;
  state.params.beatLength = Number(ui.beatLength.value) / 100;
  state.params.beatPitch = Number(ui.beatPitch.value) / 100;
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
  if (state.params.mode === "pi") {
    ui.modeNote.textContent = "Pi Series - shape from sums.";
    return;
  }
  if (state.params.mode === "quasi") {
    ui.modeNote.textContent = "Quasi settles into an even field.";
    return;
  }
  ui.modeNote.textContent = "Random scatters. Quasi settles.";
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
  const beatAccent = 1 + state.beatGlow * 0.024;
  state.scene.cx = base.cx;
  state.scene.cy = base.cy;
  state.scene.baseRadius = base.radius;
  state.scene.drawRadius = base.radius * pulse * beatAccent;
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
  state.beatGlow = 1;
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
    analyser,
    noiseBuffer
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
  const type = state.params.noiseType;

  master.gain.cancelScheduledValues(time);
  master.gain.setValueAtTime(master.gain.value, time);
  master.gain.linearRampToValueAtTime(active ? 0.82 : 0.0, time + 0.08);

  noiseGain.gain.cancelScheduledValues(time);
  noiseGain.gain.setValueAtTime(noiseGain.gain.value, time);

  if (type === "smooth") {
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(950 + state.params.noise * 1250, time);
    filter.Q.setValueAtTime(0.35, time);
    noiseGain.gain.linearRampToValueAtTime(active ? 0.01 + state.params.noise * 0.045 : 0.0001, time + 0.1);
  } else if (type === "band") {
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(520 + state.params.noise * 1700, time);
    filter.Q.setValueAtTime(3.2, time);
    noiseGain.gain.linearRampToValueAtTime(active ? 0.018 + state.params.noise * 0.04 : 0.0001, time + 0.1);
  } else {
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(700 + state.params.noise * 2400, time);
    filter.Q.setValueAtTime(0.8, time);
    noiseGain.gain.linearRampToValueAtTime(active ? 0.02 + state.params.noise * 0.06 : 0.0001, time + 0.1);
  }
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
  } else if (state.params.mode === "pi") {
    angle = (index / Math.max(1, state.particles.length || 180)) * TAU + state.time * 0.03;
    ring = 28 + Math.abs(getPiSeriesValue(angle + state.time * 0.16)) * band * 0.5 + Math.random() * band * 0.18;
  } else {
    angle = Math.random() * TAU;
    ring = Math.random() * band;
  }

  if (state.params.noiseType === "band") {
    ring = Math.round(ring / 18) * 18 + Math.random() * 6;
    angle += (Math.random() - 0.5) * 0.18;
  } else if (state.params.noiseType === "smooth") {
    ring *= 0.85;
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
    const pi = state.params.mode === "pi";
    state.sparks.push({
      angle: quasi
        ? (state.sparks.length + i) * GOLDEN_ANGLE
        : pi
          ? (i / Math.max(1, amount)) * TAU + state.time * 0.4
          : Math.random() * TAU,
      radius: pi ? Math.abs(getPiSeriesValue((i / Math.max(1, amount)) * TAU)) * 12 : quasi ? (i % 3) * 4 : 0,
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
  state.beatGlow = Math.max(0, state.beatGlow - dt * 2.3);
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
    let angularSpeed = state.params.mode === "quasi" ? 0.18 : state.params.mode === "pi" ? 0.14 : 0.03;
    if (state.params.noiseType === "smooth") {
      angularSpeed *= 0.72;
    }
    particle.angle += dt * (particle.drift * 0.7 + angularSpeed);
    if (state.params.noiseType === "smooth") {
      particle.radius += Math.sin(state.time * 1.1 + particle.index * 0.34) * 0.12;
    } else if (state.params.noiseType === "band") {
      particle.radius += Math.sin(state.time * 3 + particle.index * 0.45) * 0.22;
    } else {
      particle.radius += state.params.mode === "quasi"
        ? Math.sin(state.time * 1.2 + particle.index * 0.4) * 0.08
        : Math.sin(state.time * 1.8 + particle.index) * state.params.noise * 0.24;
    }
    if (state.params.mode === "pi") {
      particle.radius += getPiSeriesValue(particle.angle + state.time * 0.28) * 0.12;
    }
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
  state.beatGlow = initial ? 1 : 0.82;
  spawnBurst(initial ? 22 : 10);
  triggerThump();
  triggerBeatVoice();
  triggerPing(720 + state.params.beatPitch * 380, 0.05 + state.params.noise * 0.04);
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

function triggerBeatVoice() {
  if (!state.audio || state.muted) {
    return;
  }

  const { ctx, pulseGain, noiseBuffer } = state.audio;
  const time = ctx.currentTime;
  const length = 0.045 + state.params.beatLength * 0.22;
  const baseFreq = 120 + state.params.beatPitch * 320;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(baseFreq, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(70, baseFreq * 0.64), time + length);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(0.22, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
  osc.connect(gain);
  gain.connect(pulseGain);
  osc.start(time);
  osc.stop(time + length + 0.02);

  const tick = ctx.createBufferSource();
  const tickFilter = ctx.createBiquadFilter();
  const tickGain = ctx.createGain();
  tick.buffer = noiseBuffer;
  tickFilter.type = "bandpass";
  tickFilter.frequency.setValueAtTime(baseFreq * 2.4, time);
  tickFilter.Q.setValueAtTime(1.4, time);
  tickGain.gain.setValueAtTime(0.0001, time);
  tickGain.gain.linearRampToValueAtTime(0.04, time + 0.003);
  tickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04 + state.params.beatLength * 0.04);
  tick.connect(tickFilter);
  tickFilter.connect(tickGain);
  tickGain.connect(pulseGain);
  tick.start(time);
  tick.stop(time + 0.06 + state.params.beatLength * 0.05);
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
  const mode = state.params.mode;
  const quasi = mode === "quasi";
  const noiseType = state.params.noiseType;

  state.particles.forEach((particle) => {
    let jitter;
    if (noiseType === "smooth") {
      jitter = Math.sin(state.time * 1.3 + particle.index * 0.5) * 3.2;
    } else if (noiseType === "band") {
      jitter = Math.sin(state.time * 2.1 + particle.index * 0.25) * 8;
    } else {
      jitter = quasi
        ? Math.sin(state.time * 1.6 + particle.index * 0.5) * 2.5
        : (Math.random() - 0.5) * state.params.noise * 28;
    }
    if (mode === "pi") {
      jitter += getPiSeriesValue(particle.angle + state.time * 0.2) * 7;
    }
    const distance = particle.radius + jitter;
    const x = cx + Math.cos(particle.angle) * distance;
    const y = cy + Math.sin(particle.angle) * distance;
    const color = mode === "pi" ? "255, 213, 122" : quasi ? "124, 247, 255" : "255, 123, 200";

    ctx.beginPath();
    const alpha = noiseType === "smooth" ? particle.alpha * 0.82 : particle.alpha;
    ctx.fillStyle = `rgba(${color}, ${alpha})`;
    ctx.arc(x, y, particle.size, 0, TAU);
    ctx.fill();

    if ((quasi || mode === "pi" || noiseType === "band") && particle.index % 7 === 0) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${color}, ${alpha * 0.18})`;
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
  fill.addColorStop(0, `rgba(255, ${240 - state.params.beatPitch * 24}, 178, 0.95)`);
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
    const mid = start + sliceAngle * 0.5;
    const active = i === state.hoverSlice;
    const wobble = state.running ? Math.sin(state.time * 2.6 + i * 0.8) * noise * 0.04 : 0;
    const piLift = state.params.mode === "pi" ? getPiSeriesValue(mid + state.time * 0.22) * 0.05 : 0;
    const outer = radius * (1 + wobble + piLift + (active ? 0.06 : 0));

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
  ctx.arc(0, 0, radius * (0.14 + state.beatGlow * 0.02), 0, TAU);
  ctx.fillStyle = `rgba(255, 250, 240, ${0.7 + state.beatGlow * 0.14})`;
  ctx.fill();

  ctx.restore();
}

function renderSparks(cx, cy, radius) {
  const ctx = state.ctx;
  const mode = state.params.mode;
  const quasi = mode === "quasi";

  state.sparks.forEach((spark) => {
    const life = spark.life / spark.maxLife;
    const dist = radius * 0.95 + spark.radius;
    const x = cx + Math.cos(spark.angle) * dist;
    const y = cy + Math.sin(spark.angle) * dist;

    ctx.beginPath();
    ctx.fillStyle = mode === "pi"
      ? `rgba(255, 213, 122, ${life * 0.62})`
      : quasi
        ? `rgba(124, 247, 255, ${life * 0.55})`
        : `rgba(255, 225, 149, ${life * 0.7})`;
    ctx.arc(x, y, spark.size * life + 0.5, 0, TAU);
    ctx.fill();
  });
}

function renderHalo(cx, cy, radius) {
  const ctx = state.ctx;
  const mode = state.params.mode;
  const outer = radius * (1.25 + state.params.noise * 0.16 + state.beatGlow * 0.08);
  const halo = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, outer);
  const warmBoost = state.params.beatPitch * 22;
  halo.addColorStop(0, `rgba(255, ${199 + warmBoost}, 112, 0.18)`);
  halo.addColorStop(0.55, "rgba(124, 247, 255, 0.13)");
  halo.addColorStop(1, "rgba(124, 247, 255, 0)");

  ctx.beginPath();
  ctx.fillStyle = halo;
  ctx.arc(cx, cy, outer, 0, TAU);
  ctx.fill();

  if (mode === "pi") {
    renderPiSeriesLayer(cx, cy, radius);
  } else if (mode === "quasi") {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(124, 247, 255, 0.12)";
    ctx.lineWidth = 0.9;
    ctx.arc(cx, cy, radius * 1.24, 0, TAU);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.strokeStyle = `rgba(124, 247, 255, ${0.15 + state.flash * 0.15 + state.beatGlow * 0.08})`;
  ctx.lineWidth = 1.4;
  ctx.arc(cx, cy, radius * 1.03, 0, TAU);
  ctx.stroke();
}

function renderPiSeriesLayer(cx, cy, radius) {
  const ctx = state.ctx;
  const steps = 120;
  const amplitude = radius * (0.035 + state.params.order * 0.006);
  const shimmer = state.time * 0.25;

  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * TAU;
    const sum = getPiSeriesValue(t + shimmer);
    const smooth = Math.tanh(sum * 0.82);
    const ringRadius = radius * 1.1 + smooth * amplitude;
    const x = cx + Math.cos(t) * ringRadius;
    const y = cy + Math.sin(t) * ringRadius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.closePath();
  ctx.strokeStyle = "rgba(255, 214, 129, 0.42)";
  ctx.lineWidth = 1.6;
  ctx.shadowColor = "rgba(255, 214, 129, 0.32)";
  ctx.shadowBlur = 22;
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * TAU;
    const sum = getPiSeriesValue(t + shimmer + 0.18);
    const smooth = Math.tanh(sum * 0.72);
    const ringRadius = radius * 1.18 + smooth * amplitude * 0.6;
    const x = cx + Math.cos(t) * ringRadius;
    const y = cy + Math.sin(t) * ringRadius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = "rgba(124, 247, 255, 0.18)";
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}

function getPiSeriesValue(theta) {
  let sum = 0;
  for (let m = 0; m < state.params.order; m += 1) {
    const n = 2 * m + 1;
    sum += Math.sin(n * theta) / n;
  }
  return (4 / Math.PI) * sum;
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
