const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const GITHUB_REMOTE = "git@github.com:gamemaster4200/_314159.git";
const PI_DIGITS = "1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679";

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
  beatInterval: 0.72,
  schedulerId: 0,
  visualBeats: [],
  piDigitIndex: 0,
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
let repoInfo = null;

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
  document.addEventListener("visibilitychange", handleVisibilityChange);
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
  ui.buildBadge = document.getElementById("buildBadge");
  ui.mathNoteToggle = document.getElementById("mathNoteToggle");
  ui.mathNote = document.getElementById("mathNote");
  ui.descriptionButton = document.getElementById("descriptionButton");
  ui.descriptionOverlay = document.getElementById("descriptionOverlay");
  ui.closeDescription = document.getElementById("closeDescription");

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
    if (state.muted) {
      stopAudioScheduler();
    } else {
      startAudioScheduler(false);
    }
  });

  ui.controlsToggle.addEventListener("click", () => {
    state.controlsOpen = !state.controlsOpen;
    syncResponsiveUI();
  });

  ui.piemButton.addEventListener("click", openOverlay);
  ui.closeOverlay.addEventListener("click", closeOverlay);
  ui.mathNoteToggle.addEventListener("click", toggleMathNote);
  ui.descriptionButton.addEventListener("click", openDescription);
  ui.closeDescription.addEventListener("click", closeDescription);
  ui.overlay.addEventListener("click", (event) => {
    if (event.target.dataset.close) {
      closeOverlay();
    }
  });
  ui.descriptionOverlay.addEventListener("click", (event) => {
    if (event.target.dataset.descriptionClose) {
      closeDescription();
    }
  });
  ui.startHint.addEventListener("click", handleGesture);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && ui.overlay.classList.contains("is-open")) {
      closeOverlay();
    }
    if (event.key === "Escape" && ui.descriptionOverlay.classList.contains("is-open")) {
      closeDescription();
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
  initBuildBadge();
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
    ui.modeNote.textContent = "sums sharpen the form.";
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
  state.visualBeats.length = 0;
  ui.startHint.style.display = "none";

  const audio = initAudio();
  if (audio && audio.ctx.state === "suspended") {
    audio.ctx.resume();
  }

  updateAudioButton();
  updateAudioMix();
  startAudioScheduler(true);
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
  const beatGain = ctx.createGain();
  const noiseGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const compressor = ctx.createDynamicsCompressor();
  const analyser = ctx.createAnalyser();

  master.gain.value = 0.7;
  pulseGain.gain.value = 0.62;
  beatGain.gain.value = 1.18;
  noiseGain.gain.value = 0.0001;
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  filter.Q.value = 0.8;
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 2.4;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.18;
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
  beatGain.connect(master);
  master.connect(compressor);
  compressor.connect(analyser);
  analyser.connect(ctx.destination);
  noiseSource.start();

  state.audio = {
    ctx,
    master,
    pulseGain,
    beatGain,
    noiseGain,
    filter,
    compressor,
    analyser,
    noiseBuffer,
    nextBeatTime: 0,
    schedulerLookahead: 0.18,
    schedulerIntervalMs: 50,
    firstScheduledBeat: false
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
  master.gain.linearRampToValueAtTime(active ? 1.0 : 0.0, time + 0.08);

  noiseGain.gain.cancelScheduledValues(time);
  noiseGain.gain.setValueAtTime(noiseGain.gain.value, time);

  if (type === "smooth") {
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(950 + state.params.noise * 1250, time);
    filter.Q.setValueAtTime(0.35, time);
    noiseGain.gain.linearRampToValueAtTime(active ? 0.006 + state.params.noise * 0.026 : 0.0001, time + 0.1);
  } else if (type === "band") {
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(520 + state.params.noise * 1700, time);
    filter.Q.setValueAtTime(3.2, time);
    noiseGain.gain.linearRampToValueAtTime(active ? 0.011 + state.params.noise * 0.024 : 0.0001, time + 0.1);
  } else {
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(700 + state.params.noise * 2400, time);
    filter.Q.setValueAtTime(0.8, time);
    noiseGain.gain.linearRampToValueAtTime(active ? 0.011 + state.params.noise * 0.034 : 0.0001, time + 0.1);
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
    ring = Math.round(ring / 22) * 22 + Math.random() * 8;
    angle += (Math.random() - 0.5) * 0.12;
  } else if (state.params.noiseType === "smooth") {
    ring *= 0.72;
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

  flushVisualBeats();

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
      angularSpeed *= 0.55;
    } else if (state.params.noiseType === "band") {
      angularSpeed *= 0.88;
    }
    particle.angle += dt * (particle.drift * 0.7 + angularSpeed);
    if (state.params.noiseType === "smooth") {
      particle.radius += Math.sin(state.time * 0.82 + particle.index * 0.21) * 0.08;
    } else if (state.params.noiseType === "band") {
      particle.radius += Math.sin(state.time * 3.4 + particle.index * 0.6) * 0.32;
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

function triggerBeat(initial, atTime) {
  const piBeat = getPiBeatModulation();
  queueVisualBeat(atTime, initial);
  triggerThump(atTime);
  triggerBeatVoice(piBeat, atTime);
  triggerPing(680 + state.params.beatPitch * 260, 0.022 + state.params.noise * 0.012, atTime);
}

function triggerOffbeat(atTime) {
  if (!state.audio || state.muted) {
    return;
  }

  const { ctx, beatGain, noiseBuffer } = state.audio;
  const time = Math.max(ctx.currentTime + 0.005, atTime || ctx.currentTime);

  const tick = ctx.createBufferSource();
  const highpass = ctx.createBiquadFilter();
  const bandpass = ctx.createBiquadFilter();
  const tickGain = ctx.createGain();

  tick.buffer = noiseBuffer;
  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(1800 + state.params.beatPitch * 700, time);
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(2600 + state.params.beatPitch * 900, time);
  bandpass.Q.setValueAtTime(1.8, time);

  tickGain.gain.setValueAtTime(0.0001, time);
  tickGain.gain.linearRampToValueAtTime(0.04, time + 0.0015);
  tickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

  tick.connect(highpass);
  highpass.connect(bandpass);
  bandpass.connect(tickGain);
  tickGain.connect(beatGain);
  tick.start(time);
  tick.stop(time + 0.05);
}

function triggerThump(atTime) {
  if (!state.audio || state.muted) {
    return;
  }

  const { ctx, pulseGain } = state.audio;
  const time = Math.max(ctx.currentTime + 0.005, atTime || ctx.currentTime);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(92, time);
  osc.frequency.exponentialRampToValueAtTime(48, time + 0.18);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.52 + state.params.pulse * 0.24, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);

  osc.connect(gain);
  gain.connect(pulseGain);
  osc.start(time);
  osc.stop(time + 0.24);
}

function triggerPing(frequency, gainAmount, atTime) {
  if (!state.audio || state.muted) {
    return;
  }

  const { ctx, pulseGain } = state.audio;
  const time = Math.max(ctx.currentTime + 0.005, atTime || ctx.currentTime);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(180, frequency * 0.55), time + 0.12);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(gainAmount * 0.9, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);

  osc.connect(gain);
  gain.connect(pulseGain);
  osc.start(time);
  osc.stop(time + 0.18);
}

function triggerBeatVoice(piBeat, atTime) {
  if (!state.audio || state.muted) {
    return;
  }

  const { ctx, beatGain, noiseBuffer } = state.audio;
  const time = Math.max(ctx.currentTime + 0.005, atTime || ctx.currentTime);
  const length = piBeat.duration;
  const baseFreq = piBeat.frequency;

  const bodyOsc = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  bodyOsc.type = "sine";
  bodyOsc.frequency.setValueAtTime(baseFreq, time);
  bodyOsc.frequency.exponentialRampToValueAtTime(Math.max(36, baseFreq * 0.72), time + length);
  bodyGain.gain.setValueAtTime(0.0001, time);
  bodyGain.gain.linearRampToValueAtTime(0.42, time + 0.008);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + length);
  bodyOsc.connect(bodyGain);
  bodyGain.connect(beatGain);
  bodyOsc.start(time);
  bodyOsc.stop(time + length + 0.03);

  const subOsc = ctx.createOscillator();
  const subGain = ctx.createGain();
  subOsc.type = "triangle";
  subOsc.frequency.setValueAtTime(Math.max(28, baseFreq * 0.5), time);
  subOsc.frequency.exponentialRampToValueAtTime(Math.max(24, baseFreq * 0.44), time + length * 0.95);
  subGain.gain.setValueAtTime(0.0001, time);
  subGain.gain.linearRampToValueAtTime(0.24, time + 0.01);
  subGain.gain.exponentialRampToValueAtTime(0.0001, time + length * 1.05);
  subOsc.connect(subGain);
  subGain.connect(beatGain);
  subOsc.start(time);
  subOsc.stop(time + length + 0.04);

  const edgeOsc = ctx.createOscillator();
  const edgeGain = ctx.createGain();
  edgeOsc.type = "square";
  edgeOsc.frequency.setValueAtTime(baseFreq * 2.2, time);
  edgeOsc.frequency.exponentialRampToValueAtTime(baseFreq * 1.1, time + 0.05);
  edgeGain.gain.setValueAtTime(0.0001, time);
  edgeGain.gain.linearRampToValueAtTime(0.11, time + 0.002);
  edgeGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);
  edgeOsc.connect(edgeGain);
  edgeGain.connect(beatGain);
  edgeOsc.start(time);
  edgeOsc.stop(time + 0.065);

  const tick = ctx.createBufferSource();
  const tickFilter = ctx.createBiquadFilter();
  const tickGain = ctx.createGain();
  tick.buffer = noiseBuffer;
  tickFilter.type = "bandpass";
  tickFilter.frequency.setValueAtTime(baseFreq * 2.8, time);
  tickFilter.Q.setValueAtTime(2.6, time);
  tickGain.gain.setValueAtTime(0.0001, time);
  tickGain.gain.linearRampToValueAtTime(0.085, time + 0.002);
  tickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05 + length * 0.2);
  tick.connect(tickFilter);
  tickFilter.connect(tickGain);
  tickGain.connect(beatGain);
  tick.start(time);
  tick.stop(time + 0.06 + length * 0.22);
}

