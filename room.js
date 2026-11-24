export const capacity = 4;
export const historyLimit = 18;
export const roomCodePattern = /^[0-9A-F]{12}$/;
const styles = new Set(["gold", "rose", "violet"]);
const idPattern = /^[0-9a-f-]{36}$/;
const prefix = "loy-krathong-v1-";
const timeoutMs = 15000;

export function randomCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function cleanText(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function readFloat(value) {
  if (!value || typeof value.id !== "string" || !idPattern.test(value.id) || !styles.has(value.style)) return null;
  return { id: value.id, name: cleanText(value.name, 24), wish: cleanText(value.wish, 120), style: value.style };
}

export class RiverRoom {
  constructor({ Peer, code, hosting, update, failure }) {
    this.hosting = hosting;
    this.code = code;
    this.update = update;
    this.failure = failure;
    this.guests = new Set();
    this.floats = [];
    this.seen = new Set();
    this.pending = new Set();
    this.ready = false;
    this.active = true;
    this.peer = hosting ? new Peer(prefix + code) : new Peer();
    this.timer = setTimeout(() => this.fail("เชื่อมต่อไม่ทัน ลองใหม่หรือเปลี่ยนเครือข่าย"), timeoutMs);
    this.peer.on("open", () => this.open());
    this.peer.on("connection", connection => this.accept(connection));
    this.peer.on("error", error => this.peerError(error));
    this.peer.on("disconnected", () => {
      if (this.active && this.peer.disconnected && !this.peer.destroyed) this.peer.reconnect();
    });
  }

  open() {
    if (!this.active || this.ready || this.link) return;
    if (this.hosting) {
      this.ready = true;
      clearTimeout(this.timer);
      this.snapshot();
      return;
    }
    this.link = this.peer.connect(prefix + this.code, { reliable: true, serialization: "json", label: "river-v1" });
    if (!this.link) {
      this.fail("เปิดการเชื่อมต่อไม่ได้ ลองเข้าห้องอีกครั้ง");
      return;
    }
    this.link.on("data", data => this.receive(data));
    this.link.on("close", () => this.fail("ห้องปิดหรือขาดการเชื่อมต่อ"));
    this.link.on("error", () => this.fail("การเชื่อมต่อสะดุด ลองเข้าห้องอีกครั้ง"));
  }

  peerError(error) {
    if (!this.active) return;
    if (error.type === "peer-unavailable" && !this.hosting) {
      this.fail("ไม่พบห้องนี้ ให้เพื่อนเปิดห้องและตรวจรหัสอีกครั้ง");
    } else if (error.type === "unavailable-id" && this.hosting) {
      this.fail("รหัสห้องซ้ำ กดสร้างห้องอีกครั้ง");
    } else if (!this.ready || this.peer.destroyed) {
      this.fail("เชื่อมต่อห้องไม่ได้ ลองใหม่หรือเปลี่ยนเครือข่าย");
    }
  }

  accept(connection) {
    if (!this.active || !this.hosting || connection.label !== "river-v1") {
      connection.close();
      return;
    }
    const remove = () => {
      if (this.guests.delete(connection) && this.active) this.snapshot();
    };
    connection.on("open", () => {
      if (!this.active) {
        connection.close();
        return;
      }
      if (this.guests.size + 1 >= capacity) {
        connection.send({ type: "full" });
        setTimeout(() => connection.close(), 700);
        return;
      }
      this.guests.add(connection);
      this.snapshot();
    });
    connection.on("close", remove);
    connection.on("error", () => {
      remove();
      connection.close();
    });
    connection.on("data", data => {
      if (!this.active || !this.guests.has(connection) || data?.type !== "float") return;
      if (this.add(data.float)) this.snapshot();
    });
  }

  add(value) {
    const float = readFloat(value);
    if (!float || this.seen.has(float.id)) return false;
    this.seen.add(float.id);
    this.floats = [...this.floats.slice(-(historyLimit - 1)), float];
    return true;
  }

  receive(data) {
    if (!this.active) return;
    if (data?.type === "full") {
      this.fail("ห้องนี้เต็มแล้ว (4 คน)");
      return;
    }
    if (data?.type !== "snapshot" || !Array.isArray(data.floats) || !Number.isInteger(data.count) || data.count < 2 || data.count > capacity) return;
    const floats = data.floats.slice(-historyLimit).map(readFloat).filter(Boolean);
    for (const float of floats) this.pending.delete(float.id);
    clearTimeout(this.timer);
    this.ready = true;
    this.update({ floats, count: data.count });
  }

  snapshot() {
    const state = { type: "snapshot", floats: this.floats, count: this.guests.size + 1 };
    for (const guest of this.guests) {
      if (guest.open) guest.send(state);
    }
    this.update(state);
  }

  launch(float) {
    if (!this.active || !this.ready) return false;
    if (this.hosting) {
      if (!this.add(float)) return false;
      this.snapshot();
      return true;
    }
    if (!this.link?.open) return false;
    this.pending.add(float.id);
    this.link.send({ type: "float", float });
    setTimeout(() => {
      if (this.pending.has(float.id)) this.fail("ไม่ได้รับการยืนยันว่าลอยสำเร็จ ลองเข้าห้องอีกครั้ง");
    }, timeoutMs);
    return true;
  }

  fail(message) {
    if (!this.active) return;
    this.close();
    this.failure(message);
  }

  close() {
    this.active = false;
    clearTimeout(this.timer);
    this.pending.clear();
    this.peer.destroy();
  }
}
