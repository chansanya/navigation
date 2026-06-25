-- Add encrypted password vault storage.
-- Safe to run repeatedly; it does not delete or modify existing data.

CREATE TABLE IF NOT EXISTS password_vault_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salt TEXT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_vault_entries_updated
  ON password_vault_entries(updated_at DESC, id DESC);
