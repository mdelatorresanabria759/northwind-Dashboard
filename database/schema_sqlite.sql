-- =====================================================================
-- PROYECTO ACADÉMICO NORTHWIND: ESQUEMA DDL COMPLETO (SQLITE & POSTGRESQL)
-- Script compatible con SQLite (dialecto nativo) y PostgreSQL
-- Incluye restricciones de Integridad Primaria (PK), Foránea (FK) y Chequeos (CHECK)
-- =====================================================================

-- 1. Regiones geográficas
CREATE TABLE IF NOT EXISTS region (
    regionid INTEGER PRIMARY KEY,
    regiondescription TEXT NOT NULL
);

-- 2. Territorios de ventas
CREATE TABLE IF NOT EXISTS territories (
    territoryid TEXT PRIMARY KEY,
    territorydescription TEXT NOT NULL,
    regionid INTEGER NOT NULL,
    FOREIGN KEY (regionid) REFERENCES region(regionid) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 3. Categorías de productos
CREATE TABLE IF NOT EXISTS categories (
    categoryid INTEGER PRIMARY KEY,
    categoryname TEXT NOT NULL UNIQUE,
    description TEXT,
    picture BLOB
);

-- 4. Proveedores
CREATE TABLE IF NOT EXISTS suppliers (
    supplierid INTEGER PRIMARY KEY,
    companyname TEXT NOT NULL,
    contactname TEXT,
    contacttitle TEXT,
    address TEXT,
    city TEXT,
    region TEXT,
    postalcode TEXT,
    country TEXT,
    phone TEXT,
    fax TEXT,
    homepage TEXT
);

-- 5. Clientes
CREATE TABLE IF NOT EXISTS customers (
    customerid TEXT PRIMARY KEY,
    companyname TEXT NOT NULL,
    contactname TEXT,
    contacttitle TEXT,
    address TEXT,
    city TEXT,
    region TEXT,
    postalcode TEXT,
    country TEXT,
    phone TEXT,
    fax TEXT
);

-- 6. Empleados (Con autorreferencia jerárquica)
CREATE TABLE IF NOT EXISTS employees (
    employeeid INTEGER PRIMARY KEY,
    lastname TEXT NOT NULL,
    firstname TEXT NOT NULL,
    title TEXT,
    titleofcourtesy TEXT,
    birthdate TEXT,
    hiredate TEXT,
    address TEXT,
    city TEXT,
    region TEXT,
    postalcode TEXT,
    country TEXT,
    homephone TEXT,
    extension TEXT,
    photo BLOB,
    notes TEXT,
    reportsto INTEGER,
    photopath TEXT,
    FOREIGN KEY (reportsto) REFERENCES employees(employeeid) ON UPDATE CASCADE ON DELETE SET NULL
);

-- 7. Relación Muchos a Muchos: Empleados y Territorios
CREATE TABLE IF NOT EXISTS employeeterritories (
    employeeid INTEGER NOT NULL,
    territoryid TEXT NOT NULL,
    PRIMARY KEY (employeeid, territoryid),
    FOREIGN KEY (employeeid) REFERENCES employees(employeeid) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (territoryid) REFERENCES territories(territoryid) ON UPDATE CASCADE ON DELETE CASCADE
);

-- 8. Transportistas / Empresas de Envíos
CREATE TABLE IF NOT EXISTS shippers (
    shipperid INTEGER PRIMARY KEY,
    companyname TEXT NOT NULL,
    phone TEXT
);

-- 9. Catálogo de Productos
CREATE TABLE IF NOT EXISTS products (
    productid INTEGER PRIMARY KEY,
    productname TEXT NOT NULL,
    supplierid INTEGER,
    categoryid INTEGER,
    quantityperunit TEXT,
    unitprice REAL NOT NULL DEFAULT 0.0 CHECK (unitprice >= 0),
    unitsinstock INTEGER NOT NULL DEFAULT 0 CHECK (unitsinstock >= 0),
    unitsonorder INTEGER NOT NULL DEFAULT 0 CHECK (unitsonorder >= 0),
    reorderlevel INTEGER NOT NULL DEFAULT 0 CHECK (reorderlevel >= 0),
    discontinued INTEGER NOT NULL DEFAULT 0 CHECK (discontinued IN (0, 1)),
    FOREIGN KEY (supplierid) REFERENCES suppliers(supplierid) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (categoryid) REFERENCES categories(categoryid) ON UPDATE CASCADE ON DELETE SET NULL
);

-- 10. Cabecera de Órdenes
CREATE TABLE IF NOT EXISTS orders (
    orderid INTEGER PRIMARY KEY,
    customerid TEXT,
    employeeid INTEGER,
    orderdate TEXT,
    requireddate TEXT,
    shippeddate TEXT,
    shipvia INTEGER,
    freight REAL NOT NULL DEFAULT 0.0 CHECK (freight >= 0),
    shipname TEXT,
    shipaddress TEXT,
    shipcity TEXT,
    shipregion TEXT,
    shippostalcode TEXT,
    shipcountry TEXT,
    FOREIGN KEY (customerid) REFERENCES customers(customerid) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (employeeid) REFERENCES employees(employeeid) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (shipvia) REFERENCES shippers(shipperid) ON UPDATE CASCADE ON DELETE SET NULL
);

-- 11. Detalle de Líneas de Órdenes (M:N entre Orders y Products)
CREATE TABLE IF NOT EXISTS order_details (
    orderid INTEGER NOT NULL,
    productid INTEGER NOT NULL,
    unitprice REAL NOT NULL CHECK (unitprice >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    discount REAL NOT NULL DEFAULT 0.0 CHECK (discount >= 0 AND discount <= 1.0),
    PRIMARY KEY (orderid, productid),
    FOREIGN KEY (orderid) REFERENCES orders(orderid) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (productid) REFERENCES products(productid) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 12. Tabla auxiliar: Estados de EE.UU.
CREATE TABLE IF NOT EXISTS usstates (
    stateid INTEGER PRIMARY KEY,
    statename TEXT NOT NULL,
    stateabbr TEXT NOT NULL,
    stateregion TEXT
);

-- =====================================================================
-- ÍNDICES PARA OPTIMIZACIÓN ANALÍTICA Y DE UNIONES (JOINs)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customerid);
CREATE INDEX IF NOT EXISTS idx_orders_employee ON orders(employeeid);
CREATE INDEX IF NOT EXISTS idx_orders_orderdate ON orders(orderdate);
CREATE INDEX IF NOT EXISTS idx_order_details_product ON order_details(productid);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(categoryid);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplierid);
