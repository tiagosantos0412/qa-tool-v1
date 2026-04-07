// src/utils/helpers.js
import { prisma } from "../lib/prisma.js";

export async function generateBugCode(projectId) {
  const last = await prisma.bug.findFirst({
    where:   { projectId },
    orderBy: { bugCode: "desc" },
    select:  { bugCode: true },
  });
  if (!last) return "BUG-001";
  const num = parseInt(last.bugCode.replace("BUG-", ""), 10);
  return `BUG-${String(num + 1).padStart(3, "0")}`;
}

export async function generateTestCode(projectId) {
  const last = await prisma.testCase.findFirst({
    where:   { projectId },
    orderBy: { testCode: "desc" },
    select:  { testCode: true },
  });
  if (!last) return "TC-001";
  const num = parseInt(last.testCode.replace("TC-", ""), 10);
  return `TC-${String(num + 1).padStart(3, "0")}`;
}

export async function generateRuleCode(projectId) {
  const last = await prisma.businessRule.findFirst({
    where:   { projectId },
    orderBy: { ruleCode: "desc" },
    select:  { ruleCode: true },
  });
  if (!last) return "RN-001";
  const num = parseInt(last.ruleCode.replace("RN-", ""), 10);
  return `RN-${String(num + 1).padStart(3, "0")}`;
}

export function getFileType(mimeType) {
  if (mimeType.startsWith("image/"))  return "IMAGE";
  if (mimeType.startsWith("video/"))  return "VIDEO";
  if (mimeType === "application/pdf") return "PDF";
  return "OTHER";
}
