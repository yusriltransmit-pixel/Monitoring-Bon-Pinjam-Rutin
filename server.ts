import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to support large sheet uploads and JSON payloads
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

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
