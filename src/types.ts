export interface Vec2 { x: number; y: number; }
export interface Color { r: number; g: number; b: number; a: number; }

export interface CurvePoint {
  time: number;
  value: number;
}

export interface Curve {
  points: CurvePoint[];
  interpolation: 'linear' | 'smooth';
}

export interface RangeValue {
  min: number;
  max: number;
}

export interface ColorPoint {
  time: number;
  color: Color;
}

export interface ColorGradient {
  points: ColorPoint[];
}

export interface EmitterSettings {
  position: Vec2;
  shape: 'point' | 'circle' | 'rectangle' | 'roundedRect' | 'line';
  shapeRadius: number;
  shapeWidth: number;
  shapeHeight: number;
  roundRadius: number;
  lineLength: number;
  emissionMode: 'area' | 'edge';
  angle: number;
  angleSpread: number;
  rate: number;
  maxParticles: number;

  emissionType: 'continuous' | 'burst' | 'duration';
  burstCount: number;
  burstCycles: number;
  burstInterval: number;
  durationStart: number;
  durationEnd: number;

  looping: boolean;
  prewarm: boolean;
  startDelay: number;
}

export interface ExportSettings {
  exportTranslate: boolean;
  exportRotate: boolean;
  exportScale: boolean;
  exportColor: boolean;

  positionThreshold: number;
  rotationThreshold: number;
  scaleThreshold: number;
  colorThreshold: number;
}

export interface ParticleSettings {
  emitter: EmitterSettings;
  lifeTimeMin: number;
  lifeTimeMax: number;

  gravityOverLifetime: Curve;
  gravityRange: RangeValue;
  dragOverLifetime: Curve;
  dragRange: RangeValue;

  sizeXOverLifetime: Curve;
  sizeXRange: RangeValue;
  sizeYOverLifetime: Curve;
  sizeYRange: RangeValue;
  initialSpeedRange: RangeValue;
  speedOverLifetime: Curve;
  speedRange: RangeValue;
  weightOverLifetime: Curve;
  weightRange: RangeValue;
  spinOverLifetime: Curve;
  spinRange: RangeValue;
  attractionOverLifetime: Curve;
  attractionRange: RangeValue;

  noiseStrengthOverLifetime: Curve;
  noiseStrengthRange: RangeValue;
  noiseFrequencyRange: RangeValue;
  noiseSpeedRange: RangeValue;

  angularVelocityOverLifetime: Curve;
  angularVelocityRange: RangeValue;

  vortexStrengthOverLifetime: Curve;
  vortexStrengthRange: RangeValue;
  vortexPoint: Vec2;
  showVortexVisualization: boolean;
  scaleRatioX: number;
  scaleRatioY: number;

  colorOverLifetime: ColorGradient;

  duration: number;
  fps: number;
  frameSize: number;

  attractionPoint: Vec2;

  particleSprite: 'circle' | 'star' | 'polygon' | 'glow' | 'custom';
  customSpriteData: string | null;

  spawnAngleMode: 'alignMotion' | 'specific' | 'random' | 'range';
  spawnAngle: number;
  spawnAngleMin: number;
  spawnAngleMax: number;

  exportSettings: ExportSettings;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  baseSpeed: number;
  rotation: number;
  baseSpinRate: number;
  baseAngularVelocity: number;
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

export interface BakedFrame {
  time: number;
  particles: Map<number, {
    x: number;
    y: number;
    rotation: number;
    scale: number;
    scaleX: number;
    scaleY: number;
    alpha: number;
    color: Color;
  }>;
}

export interface AtlasRegion {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  atlasIndex: number;
}
