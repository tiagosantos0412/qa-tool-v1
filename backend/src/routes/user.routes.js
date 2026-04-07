// src/routes/user.routes.js
import { Router } from "express";
import { authenticate } from "../middleware/errorHandler.js";
import { prisma }       from "../lib/prisma.js";
import { catchAsync }   from "../utils/AppError.js";

const router = Router();
router.use(authenticate);

// GET /users/developers — lista developers para dropdowns
router.get("/developers", catchAsync(async (req, res) => {
  const developers = await prisma.user.findMany({
    where:   { role: "DEVELOPER", isActive: true },
    select: {
      id:    true,
      email: true,
      developerProfile: { select: { name: true, techStack: true, team: true } },
      _count: { select: { assignedBugs: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } } } },
    },
    orderBy: { developerProfile: { name: "asc" } },
  });
  res.json({ success: true, data: { developers } });
}));

// GET /users/:id
router.get("/:userId", catchAsync(async (req, res) => {
  const user = await prisma.user.findUnique({
    where:   { id: req.params.userId },
    include: { qaProfile: true, developerProfile: true },
  });
  if (!user) return res.status(404).json({ success: false, message: "Usuário não encontrado" });
  res.json({ success: true, data: { user } });
}));

export default router;

// ─────────────────────────────────────────────────
// src/routes/project.routes.js
import { Router as PRouter } from "express";
import { authenticate as pAuth } from "../middleware/errorHandler.js";
import { prisma as pPrisma }     from "../lib/prisma.js";
import { catchAsync as pAsync }  from "../utils/AppError.js";
import { AppError as PAppError } from "../utils/AppError.js";

export const projectRouter = PRouter();
projectRouter.use(pAuth);

projectRouter.get("/", pAsync(async (req, res) => {
  const { search } = req.query;
  const projects = await pPrisma.project.findMany({
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

projectRouter.post("/", pAsync(async (req, res) => {
  const { name, objective, actors, description } = req.body;
  const project = await pPrisma.project.create({
    data: { name, objective, actors: actors || [], description, createdById: req.user.id },
    include: { createdBy: { include: { qaProfile: { select: { name: true } } } } },
  });
  res.status(201).json({ success: true, data: { project } });
}));

projectRouter.get("/:projectId", pAsync(async (req, res) => {
  const project = await pPrisma.project.findUnique({
    where:   { id: req.params.projectId },
    include: {
      createdBy:     { include: { qaProfile: { select: { name: true } } } },
      businessRules: { orderBy: { ruleCode: "asc" }, include: { _count: { select: { testCases: true } } } },
      testCases:     { orderBy: { testCode: "asc" }, include: { businessRule: { select: { ruleCode: true } } } },
      bugs:          { orderBy: { createdAt: "desc" }, take: 5 },
      _count:        { select: { businessRules: true, testCases: true, bugs: true } },
    },
  });
  if (!project) throw new PAppError("Projeto não encontrado", 404);
  res.json({ success: true, data: { project } });
}));

projectRouter.put("/:projectId", pAsync(async (req, res) => {
  const { name, objective, actors, description, isArchived } = req.body;
  const project = await pPrisma.project.update({
    where: { id: req.params.projectId },
    data:  { name, objective, actors, description, isArchived },
  });
  res.json({ success: true, data: { project } });
}));

projectRouter.delete("/:projectId", pAsync(async (req, res) => {
  await pPrisma.project.delete({ where: { id: req.params.projectId } });
  res.json({ success: true, message: "Projeto excluído" });
}));

projectRouter.get("/:projectId/stats", pAsync(async (req, res) => {
  const { projectId } = req.params;
  const [totalRules, totalTests, totalBugs, openBugs, criticalBugs] = await Promise.all([
    pPrisma.businessRule.count({ where: { projectId } }),
    pPrisma.testCase.count({ where: { projectId } }),
    pPrisma.bug.count({ where: { projectId } }),
    pPrisma.bug.count({ where: { projectId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    pPrisma.bug.count({ where: { projectId, severity: { in: ["HIGH", "CRITICAL"] }, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);
  res.json({ success: true, data: { overview: { totalRules, totalTests, totalBugs, openBugs, criticalBugs } } });
}));