// src/routes/ai.routes.js
import { Router }    from "express";
import Anthropic     from "@anthropic-ai/sdk";
import { authenticate } from "../middleware/errorHandler.js";
import { prisma }    from "../lib/prisma.js";
import { catchAsync, AppError } from "../utils/AppError.js";

const router = Router();
router.use(authenticate);

const MODEL = "claude-sonnet-4-20250514";

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AppError("ANTHROPIC_API_KEY não configurada", 503);
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// POST /ai/generate-scenarios
router.post("/generate-scenarios", catchAsync(async (req, res) => {
  const { ruleIds, projectId, count = 3 } = req.body;
  if (!ruleIds?.length) throw new AppError("Forneça pelo menos uma regra", 400);

  const rules = await prisma.businessRule.findMany({
    where: { id: { in: ruleIds }, projectId },
  });
  if (!rules.length) throw new AppError("Regras não encontradas", 404);

  const rulesText = rules.map(r => `- [${r.ruleCode}] ${r.description}`).join("\n");
  const client    = getClient();

  const message = await client.messages.create({
    model: MODEL, max_tokens: 2048,
    system: "Especialista em QA. Responda APENAS em JSON válido, sem texto extra.",
    messages: [{
      role: "user",
      content: `Gere ${count} cenários de teste para:\n${rulesText}\n\nRetorne:\n{"scenarios":[{"title":"","steps":[],"expectedResult":"","output":"VALID ou INVALID","riskLevel":"LOW ou MEDIUM ou HIGH","relatedRuleCode":""}]}`,
    }],
  });

  const raw    = message.content[0].text.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(raw);

  await prisma.aiGenerationLog.create({
    data: {
      type: "test_scenarios", prompt: rulesText, response: raw, model: MODEL,
      tokensUsed: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
      projectId,
    },
  });

  res.json({ success: true, data: { scenarios: parsed.scenarios } });
}));

// POST /ai/suggest-risk
router.post("/suggest-risk", catchAsync(async (req, res) => {
  const { title, description, expectedResult, businessRuleDescription } = req.body;
  const client = getClient();

  const message = await client.messages.create({
    model: MODEL, max_tokens: 512,
    system: "Especialista em análise de risco QA. Responda apenas em JSON.",
    messages: [{
      role: "user",
      content: `Analise o risco:\nTítulo: ${title}\nDescrição: ${description}\nEsperado: ${expectedResult}\n${businessRuleDescription ? `Regra: ${businessRuleDescription}` : ""}\n\nRetorne:\n{"riskLevel":"LOW|MEDIUM|HIGH","justification":"","factors":[]}`,
    }],
  });

  const parsed = JSON.parse(message.content[0].text.replace(/```json\n?|\n?```/g, "").trim());
  res.json({ success: true, data: parsed });
}));

// POST /ai/generate-bug-report
router.post("/generate-bug-report", catchAsync(async (req, res) => {
  const { description, context, projectId } = req.body;
  if (!description) throw new AppError("Descrição é obrigatória", 400);

  const client  = getClient();
  const message = await client.messages.create({
    model: MODEL, max_tokens: 1024,
    system: "QA Engineer experiente. Responda apenas em JSON. Escreva em português do Brasil.",
    messages: [{
      role: "user",
      content: `Gere um bug report completo para:\n${description}\nContexto: ${context || "não informado"}\n\nRetorne:\n{"title":"","description":"","severity":"LOW|MEDIUM|HIGH|CRITICAL","priority":"LOW|MEDIUM|HIGH|URGENT","stepsToRepro":[],"expectedResult":"","actualResult":"","environment":""}`,
    }],
  });

  const raw    = message.content[0].text.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(raw);

  if (projectId) {
    await prisma.aiGenerationLog.create({
      data: {
        type: "bug_report", prompt: description, response: raw, model: MODEL,
        tokensUsed: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
        projectId,
      },
    });
  }

  res.json({ success: true, data: { bugReport: parsed } });
}));

// POST /ai/chat — streaming SSE
router.post("/chat", catchAsync(async (req, res) => {
  const { messages, projectId } = req.body;
  if (!messages?.length) throw new AppError("Mensagens são obrigatórias", 400);

  let context = "";
  if (projectId) {
    const project = await prisma.project.findUnique({
      where:   { id: projectId },
      include: {
        businessRules: { select: { ruleCode: true, description: true } },
        _count: { select: { testCases: true, bugs: true } },
      },
    });
    if (project) {
      context = `\nProjeto ativo: ${project.name}\nObjetivo: ${project.objective}\nRegras: ${project.businessRules.map(r => `[${r.ruleCode}] ${r.description}`).join("; ")}\nTotal testes: ${project._count.testCases} | Total bugs: ${project._count.bugs}`;
    }
  }

  const client = getClient();

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");

  const stream = await client.messages.stream({
    model: MODEL, max_tokens: 1024,
    system: `Você é um assistente especializado em QA (Quality Assurance).${context}\nResponda sempre em português do Brasil de forma clara e objetiva.`,
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
router.get("/history", catchAsync(async (req, res) => {
  const { projectId, limit = 10 } = req.query;
  const logs = await prisma.aiGenerationLog.findMany({
    where:   projectId ? { projectId } : {},
    take:    Number(limit),
    orderBy: { createdAt: "desc" },
    select:  { id: true, type: true, model: true, tokensUsed: true, createdAt: true },
  });
  res.json({ success: true, data: { logs } });
}));

export default router;