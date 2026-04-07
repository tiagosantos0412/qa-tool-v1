// src/middleware/errorHandler.js
import jwt           from "jsonwebtoken";
import { prisma }    from "../lib/prisma.js";
import { AppError }  from "../utils/AppError.js";

// ── Handler global de erros ───────────────────────
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isDev      = process.env.NODE_ENV === "development";

  if (err.code === "P2025") return res.status(404).json({ success: false, message: "Registro não encontrado" });
  if (err.code === "P2002") return res.status(409).json({ success: false, message: `Valor duplicado: ${err.meta?.target?.join(", ")}` });
  if (err.code === "P2003") return res.status(400).json({ success: false, message: "Referência inválida" });

  res.status(statusCode).json({
    success: false,
    message: err.message || "Erro interno do servidor",
    ...(isDev && { stack: err.stack }),
  });
};

// ── 404 ───────────────────────────────────────────
export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  });
};

// ── Autenticação JWT ──────────────────────────────
export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token  = header?.startsWith("Bearer ") ? header.split(" ")[1] : null;
    if (!token) throw new AppError("Token não fornecido", 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where:  { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) throw new AppError("Usuário não encontrado ou inativo", 401);

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") return next(new AppError("Token inválido", 401));
    if (error.name === "TokenExpiredError") return next(new AppError("Token expirado", 401));
    next(error);
  }
};

// ── RBAC ─────────────────────────────────────────
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError(`Acesso negado. Papéis permitidos: ${roles.join(", ")}`, 403));
  }
  next();
};

// ── Gerar tokens JWT ──────────────────────────────
export const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );
  return { accessToken, refreshToken };
};

// ── Validação express-validator ───────────────────
export const validate = (schema) => async (req, res, next) => {
  await Promise.all(schema.map((rule) => rule.run(req)));
  const { validationResult } = await import("express-validator");
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Dados inválidos",
      errors:  errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};
