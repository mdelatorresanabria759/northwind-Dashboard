-- =====================================================================
-- PROYECTO ACADÉMICO NORTHWIND: ESQUEMA DDL POSTGRESQL (ANSI COMPLIANT)
-- =====================================================================

DROP TABLE IF EXISTS order_details CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS employeeterritories CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS shippers CASCADE;
DROP TABLE IF EXISTS territories CASCADE;
DROP TABLE IF EXISTS region CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS usstates CASCADE;

CREATE TABLE region (
    regionid INT PRIMARY KEY,
    regiondescription VARCHAR(50) NOT NULL
);

CREATE TABLE territories (
    territoryid VARCHAR(20) PRIMARY KEY,
    territorydescription VARCHAR(50) NOT NULL,
    regionid INT NOT NULL,
    CONSTRAINT fk_territories_region FOREIGN KEY (regionid) REFERENCES region(regionid) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE categories (
    categoryid INT PRIMARY KEY,
    categoryname VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    picture BYTEA
);

CREATE TABLE suppliers (
    supplierid INT PRIMARY KEY,
    companyname VARCHAR(100) NOT NULL,
    contactname VARCHAR(100),
    contacttitle VARCHAR(100),
    address VARCHAR(200),
    city VARCHAR(100),
    region VARCHAR(50),
    postalcode VARCHAR(20),
    country VARCHAR(50),
    phone VARCHAR(30),
    fax VARCHAR(30),
    homepage TEXT
);

CREATE TABLE customers (
    customerid VARCHAR(10) PRIMARY KEY,
    companyname VARCHAR(100) NOT NULL,
    contactname VARCHAR(100),
    contacttitle VARCHAR(100),
    address VARCHAR(200),
    city VARCHAR(100),
    region VARCHAR(50),
    postalcode VARCHAR(20),
    country VARCHAR(50),
    phone VARCHAR(30),
    fax VARCHAR(30)
);

CREATE TABLE employees (
    employeeid INT PRIMARY KEY,
    lastname VARCHAR(50) NOT NULL,
    firstname VARCHAR(50) NOT NULL,
    title VARCHAR(50),
    titleofcourtesy VARCHAR(20),
    birthdate TIMESTAMP,
    hiredate TIMESTAMP,
    address VARCHAR(200),
    city VARCHAR(100),
    region VARCHAR(50),
    postalcode VARCHAR(20),
    country VARCHAR(50),
    homephone VARCHAR(30),
    extension VARCHAR(10),
    photo BYTEA,
    notes TEXT,
    reportsto INT,
    photopath VARCHAR(255),
    CONSTRAINT fk_employees_manager FOREIGN KEY (reportsto) REFERENCES employees(employeeid) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE employeeterritories (
    employeeid INT NOT NULL,
    territoryid VARCHAR(20) NOT NULL,
    PRIMARY KEY (employeeid, territoryid),
    CONSTRAINT fk_empterr_employee FOREIGN KEY (employeeid) REFERENCES employees(employeeid) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_empterr_territory FOREIGN KEY (territoryid) REFERENCES territories(territoryid) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE shippers (
    shipperid INT PRIMARY KEY,
    companyname VARCHAR(100) NOT NULL,
    phone VARCHAR(30)
);

CREATE TABLE products (
    productid INT PRIMARY KEY,
    productname VARCHAR(100) NOT NULL,
    supplierid INT,
    categoryid INT,
    quantityperunit VARCHAR(50),
    unitprice NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (unitprice >= 0),
    unitsinstock INT NOT NULL DEFAULT 0 CHECK (unitsinstock >= 0),
    unitsonorder INT NOT NULL DEFAULT 0 CHECK (unitsonorder >= 0),
    reorderlevel INT NOT NULL DEFAULT 0 CHECK (reorderlevel >= 0),
    discontinued SMALLINT NOT NULL DEFAULT 0 CHECK (discontinued IN (0, 1)),
    CONSTRAINT fk_products_supplier FOREIGN KEY (supplierid) REFERENCES suppliers(supplierid) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_products_category FOREIGN KEY (categoryid) REFERENCES categories(categoryid) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE orders (
    orderid INT PRIMARY KEY,
    customerid VARCHAR(10),
    employeeid INT,
    orderdate TIMESTAMP,
    requireddate TIMESTAMP,
    shippeddate TIMESTAMP,
    shipvia INT,
    freight NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (freight >= 0),
    shipname VARCHAR(100),
    shipaddress VARCHAR(200),
    shipcity VARCHAR(100),
    shipregion VARCHAR(50),
    shippostalcode VARCHAR(20),
    shipcountry VARCHAR(50),
    CONSTRAINT fk_orders_customer FOREIGN KEY (customerid) REFERENCES customers(customerid) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_orders_employee FOREIGN KEY (employeeid) REFERENCES employees(employeeid) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_orders_shipper FOREIGN KEY (shipvia) REFERENCES shippers(shipperid) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE order_details (
    orderid INT NOT NULL,
    productid INT NOT NULL,
    unitprice NUMERIC(10,2) NOT NULL CHECK (unitprice >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    discount NUMERIC(4,3) NOT NULL DEFAULT 0.000 CHECK (discount >= 0 AND discount <= 1.000),
    PRIMARY KEY (orderid, productid),
    CONSTRAINT fk_orderdetails_order FOREIGN KEY (orderid) REFERENCES orders(orderid) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_orderdetails_product FOREIGN KEY (productid) REFERENCES products(productid) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE usstates (
    stateid INT PRIMARY KEY,
    statename VARCHAR(100) NOT NULL,
    stateabbr VARCHAR(2) NOT NULL,
    stateregion VARCHAR(50)
);

CREATE INDEX idx_orders_customer ON orders(customerid);
CREATE INDEX idx_orders_employee ON orders(employeeid);
CREATE INDEX idx_orders_orderdate ON orders(orderdate);
CREATE INDEX idx_order_details_product ON order_details(productid);
CREATE INDEX idx_products_category ON products(categoryid);
CREATE INDEX idx_products_supplier ON products(supplierid);
