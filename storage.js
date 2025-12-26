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
