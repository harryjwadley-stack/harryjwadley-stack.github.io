document.addEventListener("DOMContentLoaded", () => {
  /* ---------- Helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const on = (el, evt, fn) => el && el.addEventListener(evt, fn);
  const setDisplay = (el, show) => { if (el) el.style.display = show ? "flex" : "none"; };

  const CATEGORIES = new Set(["Groceries", "Social", "Treat", "Unexpected"]);
  const CARDS = new Set(["Credit", "Debit"]);

  /* ---------- Grabs ---------- */
  const addBtn = $("addExpenseBtn");
  const addGroceriesBtn = $("addGroceriesBtn");
  const addDrinkBtn = $("addDrinkBtn");
  const bigNightBtn = $("bigNightBtn");
  const showFavouritesBtn = $("showFavouritesBtn");

  const submittedTable = $("submittedExpenses");
  let submittedTableBody = submittedTable.querySelector("tbody") || submittedTable.appendChild(document.createElement("tbody"));

  const totalsDiv = $("categoryTotals");
  const clearAllBtn = $("clearAllBtn");

  const setAllowanceBtn = $("setAllowanceBtn");
  const allowanceDisplay = $("allowanceDisplay");
  const allowanceRemainingDiv = $("allowanceRemaining");

  // Favourites Modal
  const favesOverlay = $("favesModalOverlay");
  const favesList = $("favesList");
  const favesCloseBtn = $("favesCloseBtn");

  // Favourite Name Modal
  const favNameOverlay = $("favNameModalOverlay");
  const favNameInput   = $("favNameInput");
  const favNameCancel  = $("favNameCancelBtn");
  const favNameSave    = $("favNameSaveBtn");

  // Month controls
  const prevBtn = $("prevMonthBtn");
  const nextBtn = $("nextMonthBtn");
  const monthSelect = $("monthSelect");
  const yearSelect = $("yearSelect");
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // Rails
  const tableWrap = document.querySelector(".table-wrap") || document.body;
  const deleteRail = $("deleteRail");
  const leftRail = $("leftRail");

  /* ---------- Chart ---------- */
  const ctx = $("categoryChart").getContext("2d");
  const categoryChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Groceries", "Social", "Treat", "Unexpected"],
      datasets: [{ label: "Category Breakdown", data: [0, 0, 0, 0], backgroundColor: ["#11cdef","#0b2a4a","#0f766e","#ffb000"] }]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });
  (() => {
    const css = getComputedStyle(document.documentElement);
    const themed = ["--turquoise","--navy","--teal","--amber"].map(v => css.getPropertyValue(v).trim());
    categoryChart.data.datasets[0].backgroundColor = themed.map((c,i)=> c || categoryChart.data.datasets[0].backgroundColor[i]);
    categoryChart.update();
  })();

  /* ---------- State ---------- */
  const STATE_KEY = "savr-monthly-state-v1";
  const SETTINGS_KEY = "savr-settings-v1";
  const FAV_KEY = "savr-favourites-v1";

  let monthlyState = loadJSON(STATE_KEY) || {};
  let settings     = loadJSON(SETTINGS_KEY) || { allowance: 0 };
  let favourites   = loadJSON(FAV_KEY) || {}; // { "YYYY-MM-id": { id, year, monthIndex, amount, category, card, name } }

  function loadJSON(k){ try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
  function saveJSON(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
  const saveState = () => saveJSON(STATE_KEY, monthlyState);
  const saveSettings = () => saveJSON(SETTINGS_KEY, settings);
  const saveFavourites = () => saveJSON(FAV_KEY, favourites);

  // Clean legacy per-month allowance keys
  for (const k of Object.keys(monthlyState)) if (monthlyState[k] && "allowance" in monthlyState[k]) delete monthlyState[k].allowance;

  const yyyymmKey = (y,m) => `${y}-${String(m+1).padStart(2,"0")}`;
  const compositeId = (y,m,id) => `${yyyymmKey(y,m)}-${id}`;

  let currentYear, currentMonthIndex;

  function ensureMonth(key){
    if (!monthlyState[key]) {
      monthlyState[key] = { expenses: [], categoryTotals: { Groceries: 0, Social: 0, Treat: 0, Unexpected: 0 }, purchaseCount: 0 };
    }
    return monthlyState[key];
  }
  const currentKey = () => yyyymmKey(currentYear, currentMonthIndex);
  const getMonthData = () => ensureMonth(currentKey());
  const findExpenseById = (id) => getMonthData().expenses.find(e => e.id === id);
  const isFavourited = (y,m,id) => !!favourites[compositeId(y,m,id)];

  /* ---------- Month pickers ---------- */
  (function initMonthYearPickers(){
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonthIndex = now.getMonth();

    if (monthSelect) {
      monthNames.forEach((n,i)=> monthSelect.appendChild(new Option(n, i)));
      monthSelect.value = currentMonthIndex;
      on(monthSelect, "change", () => { currentMonthIndex = +monthSelect.value; renderForCurrentMonth(); });
    }

    if (yearSelect) {
      for (let y = currentYear - 3; y <= currentYear + 3; y++) yearSelect.appendChild(new Option(y, y));
      yearSelect.value = currentYear;
      on(yearSelect, "change", () => { currentYear = +yearSelect.value; renderForCurrentMonth(); });
    }

    on(prevBtn, "click", () => {
      currentMonthIndex--; if (currentMonthIndex < 0){ currentMonthIndex = 11; currentYear--; if (yearSelect) yearSelect.value = currentYear; }
      if (monthSelect) monthSelect.value = currentMonthIndex;
      renderForCurrentMonth();
    });
    on(nextBtn, "click", () => {
      currentMonthIndex++; if (currentMonthIndex > 11){ currentMonthIndex = 0; currentYear++; if (yearSelect) yearSelect.value = currentYear; }
      if (monthSelect) monthSelect.value = currentMonthIndex;
      renderForCurrentMonth();
    });
  })();

  // Remove stray "Actions" thead if present
  (function stripActionsHeaderIfPresent(){
    const tr = submittedTable.querySelector("thead tr");
    if (!tr) return;
    [...tr.children].forEach(th => { if (th.textContent.trim().toLowerCase() === "actions") th.remove(); });
  })();

  /* ---------- Render ---------- */
  function updateAllowanceRemaining(){
    const data = getMonthData();
    const spent = Object.values(data.categoryTotals).reduce((a,b)=>a+b,0);
    allowanceRemainingDiv.textContent = `Allowance Remaining: ${((settings.allowance || 0) - spent).toFixed(2)}`;
  }

  function updatePieChart(){
    const d = getMonthData().categoryTotals;
    categoryChart.data.datasets[0].data = [d.Groceries, d.Social, d.Treat, d.Unexpected];
    categoryChart.update();
  }

  function renderForCurrentMonth(){
    const data = getMonthData();
    allowanceDisplay.textContent = `Allowance: ${(Number(settings.allowance)||0).toFixed(2)}`;

    submittedTableBody.innerHTML = data.expenses.map((e,idx)=>(
      `<tr data-row-id="${e.id}">
        <td>${idx+1}</td><td>${e.amount.toFixed(2)}</td><td>${e.category}</td><td>${e.card || "-"}</td>
      </tr>`
    )).join("");

    totalsDiv.innerHTML = `
      Groceries: ${data.categoryTotals.Groceries.toFixed(2)}<br>
      Social: ${data.categoryTotals.Social.toFixed(2)}<br>
      Treat: ${data.categoryTotals.Treat.toFixed(2)}<br>
      Unexpected: ${data.categoryTotals.Unexpected.toFixed(2)}
    `;

    updateAllowanceRemaining();
    updatePieChart();
    queueMicrotask(updateRails);
  }

  const updateRails = () => { positionEditDeleteDots(); positionFavStars(); };

  function eachRow(cb){
    const containerRect = tableWrap.getBoundingClientRect();
    [...submittedTableBody.querySelectorAll("tr")].forEach(tr => {
      const id = +tr.getAttribute("data-row-id");
      const r = tr.getBoundingClientRect();
      const top = r.top - containerRect.top + (r.height/2) - 8;
      cb({ id, top });
    });
  }

  function positionEditDeleteDots(){
    if (!deleteRail) return;
    deleteRail.innerHTML = "";
    eachRow(({id, top}) => {
      const edit = document.createElement("span");
      edit.className = "edit-mini"; edit.textContent = "e"; edit.dataset.id = String(id); edit.style.top = `${top}px`;
      const del = document.createElement("span");
      del.className = "delete-mini"; del.textContent = "d"; del.dataset.id = String(id); del.style.top = `${top}px`;
      deleteRail.appendChild(edit); deleteRail.appendChild(del);
    });
  }

  function positionFavStars(){
    if (!leftRail) return;
    leftRail.innerHTML = "";
    eachRow(({id, top}) => {
      const star = document.createElement("span");
      star.className = "fav-mini"; star.dataset.id = String(id); star.style.top = `${top}px`;
      const fav = isFavourited(currentYear, currentMonthIndex, id);
      star.textContent = fav ? "★" : "☆";
      if (fav) star.classList.add("filled");
      leftRail.appendChild(star);
    });
  }

  on(window, "resize", updateRails);

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
      data.categoryTotals[exp.category] = Math.max(0, (data.categoryTotals[exp.category] || 0) - (exp.amount || 0));
      data.expenses.splice(i,1);
      saveState();
      renderForCurrentMonth();
      if (favesOverlay.style.display === "flex") renderFavesModal();
    }
  });

  on(leftRail, "click", (evt) => {
    const star = evt.target.closest(".fav-mini"); if (!star) return;
    const id = +star.dataset.id;
    const data = getMonthData();
    const exp = data.expenses.find(e => e.id === id); if (!exp) return;

    const key = compositeId(currentYear, currentMonthIndex, id);
    if (favourites[key]) {
      delete favourites[key];
      saveFavourites();
      renderForCurrentMonth();
      if (favesOverlay.style.display === "flex") renderFavesModal();
      return;
    }
    openFavNameModal({
      key, year: currentYear, monthIndex: currentMonthIndex, id,
      amount: exp.amount, category: exp.category, card: exp.card || ""
    }, "");
  });

  /* ---------- Clear All ---------- */
  on(clearAllBtn, "click", () => {
    if (!confirm("Are you sure you want to delete all expenses for this month?")) return;
    const data = getMonthData();
    data.expenses = [];
    data.categoryTotals = { Groceries: 0, Social: 0, Treat: 0, Unexpected: 0 };
    data.purchaseCount = 0;
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
  const btnCoffee   = $("drinkCoffeeBtn");
  const btnOther    = $("drinkOtherBtn");

  const amountLabel = document.querySelector('label[for="modalExpenseAmount"]');
  const cardLabel   = document.querySelector('label[for="modalExpenseCard"]');

  function toggleFormFields(show){
    const disp = show ? "block" : "none";
    if (amountLabel) amountLabel.style.display = disp;
    if (modalAmount()) modalAmount().style.display = disp;
    if (modalCategoryWrapper()) modalCategoryWrapper().style.display = disp;
    if (cardLabel) cardLabel.style.display = disp;
    if (modalCard()) modalCard().style.display = disp;
    if (modalSubmit()) modalSubmit().style.display = show ? "inline-block" : "none";
  }

  let editingId = null;

  function openExpenseModal(expense = null, { hideCategory=false, quickDrinkOnly=false } = {}){
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

  function closeExpenseModal(){
    setDisplay(expenseOverlay, false);
    if (quickStage) quickStage.style.display = "none";
    toggleFormFields(true);
    if (modalCategoryWrapper()) modalCategoryWrapper().style.display = "block";
    editingId = null;
  }

  on(expenseOverlay, "click", (e)=>{ if (e.target === expenseOverlay) closeExpenseModal(); });
  on(document, "keydown", (e)=>{ if (expenseOverlay.style.display === "flex" && e.key === "Escape") closeExpenseModal(); });
  on(modalCancel(), "click", closeExpenseModal);

  on(modalSubmit(), "click", () => {
    try {
      const amount = parseFloat(modalAmount().value);
      const category = modalCat().value;
      const card = (modalCard() ? modalCard().value : "").trim();

      if (isNaN(amount) || amount <= 0) { alert("Please enter a valid amount."); modalAmount().focus(); return; }
      if (!CATEGORIES.has(category)) { alert("Please select a valid category."); modalCat().focus(); return; }
      if (!CARDS.has(card)) { alert("Please choose Credit or Debit."); modalCard().focus(); return; }

      const data = getMonthData();

      if (editingId !== null) {
        const idx = data.expenses.findIndex(e => e.id === editingId);
        if (idx !== -1) {
          const old = data.expenses[idx];
          data.categoryTotals[old.category] = Math.max(0, (data.categoryTotals[old.category] || 0) - (old.amount || 0));
          data.expenses[idx] = { ...old, amount, category, card };
          data.categoryTotals[category] = (data.categoryTotals[category] || 0) + amount;

          const key = compositeId(currentYear, currentMonthIndex, editingId);
          if (favourites[key]) {
            Object.assign(favourites[key], { amount, category, card });
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

  /* ---------- Openers ---------- */
  on(addBtn, "click", () => openExpenseModal({ category: "Groceries", card: "Credit", amount: "" }, { hideCategory:false, quickDrinkOnly:false }));
  on(addGroceriesBtn, "click", () => openExpenseModal({ category: "Groceries", card: "Credit", amount: "" }, { hideCategory:true, quickDrinkOnly:false }));
  on(addDrinkBtn, "click", () => openExpenseModal({ category: "Social", card: "Credit", amount: "" }, { hideCategory:true, quickDrinkOnly:true }));
  // Big Night Out → normal form like Add Groceries, but default Social
  on(bigNightBtn, "click", () => openExpenseModal({ category: "Social", card: "Credit", amount: "" }, { hideCategory:true, quickDrinkOnly:false }));

  /* ---------- Quick pick ---------- */
  const quickAdd = (amt) => {
    const data = getMonthData();
    data.purchaseCount += 1;
    data.expenses.push({ id: data.purchaseCount, amount: amt, category: "Social", card: "Credit" });
    data.categoryTotals.Social += amt;
    saveState(); renderForCurrentMonth(); closeExpenseModal();
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

  function openDetailsModal(text){ (detailsBody()).textContent = text || "No details."; setDisplay(detailsOverlay, true); }
  function closeDetailsModal(){ setDisplay(detailsOverlay, false); }
  on(detailsOverlay, "click", (e)=>{ if (e.target === detailsOverlay) closeDetailsModal(); });
  on(document, "keydown", (e)=>{ if (detailsOverlay.style.display === "flex" && e.key === "Escape") closeDetailsModal(); });
  on(detailsClose(), "click", closeDetailsModal);

  /* ---------- Allowance Modal ---------- */
  const allowanceOverlay = $("allowanceModalOverlay");
  const allowanceStage   = () => $("allowanceModalStage");
  const allowanceCancel  = () => $("allowanceModalCancelBtn");
  const allowanceBack    = () => $("allowanceModalBackBtn");
  const allowanceSubmit  = () => $("allowanceModalSubmitBtn");

  let allowanceFlow = { mode: null };

  const openAllowanceModal  = () => { showAllowanceChoice(); setDisplay(allowanceOverlay, true); };
  const closeAllowanceModal = () => { setDisplay(allowanceOverlay, false); allowanceFlow = { mode: null }; };

  function showAllowanceChoice(){
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

  function showAllowanceManual(){
    allowanceFlow.mode = "manual";
    allowanceBack().style.display = "inline-block";
    allowanceSubmit().style.display = "inline-block";
    allowanceSubmit().textContent = "Set Global Allowance";
    allowanceStage().innerHTML = `
      <label for="allowanceManualInput" style="font-size:14px; color:#333;">Allowance Amount</label>
      <input id="allowanceManualInput" type="number" step="0.01" min="0" placeholder="Enter amount"
             style="padding:8px; font-size:16px; width:100%; box-sizing:border-box;" />
    `;
    const inp = $("allowanceManualInput");
    inp.value = Number(settings.allowance || 0);
    inp.focus({ preventScroll:true });
    allowanceBack().onclick = showAllowanceChoice;
    allowanceSubmit().onclick = () => {
      const val = parseFloat(inp.value);
      if (isNaN(val) || val < 0) { alert("Please enter a valid allowance (0 or more)."); inp.focus(); return; }
      settings.allowance = val; saveSettings(); renderForCurrentMonth(); closeAllowanceModal();
    };
  }

  function showAllowanceCalc(){
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
      document.querySelectorAll('[data-allowance]').forEach(el => { vals[el.dataset.allowance] = parseFloat(el.value) || 0; });
      const income = vals["Income"];
      const costs = vals["Rent"] + vals["Car Payments"] + vals["Bills"] + vals["Ideal Savings"] + vals["Other"];
      settings.allowance = income - costs;
      saveSettings(); renderForCurrentMonth(); closeAllowanceModal();
    };
  }

  on(allowanceOverlay, "click", (e)=>{ if (e.target === allowanceOverlay) closeAllowanceModal(); });
  on(document, "keydown", (e)=>{ if (allowanceOverlay.style.display === "flex" && e.key === "Escape") closeAllowanceModal(); });
  on(allowanceCancel(), "click", closeAllowanceModal);
  on(setAllowanceBtn, "click", openAllowanceModal);

  /* ---------- Favourites Modal ---------- */
  const openFavesModal = () => { renderFavesModal(); setDisplay(favesOverlay, true); };
  const closeFavesModal = () => setDisplay(favesOverlay, false);

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

  function renderFavesModal(){
    const arr = Object.values(favourites);
    if (!arr.length) { favesList.innerHTML = `<p>No favourites yet.</p>`; return; }

    arr.sort((a,b) => (b.year - a.year) || (b.monthIndex - a.monthIndex) || ((b.id||0) - (a.id||0)));

    const rows = arr.map(f => {
      const key = `${yyyymmKey(f.year, f.monthIndex)}-${f.id}`;
      return `
        <tr data-key="${key}">
          <td class="fav-name">${escapeHtml(f.name || "Favourite")}</td>
          <td>${(f.amount || 0).toFixed(2)}</td>
          <td>${f.category}</td>
          <td>${f.card || "-"}</td>
          <td class="fav-actions">
            <button class="fave-add" type="button" data-key="${key}">Add</button>
            <span class="mini-inline delete-mini fav-delete" title="Delete" data-key="${key}">d</span>
          </td>
        </tr>`;
    }).join("");

    favesList.innerHTML = `
      <table>
        <thead>
          <tr><th>Name</th><th>Amount</th><th>Category</th><th>Card</th><th>Action</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  on(favesOverlay, "click", (e)=>{ if (e.target === favesOverlay) closeFavesModal(); });
  on(document, "keydown", (e)=>{ if (favesOverlay.style.display === "flex" && e.key === "Escape") closeFavesModal(); });
  on(favesCloseBtn, "click", closeFavesModal);
  on(showFavouritesBtn, "click", openFavesModal);

  on(favesList, "click", (e) => {
    const add = e.target.closest(".fave-add");
    if (add) {
      const fav = favourites[add.dataset.key]; if (!fav) return;
      const data = getMonthData();
      data.purchaseCount += 1;
      data.expenses.push({ id: data.purchaseCount, amount: fav.amount, category: fav.category, card: fav.card || "Credit" });
      data.categoryTotals[fav.category] = (data.categoryTotals[fav.category] || 0) + (fav.amount || 0);
      saveState(); renderForCurrentMonth();
      return;
    }
    const del = e.target.closest(".fav-delete");
    if (del) {
      const key = del.dataset.key; if (!favourites[key]) return;
      delete favourites[key]; saveFavourites();
      renderFavesModal(); renderForCurrentMonth(); // hollow stars
    }
  });

  /* ---------- Favourite Name Modal ---------- */
  let pendingFav = null;
  function openFavNameModal(snapshot, defaultName = ""){
    pendingFav = { ...snapshot, name: defaultName || "" };
    favNameInput.value = pendingFav.name;
    setDisplay(favNameOverlay, true);
    setTimeout(()=> favNameInput.focus(), 0);
  }
  function closeFavNameModal(){ setDisplay(favNameOverlay, false); pendingFav = null; }

  on(favNameOverlay, "click", (e)=>{ if (e.target === favNameOverlay) closeFavNameModal(); });
  on(document, "keydown", (e)=>{ if (favNameOverlay.style.display === "flex" && e.key === "Escape") closeFavNameModal(); });
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

  /* ---------- Initial render ---------- */
  renderForCurrentMonth();
});
