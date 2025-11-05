document.addEventListener("DOMContentLoaded", () => {
  // ===== Grab elements =====
  const addBtn = document.getElementById("addExpenseBtn");
  const addGroceriesBtn = document.getElementById("addGroceriesBtn");
  const addDrinkBtn = document.getElementById("addDrinkBtn");
  const showFavouritesBtn = document.getElementById("showFavouritesBtn");

  const submittedTable = document.getElementById("submittedExpenses");

  // Ensure a <tbody> exists
  let submittedTableBody = submittedTable.querySelector("tbody");
  if (!submittedTableBody) {
    submittedTableBody = document.createElement("tbody");
    submittedTable.appendChild(submittedTableBody);
  }

  const totalsDiv = document.getElementById("categoryTotals");
  const clearAllBtn = document.getElementById("clearAllBtn");

  const setAllowanceBtn = document.getElementById("setAllowanceBtn");
  const allowanceDisplay = document.getElementById("allowanceDisplay");
  const allowanceRemainingDiv = document.getElementById("allowanceRemaining");

  // Favourites Modal
  const favesOverlay = document.getElementById("favesModalOverlay");
  const favesList = document.getElementById("favesList");
  const favesCloseBtn = document.getElementById("favesCloseBtn");

  // Favourite Name Modal
  const favNameOverlay = document.getElementById("favNameModalOverlay");
  const favNameInput   = document.getElementById("favNameInput");
  const favNameCancel  = document.getElementById("favNameCancelBtn");
  const favNameSave    = document.getElementById("favNameSaveBtn");

  // Month controls
  const prevBtn = document.getElementById("prevMonthBtn");
  const nextBtn = document.getElementById("nextMonthBtn");
  const monthSelect = document.getElementById("monthSelect");
  const yearSelect = document.getElementById("yearSelect");
  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  // ===== Chart.js setup =====
  const ctx = document.getElementById("categoryChart").getContext("2d");
  const categoryChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Groceries", "Social", "Treat", "Unexpected"],
      datasets: [{
        label: "Category Breakdown",
        data: [0, 0, 0, 0],
        backgroundColor: [
          "#11cdef", // Turquoise  (Groceries)
          "#0b2a4a", // Navy       (Social)
          "#0f766e", // Teal       (Treat)
          "#ffb000"  // Warm amber (Unexpected)
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } }
    }
  });

  // Sync chart colors with CSS variables dynamically
  (() => {
    const css = getComputedStyle(document.documentElement);
    const themedColors = [
      css.getPropertyValue("--turquoise").trim() || "#11cdef",
      css.getPropertyValue("--navy").trim()      || "#0b2a4a",
      css.getPropertyValue("--teal").trim()      || "#0f766e",
      css.getPropertyValue("--amber").trim()     || "#ffb000",
    ];
    categoryChart.data.datasets[0].backgroundColor = themedColors;
    categoryChart.update();
  })()

  // ===== Storage & state =====
  const STATE_KEY = "savr-monthly-state-v1";
  const SETTINGS_KEY = "savr-settings-v1";
  const FAV_KEY = "savr-favourites-v1"; // global favourites across months (map of composite key -> favourite)

  let monthlyState = loadJSON(STATE_KEY) || {};
  let settings = loadJSON(SETTINGS_KEY) || { allowance: 0 };
  let favourites = loadJSON(FAV_KEY) || {}; // { "YYYY-MM-id": { id, year, monthIndex, amount, category, card, name } }

  function saveState() { saveJSON(STATE_KEY, monthlyState); }
  function saveSettings() { saveJSON(SETTINGS_KEY, settings); }
  function saveFavourites() { saveJSON(FAV_KEY, favourites); }
  function loadJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
  function saveJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  // Remove any old per-month allowance fields
  Object.keys(monthlyState).forEach(k => {
    if (monthlyState[k] && typeof monthlyState[k].allowance !== "undefined") {
      delete monthlyState[k].allowance;
    }
  });

  function yyyymmKey(y, mIndex) { return `${y}-${String(mIndex + 1).padStart(2, "0")}`; }
  function compositeId(year, monthIndex, id) { return `${yyyymmKey(year, monthIndex)}-${id}`; }

  let currentYear, currentMonthIndex;

  function ensureMonth(key) {
    if (!monthlyState[key]) {
      monthlyState[key] = {
        expenses: [],
        categoryTotals: { Groceries: 0, Social: 0, Treat: 0, Unexpected: 0 },
        purchaseCount: 0
      };
    }
    return monthlyState[key];
  }
  function currentKey() { return yyyymmKey(currentYear, currentMonthIndex); }
  function getMonthData() { return ensureMonth(currentKey()); }
  function findExpenseById(id) { return getMonthData().expenses.find(e => e.id === id); }
  function isFavourited(year, monthIndex, id) {
    return !!favourites[compositeId(year, monthIndex, id)];
  }

  // ===== Init month pickers =====
  (function initMonthYearPickers() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonthIndex = now.getMonth();

    if (monthSelect) {
      monthNames.forEach((name, i) => {
        const opt = document.createElement("option");
        opt.value = i; opt.textContent = name;
        monthSelect.appendChild(opt);
      });
      monthSelect.value = currentMonthIndex;
      monthSelect.addEventListener("change", () => {
        currentMonthIndex = Number(monthSelect.value);
        renderForCurrentMonth();
      });
    }

    if (yearSelect) {
      const startYear = currentYear - 3;
      const endYear   = currentYear + 3;
      for (let y = startYear; y <= endYear; y++) {
        const opt = document.createElement("option");
        opt.value = y; opt.textContent = y;
        yearSelect.appendChild(opt);
      }
      yearSelect.value = currentYear;
      yearSelect.addEventListener("change", () => {
        currentYear = Number(yearSelect.value);
        renderForCurrentMonth();
      });
    }

    prevBtn?.addEventListener("click", () => {
      currentMonthIndex--;
      if (currentMonthIndex < 0) { currentMonthIndex = 11; currentYear--; yearSelect && (yearSelect.value = currentYear); }
      monthSelect && (monthSelect.value = currentMonthIndex);
      renderForCurrentMonth();
    });

    nextBtn?.addEventListener("click", () => {
      currentMonthIndex++;
      if (currentMonthIndex > 11) { currentMonthIndex = 0; currentYear++; yearSelect && (yearSelect.value = currentYear); }
      monthSelect && (monthSelect.value = currentMonthIndex);
      renderForCurrentMonth();
    });
  })();

  // ===== Ensure table header (no Actions column) =====
  (function stripActionsHeaderIfPresent() {
    const theadRow = submittedTable.querySelector("thead tr");
    if (!theadRow) return;
    Array.from(theadRow.children).forEach(th => {
      if (th.textContent.trim().toLowerCase() === "actions") th.remove();
    });
  })();

  // ===== Render helpers =====
  function updateAllowanceRemaining() {
    const data = getMonthData();
    const totalSpent = Object.values(data.categoryTotals).reduce((sum, val) => sum + val, 0);
    const remaining = (settings.allowance || 0) - totalSpent;
    allowanceRemainingDiv.textContent = `Allowance Remaining: ${remaining.toFixed(2)}`;
  }

  function updatePieChart() {
    const data = getMonthData();
    categoryChart.data.datasets[0].data = [
      data.categoryTotals.Groceries,
      data.categoryTotals.Social,
      data.categoryTotals.Treat,
      data.categoryTotals.Unexpected
    ];
    categoryChart.update();
  }

  // --- Rails (left favourites, right edit/delete)
  const tableWrap = document.querySelector(".table-wrap") || document.body;
  const deleteRail = document.getElementById("deleteRail");
  const leftRail = document.getElementById("leftRail");

  function renderForCurrentMonth() {
    const data = getMonthData();
    const globalAllowance = Number(settings.allowance) || 0;
    allowanceDisplay.textContent = `Allowance: ${globalAllowance.toFixed(2)}`;

    // Rebuild table rows
    submittedTableBody.innerHTML = "";
    data.expenses.forEach((e, idx) => {
      const row = document.createElement("tr");
      row.setAttribute("data-row-id", e.id);
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td>${e.amount.toFixed(2)}</td>
        <td>${e.category}</td>
        <td>${e.card || "-"}</td>
      `;
      submittedTableBody.appendChild(row);
    });

    // Totals (for full month data)
    totalsDiv.innerHTML = `
      Groceries: ${data.categoryTotals.Groceries.toFixed(2)}<br>
      Social: ${data.categoryTotals.Social.toFixed(2)}<br>
      Treat: ${data.categoryTotals.Treat.toFixed(2)}<br>
      Unexpected: ${data.categoryTotals.Unexpected.toFixed(2)}
    `;

    updateAllowanceRemaining();
    updatePieChart();

    queueMicrotask(positionEditDeleteDots);
    queueMicrotask(positionFavStars);
  }

  function positionEditDeleteDots() {
    if (!deleteRail) return;
    deleteRail.innerHTML = "";

    const containerRect = tableWrap.getBoundingClientRect();
    const rows = Array.from(submittedTableBody.querySelectorAll("tr"));

    rows.forEach((tr) => {
      const id = Number(tr.getAttribute("data-row-id"));
      const r = tr.getBoundingClientRect();
      const topInContainer = r.top - containerRect.top + (r.height / 2) - 8;

      // Edit 'e'
      const edit = document.createElement("span");
      edit.className = "edit-mini";
      edit.textContent = "e";
      edit.dataset.id = String(id);
      edit.style.top = `${topInContainer}px`;

      // Delete 'd'
      const dot = document.createElement("span");
      dot.className = "delete-mini";
      dot.textContent = "d";
      dot.dataset.id = String(id);
      dot.style.top = `${topInContainer}px`;

      deleteRail.appendChild(edit);
      deleteRail.appendChild(dot);
    });
  }

  function positionFavStars() {
    if (!leftRail) return;
    leftRail.innerHTML = "";

    const containerRect = tableWrap.getBoundingClientRect();
    const rows = Array.from(submittedTableBody.querySelectorAll("tr"));

    rows.forEach((tr) => {
      const id = Number(tr.getAttribute("data-row-id"));
      const r = tr.getBoundingClientRect();
      const topInContainer = r.top - containerRect.top + (r.height / 2) - 8;

      const star = document.createElement("span");
      star.className = "fav-mini";
      star.dataset.id = String(id);

      const fav = isFavourited(currentYear, currentMonthIndex, id);
      star.textContent = fav ? "★" : "☆";
      if (fav) star.classList.add("filled");
      star.style.top = `${topInContainer}px`;

      leftRail.appendChild(star);
    });
  }

  // Reposition rails on resize
  window.addEventListener("resize", () => {
    positionEditDeleteDots();
    positionFavStars();
  });

  // ===== Rail actions: Edit/Delete (right) & Favourite (left) =====
  deleteRail?.addEventListener("click", (evt) => {
    const editEl = evt.target.closest(".edit-mini");
    const delEl  = evt.target.closest(".delete-mini");

    if (editEl) {
      const id = Number(editEl.dataset.id);
      const exp = findExpenseById(id);
      if (exp) openExpenseModal(exp); // edit mode
      return;
    }

    if (delEl) {
      const id = Number(delEl.dataset.id);
      const data = getMonthData();
      const i = data.expenses.findIndex(x => x.id === id);
      if (i === -1) return;

      const exp = data.expenses[i];

      // NOTE: Do NOT remove favourites when deleting a row; favourites are global snapshots.

      data.categoryTotals[exp.category] = Math.max(
        0,
        (data.categoryTotals[exp.category] || 0) - (exp.amount || 0)
      );
      data.expenses.splice(i, 1);

      saveState();
      renderForCurrentMonth();
      if (favesOverlay.style.display === "flex") renderFavesModal(); // keep modal in sync
    }
  });

  // Click star to toggle favourite:
  // - If not favourited: open "Name your favourite" modal
  // - If already favourited (filled): remove from favourites immediately
  leftRail?.addEventListener("click", (evt) => {
    const star = evt.target.closest(".fav-mini");
    if (!star) return;

    const id = Number(star.dataset.id);
    const data = getMonthData();
    const exp = data.expenses.find(e => e.id === id);
    if (!exp) return;

    const key = compositeId(currentYear, currentMonthIndex, id);
    const existing = favourites[key];

    if (existing) {
      // Un-favourite: remove and refresh UI
      delete favourites[key];
      saveFavourites();
      renderForCurrentMonth();
      if (favesOverlay.style.display === "flex") renderFavesModal();
      return;
    }

    // Not favourited yet → open name modal to create
    const snapshot = {
      key,
      year: currentYear,
      monthIndex: currentMonthIndex,
      id,
      amount: exp.amount,
      category: exp.category,
      card: exp.card || ""
    };
    openFavNameModal(snapshot, "");
  });

  // ===== Clear All =====
  clearAllBtn?.addEventListener("click", () => {
    if (!confirm("Are you sure you want to delete all expenses for this month?")) return;

    // Do NOT purge favourites here; they are global snapshots.

    const data = getMonthData();
    data.expenses = [];
    data.categoryTotals = { Groceries: 0, Social: 0, Treat: 0, Unexpected: 0 };
    data.purchaseCount = 0;

    saveState();
    renderForCurrentMonth();
    if (favesOverlay.style.display === "flex") renderFavesModal();
  });

  // ===== Add/Edit Expense modal =====
  const expenseOverlay = document.getElementById("expenseModalOverlay");
  const modalAmount  = () => document.getElementById("modalExpenseAmount");
  const modalCat     = () => document.getElementById("modalExpenseCategory");
  const modalCard    = () => document.getElementById("modalExpenseCard");
  const modalSubmit  = () => document.getElementById("modalSubmitBtn");
  const modalCancel  = () => document.getElementById("modalCancelBtn");
  const modalTitle   = () => expenseOverlay.querySelector(".expense-modal h3");
  const modalCategoryWrapper = () => document.getElementById("modalCategoryWrapper");

  // Quick-pick stage elements (inside the same modal)
  const quickStage = document.getElementById("drinkQuickStage");
  const btnGuinness = document.getElementById("drinkGuinnessBtn");
  const btnCoffee   = document.getElementById("drinkCoffeeBtn");
  const btnOther    = document.getElementById("drinkOtherBtn");

  // Helpers to show/hide the normal form fields
  const amountLabel = document.querySelector('label[for="modalExpenseAmount"]');
  const cardLabel   = document.querySelector('label[for="modalExpenseCard"]');
  function showFormFields(show) {
    if (amountLabel) amountLabel.style.display = show ? "block" : "none";
    if (modalAmount()) modalAmount().style.display = show ? "block" : "none";
    if (modalCategoryWrapper()) modalCategoryWrapper().style.display = show ? "block" : "none";
    if (cardLabel) cardLabel.style.display = show ? "block" : "none";
    if (modalCard()) modalCard().style.display = show ? "block" : "none";
    if (modalSubmit()) modalSubmit().style.display = show ? "inline-block" : "none";
  }

  // Track whether we're editing; if so, which id
  let editingId = null;

  // expense: object or existing expense; options: { hideCategory, quickDrinkOnly }
  function openExpenseModal(expense = null, options = {}) {
    const isEdit = expense && typeof expense.id === "number";
    const hideCategory = !!options.hideCategory;
    const quickDrinkOnly = !!options.quickDrinkOnly;

    // If quick pick only, show only the quick stage; hide the form fields
    if (!isEdit && quickStage) {
      quickStage.style.display = quickDrinkOnly ? "block" : "none";
      showFormFields(!quickDrinkOnly); // hide form when quick pick is shown
    } else if (quickStage) {
      quickStage.style.display = "none";
      showFormFields(true);
    }

    // Category show/hide (never hide on edit). If we're in quick-only mode, category hidden anyway.
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
      let amount = "";
      let category = expense?.category || "Groceries";
      let card = expense?.card || "Credit";
      if (typeof expense?.amount !== "undefined") amount = expense.amount;
      modalAmount().value = amount;
      modalCat().value = category;
      modalCard().value = card;
    }

    expenseOverlay.style.display = "flex";
    setTimeout(() => (quickDrinkOnly ? null : modalAmount()?.focus()), 0);
  }

  function closeExpenseModal() {
    expenseOverlay.style.display = "none";
    if (quickStage) quickStage.style.display = "none";
    showFormFields(true); // restore for next open
    if (modalCategoryWrapper()) modalCategoryWrapper().style.display = "block";
    editingId = null;
  }

  expenseOverlay.addEventListener("click", (e) => { if (e.target === expenseOverlay) closeExpenseModal(); });
  document.addEventListener("keydown", (e) => {
    if (expenseOverlay.style.display === "flex" && e.key === "Escape") closeExpenseModal();
  });
  modalCancel()?.addEventListener("click", closeExpenseModal);

  // Submit (only used when the normal form is visible)
  modalSubmit()?.addEventListener("click", () => {
    try {
      const amount = parseFloat(modalAmount().value);
      const category = modalCat().value;
      const card = (modalCard() ? modalCard().value : "").trim();

      if (isNaN(amount) || amount <= 0) { alert("Please enter a valid amount."); modalAmount().focus(); return; }
      if (!["Groceries","Social","Treat","Unexpected"].includes(category)) { alert("Please select a valid category."); modalCat().focus(); return; }
      if (!["Credit","Debit"].includes(card)) { alert("Please choose Credit or Debit."); modalCard().focus(); return; }

      const data = getMonthData();

      if (editingId !== null) {
        const idx = data.expenses.findIndex(e => e.id === editingId);
        if (idx !== -1) {
          const old = data.expenses[idx];
          // Adjust old totals
          data.categoryTotals[old.category] = Math.max(0, (data.categoryTotals[old.category] || 0) - (old.amount || 0));

          // Update expense
          data.expenses[idx] = { ...old, amount, category, card };

          // Update totals
          data.categoryTotals[category] = (data.categoryTotals[category] || 0) + amount;

          // If this expense is favourited globally, update its snapshot too
          const key = compositeId(currentYear, currentMonthIndex, editingId);
          if (favourites[key]) {
            favourites[key].amount = amount;
            favourites[key].category = category;
            favourites[key].card = card;
            saveFavourites();
          }
        }
      } else {
        data.purchaseCount += 1;
        data.expenses.push({ id: data.purchaseCount, amount, category, card });
        data.categoryTotals[category] += amount;
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

  // Buttons to open modal
  addBtn?.addEventListener("click", () =>
    openExpenseModal({ category: "Groceries", card: "Credit", amount: "" }, { hideCategory: false, quickDrinkOnly: false })
  );

  addGroceriesBtn?.addEventListener("click", () =>
    openExpenseModal({ category: "Groceries", card: "Credit", amount: "" }, { hideCategory: true, quickDrinkOnly: false })
  );

  // Add Drink → show ONLY quick pick stage
  addDrinkBtn?.addEventListener("click", () => {
    openExpenseModal({ category: "Social", card: "Credit", amount: "" }, { hideCategory: true, quickDrinkOnly: true });
  });

  // Quick-pick handlers:
  btnGuinness?.addEventListener("click", () => {
    const data = getMonthData();
    data.purchaseCount += 1;
    data.expenses.push({ id: data.purchaseCount, amount: 6.00, category: "Social", card: "Credit" });
    data.categoryTotals.Social += 6.00;
    saveState();
    renderForCurrentMonth();
    closeExpenseModal();
  });
  btnCoffee?.addEventListener("click", () => {
    const data = getMonthData();
    data.purchaseCount += 1;
    data.expenses.push({ id: data.purchaseCount, amount: 3.50, category: "Social", card: "Credit" });
    data.categoryTotals.Social += 3.50;
    saveState();
    renderForCurrentMonth();
    closeExpenseModal();
  });
  btnOther?.addEventListener("click", () => {
    if (quickStage) quickStage.style.display = "none";
    showFormFields(true);
    if (modalCategoryWrapper()) modalCategoryWrapper().style.display = "none";
    modalTitle().textContent = "Add Expense";
    modalCat().value = "Social";
    modalAmount().value = "";
    setTimeout(() => modalAmount()?.focus(), 0);
  });

  // ===== Details Modal (view-only) =====
  const detailsOverlay = document.getElementById("detailsModalOverlay");
  const detailsBody    = () => document.getElementById("detailsModalBody");
  const detailsClose   = () => document.getElementById("detailsModalCloseBtn");

  function openDetailsModal(text) {
    detailsBody().textContent = text || "No details.";
    detailsOverlay.style.display = "flex";
  }
  function closeDetailsModal() { detailsOverlay.style.display = "none"; }

  detailsOverlay.addEventListener("click", (e) => { if (e.target === detailsOverlay) closeDetailsModal(); });
  document.addEventListener("keydown", (e) => {
    if (detailsOverlay.style.display === "flex" && e.key === "Escape") closeDetailsModal();
  });
  detailsClose()?.addEventListener("click", closeDetailsModal);

  // ===== Allowance Modal (Manual / Calculate flow) =====
  const allowanceOverlay = document.getElementById("allowanceModalOverlay");
  const allowanceStage   = () => document.getElementById("allowanceModalStage");
  const allowanceCancel  = () => document.getElementById("allowanceModalCancelBtn");
  const allowanceBack    = () => document.getElementById("allowanceModalBackBtn");
  const allowanceSubmit  = () => document.getElementById("allowanceModalSubmitBtn");

  let allowanceFlow = { mode: null };

  function openAllowanceModal() {
    showAllowanceChoice();
    allowanceOverlay.style.display = "flex";
  }
  function closeAllowanceModal() {
    allowanceOverlay.style.display = "none";
    allowanceFlow = { mode: null };
  }

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
    document.getElementById("allowanceManualBtn").addEventListener("click", showAllowanceManual);
    document.getElementById("allowanceCalcBtn").addEventListener("click", showAllowanceCalc);
  }

  function showAllowanceManual() {
    allowanceFlow.mode = "manual";
    allowanceBack().style.display = "inline-block";
    allowanceSubmit().style.display = "inline-block";
    allowanceSubmit().textContent = "Set Global Allowance";
    allowanceStage().innerHTML = `
      <label for="allowanceManualInput" style="font-size:14px; color:#333;">Allowance Amount</label>
      <input id="allowanceManualInput" type="number" step="0.01" min="0" placeholder="Enter amount"
             style="padding:8px; font-size:16px; width:100%; box-sizing:border-box;" />
    `;
    const inp = document.getElementById("allowanceManualInput");
    inp.value = Number(settings.allowance || 0);
    inp.focus({ preventScroll:true });
    allowanceBack().onclick = showAllowanceChoice;
    allowanceSubmit().onclick = () => {
      const val = parseFloat(inp.value);
      if (isNaN(val) || val < 0) { alert("Please enter a valid allowance (0 or more)."); inp.focus(); return; }
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
      <p>Allowance = Income − (Rent + Car + Bills + Savings + Other)</p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        ${["Income","Rent","Car Payments","Bills","Ideal Savings","Other"].map(label => `
          <label style="display:flex; flex-direction:column; gap:6px;">
            <span style="font-size:14px; color:#333;">${label}</span>
            <input type="number" step="0.01" min="0" placeholder="${label}" data-allowance="${label}"
                   style="padding:8px; font-size:16px; width:100%; box-sizing:border-box;" value="0" />
          </label>
        `).join("")}
      </div>
    `;
    allowanceBack().onclick = showAllowanceChoice;
    allowanceSubmit().onclick = () => {
      const vals = {};
      document.querySelectorAll('[data-allowance]').forEach(el => {
        vals[el.dataset.allowance] = parseFloat(el.value) || 0;
      });
      const income  = vals["Income"];
      const costs   = vals["Rent"] + vals["Car Payments"] + vals["Bills"] + vals["Ideal Savings"] + vals["Other"];
      const result  = income - costs;
      settings.allowance = result;
      saveSettings();
      renderForCurrentMonth();
      closeAllowanceModal();
    };
  }

  // Allowance modal wiring
  allowanceOverlay.addEventListener("click", (e) => { if (e.target === allowanceOverlay) closeAllowanceModal(); });
  document.addEventListener("keydown", (e) => {
    if (allowanceOverlay.style.display === "flex" && e.key === "Escape") closeAllowanceModal();
  });
  allowanceCancel()?.addEventListener("click", closeAllowanceModal);

  // Set Allowance button → open modal
  setAllowanceBtn?.addEventListener("click", openAllowanceModal);

  // ===== FAVOURITES MODAL (GLOBAL) =====
  function openFavesModal() {
    renderFavesModal();
    favesOverlay.style.display = "flex";
  }
  function closeFavesModal() { favesOverlay.style.display = "none"; }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]
    ));
  }

  function renderFavesModal() {
    const arr = Object.values(favourites);
    if (!arr.length) {
      favesList.innerHTML = `<p>No favourites yet.</p>`;
      return;
    }

    // sort: newest month first, then id
    arr.sort((a,b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.monthIndex !== b.monthIndex) return b.monthIndex - a.monthIndex;
      return (b.id || 0) - (a.id || 0);
    });

    // Replace the rows = arr.map(...) block in renderFavesModal() with this:
    const rows = arr.map((f) => {
      const key = `${yyyymmKey(f.year, f.monthIndex)}-${f.id}`;
      return `
        <tr data-key="${key}">
          <td class="fav-name">${escapeHtml(f.name || "Favourite")}</td>
          <td>${(f.amount || 0).toFixed(2)}</td>
          <td>${f.category}</td>
          <td>${f.card || "-"}</td>
          <td class="fav-actions">
            <button class="fave-add" type="button" data-key="${key}">Add</button>
            <span class="mini-inline edit-mini fav-edit" title="Rename" data-key="${key}">e</span>
            <span class="mini-inline delete-mini fav-delete" title="Delete" data-key="${key}">d</span>
          </td>
        </tr>
      `;
    }).join("");

    favesList.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Amount</th>
            <th>Category</th>
            <th>Card</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  favesOverlay.addEventListener("click", (e) => { if (e.target === favesOverlay) closeFavesModal(); });
  document.addEventListener("keydown", (e) => {
    if (favesOverlay.style.display === "flex" && e.key === "Escape") closeFavesModal();
  });
  favesCloseBtn?.addEventListener("click", closeFavesModal);

  // here

  // Replace the existing favesList.addEventListener("click", ...) with this:
  favesList.addEventListener("click", (e) => {
    // Add favourite to current month
    const addBtn = e.target.closest(".fave-add");
    if (addBtn) {
      const key = addBtn.dataset.key;
      const fav = favourites[key];
      if (!fav) return;

      const data = getMonthData();
      data.purchaseCount += 1;
      const newId = data.purchaseCount;
      data.expenses.push({
        id: newId,
        amount: fav.amount,
        category: fav.category,
        card: fav.card || "Credit"
      });
      data.categoryTotals[fav.category] = (data.categoryTotals[fav.category] || 0) + (fav.amount || 0);

      saveState();
      renderForCurrentMonth();
      return;
    }

    // Edit (rename) favourite
    const editBtn = e.target.closest(".fav-edit");
    if (editBtn) {
      const key = editBtn.dataset.key;
      const fav = favourites[key];
      if (!fav) return;

      // Open the existing "Name your favourite" modal prefilled
      openFavNameModal(
        { key, year: fav.year, monthIndex: fav.monthIndex, id: fav.id, amount: fav.amount, category: fav.category, card: fav.card },
        fav.name || ""
      );
      return;
    }

    // Delete favourite
    const delBtn = e.target.closest(".fav-delete");
    if (delBtn) {
      const key = delBtn.dataset.key;
      if (!favourites[key]) return;

      delete favourites[key];
      saveFavourites();
      renderFavesModal();
      return;
    }
  });


  showFavouritesBtn?.addEventListener("click", openFavesModal);

  // ===== "Name your favourite" modal =====
  let pendingFav = null; // { key, year, monthIndex, id, amount, category, card, name }

  function openFavNameModal(snapshot, defaultName = "") {
    pendingFav = { ...snapshot, name: defaultName || "" };
    favNameInput.value = pendingFav.name;
    favNameOverlay.style.display = "flex";
    setTimeout(() => favNameInput.focus(), 0);
  }

  function closeFavNameModal() {
    favNameOverlay.style.display = "none";
    pendingFav = null;
  }

  favNameOverlay.addEventListener("click", (e) => {
    if (e.target === favNameOverlay) closeFavNameModal();
  });
  document.addEventListener("keydown", (e) => {
    if (favNameOverlay.style.display === "flex" && e.key === "Escape") closeFavNameModal();
  });
  favNameCancel?.addEventListener("click", closeFavNameModal);

  favNameSave?.addEventListener("click", () => {
    if (!pendingFav) return;
    const name = favNameInput.value.trim() || "Favourite";
    const { key, year, monthIndex, id, amount, category, card } = pendingFav;

    favourites[key] = { id, year, monthIndex, amount, category, card, name };
    saveFavourites();

    closeFavNameModal();
    renderForCurrentMonth();
    if (favesOverlay.style.display === "flex") renderFavesModal();
  });

  // ===== Initial render =====
  renderForCurrentMonth();
});
