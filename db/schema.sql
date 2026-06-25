-- 站点表
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,
  category TEXT DEFAULT 'other',
  description TEXT,
  sort INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建分类索引
CREATE INDEX IF NOT EXISTS idx_sites_category ON sites(category);

-- 创建排序索引
CREATE INDEX IF NOT EXISTS idx_sites_sort ON sites(sort DESC, id ASC);

-- 用户推荐投稿表（审核后才进入 sites）
CREATE TABLE IF NOT EXISTS site_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,
  category TEXT DEFAULT '其他',
  description TEXT,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  review_note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_submissions_status ON site_submissions(status, created_at DESC);

-- 快捷方式表（搜索页展示，管理员维护）
CREATE TABLE IF NOT EXISTS shortcuts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shortcuts_sort ON shortcuts(sort DESC, id ASC);
CREATE INDEX IF NOT EXISTS idx_shortcuts_site_id ON shortcuts(site_id);

-- 密码本表（只保存前端加密后的密文）
CREATE TABLE IF NOT EXISTS password_vault_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salt TEXT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_vault_entries_updated ON password_vault_entries(updated_at DESC, id DESC);

-- 全局设置表
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化默认设置
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('siteTitle', '"Nav"'),
  ('siteLogo', '""'),
  ('theme', '"glass"'),
  ('background', '{"type":"particles","value":"default"}'),
  ('appearance', '{"topbarBgColor":"#0f172a","topbarTextColor":"#ffffff","topbarBorderColor":"#ffffff","topbarOpacity":0.05,"topbarFontWeight":600,"menuBgColor":"#0f172a","menuActiveBgColor":"#667eea","menuTextColor":"#ffffff","menuBorderColor":"#ffffff","menuOpacity":0.03,"menuFontWeight":500,"cardBgColor":"#0f172a","cardTextColor":"#ffffff","cardBorderColor":"#ffffff","cardOpacity":0.1,"cardFontWeight":600}'),
  ('presets', '[]');

-- 分类表
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);