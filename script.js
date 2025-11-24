document.addEventListener("DOMContentLoaded", () => {
  /* ---------- Helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const on = (el, evt, fn) => el && el.addEventListener(evt, fn);
  const setDisplay = (el, show) => { if (el) el.style.display = show ? "flex" : "none"; };

  /* ---------- Universal Modal Close (X button) ---------- */
  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest(".modal-close-x");
    if (!closeBtn) return;

    const modalOverlay = closeBtn.closest('[role="dialog"]');
    if (modalOverlay) {
      modalOverlay.style.display = "none";
    }
  });

  const CATEGORIES = new Set(["Groceries", "Social", "Treat", "Unexpected"]);
  const CARDS = new Set(["Credit", "Debit"]);

  /* ---------- Grabs ---------- */
  const addBtn = $("addExpenseBtn");
  const showFavouritesBtn = $("showFavouritesBtn");
  const noSpendBtn = $("noSpendBtn");

  const submittedTable = $("submittedExpenses");
  let submittedTableBody =
    submittedTable.querySelector("tbody") ||
    submittedTable.appendChild(document.createElement("tbody"));

  const clearAllBtn = $("clearAllBtn");

  const setAllowanceBtn = $("setAllowanceBtn");
  const allowanceDisplay = $("allowanceDisplay");
  const allowanceRemainingDiv = $("allowanceRemaining");

  // Sidebar feature buttons
  const analyticsBtn = $("analyticsBtn");
  const leaderboardBtn = $("leaderboardBtn");
  const rewardsBtn = $("rewardsBtn");

  // Allowance mode toggle
  const weeklyBtn = $("allowWeeklyBtn");
  const dailyBtn = $("allowDailyBtn");

  // Sidebar stats
  const scoreTotalEl = $("scoreTotal");
  const streakEl = $("streakDisplay");
  const levelEl = $("levelDisplay");

  // Favourites Modal
  const favesOverlay = $("favesModalOverlay");
  const favesList = $("favesList");
  const favesCloseBtn = $("favesCloseBtn");

  // Favourite Name Modal
  const favNameOverlay = $("favNameModalOverlay");
  const favNameInput = $("favNameInput");
  const favNameCancel = $("favNameCancelBtn");
  const favNameSave = $("favNameSaveBtn");

  // Day controls
  const prevBtn = $("prevMonthBtn");
  const nextBtn = $("nextMonthBtn");
  const hardResetBtn = $("hardResetBtn");
  const monthSelect = $("monthSelect");
  const yearSelect = $("yearSelect");
  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  const dayBtn = $("dayCounterBtn");
  let currentDay = 1; // 1..7

  // Rails
  const tableWrap = document.querySelector(".table-wrap") || document.body;
  const deleteRail = $("deleteRail");
  const leftRail = $("leftRail");

  /* ---------- Chart (main sidebar pie - optional) ---------- */
  let categoryChart = null;

  const chartCanvas = $("categoryChart");
  if (chartCanvas) {
    const ctx = chartCanvas.getContext("2d");
    categoryChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Groceries", "Social", "Treat", "Unexpected"],
        datasets: [{
          label: "Category Breakdown",
          data: [0, 0, 0, 0],
          backgroundColor: ["#11cdef","#0b2a4a","#0f766e","#ffb000"]
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } }
      }
    });
  }

  (() => {
    if (!categoryChart) return;

    const css = getComputedStyle(document.documentElement);
    const themed = ["--turquoise","--navy","--teal","--amber"]
      .map(v => css.getPropertyValue(v).trim());

    categoryChart.data.datasets[0].backgroundColor =
      themed.map((c,i)=> c || categoryChart.data.datasets[0].backgroundColor[i]);

    categoryChart.update();
  })();

  /* ---------- State ---------- */
  const STATE_KEY = "savr-monthly-state-v1";
  const SETTINGS_KEY = "savr-settings-v1";
  const FAV_KEY = "savr-favourites-v1";

  function loadJSON(k) {
    try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
  }
  function saveJSON(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  let monthlyState = loadJSON(STATE_KEY) || {};
  let settings = loadJSON(SETTINGS_KEY) || {
    allowance: 0,
    score: 0,
    streak: 0,
    lastActiveDay: null,
    allowanceMode: "weekly"
  };
  let favourites = loadJSON(FAV_KEY) || {}; // { "<period>-id": { id, year, monthIndex, amount, category, card, name } }

  const saveState = () => saveJSON(STATE_KEY, monthlyState);
  const saveSettings = () => saveJSON(SETTINGS_KEY, settings);
  const saveFavourites = () => saveJSON(FAV_KEY, favourites);

  // Backfill missing fields
  if (typeof settings.allowance !== "number") settings.allowance = Number(settings.allowance) || 0;
  if (typeof settings.score !== "number") settings.score = 0;
  if (typeof settings.streak !== "number") settings.streak = 0;
  if (typeof settings.lastActiveDay !== "number") settings.lastActiveDay = null;
  if (typeof settings.allowanceMode !== "string") settings.allowanceMode = "weekly";

  // Clean legacy per-month allowance keys
  for (const k of Object.keys(monthlyState)) {
    if (monthlyState[k] && "allowance" in monthlyState[k]) {
      delete monthlyState[k].allowance;
    }
  }

  const yyyymmKey = (y, m) => `${y}-${String(m + 1).padStart(2,"0")}`;

  // Use day buckets when the Day UI exists (day-1…day-7), otherwise fall back to month key.
  const periodKey = () =>
    (dayBtn ? `day-${currentDay}` : yyyymmKey(currentYear, currentMonthIndex));

  // Favourite keys are tied to the current period (day).
  const compositeId = (id) => `${periodKey()}-${id}`;

  let currentYear, currentMonthIndex;

  function ensureMonth(key) {
    if (!monthlyState[key]) {
      monthlyState[key] = {
        expenses: [],
        categoryTotals: { Groceries: 0, Social: 0, Treat: 0, Unexpected: 0 },
        purchaseCount: 0,
        noSpending: false
      };
    } else {
      if (typeof monthlyState[key].purchaseCount !== "number") {
        monthlyState[key].purchaseCount = 0;
      }
      if (!monthlyState[key].categoryTotals) {
        monthlyState[key].categoryTotals = {
          Groceries: 0, Social: 0, Treat: 0, Unexpected: 0
        };
      }
      if (typeof monthlyState[key].noSpending !== "boolean") {
        monthlyState[key].noSpending = false;
      }
    }
    return monthlyState[key];
  }
  const currentKey = () => periodKey();
  const getMonthData = () => ensureMonth(currentKey());
  const findExpenseById = (id) => getMonthData().expenses.find(e => e.id === id);
  const isFavourited = (id) => !!favourites[compositeId(id)];

  /* ---------- Day pickers ---------- */
  (function initMonthYearPickers() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonthIndex = now.getMonth();

    if (dayBtn) dayBtn.textContent = `Day ${currentDay}`;

    if (monthSelect) {
      monthNames.forEach((n,i)=> monthSelect.appendChild(new Option(n, i)));
      monthSelect.value = currentMonthIndex;
      on(monthSelect, "change", () => {
        currentMonthIndex = +monthSelect.value;
        renderForCurrentMonth();
      });
    }

    if (yearSelect) {
      for (let y = currentYear - 3; y <= currentYear + 3; y++) {
        yearSelect.appendChild(new Option(y, y));
      }
      yearSelect.value = currentYear;
      on(yearSelect, "change", () => {
        currentYear = +yearSelect.value;
        renderForCurrentMonth();
      });
    }

    on(prevBtn, "click", () => {
      currentDay = currentDay <= 1 ? 7 : currentDay - 1;
      if (dayBtn) dayBtn.textContent = `Day ${currentDay}`;
      renderForCurrentMonth();
    });

    on(nextBtn, "click", () => {
      currentDay = currentDay >= 7 ? 1 : currentDay + 1;
      if (dayBtn) dayBtn.textContent = `Day ${currentDay}`;
      renderForCurrentMonth();
    });
  })();

  /* ---------- Hard Reset (global wipe) ---------- */
  on(hardResetBtn, "click", () => {
    if (!confirm(
      "This will reset EVERYTHING:\n\n" +
      "• All days' expenses and category totals\n" +
      "• All favourites\n" +
      "• Allowance, score, and streak\n\n" +
      "Are you sure?"
    )) {
      return;
    }

    // Reset settings (allowance +score +streak)
    settings = {
      allowance: 0,
      score: 0,
      streak: 0,
      lastActiveDay: null,
      allowanceMode: "weekly"
    };
    saveSettings();

    // Clear all day/month state
    monthlyState = {};
    saveState();

    // Clear all favourites
    favourites = {};
    saveFavourites();

    // Reset day back to 1
    currentDay = 1;
    if (dayBtn) dayBtn.textContent = `Day ${currentDay}`;

    // Re-render UI
    renderForCurrentMonth();
  });

  // Remove stray "Actions" thead if present
  (function stripActionsHeaderIfPresent() {
    const tr = submittedTable.querySelector("thead tr");
    if (!tr) return;
    [...tr.children].forEach(th => {
      if (th.textContent.trim().toLowerCase() === "actions") th.remove();
    });
  })();

  /* ---------- Allowance helpers ---------- */

  // Sum ALL spending across ALL days
  function getGlobalSpent() {
    let total = 0;
    for (const key of Object.keys(monthlyState)) {
      const d = ensureMonth(key);
      const ct = d.categoryTotals || {};
      total += (ct.Groceries || 0) +
               (ct.Social || 0) +
               (ct.Treat || 0) +
               (ct.Unexpected || 0);
    }
    return total;
  }

  // Update "Allowance Remaining" based on mode
  function updateAllowanceRemaining() {
    const mode = settings.allowanceMode || "weekly";
    const weeklyAllowance = Number(settings.allowance || 0);
    const dailyAllowance = weeklyAllowance / 7;

    if (mode === "weekly") {
      // Weekly view: total allowance minus ALL expenses across all days
      const spentAll = getGlobalSpent();
      allowanceRemainingDiv.textContent =
        `Remaining: ${(weeklyAllowance - spentAll).toFixed(2)}`;
    } else {
      // Daily view: (weekly allowance / 7) minus current-day expenses only
      const data = getMonthData();
      const spentToday = Object
        .values(data.categoryTotals)
        .reduce((a, b) => a + b, 0);

      allowanceRemainingDiv.textContent =
        `Remaining: ${(dailyAllowance - spentToday).toFixed(2)}`;
    }
  }

  function updatePieChart() {
    if (!categoryChart) return;

    const d = getMonthData().categoryTotals;
    categoryChart.data.datasets[0].data = [
      d.Groceries, d.Social, d.Treat, d.Unexpected
    ];
    categoryChart.update();
  }

  function updateStatsUI() {
    const data = getMonthData(); // reserved for future use

    if (scoreTotalEl) {
      const xp = Number(settings.score || 0);
      scoreTotalEl.textContent = `📈 XP: ${xp}`;
    }

    if (streakEl) {
      const st = Number(settings.streak || 0);
      streakEl.textContent =
        st > 0
          ? `🔥 Streak: ${st} day${st === 1 ? "" : "s"}`
          : `🔥 Streak: 0 days`;
    }

    if (levelEl) {
      const xp = Number(settings.score || 0);
      let level = "Bronze";
      let emoji = "🥉";

      if (xp >= 251) {
        level = "Platinum";
        emoji = "💠";
      } else if (xp >= 181) {
        level = "Diamond";
        emoji = "💎";
      } else if (xp >= 91) {
        level = "Gold";
        emoji = "🥇";
      } else if (xp >= 31) {
        level = "Silver";
        emoji = "🥈";
      } else {
        level = "Bronze";
        emoji = "🥉";
      }

      levelEl.textContent = `${emoji} Level: ${level}`;
    }
  }

  /* ---------- Analytics modal helpers ---------- */
  let analyticsChart = null;

  function renderAnalyticsChart() {
    const canvas = analyticsChartEl();
    if (!canvas) return;

    const ctxA = canvas.getContext("2d");
    const d = getMonthData().categoryTotals;
    const dataArr = [
      d.Groceries || 0,
      d.Social || 0,
      d.Treat || 0,
      d.Unexpected || 0
    ];

    if (!analyticsChart) {
      analyticsChart = new Chart(ctxA, {
        type: "pie",
        data: {
          labels: ["Groceries", "Social", "Treat", "Unexpected"],
          datasets: [{
            label: "Category Breakdown",
            data: dataArr.slice(),
            backgroundColor: ["#11cdef","#0b2a4a","#0f766e","#ffb000"]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                boxWidth: 18,
                padding: 15,
                font: {
                  size: 14
                }
              }
            }
          }
        }
      });
    } else {
      analyticsChart.data.datasets[0].data = dataArr;
      analyticsChart.update();
    }
  }

  function openAnalyticsModal() {
    const d = getMonthData().categoryTotals;
    const totalsHtml = `
      Groceries: ${(d.Groceries || 0).toFixed(2)}<br>
      Social: ${(d.Social || 0).toFixed(2)}<br>
      Treat: ${(d.Treat || 0).toFixed(2)}<br>
      Unexpected: ${(d.Unexpected || 0).toFixed(2)}
    `;

    const totalsEl = analyticsTotalsEl();
    if (totalsEl) totalsEl.innerHTML = totalsHtml;

    setDisplay(analyticsOverlay, true);
    setTimeout(renderAnalyticsChart, 0);
  }

  function closeAnalyticsModal() {
    setDisplay(analyticsOverlay, false);
  }

  function openComingSoonModal(featureName) {
    const title = comingSoonTitleEl();
    const body = comingSoonBodyEl();
    if (title) title.textContent = `${featureName} – coming soon`;
    setDisplay(comingSoonOverlay, true);
  }

  function closeComingSoonModal() {
    setDisplay(comingSoonOverlay, false);
  }

  function renderForCurrentMonth() {
    const data = getMonthData();
    const mode = settings.allowanceMode || "weekly";
    const weeklyAllowance = Number(settings.allowance || 0);
    const dailyAllowance = weeklyAllowance / 7;

    if (mode === "weekly") {
      allowanceDisplay.textContent =
        `Total: ${weeklyAllowance.toFixed(2)}`;
    } else {
      allowanceDisplay.textContent =
        `Total: ${dailyAllowance.toFixed(2)}`;
    }

    if (data.noSpending) {
      submittedTableBody.innerHTML =
        `<tr><td colspan="4" class="no-spending-row">No spending</td></tr>`;
    } else {
      submittedTableBody.innerHTML = data.expenses.map((e,idx)=>(
        `<tr data-row-id="${e.id}">
          <td>${idx+1}</td>
          <td>${e.amount.toFixed(2)}</td>
          <td>${e.category}</td>
          <td>${e.card || "-"}</td>
        </tr>`
      )).join("");
    }

    updateAllowanceRemaining();
    updatePieChart();
    updateStatsUI();
    queueMicrotask(updateRails);
  }

  const updateRails = () => {
    positionEditDeleteDots();
    positionFavStars();
  };

  function eachRow(cb) {
    const containerRect = tableWrap.getBoundingClientRect();
    [...submittedTableBody.querySelectorAll("tr")].forEach(tr => {
      const id = +(tr.getAttribute("data-row-id") || NaN);
      if (!Number.isFinite(id)) return; // skip "No spending" row
      const r = tr.getBoundingClientRect();
      const top = r.top - containerRect.top + (r.height/2) - 8;
      cb({ id, top });
    });
  }

  function positionEditDeleteDots() {
    if (!deleteRail) return;
    deleteRail.innerHTML = "";
    eachRow(({id, top}) => {
      const edit = document.createElement("span");
      edit.className = "edit-mini";
      edit.textContent = "e";
      edit.dataset.id = String(id);
      edit.style.top = `${top}px`;

      const del = document.createElement("span");
      del.className = "delete-mini";
      del.textContent = "d";
      del.dataset.id = String(id);
      del.style.top = `${top}px`;

      deleteRail.appendChild(edit);
      deleteRail.appendChild(del);
    });
  }

  function positionFavStars() {
    if (!leftRail) return;
    leftRail.innerHTML = "";
    eachRow(({id, top}) => {
      const star = document.createElement("span");
      star.className = "fav-mini";
      star.dataset.id = String(id);
      star.style.top = `${top}px`;
      const fav = isFavourited(id);
      star.textContent = fav ? "★" : "☆";
      if (fav) star.classList.add("filled");
      leftRail.appendChild(star);
    });
  }

  on(window, "resize", updateRails);

  /* ---------- SCORE helpers ---------- */
  function addScore(n = 1) {
    settings.score = Math.max(0, (settings.score || 0) + 10 * n);
    saveSettings();
    updateStatsUI();
  }
  function subtractScore(n = 1) {
    settings.score = Math.max(0, (settings.score || 0) - 10 * n);
    saveSettings();
    updateStatsUI();
  }

  /**
   * Apply scoring and streak bonus for “good” activity on the current day.
   */
  function applyStreakScore(baseUnits, baseMessage) {
    const prevDay = (typeof settings.lastActiveDay === "number")
      ? settings.lastActiveDay
      : null;
    let streak = typeof settings.streak === "number" ? settings.streak : 0;
    const today = currentDay;

    if (prevDay === null) {
      streak = 1;
    } else if (today === prevDay) {
      // same day → streak unchanged
    } else if (today === prevDay + 1) {
      streak = streak + 1;
    } else {
      streak = 1;
    }

    settings.lastActiveDay = today;
    settings.streak = streak;
    saveSettings();

    const baseXP = baseUnits * 10;
    addScore(baseUnits);

    showGoldPopup("Great addition!", baseXP);

    let bonusUnits = 0;
    if (prevDay !== null && today !== prevDay && streak > 1) {
      bonusUnits = streak; // e.g. 2 => +20XP, 3 => +30XP
      addScore(bonusUnits);
    }

    const bonusXP = bonusUnits * 10;
    if (bonusXP > 0) {
      setTimeout(() => {
        showStreakPopup(streak, bonusXP);
      }, 4200);
    }
  }

  /* ---------- Gold XP popup (XP only) ---------- */
  let goldPopupTimer = null;
  function showGoldPopup(
    message = "XP increased!",
    earnedXP = 0
  ) {
    let popup = document.querySelector(".gold-popup-toast");

    if (!popup) {
      popup = document.createElement("div");
      popup.className = "gold-popup-toast";
      popup.setAttribute("role", "alert");
      popup.setAttribute("aria-live", "polite");

      Object.assign(popup.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: "10000",
        background: "linear-gradient(180deg, #ffd866, #ffb000)",
        color: "#1a1a1a",
        border: "2px solid #d39b00",
        borderRadius: "12px",
        padding: "18px 22px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        fontFamily: "inherit",
        textAlign: "center",
        maxWidth: "90vw",
        minWidth: "260px"
      });

      const titleEl = document.createElement("div");
      titleEl.className = "gold-popup-title";
      Object.assign(titleEl.style, {
        fontSize: "26px",
        fontWeight: "800",
        letterSpacing: "0.5px",
        marginBottom: "6px"
      });

      const imgEl = document.createElement("img");
      imgEl.className = "gold-popup-image";
      Object.assign(imgEl.style, {
        width: "90px",
        height: "90px",
        margin: "10px auto 12px",
        display: "block",
        objectFit: "contain",
        backgroundColor: "transparent"
      });

      imgEl.src = "images/penny.jpg";
      imgEl.alt = "XP celebration";
      imgEl.style.borderRadius = "50%";

      const bodyEl = document.createElement("div");
      bodyEl.className = "gold-popup-body";
      Object.assign(bodyEl.style, {
        fontSize: "16px",
        fontWeight: "600",
        letterSpacing: "0.2px"
      });

      popup.appendChild(titleEl);
      popup.appendChild(imgEl);
      popup.appendChild(bodyEl);
      document.body.appendChild(popup);
    }

    const titleEl = popup.querySelector(".gold-popup-title");
    const bodyEl = popup.querySelector(".gold-popup-body");

    if (titleEl) {
      titleEl.textContent =
        earnedXP > 0 ? `Nice! +${earnedXP}XP` : "Nice!";
    }
    if (bodyEl) {
      bodyEl.textContent = message || "Great addition!";
    }

    popup.style.display = "block";

    if (goldPopupTimer) clearTimeout(goldPopupTimer);
    goldPopupTimer = setTimeout(() => {
      if (popup) popup.style.display = "none";
    }, 4000);
  }

  /* ---------- Red streak popup (streak extension) ---------- */
  let streakPopupTimer = null;
  function showStreakPopup(streak, bonusXP) {
    let popup = document.querySelector(".streak-popup-toast");

    if (!popup) {
      popup = document.createElement("div");
      popup.className = "streak-popup-toast";
      popup.setAttribute("role", "alert");
      popup.setAttribute("aria-live", "polite");

      const css = getComputedStyle(document.documentElement);
      const red = css.getPropertyValue("--red").trim() || "#ff3b30";

      Object.assign(popup.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: "10001",
        background: red,
        color: "#fff",
        border: "2px solid #b30000",
        borderRadius: "12px",
        padding: "18px 22px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        fontFamily: "inherit",
        textAlign: "center",
        maxWidth: "90vw",
        minWidth: "260px"
      });

      const titleEl = document.createElement("div");
      titleEl.className = "streak-popup-title";
      Object.assign(titleEl.style, {
        fontSize: "24px",
        fontWeight: "800",
        letterSpacing: "0.5px",
        marginBottom: "6px"
      });

      const imgEl = document.createElement("img");
      imgEl.className = "streak-popup-image";
      Object.assign(imgEl.style, {
        width: "90px",
        height: "90px",
        margin: "10px auto 12px",
        display: "block",
        objectFit: "contain",
        backgroundColor: "transparent"
      });

      imgEl.src = "images/fire.jpg";
      imgEl.alt = "Streak celebration";
      imgEl.style.borderRadius = "50%";

      const bodyEl = document.createElement("div");
      bodyEl.className = "streak-popup-body";
      Object.assign(bodyEl.style, {
        fontSize: "16px",
        fontWeight: "600",
        letterSpacing: "0.2px"
      });

      popup.appendChild(titleEl);
      popup.appendChild(imgEl);
      popup.appendChild(bodyEl);
      document.body.appendChild(popup);
    }

    const titleEl = popup.querySelector(".streak-popup-title");
    const bodyEl = popup.querySelector(".streak-popup-body");

    if (titleEl) {
      titleEl.textContent =
        bonusXP > 0 ? `Streak extended! +${bonusXP}XP` : "Streak extended!";
    }
    if (bodyEl) {
      bodyEl.textContent = "You're on fire!";
    }

    popup.style.display = "block";

    if (streakPopupTimer) clearTimeout(streakPopupTimer);
    streakPopupTimer = setTimeout(() => {
      if (popup) popup.style.display = "none";
    }, 4000);
  }

  /* ---------- Allowance mode toggle wiring ---------- */
  function refreshAllowanceToggleButtons() {
    if (!weeklyBtn || !dailyBtn) return;
    const mode = settings.allowanceMode || "weekly";
    weeklyBtn.classList.toggle("active", mode === "weekly");
    dailyBtn.classList.toggle("active", mode === "daily");
  }

  function setAllowanceMode(mode) {
    settings.allowanceMode = mode === "daily" ? "daily" : "weekly";
    saveSettings();
    refreshAllowanceToggleButtons();
    renderForCurrentMonth();
  }

  on(weeklyBtn, "click", () => setAllowanceMode("weekly"));
  on(dailyBtn, "click", () => setAllowanceMode("daily"));

  refreshAllowanceToggleButtons();

  /* ---------- "No spending today" button ---------- */
  on(noSpendBtn, "click", () => {
    const data = getMonthData();
    if (data.noSpending) {
      alert("Already marked as 'No spending' for this day.");
      return;
    }
    const n = data.expenses.length;
    if (n > 0) {
      data.expenses = [];
      data.categoryTotals = {
        Groceries: 0, Social: 0, Treat: 0, Unexpected: 0
      };
      data.purchaseCount = 0;
    }
    data.noSpending = true;

    saveState();
    renderForCurrentMonth();

    applyStreakScore(5, "Congratulations, you're on the right track! +50XP");
  });

  /* ---------- Rail actions ---------- */
  on(deleteRail, "click", (evt) => {
    const editEl = evt.target.closest(".edit-mini");
    const delEl  = evt.target.closest(".delete-mini");

    if (editEl) {
      const id = +editEl.dataset.id;
      const exp = findExpenseById(id);
      if (exp) openExpenseModal(exp);
      return;
    }
    if (delEl) {
      const id = +delEl.dataset.id;
      const data = getMonthData();
      const i = data.expenses.findIndex(x => x.id === id);
      if (i === -1) return;
      const exp = data.expenses[i];
      data.categoryTotals[exp.category] =
        Math.max(0, (data.categoryTotals[exp.category] || 0) - (exp.amount || 0));
      data.expenses.splice(i,1);
      subtractScore(1);
      saveState();
      renderForCurrentMonth();
      if (favesOverlay.style.display === "flex") renderFavesModal();
    }
  });

  on(leftRail, "click", (evt) => {
    const star = evt.target.closest(".fav-mini");
    if (!star) return;
    const id = +star.dataset.id;
    const data = getMonthData();
    const exp = data.expenses.find(e => e.id === id);
    if (!exp) return;

    const key = compositeId(id);
    if (favourites[key]) {
      delete favourites[key];
      saveFavourites();
      renderForCurrentMonth();
      if (favesOverlay.style.display === "flex") renderFavesModal();
      return;
    }
    openFavNameModal({
      key,
      year: currentYear,
      monthIndex: currentMonthIndex,
      id,
      amount: exp.amount,
      category: exp.category,
      card: exp.card || ""
    }, "");
  });

  /* ---------- Clear All (current day) ---------- */
  on(clearAllBtn, "click", () => {
    const data = getMonthData();
    const n = data.expenses.length;
    if (!n && !data.noSpending) return;
    if (!confirm("Are you sure you want to delete all expenses for this day?")) return;

    if (n > 0) subtractScore(n);
    data.expenses = [];
    data.categoryTotals = {
      Groceries: 0, Social: 0, Treat: 0, Unexpected: 0
    };
    data.purchaseCount = 0;
    data.noSpending = false;

    saveState();
    renderForCurrentMonth();
    if (favesOverlay.style.display === "flex") renderFavesModal();
  });

  /* ---------- Add/Edit Expense Modal ---------- */
  const expenseOverlay = $("expenseModalOverlay");
  const modalAmount = () => $("modalExpenseAmount");
  const modalCat = () => $("modalExpenseCategory");
  const modalCard = () => $("modalExpenseCard");
  const modalSubmit = () => $("modalSubmitBtn");
  const modalCancel = () => $("modalCancelBtn");
  const modalTitle = () => expenseOverlay.querySelector(".expense-modal h3");
  const modalCategoryWrapper = () => $("modalCategoryWrapper");

  const quickStage = $("drinkQuickStage");
  const btnGuinness = $("drinkGuinnessBtn");
  const btnCoffee = $("drinkCoffeeBtn");
  const btnOther = $("drinkOtherBtn");

  const amountLabel = document.querySelector('label[for="modalExpenseAmount"]');
  const cardLabel = document.querySelector('label[for="modalExpenseCard"]');

  function toggleFormFields(show) {
    const disp = show ? "block" : "none";
    if (amountLabel) amountLabel.style.display = disp;
    if (modalAmount()) modalAmount().style.display = disp;
    if (modalCategoryWrapper()) modalCategoryWrapper().style.display = disp;
    if (cardLabel) cardLabel.style.display = disp;
    if (modalCard()) modalCard().style.display = disp;
    if (modalSubmit()) modalSubmit().style.display = show ? "inline-block" : "none";
  }

  let editingId = null;

  function openExpenseModal(
    expense = null,
    { hideCategory=false, quickDrinkOnly=false } = {}
  ) {
    const isEdit = expense && typeof expense.id === "number";

    if (!isEdit && quickStage) {
      quickStage.style.display = quickDrinkOnly ? "block" : "none";
      toggleFormFields(!quickDrinkOnly);
    } else if (quickStage) {
      quickStage.style.display = "none";
      toggleFormFields(true);
    }

    if (modalCategoryWrapper() && !quickDrinkOnly) {
      modalCategoryWrapper().style.display = (isEdit || !hideCategory) ? "block" : "none";
    }

    if (isEdit) {
      editingId = expense.id;
      modalTitle().textContent = "Edit Expense";
      modalAmount().value = expense.amount;
      modalCat().value = expense.category;
      modalCard().value = expense.card || "Credit";
    } else {
      editingId = null;
      modalTitle().textContent = quickDrinkOnly ? "Add Drink" : "Add Expense";
      modalAmount().value = (expense && "amount" in expense) ? expense.amount : "";
      modalCat().value = expense?.category || "Groceries";
      modalCard().value = expense?.card || "Credit";
    }

    setDisplay(expenseOverlay, true);
    if (!quickDrinkOnly) setTimeout(() => modalAmount()?.focus(), 0);
  }

  function closeExpenseModal() {
    setDisplay(expenseOverlay, false);
    if (quickStage) quickStage.style.display = "none";
    toggleFormFields(true);
    if (modalCategoryWrapper()) modalCategoryWrapper().style.display = "block";
    editingId = null;
  }

  on(expenseOverlay, "click", (e)=>{
    if (e.target === expenseOverlay) closeExpenseModal();
  });
  on(document, "keydown", (e)=>{
    if (expenseOverlay.style.display === "flex" && e.key === "Escape") {
      closeExpenseModal();
    }
  });
  on(modalCancel(), "click", closeExpenseModal);

  on(modalSubmit(), "click", () => {
    try {
      const amount = parseFloat(modalAmount().value);
      const category = modalCat().value;
      const card = (modalCard() ? modalCard().value : "").trim();

      if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount.");
        modalAmount().focus();
        return;
      }
      if (!CATEGORIES.has(category)) {
        alert("Please select a valid category.");
        modalCat().focus();
        return;
      }
      if (!CARDS.has(card)) {
        alert("Please choose Credit or Debit.");
        modalCard().focus();
        return;
      }

      const data = getMonthData();

      if (editingId !== null) {
        const idx = data.expenses.findIndex(e => e.id === editingId);
        if (idx !== -1) {
          const old = data.expenses[idx];
          data.categoryTotals[old.category] =
            Math.max(0, (data.categoryTotals[old.category] || 0) - (old.amount || 0));
          data.expenses[idx] = { ...old, amount, category, card };
          data.categoryTotals[category] =
            (data.categoryTotals[category] || 0) + amount;

          const key = compositeId(editingId);
          if (favourites[key]) {
            Object.assign(favourites[key], { amount, category, card });
            saveFavourites();
          }
        }
      } else {
        if (data.noSpending) subtractScore(5);
        data.noSpending = false;

        data.purchaseCount += 1;
        data.expenses.push({ id: data.purchaseCount, amount, category, card });
        data.categoryTotals[category] += amount;

        applyStreakScore(1, "great addition! +10XP");
      }

      saveState();
      renderForCurrentMonth();
      if (favesOverlay.style.display === "flex") renderFavesModal();
      closeExpenseModal();
    } catch (err) {
      console.error("Submit failed:", err);
      alert("Something went wrong adding/updating the expense. Check the console for details.");
    }
  });

  /* ---------- Add Type Modal (Drink / Groceries / Big Night / Other) ---------- */
  const addTypeOverlay = $("addTypeModalOverlay");
  const addTypeDrinkBtn = () => $("addTypeDrinkBtn");
  const addTypeGroceriesBtn = () => $("addTypeGroceriesBtn");
  const addTypeBigNightBtn = () => $("addTypeBigNightBtn");
  const addTypeOtherBtn = () => $("addTypeOtherBtn");

  function openAddTypeModal() {
    setDisplay(addTypeOverlay, true);
  }

  function closeAddTypeModal() {
    setDisplay(addTypeOverlay, false);
  }

  on(addTypeOverlay, "click", (e) => {
    if (e.target === addTypeOverlay) closeAddTypeModal();
  });

  on(document, "keydown", (e) => {
    if (addTypeOverlay && addTypeOverlay.style.display === "flex" && e.key === "Escape") {
      closeAddTypeModal();
    }
  });

  // Map the four choices to the existing behaviours
  on(addTypeDrinkBtn(), "click", () => {
    closeAddTypeModal();
    // previously Add Drink button
    openExpenseModal(
      { category: "Social", card: "Credit", amount: "" },
      { hideCategory: true, quickDrinkOnly: true }
    );
  });

  on(addTypeGroceriesBtn(), "click", () => {
    closeAddTypeModal();
    // previously Add Groceries button
    openExpenseModal(
      { category: "Groceries", card: "Credit", amount: "" },
      { hideCategory: true, quickDrinkOnly: false }
    );
  });

  on(addTypeBigNightBtn(), "click", () => {
    closeAddTypeModal();
    // previously Big Night Out button
    openExpenseModal(
      { category: "Social", card: "Credit", amount: "" },
      { hideCategory: true, quickDrinkOnly: false }
    );
  });

  on(addTypeOtherBtn(), "click", () => {
    closeAddTypeModal();
    // previously generic Add Expense button
    openExpenseModal(
      { category: "Groceries", card: "Credit", amount: "" },
      { hideCategory: false, quickDrinkOnly: false }
    );
  });

  /* ---------- Quick pick ---------- */
  const quickAdd = (amt) => {
    const data = getMonthData();

    if (data.noSpending) subtractScore(5);
    data.noSpending = false;

    data.purchaseCount += 1;
    data.expenses.push({
      id: data.purchaseCount,
      amount: amt,
      category: "Social",
      card: "Credit"
    });
    data.categoryTotals.Social += amt;

    applyStreakScore(1, "great addition! +10XP");

    saveState();
    renderForCurrentMonth();
    closeExpenseModal();
  };
  on(btnGuinness, "click", () => quickAdd(6.00));
  on(btnCoffee, "click", () => quickAdd(3.50));
  on(btnOther, "click", () => {
    if (quickStage) quickStage.style.display = "none";
    toggleFormFields(true);
    if (modalCategoryWrapper()) modalCategoryWrapper().style.display = "none";
    modalTitle().textContent = "Add Expense";
    modalCat().value = "Social";
    modalAmount().value = "";
    setTimeout(()=> modalAmount()?.focus(), 0);
  });

  /* ---------- Details Modal ---------- */
  const detailsOverlay = $("detailsModalOverlay");
  const detailsBody = () => $("detailsModalBody");
  const detailsClose = () => $("detailsModalCloseBtn");

  function openDetailsModal(text) {
    (detailsBody()).textContent = text || "No details.";
    setDisplay(detailsOverlay, true);
  }
  function closeDetailsModal() {
    setDisplay(detailsOverlay, false);
  }
  on(detailsOverlay, "click", (e)=>{
    if (e.target === detailsOverlay) closeDetailsModal();
  });
  on(document, "keydown", (e)=>{
    if (detailsOverlay.style.display === "flex" && e.key === "Escape") {
      closeDetailsModal();
    }
  });
  on(detailsClose(), "click", closeDetailsModal);

  /* ---------- Analytics & Coming Soon Modals ---------- */
  const analyticsOverlay = $("analyticsModalOverlay");
  const analyticsTotalsEl = () => $("analyticsTotals");
  const analyticsChartEl = () => $("analyticsChart");
  const analyticsCloseBtn = () => $("analyticsCloseBtn");

  const comingSoonOverlay = $("comingSoonOverlay");
  const comingSoonTitleEl = () => $("comingSoonTitle");
  const comingSoonBodyEl = () => $("comingSoonBody");
  const comingSoonCloseBtn = () => $("comingSoonCloseBtn");

  on(analyticsBtn, "click", openAnalyticsModal);
  on(leaderboardBtn, "click", () => openComingSoonModal("Leaderboard"));
  on(rewardsBtn, "click", () => openComingSoonModal("Rewards"));

  on(analyticsOverlay, "click", (e) => {
    if (e.target === analyticsOverlay) closeAnalyticsModal();
  });
  on(analyticsCloseBtn(), "click", closeAnalyticsModal);

  on(comingSoonOverlay, "click", (e) => {
    if (e.target === comingSoonOverlay) closeComingSoonModal();
  });
  on(comingSoonCloseBtn(), "click", closeComingSoonModal);

  on(document, "keydown", (e) => {
    if (e.key === "Escape") {
      if (analyticsOverlay && analyticsOverlay.style.display === "flex") {
        closeAnalyticsModal();
      }
      if (comingSoonOverlay && comingSoonOverlay.style.display === "flex") {
        closeComingSoonModal();
      }
    }
  });

  /* ---------- Allowance Modal ---------- */
  const allowanceOverlay = $("allowanceModalOverlay");
  const allowanceStage = () => $("allowanceModalStage");
  const allowanceCancel = () => $("allowanceModalCancelBtn");
  const allowanceBack = () => $("allowanceModalBackBtn");
  const allowanceSubmit = () => $("allowanceModalSubmitBtn");

  let allowanceFlow = { mode: null };

  const openAllowanceModal = () => {
    showAllowanceChoice();
    setDisplay(allowanceOverlay, true);
  };
  const closeAllowanceModal = () => {
    setDisplay(allowanceOverlay, false);
    allowanceFlow = { mode: null };
  };

  function showAllowanceChoice() {
    allowanceFlow.mode = null;
    allowanceBack().style.display = "none";
    allowanceSubmit().style.display = "none";
    allowanceStage().innerHTML = `
      <p>How would you like to set your global allowance?</p>
      <div style="display:flex; gap:10px;">
        <button id="allowanceManualBtn" type="button">Manual</button>
        <button id="allowanceCalcBtn" type="button">Calculate</button>
      </div>
    `;
    on($("allowanceManualBtn"), "click", showAllowanceManual);
    on($("allowanceCalcBtn"), "click", showAllowanceCalc);
  }

  function showAllowanceManual() {
    allowanceFlow.mode = "manual";
    allowanceBack().style.display = "inline-block";
    allowanceSubmit().style.display = "inline-block";
    allowanceSubmit().textContent = "Set Global Allowance";
    allowanceStage().innerHTML = `
      <label for="allowanceManualInput" style="font-size:14px; color:#333;">
        Allowance Amount
      </label>
      <input id="allowanceManualInput" type="number" step="0.01" min="0"
             placeholder="Enter amount"
             style="padding:8px; font-size:16px; width:100%; box-sizing:border-box;" />
    `;
    const inp = $("allowanceManualInput");
    inp.value = Number(settings.allowance || 0);
    inp.focus({ preventScroll:true });
    allowanceBack().onclick = showAllowanceChoice;
    allowanceSubmit().onclick = () => {
      const val = parseFloat(inp.value);
      if (isNaN(val) || val < 0) {
        alert("Please enter a valid allowance (0 or more).");
        inp.focus();
        return;
      }
      settings.allowance = val;
      saveSettings();
      renderForCurrentMonth();
      closeAllowanceModal();
    };
  }

  function showAllowanceCalc() {
    allowanceFlow.mode = "calc";
    allowanceBack().style.display = "inline-block";
    allowanceSubmit().style.display = "inline-block";
    allowanceSubmit().textContent = "Set Global Allowance";
    allowanceStage().innerHTML = `
      <p>Allowance = Income −(Rent +Car +Bills +Savings +Other)</p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        ${["Income","Rent","Car Payments","Bills","Ideal Savings","Other"].map(label => `
          <label style="display:flex; flex-direction:column; gap:6px;">
            <span style="font-size:14px; color:#333;">${label}</span>
            <input type="number" step="0.01" min="0" placeholder="${label}"
                   data-allowance="${label}"
                   style="padding:8px; font-size:16px; width:100%; box-sizing:border-box;"
                   value="0" />
          </label>
        `).join("")}
      </div>
    `;
    allowanceBack().onclick = showAllowanceChoice;
    allowanceSubmit().onclick = () => {
      const vals = {};
      document
        .querySelectorAll('[data-allowance]')
        .forEach(el => {
          vals[el.dataset.allowance] = parseFloat(el.value) || 0;
        });
      const income = vals["Income"];
      const costs = vals["Rent"] + vals["Car Payments"] +
                    vals["Bills"] + vals["Ideal Savings"] + vals["Other"];
      settings.allowance = income - costs;
      saveSettings();
      renderForCurrentMonth();
      closeAllowanceModal();
    };
  }

  on(allowanceOverlay, "click", (e)=>{
    if (e.target === allowanceOverlay) closeAllowanceModal();
  });
  on(document, "keydown", (e)=>{
    if (allowanceOverlay.style.display === "flex" && e.key === "Escape") {
      closeAllowanceModal();
    }
  });
  on(allowanceCancel(), "click", closeAllowanceModal);
  on(setAllowanceBtn, "click", openAllowanceModal);

  /* ---------- Favourites Modal ---------- */
  const openFavesModal = () => {
    renderFavesModal();
    setDisplay(favesOverlay, true);
  };
  const closeFavesModal = () => setDisplay(favesOverlay, false);

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  function renderFavesModal() {
    const entries = Object.entries(favourites);
    if (!entries.length) {
      favesList.innerHTML = `<p>No favourites yet.</p>`;
      return;
    }

    entries.sort((a,b) => {
      const fa = a[1], fb = b[1];
      return (
        ((fb.year|0) - (fa.year|0)) ||
        ((fb.monthIndex|0) - (fa.monthIndex|0)) ||
        ((fb.id|0) - (fa.id|0))
      );
    });

    const rows = entries.map(([key, f]) => `
      <tr data-key="${key}">
        <td class="fav-name">${escapeHtml(f.name || "Favourite")}</td>
        <td>${(f.amount || 0).toFixed(2)}</td>
        <td>${f.category}</td>
        <td>${f.card || "-"}</td>
        <td class="fav-actions">
          <button class="fave-add" type="button" data-key="${key}">Add</button>
          <span class="mini-inline delete-mini fav-delete"
                title="Delete" data-key="${key}">d</span>
        </td>
      </tr>`
    ).join("");

    favesList.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Amount</th><th>Category</th><th>Card</th><th>Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  on(favesOverlay, "click", (e)=>{
    if (e.target === favesOverlay) closeFavesModal();
  });
  on(document, "keydown", (e)=>{
    if (favesOverlay.style.display === "flex" && e.key === "Escape") {
      closeFavesModal();
    }
  });
  on(favesCloseBtn, "click", closeFavesModal);
  on(showFavouritesBtn, "click", openFavesModal);

  on(favesList, "click", (e) => {
    const add = e.target.closest(".fave-add");
    if (add) {
      const oldKey = add.dataset.key;
      const fav = favourites[oldKey];
      if (!fav) return;

      const data = getMonthData();

      if (data.noSpending) subtractScore(5);
      data.noSpending = false;

      data.purchaseCount += 1;
      const newId = data.purchaseCount;

      // Add a new expense row based on the favourite
      data.expenses.push({
        id: newId,
        amount: fav.amount,
        category: fav.category,
        card: fav.card || "Credit"
      });
      data.categoryTotals[fav.category] =
        (data.categoryTotals[fav.category] || 0) + (fav.amount || 0);

      // Move the favourite to point at the new row (no duplication)
      const newKey = compositeId(newId);
      if (newKey !== oldKey) {
        delete favourites[oldKey];
      }
      favourites[newKey] = {
        id: newId,
        year: currentYear,
        monthIndex: currentMonthIndex,
        amount: fav.amount,
        category: fav.category,
        card: fav.card || "Credit",
        name: fav.name || "Favourite"
      };
      saveFavourites();

      applyStreakScore(1, "great addition! +10XP");

      saveState();
      renderForCurrentMonth();
      closeFavesModal();
      return;
    }
  });

  /* ---------- Favourite Name Modal ---------- */
  let pendingFav = null;
  function openFavNameModal(snapshot, defaultName = "") {
    pendingFav = { ...snapshot, name: defaultName || "" };
    favNameInput.value = pendingFav.name;
    setDisplay(favNameOverlay, true);
    setTimeout(()=> favNameInput.focus(), 0);
  }
  function closeFavNameModal() {
    setDisplay(favNameOverlay, false);
    pendingFav = null;
  }

  on(favNameOverlay, "click", (e)=>{
    if (e.target === favNameOverlay) closeFavNameModal();
  });
  on(document, "keydown", (e)=>{
    if (favNameOverlay.style.display === "flex" && e.key === "Escape") {
      closeFavNameModal();
    }
  });
  on(favNameCancel, "click", closeFavNameModal);
  on(favNameSave, "click", () => {
    if (!pendingFav) return;
    const name = favNameInput.value.trim() || "Favourite";
    const { key, year, monthIndex, id, amount, category, card } = pendingFav;
    favourites[key] = { id, year, monthIndex, amount, category, card, name };
    saveFavourites();
    closeFavNameModal();
    renderForCurrentMonth();
    if (favesOverlay.style.display === "flex") renderFavesModal();
  });

  /* ---------- Openers ---------- */
  on(addBtn, "click", openAddTypeModal);

  /* ---------- Initial render ---------- */
  renderForCurrentMonth();
});
