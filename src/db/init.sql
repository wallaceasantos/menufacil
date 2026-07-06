-- PostgreSQL 18 Initial Schema & Mock Data
-- Execute this script in your PostgreSQL database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. TENANTS (Restaurantes)
-- -----------------------------------------------------------------------------
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    document VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. USERS (Funcionários e Clientes)
-- -----------------------------------------------------------------------------
CREATE TYPE role_enum AS ENUM ('SUPER_ADMIN', 'ADMIN', 'STAFF', 'CUSTOMER');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role role_enum DEFAULT 'CUSTOMER',
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. SUBSCRIPTIONS
-- -----------------------------------------------------------------------------
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. CATEGORIES
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    "order" INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. PRODUCTS
-- -----------------------------------------------------------------------------
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    variations JSONB, -- JSON para Variações/Adicionais
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. ORDERS & ORDER ITEMS
-- -----------------------------------------------------------------------------
CREATE TYPE order_status_enum AS ENUM ('PENDING', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELED');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status order_status_enum DEFAULT 'PENDING',
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(100) NOT NULL,
    delivery_type VARCHAR(100) NOT NULL,
    delivery_address JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    selections JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- INDEXES PARA PERFORMANCE
-- -----------------------------------------------------------------------------
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_categories_tenant ON categories(tenant_id);
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);

-- -----------------------------------------------------------------------------
-- MOCK DATA
-- -----------------------------------------------------------------------------

-- Inserindo Tenants
INSERT INTO tenants (id, slug, name, document, is_active) VALUES
('b0e42d72-8822-4a00-988d-e08df053d20a', 'burger-king-xp', 'Burger King XP', '12345678000199', true),
('f285d852-6c2d-4251-ba81-12ec8af342bd', 'loft-coffee-22', 'Coffee Loft 22', '98765432000188', true),
('707cf600-4034-406f-b258-0056127b36f0', 'sushi-garden', 'Sushi Garden', '11122233000177', true),
('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'roma-pizza', 'Pizzeria Romana', '55566677000144', true);

-- Inserindo Assinaturas
INSERT INTO subscriptions (tenant_id, plan_name, status, expires_at) VALUES
('b0e42d72-8822-4a00-988d-e08df053d20a', 'Enterprise', 'active', '2027-12-31 23:59:59'),
('f285d852-6c2d-4251-ba81-12ec8af342bd', 'Pro', 'active', '2026-12-31 23:59:59'),
('707cf600-4034-406f-b258-0056127b36f0', 'Standard', 'past_due', '2026-05-01 23:59:59'),
('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Pro', 'active', '2027-01-15 23:59:59');

-- Inserindo Super Admin
INSERT INTO users (id, email, password, name, role, tenant_id) VALUES
('99999999-9999-4999-b999-999999999999', 'admin@saasfood.com', '$2b$10$X...', 'João Arquiteto', 'SUPER_ADMIN', NULL);

-- Inserindo Categorias (Burger King XP)
INSERT INTO categories (id, tenant_id, name, "order") VALUES
('c1000000-0000-0000-0000-000000000000', 'b0e42d72-8822-4a00-988d-e08df053d20a', 'Lanches', 1),
('c2000000-0000-0000-0000-000000000000', 'b0e42d72-8822-4a00-988d-e08df053d20a', 'Bebidas', 2);

-- Inserindo Produtos (Burger King XP)
INSERT INTO products (id, tenant_id, category_id, name, description, price, variations) VALUES
('p1000000-0000-0000-0000-000000000000', 'b0e42d72-8822-4a00-988d-e08df053d20a', 'c1000000-0000-0000-0000-000000000000', 'Mega Whopper', 'Hambúrguer duplo com queijo', 35.90, '{"adicionais": [{"nome": "Bacon", "preco": 4.50}, {"nome": "Queijo Extra", "preco": 3.00}]}'),
('p2000000-0000-0000-0000-000000000000', 'b0e42d72-8822-4a00-988d-e08df053d20a', 'c2000000-0000-0000-0000-000000000000', 'Refrigerante Cola', 'Lata 350ml', 8.50, '{}');

-- Inserindo Pedidos (Burger King XP)
INSERT INTO orders (id, tenant_id, status, total_amount, payment_method, delivery_type) VALUES
('o1000000-0000-0000-0000-000000000000', 'b0e42d72-8822-4a00-988d-e08df053d20a', 'PREPARING', 44.40, 'PIX', 'TAKEAWAY');

INSERT INTO order_items (order_id, product_id, quantity, unit_price, selections) VALUES
('o1000000-0000-0000-0000-000000000000', 'p1000000-0000-0000-0000-000000000000', 1, 35.90, '{"adicionais": ["Bacon"]}'),
('o1000000-0000-0000-0000-000000000000', 'p2000000-0000-0000-0000-000000000000', 1, 8.50, '{}');
