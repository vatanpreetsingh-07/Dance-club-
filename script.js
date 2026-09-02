/* ===========================================================
   STEP & SWING DANCE CLUB — script.js
   Firebase Firestore cloud database — real-time, cross-device.
   All events & registrations sync instantly across every device.
   =========================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

/* ── Firebase Configuration ───────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyCECBQGzMMPmzy45u4mzomd6JqgKV3UM4A",
  authDomain: "dance-club-e1460.firebaseapp.com",
  projectId: "dance-club-e1460",
  storageBucket: "dance-club-e1460.firebasestorage.app",
  messagingSenderId: "817275171319",
  appId: "1:817275171319:web:960291c1011f3e55727ef2"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* ── Firestore Collection References ─────────────────────── */
const eventsCol       = collection(db, "events");
const registrationsCol = collection(db, "registrations");
const archivedEventsCol = collection(db, "archivedEvents");

/* ── Auth / Session ───────────────────────────────────────── */
const SESSION_KEY        = "stepSwing_presidentSession";
const PRESIDENT_USERNAME = "Vatan Preet Singh";
const PRESIDENT_PASSWORD = "Vat@123456";

/* ── In-Memory State (kept in sync by Firestore listeners) ── */
let _events        = [];   // active events
let _registrations = [];   // all student registrations
let _archivedEvents = [];  // archived / deleted events

/* ── Page-specific callback set by initSeparateEventRegistrationPage ── */
let _onEventsReadyForRegPage = null;

/* ── Default Seed Events (written to Firestore on first launch) ─ */
const DEFAULT_EVENTS = [
  {
    id: "evt_1",
    title: "Inter-College Step & Swing Showdown 2026",
    date: "2026-08-27",
    venue: "Geeta University Main Auditorium",
    category: "Competition",
    description: "High-energy rhythm step routines & swing battle open to all students. Certificate of achievement and trophies!",
    createdAt: "2026-08-01T00:00:00.000Z"
  },
  {
    id: "evt_2",
    title: "Beginner Lindy Hop & Body Percussion Workshop",
    date: "2026-09-01",
    venue: "Dance Studio Block B",
    category: "Workshop",
    description: "Learn fundamental 6-count swing footwork and percussive body stomps in an interactive 2-hour intensive session.",
    createdAt: "2026-08-01T00:00:01.000Z"
  },
  {
    id: "evt_3",
    title: "Annual Campus Flash Mob & Rhythm Showcase",
    date: "2026-09-07",
    venue: "University Central Plaza",
    category: "Showcase",
    description: "Join the entire Step & Swing crew for our biggest synchronized rhythm performance of the semester across campus plaza.",
    createdAt: "2026-08-01T00:00:02.000Z"
  },
  {
    id: "evt_4",
    title: "Hip-Hop & Footwork Freestyle Battle",
    date: "2026-09-13",
    venue: "Student Activity Center Open Stage",
    category: "Freestyle Battle",
    description: "1v1 percussive footwork battle with live DJ beat mixing. Cash prizes for best rhythm improvisation!",
    createdAt: "2026-08-01T00:00:03.000Z"
  },
  {
    id: "evt_5",
    title: "Couples Social Swing & Salsa Night",
    date: "2026-09-19",
    venue: "Amphitheatre Outdoor Ground",
    category: "Social Dance",
    description: "An evening of social swing partner dancing, Latin step fusion, live music, and refreshments.",
    createdAt: "2026-08-01T00:00:04.000Z"
  }
];

/* ── Immediately seed in-memory state with defaults so UI renders on load ─ */
_events = DEFAULT_EVENTS.slice();

/* ─────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatDateOnly(dateVal) {
  if (!dateVal) return "TBA";
  if (typeof dateVal === "string" && dateVal.includes("-")) {
    const clean = dateVal.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      const d = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10)
      );
      if (!isNaN(d.getTime()))
        return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    }
  }
  const d = new Date(dateVal);
  return isNaN(d.getTime())
    ? "TBA"
    : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function showToast(message, isError) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("err", !!isError);
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 3200);
}

function isDashboardVisible() {
  const dash = document.getElementById("dashboard");
  return !!(dash && dash.classList.contains("show"));
}

/* ─────────────────────────────────────────────────────────────
   FIRESTORE — SEED DEFAULT EVENTS (first launch only)
   ───────────────────────────────────────────────────────────── */
async function seedDefaultEvents() {
  try {
    // Timeout after 8s to avoid blocking the app
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Firestore seed timeout")), 8000)
    );
    const seedPromise = (async () => {
      const snap = await getDocs(eventsCol);
      if (snap.empty) {
        console.log("Seeding default events to Firestore…");
        for (const evt of DEFAULT_EVENTS) {
          await setDoc(doc(db, "events", evt.id), evt);
        }
        console.log("Default events seeded ✓");
      }
    })();
    await Promise.race([seedPromise, timeoutPromise]);
  } catch (e) {
    console.warn("Seed skipped or timed out:", e.message);
  }
}

/* ─────────────────────────────────────────────────────────────
   FIRESTORE — WRITE OPERATIONS
   ───────────────────────────────────────────────────────────── */
async function dbAddRegistration(entry) {
  return await addDoc(registrationsCol, entry);
}

async function dbAddEvent(eventData) {
  await setDoc(doc(db, "events", eventData.id), eventData);
}

async function dbUpdateEvent(eventId, updates, isArchived = false) {
  const colName = isArchived ? "archivedEvents" : "events";
  await updateDoc(doc(db, colName, eventId), updates);
}

async function dbArchiveEvent(eventId) {
  const eventToArchive = _events.find(e => e.id === eventId);
  if (!eventToArchive) return;
  const archived = { ...eventToArchive, archivedAt: new Date().toISOString() };
  delete archived._firestoreId;
  await setDoc(doc(db, "archivedEvents", eventId), archived);
  await deleteDoc(doc(db, "events", eventId));
}

