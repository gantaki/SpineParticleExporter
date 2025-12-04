/**
 * Type definitions and constants for Particle Spine Exporter v103
 */

// ============================================================
// TYPES AND INTERFACES
// ============================================================

// ========== Types and Interfaces ==========

interface Vec2 {
  x: number;
  y: number;
}
interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface CurvePoint {
  time: number;
  value: number;
}

interface BezierHandle {
  x: number;
  y: number;
}

interface PointWithHandles {
  inHandle?: BezierHandle;
  outHandle?: BezierHandle;
}

interface Curve {
  points: CurvePoint[];
  interpolation: "linear" | "smooth";
  handles?: Record<number, PointWithHandles>; // Bezier handles for smooth interpolation
  zoom?: boolean; // Zoom state persistence
}

interface RangeValue {
  min: number;
  max: number;
}

interface ColorPoint {
  time: number;
  color: Color;
}

interface ColorGradient {
  points: ColorPoint[];
}

// Emitter-specific settings combining emitter and particle properties
interface EmitterInstanceSettings {
  // Emitter shape and position
  position: Vec2;
  positionLocked: boolean; // Locks emitter position from dragging in preview
  shape: "point" | "circle" | "rectangle" | "roundedRect" | "line";
  shapeRadius: number;
  shapeWidth: number;
  shapeHeight: number;
  shapeRotation: number; // Rotation of the emitter shape itself (for circle, rectangle and rounded)
  roundRadius: number;
  lineLength: number;
  lineSpreadRotation: number;
  emissionMode: "area" | "edge";
  circleThickness: number; // Thickness of the circle outline in edge mode
  circleArc: number; // Arc angle in degrees (360 = full circle, 0 = no arc)
  rectangleThickness: number; // Thickness of the rectangle outline in edge mode
  rectangleArc: number; // Crop angle in degrees (360 = full perimeter, 0 = no perimeter)
  angle: number;
  angleSpread: number;
  rate: number;
  rateOverTime: Curve;
  maxParticles: number;

  // Emission timing
  emissionType: "continuous" | "burst" | "duration";
  burstCount: number;
  burstCycles: number;
  burstInterval: number;
  durationStart: number;
  durationEnd: number;

  looping: boolean;
  prewarm: boolean;
  startDelay: number;

  // Particle lifetime
  lifeTimeMin: number;
  lifeTimeMax: number;

  // Physics forces
  gravityOverLifetime: Curve;
  gravityRange: RangeValue;
  dragOverLifetime: Curve;
  dragRange: RangeValue;

  // Size and scaling
  separateSize: boolean; // Toggle between uniform (false) and separate X/Y (true) size modes
  sizeRange: RangeValue; // Uniform size range (used when separateSize=false)
  sizeOverLifetime: Curve; // Uniform size curve (used when separateSize=false)
  sizeXOverLifetime: Curve;
  sizeXRange: RangeValue;
  sizeYOverLifetime: Curve;
  sizeYRange: RangeValue;
  scaleRatioX: number;
  scaleRatioY: number;

  // Speed and movement
  initialSpeedRange: RangeValue;
  speedOverLifetime: Curve;
  speedRange: RangeValue;
  weightOverLifetime: Curve;
  weightRange: RangeValue;

  // Rotation
  spinOverLifetime: Curve;
  spinRange: RangeValue;
  spawnAngleMode: "alignMotion" | "specific" | "random" | "range";
  spawnAngle: number;
  spawnAngleMin: number;
  spawnAngleMax: number;

  // Attraction force
  attractionOverLifetime: Curve;
  attractionRange: RangeValue;
  attractionPoint: Vec2;

  // Noise/turbulence
  noiseStrengthOverLifetime: Curve;
  noiseStrengthRange: RangeValue;
  noiseFrequencyRange: RangeValue;
  noiseSpeedRange: RangeValue;

  // Vortex force
  vortexStrengthOverLifetime: Curve;
  vortexStrengthRange: RangeValue;
  vortexPoint: Vec2;
  showVortexVisualization: boolean;

  // Appearance
  colorOverLifetime: ColorGradient;
  particleSprite:
    | "circle"
    | "star"
    | "polygon"
    | "glow"
    | "needle"
    | "raindrop"
    | "snowflake"
    | "smoke"
    | "custom";
  customSpriteData: string | null;
}

// Individual emitter instance
interface EmitterInstance {
  id: string;
  name: string;
  settings: EmitterInstanceSettings;
  enabled: boolean; // For export - can disable individual emitters
  visible: boolean; // For viewport visibility
}

