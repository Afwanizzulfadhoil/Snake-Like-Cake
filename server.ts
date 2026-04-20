import express from "express";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const { Pool } = pg;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Database setup
  const dbUrl = process.env.DATABASE_URL;
  
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
  }

  app.use(express.json());

  // Serve static files from the 'public' directory
  app.use(express.static(path.join(__dirname, "public")));

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

  // Serve index.html for all other requests (SPA behavior if needed)
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