function startAudioScheduler(fireImmediately) {
  if (!state.audio) {
    return;
  }

  stopAudioScheduler();
  const { ctx } = state.audio;
  updateSchedulerTiming();
  state.audio.firstScheduledBeat = fireImmediately;
  state.audio.nextBeatTime = ctx.currentTime + (fireImmediately ? 0.02 : state.beatInterval);
  scheduleAudioBeats();
  state.schedulerId = window.setInterval(scheduleAudioBeats, state.audio.schedulerIntervalMs);
}

function stopAudioScheduler() {
  if (state.schedulerId) {
    window.clearInterval(state.schedulerId);
    state.schedulerId = 0;
  }
}

function scheduleAudioBeats() {
  if (!state.audio || !state.running || state.muted || state.audio.ctx.state !== "running") {
    return;
  }

  const { ctx } = state.audio;
  const horizon = ctx.currentTime + state.audio.schedulerLookahead;
  while (state.audio.nextBeatTime <= horizon) {
    const beatTime = state.audio.nextBeatTime;
    triggerBeat(Boolean(state.audio.firstScheduledBeat), beatTime);
    triggerOffbeat(beatTime + state.beatInterval * 0.5);
    state.audio.firstScheduledBeat = false;
    state.audio.nextBeatTime += state.beatInterval;
  }
}

