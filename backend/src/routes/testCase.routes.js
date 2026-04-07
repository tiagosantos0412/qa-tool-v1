// src/routes/testCase.routes.js
import { Router }   from "express";
import { authenticate } from "../middleware/errorHandler.js";
import { prisma }   from "../lib/prisma.js";
import { catchAsync, AppError } from "../utils/AppError.js";
import { generateTestCode } from "../utils/helpers.js";

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get("/:projectId/test-cases", catchAsync(async (req, res) => {
  const { output, riskLevel } = req.query;
  const testCases = await prisma.testCase.findMany({
    where: {
      projectId: req.params.projectId,
      ...(output    && { output }),
      ...(riskLevel && { riskLevel }),
    },
    orderBy: { testCode: "asc" },
    include: {
      businessRule: { select: { ruleCode: true } },
      createdBy:    { include: { qaProfile: { select: { name: true } } } },
      cypressRuns:  { orderBy: { triggeredAt: "desc" }, take: 1, select: { status: true, duration: true } },
    },
  });
  res.json({ success: true, data: { testCases } });
}));

router.post("/:projectId/test-cases", catchAsync(async (req, res) => {
  const { title, description, steps, expectedResult, output, riskLevel, businessRuleId, isAiGenerated } = req.body;
  if (!title || !expectedResult || !output) throw new AppError("Título, resultado esperado e output são obrigatórios", 400);
  const testCode = await generateTestCode(req.params.projectId);
  const testCase = await prisma.testCase.create({
    data: {
      testCode, title, description, steps: steps || [],
      expectedResult, output, riskLevel: riskLevel || "MEDIUM",
      projectId: req.params.projectId, createdById: req.user.id,
      businessRuleId: businessRuleId || null,
      isAiGenerated: isAiGenerated || false,
    },
    include: { businessRule: { select: { ruleCode: true } } },
  });
  res.status(201).json({ success: true, data: { testCase } });
}));

router.get("/:projectId/test-cases/:testCaseId", catchAsync(async (req, res) => {
  const testCase = await prisma.testCase.findUnique({
    where:   { id: req.params.testCaseId },
    include: {
      businessRule: true,
      createdBy:    { include: { qaProfile: { select: { name: true } } } },
      cypressRuns:  { orderBy: { triggeredAt: "desc" }, take: 10 },
    },
  });
  if (!testCase) throw new AppError("Caso de teste não encontrado", 404);
  res.json({ success: true, data: { testCase } });
}));

router.put("/:projectId/test-cases/:testCaseId", catchAsync(async (req, res) => {
  const { title, description, steps, expectedResult, actualResult, output, riskLevel, businessRuleId } = req.body;
  const testCase = await prisma.testCase.update({
    where: { id: req.params.testCaseId },
    data:  {
      ...(title          !== undefined && { title }),
      ...(description    !== undefined && { description }),
      ...(steps          !== undefined && { steps }),
      ...(expectedResult !== undefined && { expectedResult }),
      ...(actualResult   !== undefined && { actualResult }),
      ...(output         !== undefined && { output }),
      ...(riskLevel      !== undefined && { riskLevel }),
      ...(businessRuleId !== undefined && { businessRuleId }),
    },
  });
  res.json({ success: true, data: { testCase } });
}));

router.delete("/:projectId/test-cases/:testCaseId", catchAsync(async (req, res) => {
  await prisma.testCase.delete({ where: { id: req.params.testCaseId } });
  res.json({ success: true, message: "Caso de teste excluído" });
}));

export default router;