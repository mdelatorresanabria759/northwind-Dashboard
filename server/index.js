const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const { getRFMAnalysis } = require('./rfm');

const app = express();
const PORT = process.env.PORT || 4000;
const dbPath = path.resolve(__dirname, '..', 'database', 'northwind.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..', 'public')));

// Database connection
const db = new Database(dbPath, { readonly: true });
db.pragma('foreign_keys = ON');

// Helper to build WHERE clause based on query filters
function buildOrderFilter(reqQuery) {
  const conditions = [];
  const params = [];

  if (reqQuery.year) {
    conditions.push("SUBSTR(o.orderdate, 1, 4) = ?");
    params.push(String(reqQuery.year));
  }
  if (reqQuery.categoryid) {
    conditions.push("p.categoryid = ?");
    params.push(Number(reqQuery.categoryid));
  }
  if (reqQuery.employeeid) {
    conditions.push("o.employeeid = ?");
    params.push(Number(reqQuery.employeeid));
  }
  if (reqQuery.country) {
    conditions.push("o.shipcountry = ?");
    params.push(String(reqQuery.country));
  }
  if (reqQuery.shipperid) {
    conditions.push("o.shipvia = ?");
    params.push(Number(reqQuery.shipperid));
  }

  const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  return { whereClause, params };
}