function queueVisualBeat(atTime, initial) {
  if (document.hidden) {
    return;
  }
  const dueAt = performance.now() + Math.max(0, ((atTime || 0) - (state.audio ? state.audio.ctx.currentTime : 0)) * 1000);
  state.visualBeats.push({
    dueAt,
    initial
  });
}

function flushVisualBeats() {
  if (!state.visualBeats.length) {
    return;
  }

  const now = performance.now();
  state.visualBeats = state.visualBeats.filter((beat) => {
    if (beat.dueAt > now) {
      return true;
    }
    fireVisualBeat(beat.initial);
    return false;
  });
}

function fireVisualBeat(initial) {
  state.flash = initial ? 1 : 0.7;
  state.beatGlow = initial ? 1 : 0.96;
  spawnBurst(initial ? 22 : 10);
}

function handleVisibilityChange() {
  if (!state.audio) {
    return;
  }

  updateSchedulerTiming();
  state.visualBeats.length = 0;

  if (!state.running || state.muted) {
    return;
  }

  if (state.audio.ctx.state === "running") {
    scheduleAudioBeats();
    restartAudioSchedulerInterval();
  }
}

function updateSchedulerTiming() {
  if (!state.audio) {
    return;
  }

  if (document.hidden) {
    state.audio.schedulerLookahead = 2.4;
    state.audio.schedulerIntervalMs = 250;
  } else {
    state.audio.schedulerLookahead = 0.18;
    state.audio.schedulerIntervalMs = 50;
  }
}

