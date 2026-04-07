// src/routes/cypress.routes.js
import { Router } from "express";
import { exec }   from "child_process";
import { promisify } from "util";
import { authenticate } from "../middleware/errorHandler.js";
import { prisma }   from "../lib/prisma.js";
import { catchAsync, AppError } from "../utils/AppError.js";

const execAsync = promisify(exec);
const router = Router();
router.use(authenticate);

router.post("/run/:testCaseId", catchAsync(async (req, res) => {
  const testCase = await prisma.testCase.findUnique({ where: { id: req.params.testCaseId } });
  if (!testCase) throw new AppError("Caso de teste não encontrado", 404);

  const run = await prisma.cypressRun.create({
    data: { testCaseId: req.params.testCaseId, status: "RUNNING", specFile: req.body.specFile || null },
  });

  // Executar Cypress de forma assíncrona
  const startTime = Date.now();
  execAsync(`npx cypress run --headless 2>&1`, { timeout: 120000 })
    .then(({ stdout }) => {
      const passed = stdout.includes("passing") && !stdout.includes("failing");
      return prisma.cypressRun.update({
        where: { id: run.id },
        data: { status: passed ? "PASSED" : "FAILED", logs: stdout.slice(0, 10000), duration: Date.now() - startTime, completedAt: new Date() },
      });
    })
    .catch((err) => {
      return prisma.cypressRun.update({
        where: { id: run.id },
        data: { status: "ERROR", logs: err.message?.slice(0, 10000), duration: Date.now() - startTime, completedAt: new Date() },
      });
    });

  res.json({ success: true, data: { runId: run.id, status: "RUNNING" } });
}));

router.get("/status/:runId", catchAsync(async (req, res) => {
  const run = await prisma.cypressRun.findUnique({
    where:   { id: req.params.runId },
    include: { testCase: { select: { testCode: true, title: true } } },
  });
  if (!run) throw new AppError("Execução não encontrada", 404);
  res.json({ success: true, data: { run } });
}));

router.get("/runs/:testCaseId", catchAsync(async (req, res) => {
  const runs = await prisma.cypressRun.findMany({
    where:   { testCaseId: req.params.testCaseId },
    orderBy: { triggeredAt: "desc" },
    take:    20,
  });
  res.json({ success: true, data: { runs } });
}));

export default router;

// ─────────────────────────────────────────────────
// src/routes/ai.routes.js
import { Router as AIRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { authenticate as aiAuth } from "../middleware/errorHandler.js";
import { prisma as aiPrisma }     from "../lib/prisma.js";
import { catchAsync as aiAsync, AppError as AIError } from "../utils/AppError.js";

const aiRouter = AIRouter();
aiRouter.use(aiAuth);

const getClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) throw new AIError("ANTHROPIC_API_KEY não configurada", 503);
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
};

const MODEL = "claude-sonnet-4-20250514";

// POST /ai/generate-scenarios
aiRouter.post("/generate-scenarios", aiAsync(async (req, res) => {
  const { ruleIds, projectId, count = 3 } = req.body;
  if (!ruleIds?.length) throw new AIError("Forneça pelo menos uma regra", 400);

  const rules = await aiPrisma.businessRule.findMany({ where: { id: { in: ruleIds }, projectId } });
  if (!rules.length) throw new AIError("Regras não encontradas", 404);

  const rulesText = rules.map(r => `- [${r.ruleCode}] ${r.description}`).join("\n");

  const client = getClient();
  const message = await client.messages.create({
    model: MODEL, max_tokens: 2048,
    system: "Você é um especialista em QA. Responda APENAS em JSON válido, sem texto extra.",
    messages: [{ role: "user", content: `Gere ${count} cenários de teste para:\n${rulesText}\n\nRetorne: {"scenarios":[{"title":"","steps":[],"expectedResult":"","output":"VALID|INVALID","riskLevel":"LOW|MEDIUM|HIGH","relatedRuleCode":""}]}` }],
  });

  const raw = message.content[0].text.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(raw);

  await aiPrisma.aiGenerationLog.create({
    data: { type: "test_scenarios", prompt: rulesText, response: raw, model: MODEL, tokensUsed: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0), projectId },
  });

  res.json({ success: true, data: { scenarios: parsed.scenarios } });
}));

