// Half Dome PWA v2 — gear + calculator + landmark photo uploads (offline IndexedDB)
const GEAR_ITEMS = [
  ["Water 2L + filter", "Fill at Vernal bridge; filter at Little Yosemite Valley"],
  ["Food + energy gels", "Solid meal + gels; eat before cables"],
  ["Maps", "Download route before leaving service"],
  ["Rain shell + pants", "Fast-changing mountain weather"],
  ["Nitrile gardening gloves", "Grip on cables; pack them out"],
  ["Grippy footwear", "Broken-in trail runners / hiking shoes"],
  ["Permit (offline) + ID", "Check before Sub Dome; valid from 12am"],
];

const LANDMARKS = [
  { name: "Start — Happy Isles", mi: 0.0, note: "Toilets, 10-min walk from lot" },
  { name: "Vernal Fall Footbridge", mi: 0.8, note: "Last flush toilet + water" },
  { name: "Top of Mist Trail / Nevada Jct", mi: 2.8, note: "Left toward Half Dome" },
  { name: "Little Yosemite Valley", mi: 4.3, note: "Filter water, toilets" },
  { name: "Half Dome Trail Jct", mi: 6.0, note: "Bear left, 2 mi to summit" },
  { name: "Sub Dome base (permit check)", mi: 7.3, note: "Prep + weather check" },
  { name: "Base of cables", mi: 7.5, note: "Stow poles, gloves on" },
  { name: "Cables top", mi: 7.9, fixed: "cables-up", note: "Slow, pole-by-pole" },
  { name: "Summit + visor", mi: 8.0, fixed: "summit", note: "Stay back from edges" },
  { name: "Cables base (return)", mi: 8.5, fixed: "cables-down", note: "Descend facing rock if needed" },
  { name: "LYV (return)", mi: 11.7, note: "Retrace via forest", down: true },
  { name: "Nevada Fall JMT split", mi: 13.2, note: "Left to JMT, skip Mist descent" },
  { name: "Mist Trail rejoin", mi: 15.2, note: "Left over Vernal bridge" },
  { name: "Finish — Happy Isles", mi: 16.0, note: "Via JMT loop", down: true },
];

// Landmark direction cards — text editable per stop (localStorage), photos in IndexedDB
const DIR_KEY = "hd-directions-v1";
function getDirOverrides() {
  try { return JSON.parse(localStorage.getItem(DIR_KEY) || "{}"); } catch { return {}; }
}
function saveDirOverrides(map) {
  localStorage.setItem(DIR_KEY, JSON.stringify(map));
}
const DIRECTION_STOPS = [
  { key: "happy-isles", title: "Happy Isles Trailhead", mi: "0.0 mi", text: "Down loop road, cross Merced bridge, right at end. Last flush toilets." },
  { key: "vernal-footbridge", title: "Vernal Fall Footbridge", mi: "~0.8 mi", text: "Cross bridge, turn left. Last reliable water refill. Stay left at JMT junction for Mist Trail." },
  { key: "mist-top", title: "Top of Mist Trail / Nevada Junction", mi: "~2.8 mi", text: "Granite steps, mist zone. At the top switchbacks turn left toward Half Dome." },
  { key: "lyv", title: "Little Yosemite Valley", mi: "~4.3 mi", text: "Flat sandy trail. Filter from Merced if needed. Straight past campground." },
  { key: "hd-jct", title: "Half Dome Trail Junction", mi: "~6.0 mi", text: "Bear left onto Half Dome Trail. 2 miles to summit sign." },
  { key: "subdome", title: "Sub Dome Base", mi: "~7.3 mi", text: "Permit check. Stow ID deep. Steep granite steps then bare granite walk." },
  { key: "cables", title: "Cables + Summit", mi: "~7.5–8.0 mi", text: "Prep at base: gloves, weather check. Lower mellow, middle steep, top mellows. Continue to visor, stay back from edges." },
  { key: "jmt-return", title: "JMT Return", mi: "~8.7 mi back", text: "Descend cables, retrace to Nevada junction, left onto JMT down, rejoin Mist at bottom." },
];

