// src/routes/rule.routes.js
import { Router }   from "express";
import { authenticate } from "../middleware/errorHandler.js";
import { prisma }   from "../lib/prisma.js";
import { catchAsync, AppError } from "../utils/AppError.js";
import { generateRuleCode } from "../utils/helpers.js";

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get("/:projectId/rules", catchAsync(async (req, res) => {
  const rules = await prisma.businessRule.findMany({
    where:   { projectId: req.params.projectId },
    orderBy: { ruleCode: "asc" },
    include: { _count: { select: { testCases: true } } },
  });
  res.json({ success: true, data: { rules } });
}));

router.post("/:projectId/rules", catchAsync(async (req, res) => {
  const { description, ruleCode: custom } = req.body;
  if (!description) throw new AppError("Descrição é obrigatória", 400);
  const ruleCode = custom || await generateRuleCode(req.params.projectId);
  const rule = await prisma.businessRule.create({
    data: { ruleCode, description, projectId: req.params.projectId, createdById: req.user.id },
  });
  res.status(201).json({ success: true, data: { rule } });
}));

router.put("/:projectId/rules/:ruleId", catchAsync(async (req, res) => {
  const { description } = req.body;
  const rule = await prisma.businessRule.update({
    where: { id: req.params.ruleId },
    data:  { description },
  });
  res.json({ success: true, data: { rule } });
}));

router.delete("/:projectId/rules/:ruleId", catchAsync(async (req, res) => {
  await prisma.businessRule.delete({ where: { id: req.params.ruleId } });
  res.json({ success: true, message: "Regra excluída" });
}));

export default router;