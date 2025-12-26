/***********************
 * LOCAL DATABASE
 ***********************/
const DB = {
  cars: JSON.parse(localStorage.getItem("cars") || "[]"),
  expenses: JSON.parse(localStorage.getItem("expenses") || "[]"),
  sales: JSON.parse(localStorage.getItem("sales") || "[]"),
  payments: JSON.parse(localStorage.getItem("payments") || "[]")
};

function saveDB(){
  localStorage.setItem("cars", JSON.stringify(DB.cars));
  localStorage.setItem("expenses", JSON.stringify(DB.expenses));
  localStorage.setItem("sales", JSON.stringify(DB.sales));
  localStorage.setItem("payments", JSON.stringify(DB.payments));
}

/***********************
 * UTIL
 ***********************/
function uid(prefix){
  return prefix + "_" + Date.now();
}

/***********************
 * CARS
 ***********************/
function client_addCar(car){
  car.CarID = uid("CAR");
  car.Status = "Available";
  DB.cars.push(car);
  saveDB();
  return { ok:true, message:"Car added successfully", CarID:car.CarID };
}

function client_getCarList(){
  return DB.cars;
}

function client_getAvailableCarsFromCarList(){
  return {
    ok:true,
    cars: DB.cars.filter(c => c.Status === "Available")
  };
}

/***********************
 * EXPENSES
 ***********************/
function client_addExpense(exp){
  exp.ExpenseID = uid("EXP");
  DB.expenses.push(exp);
  saveDB();
  return { ok:true, message:"Expense saved" };
}

/***********************
 * SALES
 ***********************/
function client_addNewSale(sale){
  sale.SaleID = uid("SALE");
  DB.sales.push(sale);

  const car = DB.cars.find(c => c.CarID === sale.CarID);
  if(car) car.Status = "Sold";

  saveDB();
  return { ok:true, status:"OK", SaleID:sale.SaleID };
}

/***********************
 * INSTALLMENT PAYMENTS
 ***********************/
function client_addInstallmentPayment(p){
  p.PaymentID = uid("PAY");
  DB.payments.push(p);
  saveDB();
  return { ok:true };
}

function client_getReceivableCars(){
  const rows = [];

  DB.sales.forEach(s=>{
    if(s.SaleType === "Installment"){
      const paid = DB.payments
        .filter(p=>p.CarID===s.CarID)
        .reduce((a,b)=>a+Number(b.Amount||0),0);

      const received = Number(s.DownPayment||0) + paid;
      const bal = Number(s.SalePrice||0) - received;

      if(bal > 0){
        const car = DB.cars.find(c=>c.CarID===s.CarID) || {};
        rows.push({
          CarID:s.CarID,
          CarName:car.carName || "",
          RegistrationNo:car.regNo || "",
          BuyerName:s.BuyerName || "",
          SalePrice:s.SalePrice,
          Received:received,
          Balance:bal
        });
      }
    }
  });

  return { ok:true, items:rows };
}