function restartAudioSchedulerInterval() {
  if (!state.audio || !state.running || state.muted) {
    return;
  }

  if (state.schedulerId) {
    window.clearInterval(state.schedulerId);
  }
  state.schedulerId = window.setInterval(scheduleAudioBeats, state.audio.schedulerIntervalMs);
}

function getPiBeatModulation() {
  const pitchDigit = Number(PI_DIGITS[state.piDigitIndex % PI_DIGITS.length]);
  const durationDigit = Number(PI_DIGITS[(state.piDigitIndex + 1) % PI_DIGITS.length]);
  state.piDigitIndex = (state.piDigitIndex + 2) % PI_DIGITS.length;

  const centerSemitone = -3 + state.params.beatPitch * 9;
  const digitSemitoneOffsets = [-7, -5, -4, -2, -1, 0, 1, 2, 4, 5];
  const semitoneOffset = digitSemitoneOffsets[pitchDigit];
  const baseFrequency = 55 * Math.pow(2, centerSemitone / 12);
  const frequency = baseFrequency * Math.pow(2, semitoneOffset / 12);

  const baseDuration = 0.08 + state.params.beatLength * 0.26;
  const durationSteps = [0.68, 0.82, 1.0, 1.16, 1.34];
  const duration = baseDuration * durationSteps[durationDigit % durationSteps.length];

  return {
    pitchDigit,
    durationDigit,
    frequency: Math.max(34, Math.min(120, frequency)),
    duration: Math.max(0.06, Math.min(0.42, duration))
  };
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
      jitter = Math.sin(state.time * 0.9 + particle.index * 0.34) * 1.8;
    } else if (noiseType === "band") {
      jitter = Math.sin(state.time * 2.4 + particle.index * 0.18) * 12;
    } else {
      jitter = quasi
        ? Math.sin(state.time * 1.6 + particle.index * 0.5) * 2.5
        : (Math.random() - 0.5) * state.params.noise * 36;
    }
    if (mode === "pi") {
      jitter += getPiSeriesValue(particle.angle + state.time * 0.2) * (9 + state.beatGlow * 4);
    }
    const distance = particle.radius + jitter;
    const x = cx + Math.cos(particle.angle) * distance;
    const y = cy + Math.sin(particle.angle) * distance;
    const color = mode === "pi" ? "255, 213, 122" : quasi ? "124, 247, 255" : "255, 123, 200";
    const harmonicAlpha = mode === "pi"
      ? 0.9 + Math.abs(getPiSeriesValue(particle.angle + state.time * 0.18)) * 0.45 + state.beatGlow * 0.12
      : 1;
    const noiseAlpha = noiseType === "white" ? 1.15 : noiseType === "band" ? 1.05 : 0.78;
    const sizeScale = noiseType === "white" ? 0.9 : noiseType === "band" ? 1.15 : 1;

    ctx.beginPath();
    const alpha = noiseType === "smooth" ? particle.alpha * 0.82 : particle.alpha;
    ctx.fillStyle = `rgba(${color}, ${Math.min(0.95, alpha * harmonicAlpha * noiseAlpha)})`;
    ctx.arc(x, y, particle.size * harmonicAlpha * sizeScale, 0, TAU);
    ctx.fill();

    if ((quasi || mode === "pi" || noiseType === "band") && particle.index % 7 === 0) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${color}, ${alpha * (noiseType === "band" ? 0.26 : 0.18)})`;
      ctx.lineWidth = noiseType === "band" ? 1.05 : 0.7;
      ctx.arc(cx, cy, distance, particle.angle - 0.08, particle.angle + 0.08);
      ctx.stroke();
    }

    if (noiseType === "white" && particle.index % 9 === 0) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 245, 230, ${alpha * 0.08})`;
      ctx.arc(x, y, particle.size * 2.6, 0, TAU);
      ctx.fill();
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
    const piLift = state.params.mode === "pi" ? getPiSeriesValue(mid + state.time * 0.22) * (0.08 + state.beatGlow * 0.025) : 0;
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
  const noiseType = state.params.noiseType;

  state.sparks.forEach((spark) => {
    const life = spark.life / spark.maxLife;
    const dist = radius * 0.95 + spark.radius + (noiseType === "band" ? Math.sin(spark.angle * 6 + state.time * 1.6) * 12 : 0);
    const x = cx + Math.cos(spark.angle) * dist;
    const y = cy + Math.sin(spark.angle) * dist;

    ctx.beginPath();
    ctx.fillStyle = mode === "pi"
      ? `rgba(255, 213, 122, ${life * 0.62})`
      : quasi
        ? `rgba(124, 247, 255, ${life * 0.55})`
        : `rgba(255, 225, 149, ${life * (noiseType === "white" ? 0.82 : 0.7)})`;
    ctx.arc(x, y, spark.size * life * (noiseType === "band" ? 1.2 : 1) + 0.5, 0, TAU);
    ctx.fill();
  });
}