interface ExportSettings {
  exportTranslate: boolean;
  exportRotate: boolean;
  exportScale: boolean;
  exportColor: boolean;

  positionThreshold: number;
  rotationThreshold: number;
  scaleThreshold: number;
  colorThreshold: number;

  spineVersion: string; // e.g. "4.2.00", "4.3.39-beta"
}

// Global particle system settings
interface ParticleSettings {
  emitters: EmitterInstance[]; // Up to 5 emitters
  currentEmitterIndex: number; // Currently selected emitter for editing

  // Global export settings
  duration: number;
  fps: number;
  frameSize: number;
  exportSettings: ExportSettings;
}

interface Particle {
  id: number;
  emitterId: string; // NEW: identifies which emitter spawned this particle
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  baseSpeed: number;
  rotation: number;
  baseSpinRate: number;
  baseGravity: number;
  baseDrag: number;
  baseNoiseStrength: number;
  baseNoiseFrequency: number;
  baseNoiseSpeed: number;
  baseAttraction: number;
  baseVortexStrength: number;
  baseSpeedScale: number;
  baseWeight: number;
  baseSizeX: number;
  baseSizeY: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  color: Color;
  alpha: number;
}

type BakedParticleKey = string | number;

interface BakedFrame {
  time: number;
  particles: Map<
    BakedParticleKey,
    {
      emitterId: string; // Track emitter for export bone hierarchy
      localId?: number; // Preserve per-emitter particle index
      x: number;
      y: number;
      rotation: number;
      scale: number;
      scaleX: number;
      scaleY: number;
      alpha: number;
      color: Color;
    }
  >;
}

interface AtlasRegion {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  atlasIndex: number;
}

// ========== Default Presets ==========

const DEFAULT_CURVE_PRESETS: { [key: string]: Curve } = {
  size: {
    points: [
      { time: 0, value: 1.0 },
      { time: 1, value: 0.2 },
    ],
    interpolation: "linear",
  },
  sizeX: {
    points: [
      { time: 0, value: 1.0 },
      { time: 1, value: 0.2 },
    ],
    interpolation: "linear",
  },
  sizeY: {
    points: [
      { time: 0, value: 1.0 },
      { time: 1, value: 0.2 },
    ],
    interpolation: "linear",
  },
  speed: {
    points: [
      { time: 0, value: 1.0 },
      { time: 1, value: 1.0 },
    ],
    interpolation: "linear",
  },
  weight: {
    points: [
      { time: 0, value: 1.0 },
      { time: 1, value: 1.0 },
    ],
    interpolation: "linear",
  },
  spin: {
    points: [
      { time: 0, value: 0 },
      { time: 1, value: 0 },
    ],
    interpolation: "linear",
  },
  attraction: {
    points: [
      { time: 0, value: 0 },
      { time: 1, value: 0 },
    ],
    interpolation: "linear",
  },
  noise: {
    points: [
      { time: 0, value: 0 },
      { time: 1, value: 0 },
    ],
    interpolation: "linear",
  },
  vortex: {
    points: [
      { time: 0, value: 0 },
      { time: 1, value: 0 },
    ],
    interpolation: "linear",
  },
  gravity: {
    points: [
      { time: 0, value: 1 },
      { time: 1, value: 1 },
    ],
    interpolation: "linear",
  },
  drag: {
    points: [
      { time: 0, value: 1 },
      { time: 1, value: 1 },
    ],
    interpolation: "linear",
  },
  rate: {
    points: [
      { time: 0, value: 1 },
      { time: 1, value: 1 },
    ],
    interpolation: "linear",
  },
};

// ========== Default Settings ==========

