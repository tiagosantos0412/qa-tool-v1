// src/controllers/auth.controller.js
import bcrypt             from "bcryptjs";
import { prisma }         from "../lib/prisma.js";
import { generateTokens } from "../middleware/errorHandler.js";
import { AppError, catchAsync } from "../utils/AppError.js";

// ── REGISTER ──────────────────────────────────────
export const register = catchAsync(async (req, res) => {
  const { email, password, role, name, experienceLevel, techStack } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError("Email já cadastrado", 409);

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email, password: hashed, role: role || "QA" },
  });

  if (user.role === "QA") {
    await prisma.qAProfile.create({
      data: { userId: user.id, name, experienceLevel: experienceLevel || "JUNIOR" },
    });
  } else if (user.role === "DEVELOPER") {
    await prisma.developerProfile.create({
      data: { userId: user.id, name, techStack: techStack || [] },
    });
  }

  const { accessToken, refreshToken } = generateTokens(user.id);

  await prisma.refreshToken.create({
    data: {
      token:     refreshToken,
      userId:    user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    success: true,
    data: { accessToken, user: { id: user.id, email: user.email, role: user.role } },
  });
});

// ── LOGIN ─────────────────────────────────────────
export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  // omitPassword: false para recuperar o hash nesta query específica
  const user = await prisma.user.findUnique({
    where:  { email },
    omit:   { password: false },   // sobrescreve o omit global só aqui
    include: {
      qaProfile:        { select: { name: true, experienceLevel: true } },
      developerProfile: { select: { name: true, techStack: true } },
    },
  });

  if (!user || !user.isActive) throw new AppError("Credenciais inválidas", 401);

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new AppError("Credenciais inválidas", 401);

  const { accessToken, refreshToken } = generateTokens(user.id);

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.refreshToken.create({
    data: {
      token:     refreshToken,
      userId:    user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });

  const profile = user.qaProfile || user.developerProfile;

  // Remover senha do objeto antes de retornar
  const { password: _pw, ...safeUser } = user;

  res.json({
    success: true,
    data: {
      accessToken,
      user: { ...safeUser, name: profile?.name, profile },
    },
  });
});

// ── REFRESH TOKEN ─────────────────────────────────
export const refreshAccessToken = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) throw new AppError("Refresh token não fornecido", 401);

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError("Refresh token inválido ou expirado", 401);
  }

  const { accessToken, refreshToken: newRefresh } = generateTokens(stored.userId);

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: {
      token:     newRefresh,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie("refreshToken", newRefresh, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });

  res.json({ success: true, data: { accessToken } });
});

// ── LOGOUT ────────────────────────────────────────
export const logout = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) await prisma.refreshToken.deleteMany({ where: { token } });
  res.clearCookie("refreshToken");
  res.json({ success: true, message: "Logout realizado com sucesso" });
});

// ── ME ────────────────────────────────────────────
export const getMe = catchAsync(async (req, res) => {
  const user = await prisma.user.findUnique({
    where:   { id: req.user.id },
    include: { qaProfile: true, developerProfile: true },
  });
  res.json({ success: true, data: { user } });
});