function renderHalo(cx, cy, radius) {
  const ctx = state.ctx;
  const mode = state.params.mode;
  const noiseType = state.params.noiseType;
  const outer = radius * (
    1.25
    + state.params.noise * 0.16
    + state.beatGlow * 0.08
    + (noiseType === "band" ? 0.05 : 0)
    - (noiseType === "smooth" ? 0.03 : 0)
  );
  const halo = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, outer);
  const warmBoost = state.params.beatPitch * 22;
  halo.addColorStop(0, `rgba(255, ${199 + warmBoost}, 112, 0.18)`);
  halo.addColorStop(0.55, noiseType === "smooth" ? "rgba(124, 247, 255, 0.09)" : "rgba(124, 247, 255, 0.13)");
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
  ctx.strokeStyle = `rgba(124, 247, 255, ${0.15 + state.flash * 0.15 + state.beatGlow * 0.08 + (noiseType === "band" ? 0.06 : 0)})`;
  ctx.lineWidth = noiseType === "smooth" ? 1.15 : noiseType === "band" ? 1.7 : 1.4;
  ctx.arc(cx, cy, radius * 1.03, 0, TAU);
  ctx.stroke();
}

function renderPiSeriesLayer(cx, cy, radius) {
  const ctx = state.ctx;
  const orderMix = (state.params.order - 1) / 8;
  const steps = 168;
  const amplitude = radius * (0.05 + orderMix * 0.055 + state.beatGlow * 0.02);
  const shimmer = state.time * (0.22 + orderMix * 0.08 + state.params.beatPitch * 0.06);

  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * TAU;
    const sum = getPiSeriesValue(t + shimmer);
    const smooth = Math.tanh(sum * (0.78 + orderMix * 0.5));
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
  ctx.fillStyle = `rgba(255, 214, 129, ${0.02 + orderMix * 0.05 + state.beatGlow * 0.05})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 214, 129, ${0.4 + orderMix * 0.18 + state.beatGlow * 0.14})`;
  ctx.lineWidth = 1.5 + orderMix * 0.8;
  ctx.shadowColor = "rgba(255, 214, 129, 0.36)";
  ctx.shadowBlur = 24 + state.beatGlow * 12;
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * TAU;
    const sum = getPiSeriesValue(t + shimmer + 0.18);
    const smooth = Math.tanh(sum * (0.72 + orderMix * 0.38));
    const ringRadius = radius * 1.18 + smooth * amplitude * (0.62 + orderMix * 0.22);
    const x = cx + Math.cos(t) * ringRadius;
    const y = cy + Math.sin(t) * ringRadius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = `rgba(124, 247, 255, ${0.16 + orderMix * 0.12 + state.beatGlow * 0.08})`;
  ctx.lineWidth = 0.9 + orderMix * 0.5;
  ctx.shadowBlur = 0;
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * TAU;
    const sum = getPiSeriesValue(t + shimmer - 0.12);
    const smooth = Math.tanh(sum * (0.92 + orderMix * 0.4));
    const ringRadius = radius * 1.04 + smooth * amplitude * 0.34;
    const x = cx + Math.cos(t) * ringRadius;
    const y = cy + Math.sin(t) * ringRadius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = `rgba(255, 247, 224, ${0.12 + orderMix * 0.16 + state.beatGlow * 0.16})`;
  ctx.lineWidth = 0.7 + orderMix * 0.35;
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

function parsePagesRepoFromLocation() {
  const host = window.location.hostname.toLowerCase();
  if (!host.endsWith(".github.io")) {
    return null;
  }

  const owner = host.slice(0, host.indexOf(".github.io"));
  const repo = window.location.pathname.replace(/^\/+/, "").split("/").filter(Boolean)[0];
  if (!owner || !repo) {
    return null;
  }

  return createRepoInfo(owner, repo);
}

function parseGitHubRemote(remote) {
  const match = remote.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/i);
  if (!match) {
    return null;
  }

  return createRepoInfo(match[1], match[2].replace(/\.git$/i, ""));
}

