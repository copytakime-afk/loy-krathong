const photoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const photoPrefix = "data:image/jpeg;base64,";
const maxPhotoBytes = 48 * 1024;
const maxEncodedLength = photoPrefix.length + Math.ceil(maxPhotoBytes / 3) * 4;
const instagramHosts = new Set(["instagram.com", "www.instagram.com"]);
const handlePattern = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/i;

export function instagramName(value) {
  if (typeof value !== "string") return "";
  let name = value.trim().replace(/^@/, "");
  if (/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i.test(name)) {
    try {
      const url = new URL(/^https?:\/\//i.test(name) ? name : `https://${name}`);
      if (!instagramHosts.has(url.hostname) || url.username || url.password || url.port) return "";
      const paths = url.pathname.match(/^\/([^/]+)\/?$/);
      name = paths ? decodeURIComponent(paths[1]) : "";
    } catch {
      return "";
    }
  }
  return handlePattern.test(name) ? name.toLowerCase() : "";
}

export function readPhoto(value) {
  if (typeof value !== "string" || value.length > maxEncodedLength || !value.startsWith(photoPrefix + "/9j/")) return "";
  const data = value.slice(photoPrefix.length);
  return data.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(data) ? value : "";
}

export async function preparePhoto(file) {
  if (!photoTypes.has(file.type)) throw new Error("เลือกรูป JPG, PNG หรือ WebP");
  if (file.size > 20 * 1024 * 1024) throw new Error("เลือกรูปขนาดไม่เกิน 20 MB");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    for (const size of [480, 360, 240]) {
      const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = "#20172b";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [.84, .68, .52]) {
        const photo = readPhoto(canvas.toDataURL("image/jpeg", quality));
        if (photo) return photo;
      }
    }
    throw new Error("รูปนี้ย่อไม่ได้ ลองเลือกรูปอื่น");
  } finally {
    URL.revokeObjectURL(url);
  }
}