const $ = (id) => document.getElementById(id);
function fmtElapsed(mins) {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
function fmtTime(date) {
  let h = date.getHours(), m = date.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

// --- Gear (editable: + add, − remove, persists offline) ---
const DEFAULT_GEAR = [
  { t: "Water 2L + filter", s: "Fill at Vernal bridge; filter at Little Yosemite Valley" },
  { t: "Food + energy gels", s: "Solid meal + gels; eat before cables" },
  { t: "Maps", s: "Download route before leaving service" },
  { t: "Rain shell + pants", s: "Fast-changing mountain weather" },
  { t: "Nitrile gardening gloves", s: "Grip on cables; pack them out" },
  { t: "Grippy footwear", s: "Broken-in trail runners / hiking shoes" },
  { t: "Permit (offline) + ID", s: "Check before Sub Dome; valid from 12am" },
];
const GEAR_KEY = "hd-gear-items-v3";
function getGearItems() {
  try {
    const raw = JSON.parse(localStorage.getItem(GEAR_KEY) || "null");
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {}
  // one-time migrate old v2 checked-map to new shape
  let oldChecked = {};
  try { oldChecked = JSON.parse(localStorage.getItem("hd-gear-v2") || "{}"); } catch {}
  return DEFAULT_GEAR.map((g, i) => ({ ...g, done: !!oldChecked[i] }));
}
function saveGearItems(items) {
  localStorage.setItem(GEAR_KEY, JSON.stringify(items));
}
function loadGear() {
  const items = getGearItems();
  saveGearItems(items);
  const ul = $("gear-list");
  ul.innerHTML = "";
  items.forEach((item, i) => {
    const li = document.createElement("li");
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = !!item.done;
    cb.setAttribute("aria-label", item.t);
    cb.onchange = () => {
      const cur = getGearItems();
      cur[i].done = cb.checked;
      saveGearItems(cur);
      updateGearCount();
    };
    const div = document.createElement("div");
    div.style.flex = "1";
    const b = document.createElement("strong"); b.textContent = item.t;
    div.appendChild(b);
    if (item.s) {
      const s = document.createElement("div"); s.className = "small muted"; s.textContent = item.s;
      div.appendChild(s);
    }
    const rm = document.createElement("button");
    rm.className = "ghost icon-btn"; rm.textContent = "−"; rm.title = `Remove ${item.t}`;
    rm.setAttribute("aria-label", `Remove ${item.t}`);
    rm.onclick = () => {
      const cur = getGearItems();
      cur.splice(i, 1);
      saveGearItems(cur);
      loadGear();
    };
    li.append(cb, div, rm);
    ul.appendChild(li);
  });
  updateGearCount();
}
function updateGearCount() {
  const items = getGearItems();
  const n = items.filter((g) => g.done).length;
  $("gear-count").textContent = `${n}/${items.length} packed`;
}
function addGearItem() {
  const input = $("gear-new");
  const title = (input.value || "").trim();
  if (!title) { input.focus(); return; }
  const cur = getGearItems();
  cur.push({ t: title, s: "", done: false, custom: true });
  saveGearItems(cur);
  input.value = "";
  loadGear();
}

// --- Calculator ---
function loadCalcInputs() {
  ["up-pace","down-pace","start-time","cables-up","summit-min","cables-down"].forEach(k => {
    const v = localStorage.getItem("hd-" + k);
    if (v !== null) $(k).value = v;
  });
}
function saveCalcInputs() {
  ["up-pace","down-pace","start-time","cables-up","summit-min","cables-down"].forEach(k => localStorage.setItem("hd-" + k, $(k).value));
}
function recalc() {
  saveCalcInputs();
  const up = Math.max(10, parseFloat($("up-pace").value) || 35);
  const down = Math.max(8, parseFloat($("down-pace").value) || 22);
  const fixedMap = {
    "cables-up": Math.max(0, parseFloat($("cables-up").value) || 0),
    "summit": Math.max(0, parseFloat($("summit-min").value) || 0),
    "cables-down": Math.max(0, parseFloat($("cables-down").value) || 0),
  };
  const [sh, sm] = ($("start-time").value || "05:00").split(":").map(Number);
  const start = new Date(); start.setHours(sh || 5, sm || 0, 0, 0);
  let elapsed = 0, prevMi = 0;
  const tbody = document.querySelector("#calc-table tbody");
  tbody.innerHTML = "";
  let cableArrival = null;
  LANDMARKS.forEach((lm, idx) => {
    if (lm.fixed) elapsed += fixedMap[lm.fixed];
    else {
      const seg = Math.max(0, lm.mi - prevMi);
      const isDownhill = lm.down || idx >= 10;
      elapsed += seg * (isDownhill ? down : up);
      prevMi = lm.mi;
    }
    const t = new Date(start.getTime() + elapsed * 60000);
    if (lm.name.startsWith("Base of cables") && !cableArrival) cableArrival = t;
    const tr = document.createElement("tr");
    [lm.name, lm.mi.toFixed(1) + " mi", lm.note, fmtElapsed(elapsed), fmtTime(t)].forEach(txt => {
      const td = document.createElement("td"); td.textContent = txt; tr.appendChild(td);
    });
    if (lm.name.includes("Base of cables") && t.getHours() >= 12) tr.style.background = "#3a2415";
    tbody.appendChild(tr);
  });
  const totalH = elapsed / 60;
  const w = $("calc-warning");
  if (cableArrival && cableArrival.getHours() >= 12) {
    w.innerHTML = `⚠️ Cables at <strong>${fmtTime(cableArrival)}</strong> — past noon risk. Start earlier. Total ~${totalH.toFixed(1)}h.`;
    w.style.color = "var(--warn)";
  } else {
    w.innerHTML = `✓ Cables at <strong>${cableArrival ? fmtTime(cableArrival) : "—"}</strong>. Total ~${totalH.toFixed(1)}h.`;
    w.style.color = "var(--accent)";
  }
}

// --- Landmark photos in IndexedDB (offline) ---
const DB_NAME = "halfdome-pwa", STORE = "photos";
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        s.createIndex("slot", "slot", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbAddPhotos(slot, files) {
  const imgs = Array.from(files).filter((f) => !f.type || f.type.startsWith("image/"));
  if (!imgs.length) return false;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    imgs.forEach((f) => store.add({ slot, blob: f, name: f.name || "dropped-image", ts: Date.now() }));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function dbAddUrl(slot, url, name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ slot, url, name: name || url, ts: Date.now() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
// Image dragged from another browser tab/window arrives as html/uri, not files
function extractImageUrlFromDrop(dt) {
  try {
    const html = dt.getData("text/html");
    if (html) {
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m && m[1] && /^https?:\/\//i.test(m[1])) return m[1];
    }
  } catch {}
  try {
    const uri = dt.getData("text/uri-list") || dt.getData("text/plain");
    if (uri) {
      const line = uri.split(/\r?\n/).map((s) => s.trim()).find((s) => /^https?:\/\//i.test(s));
      if (line && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(line)) return line;
    }
  } catch {}
  return null;
}
async function storeDroppedImageUrl(slot, url) {
  // Try to fetch + store bytes so it works offline; fall back to hotlink if CORS blocks
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("fetch " + res.status);
    const blob = await res.blob();
    if (!blob.type || blob.type.startsWith("image/")) {
      await dbAddPhotos(slot, [new File([blob], url.split("/").pop().split("?")[0] || "browser-image", { type: blob.type })]);
      return "offline";
    }
    throw new Error("not an image");
  } catch {
    await dbAddUrl(slot, url);
    return "linked";
  }
}
async function dbListBySlot(slot) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const idx = tx.objectStore(STORE).index("slot");
    const req = idx.getAll(slot);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function dbCountAll() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => resolve(0);
  });
}

function renderDirectionStops() {
  const wrap = $("landmarks");
  wrap.innerHTML = "";
  DIRECTION_STOPS.forEach((stop) => {
    const card = document.createElement("div");
    card.className = "landmark";
    const overrides = getDirOverrides();
    const isCustom = !!overrides[stop.key];
    const h3 = document.createElement("h3");
    h3.textContent = stop.title + (isCustom ? " •" : "");
    h3.title = isCustom ? "Customized description" : stop.title;
    const mi = document.createElement("div");
    mi.className = "mi";
    mi.textContent = stop.mi;
    const desc = document.createElement("p");
    desc.className = "small muted desc-text";
    desc.textContent = overrides[stop.key] || stop.text;
    const descBar = document.createElement("div");
    descBar.className = "desc-bar";
    const editBtn = document.createElement("button");
    editBtn.className = "ghost small-btn";
    editBtn.textContent = "Edit description";
    descBar.appendChild(editBtn);
    if (isCustom) {
      const revert = document.createElement("button");
      revert.className = "ghost small-btn";
      revert.textContent = "Revert";
      revert.title = "Restore default description";
      revert.onclick = () => {
        const cur = getDirOverrides();
        delete cur[stop.key];
        saveDirOverrides(cur);
        renderDirectionStops();
      };
      descBar.appendChild(revert);
    }
    card.append(h3, mi, desc, descBar);

    editBtn.onclick = () => {
      const ta = document.createElement("textarea");
      ta.className = "desc-edit";
      ta.value = overrides[stop.key] || stop.text;
      ta.rows = 4;
      const row = document.createElement("div");
      row.className = "actions";
      const save = document.createElement("button");
      save.textContent = "Save";
      const cancel = document.createElement("button");
      cancel.className = "ghost";
      cancel.textContent = "Cancel";
      row.append(save, cancel);
      desc.replaceWith(ta);
      descBar.replaceWith(row);
      ta.focus();
      save.onclick = () => {
        const cur = getDirOverrides();
        const v = ta.value.trim();
        if (v) cur[stop.key] = v;
        else delete cur[stop.key];
        saveDirOverrides(cur);
        renderDirectionStops();
      };
      cancel.onclick = () => renderDirectionStops();
    };
    const up = document.createElement("div");
    up.className = "uploader";
    up.dataset.slot = stop.key;
    up.innerHTML = `<strong class="small">📷 ${stop.title} photos</strong><div class="small muted">Upload, <strong>drag & drop</strong>, or <strong>paste</strong> — saved on device, multiple allowed.</div>`;
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = true;
    // capture on mobile still allows library choice since multiple is set
    const pasteBtn = document.createElement("button");
    pasteBtn.className = "ghost small-btn";
    pasteBtn.textContent = "Paste photo";
    pasteBtn.title = "Paste a photo from your clipboard into this landmark";
    pasteBtn.onclick = async () => {
      lastSlot = stop.key;
      setArmed(stop.key);
      if (await tryClipboardRead(stop.key)) setArmed(null);
    };
    const thumbs = document.createElement("div");
    thumbs.className = "thumbs";
    const empty = document.createElement("div");
    empty.className = "empty-note";
    empty.textContent = "No photos yet for this landmark. Drag images here or use Choose Files.";
    const dropHint = document.createElement("div");
    dropHint.className = "drop-hint";
    dropHint.textContent = "Drop images to save to this landmark";
    up.append(input, pasteBtn, dropHint, thumbs, empty);
    card.appendChild(up);
    wrap.appendChild(card);

    const refresh = async () => {
      const items = await dbListBySlot(stop.key).catch(() => []);
      thumbs.innerHTML = "";
      const bundled = BUNDLED[stop.key] || [];
      empty.style.display = (items.length + bundled.length) ? "none" : "block";
      bundled.forEach((rel) => thumbs.appendChild(bundledThumb(rel, stop.title)));
      items.sort((a, b) => a.ts - b.ts).forEach((it) => {
        const d = document.createElement("div");
        d.className = "thumb";
        const img = document.createElement("img");
        const objUrl = it.blob ? URL.createObjectURL(it.blob) : null;
        img.src = objUrl || it.url;
        img.alt = it.name || stop.title;
        img.loading = "lazy";
        syncBadge(d, it);
        if (!it.blob && it.url) {
          const tag = document.createElement("span");
          tag.className = "link-tag";
          tag.textContent = "link";
          tag.title = "Hotlinked (needs network) — re-add as file for full offline";
          d.appendChild(tag);
        }
        const del = document.createElement("button");
        del.className = "ghost"; del.textContent = "✕"; del.title = "Remove";
        del.onclick = async () => { await forgetCloudForLocal(it.id); await dbDelete(it.id); if (objUrl) URL.revokeObjectURL(objUrl); refresh(); updatePhotoCount(); };
        d.append(img, del);
        thumbs.appendChild(d);
      });
      updatePhotoCount();
      appendShared(up, stop.key, stop.title);
    };
    input.onchange = async () => {
      if (!input.files.length) return;
      lastSlot = stop.key;
      await dbAddPhotos(stop.key, input.files);
      input.value = "";
      await pushPending(stop.key);
      refresh();
    };
    // Drag & drop from files or from another browser tab
    ["dragenter", "dragover"].forEach((ev) =>
      up.addEventListener(ev, (e) => { e.preventDefault(); up.classList.add("drag-over"); })
    );
    ["dragleave", "drop"].forEach((ev) =>
      up.addEventListener(ev, (e) => { e.preventDefault(); if (ev !== "drop") up.classList.remove("drag-over"); })
    );
    up.addEventListener("drop", async (e) => {
      up.classList.remove("drag-over");
      lastSlot = stop.key;
      const dt = e.dataTransfer;
      let saved = false;
      if (dt && dt.files && dt.files.length) {
        saved = await dbAddPhotos(stop.key, dt.files).catch(() => false);
      }
      if (!saved && dt) {
        const url = extractImageUrlFromDrop(dt);
        if (url) {
          dropHint.textContent = "Saving browser image…";
          await storeDroppedImageUrl(stop.key, url);
          dropHint.textContent = "Drop images to save to this landmark";
          saved = true;
        }
      }
      if (saved) { await pushPending(stop.key); refresh(); }
    });
    slotRefreshers[stop.key] = refresh;
    refresh();
  });
}
async function updatePhotoCount() {
  const n = await dbCountAll();
  const el = $("photo-count");
  if (el) el.textContent = n ? `${n} photo${n === 1 ? "" : "s"} stored offline` : "no photos stored yet";
}

// --- Paste photos from clipboard (Ctrl+V / ⌘V) ---
let armedSlot = null;
let lastSlot = "map";
function setArmed(slot) {
  armedSlot = slot;
  if (slot) lastSlot = slot;
  document.querySelectorAll(".uploader.armed").forEach((el) => el.classList.remove("armed"));
  document.querySelectorAll(".armed-note").forEach((el) => el.remove());
  if (!slot) return;
  const zone = document.querySelector(`[data-slot="${slot}"]`);
  if (!zone) return;
  zone.classList.add("armed");
  const note = document.createElement("div");
  note.className = "armed-note";
  note.textContent = "Ready — press Ctrl+V (⌘V on Mac) to paste your photo here";
  zone.insertBefore(note, zone.firstChild);
  zone.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
async function savePastedFiles(slot, files) {
  const imgs = Array.from(files).filter((f) => !f.type || f.type.startsWith("image/"));
  if (!imgs.length || !slot || !slotRefreshers[slot]) return false;
  await dbAddPhotos(slot, imgs);
  await pushPending(slot);
  try { slotRefreshers[slot](); } catch {}
  return true;
}
async function tryClipboardRead(slot) {
  try {
    if (!navigator.clipboard || !navigator.clipboard.read) return false;
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = (item.types || []).find((t) => t.startsWith("image/"));
      if (type) {
        const blob = await item.getType(type);
        const file = new File([blob], "pasted." + type.split("/")[1].split("+")[0], { type });
        return await savePastedFiles(slot, [file]);
      }
    }
  } catch { /* denied — user pastes with Ctrl+V instead */ }
  return false;
}
document.addEventListener("paste", async (e) => {
  const files = e.clipboardData && e.clipboardData.files;
  if (!files || !files.length) return;
  const slot = armedSlot || lastSlot;
  if (!slot || !slotRefreshers[slot]) return;
  e.preventDefault();
  if (await savePastedFiles(slot, files)) setArmed(null);
});

// --- Shared cloud photos (KV via /api; silent local-only fallback) ---
let cloudEnabled = false;
const slotRefreshers = {};
const CLOUDMAP_KEY = "hd-cloudmap";
function getCloudMap() { try { return JSON.parse(localStorage.getItem(CLOUDMAP_KEY) || "{}"); } catch { return {}; } }
function saveCloudMap(m) { try { localStorage.setItem(CLOUDMAP_KEY, JSON.stringify(m)); } catch {} }

async function cloudPing() {
  try {
    const r = await fetch("./api/photos?limit=1", { cache: "no-store" });
    if (!r.ok) return false;
    return Array.isArray((await r.json()).photos);
  } catch { return false; }
}
async function cloudList(slot) {
  const r = await fetch("./api/photos?slot=" + encodeURIComponent(slot), { cache: "no-store" });
  if (!r.ok) throw new Error("list failed");
  return (await r.json()).photos || [];
}
// Upload any local photos in this slot that aren't on the cloud yet
async function pushPending(slot) {
  if (!cloudEnabled || !navigator.onLine) return false;
  const locals = await dbListBySlot(slot).catch(() => []);
  const map = getCloudMap();
  let changed = false;
  for (const it of locals) {
    if (map[it.id]) continue;
    try {
      let res;
      if (it.blob) {
        const fd = new FormData();
        fd.append("slot", slot);
        fd.append("file", it.blob, it.name || "photo");
        const r = await fetch("./api/photos", { method: "POST", body: fd });
        if (!r.ok) continue;
        res = await r.json();
      } else if (it.url) {
        const r = await fetch("./api/photos", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot, url: it.url }),
        });
        if (!r.ok) continue;
        res = await r.json();
      }
      if (res && res.key) { map[it.id] = res.key; changed = true; }
    } catch { /* offline or hiccup — retry on next sync */ }
  }
  if (changed) saveCloudMap(map);
  return changed;
}
// Delete the cloud copy linked to a local record (if any)
async function forgetCloudForLocal(localId) {
  const map = getCloudMap();
  const key = map[localId];
  if (!key) return;
  delete map[localId];
  saveCloudMap(map);
  if (cloudEnabled && navigator.onLine) {
    try { await fetch("./api/photo?key=" + encodeURIComponent(key), { method: "DELETE" }); } catch {}
  }
}
// Render "Shared from all devices" thumbs inside a photo zone
async function appendShared(zone, slot, label) {
  let wrap = zone.querySelector(":scope > .shared-wrap");
  if (wrap) wrap.innerHTML = "";
  else { wrap = document.createElement("div"); wrap.className = "shared-wrap"; zone.appendChild(wrap); }
  if (!cloudEnabled) return;
  let photos = [];
  try { photos = await cloudList(slot); } catch { return; }
  const known = new Set(Object.values(getCloudMap()));
  const fresh = photos.filter((p) => !known.has(p.key));
  if (!fresh.length) return;
  const note = zone.querySelector(":scope > .empty-note");
  if (note) note.style.display = "none";
  const head = document.createElement("div");
  head.className = "shared-head";
  head.textContent = "Shared from all devices ↓";
  wrap.appendChild(head);
  const grid = document.createElement("div");
  grid.className = "thumbs";
  fresh.forEach((p) => {
    const d = document.createElement("div");
    d.className = "thumb shared";
    const img = document.createElement("img");
    img.src = "./api/photo?key=" + encodeURIComponent(p.key);
    img.alt = p.name || ("Shared " + label);
    img.loading = "lazy";
    const del = document.createElement("button");
    del.className = "ghost"; del.textContent = "✕"; del.title = "Delete shared photo (all devices)";
    del.onclick = async () => {
      if (!confirm("Delete this shared photo for all devices?")) return;
      try { await fetch("./api/photo?key=" + encodeURIComponent(p.key), { method: "DELETE" }); } catch {}
      d.remove();
    };
    d.append(img, del);
    grid.appendChild(d);
  });
  wrap.appendChild(grid);
}
function syncBadge(d, it) {
  if (!cloudEnabled || !it.blob) return;
  const tag = document.createElement("span");
  if (getCloudMap()[it.id]) {
    tag.className = "link-tag";
    tag.style.color = "var(--accent)";
    tag.textContent = "shared ✓";
    tag.title = "On the cloud — visible on all devices";
  } else {
    tag.className = "pending-tag";
    tag.textContent = "queued";
    tag.title = "Saved on this device only — uploads automatically when online";
  }
  d.appendChild(tag);
}
async function bootCloud() {
  cloudEnabled = await cloudPing();
  if (!cloudEnabled) return;
  const slots = Object.keys(slotRefreshers);
  for (const s of slots) await pushPending(s);
  slots.forEach((s) => { try { slotRefreshers[s](); } catch {} });
  const pill = $("offline-pill");
  if (pill && navigator.onLine) pill.textContent = "● online — photos sync across devices";
}

