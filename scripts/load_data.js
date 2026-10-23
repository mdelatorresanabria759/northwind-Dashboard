const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'database', 'northwind.db');
const schemaPath = path.resolve(__dirname, '..', 'database', 'schema_sqlite.sql');
const excelPath = path.resolve(__dirname, '..', 'Data', 'northwind.xlsx');

// 1. Initialize DB file
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

console.log('Loading SQLite DDL schema...');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);
console.log('Schema created successfully.');

// 2. Read Workbook
const wb = XLSX.readFile(excelPath, { cellDates: true });

function formatIsoDate(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val)) {
    return val.toISOString().slice(0, 19).replace('T', ' ');
  }
  if (typeof val === 'number') {
    // Excel numeric date fallback
    const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
    return dateObj.toISOString().slice(0, 19).replace('T', ' ');
  }
  return String(val);
}

// 3. Load tables in dependency order
const tx = db.transaction(() => {
  // A. Region
  const regionRows = XLSX.utils.sheet_to_json(wb.Sheets['region']);
  const insertRegion = db.prepare('INSERT INTO region (regionid, regiondescription) VALUES (?, ?)');
  regionRows.forEach(r => insertRegion.run(r.regionid, r.regiondescription));
  console.log(`Loaded region: ${regionRows.length} rows`);

  // B. Territories
  const terrRows = XLSX.utils.sheet_to_json(wb.Sheets['territories']);
  const insertTerr = db.prepare('INSERT INTO territories (territoryid, territorydescription, regionid) VALUES (?, ?, ?)');
  terrRows.forEach(r => insertTerr.run(String(r.territoryid), String(r.territorydescription).trim(), r.regionid));
  console.log(`Loaded territories: ${terrRows.length} rows`);

  // C. Categories
  const catRows = XLSX.utils.sheet_to_json(wb.Sheets['categories']);
  const insertCat = db.prepare('INSERT INTO categories (categoryid, categoryname, description, picture) VALUES (?, ?, ?, ?)');
  catRows.forEach(r => insertCat.run(r.categoryid, r.categoryname, r.description || null, null));
  console.log(`Loaded categories: ${catRows.length} rows`);

  // D. Suppliers
  const supRows = XLSX.utils.sheet_to_json(wb.Sheets['suppliers']);
  const insertSup = db.prepare(`
    INSERT INTO suppliers (supplierid, companyname, contactname, contacttitle, address, city, region, postalcode, country, phone, fax, homepage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  supRows.forEach(r => {
    insertSup.run(
      r.supplierid, r.companyname, r.contactname || null, r.contacttitle || null,
      r.address || null, r.city || null, r.region || null, r.postalcode || null,
      r.country || null, r.phone || null, r.fax || null, r.homepage || null
    );
  });
  console.log(`Loaded suppliers: ${supRows.length} rows`);

  // E. Customers
  const custRows = XLSX.utils.sheet_to_json(wb.Sheets['customers']);
  const insertCust = db.prepare(`
    INSERT INTO customers (customerid, companyname, contactname, contacttitle, address, city, region, postalcode, country, phone, fax)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  custRows.forEach(r => {
    insertCust.run(
      String(r.customerid).trim(), r.companyname, r.contactname || null, r.contacttitle || null,
      r.address || null, r.city || null, r.region || null, r.postalcode || null,
      r.country || null, r.phone || null, r.fax || null
    );
  });
  console.log(`Loaded customers: ${custRows.length} rows`);

  // F. Employees
  const empRows = XLSX.utils.sheet_to_json(wb.Sheets['employees']);
  const insertEmp = db.prepare(`
    INSERT INTO employees (employeeid, lastname, firstname, title, titleofcourtesy, birthdate, hiredate, address, city, region, postalcode, country, homephone, extension, notes, reportsto, photopath)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  empRows.forEach(r => {
    insertEmp.run(
      r.employeeid, r.lastname, r.firstname, r.title || null, r.titleofcourtesy || null,
      formatIsoDate(r.birthdate), formatIsoDate(r.hiredate),
      r.address || null, r.city || null, r.region || null, r.postalcode || null,
      r.country || null, r.homephone || null, r.extension ? String(r.extension) : null,
      r.notes || null, r.reportsto || null, r.photopath || null
    );
  });
  console.log(`Loaded employees: ${empRows.length} rows`);

  // G. EmployeeTerritories
  const empTerrRows = XLSX.utils.sheet_to_json(wb.Sheets['employeeterritories']);
  const insertEmpTerr = db.prepare('INSERT INTO employeeterritories (employeeid, territoryid) VALUES (?, ?)');
  empTerrRows.forEach(r => insertEmpTerr.run(r.employeeid, String(r.territoryid)));
  console.log(`Loaded employeeterritories: ${empTerrRows.length} rows`);

  // H. Shippers
  const shipRows = XLSX.utils.sheet_to_json(wb.Sheets['shippers']);
  const insertShip = db.prepare('INSERT INTO shippers (shipperid, companyname, phone) VALUES (?, ?, ?)');
  shipRows.forEach(r => insertShip.run(r.shipperid, r.companyname, r.phone || null));
  console.log(`Loaded shippers: ${shipRows.length} rows`);

  // I. Products
  const prodRows = XLSX.utils.sheet_to_json(wb.Sheets['products']);
  const insertProd = db.prepare(`
    INSERT INTO products (productid, productname, supplierid, categoryid, quantityperunit, unitprice, unitsinstock, unitsonorder, reorderlevel, discontinued)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  prodRows.forEach(r => {
    insertProd.run(
      r.productid, r.productname, r.supplierid || null, r.categoryid || null,
      r.quantityperunit || null, Number(r.unitprice) || 0,
      Number(r.unitsinstock) || 0, Number(r.unitsonorder) || 0,
      Number(r.reorderlevel) || 0, Number(r.discontinued) || 0
    );
  });
  console.log(`Loaded products: ${prodRows.length} rows`);

  // J. Orders
  const orderRows = XLSX.utils.sheet_to_json(wb.Sheets['orders']);
  const insertOrder = db.prepare(`
    INSERT INTO orders (orderid, customerid, employeeid, orderdate, requireddate, shippeddate, shipvia, freight, shipname, shipaddress, shipcity, shipregion, shippostalcode, shipcountry)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  orderRows.forEach(r => {
    insertOrder.run(
      r.orderid, r.customerid ? String(r.customerid).trim() : null, r.employeeid || null,
      formatIsoDate(r.orderdate), formatIsoDate(r.requireddate), formatIsoDate(r.shippeddate),
      r.shipvia || null, Number(r.freight) || 0,
      r.shipname || null, r.shipaddress || null, r.shipcity || null,
      r.shipregion || null, r.shippostalcode ? String(r.shippostalcode) : null,
      r.shipcountry || null
    );
  });
  console.log(`Loaded orders: ${orderRows.length} rows`);

  // K. Order Details
  const detailRows = XLSX.utils.sheet_to_json(wb.Sheets['order_details']);
  const insertDetail = db.prepare(`
    INSERT INTO order_details (orderid, productid, unitprice, quantity, discount)
    VALUES (?, ?, ?, ?, ?)
  `);
  detailRows.forEach(r => {
    insertDetail.run(
      r.orderid, r.productid,
      Number(r.unitprice), Number(r.quantity), Number(r.discount) || 0
    );
  });
  console.log(`Loaded order_details: ${detailRows.length} rows`);

  // L. US States
  const stateRows = XLSX.utils.sheet_to_json(wb.Sheets['usstates']);
  const insertState = db.prepare('INSERT INTO usstates (stateid, statename, stateabbr, stateregion) VALUES (?, ?, ?, ?)');
  stateRows.forEach(r => insertState.run(r.stateid, r.statename, r.stateabbr, r.stateregion || null));
  console.log(`Loaded usstates: ${stateRows.length} rows`);
});

tx();
console.log('All tables successfully populated into SQLite!');

// Verification query
const totalNet = db.prepare('SELECT SUM(unitprice * quantity * (1.0 - discount)) as net_sales, SUM(quantity) as total_qty FROM order_details').get();
console.log('SQLite Net Sales Verification:', totalNet);

db.close();
