const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'database', 'northwind.db');
const excelPath = path.resolve(__dirname, '..', 'Data', 'northwind.xlsx');

const db = new Database(dbPath, { readonly: true });
const wb = XLSX.readFile(excelPath);

console.log('======================================================');
console.log('   AUDITORÍA Y RECONCILIACIÓN DE INTEGRIDAD NORTHWIND');
console.log('======================================================\n');

let totalTests = 0;
let passedTests = 0;

function assertCheck(name, excelVal, dbVal, tolerance = 0.001) {
  totalTests++;
  const diff = Math.abs(Number(excelVal) - Number(dbVal));
  const isOk = diff <= tolerance;
  if (isOk) {
    passedTests++;
    console.log(`[PASS] ${name}`);
    console.log(`       Excel: ${excelVal} | DB: ${dbVal}`);
  } else {
    console.error(`[FAIL] ${name}`);
    console.error(`       Excel: ${excelVal} | DB: ${dbVal} | Diff: ${diff}`);
  }
}

// 1. Row count checks
const tables = [
  'region', 'territories', 'categories', 'suppliers',
  'customers', 'employees', 'employeeterritories', 'shippers',
  'products', 'orders', 'order_details', 'usstates'
];

console.log('--- 1. VERIFICACIÓN DE CONTEO DE FILAS (ROW COUNTS) ---');
tables.forEach(tbl => {
  const excelCount = XLSX.utils.sheet_to_json(wb.Sheets[tbl]).length;
  const dbCount = db.prepare(`SELECT COUNT(*) as cnt FROM ${tbl}`).get().cnt;
  assertCheck(`Row count: ${tbl}`, excelCount, dbCount);
});

console.log('\n--- 2. RECONCILIACIÓN FINANCIERA Y TOTALES ---');
// Net sales from excel
const orderDetails = XLSX.utils.sheet_to_json(wb.Sheets['order_details']);
let excelNetSales = 0;
let excelTotalQty = 0;
orderDetails.forEach(r => {
  const p = Number(r.unitprice);
  const q = Number(r.quantity);
  const d = Number(r.discount) || 0;
  excelNetSales += p * q * (1.0 - d);
  excelTotalQty += q;
});

const dbFinancials = db.prepare(`
  SELECT 
    SUM(unitprice * quantity * (1.0 - discount)) as dbNetSales,
    SUM(quantity) as dbTotalQty
  FROM order_details
`).get();

assertCheck('Ventas Netas SUM(unitprice * quantity * (1 - discount))', excelNetSales.toFixed(4), dbFinancials.dbNetSales.toFixed(4));
assertCheck('Cantidad Total de Artículos Vendidos', excelTotalQty, dbFinancials.dbTotalQty);

// Freight check
const orders = XLSX.utils.sheet_to_json(wb.Sheets['orders']);
const excelFreight = orders.reduce((acc, o) => acc + (Number(o.freight) || 0), 0);
const dbFreight = db.prepare('SELECT SUM(freight) as sumFreight FROM orders').get().sumFreight;
assertCheck('Flete Total (Total Freight)', excelFreight.toFixed(2), dbFreight.toFixed(2));

console.log('\n--- 3. PRUEBAS DE INTEGRIDAD REFERENCIAL (FK VIOLATIONS) ---');
const fkViolations = db.pragma('foreign_key_check');
totalTests++;
if (fkViolations.length === 0) {
  passedTests++;
  console.log('[PASS] Verificación PRAGMA foreign_key_check: Cero violaciones detectadas.');
} else {
  console.error('[FAIL] Se encontraron violaciones de integridad referencial:', fkViolations);
}

console.log('\n--- 4. PRUEBAS DE RESTRICCIONES DE DOMINIO Y CHECKs ---');
const checkDiscount = db.prepare('SELECT COUNT(*) as cnt FROM order_details WHERE discount < 0 OR discount > 1').get().cnt;
assertCheck('Descuentos dentro del rango [0, 1]', 0, checkDiscount);

const checkQuantities = db.prepare('SELECT COUNT(*) as cnt FROM order_details WHERE quantity <= 0').get().cnt;
assertCheck('Cantidades estrictamente positivas (quantity > 0)', 0, checkQuantities);

const checkUnitPrices = db.prepare('SELECT COUNT(*) as cnt FROM order_details WHERE unitprice < 0').get().cnt;
assertCheck('Precios unitarios no negativos (unitprice >= 0)', 0, checkUnitPrices);

console.log('\n======================================================');
console.log(`RESULTADO FINAL: ${passedTests}/${totalTests} pruebas superadas con éxito.`);
console.log('======================================================');

db.close();