// Photos shipped with the app (img/ + manifest.json): identical on every
// device, cached offline on first visit. Rendered first, locked (no delete).
let BUNDLED = {};
function bundledThumb(rel, label) {
  const d = document.createElement("div");
  d.className = "thumb bundled";
  const img = document.createElement("img");
  img.src = "./img/" + rel;
  img.alt = label || "Guide photo";
  img.loading = "lazy";
  const tag = document.createElement("span");
  tag.className = "link-tag";
  tag.style.color = "var(--accent)";
  tag.textContent = "guide";
  tag.title = "Ships with the app — on every device, offline";
  d.append(img, tag);
  return d;
}
fetch("./img/manifest.json", { cache: "no-store" })
  .then((r) => (r.ok ? r.json() : {}))
  .then((m) => {
    BUNDLED = m && typeof m === "object" ? m : {};
    Object.values(slotRefreshers).forEach((fn) => { try { fn(); } catch {} });
  })
  .catch(() => {});

// --- Map section: drag-in photos of a map (IndexedDB slot "map") ---
function renderMapPhotos() {
  const zone = $("map-drop"), input = $("map-input"),
    thumbs = $("map-thumbs"), empty = $("map-empty"), hint = $("map-hint");
  if (!zone) return;
  const mapPaste = $("map-paste");
  if (mapPaste && !mapPaste.dataset.wired) {
    mapPaste.dataset.wired = "1";
    mapPaste.onclick = async () => {
      lastSlot = "map";
      setArmed("map");
      if (await tryClipboardRead("map")) setArmed(null);
    };
  }
  const refresh = async () => {
    const items = await dbListBySlot("map").catch(() => []);
    thumbs.innerHTML = "";
    const bundled = BUNDLED["map"] || [];
    empty.style.display = (items.length + bundled.length) ? "none" : "block";
    bundled.forEach((rel) => thumbs.appendChild(bundledThumb(rel, "Trail map")));
    items.sort((a, b) => a.ts - b.ts).forEach((it) => {
      const d = document.createElement("div");
      d.className = "thumb";
      const img = document.createElement("img");
      const objUrl = it.blob ? URL.createObjectURL(it.blob) : null;
      img.src = objUrl || it.url;
        img.alt = it.name || "Trail map";
        img.loading = "lazy";
        syncBadge(d, it);
      if (!it.blob && it.url) {
        const tag = document.createElement("span");
        tag.className = "link-tag";
        tag.textContent = "link";
        tag.title = "Hotlinked (needs network) — re-add as file for full offline";
        d.appendChild(tag);
      }
      const del = document.createElement("button");
      del.className = "ghost"; del.textContent = "✕"; del.title = "Remove";
      del.onclick = async () => { await forgetCloudForLocal(it.id); await dbDelete(it.id); if (objUrl) URL.revokeObjectURL(objUrl); refresh(); updatePhotoCount(); };
      d.append(img, del);
      thumbs.appendChild(d);
    });
    updatePhotoCount();
    appendShared(zone, "map", "map");
  };
  input.onchange = async () => {
    if (!input.files.length) return;
    lastSlot = "map";
    await dbAddPhotos("map", input.files);
    input.value = "";
    await pushPending("map");
    refresh();
  };
  ["dragenter", "dragover"].forEach((ev) =>
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("drag-over"); })
  );
  ["dragleave", "drop"].forEach((ev) =>
    zone.addEventListener(ev, (e) => { e.preventDefault(); if (ev !== "drop") zone.classList.remove("drag-over"); })
  );
  zone.addEventListener("drop", async (e) => {
    zone.classList.remove("drag-over");
    lastSlot = "map";
    const dt = e.dataTransfer;
    let saved = false;
    if (dt && dt.files && dt.files.length) {
      saved = await dbAddPhotos("map", dt.files).catch(() => false);
    }
    if (!saved && dt) {
      const url = extractImageUrlFromDrop(dt);
      if (url) {
        hint.textContent = "Saving image…";
        await storeDroppedImageUrl("map", url);
          hint.textContent = "Drop map images to save here";
          saved = true;
        }
      }
      if (saved) { await pushPending("map"); refresh(); }
  });
    slotRefreshers["map"] = refresh;
    refresh();
}

