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
    if (modalOverlay) modalOverlay.style.display = "none";
  });

  /* ---------- Categories (no card concept) ---------- */
  const CATEGORIES = new Set([
    "Essential Living",
    "Social & Leisure",
    "Personal Treats",
    "Unexpected"
  ]);

    /* ---------- Goal preset descriptions (no XP text) ---------- */
  const GOAL_PRESETS = {
    example1: "Complete 3 No Spending Days in a 7 day period.",
    example2: "Achieve diamond level.",
    example3: "Spend an average of less than $20/day this week."
  };

  // XP rewards for each goal (in raw XP, not "units")
  const GOAL_XP_REWARDS = {
    example1: 20,  // 3 no-spend days
    example2: 40,  // reach Diamond
    example3: 60   // <$20/day average
  };


  /* ---------- Grabs ---------- */
  const addBtn = $("addExpenseBtn");
  const showFavouritesBtn = $("showFavouritesBtn");
  const noSpendBtn = $("noSpendBtn");
  const setGoalBtn = $("setGoalBtn");

  const submittedTable = $("submittedExpenses");
  let submittedTableBody =
    submittedTable.querySelector("tbody") ||
    submittedTable.appendChild(document.createElement("tbody"));

  const clearAllBtn = $("clearAllBtn");

  const setAllowanceBtn = $("setAllowanceBtn");
  const allowanceDisplay = $("allowanceDisplay");
  const allowanceRemainingDiv = $("allowanceRemaining");
  const savingsInfoDiv = $("savingsInfo");

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

  // Leaderboard modal elements
  const leaderboardOverlay = $("leaderboardModalOverlay");
  const leaderboardTableBody = $("leaderboardTableBody");
  const leaderboardToggleXp = $("leaderboardToggleXp");
  const leaderboardToggleStreak = $("leaderboardToggleStreak");


  // Favourites Modal
  const favesOverlay = $("favesModalOverlay");
  const favesList = $("favesList");
  const favesCloseBtn = $("favesCloseBtn");

  // Favourite Name Modal
  const favNameOverlay = $("favNameModalOverlay");
  const favNameInput = $("favNameInput");
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

  // Streak warning modal
  const streakWarnOverlay = $("streakWarningOverlay");
  const streakWarnAddBtn = $("streakWarningAddBtn");
  const streakWarnBackBtn = $("streakWarningBackBtn");
  const streakWarnNoSpendBtn = $("streakWarningNoSpendBtn");
  const streakWarnContinueBtn = $("streakWarningContinueBtn");

  /* ---------- Chart (main sidebar pie - optional) ---------- */
  let categoryChart = null;

  const chartCanvas = $("categoryChart");
  if (chartCanvas) {
    const ctx = chartCanvas.getContext("2d");
    categoryChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: [
          "Essential Living",
          "Social & Leisure",
          "Personal Treats",
          "Unexpected"
        ],
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
    allowanceMode: "weekly",
    allowanceXpAwarded: false,
    goalPreset: null,
    goalTarget: 0,
    goalDescription: "",
    completedGoals: []   // NEW
  };
  let favourites = loadJSON(FAV_KEY) || {}; // { "<period>-id": { id, year, monthIndex, amount, category, name } }

  const saveState = () => saveJSON(STATE_KEY, monthlyState);
  const saveSettings = () => saveJSON(SETTINGS_KEY, settings);
  const saveFavourites = () => saveJSON(FAV_KEY, favourites);

  // Backfill missing fields
  if (typeof settings.allowance !== "number") settings.allowance = Number(settings.allowance) || 0;
  if (typeof settings.score !== "number") settings.score = 0;
  if (typeof settings.streak !== "number") settings.streak = 0;
  if (typeof settings.lastActiveDay !== "number") settings.lastActiveDay = null;
  if (typeof settings.allowanceMode !== "string") settings.allowanceMode = "weekly";
  if (typeof settings.allowanceXpAwarded !== "boolean") settings.allowanceXpAwarded = false;
  if (!("goalPreset" in settings)) settings.goalPreset = null;
  if (typeof settings.goalTarget !== "number") settings.goalTarget = Number(settings.goalTarget) || 0;
  if (!("goalPreset" in settings)) settings.goalPreset = null;
  if (typeof settings.goalTarget !== "number") settings.goalTarget = Number(settings.goalTarget) || 0;
  if (typeof settings.goalDescription !== "string") settings.goalDescription = "";
  if (!Array.isArray(settings.completedGoals)) settings.completedGoals = [];



  // Clean legacy per-month allowance keys
  for (const k of Object.keys(monthlyState)) {
    if (monthlyState[k] && "allowance" in monthlyState[k]) {
      delete monthlyState[k].allowance;
    }
  }

  // --- Migrate old categories & strip card fields (one-time on load) ---
  (function migrateOldData() {
    const MAP = {
      "Groceries": "Essential Living",
      "Social": "Social & Leisure",
      "Treat": "Personal Treats",
      "Unexpected": "Unexpected"
    };

    // Migrate monthlyState: categoryTotals + each expense.category; strip card
    for (const key of Object.keys(monthlyState)) {
      const month = monthlyState[key];
      if (!month) continue;

      const oldTotals = month.categoryTotals || {};
      const newTotals = {
        "Essential Living": 0,
        "Social & Leisure": 0,
        "Personal Treats": 0,
        "Unexpected": 0
      };

      for (const [oldCat, valRaw] of Object.entries(oldTotals)) {
        const val = Number(valRaw) || 0;
        const newCat = MAP[oldCat] || oldCat;
        if (!(newCat in newTotals)) newTotals[newCat] = 0;
        newTotals[newCat] += val;
      }
      month.categoryTotals = newTotals;

      if (Array.isArray(month.expenses)) {
        month.expenses = month.expenses.map(e => {
          if (!e) return e;
          const mappedCat = MAP[e.category] || e.category;
          const { card, ...rest } = e;
          return { ...rest, category: mappedCat };
        });
      }

      // Ensure flags exist
      if (typeof month.purchaseCount !== "number") month.purchaseCount = 0;
      if (typeof month.noSpending !== "boolean") month.noSpending = false;
    }

    // Migrate favourites: update category + remove card
    for (const key of Object.keys(favourites)) {
      const fav = favourites[key];
      if (!fav) continue;
      if (fav.category && MAP[fav.category]) {
        fav.category = MAP[fav.category];
      }
      if ("card" in fav) delete fav.card;
    }

    saveState();
    saveFavourites();
  })();

  const yyyymmKey = (y, m) => `${y}-${String(m + 1).padStart(2,"0")}`;

  // Use day buckets when the Day UI exists (day-1..day-7), otherwise fall back to month key.
  const periodKey = () =>
    (dayBtn ? `day-${currentDay}` : yyyymmKey(currentYear, currentMonthIndex));

  // Favourite keys are tied to the current period (day).
  const compositeId = (id) => `${periodKey()}-${id}`;

  let currentYear, currentMonthIndex;

  function ensureMonth(key) {
    if (!monthlyState[key]) {
      monthlyState[key] = {
        expenses: [],
        categoryTotals: {
          "Essential Living": 0,
          "Social & Leisure": 0,
          "Personal Treats": 0,
          "Unexpected": 0
        },
        purchaseCount: 0,
        noSpending: false
      };
    } else {
      const m = monthlyState[key];
      if (typeof m.purchaseCount !== "number") m.purchaseCount = 0;
      if (!m.categoryTotals) {
        m.categoryTotals = {
          "Essential Living": 0,
          "Social & Leisure": 0,
          "Personal Treats": 0,
          "Unexpected": 0
        };
      } else {
        // backfill missing keys
        for (const cat of CATEGORIES) {
          if (typeof m.categoryTotals[cat] !== "number") {
            m.categoryTotals[cat] = 0;
          }
        }
      }
      if (typeof m.noSpending !== "boolean") m.noSpending = false;
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
  })();

  /* ---------- Streak / day-completion helpers ---------- */

  function currentDayHasActivity() {
    const data = getMonthData();
    const hasExpenses = Array.isArray(data.expenses) && data.expenses.length > 0;
    const hasNoSpendFlag = data.noSpending === true;
    return hasExpenses || hasNoSpendFlag;
  }

  function resetStreakToZero() {
    settings.streak = 0;
    settings.lastActiveDay = null;
    saveSettings();
    updateStatsUI();
  }

  // Will leaving *forward* from this day cause us to lose a non-zero streak?
  function willLoseStreakOnForwardLeave() {
    const streakVal = Number(settings.streak || 0);
    if (streakVal <= 0) return false;

    const last = (typeof settings.lastActiveDay === "number")
      ? settings.lastActiveDay
      : null;
    if (!last) return false;

    // We only care about the immediate day after the last active day,
    // e.g. lastActiveDay=3, currentDay=4 and nothing logged on day 4
    if (currentDay !== last + 1) return false;

    // If the current day already has an expense or "no spending" recorded,
    // leaving won't break the streak.
    if (currentDayHasActivity()) return false;

    return true;
  }

  function goToPrevDay() {
    currentDay = currentDay <= 1 ? 7 : currentDay - 1;
    if (dayBtn) dayBtn.textContent = `Day ${currentDay}`;
    renderForCurrentMonth();
  }

  function goToNextDay() {
    currentDay = currentDay >= 7 ? 1 : currentDay + 1;
    if (dayBtn) dayBtn.textContent = `Day ${currentDay}`;
    renderForCurrentMonth();
  }

  /* ---------- Updated day navigation (prev / next) ---------- */

  let pendingDayNav = null; // { direction: "next" | "prev" } for the warning modal

  on(prevBtn, "click", () => {
    // Going backwards doesn't break streak – just navigate.
    goToPrevDay();
  });

  on(nextBtn, "click", () => {
    // If leaving this day forward would break the streak, show the warning.
    if (willLoseStreakOnForwardLeave()) {
      pendingDayNav = { direction: "next" };
      if (streakWarnOverlay) setDisplay(streakWarnOverlay, true);
      return;
    }
    // Otherwise, just move to the next day.
    goToNextDay();
  });

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
      allowanceMode: "weekly",
      allowanceXpAwarded: false,
      goalPreset: null,
      goalTarget: 0, 
      goalDescription: ""
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
      total += (ct["Essential Living"] || 0) +
               (ct["Social & Leisure"] || 0) +
               (ct["Personal Treats"] || 0) +
               (ct["Unexpected"] || 0);
    }
    return total;
  }

  // Count how many of the 7 days are marked as "no spending"
  function getWeekNoSpendCount() {
    let count = 0;
    for (let d = 1; d <= 7; d++) {
      const key = `day-${d}`;
      const data = ensureMonth(key);
      if (data.noSpending) count++;
    }
    return count;
  }

  // Average spend across all 7 days (sum of categoryTotals / 7)
  function getWeekAverageSpend() {
    let total = 0;
    for (let d = 1; d <= 7; d++) {
      const key = `day-${d}`;
      const data = ensureMonth(key);
      const dayTotal = Object.values(data.categoryTotals || {})
        .reduce((a, b) => a + (b || 0), 0);
      total += dayTotal;
    }
    return total / 7;
  }

  // Update "Allowance Remaining" + "Savings" based on mode
  function updateAllowanceRemaining() {
    const mode = settings.allowanceMode || "weekly";
    const weeklyAllowance = Number(settings.allowance || 0);
    const dailyAllowance = weeklyAllowance / 7;

    if (mode === "weekly") {
      // Weekly view: total allowance minus ALL expenses across all days
      const spentAll = getGlobalSpent();
      const remaining = weeklyAllowance - spentAll;

      allowanceRemainingDiv.textContent =
        `Remaining: ${remaining.toFixed(2)}`;

      if (savingsInfoDiv) {
        savingsInfoDiv.textContent =
          `Savings this week: ${(weeklyAllowance - spentAll).toFixed(2)}`;
      }
    } else {
      // Daily view: (weekly allowance / 7) minus current-day expenses only
      const data = getMonthData();
      const spentToday = Object
        .values(data.categoryTotals)
        .reduce((a, b) => a + b, 0);

      const remaining = dailyAllowance - spentToday;

      allowanceRemainingDiv.textContent =
        `Remaining: ${remaining.toFixed(2)}`;

      if (savingsInfoDiv) {
        savingsInfoDiv.textContent =
          `Savings today: ${(dailyAllowance - spentToday).toFixed(2)}`;
      }
    }
  }

  function updatePieChart() {
    if (!categoryChart) return;

    const d = getMonthData().categoryTotals;
    categoryChart.data.datasets[0].data = [
      d["Essential Living"],
      d["Social & Leisure"],
      d["Personal Treats"],
      d["Unexpected"]
    ];
    categoryChart.update();
  }

  /* ---------- Level helper ---------- */
  function getLevelInfo(score) {
    const xp = Number(score || 0);

    if (xp >= 251) {
      return {
        name: "Platinum",
        emoji: "💠",
        color: "#e5e4e2",
        rank: 4
      };
    }
    if (xp >= 181) {
      return {
        name: "Diamond",
        emoji: "💎",
        color: "#4fd1c5",
        rank: 3
      };
    }
    if (xp >= 91) {
      return {
        name: "Gold",
        emoji: "🥇",
        color: "#ffd700",
        rank: 2
      };
    }
    if (xp >= 31) {
      return {
        name: "Silver",
        emoji: "🥈",
        color: "#c0c0c0",
        rank: 1
      };
    }
    return {
      name: "Bronze",
      emoji: "🥉",
      color: "#cd7f32",
      rank: 0
    };
  }

    /* ---------- Leaderboard logic ---------- */

  let leaderboardSortMode = "xp"; // "xp" or "streak"

  function getLeaderboardData() {
    const userXp = Number(settings.score || 0);
    const userStreak = Number(settings.streak || 0);
    const levelInfo = getLevelInfo(userXp);

    return [
      { name: "Harry1", level: "Diamond", xp: 300, streak: 3 },
      { name: "JackL", level: "Bronze",  xp: 1,   streak: 20 },
      { name: "You",   level: levelInfo.name, xp: userXp, streak: userStreak }
    ];
  }

  function sortLeaderboard(data, mode) {
    const copy = data.slice();
    if (mode === "streak") {
      copy.sort((a, b) => b.streak - a.streak);
    } else {
      copy.sort((a, b) => b.xp - a.xp);
    }
    return copy;
  }

  function refreshLeaderboardToggleButtons() {
    if (!leaderboardToggleXp || !leaderboardToggleStreak) return;
    leaderboardToggleXp.classList.toggle("active", leaderboardSortMode === "xp");
    leaderboardToggleStreak.classList.toggle("active", leaderboardSortMode === "streak");
  }

  function renderLeaderboard() {
    if (!leaderboardTableBody) return;

    const data = sortLeaderboard(getLeaderboardData(), leaderboardSortMode);

    leaderboardTableBody.innerHTML = data.map((row, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${row.name}</td>
        <td>${row.level}</td>
        <td>${row.xp}</td>
        <td>${row.streak} day${row.streak === 1 ? "" : "s"}</td>
      </tr>
    `).join("");

    refreshLeaderboardToggleButtons();
  }

  function openLeaderboardModal() {
    if (!leaderboardOverlay) return;
    renderLeaderboard();
    setDisplay(leaderboardOverlay, true);
  }

  function closeLeaderboardModal() {
    if (leaderboardOverlay) leaderboardOverlay.style.display = "none";
  }

  // Background click closes modal
  if (leaderboardOverlay) {
    on(leaderboardOverlay, "click", (e) => {
      if (e.target === leaderboardOverlay) {
        closeLeaderboardModal();
      }
    });
  }

  // ESC closes modal
  on(document, "keydown", (e) => {
    if (
      e.key === "Escape" &&
      leaderboardOverlay &&
      leaderboardOverlay.style.display === "flex"
    ) {
      closeLeaderboardModal();
    }
  });

  // Toggle buttons
  on(leaderboardToggleXp, "click", () => {
    leaderboardSortMode = "xp";
    renderLeaderboard();
  });

  on(leaderboardToggleStreak, "click", () => {
    leaderboardSortMode = "streak";
    renderLeaderboard();
  });


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
      const info = getLevelInfo(xp);
      levelEl.textContent = `${info.emoji} Level: ${info.name}`;
    }
  }

  function evaluateGoals() {
    const preset = settings.goalPreset;
    if (!preset) return;

    if (!Array.isArray(settings.completedGoals)) {
      settings.completedGoals = [];
    }

    // Already completed this preset? Clear it and exit.
    if (settings.completedGoals.some(g => g.preset === preset)) {
      settings.goalPreset = null;
      settings.goalTarget = 0;
      settings.goalDescription = "";
      saveSettings();
      return;
    }

    let achieved = false;

    if (preset === "example1") {
      // 3 no-spend days in 7
      const count = getWeekNoSpendCount();
      achieved = count >= 3;
    } else if (preset === "example2") {
      // Reach Diamond level or above
      const info = getLevelInfo(settings.score);
      achieved = info && (info.name === "Diamond" || info.rank >= 3);
    } else if (preset === "example3") {
      // Weekly average < $20/day
      const avg = getWeekAverageSpend();
      achieved = avg < 20;
    }

    if (!achieved) return;

    const desc =
      settings.goalDescription ||
      GOAL_PRESETS[preset] ||
      "Goal completed";

    const xp = GOAL_XP_REWARDS[preset] || 0;
    if (xp > 0) {
      const units = xp / 10; // addScore multiplies by 10
      if (units > 0) {
        addScore(units); // this will set pendingLevelInfo if we cross a level
      }
    }

    settings.completedGoals.push({
      preset,
      description: desc
    });

    // Clear active goal
    settings.goalPreset = null;
    settings.goalTarget = 0;
    settings.goalDescription = "";
    saveSettings();

    // Queue goal popup; actual timing is handled by the callers
    pendingGoalPopupInfo = { description: desc, xp };

    // Re-render rewards modal if open
    if (rewardsOverlay && rewardsOverlay.style.display === "flex") {
      openRewardsModal();
    }
  }

    function getGoalProgressText(preset) {
    if (!preset) return "";

    if (preset === "example1") {
      // 3 no-spend days in 7
      const target = 3;
      const count = getWeekNoSpendCount();
      return `${count}/${target} no-spend days achieved (in the last 7 days).`;
    }

    if (preset === "example2") {
      // Progress toward Diamond
      const xp = Number(settings.score || 0);
      const info = getLevelInfo(xp);
      const diamondThreshold = 181;
      const remaining = Math.max(0, diamondThreshold - xp);

      if (info.name === "Diamond" || info.rank >= 3) {
        return `You're already Diamond 💎 (${xp}XP).`;
      }
      return `Current level: ${info.name} (${xp}XP) – ${remaining}XP to Diamond.`;
    }

    if (preset === "example3") {
      // Weekly average spend < $20/day
      const avg = getWeekAverageSpend();
      const target = 20;
      if (avg < target) {
        return `Current weekly average: $${avg.toFixed(2)} (✅ under $${target.toFixed(2)} target).`;
      }
      const extra = avg - target;
      return `Current weekly average: $${avg.toFixed(2)} (needs $${extra.toFixed(2)} less per day to hit $${target.toFixed(2)}).`;
    }

    return "";
  }


  /* ---------- Analytics modal helpers ---------- */
  let analyticsChart = null;

  const analyticsOverlay = $("analyticsModalOverlay");
  const analyticsTotalsEl = () => $("analyticsTotals");
  const analyticsChartEl = () => $("analyticsChart");
  const analyticsCloseBtn = () => $("analyticsCloseBtn");

  function renderAnalyticsChart() {
    const canvas = analyticsChartEl();
    if (!canvas) return;

    const ctxA = canvas.getContext("2d");
    const d = getMonthData().categoryTotals;
    const dataArr = [
      d["Essential Living"] || 0,
      d["Social & Leisure"] || 0,
      d["Personal Treats"] || 0,
      d["Unexpected"] || 0
    ];

    if (!analyticsChart) {
      analyticsChart = new Chart(ctxA, {
        type: "pie",
        data: {
          labels: [
            "Essential Living",
            "Social & Leisure",
            "Personal Treats",
            "Unexpected"
          ],
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
      Essential Living: ${(d["Essential Living"] || 0).toFixed(2)}<br>
      Social & Leisure: ${(d["Social & Leisure"] || 0).toFixed(2)}<br>
      Personal Treats: ${(d["Personal Treats"] || 0).toFixed(2)}<br>
      Unexpected: ${(d["Unexpected"] || 0).toFixed(2)}
    `;

    const totalsEl = analyticsTotalsEl();
    if (totalsEl) totalsEl.innerHTML = totalsHtml;

    setDisplay(analyticsOverlay, true);
    setTimeout(renderAnalyticsChart, 0);
  }

  function closeAnalyticsModal() {
    setDisplay(analyticsOverlay, false);
  }

  /* ---------- Rewards Modal ---------- */
  const rewardsOverlay = $("rewardsModalOverlay");
  const rewardsCurrentList = $("currentGoalsList");
  const rewardsCompletedList = $("completedGoalsList");

  function openRewardsModal() {
    if (!rewardsOverlay) return;

    // Current goals
    rewardsCurrentList.innerHTML = "";
    let hasAnyCurrent = false;

    // Active preset goal
    if (settings.goalPreset && settings.goalDescription) {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = settings.goalDescription;
      li.appendChild(strong);
      rewardsCurrentList.appendChild(li);
      hasAnyCurrent = true;

      // Progress line (normal weight)
      const progressText = getGoalProgressText(settings.goalPreset);
      if (progressText) {
        const progLi = document.createElement("li");
        progLi.textContent = progressText;
        progLi.classList.add("goal-progress-line");
        rewardsCurrentList.appendChild(progLi);
      }
    }

    // Savings target (ALSO bold now)
    if (settings.goalTarget > 0) {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = `Savings target: ${settings.goalTarget.toFixed(2)}`;
      li.appendChild(strong);
      rewardsCurrentList.appendChild(li);
      hasAnyCurrent = true;
    }

    if (!hasAnyCurrent) {
      rewardsCurrentList.innerHTML = "<li>No current goals set.</li>";
    }

    // Completed goals
    rewardsCompletedList.innerHTML = "";
    if (Array.isArray(settings.completedGoals) && settings.completedGoals.length) {
      rewardsCompletedList.innerHTML = settings.completedGoals
        .map(g => `<li>${g.description}</li>`)
        .join("");
    } else {
      rewardsCompletedList.innerHTML = "<li>None completed yet.</li>";
    }

    setDisplay(rewardsOverlay, true);
  }


  function closeRewardsModal() {
    if (rewardsOverlay) rewardsOverlay.style.display = "none";
  }

  if (rewardsOverlay) {
    on(rewardsOverlay, "click", (e) => {
      if (e.target === rewardsOverlay) {
        closeRewardsModal();
      }
    });
  }

  on(document, "keydown", (e) => {
    if (
      e.key === "Escape" &&
      rewardsOverlay &&
      rewardsOverlay.style.display === "flex"
    ) {
      closeRewardsModal();
    }
  });

  const rewardsCloseBtn = $("rewardsCloseBtn");
  on(rewardsCloseBtn, "click", closeRewardsModal);


  /* ---------- Streak-at-risk warning modal ---------- */
  function closeStreakWarningModal() {
    if (streakWarnOverlay) streakWarnOverlay.style.display = "none";
    pendingDayNav = null;
  }

  // Background click closes (no navigation, no streak loss)
  if (streakWarnOverlay) {
    on(streakWarnOverlay, "click", (e) => {
      if (e.target === streakWarnOverlay) {
        closeStreakWarningModal();
      }
    });
  }

  // ESC closes (no navigation, no streak loss)
  on(document, "keydown", (e) => {
    if (
      e.key === "Escape" &&
      streakWarnOverlay &&
      streakWarnOverlay.style.display === "flex"
    ) {
      closeStreakWarningModal();
    }
  });

  // "Add expense" → stay on this day, open the Add Type modal
  on(streakWarnAddBtn, "click", () => {
    closeStreakWarningModal();
    openAddTypeModal(); // reuse existing Add Expense flow
  });

  // "No spending today" → reuse your existing noSpend logic (and keep the streak)
  on(streakWarnNoSpendBtn, "click", () => {
    closeStreakWarningModal();
    if (noSpendBtn) {
      noSpendBtn.click(); // triggers the existing handler that awards XP + streak
    }
  });

  // "Back" → simply close and stay on this day
  on(streakWarnBackBtn, "click", () => {
    closeStreakWarningModal();
  });

  // "Continue" → accept that we lose the streak and move to the target day
  on(streakWarnContinueBtn, "click", () => {
    const dir = pendingDayNav?.direction || "next";
    closeStreakWarningModal();

    // kill the streak 💀
    resetStreakToZero();

    // then navigate as originally intended
    if (dir === "next") {
      goToNextDay();
    } else if (dir === "prev") {
      goToPrevDay();
    }
  });

  /* ---------- Coming Soon modal helpers ---------- */
  const comingSoonOverlay = $("comingSoonOverlay");
  const comingSoonTitleEl = () => $("comingSoonTitle");
  const comingSoonBodyEl = () => $("comingSoonBody");
  const comingSoonCloseBtn = () => $("comingSoonCloseBtn");

  function openComingSoonModal(featureName) {
    const title = comingSoonTitleEl();
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
        `<tr><td colspan="3" class="no-spending-row">No spending</td></tr>`;
    } else {
      submittedTableBody.innerHTML = data.expenses.map((e,idx)=>(
        `<tr data-row-id="${e.id}">
          <td>${idx+1}</td>
          <td>${e.amount.toFixed(2)}</td>
          <td>${e.category}</td>
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

  /* ---------- SCORE helpers & level-up wiring ---------- */
  let levelPopupTimer = null;
  let pendingLevelInfo = null;
  let pendingGoalPopupInfo = null;

  function scheduleLevelUpPopupIfNeeded(prevScore, newScore) {
    const prev = getLevelInfo(prevScore);
    const next = getLevelInfo(newScore);
    if (next.rank <= prev.rank) return;
    pendingLevelInfo = next;
  }

  function addScore(n = 1) {
    const prevScore = Number(settings.score || 0);
    const newScore = Math.max(0, prevScore + 10 * n);

    settings.score = newScore;
    saveSettings();
    updateStatsUI();

    scheduleLevelUpPopupIfNeeded(prevScore, newScore);
  }

  function subtractScore(n = 1) {
    const prevScore = Number(settings.score || 0);
    const newScore = Math.max(0, prevScore - 10 * n);

    settings.score = newScore;
    saveSettings();
    updateStatsUI();
  }

  // One-time XP reward for setting a global allowance
  function maybeAwardAllowanceXP() {
    if (settings.allowanceXpAwarded) return;

    const allowanceVal = Number(settings.allowance || 0);
    if (allowanceVal <= 0) return;

    settings.allowanceXpAwarded = true;
    saveSettings();

    // +20XP => 2 "units"
    addScore(2);
    showGoldPopup("Allowance set – great start! +20XP", 20);

    // Check goals & queue goal popup if any
    evaluateGoals();

    const xpDuration = 4000;
    const toastGap = 200;
    const goalDuration = 4000;

    let nextDelay = xpDuration + toastGap;

    // Goal toast after XP toast
    if (pendingGoalPopupInfo && pendingGoalPopupInfo.description) {
      const goalInfo = pendingGoalPopupInfo;
      setTimeout(() => {
        showGoalCompletedPopup(goalInfo.description, goalInfo.xp);
      }, nextDelay);
      nextDelay += goalDuration + toastGap;
      pendingGoalPopupInfo = null;
    }

    // Level-up after XP (and goal toast if present)
    if (pendingLevelInfo) {
      if (levelPopupTimer) clearTimeout(levelPopupTimer);
      levelPopupTimer = setTimeout(() => {
        if (pendingLevelInfo) {
          showLevelUpPopup(pendingLevelInfo);
          pendingLevelInfo = null;
        }
      }, nextDelay);
    }
  }

  /**
   * Apply scoring and streak bonus for “good” activity on the current day.
   * XP popup first, optional streak popup second, level popup last.
   */
  function applyStreakScore(baseUnits, _baseMessage) {
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

    // 1️⃣ XP popup (gold) – always first
    showGoldPopup("Great addition!", baseXP);

    // Optional streak bonus XP
    let bonusUnits = 0;
    if (prevDay !== null && today !== prevDay && streak > 1) {
      bonusUnits = streak; // e.g. 2 => +20XP, 3 => +30XP
      addScore(bonusUnits);
    }
    const bonusXP = bonusUnits * 10;

    // Evaluate goals (may award XP & set pendingGoalPopupInfo)
    evaluateGoals();

    // Now orchestrate toast order:
    // XP → Goal → Streak → Level
    const xpDuration = 4000;
    const toastGap = 200;
    const goalDuration = 4000;
    const streakDuration = 4000;

    let nextDelay = xpDuration + toastGap;

    // 2️⃣ Goal completed popup, if any
    if (pendingGoalPopupInfo && pendingGoalPopupInfo.description) {
      const goalInfo = pendingGoalPopupInfo;
      setTimeout(() => {
        showGoalCompletedPopup(goalInfo.description, goalInfo.xp);
      }, nextDelay);
      nextDelay += goalDuration + toastGap;
      pendingGoalPopupInfo = null;
    }

    // 3️⃣ Streak popup (red), after goal popup if present
    if (bonusXP > 0) {
      setTimeout(() => {
        showStreakPopup(streak, bonusXP);
      }, nextDelay);
      nextDelay += streakDuration + toastGap;
    }

    // 4️⃣ Level-up popup after everything else
    if (pendingLevelInfo) {
      if (levelPopupTimer) clearTimeout(levelPopupTimer);
      levelPopupTimer = setTimeout(() => {
        if (pendingLevelInfo) {
          showLevelUpPopup(pendingLevelInfo);
          pendingLevelInfo = null;
        }
      }, nextDelay);
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

  /* ---------- Goal Completed popup (green) ---------- */
  let goalPopupTimer = null;
  function showGoalCompletedPopup(description, earnedXP) {
    let popup = document.querySelector(".goal-popup-toast");

    if (!popup) {
      popup = document.createElement("div");
      popup.className = "goal-popup-toast";
      popup.setAttribute("role", "alert");
      popup.setAttribute("aria-live", "polite");

      Object.assign(popup.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: "10001",
        background: "#16a34a", // fallback, will be overridden by button colour
        color: "#fff",
        borderRadius: "12px",
        padding: "18px 22px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        fontFamily: "inherit",
        textAlign: "center",
        maxWidth: "90vw",
        minWidth: "260px"
      });

      const titleEl = document.createElement("div");
      titleEl.className = "goal-popup-title";
      Object.assign(titleEl.style, {
        fontSize: "22px",
        fontWeight: "800",
        letterSpacing: "0.5px",
        marginBottom: "6px"
      });

      const bodyEl = document.createElement("div");
      bodyEl.className = "goal-popup-body";
      Object.assign(bodyEl.style, {
        fontSize: "16px",
        fontWeight: "600",
        letterSpacing: "0.2px"
      });

      popup.appendChild(titleEl);
      popup.appendChild(bodyEl);
      document.body.appendChild(popup);
    }

    // Match the green to the Set Goal button if possible
    try {
      if (setGoalBtn) {
        const css = getComputedStyle(setGoalBtn);
        const bg = css.backgroundColor || "#16a34a";
        popup.style.background = bg;
      }
    } catch {
      // ignore, fallback stays
    }

    const titleEl = popup.querySelector(".goal-popup-title");
    const bodyEl = popup.querySelector(".goal-popup-body");

    if (titleEl) {
      titleEl.textContent = "Mission completed 💪";
    }
    if (bodyEl) {
      const xpText = earnedXP && earnedXP > 0 ? `  +${earnedXP}XP` : "";
      bodyEl.textContent = (description || "Goal completed!") + xpText;
    }

    popup.style.display = "block";

    if (goalPopupTimer) clearTimeout(goalPopupTimer);
    goalPopupTimer = setTimeout(() => {
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

  /* ---------- Level-up popup (third in hierarchy) ---------- */
  function showLevelUpPopup(levelInfo) {
    let popup = document.querySelector(".levelup-popup-toast");

    if (!popup) {
      popup = document.createElement("div");
      popup.className = "levelup-popup-toast";
      popup.setAttribute("role", "alert");
      popup.setAttribute("aria-live", "polite");

      Object.assign(popup.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: "10002",
        background: "#333",
        color: "#000",
        borderRadius: "14px",
        padding: "20px 26px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        fontFamily: "inherit",
        textAlign: "center",
        maxWidth: "90vw",
        minWidth: "240px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px"
      });

      const emojiEl = document.createElement("div");
      emojiEl.className = "levelup-emoji";
      Object.assign(emojiEl.style, {
        fontSize: "42px",
        lineHeight: "1"
      });
      emojiEl.textContent = "🛡️";

      const textEl = document.createElement("div");
      textEl.className = "levelup-text";
      Object.assign(textEl.style, {
        fontSize: "20px",
        fontWeight: "800",
        letterSpacing: "0.5px"
      });

      popup.appendChild(emojiEl);
      popup.appendChild(textEl);
      document.body.appendChild(popup);
    }

    const textEl = popup.querySelector(".levelup-text");

    const bg = levelInfo && levelInfo.color ? levelInfo.color : "#333";
    popup.style.background = bg;
    popup.style.border = "2px solid rgba(0,0,0,0.2)";

    const lightLevels = ["Gold", "Platinum", "Silver"];
    if (lightLevels.includes(levelInfo.name)) {
      popup.style.color = "#000";
    } else {
      popup.style.color = "#fff";
    }

    if (textEl) {
      textEl.textContent = `Level: ${levelInfo.name}`;
    }

    popup.style.display = "block";

    setTimeout(() => {
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
        "Essential Living": 0,
        "Social & Leisure": 0,
        "Personal Treats": 0,
        "Unexpected": 0
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
      if (favesOverlay && favesOverlay.style.display === "flex") renderFavesModal();
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
      if (favesOverlay && favesOverlay.style.display === "flex") renderFavesModal();
      return;
    }
    openFavNameModal({
      key,
      year: currentYear,
      monthIndex: currentMonthIndex,
      id,
      amount: exp.amount,
      category: exp.category
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
      "Essential Living": 0,
      "Social & Leisure": 0,
      "Personal Treats": 0,
      "Unexpected": 0
    };
    data.purchaseCount = 0;
    data.noSpending = false;

    saveState();
    renderForCurrentMonth();
    if (favesOverlay && favesOverlay.style.display === "flex") renderFavesModal();
  });

  /* ---------- Add/Edit Expense Modal ---------- */
  const expenseOverlay = $("expenseModalOverlay");
  const modalAmount = () => $("modalExpenseAmount");
  const modalCat = () => $("modalExpenseCategory");
  const modalSubmit = () => $("modalSubmitBtn");
  const modalTitle = () => expenseOverlay.querySelector(".expense-modal h3");
  const modalCategoryWrapper = () => $("modalCategoryWrapper");

  const quickStage = $("drinkQuickStage");
  const btnGuinness = $("drinkGuinnessBtn");
  const btnCoffee = $("drinkCoffeeBtn");
  const btnOther = $("drinkOtherBtn");

  const amountLabel = document.querySelector('label[for="modalExpenseAmount"]');

  function toggleFormFields(show) {
    const disp = show ? "block" : "none";
    if (amountLabel) amountLabel.style.display = disp;
    if (modalAmount()) modalAmount().style.display = disp;
    if (modalCategoryWrapper()) modalCategoryWrapper().style.display = disp;
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
    } else {
      editingId = null;
      modalTitle().textContent = quickDrinkOnly ? "Add Drink" : "Add Expense";
      modalAmount().value = (expense && "amount" in expense) ? expense.amount : "";
      modalCat().value = expense?.category || "Essential Living";
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
    if (expenseOverlay && expenseOverlay.style.display === "flex" && e.key === "Escape") {
      closeExpenseModal();
    }
  });

  on(modalSubmit(), "click", () => {
    try {
      const amount = parseFloat(modalAmount().value);
      const category = modalCat().value;

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

      const data = getMonthData();

      if (editingId !== null) {
        const idx = data.expenses.findIndex(e => e.id === editingId);
        if (idx !== -1) {
          const old = data.expenses[idx];
          data.categoryTotals[old.category] =
            Math.max(0, (data.categoryTotals[old.category] || 0) - (old.amount || 0));
          data.expenses[idx] = { ...old, amount, category };
          data.categoryTotals[category] =
            (data.categoryTotals[category] || 0) + amount;

          const key = compositeId(editingId);
          if (favourites[key]) {
            Object.assign(favourites[key], { amount, category });
            saveFavourites();
          }
        }
      } else {
        if (data.noSpending) subtractScore(5);
        data.noSpending = false;

        data.purchaseCount += 1;
        data.expenses.push({ id: data.purchaseCount, amount, category });
        data.categoryTotals[category] += amount;

        applyStreakScore(1, "great addition! +10XP");
      }

      saveState();
      renderForCurrentMonth();
      if (favesOverlay && favesOverlay.style.display === "flex") renderFavesModal();
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
    // Drink → Social & Leisure
    openExpenseModal(
      { category: "Social & Leisure", amount: "" },
      { hideCategory: true, quickDrinkOnly: true }
    );
  });

  on(addTypeGroceriesBtn(), "click", () => {
    closeAddTypeModal();
    // Groceries → Essential Living
    openExpenseModal(
      { category: "Essential Living", amount: "" },
      { hideCategory: true, quickDrinkOnly: false }
    );
  });

  on(addTypeBigNightBtn(), "click", () => {
    closeAddTypeModal();
    // Big Night → Social & Leisure
    openExpenseModal(
      { category: "Social & Leisure", amount: "" },
      { hideCategory: true, quickDrinkOnly: false }
    );
  });

  on(addTypeOtherBtn(), "click", () => {
    closeAddTypeModal();
    // Other → Essential Living (with full form)
    openExpenseModal(
      { category: "Essential Living", amount: "" },
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
      category: "Social & Leisure"
    });
    data.categoryTotals["Social & Leisure"] =
      (data.categoryTotals["Social & Leisure"] || 0) + amt;

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
    modalCat().value = "Social & Leisure";
    modalAmount().value = "";
    setTimeout(()=> modalAmount()?.focus(), 0);
  });

  /* ---------- Details Modal ---------- */
  const detailsOverlay = $("detailsModalOverlay");
  const detailsBody = () => $("detailsModalBody");

  function openDetailsModal(text) {
    if (detailsBody()) detailsBody().textContent = text || "No details.";
    setDisplay(detailsOverlay, true);
  }
  function closeDetailsModal() {
    setDisplay(detailsOverlay, false);
  }
  on(detailsOverlay, "click", (e)=>{
    if (e.target === detailsOverlay) closeDetailsModal();
  });
  on(document, "keydown", (e)=>{
    if (detailsOverlay && detailsOverlay.style.display === "flex" && e.key === "Escape") {
      closeDetailsModal();
    }
  });

  /* ---------- Goals Modal ---------- */
  const goalOverlay = $("goalModalOverlay");
  const goalSaveBtn = $("goalSaveBtn");
  const goalTargetInput = $("goalTargetInput");
  const goalPresetNodes = () =>
    document.querySelectorAll('input[name="goalPreset"]');

  function openGoalModal() {
    if (!goalOverlay) return;

    const preset = settings.goalPreset || null;
    goalPresetNodes().forEach((node) => {
      node.checked = node.value === preset;
    });

    if (goalTargetInput) {
      goalTargetInput.value =
        typeof settings.goalTarget === "number" && !Number.isNaN(settings.goalTarget)
          ? settings.goalTarget
          : "";
    }

    setDisplay(goalOverlay, true);
    setTimeout(() => goalTargetInput?.focus(), 0);
  }

  function closeGoalModal() {
    if (goalOverlay) goalOverlay.style.display = "none";
  }

  if (goalOverlay) {
    on(goalOverlay, "click", (e) => {
      if (e.target === goalOverlay) {
        closeGoalModal();
      }
    });
  }

  on(document, "keydown", (e) => {
    if (
      e.key === "Escape" &&
      goalOverlay &&
      goalOverlay.style.display === "flex"
    ) {
      closeGoalModal();
    }
  });

  on(goalSaveBtn, "click", () => {
    const radios = goalPresetNodes();
    let chosenPreset = null;
    radios.forEach((r) => {
      if (r.checked) chosenPreset = r.value;
    });

    const rawTarget = parseFloat(goalTargetInput?.value || "");
    const hasTarget = !Number.isNaN(rawTarget) && rawTarget >= 0;

    if (!chosenPreset && !hasTarget) {
      alert("Please pick a preset goal or enter a savings target.");
      return;
    }

    settings.goalPreset = chosenPreset;
    settings.goalTarget = hasTarget ? rawTarget : 0;

    // NEW: store the text for the selected preset WITHOUT the XP bit
    if (chosenPreset && GOAL_PRESETS[chosenPreset]) {
      settings.goalDescription = GOAL_PRESETS[chosenPreset];
    } else {
      settings.goalDescription = "";
    }

    saveSettings();

    // Close popup and return to home
    closeGoalModal();
  });


  /* ---------- Analytics & Coming Soon Modals wiring ---------- */
  on(analyticsBtn, "click", openAnalyticsModal);
  on(leaderboardBtn, "click", openLeaderboardModal);
  on(rewardsBtn, "click", openRewardsModal);  // NEW
  on(setGoalBtn, "click", openGoalModal);

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

  /* ---------- Allowance Modal (combined calculate + manual) ---------- */
  const allowanceOverlay = $("allowanceModalOverlay");
  const allowanceStage = () => $("allowanceModalStage");
  const allowanceCancel = () => $("allowanceModalCancelBtn");
  const allowanceBack = () => $("allowanceModalBackBtn");
  const allowanceSubmit = () => $("allowanceModalSubmitBtn");

  let allowanceFlow = { mode: null };

  const openAllowanceModal = () => {
    showAllowanceCombined();           // go straight to combined view
    setDisplay(allowanceOverlay, true);
  };
  const closeAllowanceModal = () => {
    setDisplay(allowanceOverlay, false);
    allowanceFlow = { mode: null };
  };

  // Calculate button + inline manual input in the same screen
  function showAllowanceCombined() {
    allowanceFlow.mode = "combined";

    if (allowanceBack()) allowanceBack().style.display = "none";

    const submit = allowanceSubmit();
    if (submit) {
      submit.style.display = "inline-block";
      submit.textContent = "Set Global Allowance";
    }

    allowanceStage().innerHTML = `
      <button id="allowanceCalcBtn" type="button"
              style="margin-bottom:10px; width:100%;">
        Calculate
      </button>
      <div style="text-align:center; margin:6px 0; font-size:13px; color:#555;">
        — OR —
      </div>
      <label for="allowanceManualInput" style="font-size:14px; color:#333;">
        Allowance Amount
      </label>
      <input id="allowanceManualInput" type="number" step="0.01" min="0"
             placeholder="Enter amount"
             style="padding:8px; font-size:16px; width:100%; box-sizing:border-box;" />
    `;

    const inp = $("allowanceManualInput");
    if (inp) {
      inp.value = Number(settings.allowance || 0);
      inp.focus({ preventScroll: true });
    }

    const calcBtn = $("allowanceCalcBtn");
    on(calcBtn, "click", showAllowanceCalc);

    if (submit) {
      submit.onclick = () => {
        const val = parseFloat(inp.value);
        if (isNaN(val) || val < 0) {
          alert("Please enter a valid allowance (0 or more).");
          inp.focus();
          return;
        }
        settings.allowance = val;
        saveSettings();

        // One-time XP reward for setting a valid allowance
        maybeAwardAllowanceXP();

        renderForCurrentMonth();
        closeAllowanceModal();
      };
    }
  }

  function showAllowanceCalc() {
    allowanceFlow.mode = "calc";
    if (allowanceBack()) allowanceBack().style.display = "inline-block";
    const submit = allowanceSubmit();
    if (submit) {
      submit.style.display = "inline-block";
      submit.textContent = "Set Global Allowance";
    }

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

    if (allowanceBack()) allowanceBack().onclick = showAllowanceCombined;

    if (submit) {
      submit.onclick = () => {
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

        // One-time XP reward for setting a valid allowance
        maybeAwardAllowanceXP();

        renderForCurrentMonth();
        closeAllowanceModal();
      };
    }
  }

  on(allowanceOverlay, "click", (e)=>{
    if (e.target === allowanceOverlay) closeAllowanceModal();
  });
  on(document, "keydown", (e)=>{
    if (allowanceOverlay && allowanceOverlay.style.display === "flex" && e.key === "Escape") {
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
            <th>Name</th><th>Amount</th><th>Category</th><th>Action</th>
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
    if (favesOverlay && favesOverlay.style.display === "flex" && e.key === "Escape") {
      closeFavesModal();
    }
  });
  on(favesCloseBtn, "click", closeFavesModal);
  on(showFavouritesBtn, "click", openFavesModal);

  on(favesList, "click", (e) => {
    const add = e.target.closest(".fave-add");
    const del = e.target.closest(".fav-delete");

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
        category: fav.category
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
        name: fav.name || "Favourite"
      };
      saveFavourites();

      applyStreakScore(1, "great addition! +10XP");

      saveState();
      renderForCurrentMonth();
      closeFavesModal();
      return;
    }

    if (del) {
      const key = del.dataset.key;
      if (!key) return;
      delete favourites[key];
      saveFavourites();
      renderFavesModal();
      // Keep rails in sync: unfilling stars for rows that lost favourites
      renderForCurrentMonth();
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
    if (favNameOverlay && favNameOverlay.style.display === "flex" && e.key === "Escape") {
      closeFavNameModal();
    }
  });
  on(favNameSave, "click", () => {
    if (!pendingFav) return;
    const name = favNameInput.value.trim() || "Favourite";
    const { key, year, monthIndex, id, amount, category } = pendingFav;
    favourites[key] = { id, year, monthIndex, amount, category, name };
    saveFavourites();
    closeFavNameModal();
    renderForCurrentMonth();
    if (favesOverlay && favesOverlay.style.display === "flex") renderFavesModal();
  });

  /* ---------- Openers ---------- */
  on(addBtn, "click", openAddTypeModal);

  /* ---------- Initial render ---------- */
  renderForCurrentMonth();
});