async function dbRestoreEvent(eventId) {
  const eventToRestore = _archivedEvents.find(e => e.id === eventId);
  if (!eventToRestore) return;
  const restored = { ...eventToRestore };
  delete restored.archivedAt;
  delete restored._firestoreId;
  await setDoc(doc(db, "events", eventId), restored);
  await deleteDoc(doc(db, "archivedEvents", eventId));
}

async function dbPermanentDeleteArchived(eventId) {
  await deleteDoc(doc(db, "archivedEvents", eventId));
}

async function dbDeleteRegistration(firestoreId) {
  await deleteDoc(doc(db, "registrations", firestoreId));
}

async function dbClearAllRegistrations() {
  const tasks = _registrations.map(r =>
    deleteDoc(doc(db, "registrations", r._firestoreId))
  );
  await Promise.all(tasks);
}

async function dbUpdateRegistrationsEventName(eventId, newTitle) {
  const toUpdate = _registrations.filter(r => r.eventId === eventId);
  await Promise.all(
    toUpdate.map(r =>
      updateDoc(doc(db, "registrations", r._firestoreId), { eventName: newTitle })
    )
  );
}

/* ─────────────────────────────────────────────────────────────
   FIRESTORE — REAL-TIME LISTENERS
   ───────────────────────────────────────────────────────────── */
function setupListeners() {
  // ── Events ──
  onSnapshot(
    query(eventsCol, orderBy("createdAt", "asc")),
    (snapshot) => {
      // Only replace defaults if Firestore has actual data
      if (snapshot.docs.length > 0) {
        _events = snapshot.docs.map(d => ({ ...d.data(), _firestoreId: d.id }));
      }
      // else: keep the pre-loaded DEFAULT_EVENTS already in _events
      renderEventsSection();
      populateEventDropdowns();
      if (isDashboardVisible()) {
        renderEventsList();
        renderDashboard();
      }
      if (_onEventsReadyForRegPage) _onEventsReadyForRegPage();
    },
    (err) => {
      console.error("Events listener:", err);
      // On error, keep defaults — already set at module level
      renderEventsSection();
    }
  );

  // ── Registrations ──
  onSnapshot(
    query(registrationsCol, orderBy("submittedAt", "desc")),
    (snapshot) => {
      _registrations = snapshot.docs.map(d => ({ ...d.data(), _firestoreId: d.id }));
      if (isDashboardVisible()) {
        renderDashboard();
        renderEventsList();
      }
    },
    (err) => console.error("Registrations listener:", err)
  );

  // ── Archived Events ──
  onSnapshot(
    query(archivedEventsCol, orderBy("archivedAt", "desc")),
    (snapshot) => {
      _archivedEvents = snapshot.docs.map(d => ({ ...d.data(), _firestoreId: d.id }));
      populateEventDropdowns();
      if (isDashboardVisible()) {
        renderArchivedEventsList();
        populateFilterSelectOptions();
      }
      if (_onEventsReadyForRegPage) _onEventsReadyForRegPage();
    },
    (err) => console.error("Archived events listener:", err)
  );
}


/* ─────────────────────────────────────────────────────────────
   EVENTS SECTION — PUBLIC PAGE (index.html)
   ───────────────────────────────────────────────────────────── */
function renderEventsSection() {
  const container = document.getElementById("eventsContainer");
  if (!container) return;

  container.innerHTML = "";

  if (!_events.length) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);" class="mono">Loading events…</div>`;
    return;
  }

  _events.forEach((evt) => {
    const card = document.createElement("div");
    card.className = "event-card reveal-up in";
    const dateStr = evt.date ? formatDateOnly(evt.date) : "TBA";
    card.innerHTML = `
      <div>
        <span class="category-badge">${escapeHtml(evt.category || "Club Event")}</span>
        <h3>${escapeHtml(evt.title)}</h3>
        <div class="event-meta">
          <span>📅 ${dateStr}</span>
          <span>📍 ${escapeHtml(evt.venue)}</span>
        </div>
        <p class="desc">${escapeHtml(evt.description || "Join us for this exciting Step & Swing event!")}</p>
      </div>
      <a href="event-register.html?eventId=${evt.id}" class="btn" style="text-align:center;">Register For This Event →</a>
    `;
    container.appendChild(card);
  });
  container.classList.add("in");
}

/* ─────────────────────────────────────────────────────────────
   DROPDOWN POPULATION (event select on index & event-register)
   ───────────────────────────────────────────────────────────── */
