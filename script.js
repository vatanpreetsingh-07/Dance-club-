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

      // 6. Style Cards Floating Motion on Scroll
      const styleCards = document.querySelectorAll(".style-card");
      styleCards.forEach((card, idx) => {
        const rect = card.getBoundingClientRect();
        if (rect.top < viewportHeight && rect.bottom > 0) {
          const dir = idx % 2 === 0 ? 1 : -1;
          const dist = (rect.top - viewportHeight / 2) * 0.07 * dir;
          const rot = (rect.top - viewportHeight / 2) * 0.015 * dir;
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
        const value = (el.value || "").trim();
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

      const entry = {
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
      showToast("You're in! Registration saved successfully.");
    });

    // Clear error styling as the student corrects a field
    fields.forEach((name) => {
      const el = form.elements[name];
      if (el) {
        el.addEventListener("input", () => setError(name, false));
      }
    });
  }

  /* ---------------------------------------------------------
     President Portal — login, dashboard, export, auto-logout
     --------------------------------------------------------- */
  function initPresidentPortal() {
    const loginShell = document.getElementById("loginShell");
    const dashboard = document.getElementById("dashboard");
    const loginForm = document.getElementById("loginForm");
    if (!loginShell || !dashboard || !loginForm) return; // not on this page

    const loginError = document.getElementById("loginError");
    const logoutBtn = document.getElementById("logoutBtn");
    const downloadBtn = document.getElementById("downloadBtn");

    function isLoggedIn() {
      return sessionStorage.getItem(SESSION_KEY) === "true";
    }

    function showDashboard() {
      loginShell.style.display = "none";
      dashboard.classList.add("show");
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

    // ---- Login handling ----
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

    // ---- Delete registration helper ----
    function deleteRegistration(index) {
      const all = getRegistrations();
      if (index >= 0 && index < all.length) {
        const removed = all.splice(index, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        showToast(`Deleted registration for ${removed[0]?.name || "student"}.`);
        renderDashboard();
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
        }
      });
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
      const data = getRegistrations();
      const tbody = document.getElementById("regBody");
      const emptyState = document.getElementById("emptyState");
      const table = document.getElementById("regTable");

      if (!tbody) return;
      tbody.innerHTML = "";

      if (!data.length) {
        table.style.display = "none";
        emptyState.style.display = "block";
      } else {
        table.style.display = "table";
        emptyState.style.display = "none";

        data.forEach((r, i) => {
          const tr = document.createElement("tr");
          const submitted = r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—";
          tr.innerHTML = `
            <td>${i + 1}</td>
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
              <button class="btn danger btn-sm delete-btn" data-index="${i}" data-name="${escapeHtml(r.name)}" title="Delete this entry">Delete</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Stats
      const depts = new Set(data.map((r) => (r.department || "").trim().toLowerCase()).filter(Boolean));
      const courses = new Set(data.map((r) => (r.course || "").trim().toLowerCase()).filter(Boolean));
      const todayStr = new Date().toDateString();
      const today = data.filter((r) => r.submittedAt && new Date(r.submittedAt).toDateString() === todayStr).length;

      document.getElementById("statTotal").textContent = data.length;
      document.getElementById("statDept").textContent = depts.size;
      document.getElementById("statCourse").textContent = courses.size;
      document.getElementById("statToday").textContent = today;
    }

    function escapeHtml(str) {
      return String(str || "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[c]));
    }

    // ---- Excel export (SheetJS) ----
    downloadBtn.addEventListener("click", function () {
      const data = getRegistrations();

      if (!data.length) {
        showToast("No registrations to export yet.", true);
        return;
      }

      if (typeof XLSX === "undefined") {
        showToast("Excel library failed to load. Check your connection.", true);
        return;
      }

      const rows = data.map((r, i) => ({
        "S.No": i + 1,
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

      // Professional formatting: sensible column widths
      worksheet["!cols"] = [
        { wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 18 },
        { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 20 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");

      const dateStamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `StepAndSwing_Registrations_${dateStamp}.xlsx`);
      showToast("Excel sheet downloaded.");
    });

    // ---- Initial state on load ----
    if (isLoggedIn()) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    initScrollReveal();
    initRegistrationForm();
    initPresidentPortal();
  });
})();