function createRepoInfo(owner, repo) {
  return {
    owner,
    repo,
    repoUrl: `https://github.com/${owner}/${repo}`,
    latestBuildUrl: `https://api.github.com/repos/${owner}/${repo}/pages/builds/latest`,
    latestCommitUrls: [
      `https://api.github.com/repos/${owner}/${repo}/commits/master`,
      `https://api.github.com/repos/${owner}/${repo}/commits/main`
    ]
  };
}

function initBuildBadge() {
  if (!ui.buildBadge) {
    return;
  }

  repoInfo = parsePagesRepoFromLocation() || parseGitHubRemote(GITHUB_REMOTE);
  if (!repoInfo) {
    ui.buildBadge.textContent = "github";
    return;
  }

  ui.buildBadge.href = repoInfo.repoUrl;
  ui.buildBadge.textContent = "github";
  loadBuildBadge();
}

async function loadBuildBadge() {
  if (!repoInfo) {
    return;
  }

  try {
    const build = await fetchGitHubJson(repoInfo.latestBuildUrl);
    const shortSha = build.commit ? String(build.commit).slice(0, 7) : "";
    ui.buildBadge.textContent = formatBuildStatus(build.status, shortSha);
  } catch (error) {
    const commitLabel = await loadCommitBadge();
    ui.buildBadge.textContent = commitLabel || "github";
  }
}

function formatBuildStatus(status, shortSha) {
  const value = String(status || "").toLowerCase();
  if (value === "built" || value === "succeeded" || value === "success") {
    return shortSha ? `live ${shortSha}` : "live";
  }
  if (value === "building") {
    return shortSha ? `building ${shortSha}` : "building...";
  }
  if (value === "queued" || value === "pending") {
    return shortSha ? `queued ${shortSha}` : "queued...";
  }
  if (value) {
    return shortSha ? `${value} ${shortSha}` : value;
  }
  return shortSha ? `live ${shortSha}` : "github";
}

async function loadCommitBadge() {
  if (!repoInfo) {
    return "";
  }

  for (const url of repoInfo.latestCommitUrls) {
    try {
      const commit = await fetchGitHubJson(url);
      const sha = commit && commit.sha ? String(commit.sha).slice(0, 7) : "";
      if (sha) {
        return `latest ${sha}`;
      }
    } catch (error) {
      continue;
    }
  }

  return "";
}

async function fetchGitHubJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}`);
  }

  return response.json();
}

function openOverlay() {
  ui.overlay.classList.add("is-open");
  ui.overlay.setAttribute("aria-hidden", "false");
}

function closeOverlay() {
  ui.overlay.classList.remove("is-open");
  ui.overlay.setAttribute("aria-hidden", "true");
}

function openDescription() {
  ui.descriptionOverlay.classList.add("is-open");
  ui.descriptionOverlay.setAttribute("aria-hidden", "false");
}

function closeDescription() {
  ui.descriptionOverlay.classList.remove("is-open");
  ui.descriptionOverlay.setAttribute("aria-hidden", "true");
}

function toggleMathNote() {
  const expanded = ui.mathNoteToggle.getAttribute("aria-expanded") === "true";
  ui.mathNoteToggle.setAttribute("aria-expanded", String(!expanded));
  ui.mathNote.hidden = expanded;
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
