-- Reference schema for Pig Farm Ledger's app tables.
-- Floot has its own provisioned database and auth tables already. Do not run this
-- against the existing database unless you have reviewed the schema first.

CREATE TABLE IF NOT EXISTS farms (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'My Piggery',
  pig_count INTEGER NOT NULL DEFAULT 0 CHECK (pig_count >= 0),
  start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  qty NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (qty >= 0),
  unit TEXT NOT NULL DEFAULT '',
  price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  line_total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS expenses_user_date_idx ON expenses (user_id, date DESC);

CREATE TABLE IF NOT EXISTS sales (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  buyer TEXT NOT NULL DEFAULT '',
  heads INTEGER NOT NULL DEFAULT 0 CHECK (heads >= 0),
  weight_kg NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
  price_per_kg NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (price_per_kg >= 0),
  gross NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (gross >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS sales_user_date_idx ON sales (user_id, date DESC);
