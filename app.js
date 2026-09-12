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
    up.innerHTML = `<strong class="small">📷 ${stop.title} photos</strong><div class="small muted">Upload, or <strong>drag & drop</strong> image files / browser images here — saved on device, multiple allowed.</div>`;
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = true;
    // capture on mobile still allows library choice since multiple is set
    const thumbs = document.createElement("div");
    thumbs.className = "thumbs";
    const empty = document.createElement("div");
    empty.className = "empty-note";
    empty.textContent = "No photos yet for this landmark. Drag images here or use Choose Files.";
    const dropHint = document.createElement("div");
    dropHint.className = "drop-hint";
    dropHint.textContent = "Drop images to save to this landmark";
    up.append(input, dropHint, thumbs, empty);
    card.appendChild(up);
    wrap.appendChild(card);

    const refresh = async () => {
      const items = await dbListBySlot(stop.key).catch(() => []);
      thumbs.innerHTML = "";
      empty.style.display = items.length ? "none" : "block";
      items.sort((a, b) => a.ts - b.ts).forEach((it) => {
        const d = document.createElement("div");
        d.className = "thumb";
        const img = document.createElement("img");
        const objUrl = it.blob ? URL.createObjectURL(it.blob) : null;
        img.src = objUrl || it.url;
        img.alt = it.name || stop.title;
        img.loading = "lazy";
        if (!it.blob && it.url) {
          const tag = document.createElement("span");
          tag.className = "link-tag";
          tag.textContent = "link";
          tag.title = "Hotlinked (needs network) — re-add as file for full offline";
          d.appendChild(tag);
        }
        const del = document.createElement("button");
        del.className = "ghost"; del.textContent = "✕"; del.title = "Remove";
        del.onclick = async () => { await dbDelete(it.id); if (objUrl) URL.revokeObjectURL(objUrl); refresh(); updatePhotoCount(); };
        d.append(img, del);
        thumbs.appendChild(d);
      });
      updatePhotoCount();
    };
    input.onchange = async () => {
      if (!input.files.length) return;
      await dbAddPhotos(stop.key, input.files);
      input.value = "";
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
      if (saved) refresh();
    });
    refresh();
  });
}
async function updatePhotoCount() {
  const n = await dbCountAll();
  const el = $("photo-count");
  if (el) el.textContent = n ? `${n} photo${n === 1 ? "" : "s"} stored offline` : "no photos stored yet";
}

// --- Map section: drag-in photos of a map (IndexedDB slot "map") ---
function renderMapPhotos() {
  const zone = $("map-drop"), input = $("map-input"),
    thumbs = $("map-thumbs"), empty = $("map-empty"), hint = $("map-hint");
  if (!zone) return;
  const refresh = async () => {
    const items = await dbListBySlot("map").catch(() => []);
    thumbs.innerHTML = "";
    empty.style.display = items.length ? "none" : "block";
    items.sort((a, b) => a.ts - b.ts).forEach((it) => {
      const d = document.createElement("div");
      d.className = "thumb";
      const img = document.createElement("img");
      const objUrl = it.blob ? URL.createObjectURL(it.blob) : null;
      img.src = objUrl || it.url;
      img.alt = it.name || "Trail map";
      img.loading = "lazy";
      if (!it.blob && it.url) {
        const tag = document.createElement("span");
        tag.className = "link-tag";
        tag.textContent = "link";
        tag.title = "Hotlinked (needs network) — re-add as file for full offline";
        d.appendChild(tag);
      }
      const del = document.createElement("button");
      del.className = "ghost"; del.textContent = "✕"; del.title = "Remove";
      del.onclick = async () => { await dbDelete(it.id); if (objUrl) URL.revokeObjectURL(objUrl); refresh(); updatePhotoCount(); };
      d.append(img, del);
      thumbs.appendChild(d);
    });
    updatePhotoCount();
  };
  input.onchange = async () => {
    if (!input.files.length) return;
    await dbAddPhotos("map", input.files);
    input.value = "";
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
    if (saved) refresh();
  });
  refresh();
}

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
  const exp = $("export-photos");
  if (exp) exp.onclick = async () => {
    const n = await dbCountAll();
    alert(n ? `${n} photo(s) are stored offline in IndexedDB (halfdome-pwa > photos). To back up, keep this browser profile — export-zip can be added next if you want.` : "No photos stored yet. Use any landmark Upload button first.");
  };

  updateOnline();
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
    // Auto-reload once when an updated SW takes control, so edits show up
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloaded) { reloaded = true; window.location.reload(); }
    });
  }
});
