/* ===========================================================
   STEP & SWING DANCE CLUB — script.js
   Shared logic for index.html (registration) and president.html
   (login-gated dashboard + Excel export + auto-logout).

   Storage: all registrations are kept in the browser's
   localStorage under STORAGE_KEY, as a JSON array. Both pages
   read/write the same key, so anything a student submits on
   index.html immediately shows up in the president dashboard.

   Credentials for the President Portal are defined once below.
   Change PRESIDENT_USERNAME / PRESIDENT_PASSWORD to update login.
   =========================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "stepSwing_registrations";
  const SESSION_KEY = "stepSwing_presidentSession";
  const EVENTS_KEY = "stepSwing_events";

  const PRESIDENT_USERNAME = "Vatan Preet Singh";
  const PRESIDENT_PASSWORD = "Vat@123456";

  /* ---------------------------------------------------------
     Storage helpers
     --------------------------------------------------------- */
  function getRegistrations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Could not read registrations:", e);
      return [];
    }
  }

  function saveRegistration(entry) {
    const all = getRegistrations();
    all.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return all;
  }

  function getEvents() {
    try {
      const raw = localStorage.getItem(EVENTS_KEY);
      if (raw) return JSON.parse(raw);
      
      // Default sample events
      const initial = [
        {
          id: "evt_1",
          title: "Inter-College Step & Swing Showdown 2026",
          date: new Date(Date.now() + 86400000 * 7).toISOString(),
          venue: "Geeta University Main Auditorium",
          category: "Competition",
          description: "High-energy rhythm step routines & swing battle open to all students. Certificate of achievement and trophies!",
          createdAt: new Date().toISOString()
        },
        {
          id: "evt_2",
          title: "Beginner Lindy Hop & Body Percussion Workshop",
          date: new Date(Date.now() + 86400000 * 14).toISOString(),
          venue: "Dance Studio Block B",
          category: "Workshop",
          description: "Learn fundamental 6-count swing footwork and percussive body stomps in an interactive 2-hour intensive session.",
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem(EVENTS_KEY, JSON.stringify(initial));
      return initial;
    } catch (e) {
      console.error("Could not read events:", e);
      return [];
    }
  }

  function saveEvent(eventData) {
    const events = getEvents();
    events.unshift(eventData);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    return events;
  }

  const ARCHIVED_EVENTS_KEY = "stepSwing_archivedEvents";

  function getArchivedEvents() {
    try {
      const raw = localStorage.getItem(ARCHIVED_EVENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Could not read archived events:", e);
      return [];
    }
  }

  function archiveEvent(eventId) {
    const events = getEvents();
    const idx = events.findIndex((e) => e.id === eventId);
    if (idx !== -1) {
      const [removed] = events.splice(idx, 1);
      removed.archivedAt = new Date().toISOString();
      localStorage.setItem(EVENTS_KEY, JSON.stringify(events));

      const archived = getArchivedEvents();
      archived.unshift(removed);
      localStorage.setItem(ARCHIVED_EVENTS_KEY, JSON.stringify(archived));
    }
  }

  function restoreArchivedEvent(eventId) {
    const archived = getArchivedEvents();
    const idx = archived.findIndex((e) => e.id === eventId);
    if (idx !== -1) {
      const [restored] = archived.splice(idx, 1);
      delete restored.archivedAt;
      localStorage.setItem(ARCHIVED_EVENTS_KEY, JSON.stringify(archived));

      const events = getEvents();
      events.unshift(restored);
      localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    }
  }

  function permanentlyDeleteArchivedEvent(eventId) {
    let archived = getArchivedEvents();
    archived = archived.filter((e) => e.id !== eventId);
    localStorage.setItem(ARCHIVED_EVENTS_KEY, JSON.stringify(archived));
  }

  function deleteEvent(eventId) {
    archiveEvent(eventId);
  }

  /* ---------------------------------------------------------
     Toast helper (used on both pages)
     --------------------------------------------------------- */
  function showToast(message, isError) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("err", !!isError);
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  /* ---------------------------------------------------------
     Scroll-reveal animation & Scroll Controls (Progress & Back To Top)
     --------------------------------------------------------- */
  function initScrollReveal() {
    const targets = document.querySelectorAll(".reveal, .reveal-up, .reveal-down, .reveal-left, .reveal-right, .reveal-zoom");
    
    if (targets.length) {
      if (!("IntersectionObserver" in window)) {
        targets.forEach((el) => el.classList.add("in"));
      } else {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("in");
              }
            });
          },
          { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
        );

        targets.forEach((el) => observer.observe(el));
      }
    }

    // Scroll progress bar & Back-to-Top elements
    const progressEl = document.getElementById("scrollProgress");
    const backToTopBtn = document.getElementById("backToTop");

    let ticking = false;

    function onScrollUpdate() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const viewportHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight - viewportHeight;

      // 1. Progress Bar
      if (progressEl && docHeight > 0) {
        progressEl.style.width = ((scrollTop / docHeight) * 100) + "%";
      }

      // 2. Back to top button
      if (backToTopBtn) {
        backToTopBtn.classList.toggle("show", scrollTop > 300);
      }

      // 3. High-intensity Parallax for Dancing Objects
      const danceObjects = document.querySelectorAll(".dance-object");
      danceObjects.forEach((obj, idx) => {
        const baseSpeed = parseFloat(obj.dataset.speed || "0.3");
        const baseRot = parseFloat(obj.dataset.rotate || "0.08");
        const speedMultiplier = 2.4; 
        const yPos = scrollTop * baseSpeed * speedMultiplier;
        const rot = scrollTop * baseRot * 2.8;
        const pulse = 1 + Math.sin(scrollTop * 0.005 + idx) * 0.15;
        obj.style.transform = `translate3d(0, ${yPos}px, 0) rotate(${rot}deg) scale(${pulse})`;
      });

      // 4. Hero Section Motion
      const heroH1 = document.querySelector(".hero h1");
      const heroTrail = document.querySelector(".hero .trail");
      const heroLede = document.querySelector(".hero .lede");
      if (heroH1) {
        heroH1.style.transform = `translate3d(0, ${scrollTop * 0.28}px, 0) scale(${Math.max(0.85, 1 - scrollTop * 0.0004)})`;
      }
      if (heroTrail) {
        heroTrail.style.transform = `translate3d(${Math.sin(scrollTop * 0.008) * 35}px, ${scrollTop * 0.16}px, 0)`;
      }
      if (heroLede) {
        heroLede.style.transform = `translate3d(0, ${scrollTop * 0.18}px, 0)`;
      }

      // 5. Section Headers Parallax Motion
      const sectionHeads = document.querySelectorAll(".section-head");
      sectionHeads.forEach((head) => {
        const rect = head.getBoundingClientRect();
        if (rect.top < viewportHeight && rect.bottom > 0) {
          const dist = (rect.top - viewportHeight / 2) * -0.06;
          head.style.transform = `translate3d(0, ${dist}px, 0)`;
        }
      });

      // 6. Style Cards & Team Cards Floating Motion on Scroll
      const styleCards = document.querySelectorAll(".style-card, .team-card");
      styleCards.forEach((card, idx) => {
        const rect = card.getBoundingClientRect();
        if (rect.top < viewportHeight && rect.bottom > 0) {
          const dir = idx % 2 === 0 ? 1 : -1;
          const dist = (rect.top - viewportHeight / 2) * 0.06 * dir;
          const rot = (rect.top - viewportHeight / 2) * 0.012 * dir;
          card.style.transform = `translate3d(0, ${dist}px, 0) rotate(${rot}deg)`;
        }
      });

      // 7. Stat Items Sway on Scroll
      const stats = document.querySelectorAll(".stat");
      stats.forEach((stat, idx) => {
        const rect = stat.getBoundingClientRect();
        if (rect.top < viewportHeight && rect.bottom > 0) {
          const offsetX = (idx % 2 === 0 ? 12 : -12) * Math.sin(scrollTop * 0.006);
          const offsetY = (rect.top - viewportHeight / 2) * -0.05;
          stat.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
        }
      });

      // 8. Registration Form Panel Floating Lift
      const formPanel = document.querySelector(".form-panel");
      if (formPanel) {
        const rect = formPanel.getBoundingClientRect();
        if (rect.top < viewportHeight && rect.bottom > 0) {
          const dist = (rect.top - viewportHeight / 2) * -0.05;
          formPanel.style.transform = `translate3d(0, ${dist}px, 0)`;
        }
      }

      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (!ticking) {
        window.requestAnimationFrame(onScrollUpdate);
        ticking = true;
      }
    });

    if (backToTopBtn) {
      backToTopBtn.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  /* ---------------------------------------------------------
     Events renderer (index.html & president.html)
     --------------------------------------------------------- */
  function renderEventsSection() {
    const container = document.getElementById("eventsContainer");
    const selectEl = document.getElementById("eventSelect");
    const filterSelect = document.getElementById("filterEventSelect");
    const events = getEvents();

    // Populate registration form event dropdown
    if (selectEl) {
      const currentVal = selectEl.value;
      selectEl.innerHTML = `<option value="general">General Dance Club Membership</option>`;
      events.forEach((evt) => {
        const opt = document.createElement("option");
        opt.value = evt.id;
        const dStr = evt.date ? new Date(evt.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "";
        opt.textContent = `${evt.title} ${dStr ? '(' + dStr + ')' : ''}`;
        selectEl.appendChild(opt);
      });
      if (currentVal && Array.from(selectEl.options).some(o => o.value === currentVal)) {
        selectEl.value = currentVal;
      }
    }

    // Populate President Portal filter dropdown
    if (filterSelect) {
      const filterVal = filterSelect.value;
      filterSelect.innerHTML = `<option value="all">All Registrations</option><option value="general">General Membership</option>`;
      events.forEach((evt) => {
        const opt = document.createElement("option");
        opt.value = evt.id;
        opt.textContent = evt.title;
        filterSelect.appendChild(opt);
      });
      if (filterVal) filterSelect.value = filterVal;
    }

    // Render Event Cards on index.html
    if (container) {
      container.innerHTML = "";
      if (!events.length) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--muted);" class="mono">No upcoming events scheduled. Check back soon!</div>`;
        return;
      }

      events.forEach((evt) => {
        const card = document.createElement("div");
        card.className = "event-card";
        const dateStr = evt.date ? new Date(evt.date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "TBA";
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
    }
  }

  /* ---------------------------------------------------------
     Registration form (index.html)
     --------------------------------------------------------- */
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

      fields.forEach((name) => {
        const el = form.elements[name];
        const value = (el ? el.value || "" : "").trim();
        values[name] = value;

        let fieldValid = value.length > 0;

        if (name === "phone") {
          fieldValid = /^[0-9]{10}$/.test(value.replace(/\s+/g, ""));
        }
        if (name === "dance") {
          fieldValid = value.length >= 3;
        }

        setError(name, !fieldValid);
        if (!fieldValid) valid = false;
      });

      return { valid, values };
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const { valid, values } = validate();

      if (!valid) {
        showToast("Please check the highlighted fields.", true);
        return;
      }

      const eventSelect = form.elements["eventId"];
      const eventId = eventSelect ? eventSelect.value : "general";
      const events = getEvents();
      const matchedEvt = events.find((ev) => ev.id === eventId);
      const eventName = matchedEvt ? matchedEvt.title : "General Membership";

      const entry = {
        eventId: eventId,
        eventName: eventName,
        name: values.name,
        rollNo: values.rollNo,
        department: values.department,
        course: values.course,
        year: values.year,
        semester: values.semester,
        phone: values.phone,
        dance: values.dance,
        submittedAt: new Date().toISOString(),
      };

      saveRegistration(entry);
      form.reset();
      renderEventsSection();
      showToast(`You're in! Saved registration for "${eventName}".`);
    });

    fields.forEach((name) => {
      const el = form.elements[name];
      if (el) {
        el.addEventListener("input", () => setError(name, false));
      }
    });
  }

  /* ---------------------------------------------------------
     President Portal — login, dashboard, events, export, auto-logout
     --------------------------------------------------------- */
  function initPresidentPortal() {
    const loginShell = document.getElementById("loginShell");
    const dashboard = document.getElementById("dashboard");
    const loginForm = document.getElementById("loginForm");
    if (!loginShell || !dashboard || !loginForm) return;

    const loginError = document.getElementById("loginError");
    const logoutBtn = document.getElementById("logoutBtn");
    const downloadBtn = document.getElementById("downloadBtn");
    const createEventForm = document.getElementById("createEventForm");
    const filterSelect = document.getElementById("filterEventSelect");

    function isLoggedIn() {
      return sessionStorage.getItem(SESSION_KEY) === "true";
    }

    function showDashboard() {
      loginShell.style.display = "none";
      dashboard.classList.add("show");
      renderEventsSection();
      renderEventsList();
      renderArchivedEventsList();
      renderDashboard();
    }

    function showLogin() {
      dashboard.classList.remove("show");
      loginShell.style.display = "flex";
      loginForm.reset();
      loginError.classList.remove("show");
    }

    function logOut(silent) {
      sessionStorage.removeItem(SESSION_KEY);
      showLogin();
      if (!silent) showToast("Logged out.");
    }

    // Login handling
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const username = loginForm.elements["username"].value.trim();
      const password = loginForm.elements["password"].value;

      if (username.toLowerCase() === PRESIDENT_USERNAME.toLowerCase() && password === PRESIDENT_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, "true");
        loginError.classList.remove("show");
        showDashboard();
      } else {
        loginError.classList.add("show");
      }
    });

    logoutBtn.addEventListener("click", () => logOut(false));

    // ---- Create New Event Handler ----
    if (createEventForm) {
      createEventForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const title = (createEventForm.elements["title"].value || "").trim();
        const date = createEventForm.elements["date"].value;
        const venue = (createEventForm.elements["venue"].value || "").trim();
        const category = (createEventForm.elements["category"].value || "").trim();
        const description = (createEventForm.elements["description"].value || "").trim();

        if (!title || !date || !venue) {
          showToast("Please fill in event title, date, and venue.", true);
          return;
        }

        const newEvent = {
          id: "evt_" + Date.now(),
          title,
          date,
          venue,
          category: category || "Club Event",
          description,
          createdAt: new Date().toISOString()
        };

        saveEvent(newEvent);
        createEventForm.reset();
        showToast(`Event "${title}" created and published!`);
        renderEventsSection();
        renderEventsList();
        renderArchivedEventsList();
        renderDashboard();
      });
    }

    // ---- Render Active Events List (President Portal) ----
    function renderEventsList() {
      const eventsBody = document.getElementById("eventsBody");
      const eventsEmptyState = document.getElementById("eventsEmptyState");
      const eventsTable = document.getElementById("eventsTable");
      const events = getEvents();
      const registrations = getRegistrations();

      populateFilterSelectOptions();

      if (!eventsBody) return;
      eventsBody.innerHTML = "";

      if (!events.length) {
        if (eventsTable) eventsTable.style.display = "none";
        if (eventsEmptyState) eventsEmptyState.style.display = "block";
      } else {
        if (eventsTable) eventsTable.style.display = "table";
        if (eventsEmptyState) eventsEmptyState.style.display = "none";

        events.forEach((evt, i) => {
          const regCount = registrations.filter((r) => r.eventId === evt.id).length;
          const dStr = evt.date ? new Date(evt.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "TBA";
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${i + 1}</td>
            <td><b>${escapeHtml(evt.title)}</b></td>
            <td class="mono">${dStr}</td>
            <td>${escapeHtml(evt.venue)}</td>
            <td><span class="category-badge">${escapeHtml(evt.category)}</span></td>
            <td><b>${regCount}</b> registrations</td>
            <td>
              <button class="btn ghost btn-sm download-evt-btn" data-id="${evt.id}" data-title="${escapeHtml(evt.title)}" title="Download Excel for this event only">📊 Excel</button>
              <button class="btn ghost btn-sm edit-evt-btn" data-id="${evt.id}" title="Edit event details">✏️ Edit</button>
              <button class="btn danger btn-sm delete-evt-btn" data-id="${evt.id}" data-title="${escapeHtml(evt.title)}">Delete</button>
            </td>
          `;
          eventsBody.appendChild(tr);
        });

        eventsBody.querySelectorAll(".edit-evt-btn").forEach((btn) => {
          btn.addEventListener("click", function () {
            const id = this.dataset.id;
            const target = getEvents().find((e) => e.id === id);
            if (target) openEditModal(target);
          });
        });

        eventsBody.querySelectorAll(".delete-evt-btn").forEach((btn) => {
          btn.addEventListener("click", function () {
            const id = this.dataset.id;
            const title = this.dataset.title || "this event";
            if (confirm(`Are you sure you want to delete event "${title}"? It will be moved to the Past & Deleted Archive.`)) {
              deleteEvent(id);
              showToast(`Event "${title}" moved to Past & Deleted Archive.`);
              renderEventsSection();
              renderEventsList();
              renderArchivedEventsList();
              renderDashboard();
            }
          });
        });

        eventsBody.querySelectorAll(".download-evt-btn").forEach((btn) => {
          btn.addEventListener("click", function () {
            const id = this.dataset.id;
            const title = this.dataset.title || "Event";
            const records = getRegistrations().filter((r) => r.eventId === id);
            exportToExcel(records, `StepAndSwing_Event_${title}`);
          });
        });
      }
    }

    // ---- Render Past & Deleted Events Archive (President Portal) ----
    function renderArchivedEventsList() {
      const archivedBody = document.getElementById("archivedEventsBody");
      const archivedEmptyState = document.getElementById("archivedEventsEmptyState");
      const archivedTable = document.getElementById("archivedEventsTable");
      const archivedEvents = getArchivedEvents();
      const registrations = getRegistrations();

      populateFilterSelectOptions();

      if (!archivedBody) return;
      archivedBody.innerHTML = "";

      if (!archivedEvents.length) {
        if (archivedTable) archivedTable.style.display = "none";
        if (archivedEmptyState) archivedEmptyState.style.display = "block";
      } else {
        if (archivedTable) archivedTable.style.display = "table";
        if (archivedEmptyState) archivedEmptyState.style.display = "none";

        archivedEvents.forEach((evt, i) => {
          const regCount = registrations.filter((r) => r.eventId === evt.id).length;
          const dStr = evt.date ? new Date(evt.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "TBA";
          const archStr = evt.archivedAt ? new Date(evt.archivedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "—";
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${i + 1}</td>
            <td><b>${escapeHtml(evt.title)}</b></td>
            <td class="mono">${dStr}</td>
            <td>${escapeHtml(evt.venue)}</td>
            <td class="mono" style="font-size:11.5px; color:var(--muted);">${archStr}</td>
            <td><b>${regCount}</b> registrations</td>
            <td>
              <button class="btn ghost btn-sm download-archived-evt-btn" data-id="${evt.id}" data-title="${escapeHtml(evt.title)}" title="Download Excel for this archived event">📊 Excel</button>
              <button class="btn ghost btn-sm edit-archived-evt-btn" data-id="${evt.id}" title="Edit archived event details">✏️ Edit</button>
              <button class="btn ghost btn-sm restore-archived-evt-btn" data-id="${evt.id}" data-title="${escapeHtml(evt.title)}" title="Restore event to active list">↺ Restore</button>
              <button class="btn danger btn-sm perm-delete-archived-evt-btn" data-id="${evt.id}" data-title="${escapeHtml(evt.title)}" title="Permanently delete from archive">Delete</button>
            </td>
          `;
          archivedBody.appendChild(tr);
        });

        archivedBody.querySelectorAll(".edit-archived-evt-btn").forEach((btn) => {
          btn.addEventListener("click", function () {
            const id = this.dataset.id;
            const target = getArchivedEvents().find((e) => e.id === id);
            if (target) openEditModal(target);
          });
        });

        archivedBody.querySelectorAll(".download-archived-evt-btn").forEach((btn) => {
          btn.addEventListener("click", function () {
            const id = this.dataset.id;
            const title = this.dataset.title || "Archived_Event";
            const records = getRegistrations().filter((r) => r.eventId === id);
            exportToExcel(records, `StepAndSwing_ArchivedEvent_${title}`);
          });
        });

        archivedBody.querySelectorAll(".restore-archived-evt-btn").forEach((btn) => {
          btn.addEventListener("click", function () {
            const id = this.dataset.id;
            const title = this.dataset.title || "this event";
            restoreArchivedEvent(id);
            showToast(`Event "${title}" restored to Active Published Events.`);
            renderEventsSection();
            renderEventsList();
            renderArchivedEventsList();
            renderDashboard();
          });
        });

        archivedBody.querySelectorAll(".perm-delete-archived-evt-btn").forEach((btn) => {
          btn.addEventListener("click", function () {
            const id = this.dataset.id;
            const title = this.dataset.title || "this event";
            if (confirm(`Permanently delete archived record for "${title}"? Registrations will remain saved.`)) {
              permanentlyDeleteArchivedEvent(id);
              showToast(`Archived event "${title}" deleted permanently.`);
              renderArchivedEventsList();
              renderDashboard();
            }
          });
        });
      }
    }

    // ---- Edit Event Modal Logic ----
    const editModal = document.getElementById("editEventModal");
    const editForm = document.getElementById("editEventForm");
    const closeEditModalBtn = document.getElementById("closeEditModalBtn");
    const cancelEditBtn = document.getElementById("cancelEditBtn");

    function openEditModal(evt) {
      if (!editModal || !editForm) return;
      document.getElementById("editEventId").value = evt.id;
      document.getElementById("editEventTitle").value = evt.title || "";
      document.getElementById("editEventDate").value = evt.date ? new Date(evt.date).toISOString().slice(0, 16) : "";
      document.getElementById("editEventVenue").value = evt.venue || "";
      document.getElementById("editEventCategory").value = evt.category || "";
      document.getElementById("editEventDesc").value = evt.description || "";
      editModal.style.display = "flex";
    }

    function closeEditModal() {
      if (editModal) editModal.style.display = "none";
      if (editForm) editForm.reset();
    }

    if (closeEditModalBtn) closeEditModalBtn.addEventListener("click", closeEditModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener("click", closeEditModal);

    if (editForm) {
      editForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const id = document.getElementById("editEventId").value;
        const title = document.getElementById("editEventTitle").value.trim();
        const date = document.getElementById("editEventDate").value;
        const venue = document.getElementById("editEventVenue").value.trim();
        const category = document.getElementById("editEventCategory").value.trim();
        const description = document.getElementById("editEventDesc").value.trim();

        if (!title || !date || !venue) {
          showToast("Please fill in Title, Date & Time, and Venue.", true);
          return;
        }

        // Check active events
        let activeEvents = getEvents();
        const activeIdx = activeEvents.findIndex((e) => e.id === id);
        if (activeIdx !== -1) {
          activeEvents[activeIdx] = {
            ...activeEvents[activeIdx],
            title,
            date,
            venue,
            category: category || "Club Event",
            description,
            updatedAt: new Date().toISOString(),
          };
          localStorage.setItem(EVENTS_KEY, JSON.stringify(activeEvents));
        } else {
          // Check archived events
          let archivedEvents = getArchivedEvents();
          const archIdx = archivedEvents.findIndex((e) => e.id === id);
          if (archIdx !== -1) {
            archivedEvents[archIdx] = {
              ...archivedEvents[archIdx],
              title,
              date,
              venue,
              category: category || "Club Event",
              description,
              updatedAt: new Date().toISOString(),
            };
            localStorage.setItem(ARCHIVED_EVENTS_KEY, JSON.stringify(archivedEvents));
          }
        }

        // Also update eventName in student registrations if matching eventId
        let registrations = getRegistrations();
        let updatedRegs = false;
        registrations.forEach((r) => {
          if (r.eventId === id) {
            r.eventName = title;
            updatedRegs = true;
          }
        });
        if (updatedRegs) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(registrations));
        }

        closeEditModal();
        showToast(`Event "${title}" updated successfully!`);
        renderEventsSection();
        renderEventsList();
        renderArchivedEventsList();
        renderDashboard();
      });
    }

    const downloadAllArchivedExcelBtn = document.getElementById("downloadAllArchivedExcelBtn");
    if (downloadAllArchivedExcelBtn) {
      downloadAllArchivedExcelBtn.addEventListener("click", function () {
        const archivedEvents = getArchivedEvents();
        const archivedIds = new Set(archivedEvents.map((e) => e.id));
        const records = getRegistrations().filter((r) => archivedIds.has(r.eventId));
        exportToExcel(records, "StepAndSwing_All_Archived_Events");
      });
    }

    function populateFilterSelectOptions() {
      if (!filterSelect) return;
      const currentVal = filterSelect.value || "all";
      const activeEvents = getEvents();
      const archivedEvents = getArchivedEvents();

      let html = `<option value="all">All Registrations</option>`;
      html += `<option value="general">General Membership</option>`;

      if (activeEvents.length) {
        html += `<optgroup label="Active Published Events">`;
        activeEvents.forEach((e) => {
          html += `<option value="${e.id}">${escapeHtml(e.title)}</option>`;
        });
        html += `</optgroup>`;
      }

      if (archivedEvents.length) {
        html += `<optgroup label="Past &amp; Deleted Events">`;
        archivedEvents.forEach((e) => {
          html += `<option value="${e.id}">[Archived] ${escapeHtml(e.title)}</option>`;
        });
        html += `</optgroup>`;
      }

      filterSelect.innerHTML = html;
      if ([...filterSelect.options].some((opt) => opt.value === currentVal)) {
        filterSelect.value = currentVal;
      }
    }

    // ---- Delete registration helper ----
    function deleteRegistration(index) {
      const all = getRegistrations();
      if (index >= 0 && index < all.length) {
        const removed = all.splice(index, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        showToast(`Deleted registration for ${removed[0]?.name || "student"}.`);
        renderDashboard();
        renderEventsList();
      }
    }

    // ---- Clear all registrations helper ----
    const clearAllBtn = document.getElementById("clearAllBtn");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", function () {
        const data = getRegistrations();
        if (!data.length) {
          showToast("No registrations to clear.", true);
          return;
        }
        if (confirm("Are you sure you want to delete ALL student registrations? This cannot be undone.")) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
          showToast("All registrations deleted.");
          renderDashboard();
          renderEventsList();
        }
      });
    }

    if (filterSelect) {
      filterSelect.addEventListener("change", renderDashboard);
    }

    // Handle delete button clicks inside table
    const tbody = document.getElementById("regBody");
    if (tbody) {
      tbody.addEventListener("click", function (e) {
        const btn = e.target.closest(".delete-btn");
        if (btn) {
          const idx = parseInt(btn.dataset.index, 10);
          const studentName = btn.dataset.name || "this registration";
          if (confirm(`Are you sure you want to delete the registration for "${studentName}"?`)) {
            deleteRegistration(idx);
          }
        }
      });
    }

    // ---- Render dashboard table + stats ----
    function renderDashboard() {
      let data = getRegistrations();
      const events = getEvents();
      const filterVal = filterSelect ? filterSelect.value : "all";

      let filteredData = data;
      if (filterVal && filterVal !== "all") {
        filteredData = data.filter((r) => (r.eventId || "general") === filterVal);
      }

      const tbody = document.getElementById("regBody");
      const emptyState = document.getElementById("emptyState");
      const table = document.getElementById("regTable");

      if (!tbody) return;
      tbody.innerHTML = "";

      if (!filteredData.length) {
        table.style.display = "none";
        emptyState.style.display = "block";
      } else {
        table.style.display = "table";
        emptyState.style.display = "none";

        filteredData.forEach((r, i) => {
          const tr = document.createElement("tr");
          const submitted = r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—";
          const eventLabel = r.eventName || "General Membership";
          tr.innerHTML = `
            <td>${i + 1}</td>
            <td><b style="color:var(--gold);">${escapeHtml(eventLabel)}</b></td>
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
              <button class="btn danger btn-sm delete-btn" data-index="${data.indexOf(r)}" data-name="${escapeHtml(r.name)}" title="Delete this entry">Delete</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Stats
      const depts = new Set(data.map((r) => (r.department || "").trim().toLowerCase()).filter(Boolean));
      const todayStr = new Date().toDateString();
      const today = data.filter((r) => r.submittedAt && new Date(r.submittedAt).toDateString() === todayStr).length;

      document.getElementById("statTotal").textContent = data.length;
      if (document.getElementById("statEvents")) document.getElementById("statEvents").textContent = events.length;
      document.getElementById("statDept").textContent = depts.size;
      document.getElementById("statToday").textContent = today;
    }

    function escapeHtml(str) {
      return String(str || "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[c]));
    }

    // ---- Reusable Excel Export Helper (SheetJS) ----
    function exportToExcel(records, filenamePrefix) {
      if (!records || !records.length) {
        showToast("No registrations found to export for this selection.", true);
        return;
      }

      if (typeof XLSX === "undefined") {
        showToast("Excel library failed to load. Check your connection.", true);
        return;
      }

      const rows = records.map((r, i) => ({
        "S.No": i + 1,
        "Registered For": r.eventName || "General Membership",
        "Full Name": r.name,
        "Roll No": r.rollNo,
        "Department": r.department,
        "Course": r.course,
        "Year": r.year,
        "Semester": r.semester,
        "Phone No": r.phone,
        "Dance Styles": r.dance,
        "Submitted On": r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);

      worksheet["!cols"] = [
        { wch: 6 }, { wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 18 },
        { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 20 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");

      const cleanPrefix = (filenamePrefix || "StepAndSwing_Registrations")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_");
      const dateStamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `${cleanPrefix}_${dateStamp}.xlsx`);
      showToast(`Excel file downloaded (${records.length} records).`);
    }

    // Export All Registrations
    if (downloadBtn) {
      downloadBtn.addEventListener("click", function () {
        exportToExcel(getRegistrations(), "StepAndSwing_All_Registrations");
      });
    }

    // Export General Membership Registrations Only
    const downloadGeneralBtn = document.getElementById("downloadGeneralBtn");
    if (downloadGeneralBtn) {
      downloadGeneralBtn.addEventListener("click", function () {
        const generalRecords = getRegistrations().filter((r) => (r.eventId || "general") === "general");
        exportToExcel(generalRecords, "StepAndSwing_General_Club_Members");
      });
    }

    // Export Current Filter Selection
    const downloadFilteredBtn = document.getElementById("downloadFilteredBtn");
    if (downloadFilteredBtn) {
      downloadFilteredBtn.addEventListener("click", function () {
        const filterVal = filterSelect ? filterSelect.value : "all";
        const data = getRegistrations();
        if (filterVal === "general") {
          exportToExcel(data.filter((r) => (r.eventId || "general") === "general"), "StepAndSwing_General_Club_Members");
        } else if (filterVal !== "all") {
          const matchedEvt = getEvents().find((e) => e.id === filterVal);
          const title = matchedEvt ? matchedEvt.title : "Event";
          exportToExcel(data.filter((r) => r.eventId === filterVal), `StepAndSwing_Event_${title}`);
        } else {
          exportToExcel(data, "StepAndSwing_All_Registrations");
        }
      });
    }

    // Auto-logout when going back or leaving the page
    const backLinks = document.querySelectorAll('a[href*="index.html"]');
    backLinks.forEach((link) => {
      link.addEventListener("click", function () {
        sessionStorage.removeItem(SESSION_KEY);
      });
    });

    window.addEventListener("pagehide", function () {
      sessionStorage.removeItem(SESSION_KEY);
    });

    window.addEventListener("pageshow", function (event) {
      if (!isLoggedIn()) {
        showLogin();
      }
    });

    // Initial state on load
    if (isLoggedIn()) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  /* ---------------------------------------------------------
     Mobile Navigation Toggle
     --------------------------------------------------------- */
  function initMobileNav() {
    const toggleBtn = document.getElementById("navToggle");
    const navLinks = document.getElementById("navLinks");
    if (!toggleBtn || !navLinks) return;

    toggleBtn.addEventListener("click", function () {
      toggleBtn.classList.toggle("active");
      navLinks.classList.toggle("show");
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", function () {
        toggleBtn.classList.remove("active");
        navLinks.classList.remove("show");
      });
    });
  }

  /* ---------------------------------------------------------
     Separate Dedicated Event Registration Page (event-register.html)
     --------------------------------------------------------- */
  function initSeparateEventRegistrationPage() {
    const form = document.getElementById("eventRegForm");
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    const eventIdFromUrl = params.get("eventId") || "general";

    const selectEl = document.getElementById("eventRegSelect");
    const heroTitle = document.getElementById("eventHeroTitle");
    const heroCategory = document.getElementById("eventHeroCategory");
    const heroDate = document.getElementById("eventHeroDate");
    const heroVenue = document.getElementById("eventHeroVenue");
    const heroDesc = document.getElementById("eventHeroDesc");
    const formHeadingTitle = document.getElementById("formHeadingTitle");
    const submitBtn = document.getElementById("eventSubmitBtn");
    const successCard = document.getElementById("eventSuccessCard");
    const registerAnotherBtn = document.getElementById("registerAnotherBtn");

    const allEvents = [...getEvents(), ...getArchivedEvents()];

    // Populate dropdown options
    if (selectEl) {
      selectEl.innerHTML = `<option value="general">General Dance Club Membership</option>`;
      allEvents.forEach((evt) => {
        const opt = document.createElement("option");
        opt.value = evt.id;
        const dStr = evt.date ? new Date(evt.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "";
        opt.textContent = `${evt.title} ${dStr ? '(' + dStr + ')' : ''}`;
        selectEl.appendChild(opt);
      });
      if (Array.from(selectEl.options).some((o) => o.value === eventIdFromUrl)) {
        selectEl.value = eventIdFromUrl;
      }
    }

    function updatePageForEvent(id) {
      const matched = allEvents.find((e) => e.id === id);
      if (matched) {
        if (heroTitle) heroTitle.textContent = matched.title;
        if (heroCategory) heroCategory.textContent = matched.category || "Official Club Event";
        if (heroDate) heroDate.textContent = matched.date ? "📅 " + new Date(matched.date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "📅 TBA";
        if (heroVenue) heroVenue.textContent = "📍 " + (matched.venue || "Campus Venue");
        if (heroDesc) heroDesc.textContent = matched.description || "Complete your registration details below.";
        if (formHeadingTitle) formHeadingTitle.textContent = `Register For ${matched.title}`;
        if (submitBtn) submitBtn.textContent = `Complete Registration for ${matched.title} →`;
        document.title = `Register: ${matched.title} — Step & Swing`;
      } else {
        if (heroTitle) heroTitle.textContent = "General Dance Club Registration";
        if (heroCategory) heroCategory.textContent = "General Membership";
        if (heroDate) heroDate.textContent = "📅 Ongoing Academic Year 2026";
        if (heroVenue) heroVenue.textContent = "📍 Geeta University Campus";
        if (heroDesc) heroDesc.textContent = "Register to join Step & Swing Dance Club and participate in weekly step, swing, and contemporary dance workshops.";
        if (formHeadingTitle) formHeadingTitle.textContent = "General Club Registration";
        if (submitBtn) submitBtn.textContent = "Submit Club Registration →";
        document.title = "General Registration — Step & Swing";
      }
    }

    updatePageForEvent(selectEl ? selectEl.value : eventIdFromUrl);

    if (selectEl) {
      selectEl.addEventListener("change", function () {
        updatePageForEvent(this.value);
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const fields = ["name", "rollNo", "department", "course", "year", "semester", "phone", "dance"];
      let valid = true;
      const values = {};

      fields.forEach((name) => {
        const el = form.elements[name];
        const val = (el ? el.value || "" : "").trim();
        values[name] = val;
        const wrap = form.querySelector(`[data-field="${name}"]`);
        let fieldValid = val.length > 0;
        if (name === "phone") fieldValid = /^[0-9]{10}$/.test(val.replace(/\s+/g, ""));
        if (name === "dance") fieldValid = val.length >= 3;
        if (wrap) wrap.classList.toggle("error", !fieldValid);
        if (!fieldValid) valid = false;
      });

      if (!valid) {
        showToast("Please check the highlighted fields.", true);
        return;
      }

      const selectedId = selectEl ? selectEl.value : "general";
      const matchedEvt = allEvents.find((e) => e.id === selectedId);
      const eventName = matchedEvt ? matchedEvt.title : "General Membership";

      const entry = {
        eventId: selectedId,
        eventName: eventName,
        name: values.name,
        rollNo: values.rollNo,
        department: values.department,
        course: values.course,
        year: values.year,
        semester: values.semester,
        phone: values.phone,
        dance: values.dance,
        submittedAt: new Date().toISOString(),
      };

      saveRegistration(entry);
      form.reset();
      form.style.display = "none";
      if (successCard) {
        const msg = document.getElementById("successMessageDetails");
        if (msg) msg.textContent = `Thank you ${values.name}! Your registration for "${eventName}" (Roll No: ${values.rollNo}) has been saved in the President Portal database.`;
        successCard.classList.add("show");
      }
      showToast(`Registration saved for "${eventName}"!`);
    });

    if (registerAnotherBtn) {
      registerAnotherBtn.addEventListener("click", function () {
        if (successCard) successCard.classList.remove("show");
        form.style.display = "block";
      });
    }
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    initMobileNav();
    initScrollReveal();
    initRegistrationForm();
    initPresidentPortal();
    renderEventsSection();
    initSeparateEventRegistrationPage();
  });
})();
