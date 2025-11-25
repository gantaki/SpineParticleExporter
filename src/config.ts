import { Curve, ParticleSettings } from './types';

export const DEFAULT_CURVE_PRESETS: { [key: string]: Curve } = {
  sizeX: { points: [{ time: 0, value: 1.0 }, { time: 1, value: 0.2 }], interpolation: 'linear' },
  sizeY: { points: [{ time: 0, value: 1.0 }, { time: 1, value: 0.2 }], interpolation: 'linear' },
  speed: { points: [{ time: 0, value: 1.0 }, { time: 1, value: 1.0 }], interpolation: 'linear' },
  weight: { points: [{ time: 0, value: 1.0 }, { time: 1, value: 1.0 }], interpolation: 'linear' },
  spin: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  attraction: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  noise: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  angularVelocity: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  vortex: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  gravity: { points: [{ time: 0, value: 1 }, { time: 1, value: 1 }], interpolation: 'linear' },
  drag: { points: [{ time: 0, value: 1 }, { time: 1, value: 1 }], interpolation: 'linear' },
};

export const DEFAULT_SETTINGS: ParticleSettings = {
  emitter: {
    position: { x: 256, y: 256 },
    shape: 'point',
    shapeRadius: 20,
    shapeWidth: 100,
    shapeHeight: 100,
    roundRadius: 20,
    lineLength: 100,
    emissionMode: 'area',
    angle: -90,
    angleSpread: 30,
    rate: 10,
    maxParticles: 500,

    emissionType: 'continuous',
    burstCount: 50,
    burstCycles: 1,
    burstInterval: 0.5,
    durationStart: 0,
    durationEnd: 2,

    looping: true,
    prewarm: false,
    startDelay: 0,
  },
  lifeTimeMin: 0.5,
  lifeTimeMax: 1.5,

  gravityOverLifetime: DEFAULT_CURVE_PRESETS.gravity,
  gravityRange: { min: 0, max: 0 },
  dragOverLifetime: DEFAULT_CURVE_PRESETS.drag,
  dragRange: { min: 0.98, max: 0.98 },

  sizeXOverLifetime: DEFAULT_CURVE_PRESETS.sizeX,
  sizeXRange: { min: 1, max: 1 },
  sizeYOverLifetime: DEFAULT_CURVE_PRESETS.sizeY,
  sizeYRange: { min: 1, max: 1 },
  initialSpeedRange: { min: 100, max: 200 },
  speedOverLifetime: DEFAULT_CURVE_PRESETS.speed,
  speedRange: { min: 1, max: 1 },
  weightOverLifetime: DEFAULT_CURVE_PRESETS.weight,
  weightRange: { min: 1, max: 1 },
  spinOverLifetime: DEFAULT_CURVE_PRESETS.spin,
  spinRange: { min: 0, max: 0 },
  attractionOverLifetime: DEFAULT_CURVE_PRESETS.attraction,
  attractionRange: { min: 0, max: 0 },

  noiseStrengthOverLifetime: DEFAULT_CURVE_PRESETS.noise,
  noiseStrengthRange: { min: 0, max: 0 },
  noiseFrequencyRange: { min: 0.02, max: 0.08 },
  noiseSpeedRange: { min: 2.0, max: 4.0 },

  angularVelocityOverLifetime: DEFAULT_CURVE_PRESETS.angularVelocity,
  angularVelocityRange: { min: 0, max: 0 },

  vortexStrengthOverLifetime: DEFAULT_CURVE_PRESETS.vortex,
  vortexStrengthRange: { min: 0, max: 0 },
  vortexPoint: { x: 256, y: 256 },
  showVortexVisualization: false,
  scaleRatioX: 1.0,
  scaleRatioY: 1.0,

  colorOverLifetime: {
    points: [
      { time: 0, color: { r: 255, g: 255, b: 255, a: 255 } },
      { time: 1, color: { r: 255, g: 255, b: 255, a: 0 } }
    ]
  },

  duration: 2.0,
  fps: 30,
  frameSize: 512,

  attractionPoint: { x: 256, y: 256 },

  particleSprite: 'circle',
  customSpriteData: null,

  spawnAngleMode: 'alignMotion',
  spawnAngle: 0,
  spawnAngleMin: -45,
  spawnAngleMax: 45,

  exportSettings: {
    exportTranslate: true,
    exportRotate: true,
    exportScale: true,
    exportColor: true,

    positionThreshold: 12.0,
    rotationThreshold: 20.0,
    scaleThreshold: 0.2,
    colorThreshold: 100,
  },
};

export const TIMELINE_MARKERS = [0, 0.25, 0.5, 0.75, 1];
export const PLAYBACK_SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];
export const FPS_OPTIONS = [24, 30, 60];
export const TIMELINE_HEIGHT = 32;

export const GRID_STEP = 50;
export const SPRITE_RENDER_SIZE = 16;
export const PARTICLE_FALLBACK_SIZE = 8;
