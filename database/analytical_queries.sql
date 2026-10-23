-- =====================================================================
-- SUITE DE CONSULTAS SQL ANALÍTICAS COMENTADAS - PROYECTO NORTHWIND
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. KPI GLOBALES EJECUTIVOS
-- Calcula Ventas Netas, Total Órdenes, Clientes Activos, Productos Vendidos y Ticket Promedio
-- Fórmula obligatoria: SUM(unitprice * quantity * (1 - discount))
-- ---------------------------------------------------------------------
SELECT 
    ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2) AS total_net_sales,
    COUNT(DISTINCT o.orderid) AS total_orders,
    COUNT(DISTINCT o.customerid) AS active_customers,
    SUM(od.quantity) AS total_units_sold,
    ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)) / COUNT(DISTINCT o.orderid), 2) AS average_order_value,
    ROUND(SUM(o.freight), 2) AS total_freight_cost
FROM orders o
JOIN order_details od ON o.orderid = od.orderid;


-- ---------------------------------------------------------------------
-- 2. TENDENCIA TEMPORAL MENSUAL (VENTAS NETAS, VOLUMEN Y PEDIDOS)
-- Permite visualizar la estacionalidad y evolución de ingresos a través del tiempo
-- ---------------------------------------------------------------------
SELECT 
    SUBSTR(o.orderdate, 1, 7) AS year_month,
    COUNT(DISTINCT o.orderid) AS orders_count,
    SUM(od.quantity) AS units_sold,
    ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2) AS net_sales,
    ROUND(SUM(o.freight), 2) AS monthly_freight
FROM orders o
JOIN order_details od ON o.orderid = od.orderid
WHERE o.orderdate IS NOT NULL
GROUP BY SUBSTR(o.orderdate, 1, 7)
ORDER BY year_month ASC;


-- ---------------------------------------------------------------------
-- 3. ANÁLISIS DE CATEGORÍAS DE PRODUCTOS
-- Participación de cada categoría en la facturación neta y unidades comercializadas
-- ---------------------------------------------------------------------
SELECT 
    c.categoryid,
    c.categoryname,
    COUNT(DISTINCT p.productid) AS product_count,
    SUM(od.quantity) AS total_quantity,
    ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2) AS net_sales,
    ROUND(
        SUM(od.unitprice * od.quantity * (1.0 - od.discount)) * 100.0 / 
        (SELECT SUM(od2.unitprice * od2.quantity * (1.0 - od2.discount)) FROM order_details od2), 
        2
    ) AS pct_share
FROM categories c
JOIN products p ON c.categoryid = p.categoryid
JOIN order_details od ON p.productid = od.productid
GROUP BY c.categoryid, c.categoryname
ORDER BY net_sales DESC;


-- ---------------------------------------------------------------------
-- 4. TOP 10 PRODUCTOS POR INGRESOS Y MARGEN DE STOCK
-- Identifica los productos estrella (cash cows) y su nivel de existencias
-- ---------------------------------------------------------------------
SELECT 
    p.productid,
    p.productname,
    c.categoryname,
    p.unitprice AS catalog_price,
    p.unitsinstock,
    p.unitsonorder,
    SUM(od.quantity) AS units_sold,
    ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2) AS total_net_revenue
FROM products p
JOIN categories c ON p.categoryid = c.categoryid
JOIN order_details od ON p.productid = od.productid
GROUP BY p.productid, p.productname, c.categoryname, p.unitprice, p.unitsinstock, p.unitsonorder
ORDER BY total_net_revenue DESC
LIMIT 10;


-- ---------------------------------------------------------------------
-- 5. RENDIMIENTO DE EMPLEADOS Y JERARQUÍA COMERCIAL
-- Evalúa el desempeño en ventas netas generadas por cada representante
-- ---------------------------------------------------------------------
SELECT 
    e.employeeid,
    e.firstname || ' ' || e.lastname AS employee_name,
    e.title,
    m.firstname || ' ' || m.lastname AS reports_to_manager,
    COUNT(DISTINCT o.orderid) AS orders_closed,
    ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2) AS total_net_sales,
    ROUND(AVG(od.unitprice * od.quantity * (1.0 - od.discount)), 2) AS avg_item_sale
FROM employees e
LEFT JOIN employees m ON e.reportsto = m.employeeid
JOIN orders o ON e.employeeid = o.employeeid
JOIN order_details od ON o.orderid = od.orderid
GROUP BY e.employeeid, employee_name, e.title, reports_to_manager
ORDER BY total_net_sales DESC;


-- ---------------------------------------------------------------------
-- 6. EFICIENCIA LOGÍSTICA POR TRANSPORTISTA (SHIPPERS)
-- Compara transportistas según órdenes manejadas, costo promedio de flete y tiempo medio de entrega en días
-- ---------------------------------------------------------------------
SELECT 
    s.shipperid,
    s.companyname,
    COUNT(o.orderid) AS total_shipments,
    ROUND(SUM(o.freight), 2) AS total_freight,
    ROUND(AVG(o.freight), 2) AS avg_freight_per_order,
    ROUND(AVG(JULIANDAY(o.shippeddate) - JULIANDAY(o.orderdate)), 2) AS avg_shipping_days
FROM shippers s
JOIN orders o ON s.shipperid = o.shipvia
WHERE o.shippeddate IS NOT NULL AND o.orderdate IS NOT NULL
GROUP BY s.shipperid, s.companyname
ORDER BY total_shipments DESC;


-- ---------------------------------------------------------------------
-- 7. EXTRACCIÓN DE MÉTRICAS BASE RFM POR CLIENTE
-- Calcula Recency (días transcurridos respecto a la fecha máxima de snapshot '1998-05-06'),
-- Frequency (conteo de órdenes únicas) y Monetary (ventas netas totales)
-- ---------------------------------------------------------------------
SELECT 
    c.customerid,
    c.companyname,
    c.country,
    c.city,
    COUNT(DISTINCT o.orderid) AS frequency,
    ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2) AS monetary,
    MAX(o.orderdate) AS last_order_date,
    CAST(ROUND(JULIANDAY('1998-05-06 05:00:16') - JULIANDAY(MAX(o.orderdate))) AS INT) AS recency_days
FROM customers c
LEFT JOIN orders o ON c.customerid = o.customerid
LEFT JOIN order_details od ON o.orderid = od.orderid
GROUP BY c.customerid, c.companyname, c.country, c.city
ORDER BY monetary DESC;
