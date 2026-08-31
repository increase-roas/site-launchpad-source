import type { PlaceholderDescriptor } from "./placeholderMedia";

const FONT_STACK = "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";

function fittedFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  weight: string,
  preferred: number,
  maxWidth: number,
): number {
  let size = preferred;
  while (size > 8) {
    context.font = `${weight} ${size}px ${FONT_STACK}`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

function drawCenteredText(
  context: CanvasRenderingContext2D,
  text: string,
  weight: string,
  preferred: number,
  maxWidth: number,
  centerX: number,
  y: number,
): void {
  const size = fittedFontSize(context, text, weight, preferred, maxWidth);
  context.font = `${weight} ${size}px ${FONT_STACK}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, centerX, y, maxWidth);
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error("The placeholder image could not be encoded."))),
      mimeType,
    );
  });
}

/**
 * Paints a flat, labelled card at the slot's exact target size. The artwork is
 * deliberately plain: it exists to make the layout legible during development,
 * not to stand in for real photography.
 */
export async function renderPlaceholderImage(descriptor: PlaceholderDescriptor): Promise<File> {
  const { width, height, accentHue } = descriptor;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot generate placeholder images.");

  const shortEdge = Math.min(width, height);
  const inset = Math.round(shortEdge * 0.045);

  context.fillStyle = `hsl(${accentHue} 46% 93%)`;
  context.fillRect(0, 0, width, height);

  const gridStep = Math.max(24, Math.round(shortEdge / 12));
  context.strokeStyle = `hsl(${accentHue} 42% 84%)`;
  context.lineWidth = Math.max(1, Math.round(shortEdge / 600));
  context.beginPath();
  for (let x = gridStep; x < width; x += gridStep) {
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
  }
  for (let y = gridStep; y < height; y += gridStep) {
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
  }
  context.stroke();

  context.strokeStyle = `hsl(${accentHue} 48% 62%)`;
  context.lineWidth = Math.max(2, Math.round(shortEdge / 150));
  context.strokeRect(inset, inset, width - inset * 2, height - inset * 2);

  const tick = Math.round(shortEdge * 0.07);
  context.lineWidth = Math.max(3, Math.round(shortEdge / 90));
  context.beginPath();
  for (const [cornerX, cornerY, dirX, dirY] of [
    [inset, inset, 1, 1],
    [width - inset, inset, -1, 1],
    [inset, height - inset, 1, -1],
    [width - inset, height - inset, -1, -1],
  ] as const) {
    context.moveTo(cornerX + tick * dirX, cornerY);
    context.lineTo(cornerX, cornerY);
    context.lineTo(cornerX, cornerY + tick * dirY);
  }
  context.stroke();

  const textWidth = width - inset * 4;
  const centerX = width / 2;

  context.fillStyle = `hsl(${accentHue} 40% 38%)`;
  drawCenteredText(
    context,
    descriptor.groupLabel.toUpperCase(),
    "600",
    Math.round(shortEdge * 0.05),
    textWidth,
    centerX,
    height / 2 - shortEdge * 0.16,
  );

  context.fillStyle = `hsl(${accentHue} 55% 22%)`;
  drawCenteredText(
    context,
    descriptor.label,
    "700",
    Math.round(shortEdge * 0.11),
    textWidth,
    centerX,
    height / 2,
  );

  context.fillStyle = `hsl(${accentHue} 30% 45%)`;
  drawCenteredText(
    context,
    descriptor.caption,
    "500",
    Math.round(shortEdge * 0.055),
    textWidth,
    centerX,
    height / 2 + shortEdge * 0.15,
  );

  const blob = await canvasToBlob(canvas, descriptor.mimeType);
  return new File([blob], descriptor.filename, { type: descriptor.mimeType });
}
