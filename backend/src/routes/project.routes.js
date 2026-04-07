// src/routes/project.routes.js
import { Router }     from "express";
import { authenticate } from "../middleware/errorHandler.js";
import { prisma }     from "../lib/prisma.js";
import { catchAsync, AppError } from "../utils/AppError.js";

const router = Router();
router.use(authenticate);

// GET /projects
router.get("/", catchAsync(async (req, res) => {
  const { search } = req.query;
  const projects = await prisma.project.findMany({
    where: {
      isArchived: false,
      ...(search && { OR: [
        { name:      { contains: search, mode: "insensitive" } },
        { objective: { contains: search, mode: "insensitive" } },
      ]}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { include: { qaProfile: { select: { name: true } } } },
      _count: { select: { businessRules: true, testCases: true, bugs: true } },
    },
  });
  res.json({ success: true, data: { projects } });
}));

// POST /projects
router.post("/", catchAsync(async (req, res) => {
  const { name, objective, actors, description } = req.body;
  if (!name || !objective) throw new AppError("Nome e objetivo são obrigatórios", 400);
  const project = await prisma.project.create({
    data: { name, objective, actors: actors || [], description, createdById: req.user.id },
    include: { createdBy: { include: { qaProfile: { select: { name: true } } } } },
  });
  res.status(201).json({ success: true, data: { project } });
}));

// GET /projects/:projectId
router.get("/:projectId", catchAsync(async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.projectId },
    include: {
      createdBy:     { include: { qaProfile: { select: { name: true } } } },
      businessRules: { orderBy: { ruleCode: "asc" }, include: { _count: { select: { testCases: true } } } },
      testCases:     { orderBy: { testCode: "asc" }, include: { businessRule: { select: { ruleCode: true } } } },
      bugs:          { orderBy: { createdAt: "desc" }, take: 5, include: {
        reportedBy: { include: { qaProfile: { select: { name: true } } } },
        assignedTo: { include: { developerProfile: { select: { name: true } } } },
      }},
      _count: { select: { businessRules: true, testCases: true, bugs: true } },
    },
  });
  if (!project) throw new AppError("Projeto não encontrado", 404);
  res.json({ success: true, data: { project } });
}));

// PUT /projects/:projectId
router.put("/:projectId", catchAsync(async (req, res) => {
  const { name, objective, actors, description, isArchived } = req.body;
  const project = await prisma.project.update({
    where: { id: req.params.projectId },
    data:  {
      ...(name        !== undefined && { name }),
      ...(objective   !== undefined && { objective }),
      ...(actors      !== undefined && { actors }),
      ...(description !== undefined && { description }),
      ...(isArchived  !== undefined && { isArchived }),
    },
  });
  res.json({ success: true, data: { project } });
}));

// DELETE /projects/:projectId
router.delete("/:projectId", catchAsync(async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.projectId } });
  res.json({ success: true, message: "Projeto excluído com sucesso" });
}));

// GET /projects/:projectId/stats
router.get("/:projectId/stats", catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const [totalRules, totalTests, totalBugs, openBugs, criticalBugs, bugsBySeverity, bugsByStatus] = await Promise.all([
    prisma.businessRule.count({ where: { projectId } }),
    prisma.testCase.count({ where: { projectId } }),
    prisma.bug.count({ where: { projectId } }),
    prisma.bug.count({ where: { projectId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.bug.count({ where: { projectId, severity: { in: ["HIGH", "CRITICAL"] }, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.bug.groupBy({ by: ["severity"], where: { projectId }, _count: { severity: true } }),
    prisma.bug.groupBy({ by: ["status"],   where: { projectId }, _count: { status: true } }),
  ]);

  res.json({
    success: true,
    data: {
      overview: { totalRules, totalTests, totalBugs, openBugs, criticalBugs },
      bugs: {
        bySeverity: bugsBySeverity.reduce((a, g) => ({ ...a, [g.severity]: g._count.severity }), {}),
        byStatus:   bugsByStatus.reduce((a, g)   => ({ ...a, [g.status]:   g._count.status }),   {}),
      },
    },
  });
}));

export default router;