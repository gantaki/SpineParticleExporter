/**
 * Sprite Generation
 * Creates procedural particle sprites (circle, star, glow, etc.)
 */

export type SpriteType =
  | "circle"
  | "star"
  | "polygon"
  | "glow"
  | "needle"
  | "raindrop"
  | "snowflake"
  | "smoke";

/**
 * Creates a particle sprite canvas of the given type
 */
export function createParticleSprite(
  type: SpriteType,
  size: number = 64
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const center = size / 2;

  ctx.clearRect(0, 0, size, size);

  switch (type) {
    case "circle":
      drawCircle(ctx, center, size);
      break;
    case "glow":
      drawGlow(ctx, center, size);
      break;
    case "star":
      drawStar(ctx, center, size);
      break;
    case "polygon":
      drawPolygon(ctx, center, size);
      break;
    case "needle":
      drawNeedle(ctx, center, size);
      break;
    case "raindrop":
      drawRaindrop(ctx, center, size);
      break;
    case "snowflake":
      drawSnowflake(ctx, center, size);
      break;
    case "smoke":
      drawSmoke(ctx, center, size);
      break;
  }

  return canvas;
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  center: number,
  size: number
): void {
  const radius = size / 2 - 2;
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  center: number,
  size: number
): void {
  const radius = size / 2 - 2;
  const gradient = ctx.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    radius
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.8)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  center: number,
  size: number
): void {
  const outerRadius = size / 2 - 2;
  const innerRadius = outerRadius * 0.5;
  const spikes = 5;

  ctx.fillStyle = "white";
  ctx.beginPath();

  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.closePath();
  ctx.fill();
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  center: number,
  size: number
): void {
  const radius = size / 2 - 2;
  const sides = 6;

  ctx.fillStyle = "white";
  ctx.beginPath();

  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.closePath();
  ctx.fill();
}

function drawNeedle(
  ctx: CanvasRenderingContext2D,
  center: number,
  size: number
): void {
  const halfWidth = size * 0.08;
  const halfLength = size * 0.4;
  const gradient = ctx.createLinearGradient(
    center,
    center - halfLength,
    center,
    center + halfLength
  );
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.4)");
  gradient.addColorStop(0.5, "rgba(255,255,255,1)");
  gradient.addColorStop(0.75, "rgba(255,255,255,0.4)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(
    center - halfWidth,
    center - halfLength,
    halfWidth * 2,
    halfLength * 2,
    halfWidth
  );
  ctx.fill();
}

function drawRaindrop(
  ctx: CanvasRenderingContext2D,
  center: number,
  size: number
): void {
  const radius = size * 0.35;
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(center, center - radius);
  ctx.quadraticCurveTo(center + radius, center, center, center + radius);
  ctx.quadraticCurveTo(center - radius, center, center, center - radius);
  ctx.fill();
}

function drawSnowflake(
  ctx: CanvasRenderingContext2D,
  center: number,
  size: number
): void {
  const armLength = size * 0.28;
  ctx.strokeStyle = "white";
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.lineCap = "round";

  const drawArm = (angle: number) => {
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -armLength);
    ctx.lineTo(0, armLength);
    ctx.moveTo(-armLength * 0.6, -armLength * 0.2);
    ctx.lineTo(armLength * 0.6, armLength * 0.2);
    ctx.stroke();
    ctx.restore();
  };

  for (let i = 0; i < 3; i++) {
    drawArm((Math.PI / 3) * i);
    drawArm((Math.PI / 3) * i + Math.PI / 6);
  }
}

function drawSmoke(
  ctx: CanvasRenderingContext2D,
  center: number,
  size: number
): void {
  const radius = size * 0.42;
  const gradient = ctx.createRadialGradient(
    center,
    center,
    radius * 0.1,
    center,
    center,
    radius
  );
  gradient.addColorStop(0, "rgba(255,255,255,0.45)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.2)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(
    center - radius * 0.25,
    center - radius * 0.2,
    radius * 0.45,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.globalAlpha = 1;
}