// --- Food list (editable: + add, edit, − remove, persists offline) ---
const DEFAULT_FOOD = [
  { t: "Curry Village Pizza Patio", s: "Yosemite Valley • the classic post-Half-Dome slice + beer" },
  { t: "Base Camp Eatery", s: "Yosemite Valley Lodge • quick food-court refuel" },
  { t: "Mountain Room Restaurant", s: "Yosemite Valley Lodge • sit-down dinner" },
  { t: "The Ahwahnee Dining Room", s: "Yosemite Valley • fancier, reservations smart" },
  { t: "El Portal options", s: "Just outside the park • market + diners on the drive out" },
];
const FOOD_KEY = "hd-food-v1";
function getFood() {
  try {
    const raw = JSON.parse(localStorage.getItem(FOOD_KEY) || "null");
    if (Array.isArray(raw)) return raw;
  } catch {}
  return DEFAULT_FOOD.map((f) => ({ ...f }));
}
function saveFood(items) { try { localStorage.setItem(FOOD_KEY, JSON.stringify(items)); } catch {} }
function foodMapsUrl(title) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(title + " Yosemite");
}
function loadFood() {
  const items = getFood();
  saveFood(items);
  const wrap = $("food-list");
  wrap.innerHTML = "";
  if (!items.length) {
    const d = document.createElement("div");
    d.className = "empty-note";
    d.textContent = "No spots yet — add your own below.";
    wrap.appendChild(d);
  }
  items.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "food-row";
    const div = document.createElement("div");
    div.style.flex = "1";
    const b = document.createElement("strong");
    b.textContent = item.t;
    div.appendChild(b);
    if (item.s) {
      const s = document.createElement("div");
      s.className = "small muted";
      s.textContent = item.s;
      div.appendChild(s);
    }
    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "6px";
    const maps = document.createElement("a");
    maps.className = "ghost small-btn food-maps";
    maps.textContent = "Maps";
    maps.href = foodMapsUrl(item.t);
    maps.target = "_blank";
    maps.rel = "noopener";
    const edit = document.createElement("button");
    edit.className = "ghost small-btn";
    edit.textContent = "Edit";
    edit.setAttribute("aria-label", `Edit ${item.t}`);
    edit.onclick = () => editFoodRow(row, i);
    const rm = document.createElement("button");
    rm.className = "ghost icon-btn";
    rm.textContent = "−";
    rm.title = `Remove ${item.t}`;
    rm.setAttribute("aria-label", `Remove ${item.t}`);
    rm.onclick = () => {
      const cur = getFood();
      cur.splice(i, 1);
      saveFood(cur);
      loadFood();
    };
    btns.append(maps, edit, rm);
    row.append(div, btns);
    wrap.appendChild(row);
  });
}
function editFoodRow(row, i) {
  const cur = getFood();
  const item = cur[i];
  if (!item) return;
  row.innerHTML = "";
  const div = document.createElement("div");
  div.style.flex = "1";
  div.style.display = "grid";
  div.style.gap = "6px";
  const nameIn = document.createElement("input");
  nameIn.type = "text"; nameIn.value = item.t; nameIn.maxLength = 80;
  nameIn.setAttribute("aria-label", "Restaurant name");
  const noteIn = document.createElement("input");
  noteIn.type = "text"; noteIn.value = item.s || ""; noteIn.maxLength = 120;
  noteIn.setAttribute("aria-label", "Note");
  div.append(nameIn, noteIn);
  const btns = document.createElement("div");
  btns.style.display = "flex";
  btns.style.gap = "6px";
  const save = document.createElement("button");
  save.textContent = "Save";
  const cancel = document.createElement("button");
  cancel.className = "ghost";
  cancel.textContent = "Cancel";
  btns.append(save, cancel);
  row.append(div, btns);
  nameIn.focus();
  save.onclick = () => {
    const v = nameIn.value.trim();
    if (!v) { nameIn.focus(); return; }
    cur[i] = { t: v, s: noteIn.value.trim() };
    saveFood(cur);
    loadFood();
  };
  cancel.onclick = () => loadFood();
}
function addFoodItem() {
  const nameIn = $("food-new-name"), noteIn = $("food-new-note");
  const title = (nameIn.value || "").trim();
  if (!title) { nameIn.focus(); return; }
  const cur = getFood();
  cur.push({ t: title, s: (noteIn.value || "").trim() });
  saveFood(cur);
  nameIn.value = "";
  noteIn.value = "";
  loadFood();
  nameIn.focus();
}

