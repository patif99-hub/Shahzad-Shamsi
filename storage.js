/* storage.js - LocalStorage backend for AutoLedger Pro (GitHub Pages)
   No Google Apps Script. All data stored in browser localStorage.

   Data model (in localStorage key "ALP_DB"):
   {
     cars: [],
     expenses: [],
     sales: [],
     payments: [],
     investors: []
   }
*/

(function () {
  const DB_KEY = "ALP_DB";

  function nowIso() {
    return new Date().toISOString();
  }

  function uuid(prefix) {
    return (
      (prefix || "ID") +
      "_" +
      Math.random().toString(16).slice(2) +
      "_" +
      Date.now().toString(16)
    );
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return { cars: [], expenses: [], sales: [], payments: [], investors: [] };
      const db = JSON.parse(raw);
      db.cars = Array.isArray(db.cars) ? db.cars : [];
      db.expenses = Array.isArray(db.expenses) ? db.expenses : [];
      db.sales = Array.isArray(db.sales) ? db.sales : [];
      db.payments = Array.isArray(db.payments) ? db.payments : [];
      db.investors = Array.isArray(db.investors) ? db.investors : [];
      return db;
    } catch (e) {
      return { cars: [], expenses: [], sales: [], payments: [], investors: [] };
    }
  }

  function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function n(v) {
    const x = Number(v || 0);
    return isNaN(x) ? 0 : x;
  }

  function inRange(dateStr, startStr, endStr) {
    // dateStr expected "YYYY-MM-DD"
    if (!dateStr) return false;
    const d = new Date(dateStr + "T00:00:00Z").getTime();
    if (startStr) {
      const s = new Date(startStr + "T00:00:00Z").getTime();
      if (d < s) return false;
    }
    if (endStr) {
      const e = new Date(endStr + "T23:59:59Z").getTime();
      if (d > e) return false;
    }
    return true;
  }

  function monthKey(dateStr) {
    if (!dateStr) return "";
    // YYYY-MM
    return String(dateStr).slice(0, 7);
  }

  function sum(arr, fn) {
    return (arr || []).reduce((a, x) => a + n(fn(x)), 0);
  }

  function getCarById(db, carId) {
    return db.cars.find((c) => c.CarID === carId);
  }

  function getSaleByCar(db, carId) {
    return db.sales.find((s) => s.CarID === carId);
  }

  function carDisplayName(car) {
    if (!car) return "";
    const name = car.CarName || car.Model || car.CarID;
    const reg = car.RegistrationNo || "";
    return reg ? `${name} (${reg})` : name;
  }

  function calcReceivableForCar(db, carId) {
    const sale = getSaleByCar(db, carId);
    if (!sale) return { received: 0, balance: 0, salePrice: 0, down: 0 };

    const salePrice = n(sale.SalePrice);
    const down = n(sale.DownPayment);
    const paid = sum(db.payments.filter((p) => p.CarID === carId), (p) => p.Amount);
    const received = (sale.SaleType === "Installment") ? (down + paid) : salePrice;
    const balance = Math.max(0, salePrice - received);
    return { received, balance, salePrice, down };
  }

  /* ---------------- API (Promise based) ---------------- */

  const api = {
    /* Utility */
    _resetAll() {
      saveDB({ cars: [], expenses: [], sales: [], payments: [], investors: [] });
      return Promise.resolve({ ok: true });
    },

    /* Cars */
    getCarList() {
      const db = loadDB();
      const list = db.cars
        .slice()
        .sort((a, b) => String(a.CarName || "").localeCompare(String(b.CarName || "")));
      return Promise.resolve(list);
    },

    getCarsForDropdown({ onlyAvailable } = {}) {
      const db = loadDB();
      let cars = db.cars.slice();
      if (onlyAvailable) cars = cars.filter((c) => (c.Status || "Available") === "Available");
      return Promise.resolve({ ok: true, cars });
    },

    getAvailableCarsFromCarList() {
      const db = loadDB();
      const cars = db.cars.filter((c) => (c.Status || "Available") === "Available");
      return Promise.resolve({ ok: true, cars });
    },

    addCar(carObj) {
      const db = loadDB();
      const CarID = uuid("CAR");

      const purchaseAmount = n(carObj.purchaseAmount);

      const ownerPercent = n(carObj.ownerPercent);
      const raheemPercent = n(carObj.raheemPercent);

      const ownerAmount = n(carObj.ownerAmount);
      const raheemAmount = n(carObj.raheemAmount);

      const otherInvestors = Array.isArray(carObj.otherInvestors) ? carObj.otherInvestors : [];

      const car = {
        CarID,
        CarName: (carObj.carName || "").trim(),
        Make: (carObj.make || "").trim(),
        Model: (carObj.model || "").trim(),
        ChassisNo: (carObj.chassisNo || "").trim(),
        EngineNo: (carObj.engineNo || "").trim(),
        RegistrationNo: (carObj.regNo || "").trim(),
        Color: (carObj.color || "").trim(),
        PurchaseDate: (carObj.purchaseDate || "").trim(),
        PurchasedFrom: [
          (carObj.purchaseFromName || "").trim(),
          (carObj.purchaseFromContact || "").trim()
        ].filter(Boolean).join(" | "),
        PurchaseAmount: purchaseAmount,

        // Investments
        OwnerPercent: ownerPercent,
        PartnerPercent: raheemPercent,
        OwnerAmount: ownerAmount,
        PartnerAmount: raheemAmount,
        OtherInvestors: otherInvestors.map(x => ({
          InvestorName: (x.InvestorName || x.InvestorName || "").trim(),
          SharePercent: n(x.SharePercent),
          Amount: n(x.Amount)
        })),

        Status: "Available",
        CreatedAt: nowIso()
      };

      db.cars.push(car);
      saveDB(db);
      return Promise.resolve({ status: "OK", message: "Car saved ✅", CarID });
    },

    /* Investors */
    addInvestor(invObj) {
      const db = loadDB();
      const InvestorID = uuid("INV");
      db.investors.push({
        InvestorID,
        Name: (invObj.Name || "").trim(),
        Phone: (invObj.Phone || "").trim(),
        TotalInvestment: n(invObj.TotalInvestment),
        CreatedAt: nowIso()
      });
      saveDB(db);
      return Promise.resolve({ ok: true, message: "Investor saved ✅", InvestorID });
    },

    /* Expenses */
    addExpense({ carId, date, category, detail, amount, paidBy, description, proofLink }) {
      const db = loadDB();
      const ExpenseID = uuid("EXP");
      db.expenses.push({
        ExpenseID,
        CarID: carId,
        ExpenseDate: date,
        ExpenseCategory: (category || "").trim(),
        ExpenseName: (detail || "").trim(),
        Amount: n(amount),
        PaidBy: (paidBy || "").trim(),
        Description: (description || "").trim(),
        ProofLink: (proofLink || "").trim(),
        CreatedAt: nowIso()
      });
      saveDB(db);
      return Promise.resolve({ status: "OK", message: "Expense saved ✅", ExpenseID });
    },

    /* Sales */
    addNewSale(saleObj) {
      const db = loadDB();
      const car = getCarById(db, saleObj.CarID);
      if (!car) return Promise.resolve({ status: "ERR", message: "Car not found" });

      if ((car.Status || "Available") !== "Available") {
        return Promise.resolve({ status: "ERR", message: "Car already sold / not available" });
      }

      const SaleID = uuid("SALE");

      const sale = {
        SaleID,
        CarID: saleObj.CarID,
        BuyerName: (saleObj.BuyerName || "").trim(),
        BuyerContact: (saleObj.BuyerContact || "").trim(),
        SaleDate: (saleObj.SaleDate || "").trim(),
        SalePrice: n(saleObj.SalePrice),
        PaymentMethod: (saleObj.PaymentMethod || "").trim(),

        SaleType: (saleObj.SaleType || "Full"),
        DownPayment: n(saleObj.DownPayment),
        ReceivedAmount: n(saleObj.ReceivedAmount),
        InstallmentCount: n(saleObj.InstallmentCount),
        InstallmentAmount: n(saleObj.InstallmentAmount),
        InstallmentStartDate: (saleObj.InstallmentStartDate || "").trim(),
        Notes: (saleObj.Notes || "").trim(),

        CreatedAt: nowIso()
      };

      db.sales.push(sale);

      // mark car sold
      car.Status = "Sold";
      car.SoldAt = nowIso();

      saveDB(db);
      return Promise.resolve({ status: "OK", message: "Sale recorded ✅", SaleID });
    },

    /* Payments (installment receipts) */
    getReceivableCars() {
      const db = loadDB();
      const items = [];

      db.cars.forEach((car) => {
        const sale = getSaleByCar(db, car.CarID);
        if (!sale) return;
        if ((sale.SaleType || "") !== "Installment") return;

        const rc = calcReceivableForCar(db, car.CarID);
        if (rc.balance <= 0) return;

        items.push({
          CarID: car.CarID,
          CarName: car.CarName || car.Model || car.CarID,
          RegistrationNo: car.RegistrationNo || "",
          BuyerName: sale.BuyerName || "",
          SalePrice: rc.salePrice,
          Received: rc.received,
          Balance: rc.balance
        });
      });

      return Promise.resolve({ ok: true, items });
    },

    addInstallmentPayment(payload) {
      const db = loadDB();
      const carId = payload.CarID;
      const sale = getSaleByCar(db, carId);
      if (!sale) return Promise.resolve({ ok: false, message: "Sale not found for this car" });
      if ((sale.SaleType || "") !== "Installment") {
        return Promise.resolve({ ok: false, message: "This car is not on installment" });
      }

      const rc = calcReceivableForCar(db, carId);
      const amt = n(payload.Amount);
      if (amt <= 0) return Promise.resolve({ ok: false, message: "Amount must be > 0" });
      if (amt > rc.balance + 0.0001) {
        return Promise.resolve({ ok: false, message: "Amount cannot exceed balance" });
      }

      const PayID = uuid("PAY");
      db.payments.push({
        PayID,
        CarID: carId,
        PayDate: (payload.PayDate || "").trim(),
        Amount: amt,
        Method: (payload.Method || "").trim(),
        RefNo: (payload.RefNo || "").trim(),
        Notes: (payload.Notes || "").trim(),
        CreatedAt: nowIso()
      });

      saveDB(db);

      const rc2 = calcReceivableForCar(db, carId);
      return Promise.resolve({ ok: true, message: "Payment saved ✅", balance: rc2.balance });
    },

    /* Ledger */
    getCustomerLedger({ carId }) {
      const db = loadDB();
      const car = getCarById(db, carId);
      if (!car) return Promise.resolve({ ok: false, message: "Car not found" });

      const sale = getSaleByCar(db, carId);
      if (!sale) return Promise.resolve({ ok: false, message: "Sale not found" });

      const payments = db.payments
        .filter((p) => p.CarID === carId)
        .slice()
        .sort((a, b) => String(a.PayDate).localeCompare(String(b.PayDate)));

      const paidTotal = sum(payments, (p) => p.Amount);
      const salePrice = n(sale.SalePrice);
      const down = n(sale.DownPayment);
      const received = down + paidTotal;
      const balance = Math.max(0, salePrice - received);

      return Promise.resolve({
        ok: true,
        car,
        sale,
        payments,
        totals: {
          salePrice,
          downPayment: down,
          paymentsTotal: paidTotal,
          received,
          balance,
          installmentCount: n(sale.InstallmentCount),
          installmentAmount: n(sale.InstallmentAmount)
        }
      });
    },

    /* Dashboard */
    getDashboardData(filter = {}) {
      const db = loadDB();
      const carId = filter.carId || "";
      const status = filter.status || "";
      const startDate = filter.startDate || "";
      const endDate = filter.endDate || "";
      const horizonMonths = n(filter.horizonMonths || 3);
      const lookbackMonths = n(filter.lookbackMonths || 12);

      // base car list
      let cars = db.cars.slice();
      if (carId) cars = cars.filter((c) => c.CarID === carId);
      if (status) cars = cars.filter((c) => (c.Status || "Available") === status);

      // expenses in range
      let expenses = db.expenses.slice();
      if (carId) expenses = expenses.filter((e) => e.CarID === carId);
      if (startDate || endDate) expenses = expenses.filter((e) => inRange(e.ExpenseDate, startDate, endDate));

      // sales in range
      let sales = db.sales.slice();
      if (carId) sales = sales.filter((s) => s.CarID === carId);
      if (startDate || endDate) sales = sales.filter((s) => inRange(s.SaleDate, startDate, endDate));

      const soldCars = db.cars.filter((c) => (c.Status || "Available") === "Sold");
      const availableCars = db.cars.filter((c) => (c.Status || "Available") === "Available");

      // total expenses
      const totalExpenses = sum(expenses, (e) => e.Amount);

      // total profit (sold cars): sale - purchase - expenses
      let totalProfit = 0;
      let totalInstallmentReceived = 0;
      let totalReceivable = 0;

      // breakdown maps
      const expenseByCategory = {};
      const expenseByPaidBy = {};
      expenses.forEach((e) => {
        const cat = e.ExpenseCategory || "Other";
        expenseByCategory[cat] = n(expenseByCategory[cat]) + n(e.Amount);
        const pb = e.PaidBy || "Unknown";
        expenseByPaidBy[pb] = n(expenseByPaidBy[pb]) + n(e.Amount);
      });

      // compute per sold car profit
      sales.forEach((s) => {
        const car = getCarById(db, s.CarID);
        if (!car) return;

        const carExp = db.expenses.filter((e) => e.CarID === s.CarID);
        const expSum = sum(carExp, (e) => e.Amount);

        const salePrice = n(s.SalePrice);
        const purchase = n(car.PurchaseAmount);

        // net profit by car:
        const net = salePrice - purchase - expSum;
        totalProfit += net;

        // installment KPIs
        if ((s.SaleType || "") === "Installment") {
          const rc = calcReceivableForCar(db, s.CarID);
          totalInstallmentReceived += rc.received;
          totalReceivable += rc.balance;
        }
      });

      // trend (month wise): revenue & expenses from lookback months
      const monthMap = {}; // { 'YYYY-MM': {Revenue, Expenses, Sales} }
      function ensureMonth(m) {
        if (!m) return;
        if (!monthMap[m]) monthMap[m] = { Month: m, Revenue: 0, Expenses: 0, Profit: 0, Sales: 0 };
      }

      // fill from sales (revenue) and expenses
      sales.forEach((s) => {
        const m = monthKey(s.SaleDate);
        ensureMonth(m);
        monthMap[m].Revenue += n(s.SalePrice);
        monthMap[m].Sales += 1;
      });
      expenses.forEach((e) => {
        const m = monthKey(e.ExpenseDate);
        ensureMonth(m);
        monthMap[m].Expenses += n(e.Amount);
      });

      Object.values(monthMap).forEach((row) => {
        row.Profit = n(row.Revenue) - n(row.Expenses); // Operating Profit
      });

      // build sorted periodRows
      const periodRows = Object.values(monthMap).sort((a, b) => String(a.Month).localeCompare(String(b.Month)));

      // avg monthly income (operating profit average)
      const avgMonthlyIncome = periodRows.length
        ? (sum(periodRows, (r) => r.Profit) / periodRows.length)
        : 0;

      // simple forecast = last profit repeated
      const lastProfit = periodRows.length ? n(periodRows[periodRows.length - 1].Profit) : 0;
      const forecastRows = [];
      if (horizonMonths > 0 && periodRows.length) {
        const lastMonth = periodRows[periodRows.length - 1].Month; // YYYY-MM
        const [yy, mm] = lastMonth.split("-").map((x) => parseInt(x, 10));
        for (let i = 1; i <= horizonMonths; i++) {
          const d = new Date(Date.UTC(yy, (mm - 1) + i, 1));
          const m = d.toISOString().slice(0, 7);
          forecastRows.push({ Month: m, ForecastProfit: lastProfit });
        }
      }

      // receivables list for dashboard table
      const receivables = [];
      db.cars.forEach((car) => {
        if (carId && car.CarID !== carId) return;
        const sale = getSaleByCar(db, car.CarID);
        if (!sale) return;
        if ((sale.SaleType || "") !== "Installment") return;
        const rc = calcReceivableForCar(db, car.CarID);
        if (rc.balance <= 0) return;

        receivables.push({
          CarID: car.CarID,
          CarName: car.CarName || car.Model || car.CarID,
          RegistrationNo: car.RegistrationNo || "",
          BuyerName: sale.BuyerName || "",
          SalePrice: rc.salePrice,
          Received: rc.received,
          Balance: rc.balance
        });
      });

      // counts based on filtered cars? Your UI shows global counts usually
      const totalCarsCount = cars.length || db.cars.length;

      const result = {
        ok: true,
        summary: {
          totalCars: totalCarsCount,
          soldCars: soldCars.length,
          availableCars: availableCars.length,
          totalExpenses,
          totalProfit,
          avgMonthlyIncome,
          totalInstallmentReceived,
          totalReceivable
        },
        breakdown: {
          expenseByCategory,
          expenseByPaidBy
        },
        receivables,
        trend: { periodRows, forecastRows }
      };

      return Promise.resolve(result);
    },

    /* Reports */
    getReportsData(filter = {}) {
      const db = loadDB();
      const carId = filter.carId || "";
      const startDate = filter.startDate || "";
      const endDate = filter.endDate || "";

      // cars filter
      let cars = db.cars.slice();
      if (carId) cars = cars.filter((c) => c.CarID === carId);

      // expenses filter
      let expenses = db.expenses.slice();
      if (carId) expenses = expenses.filter((e) => e.CarID === carId);
      if (startDate || endDate) expenses = expenses.filter((e) => inRange(e.ExpenseDate, startDate, endDate));

      // sales filter
      let sales = db.sales.slice();
      if (carId) sales = sales.filter((s) => s.CarID === carId);
      if (startDate || endDate) sales = sales.filter((s) => inRange(s.SaleDate, startDate, endDate));

      // summary
      const totalCars = db.cars.length;
      const soldCars = db.cars.filter((c) => (c.Status || "Available") === "Sold").length;
      const availableCars = db.cars.filter((c) => (c.Status || "Available") === "Available").length;

      // investments summary
      const ownerInvestment = sum(db.cars, (c) => c.OwnerAmount);
      const partnerInvestment = sum(db.cars, (c) => c.PartnerAmount);
      const totalInvestment = ownerInvestment + partnerInvestment; // (simple)

      // total expenses
      const totalExpenses = sum(expenses, (e) => e.Amount);

      // carWise rows
      const carWise = cars.map((car) => {
        const sale = getSaleByCar(db, car.CarID);
        const salePrice = sale ? n(sale.SalePrice) : 0;

        const carExp = db.expenses.filter((e) => e.CarID === car.CarID);
        const expSum = sum(carExp, (e) => e.Amount);

        const purchase = n(car.PurchaseAmount);
        const netProfit = sale ? (salePrice - purchase - expSum) : 0;

        return {
          CarID: car.CarID,
          CarName: car.CarName || car.Model || car.CarID,
          PurchaseAmount: purchase,
          TotalExpenses: expSum,
          SalePrice: salePrice,
          NetProfit: netProfit
        };
      });

      const totalProfit = sum(carWise.filter(r => r.SalePrice > 0), (r) => r.NetProfit);

      // split profit owner/partner using amounts ratio (simple)
      const ownerProfitTotal = totalProfit * 0.7;   // default assumption if not stored
      const partnerProfitTotal = totalProfit * 0.3;

      // expense category rows
      const catMap = {};
      expenses.forEach((e) => {
        const k = e.ExpenseCategory || "Other";
        catMap[k] = n(catMap[k]) + n(e.Amount);
      });
      const expenseCategoryRows = Object.keys(catMap).sort().map(k => ({ Category: k, Amount: catMap[k] }));

      // expense paid by rows
      const paidMap = {};
      expenses.forEach((e) => {
        const k = e.PaidBy || "Unknown";
        paidMap[k] = n(paidMap[k]) + n(e.Amount);
      });
      const expensePaidByRows = Object.keys(paidMap).sort().map(k => ({ PaidBy: k, Amount: paidMap[k] }));

      // period rows (month-wise)
      const m = {};
      function ensure(mk) {
        if (!mk) return;
        if (!m[mk]) m[mk] = { Month: mk, Expenses: 0, Profit: 0, Sales: 0 };
      }
      sales.forEach((s) => {
        const mk = monthKey(s.SaleDate);
        ensure(mk);
        m[mk].Sales += 1;
        m[mk].Profit += n(s.SalePrice); // temp, will subtract expenses below then subtract purchase? (simplified)
      });
      expenses.forEach((e) => {
        const mk = monthKey(e.ExpenseDate);
        ensure(mk);
        m[mk].Expenses += n(e.Amount);
        m[mk].Profit -= n(e.Amount);
      });
      const periodRows = Object.values(m).sort((a, b) => String(a.Month).localeCompare(String(b.Month)));

      // receivables
      const receivables = [];
      db.cars.forEach((car) => {
        if (carId && car.CarID !== carId) return;
        const sale = getSaleByCar(db, car.CarID);
        if (!sale) return;
        if ((sale.SaleType || "") !== "Installment") return;
        const rc = calcReceivableForCar(db, car.CarID);
        if (rc.balance <= 0) return;
        receivables.push({
          CarID: car.CarID,
          CarName: car.CarName || car.Model || car.CarID,
          RegistrationNo: car.RegistrationNo || "",
          BuyerName: sale.BuyerName || "",
          SalePrice: rc.salePrice,
          Received: rc.received,
          Balance: rc.balance
        });
      });

      const totalInstallmentReceived = sum(receivables, (r) => r.Received);
      const totalReceivable = sum(receivables, (r) => r.Balance);

      return Promise.resolve({
        ok: true,
        summary: {
          totalCars, soldCars, availableCars,
          ownerInvestment, partnerInvestment, totalInvestment,
          totalExpenses, totalProfit,
          ownerProfitTotal, partnerProfitTotal,
          totalInstallmentReceived, totalReceivable
        },
        carWise,
        expenseCategoryRows,
        expensePaidByRows,
        periodRows,
        receivables
      });
    },

    /* Invoice (local) */
    getCarInvoiceData({ carId, startDate, endDate } = {}) {
      const db = loadDB();
      const car = getCarById(db, carId);
      if (!car) return Promise.resolve({ ok: false, message: "Car not found" });

      const sale = getSaleByCar(db, carId) || {};
      let expenses = db.expenses.filter((e) => e.CarID === carId);
      if (startDate || endDate) expenses = expenses.filter((e) => inRange(e.ExpenseDate, startDate, endDate));

      const purchaseAmount = n(car.PurchaseAmount);
      const totalExpenses = sum(expenses, (e) => e.Amount);
      const netCost = purchaseAmount + totalExpenses;
      const salePrice = n(sale.SalePrice);
      const netProfit = salePrice ? (salePrice - netCost) : 0;

      // owner/partner profit split based on amounts
      const invOwner = n(car.OwnerAmount);
      const invPartner = n(car.PartnerAmount);
      const invTotal = invOwner + invPartner || 1;
      const ownerProfit = netProfit * (invOwner / invTotal);
      const partnerProfit = netProfit * (invPartner / invTotal);

      const rc = calcReceivableForCar(db, carId);

      // investor rows
      const investors = [];
      if (invOwner > 0 || n(car.OwnerPercent) > 0) {
        investors.push({ InvestorName: "Owner", SharePercent: n(car.OwnerPercent), Amount: invOwner });
      }
      if (invPartner > 0 || n(car.PartnerPercent) > 0) {
        investors.push({ InvestorName: "Abdul Raheem", SharePercent: n(car.PartnerPercent), Amount: invPartner });
      }
      (car.OtherInvestors || []).forEach(x => {
        investors.push({
          InvestorName: x.InvestorName || "",
          SharePercent: n(x.SharePercent),
          Amount: n(x.Amount)
        });
      });

      return Promise.resolve({
        ok: true,
        car,
        sale,
        expenses,
        investors,
        totals: {
          purchaseAmount,
          totalExpenses,
          netCost,
          salePrice,
          netProfit,
          ownerProfit,
          partnerProfit,
          received: rc.received,
          balance: rc.balance
        }
      });
    }
  };

  // expose globally
  window.ALP = window.ALP || {};
  window.ALP.api = api;

  // small helper to show DB on console if needed
  window.ALP._dump = function () { console.log(loadDB()); };
})();
