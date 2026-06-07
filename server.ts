import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  const configPath = path.join(process.cwd(), "config", "googleConfig.json");

  // Helper to ensure config dir and file exist with basic structure
  function getOrInitConfig() {
    try {
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      if (!fs.existsSync(configPath)) {
        const initialConfig = {
          spreadsheetId: "1BxiM-placeholder-id-ganti-dengan-spreadsheet-id-anda",
          appsScriptUrl: "https://script.google.com/macros/s/AKfycb-placeholder-url-ganti-dengan-web-app-url-anda/exec",
          sheetName: "BonPinjam"
        };
        fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), "utf8");
        return initialConfig;
      }
      const raw = fs.readFileSync(configPath, "utf8");
      return JSON.parse(raw);
    } catch (e) {
      console.error("Error reading/writing config file:", e);
      return {
        spreadsheetId: "",
        appsScriptUrl: "",
        sheetName: "BonPinjam"
      };
    }
  }

  // Middleware to support large sheet uploads and JSON payloads
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // API to fetch config from JSON file
  app.get("/api/config", (req, res) => {
    const config = getOrInitConfig();
    res.json(config);
  });

  // API to update config inside JSON file
  app.post("/api/config", (req, res) => {
    try {
      const { spreadsheetId, appsScriptUrl, sheetName } = req.body;
      const current = getOrInitConfig();
      const updated = {
        spreadsheetId: spreadsheetId !== undefined ? spreadsheetId.trim() : current.spreadsheetId,
        appsScriptUrl: appsScriptUrl !== undefined ? appsScriptUrl.trim() : current.appsScriptUrl,
        sheetName: sheetName !== undefined ? sheetName.trim() : current.sheetName
      };
      
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), "utf8");
      res.json({ success: true, config: updated });
    } catch (err: any) {
      console.error("Save config error:", err);
      res.status(500).json({ error: err.message || "Gagal menyimpan konfigurasi" });
    }
  });

  // API Proxy endpoint to bypass CORS, corporate firewalls, and credential issues
  app.post("/api/proxy", async (req, res) => {
    try {
      const { url, method, body } = req.body;
      if (!url) {
        return res.status(400).json({ error: "Missing 'url' parameter" });
      }

      const options: any = {
        method: method || "GET",
        headers: {
          "Accept": "application/json"
        }
      };

      if (method === "POST" && body) {
        options.headers["Content-Type"] = "application/json";
        options.body = typeof body === "string" ? body : JSON.stringify(body);
      }

      console.log(`Proxying ${method || 'GET'} request to: ${url}`);
      
      const response = await fetch(url, options);
      const text = await response.text();

      // Check if response is JSON, and send it as is. Otherwise return as string.
      try {
        const json = JSON.parse(text);
        res.json(json);
      } catch (parseErr) {
        res.json({ success: true, raw: text });
      }
    } catch (err: any) {
      console.error("Proxy error:", err);
      res.status(500).json({ error: err.message || "Failed to reach Google Apps Script" });
    }
  });

  // Vite development middleware vs Static Production files serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
