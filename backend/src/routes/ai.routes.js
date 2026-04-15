// src/routes/ai.routes.js
import { Router }                        from "express";
import { GoogleGenerativeAI }            from "@google/generative-ai";
import { authenticate }                  from "../middleware/errorHandler.js";
import { prisma }                        from "../lib/prisma.js";
import { catchAsync, AppError }          from "../utils/AppError.js";

const router = Router();
router.use(authenticate);

const MODEL = "gemini-flash-latest"; // gratuito e rápido

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError("GEMINI_API_KEY não configurada no .env", 503);
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

async function generate(prompt, systemInstruction = "") {
  const client = getClient();
  const model  = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemInstruction || "Você é um especialista em QA. Responda sempre em português do Brasil.",
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

function parseJSON(raw) {
  // Remove blocos de código markdown se existirem
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  return JSON.parse(cleaned);
}

// ── POST /ai/generate-scenarios ──────────────────
router.post("/generate-scenarios", catchAsync(async (req, res) => {
  const { ruleIds, projectId, count = 3 } = req.body;
  if (!ruleIds?.length) throw new AppError("Forneça pelo menos uma regra", 400);

  const rules = await prisma.businessRule.findMany({
    where: { id: { in: ruleIds }, projectId },
  });
  if (!rules.length) throw new AppError("Regras não encontradas", 404);

  const rulesText = rules.map(r => `- [${r.ruleCode}] ${r.description}`).join("\n");

  const prompt = `Você é um especialista em QA. Gere exatamente ${count} cenários de teste para as seguintes regras de negócio:

${rulesText}

Retorne APENAS um JSON válido, sem texto antes ou depois, sem markdown, sem blocos de código:
{"scenarios":[{"title":"título do cenário","steps":["passo 1","passo 2","passo 3"],"expectedResult":"resultado esperado","output":"VALID","riskLevel":"HIGH","relatedRuleCode":"RN-001"}]}

Regras para output: use "VALID" para fluxo feliz e "INVALID" para casos de erro.
Regras para riskLevel: use "LOW", "MEDIUM" ou "HIGH".
Crie cenários variados: tanto fluxos válidos quanto inválidos.`;

  const raw     = await generate(prompt);
  const parsed  = parseJSON(raw);

  await prisma.aiGenerationLog.create({
    data: {
      type:       "test_scenarios",
      prompt:     rulesText,
      response:   raw,
      model:      MODEL,
      projectId:  projectId || null,
    },
  });

  res.json({ success: true, data: { scenarios: parsed.scenarios } });
}));

// ── POST /ai/suggest-risk ─────────────────────────
router.post("/suggest-risk", catchAsync(async (req, res) => {
  const { title, description, expectedResult, businessRuleDescription } = req.body;
  if (!title) throw new AppError("Título é obrigatório", 400);

  const prompt = `Analise o nível de risco deste cenário de teste e retorne APENAS um JSON válido, sem texto antes ou depois:

Título: ${title}
Descrição: ${description || "não informado"}
Resultado esperado: ${expectedResult || "não informado"}
Regra de negócio: ${businessRuleDescription || "não informada"}

Retorne exatamente neste formato:
{"riskLevel":"MEDIUM","justification":"explicação em 1-2 frases","factors":["fator 1","fator 2"]}

Critérios:
- HIGH: impacta funcionalidade crítica, dados financeiros, segurança ou autenticação
- MEDIUM: impacta fluxo principal mas tem alternativa
- LOW: funcionalidade auxiliar, impacto limitado`;

  const raw    = await generate(prompt);
  const parsed = parseJSON(raw);

  res.json({ success: true, data: parsed });
}));

// ── POST /ai/generate-bug-report ─────────────────
router.post("/generate-bug-report", catchAsync(async (req, res) => {
  const { description, context, projectId } = req.body;
  if (!description) throw new AppError("Descrição é obrigatória", 400);

  const prompt = `Você é um QA Engineer experiente. Gere um bug report completo em português do Brasil.
Retorne APENAS um JSON válido, sem texto antes ou depois, sem markdown:

Problema relatado: ${description}
Contexto adicional: ${context || "não informado"}

Retorne exatamente neste formato:
{"title":"título conciso do bug","description":"descrição detalhada","severity":"HIGH","priority":"HIGH","stepsToRepro":["1. passo um","2. passo dois","3. passo três"],"expectedResult":"o que deveria acontecer","actualResult":"o que está acontecendo","environment":"sugestão de ambiente"}

Valores válidos para severity: LOW, MEDIUM, HIGH, CRITICAL
Valores válidos para priority: LOW, MEDIUM, HIGH, URGENT`;

  const raw    = await generate(prompt);
  const parsed = parseJSON(raw);

  if (projectId) {
    await prisma.aiGenerationLog.create({
      data: {
        type:      "bug_report",
        prompt:    description,
        response:  raw,
        model:     MODEL,
        projectId,
      },
    });
  }

  res.json({ success: true, data: { bugReport: parsed } });
}));

// ── POST /ai/chat ─────────────────────────────────
// Gemini não suporta SSE nativamente igual ao Claude,
// então retornamos a resposta completa de uma vez
router.post("/chat", catchAsync(async (req, res) => {
  const { messages, projectId } = req.body;
  if (!messages?.length) throw new AppError("Mensagens são obrigatórias", 400);

  // Buscar contexto do projeto
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
      context = `\n\nContexto do projeto atual:\n- Nome: ${project.name}\n- Objetivo: ${project.objective}\n- Regras: ${project.businessRules.map(r => `[${r.ruleCode}] ${r.description}`).join("; ")}\n- Total de testes: ${project._count.testCases}\n- Total de bugs: ${project._count.bugs}`;
    }
  }

  const client = getClient();
  const model  = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: `Você é um assistente especializado em QA (Quality Assurance). Ajude times de QA a criar casos de teste, analisar regras de negócio, identificar riscos e escrever bug reports. Responda sempre em português do Brasil de forma clara e objetiva.${context}`,
  });

  // Montar histórico de chat
  const history = messages.slice(0, -1).map(m => ({
    role:  m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const chat        = model.startChat({ history });
  const lastMessage = messages[messages.length - 1].content;
  const result      = await chat.sendMessage(lastMessage);
  const text        = result.response.text();

  // Simular SSE para compatibilidade com o frontend
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");

  // Enviar em chunks para simular streaming
  const words  = text.split(" ");
  const chunks = [];
  for (let i = 0; i < words.length; i += 5) {
    chunks.push(words.slice(i, i + 5).join(" ") + (i + 5 < words.length ? " " : ""));
  }

  for (const chunk of chunks) {
    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    await new Promise(r => setTimeout(r, 20)); // delay pequeno para efeito de streaming
  }

  res.write("data: [DONE]\n\n");
  res.end();
}));

// ── GET /ai/history ───────────────────────────────
router.get("/history", catchAsync(async (req, res) => {
  const { projectId, limit = 10 } = req.query;
  const logs = await prisma.aiGenerationLog.findMany({
    where:   projectId ? { projectId } : {},
    take:    Number(limit),
    orderBy: { createdAt: "desc" },
    select:  { id: true, type: true, model: true, createdAt: true },
  });
  res.json({ success: true, data: { logs } });
}));

export default router;