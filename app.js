(() => {
  "use strict";

  const STORAGE_KEY = "basel_ghanem_loan_simulator_v1";
  const EXPORT_VERSION = "1.1.0";
  const MAX_MONTHS = 900;
  const EPS = 0.000001;

  const defaultState = () => ({
    version: EXPORT_VERSION,
    profile: {
      ownerName: "Basel Ghanem",
      family: [
        { name: "Basel", relation: "أنت", birthDate: "1991-09-02" },
        { name: "الزوجة", relation: "الزوجة", birthDate: "1992-09-16" },
        { name: "موسى", relation: "الابن", birthDate: "2021-10-21" },
        { name: "ليلى", relation: "الابنة", birthDate: "2024-07-21" }
      ]
    },
    loan: {
      loanName: "قرض Basel الشخصي",
      assetPrice: 0,
      downPayment: 0,
      principal: 51000,
      startDate: "2026-06-01",
      firstPaymentDate: "2026-07-01",
      termMonths: 180,
      annualRate: 6.1,
      customInstallment: 433.13,
      installmentFee: 1.87,
      interestType: "fixed",
      paymentFrequency: "monthly",
      gracePeriod: 0,
      monthlyBudget: 0,
      loanNotes: "القسط الأساسي 433.13 د.أ ورسوم شهرية 1.87 د.أ، ليصبح الإجمالي 435 د.أ تقريباً."
    },
    ratePeriods: [],
    earlyPayments: [],
    scenarios: [],
    preferences: {
      accentColor: "#099999",
      themeMode: "light",
      layoutPreference: "balanced",
      reminderDay: 1,
      reminderNote: "راجع دفعة القرض الشهرية وتأكد من توفر الرصيد."
    },
    filters: {
      scheduleYear: "all",
      scheduleSearch: ""
    },
    exportHistory: [],
    amortizationSchedule: [],
    monthlyPaymentHistory: [],
    lastCalculationSnapshot: null,
    lastOpenedTab: "dashboard",
    updatedAt: new Date().toISOString()
  });

  let state = loadState();
  let derived = createEmptyDerived();
  let saveTimer = null;
  let confirmHandler = null;

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    applyPreferences();
    bindEvents();
    hydrateForms();
    setActiveTab(state.lastOpenedTab || "dashboard");
    recalculateAndRender();
  }

  function cacheElements() {
    const ids = [
      "appShell", "navTabs", "saveState", "welcomeTitle", "heroInsight", "remainingBalance", "progressRing",
      "completionPct", "payoffDate", "nextPaymentDate", "loanHealth", "kpiGrid", "balanceChart",
      "breakdownChart", "smartInsights", "familyCards", "timeline", "loanForm", "loanName", "assetPrice", "downPayment",
      "principal", "startDate", "firstPaymentDate", "termMonths", "termYears", "annualRate", "customInstallment", "installmentFee", "interestType", "paymentFrequency",
      "gracePeriod", "monthlyBudget", "loanNotes", "syncPrincipalBtn", "rateForm", "rateId", "rateStart",
      "rateEnd", "rateValue", "rateNote", "clearRateFormBtn", "rateImpact", "rateRows", "earlyPaymentForm",
      "paymentId", "paymentDate", "paymentAmount", "paymentMethod", "paymentRepeatType", "paymentRepeatMonths", "paymentNote", "clearPaymentFormBtn",
      "paymentImpact", "paymentRows", "impactChart", "yearFilter", "scheduleSearch", "exportCsvBtn",
      "scheduleRows", "whatIfForm", "extraMonthly", "oneTimeAmount", "oneTimeDate", "refinanceRate",
      "refinanceFees", "scenarioName", "saveScenarioBtn", "cloneScenarioBtn", "scenarioChart", "scenarioCards",
      "scenarioList", "accentColor", "themeMode", "layoutPreference", "reminderDay", "reminderNote",
      "exportJsonBtn", "importJsonInput", "integrityBtn", "integrityBox", "resetDataBtn", "toast",
      "confirmModal", "modalMessage", "modalConfirmBtn", "modalCancelBtn", "printReportBtn", "quickPaymentBtn", "fabWrap", "fabMenu", "fabMain"
    ];

    ids.forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    els.navTabs.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-tab]");
      if (!btn) return;
      setActiveTab(btn.dataset.tab);
      state.lastOpenedTab = btn.dataset.tab;
      autoSave();
    });

    els.loanForm.addEventListener("input", handleLoanInput);
    els.loanForm.addEventListener("change", handleLoanInput);

    els.termYears.addEventListener("input", () => {
      const years = num(els.termYears.value);
      if (years > 0) {
        state.loan.termMonths = Math.max(1, Math.round(years * 12));
        els.termMonths.value = state.loan.termMonths;
        autoSaveAndRecalc();
      }
    });

    els.syncPrincipalBtn.addEventListener("click", () => {
      const calculated = Math.max(0, num(state.loan.assetPrice) - num(state.loan.downPayment));
      state.loan.principal = calculated;
      els.principal.value = decimalInput(calculated);
      autoSaveAndRecalc();
      showToast("تم احتساب أصل القرض من السعر والدفعة الأولى.");
    });

    els.rateForm.addEventListener("submit", handleRateSubmit);
    els.clearRateFormBtn.addEventListener("click", clearRateForm);
    els.rateRows.addEventListener("click", handleRateTableAction);

    els.earlyPaymentForm.addEventListener("submit", handleEarlyPaymentSubmit);
    els.clearPaymentFormBtn.addEventListener("click", clearPaymentForm);
    els.paymentRows.addEventListener("click", handlePaymentTableAction);

    els.yearFilter.addEventListener("change", () => {
      state.filters.scheduleYear = els.yearFilter.value;
      autoSave();
      renderSchedule();
    });

    els.scheduleSearch.addEventListener("input", () => {
      state.filters.scheduleSearch = els.scheduleSearch.value.trim();
      autoSave();
      renderSchedule();
    });

    els.exportCsvBtn.addEventListener("click", exportScheduleCSV);
    els.printReportBtn.addEventListener("click", () => window.print());
    els.quickPaymentBtn.addEventListener("click", () => {
      setActiveTab("payments");
      els.paymentAmount.focus();
    });

    els.paymentRepeatType.addEventListener("change", () => {
      const repeated = els.paymentRepeatType.value === "monthly";
      els.paymentRepeatMonths.closest("label").style.display = repeated ? "grid" : "none";
    });

    bindFabActions();

    [els.extraMonthly, els.oneTimeAmount, els.oneTimeDate, els.refinanceRate, els.refinanceFees, els.scenarioName].forEach((el) => {
      el.addEventListener("input", renderScenarios);
      el.addEventListener("change", renderScenarios);
    });

    els.saveScenarioBtn.addEventListener("click", saveScenario);
    els.cloneScenarioBtn.addEventListener("click", cloneScenario);
    els.scenarioList.addEventListener("click", handleScenarioAction);

    [els.accentColor, els.themeMode, els.layoutPreference, els.reminderDay, els.reminderNote].forEach((el) => {
      el.addEventListener("input", handlePreferenceInput);
      el.addEventListener("change", handlePreferenceInput);
    });

    els.exportJsonBtn.addEventListener("click", exportJSONBackup);
    els.importJsonInput.addEventListener("change", importJSONBackup);
    els.integrityBtn.addEventListener("click", runIntegrityCheck);
    els.resetDataBtn.addEventListener("click", requestReset);

    els.modalCancelBtn.addEventListener("click", closeConfirm);
    els.modalConfirmBtn.addEventListener("click", () => {
      if (typeof confirmHandler === "function") confirmHandler();
      closeConfirm();
    });

    window.addEventListener("resize", debounce(() => {
      renderCharts();
    }, 160));
  }

  function handleLoanInput(event) {
    const key = event.target.id;
    if (!(key in state.loan)) return;

    if (["assetPrice", "downPayment", "principal", "annualRate", "gracePeriod", "monthlyBudget", "customInstallment", "installmentFee"].includes(key)) {
      state.loan[key] = num(event.target.value);
    } else if (key === "termMonths") {
      state.loan.termMonths = Math.max(1, Math.round(num(event.target.value)) || 1);
      els.termYears.value = decimalInput(state.loan.termMonths / 12, 2);
    } else {
      state.loan[key] = event.target.value;
    }

    autoSaveAndRecalc();
  }

  function handlePreferenceInput(event) {
    const key = event.target.id;
    if (!(key in state.preferences)) return;

    if (key === "reminderDay") {
      state.preferences[key] = clamp(Math.round(num(event.target.value)) || 1, 1, 28);
    } else {
      state.preferences[key] = event.target.value;
    }

    applyPreferences();
    autoSaveAndRecalc();
  }

  function handleRateSubmit(event) {
    event.preventDefault();
    const rate = {
      id: els.rateId.value || createId("rate"),
      startDate: els.rateStart.value,
      endDate: els.rateEnd.value,
      rate: num(els.rateValue.value),
      note: els.rateNote.value.trim()
    };

    const validation = validateRatePeriod(rate);
    if (!validation.ok) {
      showToast(validation.message);
      return;
    }

    const existingIndex = state.ratePeriods.findIndex((item) => item.id === rate.id);
    if (existingIndex >= 0) {
      state.ratePeriods[existingIndex] = rate;
    } else {
      state.ratePeriods.push(rate);
    }

    state.ratePeriods.sort((a, b) => dateValue(a.startDate) - dateValue(b.startDate));
    clearRateForm();
    autoSaveAndRecalc();
    showToast("تم حفظ فترة الفائدة وتحديث الحسابات.");
  }

  function handleRateTableAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    const item = state.ratePeriods.find((period) => period.id === id);
    if (!item) return;

    if (button.dataset.action === "edit") {
      els.rateId.value = item.id;
      els.rateStart.value = item.startDate;
      els.rateEnd.value = item.endDate;
      els.rateValue.value = decimalInput(item.rate);
      els.rateNote.value = item.note || "";
      els.rateStart.focus();
    }

    if (button.dataset.action === "delete") {
      openConfirm("سيتم حذف فترة الفائدة وإعادة احتساب الجدول فوراً.", () => {
        state.ratePeriods = state.ratePeriods.filter((period) => period.id !== id);
        autoSaveAndRecalc();
        showToast("تم حذف فترة الفائدة.");
      });
    }
  }

  function handleEarlyPaymentSubmit(event) {
    event.preventDefault();
    const existingPayment = state.earlyPayments.find((item) => item.id === els.paymentId.value);
    const payment = {
      id: els.paymentId.value || createId("payment"),
      date: els.paymentDate.value,
      amount: num(els.paymentAmount.value),
      method: els.paymentMethod.value,
      note: els.paymentNote.value.trim(),
      groupId: existingPayment?.groupId || null,
      occurrenceIndex: existingPayment?.occurrenceIndex || null,
      occurrenceCount: existingPayment?.occurrenceCount || null
    };

    const validation = validateEarlyPayment(payment);
    if (!validation.ok) {
      showToast(validation.message);
      return;
    }

    const isRecurringNew = !els.paymentId.value && els.paymentRepeatType?.value === "monthly";
    const repeatMonths = Math.max(1, Math.round(num(els.paymentRepeatMonths?.value)) || 1);

    if (isRecurringNew) {
      const groupId = createId("repeat");
      const generated = [];
      for (let i = 0; i < repeatMonths; i += 1) {
        generated.push({
          ...payment,
          id: createId("payment"),
          date: addMonths(payment.date, i),
          groupId,
          occurrenceIndex: i + 1,
          occurrenceCount: repeatMonths
        });
      }
      state.earlyPayments.push(...generated);
      state.earlyPayments.sort((a, b) => dateValue(a.date) - dateValue(b.date));
      clearPaymentForm();
      autoSaveAndRecalc();
      showToast(`تم إنشاء ${repeatMonths} دفعة متكررة بنجاح.`);
      return;
    }

    const existingIndex = state.earlyPayments.findIndex((item) => item.id === payment.id);
    if (existingIndex >= 0) {
      state.earlyPayments[existingIndex] = payment;
    } else {
      state.earlyPayments.push(payment);
    }

    state.earlyPayments.sort((a, b) => dateValue(a.date) - dateValue(b.date));
    clearPaymentForm();
    autoSaveAndRecalc();
    showToast("تمت إضافة الدفعة وتحديث أثرها فوراً.");
  }

  function handlePaymentTableAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    const item = state.earlyPayments.find((payment) => payment.id === id);
    if (!item) return;

    if (button.dataset.action === "edit") {
      els.paymentId.value = item.id;
      els.paymentDate.value = item.date;
      els.paymentAmount.value = decimalInput(item.amount);
      els.paymentMethod.value = item.method;
      if (els.paymentRepeatType) els.paymentRepeatType.value = "single";
      if (els.paymentRepeatMonths) els.paymentRepeatMonths.value = "";
      if (els.paymentRepeatMonths?.closest("label")) els.paymentRepeatMonths.closest("label").style.display = "none";
      els.paymentNote.value = item.note || "";
      els.paymentAmount.focus();
      if (item.groupId) showToast("أنت تعدل هذه الدفعة فقط من السلسلة المتكررة.");
    }

    if (button.dataset.action === "delete") {
      openConfirm("سيتم حذف الدفعة المبكرة وإعادة احتساب القرض.", () => {
        state.earlyPayments = state.earlyPayments.filter((payment) => payment.id !== id);
        autoSaveAndRecalc();
        showToast("تم حذف الدفعة المبكرة.");
      });
    }

    if (button.dataset.action === "deleteGroup") {
      const groupId = button.dataset.group;
      openConfirm("سيتم حذف جميع الدفعات التابعة لهذه السلسلة المتكررة.", () => {
        state.earlyPayments = state.earlyPayments.filter((payment) => payment.groupId !== groupId);
        autoSaveAndRecalc();
        showToast("تم حذف السلسلة المتكررة.");
      });
    }
  }

  function setActiveTab(tab) {
    const safeTab = document.querySelector(`[data-panel="${tab}"]`) ? tab : "dashboard";
    document.querySelectorAll(".nav-tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === safeTab));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === safeTab));
  }

  function hydrateForms() {
    Object.entries(state.loan).forEach(([key, value]) => {
      if (els[key]) els[key].value = value ?? "";
    });
    els.termYears.value = decimalInput(num(state.loan.termMonths) / 12, 2);

    Object.entries(state.preferences).forEach(([key, value]) => {
      if (els[key]) els[key].value = value ?? "";
    });

    els.oneTimeDate.value = addMonths(state.loan.firstPaymentDate || state.loan.startDate || todayISO(), 3);
    if (els.paymentRepeatMonths?.closest("label")) els.paymentRepeatMonths.closest("label").style.display = els.paymentRepeatType?.value === "monthly" ? "grid" : "none";
    els.refinanceRate.value = decimalInput(Math.max(0, num(state.loan.annualRate) - 1));
  }

  function clearRateForm() {
    els.rateId.value = "";
    els.rateStart.value = "";
    els.rateEnd.value = "";
    els.rateValue.value = "";
    els.rateNote.value = "";
  }

  function clearPaymentForm() {
    els.paymentId.value = "";
    els.paymentDate.value = "";
    els.paymentAmount.value = "";
    els.paymentMethod.value = "reduceTerm";
    if (els.paymentRepeatType) els.paymentRepeatType.value = "single";
    if (els.paymentRepeatMonths) els.paymentRepeatMonths.value = "";
    if (els.paymentRepeatMonths?.closest("label")) els.paymentRepeatMonths.closest("label").style.display = "none";
    els.paymentNote.value = "";
  }

  function recalculateAndRender() {
    derived = calculateDerived(state);
    state.amortizationSchedule = derived.current.schedule;
    state.monthlyPaymentHistory = derived.current.schedule.map((row) => ({
      number: row.number,
      date: row.date,
      installment: row.installment,
      installmentFee: row.installmentFee,
      installmentBase: row.installmentBase,
      principalPaid: row.principalPaid,
      interestPaid: row.interestPaid,
      earlyPayment: row.earlyPayment,
      endingBalance: row.endingBalance,
      rateUsed: row.rateUsed,
      notes: row.notes
    }));
    state.lastCalculationSnapshot = {
      calculatedAt: derived.generatedAt,
      remainingBalance: derived.current.remainingBalance,
      paymentAmount: derived.current.paymentAmount,
      totalInterest: derived.current.totalInterest,
      totalPaid: derived.current.totalPaid,
      payoffDate: derived.current.payoffDate,
      interestSaved: derived.interestSaved,
      monthsSaved: derived.monthsSaved
    };
    renderAll();
  }

  function calculateDerived(currentState) {
    const original = simulateLoan(currentState, {
      useRatePeriods: false,
      useEarlyPayments: false,
      extraMonthly: 0,
      oneTimePayment: null,
      refinance: null
    });

    const current = simulateLoan(currentState, {
      useRatePeriods: true,
      useEarlyPayments: true,
      extraMonthly: 0,
      oneTimePayment: null,
      refinance: null
    });

    const oneTimeAmount = num(els.oneTimeAmount?.value);
    const oneTimeDate = els.oneTimeDate?.value || addMonths(currentState.loan.firstPaymentDate || currentState.loan.startDate || todayISO(), 3);
    const refinanceRate = num(els.refinanceRate?.value);
    const refinanceFees = num(els.refinanceFees?.value);

    const whatIf = simulateLoan(currentState, {
      useRatePeriods: true,
      useEarlyPayments: true,
      extraMonthly: num(els.extraMonthly?.value),
      oneTimePayment: oneTimeAmount > 0 ? { date: oneTimeDate, amount: oneTimeAmount, method: "reduceTerm", note: "دفعة افتراضية" } : null,
      refinance: refinanceRate > 0 ? { rate: refinanceRate, fees: refinanceFees } : null
    });

    const interestSaved = original.totalInterest - current.totalInterest;
    const monthsSaved = original.monthsElapsed - current.monthsElapsed;
    const liveOriginal = getLiveSnapshot(original);
    const liveCurrent = getLiveSnapshot(current);
    const completion = liveCurrent.completion;
    const health = calculateHealthScore(currentState, current, original, interestSaved, monthsSaved);

    return {
      original,
      current,
      whatIf,
      interestSaved,
      monthsSaved,
      liveOriginal,
      liveCurrent,
      completion,
      health,
      generatedAt: new Date().toISOString()
    };
  }

  function simulateLoan(currentState, options = {}) {
    const loan = currentState.loan;
    const periodMonths = loan.paymentFrequency === "quarterly" ? 3 : 1;
    const principal = Math.max(0, num(loan.principal) || Math.max(0, num(loan.assetPrice) - num(loan.downPayment)));
    const startDate = validDate(loan.startDate) ? loan.startDate : todayISO();
    const paymentStartDate = validDate(loan.firstPaymentDate)
      ? loan.firstPaymentDate
      : addMonths(startDate, Math.max(1, periodMonths + Math.max(0, Math.round(num(loan.gracePeriod)) || 0) - 1));
    const termMonths = Math.max(1, Math.round(num(loan.termMonths)) || 1);
    const baseRate = Math.max(0, num(loan.annualRate));
    const feePerInstallment = Math.max(0, num(loan.installmentFee));
    const customInstallment = Math.max(0, num(loan.customInstallment));
    const startBalance = principal + (options.refinance?.fees || 0);
    const schedule = [];
    const earlyPaymentMap = buildEarlyPaymentMap(currentState, options);

    let balance = startBalance;
    let paymentAmount = 0;
    let totalInterest = 0;
    let totalPrincipal = 0;
    let totalEarly = 0;
    let totalFees = 0;
    let monthsElapsed = 0;
    let currentRate = options.refinance?.rate || baseRate;
    let currentPeriodPayment = customInstallment > 0 ? customInstallment : calculatePeriodicPayment(startBalance, currentRate, termMonths, periodMonths);
    let rateChangeCount = 0;
    let previousAppliedRate = null;

    if (principal <= EPS) {
      return summarizeSimulation({
        schedule,
        startingPrincipal: startBalance,
        paymentAmount: 0,
        totalInterest: 0,
        totalPrincipal: 0,
        totalEarly: 0,
        totalFees: 0,
        monthsElapsed: 0,
        payoffDate: paymentStartDate,
        nextPaymentDate: null,
        remainingBalance: 0,
        rateChangeCount,
        periodMonths
      });
    }

    for (let periodIndex = 1; periodIndex <= MAX_MONTHS && balance > EPS; periodIndex += 1) {
      const date = addMonths(paymentStartDate, (periodIndex - 1) * periodMonths);
      let rateUsed = options.refinance?.rate || getRateForDate(currentState, date, options.useRatePeriods, baseRate);
      rateUsed = Math.max(0, rateUsed);
      const rateChangedThisMonth = previousAppliedRate !== null && Math.abs(previousAppliedRate - rateUsed) > EPS;
      if (rateChangedThisMonth) rateChangeCount += 1;
      previousAppliedRate = rateUsed;
      currentRate = rateUsed;

      const monthlyRate = rateUsed / 100 / 12;
      const periodRate = periodMonths === 1 ? monthlyRate : Math.pow(1 + monthlyRate, periodMonths) - 1;
      const startingBalance = balance;
      const interest = startingBalance * periodRate;
      balance += interest;
      totalInterest += interest;

      const remainingMonthsForCalc = Math.max(1, termMonths - ((periodIndex - 1) * periodMonths));
      if (customInstallment <= 0) {
        currentPeriodPayment = calculatePeriodicPayment(balance, rateUsed, remainingMonthsForCalc, periodMonths);
      }

      let scheduledBase = customInstallment > 0 ? customInstallment : currentPeriodPayment;
      if (num(options.extraMonthly) > 0) {
        scheduledBase += num(options.extraMonthly) * (periodMonths === 3 ? 3 : 1);
      }
      scheduledBase = Math.min(balance, scheduledBase);
      const installmentFee = scheduledBase > 0 ? feePerInstallment : 0;
      const scheduledTotal = scheduledBase + installmentFee;
      const principalPaid = Math.max(0, scheduledBase - interest);
      balance -= scheduledBase;
      totalPrincipal += Math.min(principalPaid, startingBalance);
      totalFees += installmentFee;

      const notes = [];
      if (rateChangedThisMonth) notes.push(`تغيرت الفائدة إلى ${formatNumber(rateUsed, 2)}%`);

      const earlyPayments = earlyPaymentMap.get(monthKey(date)) || [];
      let earlyPaymentAmount = 0;

      earlyPayments.forEach((payment) => {
        if (balance <= EPS) return;
        const cappedAmount = Math.min(num(payment.amount), balance);
        earlyPaymentAmount += cappedAmount;
        balance -= cappedAmount;
        totalEarly += cappedAmount;
        const recurrenceNote = payment.groupId ? ` (متكرر ${payment.occurrenceIndex || 1}/${payment.occurrenceCount || "?"})` : "";
        notes.push(payment.note ? `دفعة مبكرة: ${payment.note}${recurrenceNote}` : `دفعة مبكرة${recurrenceNote}`);

        const remainingAfterEarly = Math.max(1, termMonths - (periodIndex * periodMonths));
        if (payment.method === "reduceInstallment") {
          currentPeriodPayment = calculatePeriodicPayment(balance, currentRate, remainingAfterEarly, periodMonths);
        }

        if (payment.method === "balanced") {
          const reducedPayment = calculatePeriodicPayment(balance, currentRate, remainingAfterEarly, periodMonths);
          currentPeriodPayment = (currentPeriodPayment + reducedPayment) / 2;
        }
      });

      if (balance < EPS) balance = 0;
      paymentAmount = customInstallment > 0 ? customInstallment : currentPeriodPayment;
      monthsElapsed = periodIndex * periodMonths;

      schedule.push({
        number: schedule.length + 1,
        date,
        startingBalance,
        installment: scheduledTotal,
        installmentBase: scheduledBase,
        installmentFee,
        principalPaid,
        interestPaid: interest,
        earlyPayment: earlyPaymentAmount,
        endingBalance: balance,
        rateUsed,
        notes: notes.join(" | "),
        hasEarlyPayment: earlyPaymentAmount > 0,
        hasRateChange: rateChangedThisMonth,
        dueThisMonth: true
      });
    }

    const lastRow = lastItem(schedule);
    const nextRow = schedule.find((row) => dateValue(row.date) >= dateValue(todayISO()) && row.endingBalance > EPS) || null;

    return summarizeSimulation({
      schedule,
      startingPrincipal: startBalance,
      paymentAmount,
      totalInterest,
      totalPrincipal,
      totalEarly,
      totalFees,
      monthsElapsed,
      payoffDate: lastRow?.date || paymentStartDate,
      nextPaymentDate: nextRow?.date || paymentStartDate,
      remainingBalance: lastRow?.endingBalance ?? startBalance,
      rateChangeCount,
      periodMonths
    });
  }

  function summarizeSimulation(result) {
    const totalInstallments = result.schedule.reduce((sum, row) => sum + row.installmentBase, 0);
    const totalFees = result.schedule.reduce((sum, row) => sum + row.installmentFee, 0);
    const totalPaid = totalInstallments + totalFees + result.totalEarly;
    const paidAmount = result.startingPrincipal - result.remainingBalance;
    return {
      ...result,
      totalInstallments,
      totalFees,
      totalPaid,
      paidAmount: Math.max(0, paidAmount),
      remainingMonths: Math.max(0, result.schedule.filter((row) => row.endingBalance > EPS).length),
      averageRate: averageRate(result.schedule),
      currentRate: getCurrentScheduleRate(result.schedule)
    };
  }

  function buildEarlyPaymentMap(currentState, options) {
    const payments = [];
    if (options.useEarlyPayments) {
      payments.push(...currentState.earlyPayments);
    }
    if (options.oneTimePayment) {
      payments.push(options.oneTimePayment);
    }

    const map = new Map();
    payments.forEach((payment) => {
      if (!validDate(payment.date) || num(payment.amount) <= 0) return;
      const key = monthKey(payment.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(payment);
    });
    return map;
  }

  function calculatePeriodicPayment(balance, annualRate, remainingMonths, periodMonths = 1) {
    const n = Math.max(1, Math.ceil(remainingMonths / periodMonths));
    const monthlyRate = Math.max(0, num(annualRate)) / 100 / 12;
    const periodRate = periodMonths === 1 ? monthlyRate : Math.pow(1 + monthlyRate, periodMonths) - 1;

    if (balance <= EPS) return 0;
    if (periodRate <= EPS) return balance / n;
    return balance * (periodRate * Math.pow(1 + periodRate, n)) / (Math.pow(1 + periodRate, n) - 1);
  }

  function remainingTermMonths(termMonths, gracePeriod, monthIndex) {
    const remaining = gracePeriod + termMonths - monthIndex;
    return Math.max(1, remaining);
  }

  function getRateForDate(currentState, isoDate, useRatePeriods, fallbackRate) {
    if (!useRatePeriods || currentState.loan.interestType !== "variable") return fallbackRate;
    const date = dateValue(isoDate);
    const period = currentState.ratePeriods.find((item) => {
      const start = dateValue(item.startDate);
      const end = dateValue(item.endDate || "2999-12-31");
      return date >= start && date <= end;
    });
    return period ? num(period.rate) : fallbackRate;
  }

  function renderAll() {
    renderDashboard();
    renderRates();
    renderPayments();
    renderScheduleFilters();
    renderSchedule();
    renderScenarios();
    renderCharts();
  }

  function renderDashboard() {
    const current = derived.current;
    const original = derived.original;
    const live = derived.liveCurrent;
    const interestSaved = derived.interestSaved;
    const monthsSaved = derived.monthsSaved;
    const completion = derived.completion;

    els.remainingBalance.textContent = money(live.remainingBalance);
    els.completionPct.textContent = `${formatNumber(completion, 0)}%`;
    setRingProgress(completion);

    els.payoffDate.textContent = `تاريخ الإغلاق الحالي: ${dateLabel(current.payoffDate)}`;
    els.nextPaymentDate.textContent = `الدفعة القادمة: ${live.nextPaymentDate ? dateLabel(live.nextPaymentDate) : "مكتمل"}`;
    els.loanHealth.textContent = `مؤشر الصحة: ${derived.health.label} (${derived.health.score}/100)`;

    const fullMonthly = (num(state.loan.customInstallment) || current.paymentAmount) + num(state.loan.installmentFee);
    const cards = [
      { label: "القسط الشهري الإجمالي", value: money(fullMonthly), hint: `${money(num(state.loan.customInstallment) || current.paymentAmount)} قسط + ${money(num(state.loan.installmentFee))} رسوم` },
      { label: "إجمالي الفائدة", value: money(current.totalInterest), hint: `الخطة الأصلية: ${money(original.totalInterest)}` },
      { label: "إجمالي الرسوم", value: money(current.totalFees), hint: `${money(num(state.loan.installmentFee))} على كل قسط` },
      { label: "المبلغ المدفوع حتى اليوم", value: money(live.totalPaid), hint: `يشمل الأقساط والدفعات المبكرة حتى ${dateLabel(todayISO())}` },
      { label: "الأشهر المتبقية", value: `${Math.max(0, live.remainingMonths)} شهر`, hint: `حتى ${dateLabel(current.payoffDate)}` },
      { label: "كان المفترض ينتهي", value: dateLabel(original.payoffDate), hint: `الخطة الأساسية بدون دفعات مبكرة` },
      { label: "صار ينتهي", value: dateLabel(current.payoffDate), hint: current.payoffDate !== original.payoffDate ? `تغيّر بفضل الدفعات والتحسينات` : `لم يتغير تاريخ الإغلاق بعد` },
      { label: interestSaved >= 0 ? "الفائدة الموفرة" : "زيادة الفائدة", value: money(Math.abs(interestSaved)), hint: interestSaved >= 0 ? "نتيجة تحسين الخطة" : "نتيجة تغيّر الخطة" },
      { label: monthsSaved >= 0 ? "الأشهر الموفرة" : "أشهر إضافية", value: `${Math.abs(Math.round(monthsSaved))} شهر`, hint: "مقارنة بالخطة الأصلية" },
      { label: "الفائدة الحالية", value: `${formatNumber(current.currentRate || num(state.loan.annualRate), 2)}%`, hint: state.loan.interestType === "variable" ? "قد تتغير حسب الفترة" : "ثابتة" }
    ];

    els.kpiGrid.innerHTML = cards.map((card, index) => `
      <article class="metric-card" style="animation-delay:${index * 35}ms">
        <p>${escapeHTML(card.label)}</p>
        <strong>${escapeHTML(String(card.value))}</strong>
        <small>${escapeHTML(card.hint)}</small>
      </article>
    `).join("");

    renderSmartInsights();
    renderFamilyCards();
    renderTimeline();
  }

  function renderSmartInsights() {
    const current = derived.current;
    const original = derived.original;
    const live = derived.liveCurrent;
    const interestSaved = derived.interestSaved;
    const monthsSaved = derived.monthsSaved;
    const highRate = state.ratePeriods.find((period) => num(period.rate) >= num(state.loan.annualRate) + 1.5);
    const monthlyBudget = num(state.loan.monthlyBudget);
    const budgetStatus = monthlyBudget > 0 && current.paymentAmount > monthlyBudget ? "أعلى من الميزانية المريحة" : "ضمن نطاق مقبول";
    const bestStrategy = recommendStrategy();

    const insights = [
      {
        title: "ملخص Basel التنفيذي",
        body: live.remainingBalance <= EPS
          ? "القرض مكتمل حسابياً حسب البيانات الحالية. احتفظ بنسخة JSON قبل أي تعديل كبير."
          : `الرصيد الحالي ${money(live.remainingBalance)}، والدفعة القادمة ${live.nextPaymentDate ? dateLabel(live.nextPaymentDate) : "مكتملة"}، وتاريخ الإغلاق ${dateLabel(current.payoffDate)}.`
      },
      {
        title: "أثر الخطة الحالية",
        body: interestSaved >= 0
          ? `الخطة الحالية توفر تقريباً ${money(interestSaved)} و ${Math.max(0, Math.round(monthsSaved))} شهر مقارنة بالخطة الأصلية.`
          : `الخطة الحالية تزيد التكلفة بحوالي ${money(Math.abs(interestSaved))}. راقب فترات الفائدة أو جرّب إعادة التمويل.`
      },
      {
        title: "أفضل توصية سداد",
        body: bestStrategy
      },
      {
        title: "تنبيه الفائدة",
        body: highRate ? `هناك فترة فائدة مرتفعة تبدأ في ${dateLabel(highRate.startDate)} بنسبة ${formatNumber(highRate.rate, 2)}%.` : "لا توجد فترة فائدة مرتفعة بشكل واضح مقارنة بالفائدة الأساسية."
      },
      {
        title: "أثر الميزانية الشهرية",
        body: monthlyBudget > 0 ? `القسط الحالي ${budgetStatus}. القسط يمثل ${formatNumber(safePercent(current.paymentAmount, monthlyBudget), 0)}% من الميزانية التي أدخلتها.` : "أدخل ميزانية شهرية مريحة للحصول على قراءة أدق لضغط القسط."
      }
    ];

    els.smartInsights.innerHTML = insights.map((item) => `
      <div class="smart-item">
        <strong>${escapeHTML(item.title)}</strong>
        <span>${escapeHTML(item.body)}</span>
      </div>
    `).join("");
  }

  function renderTimeline() {
    const items = [];
    if (state.loan.startDate) {
      items.push({ title: "بداية القرض", date: state.loan.startDate, body: `${state.loan.loanName || "قرض Basel"} بقيمة أصل ${money(derived.current.startingPrincipal)}.` });
    }
    if (derived.original.payoffDate) {
      items.push({ title: "كان المفترض إنهاء القرض", date: derived.original.payoffDate, body: `بدون دفعات مبكرة كان الإغلاق في ${dateLabel(derived.original.payoffDate)}.` });
    }
    state.ratePeriods.forEach((period) => {
      items.push({ title: "تغيير فائدة", date: period.startDate, body: `الفائدة أصبحت ${formatNumber(period.rate, 2)}% حتى ${dateLabel(period.endDate)}.` });
    });
    state.earlyPayments.forEach((payment) => {
      const recurrence = payment.groupId ? ` (متكرر ${payment.occurrenceIndex || 1}/${payment.occurrenceCount || "?"})` : "";
      items.push({ title: "دفعة مبكرة", date: payment.date, body: `${money(payment.amount)} — ${methodLabel(payment.method)}${recurrence}${payment.note ? ` — ${payment.note}` : ""}.` });
    });
    if (derived.current.payoffDate) {
      items.push({ title: "الإغلاق الحالي المتوقع", date: derived.current.payoffDate, body: `بعد الدفعات الحالية أصبح الإغلاق في ${dateLabel(derived.current.payoffDate)}.` });
    }

    items.sort((a, b) => dateValue(a.date) - dateValue(b.date));

    if (!items.length) {
      els.timeline.innerHTML = `<div class="smart-item"><strong>لا توجد أحداث بعد</strong><span>أدخل بيانات القرض أو أضف دفعة مبكرة لتظهر رحلة القرض.</span></div>`;
      return;
    }

    els.timeline.innerHTML = items.map((item, index) => `
      <div class="timeline-item" style="animation-delay:${index * 45}ms">
        <span class="timeline-node"></span>
        <div class="timeline-card">
          <strong>${escapeHTML(item.title)} — ${dateLabel(item.date)}</strong>
          <p>${escapeHTML(item.body)}</p>
        </div>
      </div>
    `).join("");
  }

  function renderFamilyCards() {
    if (!els.familyCards) return;
    const payoff = derived.current.payoffDate || derived.original.payoffDate || todayISO();
    const family = state.profile.family || [];
    if (!family.length) {
      els.familyCards.innerHTML = `<div class="smart-item"><strong>لا توجد بيانات عائلية</strong><span>ستظهر الأعمار هنا عند توفرها.</span></div>`;
      return;
    }
    els.familyCards.innerHTML = family.map((person) => {
      const age = ageOnDate(person.birthDate, payoff);
      return `
        <article class="family-card">
          <p>${escapeHTML(person.relation || "")}</p>
          <strong>${escapeHTML(person.name)}</strong>
          <span>${escapeHTML(age.text)}</span>
          <small>في ${dateLabel(payoff)} · تاريخ الميلاد ${dateLabel(person.birthDate)}</small>
        </article>
      `;
    }).join("");
  }

  function renderRates() {
    const base = derived.original;
    const current = derived.current;
    els.rateImpact.innerHTML = comparisonCards([
      { label: "الخطة الأصلية", value: money(base.totalInterest), hint: `${base.monthsElapsed} شهر` },
      { label: "بعد فترات الفائدة", value: money(current.totalInterest), hint: `${current.monthsElapsed} شهر` },
      { label: "فرق التكلفة", value: money(current.totalInterest - base.totalInterest), hint: current.totalInterest >= base.totalInterest ? "تكلفة إضافية" : "توفير" }
    ]);

    if (!state.ratePeriods.length) {
      els.rateRows.innerHTML = `<tr><td colspan="6">لا توجد فترات فائدة متغيرة. سيتم استخدام الفائدة الأساسية.</td></tr>`;
      return;
    }

    els.rateRows.innerHTML = state.ratePeriods.map((period) => {
      const delta = num(period.rate) - num(state.loan.annualRate);
      return `
        <tr>
          <td>${dateLabel(period.startDate)}</td>
          <td>${dateLabel(period.endDate)}</td>
          <td>${formatNumber(period.rate, 2)}%</td>
          <td>${delta >= 0 ? "+" : ""}${formatNumber(delta, 2)} نقطة</td>
          <td>${escapeHTML(period.note || "-")}</td>
          <td>
            <span class="row-actions">
              <button class="icon-btn" data-action="edit" data-id="${period.id}">تعديل</button>
              <button class="icon-btn" data-action="delete" data-id="${period.id}">حذف</button>
            </span>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderPayments() {
    const current = derived.current;
    const original = derived.original;
    els.paymentImpact.innerHTML = comparisonCards([
      { label: "الرصيد بعد الدفعات", value: money(derived.liveCurrent.remainingBalance), hint: "الرصيد الحالي بعد كل الدفعات" },
      { label: "الفائدة الموفرة", value: money(Math.max(0, derived.interestSaved)), hint: derived.interestSaved >= 0 ? "توفير فعلي" : "لا يوجد توفير" },
      { label: "الأشهر الموفرة", value: `${Math.max(0, Math.round(derived.monthsSaved))} شهر`, hint: `الأصلية ${original.monthsElapsed} شهر` }
    ]);

    if (!state.earlyPayments.length) {
      els.paymentRows.innerHTML = `<tr><td colspan="6">لا توجد دفعات مبكرة بعد.</td></tr>`;
      return;
    }

    els.paymentRows.innerHTML = state.earlyPayments.map((payment) => {
      const recurrence = payment.groupId ? `متكرر ${payment.occurrenceIndex || 1}/${payment.occurrenceCount || "?"}` : "دفعة فردية";
      return `
      <tr>
        <td>${dateLabel(payment.date)}</td>
        <td>${money(payment.amount)}</td>
        <td>${methodLabel(payment.method)}</td>
        <td>${estimatePaymentImpact(payment)}</td>
        <td>${escapeHTML((payment.note || "-") + ` · ${recurrence}`)}</td>
        <td>
          <span class="row-actions">
            <button class="icon-btn" data-action="edit" data-id="${payment.id}">تعديل</button>
            <button class="icon-btn" data-action="delete" data-id="${payment.id}">حذف</button>
            ${payment.groupId ? `<button class="icon-btn" data-action="deleteGroup" data-group="${payment.groupId}">حذف السلسلة</button>` : ""}
          </span>
        </td>
      </tr>`;
    }).join("");
  }

  function renderScheduleFilters() {
    const years = [...new Set(derived.current.schedule.map((row) => new Date(`${row.date}T00:00:00`).getFullYear()))];
    const selected = state.filters.scheduleYear || "all";
    els.yearFilter.innerHTML = `<option value="all">كل السنوات</option>${years.map((year) => `<option value="${year}">${year}</option>`).join("")}`;
    els.yearFilter.value = years.includes(Number(selected)) ? selected : "all";
    els.scheduleSearch.value = state.filters.scheduleSearch || "";
  }

  function renderSchedule() {
    const year = els.yearFilter.value || "all";
    const search = (els.scheduleSearch.value || "").trim().toLowerCase();
    let rows = derived.current.schedule;

    if (year !== "all") {
      rows = rows.filter((row) => String(new Date(`${row.date}T00:00:00`).getFullYear()) === year);
    }

    if (search) {
      rows = rows.filter((row) => `${row.date} ${row.notes}`.toLowerCase().includes(search));
    }

    if (!rows.length) {
      els.scheduleRows.innerHTML = `<tr><td colspan="10">لا توجد نتائج مطابقة.</td></tr>`;
      return;
    }

    els.scheduleRows.innerHTML = rows.map((row) => {
      const className = row.hasEarlyPayment ? "highlight-payment" : row.hasRateChange ? "highlight-rate" : "";
      return `
        <tr class="${className}">
          <td>${row.number}</td>
          <td>${dateLabel(row.date)}</td>
          <td>${money(row.startingBalance)}</td>
          <td>${money(row.installment)}</td>
          <td>${money(row.installmentFee)}</td>
          <td>${money(row.principalPaid)}</td>
          <td>${money(row.interestPaid)}</td>
          <td>${money(row.earlyPayment)}</td>
          <td>${money(row.endingBalance)}</td>
          <td>${formatNumber(row.rateUsed, 2)}%</td>
          <td>${escapeHTML(row.notes || "-")}</td>
        </tr>
      `;
    }).join("");
  }

  function renderScenarios() {
    const whatIf = simulateLoan(state, {
      useRatePeriods: true,
      useEarlyPayments: true,
      extraMonthly: num(els.extraMonthly?.value),
      oneTimePayment: num(els.oneTimeAmount?.value) > 0 ? {
        date: els.oneTimeDate?.value || addMonths(state.loan.startDate, 3),
        amount: num(els.oneTimeAmount?.value),
        method: "reduceTerm",
        note: "دفعة افتراضية"
      } : null,
      refinance: num(els.refinanceRate?.value) > 0 ? {
        rate: num(els.refinanceRate.value),
        fees: num(els.refinanceFees.value)
      } : null
    });

    els.scenarioCards.innerHTML = comparisonCards([
      { label: "الخطة الأصلية", value: money(derived.original.totalPaid), hint: `${derived.original.monthsElapsed} شهر` },
      { label: "الخطة الحالية", value: money(derived.current.totalPaid), hint: `${derived.current.monthsElapsed} شهر` },
      { label: "السيناريو الافتراضي", value: money(whatIf.totalPaid), hint: `${whatIf.monthsElapsed} شهر` }
    ]);

    if (!state.scenarios.length) {
      els.scenarioList.innerHTML = `<div class="smart-item"><strong>لا توجد سيناريوهات محفوظة</strong><span>جرّب دفعة إضافية أو إعادة تمويل ثم احفظ السيناريو.</span></div>`;
    } else {
      els.scenarioList.innerHTML = state.scenarios.map((scenario) => `
        <article class="scenario-item">
          <h4>${escapeHTML(scenario.name)}</h4>
          <p>إجمالي السداد: ${money(scenario.summary.totalPaid)} | الفائدة: ${money(scenario.summary.totalInterest)} | المدة: ${scenario.summary.monthsElapsed} شهر</p>
          <div class="row-actions">
            <button class="icon-btn" data-action="load" data-id="${scenario.id}">تحميل</button>
            <button class="icon-btn" data-action="delete" data-id="${scenario.id}">حذف</button>
          </div>
        </article>
      `).join("");
    }

    drawScenarioChart(whatIf);
  }

  function renderCharts() {
    drawBalanceChart();
    drawBreakdownChart();
    drawImpactChart();
    renderScenarios();
  }

  function drawBalanceChart() {
    const data = derived.current.schedule.filter((_, index) => index % Math.max(1, Math.ceil(derived.current.schedule.length / 12)) === 0);
    drawLineChart(els.balanceChart, data.map((row) => row.endingBalance), {
      label: "الرصيد",
      format: moneyShort,
      labels: data.map((row) => monthYearLabel(row.date))
    });
  }

  function drawBreakdownChart() {
    const rows = yearlyBuckets(derived.current.schedule);
    drawStackedBars(els.breakdownChart, rows.map((row) => ({ label: row.year, a: row.principal, b: row.interest })), {
      aLabel: "الأصل",
      bLabel: "الفائدة"
    });
  }

  function drawImpactChart() {
    const data = state.earlyPayments.map((payment) => ({ label: dateLabel(payment.date), value: num(payment.amount) }));
    drawBars(els.impactChart, data, { emptyText: "أضف دفعات مبكرة لعرض أثرها" });
  }

  function drawScenarioChart(whatIf) {
    const data = [
      { label: "الأصلية", value: derived.original.totalPaid },
      { label: "الحالية", value: derived.current.totalPaid },
      { label: "افتراضية", value: whatIf.totalPaid }
    ];
    drawBars(els.scenarioChart, data, { emptyText: "أدخل بيانات القرض لعرض المقارنة" });
  }

  function bindFabActions() {
    if (!els.fabMain || !els.fabMenu) return;
    els.fabMain.addEventListener("click", () => {
      const open = els.fabWrap.classList.toggle("open");
      els.fabMain.setAttribute("aria-expanded", open ? "true" : "false");
    });
    els.fabMenu.addEventListener("click", (event) => {
      const btn = event.target.closest("button");
      if (!btn) return;
      if (btn.dataset.fabTab) setActiveTab(btn.dataset.fabTab);
      if (btn.dataset.fabAction === "backup") exportJSONBackup();
      if (btn.dataset.fabAction === "print") window.print();
      els.fabWrap.classList.remove("open");
      els.fabMain.setAttribute("aria-expanded", "false");
    });
  }

  function drawLineChart(canvas, values, options = {}) {
    const ctx = prepareCanvas(canvas);
    if (!ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    clearCanvas(ctx, width, height);

    if (!values.length || Math.max(...values) <= 0) {
      drawEmpty(ctx, width, height, "لا توجد بيانات كافية للرسم");
      return;
    }

    const padX = 42;
    const padTop = 20;
    const padBottom = 26;
    const min = 0;
    const max = Math.max(...values);
    const range = Math.max(EPS, max - min);
    const plotHeight = height - padTop - padBottom;
    const plotWidth = width - padX * 2;

    ctx.strokeStyle = "rgba(120, 150, 155, 0.22)";
    ctx.fillStyle = getMutedColor();
    ctx.font = "11px Almarai, sans-serif";
    ctx.textAlign = "right";

    for (let i = 0; i <= 4; i += 1) {
      const y = padTop + (plotHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(width - padX, y);
      ctx.stroke();
      const value = max - ((max / 4) * i);
      ctx.fillText(options.format ? options.format(value) : formatNumber(value), width - 4, y + 4);
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = getAccent();
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = padX + (index / Math.max(1, values.length - 1)) * plotWidth;
      const y = height - padBottom - ((value - min) / range) * plotHeight;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, padTop, 0, height - padBottom);
    gradient.addColorStop(0, `rgba(${accentRGB().join(",")}, 0.22)`);
    gradient.addColorStop(1, `rgba(${accentRGB().join(",")}, 0.00)`);
    ctx.lineTo(width - padX, height - padBottom);
    ctx.lineTo(padX, height - padBottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.fillStyle = getMutedColor();
    ctx.font = "11px Almarai, sans-serif";
    ctx.textAlign = "center";
    const labels = options.labels || [];
    [0, Math.floor((labels.length - 1) / 2), labels.length - 1].forEach((idx) => {
      if (idx < 0 || !labels[idx]) return;
      const x = padX + (idx / Math.max(1, labels.length - 1)) * plotWidth;
      ctx.fillText(labels[idx], x, height - 6);
    });

    const lastX = padX + plotWidth;
    const lastY = height - padBottom - ((values[values.length - 1] - min) / range) * plotHeight;
    ctx.fillStyle = getAccent();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = getMutedColor();
    ctx.textAlign = "left";
    ctx.fillText(options.format ? options.format(values[values.length - 1]) : formatNumber(values[values.length - 1]), padX, 14);
  }

  function drawBars(canvas, data, options = {}) {
    const ctx = prepareCanvas(canvas);
    if (!ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    clearCanvas(ctx, width, height);

    const valid = data.filter((item) => num(item.value) > 0);
    if (!valid.length) {
      drawEmpty(ctx, width, height, options.emptyText || "لا توجد بيانات");
      return;
    }

    const pad = 34;
    const gap = 14;
    const max = Math.max(...valid.map((item) => item.value));
    const chartHeight = height - pad * 2;
    const barWidth = Math.max(26, (width - pad * 2 - gap * (valid.length - 1)) / valid.length);

    ctx.strokeStyle = "rgba(120, 150, 155, 0.22)";
    ctx.fillStyle = getMutedColor();
    ctx.font = "11px Almarai, sans-serif";
    for (let i = 0; i <= 4; i += 1) {
      const y = 12 + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(width - pad, y);
      ctx.stroke();
      const value = max - ((max / 4) * i);
      ctx.fillText(moneyShort(value), 8, y + 4);
    }

    valid.forEach((item, index) => {
      const x = pad + index * (barWidth + gap);
      const barHeight = (item.value / max) * chartHeight;
      const y = height - pad - barHeight;
      roundRect(ctx, x, y, barWidth, barHeight, 12);
      ctx.fillStyle = `rgba(${accentRGB().join(",")}, ${0.56 + index * 0.08})`;
      ctx.fill();
      ctx.fillStyle = getMutedColor();
      ctx.font = "10px Almarai, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(item.label).slice(0, 12), x + barWidth / 2, height - 10);
      ctx.fillText(moneyShort(item.value), x + barWidth / 2, Math.max(14, y - 6));
    });
  }

  function drawStackedBars(canvas, data, options = {}) {
    const ctx = prepareCanvas(canvas);
    if (!ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    clearCanvas(ctx, width, height);

    const valid = data.filter((item) => num(item.a) + num(item.b) > 0);
    if (!valid.length) {
      drawEmpty(ctx, width, height, "لا توجد بيانات كافية");
      return;
    }

    const pad = 34;
    const gap = 12;
    const max = Math.max(...valid.map((item) => item.a + item.b));
    const chartHeight = height - pad * 2;
    const barWidth = Math.max(24, (width - pad * 2 - gap * (valid.length - 1)) / valid.length);

    ctx.fillStyle = getMutedColor();
    ctx.font = "11px Almarai, sans-serif";
    ctx.fillText(`${options.aLabel || "A"} / ${options.bLabel || "B"}`, 8, 14);

    valid.forEach((item, index) => {
      const x = pad + index * (barWidth + gap);
      const total = item.a + item.b;
      const totalHeight = (total / max) * chartHeight;
      const aHeight = total <= 0 ? 0 : (item.a / total) * totalHeight;
      const bHeight = totalHeight - aHeight;
      const aY = height - pad - aHeight;
      const bY = aY - bHeight;

      ctx.fillStyle = `rgba(${accentRGB().join(",")}, 0.70)`;
      roundRect(ctx, x, aY, barWidth, aHeight, 10);
      ctx.fill();
      ctx.fillStyle = "rgba(183, 121, 31, 0.68)";
      roundRect(ctx, x, bY, barWidth, bHeight, 10);
      ctx.fill();

      ctx.fillStyle = getMutedColor();
      ctx.font = "10px Almarai, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(item.label), x + barWidth / 2, height - 10);
      ctx.fillText(moneyShort(total), x + barWidth / 2, Math.max(14, bY - 6));
    });
  }

  function prepareCanvas(canvas) {
    if (!canvas) return null;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(260, rect.width);
    const height = Number(canvas.getAttribute("height")) || 180;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
  }

  function clearCanvas(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
  }

  function drawEmpty(ctx, width, height, text) {
    ctx.fillStyle = getMutedColor();
    ctx.font = "14px Almarai, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, width / 2, height / 2);
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, Math.abs(height) / 2, width / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function saveScenario() {
    const summary = simulateLoan(state, {
      useRatePeriods: true,
      useEarlyPayments: true,
      extraMonthly: num(els.extraMonthly.value),
      oneTimePayment: num(els.oneTimeAmount.value) > 0 ? {
        date: els.oneTimeDate.value,
        amount: num(els.oneTimeAmount.value),
        method: "reduceTerm",
        note: "دفعة افتراضية"
      } : null,
      refinance: num(els.refinanceRate.value) > 0 ? {
        rate: num(els.refinanceRate.value),
        fees: num(els.refinanceFees.value)
      } : null
    });

    const scenario = {
      id: createId("scenario"),
      name: els.scenarioName.value.trim() || `سيناريو ${new Date().toLocaleDateString("ar-JO")}`,
      inputs: {
        extraMonthly: num(els.extraMonthly.value),
        oneTimeAmount: num(els.oneTimeAmount.value),
        oneTimeDate: els.oneTimeDate.value,
        refinanceRate: num(els.refinanceRate.value),
        refinanceFees: num(els.refinanceFees.value)
      },
      summary: pickSummary(summary),
      createdAt: new Date().toISOString()
    };

    state.scenarios.unshift(scenario);
    autoSaveAndRecalc();
    showToast("تم حفظ السيناريو محلياً.");
  }

  function cloneScenario() {
    els.scenarioName.value = `${state.loan.loanName || "قرض"} - نسخة مقارنة`;
    saveScenario();
  }

  function handleScenarioAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const scenario = state.scenarios.find((item) => item.id === button.dataset.id);
    if (!scenario) return;

    if (button.dataset.action === "load") {
      els.extraMonthly.value = decimalInput(scenario.inputs.extraMonthly);
      els.oneTimeAmount.value = decimalInput(scenario.inputs.oneTimeAmount);
      els.oneTimeDate.value = scenario.inputs.oneTimeDate || "";
      els.refinanceRate.value = decimalInput(scenario.inputs.refinanceRate);
      els.refinanceFees.value = decimalInput(scenario.inputs.refinanceFees);
      els.scenarioName.value = scenario.name;
      renderScenarios();
      showToast("تم تحميل مدخلات السيناريو.");
    }

    if (button.dataset.action === "delete") {
      openConfirm("سيتم حذف السيناريو المحفوظ محلياً.", () => {
        state.scenarios = state.scenarios.filter((item) => item.id !== scenario.id);
        autoSaveAndRecalc();
        showToast("تم حذف السيناريو.");
      });
    }
  }

  function runIntegrityCheck() {
    const issues = [];
    const loan = state.loan;

    if (num(loan.principal) <= 0) issues.push("أصل القرض غير مدخل أو يساوي صفر.");
    if (!validDate(loan.startDate)) issues.push("تاريخ بداية القرض غير صحيح.");
    if (!validDate(loan.firstPaymentDate)) issues.push("تاريخ أول قسط غير صحيح.");
    if (num(loan.termMonths) <= 0) issues.push("مدة القرض يجب أن تكون أكبر من صفر.");
    if (num(loan.downPayment) > num(loan.assetPrice) && num(loan.assetPrice) > 0) issues.push("الدفعة الأولى أكبر من سعر الأصل.");

    state.ratePeriods.forEach((period) => {
      const validation = validateRatePeriod(period, true);
      if (!validation.ok) issues.push(validation.message);
    });

    state.earlyPayments.forEach((payment) => {
      if (!validDate(payment.date)) issues.push(`دفعة بتاريخ غير صحيح: ${payment.note || payment.id}`);
      if (num(payment.amount) <= 0) issues.push(`دفعة مبكرة بقيمة غير صحيحة: ${payment.note || payment.id}`);
    });

    const message = issues.length ? issues.map((item) => `• ${item}`).join("<br>") : "تم الفحص: البيانات سليمة حسابياً ولا توجد تعارضات واضحة.";
    els.integrityBox.innerHTML = message;
    showToast(issues.length ? "تم العثور على ملاحظات في البيانات." : "البيانات سليمة.");
  }

  function requestReset() {
    openConfirm("تأكيد أول: سيتم مسح كل بيانات القرض والدفعات والتفضيلات من هذا المتصفح.", () => {
      openConfirm("تأكيد نهائي: لا يمكن التراجع إلا إذا كان لديك ملف JSON احتياطي. هل تريد المسح؟", () => {
        localStorage.removeItem(STORAGE_KEY);
        state = defaultState();
        hydrateForms();
        applyPreferences();
        recalculateAndRender();
        autoSave();
        showToast("تم مسح البيانات وإعادة التطبيق للوضع الافتراضي.");
      });
    });
  }

  function exportJSONBackup() {
    const payload = {
      ...state,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString()
    };
    downloadFile(`basel-loan-backup-${dateFileStamp()}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    state.exportHistory.unshift({ type: "json", date: new Date().toISOString() });
    autoSave();
    showToast("تم تصدير النسخة الاحتياطية JSON.");
  }

  function importJSONBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const imported = normalizeState(parsed);
        openConfirm("سيتم استبدال البيانات الحالية بالنسخة المستوردة. هل تريد المتابعة؟", () => {
          state = imported;
          saveStateNow();
          hydrateForms();
          applyPreferences();
          recalculateAndRender();
          showToast("تم استيراد البيانات بنجاح.");
        });
      } catch (error) {
        showToast("ملف JSON غير صالح.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function exportScheduleCSV() {
    const header = ["Payment Number", "Date", "Starting Balance", "Installment", "Installment Fee", "Principal Paid", "Interest Paid", "Early Payment", "Ending Balance", "Interest Rate", "Notes"];
    const rows = derived.current.schedule.map((row) => [
      row.number,
      row.date,
      fixed(row.startingBalance),
      fixed(row.installment),
      fixed(row.installmentFee),
      fixed(row.principalPaid),
      fixed(row.interestPaid),
      fixed(row.earlyPayment),
      fixed(row.endingBalance),
      fixed(row.rateUsed),
      row.notes || ""
    ]);
    const csv = toCSV([header, ...rows]);
    downloadFile(`basel-amortization-${dateFileStamp()}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
    state.exportHistory.unshift({ type: "csv", date: new Date().toISOString() });
    autoSave();
    showToast("تم تصدير جدول السداد بصيغة CSV متوافقة مع Excel.");
  }

  function validateRatePeriod(rate, ignoreSelf = false) {
    if (!validDate(rate.startDate)) return { ok: false, message: "أدخل تاريخ بداية صحيح لفترة الفائدة." };
    if (!validDate(rate.endDate)) return { ok: false, message: "أدخل تاريخ نهاية صحيح لفترة الفائدة." };
    if (dateValue(rate.endDate) < dateValue(rate.startDate)) return { ok: false, message: "تاريخ نهاية فترة الفائدة يجب أن يكون بعد البداية." };
    if (num(rate.rate) < 0) return { ok: false, message: "نسبة الفائدة لا يمكن أن تكون سالبة." };

    const overlap = state.ratePeriods.some((period) => {
      if (!ignoreSelf && period.id === rate.id) return false;
      if (ignoreSelf && period === rate) return false;
      const aStart = dateValue(rate.startDate);
      const aEnd = dateValue(rate.endDate);
      const bStart = dateValue(period.startDate);
      const bEnd = dateValue(period.endDate);
      return aStart <= bEnd && bStart <= aEnd;
    });

    if (overlap) return { ok: false, message: "لا يمكن حفظ فترات فائدة متداخلة." };
    return { ok: true, message: "" };
  }

  function validateEarlyPayment(payment) {
    if (!validDate(payment.date)) return { ok: false, message: "أدخل تاريخ دفعة صحيح." };
    if (num(payment.amount) <= 0) return { ok: false, message: "قيمة الدفعة يجب أن تكون أكبر من صفر." };
    const earliestDate = state.loan.startDate || state.loan.firstPaymentDate || todayISO();
    if (dateValue(payment.date) < dateValue(earliestDate)) return { ok: false, message: "لا يمكن تسجيل دفعة قبل بداية القرض." };

    const simulatedBefore = simulateLoan({ ...state, earlyPayments: state.earlyPayments.filter((item) => item.id !== payment.id) }, {
      useRatePeriods: true,
      useEarlyPayments: true
    });
    const row = simulatedBefore.schedule.find((item) => monthKey(item.date) >= monthKey(payment.date) && item.endingBalance > EPS) || lastItem(simulatedBefore.schedule);
    const maxAllowed = row ? Math.max(row.startingBalance, row.endingBalance) + EPS : simulatedBefore.remainingBalance + EPS;
    if (num(payment.amount) > maxAllowed && simulatedBefore.remainingBalance > EPS) {
      return { ok: false, message: "قيمة الدفعة أكبر من الرصيد المتبقي المتوقع. استخدم قيمة مساوية للرصيد للإغلاق النهائي." };
    }

    return { ok: true, message: "" };
  }

  function applyPreferences() {
    const color = state.preferences.accentColor || "#099999";
    const rgb = hexToRgb(color);
    document.documentElement.style.setProperty("--accent", color);
    document.documentElement.style.setProperty("--accent-rgb", rgb.join(", "));
    document.body.classList.toggle("dark", state.preferences.themeMode === "dark");
    els.appShell?.classList.remove("layout-balanced", "layout-compact", "layout-wide");
    els.appShell?.classList.add(`layout-${state.preferences.layoutPreference || "balanced"}`);
  }

  function autoSaveAndRecalc() {
    autoSave();
    recalculateAndRender();
  }

  function autoSave() {
    if (els.saveState) els.saveState.classList.add("saving");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveStateNow();
      if (els.saveState) els.saveState.classList.remove("saving");
    }, 220);
  }

  function saveStateNow() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      return defaultState();
    }
  }

  function normalizeState(input) {
    const base = defaultState();
    const merged = {
      ...base,
      ...input,
      profile: { ...base.profile, ...(input.profile || {}) },
      loan: { ...base.loan, ...(input.loan || {}) },
      preferences: { ...base.preferences, ...(input.preferences || {}) },
      filters: { ...base.filters, ...(input.filters || {}) },
      ratePeriods: Array.isArray(input.ratePeriods) ? input.ratePeriods : [],
      earlyPayments: Array.isArray(input.earlyPayments) ? input.earlyPayments : [],
      scenarios: Array.isArray(input.scenarios) ? input.scenarios : [],
      exportHistory: Array.isArray(input.exportHistory) ? input.exportHistory : [],
      amortizationSchedule: Array.isArray(input.amortizationSchedule) ? input.amortizationSchedule : [],
      monthlyPaymentHistory: Array.isArray(input.monthlyPaymentHistory) ? input.monthlyPaymentHistory : [],
      lastCalculationSnapshot: input.lastCalculationSnapshot || null
    };

    merged.loan.principal = num(merged.loan.principal);
    merged.loan.assetPrice = num(merged.loan.assetPrice);
    merged.loan.downPayment = num(merged.loan.downPayment);
    merged.loan.termMonths = Math.max(1, Math.round(num(merged.loan.termMonths)) || 1);
    merged.loan.annualRate = Math.max(0, num(merged.loan.annualRate));
    merged.loan.customInstallment = Math.max(0, num(merged.loan.customInstallment));
    merged.loan.installmentFee = Math.max(0, num(merged.loan.installmentFee));
    merged.loan.gracePeriod = Math.max(0, Math.round(num(merged.loan.gracePeriod)) || 0);
    if (!validDate(merged.loan.startDate)) merged.loan.startDate = "2026-06-01";
    if (!validDate(merged.loan.firstPaymentDate)) merged.loan.firstPaymentDate = "2026-07-01";
    if (merged.loan.principal <= 0) merged.loan.principal = 51000;
    if (merged.loan.annualRate <= 0) merged.loan.annualRate = 6.1;
    if (merged.loan.termMonths <= 1) merged.loan.termMonths = 180;
    if (merged.loan.customInstallment <= 0) merged.loan.customInstallment = 433.13;
    if (merged.loan.installmentFee < 0.01) merged.loan.installmentFee = 1.87;
    merged.preferences.reminderDay = clamp(Math.round(num(merged.preferences.reminderDay)) || 1, 1, 28);
    return merged;
  }

  function createEmptyDerived() {
    const empty = {
      schedule: [],
      startingPrincipal: 0,
      paymentAmount: 0,
      totalInterest: 0,
      totalPrincipal: 0,
      totalEarly: 0,
      monthsElapsed: 0,
      payoffDate: null,
      nextPaymentDate: null,
      remainingBalance: 0,
      totalPaid: 0,
      paidAmount: 0,
      remainingMonths: 0,
      averageRate: 0,
      currentRate: 0,
      rateChangeCount: 0
    };
    return {
      original: empty,
      current: empty,
      whatIf: empty,
      liveOriginal: { remainingBalance: 0, totalPaid: 0, totalFees: 0, totalInterestPaid: 0, principalPaid: 0, remainingMonths: 0, nextPaymentDate: null, completion: 0 },
      liveCurrent: { remainingBalance: 0, totalPaid: 0, totalFees: 0, totalInterestPaid: 0, principalPaid: 0, remainingMonths: 0, nextPaymentDate: null, completion: 0 },
      interestSaved: 0,
      monthsSaved: 0,
      completion: 0,
      health: { score: 0, label: "غير كافٍ" }
    };
  }

  function getLiveSnapshot(simulation) {
    const today = todayISO();
    const paidRows = simulation.schedule.filter((row) => dateValue(row.date) <= dateValue(today));
    const futureRows = simulation.schedule.filter((row) => dateValue(row.date) > dateValue(today) && row.endingBalance > EPS);
    const firstRow = simulation.schedule[0] || null;
    const lastPaid = lastItem(paidRows);
    const beforeFirstPayment = firstRow && dateValue(today) < dateValue(firstRow.date) && !lastPaid;
    const remainingBalance = beforeFirstPayment
      ? simulation.startingPrincipal
      : lastPaid
        ? lastPaid.endingBalance
        : simulation.remainingBalance;
    const totalPaid = paidRows.reduce((sum, row) => sum + row.installment + row.earlyPayment, 0);
    const totalFees = paidRows.reduce((sum, row) => sum + row.installmentFee, 0);
    const totalInterestPaid = paidRows.reduce((sum, row) => sum + row.interestPaid, 0);
    const principalPaid = paidRows.reduce((sum, row) => sum + row.principalPaid + row.earlyPayment, 0);
    const nextPaymentDate = futureRows[0]?.date || (remainingBalance <= EPS ? null : simulation.nextPaymentDate);
    return {
      remainingBalance: Math.max(0, remainingBalance),
      totalPaid,
      totalFees,
      totalInterestPaid,
      principalPaid,
      remainingMonths: futureRows.length,
      nextPaymentDate,
      completion: safePercent(principalPaid, simulation.startingPrincipal),
      currentRate: futureRows[0]?.rateUsed || lastPaid?.rateUsed || simulation.currentRate
    };
  }

  function ageOnDate(birthDate, targetDate) {
    if (!validDate(birthDate) || !validDate(targetDate)) return { years: 0, months: 0, text: "غير متاح" };
    const birth = new Date(`${birthDate}T00:00:00`);
    const target = new Date(`${targetDate}T00:00:00`);
    let years = target.getFullYear() - birth.getFullYear();
    let months = target.getMonth() - birth.getMonth();
    if (target.getDate() < birth.getDate()) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    years = Math.max(0, years);
    months = Math.max(0, months);
    return { years, months, text: `${years} سنة و ${months} شهر` };
  }

  function monthYearLabel(value) {
    if (!validDate(value)) return "";
    return new Intl.DateTimeFormat("ar-JO", { year: "2-digit", month: "2-digit" }).format(new Date(`${value}T00:00:00`));
  }

  function comparisonCards(cards) {
    return cards.map((card) => `
      <div class="comparison-card">
        <span>${escapeHTML(card.label)}</span>
        <strong>${escapeHTML(String(card.value))}</strong>
        <small>${escapeHTML(card.hint || "")}</small>
      </div>
    `).join("");
  }

  function pickSummary(simulation) {
    return {
      totalPaid: simulation.totalPaid,
      totalInterest: simulation.totalInterest,
      monthsElapsed: simulation.monthsElapsed,
      payoffDate: simulation.payoffDate,
      remainingBalance: simulation.remainingBalance
    };
  }

  function calculateHealthScore(currentState, current, original, interestSaved, monthsSaved) {
    if (current.startingPrincipal <= 0) return { score: 0, label: "غير كافٍ" };
    let score = 70;
    const interestRatio = safePercent(current.totalInterest, current.startingPrincipal);
    const budget = num(currentState.loan.monthlyBudget);
    const budgetRatio = budget > 0 ? safePercent(current.paymentAmount, budget) : 65;

    if (interestRatio < 20) score += 12;
    if (interestRatio > 45) score -= 15;
    if (interestSaved > 0) score += 8;
    if (budget > 0 && budgetRatio <= 75) score += 8;
    if (budget > 0 && budgetRatio > 100) score -= 15;
    if (monthsSaved > 0 || current.monthsElapsed < original.monthsElapsed) score += 7;
    if (currentState.ratePeriods.some((period) => num(period.rate) >= num(currentState.loan.annualRate) + 2)) score -= 8;

    score = clamp(Math.round(score), 0, 100);
    const label = score >= 85 ? "ممتاز" : score >= 70 ? "جيد" : score >= 50 ? "متوسط" : "بحاجة لمراجعة";
    return { score, label };
  }

  function recommendStrategy() {
    const payment = derived.current.paymentAmount;
    if (derived.current.startingPrincipal <= 0) return "ابدأ بإدخال أصل القرض والمدة والفائدة للحصول على توصية دقيقة.";
    if (state.ratePeriods.some((period) => num(period.rate) >= num(state.loan.annualRate) + 2)) {
      return "الأولوية الآن هي تقليل الرصيد قبل أو أثناء فترات الفائدة المرتفعة، لأن كل دينار إضافي هناك يقلل الفائدة المركبة لاحقاً.";
    }
    if (derived.interestSaved > 0 && derived.monthsSaved > 0) {
      return "استراتيجية تقليل المدة تعمل جيداً حالياً؛ استمر بالدفعات المبكرة عندما لا تضغط على السيولة.";
    }
    if (num(state.loan.monthlyBudget) > 0 && payment > num(state.loan.monthlyBudget)) {
      return "القسط أعلى من الميزانية المريحة؛ جرّب دفعة مبكرة بطريقة تقليل القسط أو سيناريو إعادة تمويل.";
    }
    return "أفضل مسار مبدئي هو توجيه أي فائض إلى دفعات مبكرة بطريقة تقليل المدة لأنها غالباً تحقق أعلى توفير فائدة.";
  }

  function estimatePaymentImpact(payment) {
    const withoutPaymentState = {
      ...state,
      earlyPayments: state.earlyPayments.filter((item) => item.id !== payment.id)
    };
    const without = simulateLoan(withoutPaymentState, { useRatePeriods: true, useEarlyPayments: true });
    const withPayment = simulateLoan(state, { useRatePeriods: true, useEarlyPayments: true });
    const saved = without.totalInterest - withPayment.totalInterest;
    const months = without.monthsElapsed - withPayment.monthsElapsed;
    return `${saved >= 0 ? "وفر" : "زاد"} ${money(Math.abs(saved))} / ${Math.max(0, Math.round(months))} شهر`;
  }

  function yearlyBuckets(schedule) {
    const map = new Map();
    schedule.forEach((row) => {
      const year = new Date(`${row.date}T00:00:00`).getFullYear();
      if (!map.has(year)) map.set(year, { year, principal: 0, interest: 0 });
      const item = map.get(year);
      item.principal += row.principalPaid + row.earlyPayment;
      item.interest += row.interestPaid;
    });
    return [...map.values()];
  }

  function averageRate(schedule) {
    if (!schedule.length) return 0;
    return schedule.reduce((sum, row) => sum + num(row.rateUsed), 0) / schedule.length;
  }

  function setRingProgress(percent) {
    const circle = els.progressRing.querySelector(".ring-fill");
    const circumference = 2 * Math.PI * 48;
    const offset = circumference - (clamp(percent, 0, 100) / 100) * circumference;
    circle.style.strokeDasharray = `${circumference}`;
    circle.style.strokeDashoffset = `${offset}`;
  }

  function openConfirm(message, onConfirm) {
    confirmHandler = onConfirm;
    els.modalMessage.textContent = message;
    els.confirmModal.hidden = false;
  }

  function closeConfirm() {
    els.confirmModal.hidden = true;
    confirmHandler = null;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2400);
  }

  function toCSV(rows) {
    return rows.map((row) => row.map((value) => {
      const text = String(value ?? "").replace(/"/g, '""');
      return `"${text}"`;
    }).join(",")).join("\n");
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function addMonths(isoDate, months) {
    const base = validDate(isoDate) ? new Date(`${isoDate}T00:00:00`) : new Date();
    const day = base.getDate();
    const result = new Date(base);
    result.setMonth(result.getMonth() + Number(months || 0));
    if (result.getDate() !== day) result.setDate(0);
    return result.toISOString().slice(0, 10);
  }

  function monthsBetween(startISO, endISO) {
    if (!validDate(startISO) || !validDate(endISO)) return 0;
    const start = new Date(`${startISO}T00:00:00`);
    const end = new Date(`${endISO}T00:00:00`);
    return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
  }

  function validDate(value) {
    if (!value || typeof value !== "string") return false;
    const date = new Date(`${value}T00:00:00`);
    return !Number.isNaN(date.getTime());
  }

  function dateValue(value) {
    if (!validDate(value)) return 0;
    return new Date(`${value}T00:00:00`).getTime();
  }

  function dateLabel(value) {
    if (!validDate(value)) return "غير محدد";
    return new Intl.DateTimeFormat("ar-JO", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(`${value}T00:00:00`));
  }

  function monthKey(value) {
    if (!validDate(value)) return "0000-00";
    return value.slice(0, 7);
  }

  function dateFileStamp() {
    return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }

  function money(value) {
    return `${formatNumber(value, 2)} د.أ`;
  }

  function moneyShort(value) {
    const v = num(value);
    if (Math.abs(v) >= 1000000) return `${formatNumber(v / 1000000, 1)}M`;
    if (Math.abs(v) >= 1000) return `${formatNumber(v / 1000, 1)}K`;
    return formatNumber(v, 0);
  }

  function formatNumber(value, digits = 2) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(num(value));
  }

  function decimalInput(value, digits = 2) {
    const number = num(value);
    if (!number) return "";
    return Number(number.toFixed(digits)).toString();
  }

  function fixed(value) {
    return num(value).toFixed(6);
  }

  function num(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/,/g, "").trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function sumBy(items, key) {
    return items.reduce((sum, item) => sum + num(item[key]), 0);
  }

  function safePercent(value, total) {
    return num(total) <= EPS ? 0 : clamp((num(value) / num(total)) * 100, 0, 999);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function methodLabel(method) {
    const labels = {
      reduceTerm: "تقليل مدة القرض",
      reduceInstallment: "تقليل القسط",
      balanced: "استراتيجية متوازنة"
    };
    return labels[method] || "غير محدد";
  }

  function getAccent() {
    return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#099999";
  }

  function getMutedColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#6f8588";
  }

  function accentRGB() {
    return hexToRgb(getAccent());
  }

  function hexToRgb(hex) {
    const safe = String(hex || "#099999").replace("#", "");
    const normalized = safe.length === 3 ? safe.split("").map((char) => `${char}${char}`).join("") : safe.padEnd(6, "0").slice(0, 6);
    return [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16) || 0);
  }


  function getCurrentScheduleRate(schedule) {
    for (let index = schedule.length - 1; index >= 0; index -= 1) {
      if (schedule[index].endingBalance > EPS) return schedule[index].rateUsed;
    }
    return lastItem(schedule)?.rateUsed ?? num(state.loan.annualRate);
  }

  function lastItem(items) {
    return Array.isArray(items) && items.length ? items[items.length - 1] : null;
  }

  function createId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }
})();