// POST /ai/suggest-risk
aiRouter.post("/suggest-risk", aiAsync(async (req, res) => {
  const { title, description, expectedResult } = req.body;
  const client = getClient();
  const prompt = `Analise o risco deste cenário:\nTítulo: ${title}\nDescrição: ${description}\nEsperado: ${expectedResult}\n\nRetorne: {"riskLevel":"LOW|MEDIUM|HIGH","justification":"","factors":[]}`;
  const message = await client.messages.create({
    model: MODEL, max_tokens: 512,
    system: "Especialista em análise de risco QA. Responda apenas em JSON.",
    messages: [{ role: "user", content: prompt }],
  });
  const parsed = JSON.parse(message.content[0].text.replace(/```json\n?|\n?```/g, "").trim());
  res.json({ success: true, data: parsed });
}));

// POST /ai/generate-bug-report
aiRouter.post("/generate-bug-report", aiAsync(async (req, res) => {
  const { description, context, projectId } = req.body;
  if (!description) throw new AIError("Descrição é obrigatória", 400);
  const client = getClient();
  const prompt = `Gere um bug report para: ${description}\nContexto: ${context || "não informado"}\n\nRetorne: {"title":"","description":"","severity":"LOW|MEDIUM|HIGH|CRITICAL","priority":"LOW|MEDIUM|HIGH|URGENT","stepsToRepro":[],"expectedResult":"","actualResult":"","environment":""}`;
  const message = await client.messages.create({
    model: MODEL, max_tokens: 1024,
    system: "QA Engineer experiente. Responda apenas em JSON. Escreva em português do Brasil.",
    messages: [{ role: "user", content: prompt }],
  });
  const raw    = message.content[0].text.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(raw);

  if (projectId) {
    await aiPrisma.aiGenerationLog.create({
      data: { type: "bug_report", prompt: description, response: raw, model: MODEL, tokensUsed: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0), projectId },
    });
  }

  res.json({ success: true, data: { bugReport: parsed } });
}));

// POST /ai/chat — streaming SSE
aiRouter.post("/chat", aiAsync(async (req, res) => {
  const { messages, projectId } = req.body;
  if (!messages?.length) throw new AIError("Mensagens são obrigatórias", 400);

  let context = "";
  if (projectId) {
    const project = await aiPrisma.project.findUnique({
      where:   { id: projectId },
      include: { businessRules: { select: { ruleCode: true, description: true } }, _count: { select: { testCases: true, bugs: true } } },
    });
    if (project) context = `Projeto: ${project.name}\nObjetivo: ${project.objective}\nRegras: ${project.businessRules.map(r => `[${r.ruleCode}] ${r.description}`).join("; ")}\nTestes: ${project._count.testCases} | Bugs: ${project._count.bugs}`;
  }

  const client = getClient();

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");

  const stream = await client.messages.stream({
    model: MODEL, max_tokens: 1024,
    system: `Assistente especializado em QA. ${context}\nResponda em português do Brasil.`,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });

  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
    }
  }
  res.write("data: [DONE]\n\n");
  res.end();
}));

// GET /ai/history
aiRouter.get("/history", aiAsync(async (req, res) => {
  const { projectId, limit = 10 } = req.query;
  const logs = await aiPrisma.aiGenerationLog.findMany({
    where:   projectId ? { projectId } : {},
    take:    Number(limit),
    orderBy: { createdAt: "desc" },
    select:  { id: true, type: true, model: true, tokensUsed: true, createdAt: true },
  });
  res.json({ success: true, data: { logs } });
}));

export { aiRouter };