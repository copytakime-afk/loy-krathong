import { drawKrathong, startRiverLights, styles } from "./art.js";
import { capacity, historyLimit, randomCode, RiverRoom, roomCodePattern } from "./room.js";

const byId = id => document.getElementById(id);
const wishForm = byId("wish-form");
const launchButton = byId("launch");
const roomDialog = byId("room-dialog");
const roomState = byId("room-state");
const roomButton = byId("room-button");
const roomNotice = byId("room-notice");
const joinCode = byId("join-code");
const inviteLink = byId("invite-link");
const wishDialog = byId("wish-dialog");
const riverStatus = byId("river-status");
const floatsOnWater = byId("floating");
const floatList = byId("float-list");
const solo = [];
const personal = new Map();
let room, connecting = false, count = 0, waiting = "", riverTimer, peerLoader;
let visibleFloats = [];

for (const canvas of document.querySelectorAll("canvas[data-style]")) drawKrathong(canvas, canvas.dataset.style);
drawKrathong(byId("brand-mark"), "gold");
startRiverLights(byId("river-lights"));

function getPeer() {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  if (peerLoader) return peerLoader;
  peerLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js";
    const timer = setTimeout(failed, 8500);
    function failed() {
      clearTimeout(timer);
      script.remove();
      reject(new Error("PeerJS load failed"));
    }
    script.onload = () => {
      if (!globalThis.Peer) {
        failed();
        return;
      }
      clearTimeout(timer);
      resolve(globalThis.Peer);
    };
    script.onerror = failed;
    document.head.append(script);
  }).catch(error => {
    peerLoader = undefined;
    throw error;
  });
  return peerLoader;
}

function roomStatus() {
  const live = Boolean(room?.ready);
  roomState.classList.toggle("live", live);
  roomState.lastChild.textContent = connecting ? " กำลังเชื่อมต่อ" : live ? ` ในห้อง ${count}/${capacity}` : " ลอยคนเดียว";
  roomButton.textContent = live ? "ห้องของเรา" : "＋ ชวนเพื่อน";
  byId("room-lobby").hidden = live;
  byId("room-share").hidden = !live;
  byId("host-room").disabled = connecting;
  byId("join-form").querySelector("button").disabled = connecting;
  launchButton.disabled = connecting || Boolean(waiting);
  if (live) {
    const url = new URL(location.href);
    url.searchParams.set("room", room.code);
    url.hash = "";
    inviteLink.value = url.href;
  }
}

function announce(message) {
  clearTimeout(riverTimer);
  riverStatus.textContent = message;
  riverTimer = setTimeout(() => { riverStatus.textContent = ""; }, 6500);
}

function showWish(float) {
  byId("wish-title").textContent = `กระทงของ${float.name || "คนริมฝั่ง"}`;
  drawKrathong(byId("wish-art"), float.style);
  const ownWish = personal.get(float.id);
  byId("wish-text").textContent = ownWish ? `${ownWish}\n\nคำอธิษฐานส่วนตัว` : float.wish || "กระทงใบนี้ไม่มีคำอธิษฐานที่เปิดให้ดู";
  wishDialog.showModal();
}

const positions = [
  [22, 58], [45, 47], [67, 69], [84, 47],
  [12, 20], [32, 15], [57, 17], [74, 17],
  [91, 19], [36, 87], [57, 90], [81, 86],
];

function renderFloats(next, animateNew = true) {
  const previousIds = new Set(visibleFloats.map(float => float.id));
  const nextIds = new Set(next.map(float => float.id));
  for (const id of previousIds) {
    if (!nextIds.has(id) && !solo.some(float => float.id === id)) personal.delete(id);
  }
  const waterFloats = next.slice(-positions.length);
  const waterIds = new Set(waterFloats.map(float => float.id));
  for (const button of Array.from(floatsOnWater.children)) {
    if (!waterIds.has(button.dataset.id)) button.remove();
  }
  const visibleButtons = new Map(Array.from(floatsOnWater.children, button => [button.dataset.id, button]));
  for (const float of waterFloats) {
    let button = visibleButtons.get(float.id);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = animateNew && !previousIds.has(float.id) ? "float-object arriving" : "float-object";
      button.dataset.id = float.id;
      button.setAttribute("aria-label", `ดูกระทงของ${float.name || "คนริมฝั่ง"}`);
      button.addEventListener("click", () => showWish(float));
      const canvas = document.createElement("canvas");
      canvas.width = 220;
      canvas.height = 150;
      canvas.setAttribute("aria-hidden", "true");
      drawKrathong(canvas, float.style);
      button.append(canvas);
      floatsOnWater.append(button);
    }
  }
  const occupied = new Set();
  for (const button of floatsOnWater.children) {
    if (button.dataset.position) occupied.add(Number(button.dataset.position));
  }
  for (const button of floatsOnWater.children) {
    if (button.dataset.position) continue;
    const index = positions.findIndex((_, i) => !occupied.has(i));
    const [x, y] = positions[index];
    occupied.add(index);
    button.dataset.position = String(index);
    button.style.setProperty("--x", `${x}%`);
    button.style.setProperty("--y", `${y}%`);
    button.style.setProperty("--size", `${Math.round(49 + y * .76)}px`);
    button.style.setProperty("--delay", `${-index * .63}s`);
  }
  if (next.length !== visibleFloats.length || next.some((float, index) => float.id !== visibleFloats[index].id)) {
    floatList.replaceChildren();
    for (const float of [...next].reverse()) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.className = "quiet-button";
      button.type = "button";
      button.textContent = `${float.name || "คนริมฝั่ง"} · ${styles[float.style].label}`;
      button.addEventListener("click", () => showWish(float));
      item.append(button);
      floatList.append(item);
    }
  }
  visibleFloats = next;
  byId("float-count").textContent = `${next.length} ใบ`;
  byId("empty-ledger").hidden = next.length > 0;
}

