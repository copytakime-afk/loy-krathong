export const styles = {
  gold: { label: "ดาวเรือง", light: "#ffd96b", mid: "#faab40", dark: "#bb5c26" },
  rose: { label: "บัวชมพู", light: "#ffb8d3", mid: "#e777a9", dark: "#9d467c" },
  violet: { label: "กล้วยไม้", light: "#e4b8ff", mid: "#ad7cda", dark: "#68459a" },
};

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  ctx.fill();
}

function leaf(ctx, x, y, height, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-7, 2);
  ctx.quadraticCurveTo(-10, -height * .48, 0, -height);
  ctx.quadraticCurveTo(11, -height * .42, 7, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#f1e6ab54";
  ctx.lineWidth = .65;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -height + 4);
  ctx.stroke();
  ctx.restore();
}

function blossom(ctx, x, y, radius, palette, style) {
  const petals = style === "gold" ? 9 : 6;
  const stretch = style === "gold" ? .76 : 1.12;
  for (let index = 0; index < petals; index++) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(index * 2 * Math.PI / petals);
    ellipse(ctx, 0, -radius * .54, radius * .45, radius * stretch * .67, index % 2 ? palette.mid : palette.light);
    ctx.restore();
  }
  ellipse(ctx, x, y, radius * .39, radius * .32, palette.dark);
  ellipse(ctx, x - .5, y - .8, radius * .20, radius * .15, "#ffde78");
}

export function drawKrathong(canvas, style) {
  const ctx = canvas.getContext("2d");
  const palette = styles[style];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  const scale = Math.min(canvas.width / 120, canvas.height / 81);
  ctx.translate((canvas.width - 120 * scale) / 2, (canvas.height - 81 * scale) / 2);
  ctx.scale(scale, scale);

  ellipse(ctx, 60, 72, 46, 5, "#f7bb6a1f");
  ellipse(ctx, 60, 64, 40, 10, "#1b483d");
  ellipse(ctx, 60, 59, 42, 10, "#456549");
  for (let index = 0; index < 9; index++) {
    const x = 28 + index * 8;
    leaf(ctx, x, 55 + Math.abs(index - 4) * 1.1, 19 + (index % 3) * 4,
      (index - 4) * .18, index % 2 ? "#59835b" : "#3f694b");
  }

  ctx.strokeStyle = "#b58862";
  ctx.lineWidth = 1.25;
  for (const [x, tilt] of [[53, -3], [69, 6], [72, 9]]) {
    ctx.beginPath();
    ctx.moveTo(x, 54);
    ctx.lineTo(x + tilt, 30);
    ctx.stroke();
    ellipse(ctx, x + tilt, 30, .9, 1.1, "#ed8a57");
  }
  const glow = ctx.createRadialGradient(60, 21, 1, 60, 21, 20);
  glow.addColorStop(0, "#ffd381a8");
  glow.addColorStop(1, "#ffd38100");
  ellipse(ctx, 60, 21, 20, 20, glow);
  ctx.fillStyle = "#efbb73";
  ctx.fillRect(57.5, 28, 5, 28);
  ctx.fillStyle = "#ffe6ad";
  ctx.fillRect(58, 28, 2.2, 27);
  ctx.fillStyle = "#ffca63";
  ctx.beginPath();
  ctx.moveTo(59.5, 27);
  ctx.bezierCurveTo(52, 25, 58, 19, 61, 13);
  ctx.bezierCurveTo(59, 19, 67, 24, 59.5, 27);
  ctx.fill();
  ellipse(ctx, 60, 24, 2.3, 3.4, "#fff1bb");

  const flowers = [[28, 56, 6], [41, 50, 8], [78, 49, 7], [92, 56, 6], [51, 58, 7], [68, 58, 8], [84, 59, 5], [36, 59, 5]];
  for (const [x, y, radius] of flowers) blossom(ctx, x, y, radius, palette, style);
  for (let index = 0; index < 9; index++) {
    const x = 28 + index * 8;
    leaf(ctx, x, 67 + (4 - Math.abs(index - 4)) * 1.6, 10,
      (index - 4) * -.19, index % 2 ? "#789762" : "#59815b");
  }
  ctx.restore();
}

export function startRiverLights(canvas) {
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const lights = Array.from({ length: 26 }, (_, i) => ({
    x: ((i * 691 + 119) % 977) / 977,
    y: .55 + ((i * 223) % 967) / 967 * .39,
    phase: i * 1.7,
    radius: .55 + (i % 4) * .28,
  }));
  let width, height, animation;

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    for (const light of lights) {
      const flicker = Math.sin(time / 1750 + light.phase);
      const x = light.x * width + flicker * 3;
      const y = light.y * height;
      const opacity = .19 + (flicker + 1) * .13;
      ellipse(ctx, x, y + 3, 4, 1.3, `rgba(242, 166, 93, ${opacity / 2})`);
      ellipse(ctx, x, y, light.radius, light.radius, `rgba(255, 206, 123, ${opacity})`);
    }
    if (!reduced.matches) animation = requestAnimationFrame(draw);
  }

  function reset() {
    cancelAnimationFrame(animation);
    const size = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    width = size.width;
    height = size.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(0);
  }

  new ResizeObserver(reset).observe(canvas);
  reduced.addEventListener("change", reset);
}
