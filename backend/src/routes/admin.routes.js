// src/routes/admin.routes.js
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import bcrypt from 'bcryptjs';

const router = Router();

// Todas as rotas aqui exigem estar logado E ser ADMIN
router.use(authenticate);
router.use(authorize('ADMIN'));

// ── GET /admin/users ─────────────────────────────
// Listar todos os usuários com perfil e contagens
router.get('/users', catchAsync(async (req, res) => {
  const { role, search, isActive } = req.query;

  const where = {};
  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { qaProfile:        { name: { contains: search, mode: 'insensitive' } } },
      { developerProfile: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, role: true,
      isActive: true, createdAt: true,
      qaProfile:        { select: { name: true, experienceLevel: true } },
      developerProfile: { select: { name: true, team: true } },
      _count: {
        select: {
          createdBugs:  true,
          assignedBugs: true,
          createdProjects: true,
        },
      },
    },
  });

  res.json({ success: true, data: { users } });
}));

// ── POST /admin/users ────────────────────────────
// Admin cria novo usuário (QA, DEVELOPER ou ADMIN)
router.post('/users', catchAsync(async (req, res) => {
  const { email, password, role, name, experienceLevel, techStack, team } = req.body;

  if (!email || !password || !role || !name) {
    throw new AppError('email, password, role e name são obrigatórios', 400);
  }
  if (!['QA', 'DEVELOPER', 'ADMIN'].includes(role)) {
    throw new AppError('role deve ser QA, DEVELOPER ou ADMIN', 400);
  }
  if (password.length < 8) {
    throw new AppError('A senha deve ter pelo menos 8 caracteres', 400);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('Email já cadastrado', 409);

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email, password: hashed, role },
  });

  // Criar perfil conforme o papel
  if (role === 'QA') {
    await prisma.qAProfile.create({
      data: {
        userId: user.id,
        name,
        experienceLevel: experienceLevel || 'JUNIOR',
      },
    });
  } else if (role === 'DEVELOPER') {
    await prisma.developerProfile.create({
      data: {
        userId: user.id,
        name,
        techStack: techStack || [],
        team: team || null,
      },
    });
  }
  // ADMIN não tem perfil específico

  // Retornar usuário criado sem a senha
  const created = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, email: true, role: true, isActive: true, createdAt: true,
      qaProfile:        { select: { name: true, experienceLevel: true } },
      developerProfile: { select: { name: true, team: true } },
    },
  });

  res.status(201).json({ success: true, data: { user: created } });
}));

// ── PATCH /admin/users/:userId ───────────────────
// Atualizar dados ou redefinir senha
router.patch('/users/:userId', catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { name, experienceLevel, techStack, team, isActive, newPassword } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { qaProfile: true, developerProfile: true },
  });
  if (!user) throw new AppError('Usuário não encontrado', 404);

  // Redefinir senha
  if (newPassword) {
    if (newPassword.length < 8) {
      throw new AppError('A nova senha deve ter pelo menos 8 caracteres', 400);
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
    // Invalidar todos os tokens ativos
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }

  // Ativar/desativar conta
  if (isActive !== undefined) {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
    if (!isActive) {
      await prisma.refreshToken.deleteMany({ where: { userId } });
    }
  }

  // Atualizar perfil QA
  if (user.role === 'QA' && user.qaProfile && (name || experienceLevel)) {
    await prisma.qAProfile.update({
      where: { userId },
      data: {
        ...(name             && { name }),
        ...(experienceLevel  && { experienceLevel }),
      },
    });
  }

  // Atualizar perfil Developer
  if (user.role === 'DEVELOPER' && user.developerProfile && (name || techStack || team !== undefined)) {
    await prisma.developerProfile.update({
      where: { userId },
      data: {
        ...(name       && { name }),
        ...(techStack  && { techStack }),
        ...(team !== undefined && { team }),
      },
    });
  }

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, role: true, isActive: true,
      qaProfile:        { select: { name: true, experienceLevel: true } },
      developerProfile: { select: { name: true, team: true } },
    },
  });

  res.json({ success: true, data: { user: updated } });
}));

// ── DELETE /admin/users/:userId ──────────────────
// Desativar conta (soft delete — não apaga do banco)
router.delete('/users/:userId', catchAsync(async (req, res) => {
  const { userId } = req.params;

  if (userId === req.user.id) {
    throw new AppError('Você não pode desativar sua própria conta', 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Usuário não encontrado', 404);

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });
  await prisma.refreshToken.deleteMany({ where: { userId } });

  res.json({ success: true, message: 'Conta desativada com sucesso' });
}));

// ── GET /admin/stats ─────────────────────────────
// Estatísticas gerais do sistema para o painel admin
router.get('/stats', catchAsync(async (req, res) => {
  const [
    totalUsers, qaCount, devCount, adminCount,
    activeUsers, totalProjects, totalBugs, openBugs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'QA' } }),
    prisma.user.count({ where: { role: 'DEVELOPER' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.project.count({ where: { isArchived: false } }),
    prisma.bug.count(),
    prisma.bug.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
  ]);

  res.json({
    success: true,
    data: {
      users: { total: totalUsers, qa: qaCount, developer: devCount, admin: adminCount, active: activeUsers },
      system: { projects: totalProjects, totalBugs, openBugs },
    },
  });
}));

export default router;