// --- Fullscreen swipe viewer (tap any photo) ---
let vItems = [], vIdx = 0, vTouchX = null;
function openViewer(items, i) {
  if (!items.length) return;
  vItems = items;
  vIdx = Math.max(0, Math.min(i, items.length - 1));
  showViewer();
  $("viewer").hidden = false;
  document.body.style.overflow = "hidden";
}
function showViewer() {
  const img = $("viewer-img");
  img.src = vItems[vIdx].src;
  img.alt = vItems[vIdx].alt || "Trail photo";
  $("viewer-count").textContent = `${vIdx + 1} / ${vItems.length}`;
}
function stepViewer(d) {
  if (!vItems.length) return;
  vIdx = (vIdx + d + vItems.length) % vItems.length;
  showViewer();
}
function closeViewer() {
  $("viewer").hidden = true;
  document.body.style.overflow = "";
  vItems = [];
}
// One delegated tap handler covers map + all landmark + shared thumbs
document.addEventListener("click", (e) => {
  const img = e.target && e.target.closest ? e.target.closest(".thumb img") : null;
  if (!img || !$("viewer")) return;
  const zone = img.closest(".uploader") || document;
  const all = Array.from(zone.querySelectorAll(".thumb img"));
  openViewer(
    all.map((im) => ({ src: im.currentSrc || im.src, alt: im.alt })),
    Math.max(0, all.indexOf(img))
  );
});