// Function to create default emitter instance settings
function createDefaultEmitterSettings(): EmitterInstanceSettings {
  return {
    // Emitter shape and position
    position: { x: 0, y: 0 },
    positionLocked: false,
    shape: "point",
    shapeRadius: 20,
    shapeWidth: 100,
    shapeHeight: 100,
    shapeRotation: 0,
    roundRadius: 20,
    lineLength: 100,
    lineSpreadRotation: 0,
    emissionMode: "area",
    circleThickness: 10,
    circleArc: 360,
    rectangleThickness: 10,
    rectangleArc: 360,
    angle: -90,
    angleSpread: 30,
    rate: 10,
    rateOverTime: DEFAULT_CURVE_PRESETS.rate,
    maxParticles: 500,

    // Emission timing
    emissionType: "continuous",
    burstCount: 10,
    burstCycles: 1,
    burstInterval: 0.5,
    durationStart: 0,
    durationEnd: 2,

    looping: true,
    prewarm: false,
    startDelay: 0,

    // Particle lifetime
    lifeTimeMin: 0.5,
    lifeTimeMax: 1.5,

    // Physics forces
    gravityOverLifetime: DEFAULT_CURVE_PRESETS.gravity,
    gravityRange: { min: 0, max: 0 },
    dragOverLifetime: DEFAULT_CURVE_PRESETS.drag,
    dragRange: { min: 1, max: 1 },

    // Size and scaling
    separateSize: false, // Start in uniform size mode
    sizeRange: { min: 1, max: 1 }, // Uniform size range
    sizeOverLifetime: DEFAULT_CURVE_PRESETS.size, // Uniform size curve
    sizeXOverLifetime: DEFAULT_CURVE_PRESETS.sizeX,
    sizeXRange: { min: 1, max: 1 },
    sizeYOverLifetime: DEFAULT_CURVE_PRESETS.sizeY,
    sizeYRange: { min: 1, max: 1 },
    scaleRatioX: 1.0,
    scaleRatioY: 1.0,

    // Speed and movement
    initialSpeedRange: { min: 100, max: 200 },
    speedOverLifetime: DEFAULT_CURVE_PRESETS.speed,
    speedRange: { min: 1, max: 1 },
    weightOverLifetime: DEFAULT_CURVE_PRESETS.weight,
    weightRange: { min: 1, max: 1 },

    // Rotation
    spinOverLifetime: DEFAULT_CURVE_PRESETS.spin,
    spinRange: { min: 0, max: 0 },
    spawnAngleMode: "alignMotion",
    spawnAngle: 0,
    spawnAngleMin: -45,
    spawnAngleMax: 45,

    // Attraction force
    attractionOverLifetime: DEFAULT_CURVE_PRESETS.attraction,
    attractionRange: { min: 0, max: 0 },
    attractionPoint: { x: 0, y: 0 },

    // Noise/turbulence
    noiseStrengthOverLifetime: DEFAULT_CURVE_PRESETS.noise,
    noiseStrengthRange: { min: 0, max: 0 },
    noiseFrequencyRange: { min: 0.02, max: 0.08 },
    noiseSpeedRange: { min: 2.0, max: 4.0 },

    // Vortex force
    vortexStrengthOverLifetime: DEFAULT_CURVE_PRESETS.vortex,
    vortexStrengthRange: { min: 0, max: 0 },
    vortexPoint: { x: 0, y: 0 },
    showVortexVisualization: false,

    // Appearance
    colorOverLifetime: {
      points: [
        { time: 0, color: { r: 255, g: 255, b: 255, a: 255 } },
        { time: 1, color: { r: 255, g: 255, b: 255, a: 0 } },
      ],
    },
    particleSprite: "circle",
    customSpriteData: null,
  };
}

// Function to create a new emitter instance
function createEmitterInstance(id: string, name: string): EmitterInstance {
  return {
    id,
    name,
    settings: createDefaultEmitterSettings(),
    enabled: true,
    visible: true,
  };
}

// Default particle system settings with one emitter

const DEFAULT_SETTINGS: ParticleSettings = {
  emitters: [createEmitterInstance("emitter_1", "Emitter 1")],
  currentEmitterIndex: 0,

  // Global settings
  duration: 2.0,
  fps: 30,
  frameSize: 512,

  exportSettings: {
    exportTranslate: true,
    exportRotate: true,
    exportScale: true,
    exportColor: true,

    positionThreshold: 12.0,
    rotationThreshold: 20.0,
    scaleThreshold: 0.2,
    colorThreshold: 60,

    spineVersion: "4.2.00",
  },
};

export {
  type Vec2,
  type Color,
  type CurvePoint,
  type BezierHandle,
  type PointWithHandles,
  type Curve,
  type RangeValue,
  type ColorPoint,
  type ColorGradient,
  type EmitterInstanceSettings,
  type EmitterInstance,
  type ExportSettings,
  type ParticleSettings,
  type Particle,
  type BakedFrame,
  type AtlasRegion,
  type BakedParticleKey,
  DEFAULT_CURVE_PRESETS,
  createDefaultEmitterSettings,
  createEmitterInstance,
  DEFAULT_SETTINGS,
};
