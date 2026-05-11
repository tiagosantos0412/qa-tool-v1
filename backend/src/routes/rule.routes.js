// src/routes/rule.routes.js
import { Router }   from "express";
import { authenticate } from "../middleware/errorHandler.js";
import { prisma }   from "../lib/prisma.js";
import { catchAsync, AppError } from "../utils/AppError.js";
import { generateRuleCode } from "../utils/helpers.js";

const router = Router({ mergeParams: true });
router.use(authenticate);

// Listar regras
router.get("/:projectId/rules", catchAsync(async (req, res) => {
  const rules = await prisma.businessRule.findMany({
    where:   { projectId: req.params.projectId },
    orderBy: { ruleCode: "asc" },
    include: { _count: { select: { testCases: true } } },
  });
  res.json({ success: true, data: { rules } });
}));

// Criar regra (POST) - Com suporte a module
router.post("/:projectId/rules", catchAsync(async (req, res) => {
  const { description, ruleCode: custom, module } = req.body;

  if (!description) throw new AppError("Descrição é obrigatória", 400);

  const ruleCode = custom || await generateRuleCode(req.params.projectId);

  const rule = await prisma.businessRule.create({
    data: {
      ruleCode,
      description,
      module: module || null, // Salva o módulo ou null se não for enviado
      projectId: req.params.projectId,
      createdById: req.user.id
    },
  });

  res.status(201).json({ success: true, data: { rule } });
}));

// Atualizar regra (PUT) - Com suporte a module
router.put("/:projectId/rules/:ruleId", catchAsync(async (req, res) => {
  const { description, module } = req.body;

  const rule = await prisma.businessRule.update({
    where: { id: req.params.ruleId },
    data:  {
      ...(description !== undefined && { description }),
      ...(module      !== undefined && { module }), // Atualiza apenas se o campo estiver no body
    },
  });

  res.json({ success: true, data: { rule } });
}));

// Excluir regra (DELETE)
router.delete("/:projectId/rules/:ruleId", catchAsync(async (req, res) => {
  // Nota: se o backend tiver a lógica de 'force delete', ela deve ser implementada aqui
  // verificando req.query.force
  await prisma.businessRule.delete({ where: { id: req.params.ruleId } });
  res.json({ success: true, message: "Regra excluída" });
}));

export default router;