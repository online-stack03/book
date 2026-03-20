import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Initialize SQLite database
const dbPath = path.join(process.cwd(), "diary.db");
const db = new Database(dbPath);

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    theme TEXT DEFAULT 'warm',
    font_color TEXT DEFAULT null,
    font_size INTEGER DEFAULT 16,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create categories table
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, user_id)
  )
`);

try {
  db.exec("INSERT OR IGNORE INTO users (id, username, theme) VALUES (1, 'default', 'warm')");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN font_color TEXT DEFAULT null");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN font_size INTEGER DEFAULT 16");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN accent_color TEXT DEFAULT null");
} catch (e) {}

// Create entries table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

try {
  db.exec("ALTER TABLE entries ADD COLUMN mood TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE entries ADD COLUMN summary TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE entries ADD COLUMN activities TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE entries ADD COLUMN user_id INTEGER DEFAULT 1");
} catch (e) {}
try {
  db.exec("ALTER TABLE entries ADD COLUMN tags TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE entries ADD COLUMN type TEXT DEFAULT 'normal'");
} catch (e) {}
try {
  db.exec("ALTER TABLE entries ADD COLUMN category TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN pin TEXT");
} catch (e) {}

// Create expenses table
db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    user_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Routes
  app.post("/api/login", (req, res) => {
    try {
      const { username, pin } = req.body;
      if (!username) return res.status(400).json({ error: "Username is required" });
      
      let user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
      if (!user) {
        const info = db.prepare("INSERT INTO users (username) VALUES (?)").run(username);
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
        return res.json({ ...user, hasPin: false });
      } else {
        if (user.pin) {
          if (!pin) {
            return res.status(401).json({ requiresPin: true });
          } else if (user.pin !== pin) {
            return res.status(401).json({ error: "密码错误" });
          }
        }
        const { pin: _pin, ...userWithoutPin } = user;
        return res.json({ ...userWithoutPin, hasPin: !!user.pin });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.put("/api/users/:id/pin", (req, res) => {
    try {
      const { pin } = req.body;
      db.prepare("UPDATE users SET pin = ? WHERE id = ?").run(pin || null, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("PIN update error:", error);
      res.status(500).json({ error: "Failed to update PIN" });
    }
  });

  app.put("/api/users/:id/theme", (req, res) => {
    try {
      const { theme } = req.body;
      db.prepare("UPDATE users SET theme = ? WHERE id = ?").run(theme, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Theme update error:", error);
      res.status(500).json({ error: "Failed to update theme" });
    }
  });

  app.put("/api/users/:id/font", (req, res) => {
    try {
      const { font_color, font_size, accent_color } = req.body;
      db.prepare("UPDATE users SET font_color = ?, font_size = ?, accent_color = ? WHERE id = ?").run(font_color || null, font_size || 16, accent_color || null, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Font update error:", error);
      res.status(500).json({ error: "Failed to update font settings" });
    }
  });

  app.post("/api/users/:id/import", (req, res) => {
    try {
      const { entries, expenses } = req.body;
      const userId = req.params.id;

      if (entries && Array.isArray(entries)) {
        const insertEntry = db.prepare(`
          INSERT INTO entries (user_id, content, image, mood, summary, activities, tags, type, category, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const transaction = db.transaction((items) => {
          for (const item of items) {
            insertEntry.run(
              userId,
              item.content,
              item.image || null,
              item.mood || null,
              item.summary || null,
              item.activities || null,
              item.tags || null,
              item.type || 'normal',
              item.category || null,
              item.created_at || new Date().toISOString()
            );
          }
        });
        transaction(entries);
      }

      if (expenses && Array.isArray(expenses)) {
        const insertExpense = db.prepare(`
          INSERT INTO expenses (user_id, amount, category, description, date, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const transaction = db.transaction((items) => {
          for (const item of items) {
            insertExpense.run(
              userId,
              item.amount,
              item.category,
              item.description || null,
              item.date,
              item.created_at || new Date().toISOString()
            );
          }
        });
        transaction(expenses);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ error: "Failed to import data" });
    }
  });

  app.get("/api/users/:id/categories", (req, res) => {
    try {
      const categories = db.prepare("SELECT * FROM categories WHERE user_id = ?").all(req.params.id);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/users/:id/categories", (req, res) => {
    try {
      const { name } = req.body;
      const result = db.prepare("INSERT INTO categories (name, user_id) VALUES (?, ?)").run(name, req.params.id);
      res.json({ id: result.lastInsertRowid, name });
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(400).json({ error: "Category already exists or failed to create" });
    }
  });

  app.delete("/api/categories/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  app.get("/api/entries", (req, res) => {
    try {
      const userId = req.query.userId || 1;
      const stmt = db.prepare("SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC");
      const entries = stmt.all(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching entries:", error);
      res.status(500).json({ error: "Failed to fetch entries" });
    }
  });

  app.post("/api/entries", (req, res) => {
    try {
      const { content, image, mood, summary, activities, tags, type, category, userId } = req.body;
      const uid = userId || 1;
      
      if (!content && !image) {
        return res.status(400).json({ error: "Content or image is required" });
      }

      const stmt = db.prepare("INSERT INTO entries (content, image, mood, summary, activities, tags, type, category, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
      const info = stmt.run(content || "", image || null, mood || null, summary || null, activities ? JSON.stringify(activities) : null, tags ? JSON.stringify(tags) : null, type || 'normal', category || null, uid);
      
      const newEntry = db.prepare("SELECT * FROM entries WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json(newEntry);
    } catch (error) {
      console.error("Error creating entry:", error);
      res.status(500).json({ error: "Failed to create entry" });
    }
  });

  app.delete("/api/entries/:id", (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.query.userId || 1;
      const stmt = db.prepare("DELETE FROM entries WHERE id = ? AND user_id = ?");
      const info = stmt.run(id, userId);
      
      if (info.changes === 0) {
        return res.status(404).json({ error: "Entry not found or unauthorized" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting entry:", error);
      res.status(500).json({ error: "Failed to delete entry" });
    }
  });

  app.get("/api/expenses", (req, res) => {
    try {
      const userId = req.query.userId || 1;
      const stmt = db.prepare("SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, created_at DESC");
      const expenses = stmt.all(userId);
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", (req, res) => {
    try {
      const { amount, category, description, date, userId } = req.body;
      const uid = userId || 1;
      
      if (!amount || !category || !date) {
        return res.status(400).json({ error: "Amount, category, and date are required" });
      }

      const stmt = db.prepare("INSERT INTO expenses (amount, category, description, date, user_id) VALUES (?, ?, ?, ?, ?)");
      const info = stmt.run(amount, category, description || null, date, uid);
      
      const newExpense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json(newExpense);
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.delete("/api/expenses/:id", (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.query.userId || 1;
      const stmt = db.prepare("DELETE FROM expenses WHERE id = ? AND user_id = ?");
      const info = stmt.run(id, userId);
      
      if (info.changes === 0) {
        return res.status(404).json({ error: "Expense not found or unauthorized" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
