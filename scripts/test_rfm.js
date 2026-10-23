const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.resolve(__dirname, '..', 'database', 'northwind.db'), { readonly: true });

const rawData = db.prepare(`
  SELECT 
    c.customerid,
    c.companyname,
    c.country,
    c.city,
    COUNT(DISTINCT o.orderid) AS frequency,
    COALESCE(ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2), 0.0) AS monetary,
    MAX(o.orderdate) AS last_order_date,
    CASE 
      WHEN MAX(o.orderdate) IS NULL THEN 999 
      ELSE CAST(ROUND(JULIANDAY('1998-05-06 05:00:16') - JULIANDAY(MAX(o.orderdate))) AS INT)
    END AS recency_days
  FROM customers c
  LEFT JOIN orders o ON c.customerid = o.customerid
  LEFT JOIN order_details od ON o.orderid = od.orderid
  GROUP BY c.customerid, c.companyname, c.country, c.city
`).all();

console.log('Total customers:', rawData.length);
const withoutOrders = rawData.filter(c => c.frequency === 0);
console.log('Customers without orders:', withoutOrders.map(c => c.customerid));

const active = rawData.filter(c => c.frequency > 0);
const rVals = active.map(c => c.recency_days).sort((a,b)=>a-b);
const fVals = active.map(c => c.frequency).sort((a,b)=>a-b);
const mVals = active.map(c => c.monetary).sort((a,b)=>a-b);

console.log('Recency quartiles (25%, 50%, 75%):', 
  rVals[Math.floor(rVals.length*0.25)], 
  rVals[Math.floor(rVals.length*0.5)], 
  rVals[Math.floor(rVals.length*0.75)]
);
console.log('Frequency quartiles (25%, 50%, 75%):', 
  fVals[Math.floor(fVals.length*0.25)], 
  fVals[Math.floor(fVals.length*0.5)], 
  fVals[Math.floor(fVals.length*0.75)]
);
console.log('Monetary quartiles (25%, 50%, 75%):', 
  mVals[Math.floor(mVals.length*0.25)], 
  mVals[Math.floor(mVals.length*0.5)], 
  mVals[Math.floor(mVals.length*0.75)]
);