function populateEventDropdowns() {
  // Registration form on index.html
  const selectEl = document.getElementById("eventSelect");
  if (selectEl) {
    const currentVal = selectEl.value;
    selectEl.innerHTML = `<option value="general">General Dance Club Membership</option>`;
    _events.forEach((evt) => {
      const opt = document.createElement("option");
      opt.value = evt.id;
      const dStr = evt.date
        ? new Date(evt.date).toLocaleDateString([], { month: "short", day: "numeric" })
        : "";
      opt.textContent = `${evt.title}${dStr ? " (" + dStr + ")" : ""}`;
      selectEl.appendChild(opt);
    });
    if (currentVal && Array.from(selectEl.options).some(o => o.value === currentVal)) {
      selectEl.value = currentVal;
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   PRESIDENT PORTAL — FILTER DROPDOWN
   ───────────────────────────────────────────────────────────── */
function populateFilterSelectOptions() {
  const filterSelect = document.getElementById("filterEventSelect");
  if (!filterSelect) return;
  const currentVal = filterSelect.value || "all";

  let html = `<option value="all">All Registrations</option>`;
  html += `<option value="general">General Membership</option>`;

  if (_events.length) {
    html += `<optgroup label="Active Published Events">`;
    _events.forEach(e => {
      html += `<option value="${e.id}">${escapeHtml(e.title)}</option>`;
    });
    html += `</optgroup>`;
  }
  if (_archivedEvents.length) {
    html += `<optgroup label="Past &amp; Deleted Events">`;
    _archivedEvents.forEach(e => {
      html += `<option value="${e.id}">[Archived] ${escapeHtml(e.title)}</option>`;
    });
    html += `</optgroup>`;
  }

  filterSelect.innerHTML = html;
  if ([...filterSelect.options].some(o => o.value === currentVal)) {
    filterSelect.value = currentVal;
  }
}

/* ─────────────────────────────────────────────────────────────
   PRESIDENT PORTAL — RENDER DASHBOARD (registrations table)
   ───────────────────────────────────────────────────────────── */
function renderDashboard() {
  const filterSelect = document.getElementById("filterEventSelect");
  const filterVal = filterSelect ? filterSelect.value : "all";

  let filteredData = _registrations;
  if (filterVal && filterVal !== "all") {
    filteredData = _registrations.filter(r => (r.eventId || "general") === filterVal);
  }

  const tbody      = document.getElementById("regBody");
  const emptyState = document.getElementById("emptyState");
  const table      = document.getElementById("regTable");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!filteredData.length) {
    if (table) table.style.display = "none";
    if (emptyState) emptyState.style.display = "block";
  } else {
    if (table) table.style.display = "table";
    if (emptyState) emptyState.style.display = "none";

    filteredData.forEach((r, i) => {
      const tr = document.createElement("tr");
      const submitted = r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—";
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><b style="color:var(--gold);">${escapeHtml(r.eventName || "General Membership")}</b></td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.rollNo)}</td>
        <td>${escapeHtml(r.department)}</td>
        <td>${escapeHtml(r.course)}</td>
        <td>${escapeHtml(r.year)}</td>
        <td>${escapeHtml(r.semester)}</td>
        <td>${escapeHtml(r.phone)}</td>
        <td>${escapeHtml(r.dance)}</td>
        <td class="mono">${submitted}</td>
        <td>
          <button class="btn danger btn-sm delete-reg-btn"
            data-id="${r._firestoreId}"
            data-name="${escapeHtml(r.name)}"
            title="Delete this entry">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Stats
  const depts = new Set(
    _registrations.map(r => (r.department || "").trim().toLowerCase()).filter(Boolean)
  );
  const todayStr = new Date().toDateString();
  const today = _registrations.filter(
    r => r.submittedAt && new Date(r.submittedAt).toDateString() === todayStr
  ).length;

  const statTotal  = document.getElementById("statTotal");
  const statEvents = document.getElementById("statEvents");
  const statDept   = document.getElementById("statDept");
  const statToday  = document.getElementById("statToday");
  if (statTotal)  statTotal.textContent  = _registrations.length;
  if (statEvents) statEvents.textContent = _events.length;
  if (statDept)   statDept.textContent   = depts.size;
  if (statToday)  statToday.textContent  = today;
}

/* ─────────────────────────────────────────────────────────────
   PRESIDENT PORTAL — ACTIVE EVENTS LIST
   ───────────────────────────────────────────────────────────── */
function renderEventsList() {
  const eventsBody       = document.getElementById("eventsBody");
  const eventsEmptyState = document.getElementById("eventsEmptyState");
  const eventsTable      = document.getElementById("eventsTable");

  populateFilterSelectOptions();
  if (!eventsBody) return;
  eventsBody.innerHTML = "";

  if (!_events.length) {
    if (eventsTable)      eventsTable.style.display      = "none";
    if (eventsEmptyState) eventsEmptyState.style.display = "block";
    return;
  }

  if (eventsTable)      eventsTable.style.display      = "table";
  if (eventsEmptyState) eventsEmptyState.style.display = "none";

  _events.forEach((evt, i) => {
    const regCount = _registrations.filter(r => r.eventId === evt.id).length;
    const dStr = evt.date ? formatDateOnly(evt.date) : "TBA";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><b>${escapeHtml(evt.title)}</b></td>
      <td class="mono">${dStr}</td>
      <td>${escapeHtml(evt.venue)}</td>
      <td><span class="category-badge">${escapeHtml(evt.category)}</span></td>
      <td><b>${regCount}</b> registrations</td>
      <td>
        <button class="btn ghost btn-sm download-evt-btn"
          data-id="${evt.id}" data-title="${escapeHtml(evt.title)}"
          title="Download Excel for this event">📊 Excel</button>
        <button class="btn ghost btn-sm edit-evt-btn"
          data-id="${evt.id}" title="Edit event details">✏️ Edit</button>
        <button class="btn danger btn-sm delete-evt-btn"
          data-id="${evt.id}" data-title="${escapeHtml(evt.title)}">Delete</button>
      </td>
    `;
    eventsBody.appendChild(tr);
  });

  eventsBody.querySelectorAll(".edit-evt-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const target = _events.find(e => e.id === this.dataset.id);
      if (target) openEditModal(target, false);
    });
  });

  eventsBody.querySelectorAll(".delete-evt-btn").forEach(btn => {
    btn.addEventListener("click", async function () {
      const id = this.dataset.id;
      const title = this.dataset.title || "this event";
      if (confirm(`Archive event "${title}"? It will be moved to Past & Deleted Archive.`)) {
        try {
          await dbArchiveEvent(id);
          showToast(`Event "${title}" moved to archive.`);
        } catch (err) {
          showToast("Error archiving event.", true);
          console.error(err);
        }
      }
    });
  });

  eventsBody.querySelectorAll(".download-evt-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const records = _registrations.filter(r => r.eventId === this.dataset.id);
      exportToExcel(records, `StepAndSwing_Event_${this.dataset.title}`);
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   PRESIDENT PORTAL — ARCHIVED EVENTS LIST
   ───────────────────────────────────────────────────────────── */
function renderArchivedEventsList() {
  const archivedBody       = document.getElementById("archivedEventsBody");
  const archivedEmptyState = document.getElementById("archivedEventsEmptyState");
  const archivedTable      = document.getElementById("archivedEventsTable");

  if (!archivedBody) return;
  archivedBody.innerHTML = "";

  if (!_archivedEvents.length) {
    if (archivedTable)      archivedTable.style.display      = "none";
    if (archivedEmptyState) archivedEmptyState.style.display = "block";
    return;
  }

  if (archivedTable)      archivedTable.style.display      = "table";
  if (archivedEmptyState) archivedEmptyState.style.display = "none";

  _archivedEvents.forEach((evt, i) => {
    const regCount = _registrations.filter(r => r.eventId === evt.id).length;
    const dStr     = evt.date       ? formatDateOnly(evt.date)       : "TBA";
    const archStr  = evt.archivedAt ? formatDateOnly(evt.archivedAt) : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><b>${escapeHtml(evt.title)}</b></td>
      <td class="mono">${dStr}</td>
      <td>${escapeHtml(evt.venue)}</td>
      <td class="mono" style="font-size:11.5px;color:var(--muted);">${archStr}</td>
      <td><b>${regCount}</b> registrations</td>
      <td>
        <button class="btn ghost btn-sm download-archived-evt-btn"
          data-id="${evt.id}" data-title="${escapeHtml(evt.title)}"
          title="Download Excel">📊 Excel</button>
        <button class="btn ghost btn-sm edit-archived-evt-btn"
          data-id="${evt.id}" title="Edit">✏️ Edit</button>
        <button class="btn ghost btn-sm restore-archived-evt-btn"
          data-id="${evt.id}" data-title="${escapeHtml(evt.title)}"
          title="Restore to active">↺ Restore</button>
        <button class="btn danger btn-sm perm-delete-archived-evt-btn"
          data-id="${evt.id}" data-title="${escapeHtml(evt.title)}"
          title="Permanently delete">Delete</button>
      </td>
    `;
    archivedBody.appendChild(tr);
  });

  archivedBody.querySelectorAll(".edit-archived-evt-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const target = _archivedEvents.find(e => e.id === this.dataset.id);
      if (target) openEditModal(target, true);
    });
  });

  archivedBody.querySelectorAll(".download-archived-evt-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const records = _registrations.filter(r => r.eventId === this.dataset.id);
      exportToExcel(records, `StepAndSwing_ArchivedEvent_${this.dataset.title}`);
    });
  });

  archivedBody.querySelectorAll(".restore-archived-evt-btn").forEach(btn => {
    btn.addEventListener("click", async function () {
      const id = this.dataset.id;
      const title = this.dataset.title || "this event";
      try {
        await dbRestoreEvent(id);
        showToast(`Event "${title}" restored to Active Published Events.`);
      } catch (err) {
        showToast("Error restoring event.", true);
        console.error(err);
      }
    });
  });

  archivedBody.querySelectorAll(".perm-delete-archived-evt-btn").forEach(btn => {
    btn.addEventListener("click", async function () {
      const id = this.dataset.id;
      const title = this.dataset.title || "this event";
      if (confirm(`Permanently delete archived record for "${title}"? Registrations will remain saved.`)) {
        try {
          await dbPermanentDeleteArchived(id);
          showToast(`Archived event "${title}" deleted permanently.`);
        } catch (err) {
          showToast("Error deleting archived event.", true);
          console.error(err);
        }
      }
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   EDIT EVENT MODAL
   ───────────────────────────────────────────────────────────── */
function openEditModal(evt, isArchived) {
  const editModal = document.getElementById("editEventModal");
  const editForm  = document.getElementById("editEventForm");
  if (!editModal || !editForm) return;

  document.getElementById("editEventId").value         = evt.id;
  document.getElementById("editEventIsArchived").value = isArchived ? "1" : "0";
  document.getElementById("editEventTitle").value      = evt.title    || "";
  document.getElementById("editEventDate").value       = evt.date
    ? (evt.date.includes("T") ? evt.date.split("T")[0] : evt.date)
    : "";
  document.getElementById("editEventVenue").value      = evt.venue    || "";
  document.getElementById("editEventCategory").value   = evt.category || "";
  document.getElementById("editEventDesc").value       = evt.description || "";
  editModal.style.display = "flex";
}

function initEditModal() {
  const editModal        = document.getElementById("editEventModal");
  const editForm         = document.getElementById("editEventForm");
  const closeEditModalBtn = document.getElementById("closeEditModalBtn");
  const cancelEditBtn    = document.getElementById("cancelEditBtn");
  if (!editModal || !editForm) return;

  function closeEditModal() {
    editModal.style.display = "none";
    editForm.reset();
  }

  if (closeEditModalBtn) closeEditModalBtn.addEventListener("click", closeEditModal);
  if (cancelEditBtn)     cancelEditBtn.addEventListener("click", closeEditModal);

  editForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const id         = document.getElementById("editEventId").value;
    const isArchived = document.getElementById("editEventIsArchived").value === "1";
    const title      = document.getElementById("editEventTitle").value.trim();
    const date       = document.getElementById("editEventDate").value;
    const venue      = document.getElementById("editEventVenue").value.trim();
    const category   = document.getElementById("editEventCategory").value.trim();
    const description = document.getElementById("editEventDesc").value.trim();

    if (!title || !date || !venue) {
      showToast("Please fill in Title, Date, and Venue.", true);
      return;
    }

    const updates = {
      title, date, venue,
      category: category || "Club Event",
      description,
      updatedAt: new Date().toISOString()
    };

    try {
      await dbUpdateEvent(id, updates, isArchived);
      await dbUpdateRegistrationsEventName(id, title);
      closeEditModal();
      showToast(`Event "${title}" updated successfully!`);
    } catch (err) {
      showToast("Error updating event.", true);
      console.error(err);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   EXCEL EXPORT (SheetJS — loaded as regular script in HTML)
   ───────────────────────────────────────────────────────────── */
function exportToExcel(records, filenamePrefix) {
  if (!records || !records.length) {
    showToast("No registrations found for this selection.", true);
    return;
  }
  if (typeof XLSX === "undefined") {
    showToast("Excel library failed to load. Check connection.", true);
    return;
  }

  const rows = records.map((r, i) => ({
    "S.No": i + 1,
    "Registered For": r.eventName || "General Membership",
    "Full Name":   r.name,
    "Roll No":     r.rollNo,
    "Department":  r.department,
    "Course":      r.course,
    "Year":        r.year,
    "Semester":    r.semester,
    "Phone No":    r.phone,
    "Dance Category": r.danceCategory || "",
    "Dance Theme":  r.danceTheme || "",
    "Dance Styles": r.dance,
    "Submitted On": r.submittedAt ? new Date(r.submittedAt).toLocaleString() : ""
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 6 }, { wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 22 },
    { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 40 }, { wch: 20 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Registrations");

  const cleanPrefix = (filenamePrefix || "StepAndSwing_Registrations")
    .replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
  const dateStamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${cleanPrefix}_${dateStamp}.xlsx`);
  showToast(`Excel downloaded (${records.length} records).`);
}

/* ─────────────────────────────────────────────────────────────
   SCROLL REVEAL & PARALLAX
   ───────────────────────────────────────────────────────────── */
function initScrollReveal() {
  const targets = document.querySelectorAll(
    ".reveal, .reveal-up, .reveal-down, .reveal-left, .reveal-right, .reveal-zoom"
  );

  if (targets.length) {
    if (!("IntersectionObserver" in window)) {
      targets.forEach(el => el.classList.add("in"));
    } else {
      const observer = new IntersectionObserver(
        entries => entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add("in");
        }),
        { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
      );
      targets.forEach(el => observer.observe(el));
    }
  }

  const progressEl  = document.getElementById("scrollProgress");
  const backToTopBtn = document.getElementById("backToTop");
  let ticking = false;

  function onScrollUpdate() {
    const scrollTop     = window.scrollY || document.documentElement.scrollTop;
    const viewportHeight = window.innerHeight;
    const docHeight     = document.documentElement.scrollHeight - viewportHeight;

    if (progressEl && docHeight > 0)
      progressEl.style.width = ((scrollTop / docHeight) * 100) + "%";
    if (backToTopBtn)
      backToTopBtn.classList.toggle("show", scrollTop > 300);

    document.querySelectorAll(".dance-object").forEach((obj, idx) => {
      const yPos  = scrollTop * parseFloat(obj.dataset.speed || "0.3") * 2.4;
      const rot   = scrollTop * parseFloat(obj.dataset.rotate || "0.08") * 2.8;
      const pulse = 1 + Math.sin(scrollTop * 0.005 + idx) * 0.15;
      obj.style.transform = `translate3d(0,${yPos}px,0) rotate(${rot}deg) scale(${pulse})`;
    });

    const heroH1    = document.querySelector(".hero h1");
    const heroTrail = document.querySelector(".hero .trail");
    const heroLede  = document.querySelector(".hero .lede");
    if (heroH1)    heroH1.style.transform    = `translate3d(0,${scrollTop * 0.28}px,0) scale(${Math.max(0.85, 1 - scrollTop * 0.0004)})`;
    if (heroTrail) heroTrail.style.transform = `translate3d(${Math.sin(scrollTop * 0.008) * 35}px,${scrollTop * 0.16}px,0)`;
    if (heroLede)  heroLede.style.transform  = `translate3d(0,${scrollTop * 0.18}px,0)`;

    document.querySelectorAll(".section-head").forEach(head => {
      const rect = head.getBoundingClientRect();
      if (rect.top < viewportHeight && rect.bottom > 0)
        head.style.transform = `translate3d(0,${(rect.top - viewportHeight / 2) * -0.06}px,0)`;
    });

    document.querySelectorAll(".style-card, .team-card").forEach((card, idx) => {
      const rect = card.getBoundingClientRect();
      if (rect.top < viewportHeight && rect.bottom > 0) {
        const dir  = idx % 2 === 0 ? 1 : -1;
        const dist = (rect.top - viewportHeight / 2) * 0.06 * dir;
        const rot  = (rect.top - viewportHeight / 2) * 0.012 * dir;
        card.style.transform = `translate3d(0,${dist}px,0) rotate(${rot}deg)`;
      }
    });

    document.querySelectorAll(".stat").forEach((stat, idx) => {
      const rect = stat.getBoundingClientRect();
      if (rect.top < viewportHeight && rect.bottom > 0) {
        const offsetX = (idx % 2 === 0 ? 12 : -12) * Math.sin(scrollTop * 0.006);
        const offsetY = (rect.top - viewportHeight / 2) * -0.05;
        stat.style.transform = `translate3d(${offsetX}px,${offsetY}px,0)`;
      }
    });

    const formPanel = document.querySelector(".form-panel");
    if (formPanel) {
      const rect = formPanel.getBoundingClientRect();
      if (rect.top < viewportHeight && rect.bottom > 0)
        formPanel.style.transform = `translate3d(0,${(rect.top - viewportHeight / 2) * -0.05}px,0)`;
    }

    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) { window.requestAnimationFrame(onScrollUpdate); ticking = true; }
  });

  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }
}

/* ─────────────────────────────────────────────────────────────
   MOBILE NAV TOGGLE
   ───────────────────────────────────────────────────────────── */
function initMobileNav() {
  const toggleBtn = document.getElementById("navToggle");
  const navLinks  = document.getElementById("navLinks");
  if (!toggleBtn || !navLinks) return;

  toggleBtn.addEventListener("click", () => {
    toggleBtn.classList.toggle("active");
    navLinks.classList.toggle("show");
  });
  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      toggleBtn.classList.remove("active");
      navLinks.classList.remove("show");
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   REGISTRATION FORM (index.html — general membership inline)
   ───────────────────────────────────────────────────────────── */
function initRegistrationForm() {
  const form = document.getElementById("regForm");
  if (!form) return;

  const fields = ["name", "rollNo", "department", "course", "year", "semester", "phone", "dance"];

  function setError(fieldName, hasError) {
    const wrap = form.querySelector(`[data-field="${fieldName}"]`);
    if (wrap) wrap.classList.toggle("error", hasError);
  }

  function validate() {
    let valid = true;
    const values = {};
    fields.forEach(name => {
      const el    = form.elements[name];
      const value = (el ? el.value || "" : "").trim();
      values[name] = value;
      let fieldValid = value.length > 0;
      if (name === "phone") fieldValid = /^[0-9]{10}$/.test(value.replace(/\s+/g, ""));
      if (name === "dance") fieldValid = value.length >= 3;
      setError(name, !fieldValid);
      if (!fieldValid) valid = false;
    });
    return { valid, values };
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const { valid, values } = validate();
    if (!valid) { showToast("Please check the highlighted fields.", true); return; }

    const eventSelect = form.elements["eventId"];
    const eventId     = eventSelect ? eventSelect.value : "general";
    const matchedEvt  = _events.find(ev => ev.id === eventId);
    const eventName   = matchedEvt ? matchedEvt.title : "General Membership";

    const entry = {
      eventId, eventName,
      name: values.name, rollNo: values.rollNo,
      department: values.department, course: values.course,
      year: values.year, semester: values.semester,
      phone: values.phone, dance: values.dance,
      submittedAt: new Date().toISOString()
    };

    try {
      await dbAddRegistration(entry);
      form.reset();
      showToast(`You're in! Registration saved for "${eventName}".`);
    } catch (err) {
      showToast("Error saving registration. Please try again.", true);
      console.error(err);
    }
  });

  fields.forEach(name => {
    const el = form.elements[name];
    if (el) el.addEventListener("input", () => setError(name, false));
  });
}

/* ─────────────────────────────────────────────────────────────
   PRESIDENT PORTAL — INIT
   ───────────────────────────────────────────────────────────── */
function initPresidentPortal() {
  const loginShell      = document.getElementById("loginShell");
  const dashboard       = document.getElementById("dashboard");
  const loginForm       = document.getElementById("loginForm");
  if (!loginShell || !dashboard || !loginForm) return;

  const loginError      = document.getElementById("loginError");
  const logoutBtn       = document.getElementById("logoutBtn");
  const downloadBtn     = document.getElementById("downloadBtn");
  const createEventForm = document.getElementById("createEventForm");
  const filterSelect    = document.getElementById("filterEventSelect");

  function isLoggedIn() {
    return sessionStorage.getItem(SESSION_KEY) === "true";
  }

  function showDashboard() {
    loginShell.style.display = "none";
    dashboard.classList.add("show");
    populateFilterSelectOptions();
    renderDashboard();
    renderEventsList();
    renderArchivedEventsList();
  }

  function showLogin() {
    dashboard.classList.remove("show");
    loginShell.style.display = "flex";
    loginForm.reset();
    if (loginError) loginError.classList.remove("show");
  }

  function logOut(silent) {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
    if (!silent) showToast("Logged out.");
  }

  // ── Login ──
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const username = loginForm.elements["username"].value.trim();
    const password = loginForm.elements["password"].value;
    if (
      username.toLowerCase() === PRESIDENT_USERNAME.toLowerCase() &&
      password === PRESIDENT_PASSWORD
    ) {
      sessionStorage.setItem(SESSION_KEY, "true");
      if (loginError) loginError.classList.remove("show");
      showDashboard();
    } else {
      if (loginError) loginError.classList.add("show");
    }
  });

  if (logoutBtn) logoutBtn.addEventListener("click", () => logOut(false));

  // ── Create Event ──
  if (createEventForm) {
    createEventForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const title       = (createEventForm.elements["title"].value || "").trim();
      const date        = createEventForm.elements["date"].value;
      const venue       = (createEventForm.elements["venue"].value || "").trim();
      const category    = (createEventForm.elements["category"].value || "").trim();
      const description = (createEventForm.elements["description"].value || "").trim();

      if (!title || !date || !venue) {
        showToast("Please fill in event title, date, and venue.", true);
        return;
      }

      const newEvent = {
        id: "evt_" + Date.now(),
        title, date, venue,
        category: category || "Club Event",
        description,
        createdAt: new Date().toISOString()
      };

      try {
        await dbAddEvent(newEvent);
        createEventForm.reset();
        showToast(`Event "${title}" created and published!`);
      } catch (err) {
        showToast("Error creating event.", true);
        console.error(err);
      }
    });
  }

  // ── Download buttons ──
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () =>
      exportToExcel(_registrations, "StepAndSwing_All_Registrations")
    );
  }

  const downloadGeneralBtn = document.getElementById("downloadGeneralBtn");
  if (downloadGeneralBtn) {
    downloadGeneralBtn.addEventListener("click", () => {
      const generalRecords = _registrations.filter(r => (r.eventId || "general") === "general");
      exportToExcel(generalRecords, "StepAndSwing_General_Club_Members");
    });
  }

  const downloadFilteredBtn = document.getElementById("downloadFilteredBtn");
  if (downloadFilteredBtn) {
    downloadFilteredBtn.addEventListener("click", () => {
      const filterVal = filterSelect ? filterSelect.value : "all";
      if (filterVal === "general") {
        exportToExcel(
          _registrations.filter(r => (r.eventId || "general") === "general"),
          "StepAndSwing_General_Club_Members"
        );
      } else if (filterVal !== "all") {
        const matchedEvt = _events.find(e => e.id === filterVal)
          || _archivedEvents.find(e => e.id === filterVal);
        const title = matchedEvt ? matchedEvt.title : "Event";
        exportToExcel(
          _registrations.filter(r => r.eventId === filterVal),
          `StepAndSwing_Event_${title}`
        );
      } else {
        exportToExcel(_registrations, "StepAndSwing_All_Registrations");
      }
    });
  }

  const downloadAllArchivedExcelBtn = document.getElementById("downloadAllArchivedExcelBtn");
  if (downloadAllArchivedExcelBtn) {
    downloadAllArchivedExcelBtn.addEventListener("click", () => {
      const archivedIds = new Set(_archivedEvents.map(e => e.id));
      const records = _registrations.filter(r => archivedIds.has(r.eventId));
      exportToExcel(records, "StepAndSwing_All_Archived_Events");
    });
  }

  // ── Clear All Registrations ──
  const clearAllBtn = document.getElementById("clearAllBtn");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", async function () {
      if (!_registrations.length) { showToast("No registrations to clear.", true); return; }
      if (confirm("Delete ALL student registrations? This cannot be undone.")) {
        try {
          await dbClearAllRegistrations();
          showToast("All registrations deleted.");
        } catch (err) {
          showToast("Error clearing registrations.", true);
          console.error(err);
        }
      }
    });
  }

  // ── Filter Change ──
  if (filterSelect) {
    filterSelect.addEventListener("change", renderDashboard);
  }

  // ── Delete individual registration (event delegation) ──
  const regBody = document.getElementById("regBody");
  if (regBody) {
    regBody.addEventListener("click", async function (e) {
      const btn = e.target.closest(".delete-reg-btn");
      if (btn) {
        const firestoreId = btn.dataset.id;
        const studentName = btn.dataset.name || "this registration";
        if (confirm(`Delete the registration for "${studentName}"?`)) {
          try {
            await dbDeleteRegistration(firestoreId);
          } catch (err) {
            showToast("Error deleting registration.", true);
            console.error(err);
          }
        }
      }
    });
  }

  // ── Auto-logout on navigation ──
  document.querySelectorAll('a[href*="index.html"]').forEach(link => {
    link.addEventListener("click", () => sessionStorage.removeItem(SESSION_KEY));
  });
  window.addEventListener("pagehide", () => sessionStorage.removeItem(SESSION_KEY));
  window.addEventListener("pageshow", () => { if (!isLoggedIn()) showLogin(); });

  // ── Initial state ──
  if (isLoggedIn()) {
    showDashboard();
  } else {
    showLogin();
  }
}

