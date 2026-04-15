import bcrypt             from "bcryptjs";
import { prisma }         from "../lib/prisma.js";
import { generateTokens } from "../middleware/errorHandler.js";
import { AppError, catchAsync } from "../utils/AppError.js";

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge:   7 * 24 * 60 * 60 * 1000,
};

const refreshExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

// Remove password antes de retornar
const safeUser = (user) => {
  const { password, ...rest } = user;
  return rest;
};

export const register = catchAsync(async (req, res) => {
  const { email, password, role, name, experienceLevel, techStack } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError("Email já cadastrado", 409);

  const hashed = await bcrypt.hash(password, 12);
  const user   = await prisma.user.create({
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
    data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry() },
  });

  res.cookie("refreshToken", refreshToken, COOKIE_OPTS);
  res.status(201).json({
    success: true,
    data: { accessToken, user: { id: user.id, email: user.email, role: user.role } },
  });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
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
    data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry() },
  });

  res.cookie("refreshToken", refreshToken, COOKIE_OPTS);

  const profile = user.qaProfile || user.developerProfile;
  res.json({
    success: true,
    data: {
      accessToken,
      user: { ...safeUser(user), name: profile?.name, profile },
    },
  });
});

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
    data:  { token: newRefresh, expiresAt: refreshExpiry() },
  });

  res.cookie("refreshToken", newRefresh, COOKIE_OPTS);
  res.json({ success: true, data: { accessToken } });
});

export const logout = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) await prisma.refreshToken.deleteMany({ where: { token } });
  res.clearCookie("refreshToken");
  res.json({ success: true, message: "Logout realizado com sucesso" });
});

export const getMe = catchAsync(async (req, res) => {
  const user = await prisma.user.findUnique({
    where:   { id: req.user.id },
    include: { qaProfile: true, developerProfile: true },
  });
  res.json({ success: true, data: { user: safeUser(user) } });
});
