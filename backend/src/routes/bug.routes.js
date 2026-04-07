// src/routes/bug.routes.js
import { Router } from "express";
import multer     from "multer";
import path       from "path";
import { v4 as uuidv4 } from "uuid";
import { authenticate } from "../middleware/errorHandler.js";
import { prisma }   from "../lib/prisma.js";
import { catchAsync, AppError } from "../utils/AppError.js";
import { generateBugCode, getFileType } from "../utils/helpers.js";

// Multer config inline (multer v2)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads"),
  filename:    (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg","image/png","image/gif","image/webp","video/mp4","video/webm","application/pdf"];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new AppError(`Tipo não permitido: ${file.mimetype}`, 415));
  },
});

const router = Router({ mergeParams: true });
router.use(authenticate);

// GET /projects/:projectId/bugs
router.get("/:projectId/bugs", catchAsync(async (req, res) => {
  const { status, severity, priority, page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where = {
    projectId: req.params.projectId,
    ...(status   && { status }),
    ...(severity && { severity }),
    ...(priority && { priority }),
  };
  const [bugs, total] = await Promise.all([
    prisma.bug.findMany({
      where, skip, take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: {
        reportedBy:  { include: { qaProfile: { select: { name: true } } } },
        assignedTo:  { include: { developerProfile: { select: { name: true } } } },
        attachments: { select: { id: true, filename: true, fileType: true, url: true } },
        _count:      { select: { comments: true } },
      },
    }),
    prisma.bug.count({ where }),
  ]);
  res.json({ success: true, data: { bugs, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } } });
}));

// POST /projects/:projectId/bugs
router.post("/:projectId/bugs", catchAsync(async (req, res) => {
  const { title, description, severity, priority, stepsToRepro, expectedResult, actualResult, environment, assignedToId, isAiGenerated } = req.body;
  if (!title || !description || !severity || !priority || !expectedResult || !actualResult) {
    throw new AppError("Campos obrigatórios faltando", 400);
  }
  const bugCode = await generateBugCode(req.params.projectId);
  const bug = await prisma.bug.create({
    data: {
      bugCode, title, description, severity, priority,
      stepsToRepro: stepsToRepro || [], expectedResult, actualResult,
      environment: environment || null,
      projectId:   req.params.projectId,
      reportedById: req.user.id,
      assignedToId: assignedToId || null,
      isAiGenerated: isAiGenerated || false,
    },
    include: {
      reportedBy: { include: { qaProfile: { select: { name: true } } } },
      assignedTo: { include: { developerProfile: { select: { name: true } } } },
    },
  });
  res.status(201).json({ success: true, data: { bug } });
}));

// GET /projects/:projectId/bugs/:bugId
router.get("/:projectId/bugs/:bugId", catchAsync(async (req, res) => {
  const bug = await prisma.bug.findUnique({
    where:   { id: req.params.bugId },
    include: {
      reportedBy:  { include: { qaProfile: true } },
      assignedTo:  { include: { developerProfile: true } },
      attachments: true,
      comments:    {
        orderBy: { createdAt: "asc" },
        include: { bug: false },
      },
      project: { select: { id: true, name: true } },
    },
  });
  if (!bug) throw new AppError("Bug não encontrado", 404);
  res.json({ success: true, data: { bug } });
}));

// PUT /projects/:projectId/bugs/:bugId
router.put("/:projectId/bugs/:bugId", catchAsync(async (req, res) => {
  const allowed = req.user.role === "DEVELOPER"
    ? { status: req.body.status, actualResult: req.body.actualResult }
    : req.body;
  const bug = await prisma.bug.update({
    where: { id: req.params.bugId },
    data:  allowed,
  });
  res.json({ success: true, data: { bug } });
}));

// DELETE /projects/:projectId/bugs/:bugId
router.delete("/:projectId/bugs/:bugId", catchAsync(async (req, res) => {
  await prisma.bug.delete({ where: { id: req.params.bugId } });
  res.json({ success: true, message: "Bug excluído" });
}));

// POST /projects/:projectId/bugs/:bugId/attachments
router.post("/:projectId/bugs/:bugId/attachments", upload.single("file"), catchAsync(async (req, res) => {
  if (!req.file) throw new AppError("Nenhum arquivo enviado", 400);
  const attachment = await prisma.attachment.create({
    data: {
      filename:     req.file.filename,
      originalName: req.file.originalname,
      mimeType:     req.file.mimetype,
      fileType:     getFileType(req.file.mimetype),
      size:         req.file.size,
      url:          `/uploads/${req.file.filename}`,
      bugId:        req.params.bugId,
    },
  });
  res.status(201).json({ success: true, data: { attachment } });
}));

// POST /projects/:projectId/bugs/:bugId/comments
router.post("/:projectId/bugs/:bugId/comments", catchAsync(async (req, res) => {
  const { content } = req.body;
  if (!content) throw new AppError("Conteúdo é obrigatório", 400);
  const comment = await prisma.bugComment.create({
    data: { bugId: req.params.bugId, authorId: req.user.id, content },
  });
  res.status(201).json({ success: true, data: { comment } });
}));

export default router;