// 1. Meta / Filter Options
app.get('/api/filters', (req, res) => {
  try {
    const years = db.prepare("SELECT DISTINCT SUBSTR(orderdate, 1, 4) as yr FROM orders WHERE orderdate IS NOT NULL ORDER BY yr ASC").all().map(r => r.yr);
    const categories = db.prepare("SELECT categoryid, categoryname FROM categories ORDER BY categoryname ASC").all();
    const employees = db.prepare("SELECT employeeid, firstname || ' ' || lastname AS name, title FROM employees ORDER BY name ASC").all();
    const countries = db.prepare("SELECT DISTINCT shipcountry FROM orders WHERE shipcountry IS NOT NULL ORDER BY shipcountry ASC").all().map(r => r.shipcountry);
    const shippers = db.prepare("SELECT shipperid, companyname FROM shippers ORDER BY companyname ASC").all();

    res.json({ years, categories, employees, countries, shippers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. High-Level KPI Summary (Verified formula SUM(unitprice * quantity * (1 - discount)))
app.get('/api/kpis', (req, res) => {
  try {
    const { whereClause, params } = buildOrderFilter(req.query);

    const query = `
      SELECT 
        ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2) AS total_net_sales,
        COUNT(DISTINCT o.orderid) AS total_orders,
        COUNT(DISTINCT o.customerid) AS active_customers,
        SUM(od.quantity) AS total_units_sold,
        ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)) / MAX(1, COUNT(DISTINCT o.orderid)), 2) AS avg_order_value
      FROM orders o
      JOIN order_details od ON o.orderid = od.orderid
      JOIN products p ON od.productid = p.productid
      ${whereClause}
    `;

    const kpi = db.prepare(query).get(...params);

    // Calculate freight filtered at order level to prevent multiplication by order lines
    const freightConditions = [];
    const freightParams = [];
    if (req.query.year) {
      freightConditions.push("SUBSTR(o.orderdate, 1, 4) = ?");
      freightParams.push(String(req.query.year));
    }
    if (req.query.employeeid) {
      freightConditions.push("o.employeeid = ?");
      freightParams.push(Number(req.query.employeeid));
    }
    if (req.query.country) {
      freightConditions.push("o.shipcountry = ?");
      freightParams.push(String(req.query.country));
    }
    if (req.query.shipperid) {
      freightConditions.push("o.shipvia = ?");
      freightParams.push(Number(req.query.shipperid));
    }
    const freightWhere = freightConditions.length > 0 ? "WHERE " + freightConditions.join(" AND ") : "";
    const freightRow = db.prepare(`SELECT ROUND(SUM(freight), 2) AS total_freight FROM orders o ${freightWhere}`).get(...freightParams);
    
    kpi.total_freight = freightRow ? freightRow.total_freight : 0;
    res.json(kpi || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Sales Trend by Month
app.get('/api/sales/monthly', (req, res) => {
  try {
    const { whereClause, params } = buildOrderFilter(req.query);

    const query = `
      SELECT 
        SUBSTR(o.orderdate, 1, 7) AS month,
        ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2) AS net_sales,
        SUM(od.quantity) AS units_sold,
        COUNT(DISTINCT o.orderid) AS orders_count
      FROM orders o
      JOIN order_details od ON o.orderid = od.orderid
      JOIN products p ON od.productid = p.productid
      ${whereClause ? whereClause + " AND o.orderdate IS NOT NULL" : "WHERE o.orderdate IS NOT NULL"}
      GROUP BY SUBSTR(o.orderdate, 1, 7)
      ORDER BY month ASC
    `;

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Sales by Category
app.get('/api/sales/by-category', (req, res) => {
  try {
    const { whereClause, params } = buildOrderFilter(req.query);

    const query = `
      SELECT 
        c.categoryid,
        c.categoryname,
        ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2) AS net_sales,
        SUM(od.quantity) AS units_sold,
        COUNT(DISTINCT od.orderid) AS order_count
      FROM orders o
      JOIN order_details od ON o.orderid = od.orderid
      JOIN products p ON od.productid = p.productid
      JOIN categories c ON p.categoryid = c.categoryid
      ${whereClause}
      GROUP BY c.categoryid, c.categoryname
      ORDER BY net_sales DESC
    `;

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Top Products
app.get('/api/products/top', (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const { whereClause, params } = buildOrderFilter(req.query);

    const query = `
      SELECT 
        p.productid,
        p.productname,
        c.categoryname,
        p.unitprice AS current_catalog_price,
        p.unitsinstock,
        p.unitsonorder,
        p.reorderlevel,
        SUM(od.quantity) AS units_sold,
        ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2) AS net_sales
      FROM orders o
      JOIN order_details od ON o.orderid = od.orderid
      JOIN products p ON od.productid = p.productid
      JOIN categories c ON p.categoryid = c.categoryid
      ${whereClause}
      GROUP BY p.productid, p.productname, c.categoryname, p.unitprice, p.unitsinstock, p.unitsonorder, p.reorderlevel
      ORDER BY net_sales DESC
      LIMIT ?
    `;

    const rows = db.prepare(query).all(...params, limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Employees Performance
app.get('/api/employees/performance', (req, res) => {
  try {
    const { whereClause, params } = buildOrderFilter(req.query);

    const query = `
      SELECT 
        e.employeeid,
        e.firstname || ' ' || e.lastname AS name,
        e.title,
        m.firstname || ' ' || m.lastname AS manager,
        COUNT(DISTINCT o.orderid) AS total_orders,
        SUM(od.quantity) AS total_units,
        ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2) AS net_sales,
        ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)) / MAX(1, COUNT(DISTINCT o.orderid)), 2) AS avg_order_ticket
      FROM orders o
      JOIN order_details od ON o.orderid = od.orderid
      JOIN products p ON od.productid = p.productid
      JOIN employees e ON o.employeeid = e.employeeid
      LEFT JOIN employees m ON e.reportsto = m.employeeid
      ${whereClause}
      GROUP BY e.employeeid, name, e.title, manager
      ORDER BY net_sales DESC
    `;

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Logistics & Shippers Performance
app.get('/api/logistics', (req, res) => {
  try {
    const { whereClause, params } = buildOrderFilter(req.query);

    const query = `
      SELECT 
        s.shipperid,
        s.companyname,
        COUNT(DISTINCT o.orderid) AS total_shipments,
        ROUND(SUM(o.freight), 2) AS total_freight,
        ROUND(AVG(o.freight), 2) AS avg_freight,
        ROUND(AVG(JULIANDAY(o.shippeddate) - JULIANDAY(o.orderdate)), 2) AS avg_delivery_days
      FROM orders o
      JOIN order_details od ON o.orderid = od.orderid
      JOIN products p ON od.productid = p.productid
      JOIN shippers s ON o.shipvia = s.shipperid
      ${whereClause ? whereClause + " AND o.shippeddate IS NOT NULL AND o.orderdate IS NOT NULL" : "WHERE o.shippeddate IS NOT NULL AND o.orderdate IS NOT NULL"}
      GROUP BY s.shipperid, s.companyname
      ORDER BY total_shipments DESC
    `;

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Geographic Distribution (by Destination Country)
app.get('/api/sales/by-country', (req, res) => {
  try {
    const { whereClause, params } = buildOrderFilter(req.query);

    const query = `
      SELECT 
        o.shipcountry AS country,
        COUNT(DISTINCT o.orderid) AS order_count,
        ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2) AS net_sales
      FROM orders o
      JOIN order_details od ON o.orderid = od.orderid
      JOIN products p ON od.productid = p.productid
      ${whereClause ? whereClause + " AND o.shipcountry IS NOT NULL" : "WHERE o.shipcountry IS NOT NULL"}
      GROUP BY o.shipcountry
      ORDER BY net_sales DESC
      LIMIT 15
    `;

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. RFM Customer Segmentation & Clustering
app.get('/api/customers/rfm', (req, res) => {
  try {
    const rfmData = getRFMAnalysis(db);
    res.json(rfmData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Integrity Status / Verification endpoint
app.get('/api/audit', (req, res) => {
  try {
    const tables = ['region', 'territories', 'categories', 'suppliers', 'customers', 'employees', 'employeeterritories', 'shippers', 'products', 'orders', 'order_details', 'usstates'];
    const counts = {};
    tables.forEach(t => {
      counts[t] = db.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).get().cnt;
    });

    const netSales = db.prepare("SELECT ROUND(SUM(unitprice * quantity * (1.0 - discount)), 4) as val FROM order_details").get().val;
    const totalQty = db.prepare("SELECT SUM(quantity) as val FROM order_details").get().val;
    const freight = db.prepare("SELECT ROUND(SUM(freight), 2) as val FROM orders").get().val;
    const fkViolations = db.pragma('foreign_key_check');

    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      counts,
      reconciliation: {
        total_net_sales: netSales,
        expected_net_sales: 1265793.0395,
        total_quantity: totalQty,
        expected_quantity: 51317,
        total_freight: freight,
        expected_freight: 64942.69,
        fk_violations: fkViolations.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Northwind BI Server running at http://localhost:${PORT}`);
});
