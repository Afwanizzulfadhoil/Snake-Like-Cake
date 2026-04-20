import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Database setup
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ DATABASE_URL is missing!");
    console.error("Please add it to the Secrets panel in AI Studio Settings.");
    console.error("URL provided: postgresql://neondb_owner:***@ep-raspy-scene-ao7t9x3e...");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl ? {
      rejectUnauthorized: false,
    } : false,
  });

  // Check DB connection and initialize table
  if (dbUrl) {
    try {
      const client = await pool.connect();
      console.log("✅ Connected to PostgreSQL successfully");
      await client.query(`
        CREATE TABLE IF NOT EXISTS leaderboard (
          id SERIAL PRIMARY KEY,
          score INTEGER NOT NULL,
          date TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      client.release();
    } catch (err) {
      console.error("❌ Database connection error:", err);
    }
  } else {
    console.warn("⚠️ Skipping database initialization because DATABASE_URL is not provided.");
  }

  app.use(express.json());

  // API Routes
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const result = await pool.query("SELECT score, date FROM leaderboard ORDER BY score DESC LIMIT 5");
      res.json(result.rows);
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.post("/api/leaderboard", async (req, res) => {
    const { score, date } = req.body;
    if (typeof score !== 'number' || !date) {
      return res.status(400).json({ error: "Invalid data" });
    }
    try {
      await pool.query("INSERT INTO leaderboard (score, date) VALUES ($1, $2)", [score, date]);
      res.json({ success: true });
    } catch (err) {
      console.error("Error saving score:", err);
      res.status(500).json({ error: "Failed to save score" });
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
