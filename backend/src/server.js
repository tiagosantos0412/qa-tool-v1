// src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

// ── Rotas ─────────────────────────────────────────
import authRoutes    from "./routes/auth.routes.js";
import userRoutes    from "./routes/user.routes.js";
import projectRoutes from "./routes/project.routes.js";
import ruleRoutes    from "./routes/rule.routes.js";
import testCaseRoutes from "./routes/testCase.routes.js";
import bugRoutes     from "./routes/bug.routes.js";
import cypressRoutes from "./routes/cypress.routes.js";
import aiRoutes      from "./routes/ai.routes.js";
import adminRoutes from './routes/admin.routes.js';

// ── Middleware ────────────────────────────────────
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound }     from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware global ─────────────────────────────
app.use(helmet());
app.use(morgan("dev"));
app.use(cors({
  origin:      process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods:     ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Servir uploads estáticos
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ── Rotas ─────────────────────────────────────────
const API = "/api/v1";

app.use(`${API}/auth`,       authRoutes);
app.use(`${API}/users`,      userRoutes);
app.use(`${API}/projects`,   projectRoutes);
app.use(`${API}/projects`,   ruleRoutes);      // /projects/:projectId/rules
app.use(`${API}/projects`,   testCaseRoutes);  // /projects/:projectId/test-cases
app.use(`${API}/projects`,   bugRoutes);       // /projects/:projectId/bugs
app.use(`${API}/cypress`,    cypressRoutes);
app.use(`${API}/ai`,         aiRoutes);
app.use(`${API}/admin`, adminRoutes);

// ── Health check ──────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Erro 404 e handler global ─────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 QA Platform API rodando na porta ${PORT}`);
  console.log(`📍 http://localhost:${PORT}/api/v1`);
  console.log(`💚 Health: http://localhost:${PORT}/health`);
});

export default app;