// --- PWA shell ---
function updateOnline() {
  const pill = $("offline-pill");
  const off = !navigator.onLine;
  pill.textContent = off ? "● offline — all 3 tools work" : "● online";
  pill.classList.toggle("off", off);
}

document.addEventListener("DOMContentLoaded", () => {
  loadGear();
  $("gear-reset").onclick = () => {
    localStorage.removeItem(GEAR_KEY);
    localStorage.removeItem("hd-gear-v2");
    localStorage.removeItem("hd-gear");
    loadGear();
  };
  $("gear-add").onclick = addGearItem;
  $("gear-new").addEventListener("keydown", (e) => { if (e.key === "Enter") addGearItem(); });
  loadFood();
  $("food-add").onclick = addFoodItem;
  [$("food-new-name"), $("food-new-note")].forEach((el) =>
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") addFoodItem(); })
  );
  $("food-reset").onclick = () => { localStorage.removeItem(FOOD_KEY); loadFood(); };
  loadCalcInputs();
  recalc();
  ["up-pace","down-pace","start-time","cables-up","summit-min","cables-down"].forEach(id => {
    $(id).addEventListener("input", recalc);
    $(id).addEventListener("change", recalc);
  });
  $("calc-now").onclick = recalc;
  $("calc-print").onclick = () => window.print();

  renderDirectionStops();
  renderMapPhotos();
  bootCloud();
  // Viewer controls: buttons, swipe, keyboard
  $("viewer-close").onclick = closeViewer;
  $("viewer-prev").onclick = (e) => { e.stopPropagation(); stepViewer(-1); };
  $("viewer-next").onclick = (e) => { e.stopPropagation(); stepViewer(1); };
  const viewerEl = $("viewer");
  viewerEl.addEventListener("touchstart", (e) => {
    vTouchX = e.changedTouches[0].clientX;
  }, { passive: true });
  viewerEl.addEventListener("touchend", (e) => {
    if (vTouchX === null) return;
    const dx = e.changedTouches[0].clientX - vTouchX;
    vTouchX = null;
    if (Math.abs(dx) > 40) stepViewer(dx < 0 ? 1 : -1);
  }, { passive: true });
  document.addEventListener("keydown", (e) => {
    if ($("viewer").hidden) return;
    if (e.key === "Escape") closeViewer();
    if (e.key === "ArrowLeft") stepViewer(-1);
    if (e.key === "ArrowRight") stepViewer(1);
  });
  const exp = $("export-photos");
  if (exp) exp.onclick = async () => {
    const n = await dbCountAll();
    alert(n ? `${n} photo(s) are stored offline in IndexedDB (halfdome-pwa > photos). To back up, keep this browser profile — export-zip can be added next if you want.` : "No photos stored yet. Use any landmark Upload button first.");
  };

  updateOnline();
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
  window.addEventListener("online", () => bootCloud());
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
    // Auto-reload once when an updated SW takes control, so edits show up
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloaded) { reloaded = true; window.location.reload(); }
    });
  }
});