function showRoomDialog() {
  if (!roomDialog.open) roomDialog.showModal();
}

function forgetRoom() {
  const oldRoom = room;
  room = undefined;
  oldRoom?.close();
  connecting = false;
  if (waiting) personal.delete(waiting);
  waiting = "";
  count = 0;
  renderFloats(solo, false);
  roomStatus();
}

function roomFailed(message) {
  forgetRoom();
  roomNotice.textContent = message;
  showRoomDialog();
  announce(message);
}

async function enterRoom(code, hosting) {
  if (connecting || room?.ready) return;
  if (!window.isSecureContext || !globalThis.RTCPeerConnection) {
    roomFailed("ห้องออนไลน์ต้องเปิดเว็บผ่าน HTTPS หรือ localhost");
    return;
  }
  if (!roomCodePattern.test(code)) {
    roomNotice.textContent = "ใส่รหัสจากลิงก์เชิญ 12 ตัว";
    return;
  }
  joinCode.value = hosting ? "" : code;
  connecting = true;
  roomNotice.textContent = hosting ? "กำลังสร้างห้อง…" : "กำลังเข้าห้อง…";
  roomStatus();
  try {
    const Peer = await getPeer();
    room = new RiverRoom({
      Peer, code, hosting,
      update({ floats, count: participants }) {
        const justJoined = connecting;
        connecting = false;
        count = participants;
        if (waiting && floats.some(float => float.id === waiting)) finishLaunch();
        renderFloats(floats, !justJoined);
        roomStatus();
        if (justJoined) roomNotice.textContent = hosting ? "เปิดห้องแล้ว ส่งลิงก์นี้ให้เพื่อน" : "เข้าห้องแล้ว เริ่มลอยกระทงได้เลย";
      },
      failure: roomFailed,
    });
  } catch {
    roomFailed("โหลดระบบห้องออนไลน์ไม่ได้ ลองใหม่เมื่อเชื่อมต่ออินเทอร์เน็ต");
  }
}

function finishLaunch() {
  waiting = "";
  byId("wish").value = "";
  launchButton.disabled = false;
  announce("ปล่อยกระทงแล้ว กดที่กระทงบนผิวน้ำเพื่อเปิดดู");
  if (window.innerWidth <= 700) {
    document.querySelector(".river").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }
}

wishForm.addEventListener("submit", event => {
  event.preventDefault();
  if (connecting || waiting) return;
  const fields = new FormData(wishForm);
  const wish = fields.get("wish").trim();
  const isPrivate = byId("private-wish").checked;
  const id = crypto.randomUUID();
  const float = { id, name: fields.get("name").trim(), wish: isPrivate ? "" : wish, style: fields.get("style") };
  if (isPrivate && wish) personal.set(id, wish);
  if (room?.ready) {
    waiting = id;
    launchButton.disabled = true;
    if (!room.launch(float)) roomFailed("ส่งกระทงไม่ได้ ลองเข้าห้องอีกครั้ง");
    return;
  }
  if (solo.length >= historyLimit) personal.delete(solo.shift().id);
  solo.push(float);
  renderFloats([...solo]);
  finishLaunch();
});

roomButton.addEventListener("click", showRoomDialog);
byId("host-room").addEventListener("click", () => enterRoom(randomCode(), true));
byId("join-form").addEventListener("submit", event => {
  event.preventDefault();
  enterRoom(joinCode.value.trim().toUpperCase(), false);
});
byId("leave-room").addEventListener("click", () => {
  forgetRoom();
  const url = new URL(location.href);
  url.searchParams.delete("room");
  history.replaceState(null, "", url);
  roomNotice.textContent = "ออกจากห้องแล้ว";
});
byId("copy-invite").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    roomNotice.textContent = "คัดลอกลิงก์แล้ว";
  } catch {
    inviteLink.focus();
    inviteLink.select();
    roomNotice.textContent = "เลือกลิงก์แล้ว คัดลอกไปส่งเพื่อนได้เลย";
  }
});

const musicButton = byId("music-button");
const musicPanel = byId("music-panel");
const musicPlayer = byId("music-player");

function closeMusic() {
  musicPlayer.replaceChildren();
  musicPanel.hidden = true;
  musicButton.setAttribute("aria-expanded", "false");
  musicButton.focus();
}

musicButton.addEventListener("click", () => {
  if (!musicPanel.hidden) {
    closeMusic();
    return;
  }
  const player = document.createElement("iframe");
  player.title = "รอยกระทง (คิดฮอดเจ้าหลาย) โดย คณะขวัญใจ";
  player.src = "https://www.youtube-nocookie.com/embed/B3oe2dZfm0M?loop=1&playlist=B3oe2dZfm0M";
  player.allow = "encrypted-media; picture-in-picture; fullscreen";
  player.referrerPolicy = "strict-origin-when-cross-origin";
  musicPlayer.append(player);
  musicPanel.hidden = false;
  musicButton.setAttribute("aria-expanded", "true");
  byId("music-title").focus({ preventScroll: true });
  musicPanel.scrollIntoView({ block: "nearest" });
});
byId("close-music").addEventListener("click", closeMusic);

window.addEventListener("pagehide", event => {
  if (!event.persisted) room?.close();
});

const invited = new URLSearchParams(location.search).get("room");
if (invited) {
  showRoomDialog();
  enterRoom(invited.trim().toUpperCase(), false);
}