/* ─────────────────────────────────────────────────────────────
   SEPARATE EVENT REGISTRATION PAGE (event-register.html)
   ───────────────────────────────────────────────────────────── */
function initSeparateEventRegistrationPage() {
  const form = document.getElementById("eventRegForm");
  if (!form) return;

  const params         = new URLSearchParams(window.location.search);
  const eventIdFromUrl = params.get("eventId") || "";

  const selectEl          = document.getElementById("eventRegSelect");
  const heroTitle         = document.getElementById("eventHeroTitle");
  const heroCategory      = document.getElementById("eventHeroCategory");
  const heroDate          = document.getElementById("eventHeroDate");
  const heroVenue         = document.getElementById("eventHeroVenue");
  const heroDesc          = document.getElementById("eventHeroDesc");
  const formHeadingTitle  = document.getElementById("formHeadingTitle");
  const submitBtn         = document.getElementById("eventSubmitBtn");
  const successCard       = document.getElementById("eventSuccessCard");
  const registerAnotherBtn = document.getElementById("registerAnotherBtn");

  function getAllPageEvents() {
    return [..._events, ..._archivedEvents];
  }

  function populateSelectEl() {
    if (!selectEl) return;
    const allEvents  = getAllPageEvents();
    const currentVal = selectEl.value || eventIdFromUrl;
    selectEl.innerHTML = "";
    allEvents.forEach(evt => {
      const opt  = document.createElement("option");
      opt.value  = evt.id;
      const dStr = evt.date
        ? new Date(evt.date).toLocaleDateString([], { month: "short", day: "numeric" })
        : "";
      opt.textContent = `${evt.title}${dStr ? " (" + dStr + ")" : ""}`;
      selectEl.appendChild(opt);
    });
    if (eventIdFromUrl && Array.from(selectEl.options).some(o => o.value === eventIdFromUrl)) {
      selectEl.value = eventIdFromUrl;
    } else if (currentVal && Array.from(selectEl.options).some(o => o.value === currentVal)) {
      selectEl.value = currentVal;
    } else if (selectEl.options.length > 0) {
      selectEl.selectedIndex = 0;
    }
    updatePageForEvent(selectEl.value);
  }

  function updatePageForEvent(id) {
    const matched = getAllPageEvents().find(e => e.id === id);
    if (matched) {
      if (heroTitle)        heroTitle.textContent        = matched.title;
      if (heroCategory)     heroCategory.textContent     = matched.category || "Official Club Event";
      if (heroDate)         heroDate.textContent         = matched.date ? "📅 " + formatDateOnly(matched.date) : "📅 TBA";
      if (heroVenue)        heroVenue.textContent        = "📍 " + (matched.venue || "Campus Venue");
      if (heroDesc)         heroDesc.textContent         = matched.description || "Complete your registration details below.";
      if (formHeadingTitle) formHeadingTitle.textContent = `Register For ${matched.title}`;
      if (submitBtn)        submitBtn.textContent        = `Complete Registration for ${matched.title} →`;
      document.title = `Register: ${matched.title} — Step & Swing`;
    } else {
      if (heroTitle)        heroTitle.textContent        = "Select An Upcoming Event";
      if (heroCategory)     heroCategory.textContent     = "Event Registration";
      if (heroDate)         heroDate.textContent         = "📅 Check Schedule Below";
      if (heroVenue)        heroVenue.textContent        = "📍 Geeta University Campus";
      if (heroDesc)         heroDesc.textContent         = "Please select an event from the dropdown below to register.";
      if (formHeadingTitle) formHeadingTitle.textContent = "Event Registration";
      if (submitBtn)        submitBtn.textContent        = "Submit Event Registration →";
      document.title = "Event Registration — Step & Swing";
    }
  }

  // Called by onSnapshot when events data arrives
  _onEventsReadyForRegPage = populateSelectEl;

  // Also populate if events already loaded
  if (_events.length > 0) populateSelectEl();

  if (selectEl) {
    selectEl.addEventListener("change", function () {
      updatePageForEvent(this.value);
    });
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const fields = ["name", "rollNo", "department", "course", "year", "semester", "phone", "dance"];
    let valid = true;
    const values = {};

    fields.forEach(name => {
      const el  = form.elements[name];
      const val = (el ? el.value || "" : "").trim();
      values[name] = val;
      const wrap = form.querySelector(`[data-field="${name}"]`);
      let fieldValid = val.length > 0;
      if (name === "phone") fieldValid = /^[0-9]{10}$/.test(val.replace(/\s+/g, ""));
      if (name === "dance") fieldValid = val.length >= 3;
      if (wrap) wrap.classList.toggle("error", !fieldValid);
      if (!fieldValid) valid = false;
    });

    if (!valid) { showToast("Please check the highlighted fields.", true); return; }

    const selectedId  = selectEl ? selectEl.value : "";
    const matchedEvt  = getAllPageEvents().find(e => e.id === selectedId);
    const eventName   = matchedEvt ? matchedEvt.title : "General Membership";

    const entry = {
      eventId: selectedId || "general",
      eventName,
      name: values.name, rollNo: values.rollNo,
      department: values.department, course: values.course,
      year: values.year, semester: values.semester,
      phone: values.phone, dance: values.dance,
      submittedAt: new Date().toISOString()
    };

    try {
      await dbAddRegistration(entry);
      form.reset();
      form.style.display = "none";
      if (successCard) {
        const msg = document.getElementById("successMessageDetails");
        if (msg) msg.textContent = `Thank you ${values.name}! Your registration for "${eventName}" (Roll No: ${values.rollNo}) has been saved in the President Portal database.`;
        successCard.classList.add("show");
      }
      showToast(`Registration saved for "${eventName}"!`);
    } catch (err) {
      showToast("Error saving registration. Please try again.", true);
      console.error(err);
    }
  });

  if (registerAnotherBtn) {
    registerAnotherBtn.addEventListener("click", function () {
      if (successCard) successCard.classList.remove("show");
      form.style.display = "block";
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   SEPARATE CLUB MEMBERSHIP PAGE (club-join.html)
   ───────────────────────────────────────────────────────────── */
function initSeparateClubMembershipPage() {
  const form = document.getElementById("clubMembershipForm");
  if (!form) return;

  const successCard = document.getElementById("membershipSuccessCard");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const fields = ["name", "rollNo", "department", "course", "year", "semester", "phone", "dance"];
    let valid = true;
    const values = {};

    fields.forEach(name => {
      const el  = form.elements[name];
      const val = (el ? el.value || "" : "").trim();
      values[name] = val;
      const wrap = form.querySelector(`[data-field="${name}"]`);
      let fieldValid = val.length > 0;
      if (name === "phone") fieldValid = /^[0-9]{10}$/.test(val.replace(/\s+/g, ""));
      if (name === "dance") fieldValid = val.length >= 3;
      if (wrap) wrap.classList.toggle("error", !fieldValid);
      if (!fieldValid) valid = false;
    });

    // Validate dance category radio
    const selectedCategory = form.querySelector('input[name="danceCategory"]:checked');
    const categoryWrap = form.querySelector('[data-field="danceCategory"]');
    if (!selectedCategory) {
      if (categoryWrap) categoryWrap.classList.add("error");
      valid = false;
    } else {
      if (categoryWrap) categoryWrap.classList.remove("error");
      values.danceCategory = selectedCategory.value;
    }

    // Validate dance theme radio
    const selectedTheme = form.querySelector('input[name="danceTheme"]:checked');
    const themeWrap = form.querySelector('[data-field="danceTheme"]');
    if (!selectedTheme) {
      if (themeWrap) themeWrap.classList.add("error");
      valid = false;
    } else {
      if (themeWrap) themeWrap.classList.remove("error");
      values.danceTheme = selectedTheme.value;
    }

    if (!valid) { showToast("Please check the highlighted fields.", true); return; }

    const entry = {
      eventId: "freshers",
      eventName: "Freshers Registration",
      name: values.name, rollNo: values.rollNo,
      department: values.department, course: values.course,
      year: values.year, semester: values.semester,
      phone: values.phone,
      danceCategory: values.danceCategory,
      danceTheme: values.danceTheme,
      dance: values.dance,
      submittedAt: new Date().toISOString()
    };

    try {
      await dbAddRegistration(entry);
      form.reset();
      form.style.display = "none";
      if (successCard) {
        const msg = document.getElementById("membershipSuccessDetails");
        if (msg) msg.textContent = `Welcome ${values.name}! Your Freshers Registration (Roll No: ${values.rollNo}) has been saved in the official society records.`;
        successCard.classList.add("show");

        // Auto-redirect to WhatsApp group after 5-second countdown
        const WHATSAPP_URL = "https://chat.whatsapp.com/C3oC6Vu45fiAd7KA0b0rTk";
        const countdownEl = document.getElementById("waCountdown");
        let seconds = 5;
        const waTimer = setInterval(() => {
          seconds--;
          if (countdownEl) countdownEl.textContent = seconds;
          if (seconds <= 0) {
            clearInterval(waTimer);
            window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
          }
        }, 1000);
      }
      showToast("Club Membership registration submitted! Redirecting to WhatsApp…");
    } catch (err) {
      showToast("Error saving membership. Please try again.", true);
      console.error(err);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   BOOTSTRAP — DOMContentLoaded
   ───────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", function () {
  // 1. Init all UI modules immediately (don't wait for Firestore)
  initMobileNav();
  initScrollReveal();
  initRegistrationForm();
  initPresidentPortal();
  initEditModal();
  initSeparateEventRegistrationPage();
  initSeparateClubMembershipPage();

  // 2. Start real-time Firestore listeners
  setupListeners();

  // 3. Seed default events in background (non-blocking)
  seedDefaultEvents();
});
