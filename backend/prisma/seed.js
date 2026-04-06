// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

// Prisma v7.6.0: adapter obrigatório no construtor
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed...");

  // ── Limpar dados (ordem respeita foreign keys) ────
  await prisma.cypressRun.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.bugComment.deleteMany();
  await prisma.bug.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.businessRule.deleteMany();
  await prisma.project.deleteMany();
  await prisma.qAProfile.deleteMany();
  await prisma.developerProfile.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  console.log("🗑️  Dados antigos removidos");

  // ── Usuários ──────────────────────────────────────
  const password = await bcrypt.hash("Senha@123", 12);

  const [qaUser1, qaUser2, dev1, dev2] = await Promise.all([
    prisma.user.create({ data: { email: "qa1@empresa.com",   password, role: "QA" } }),
    prisma.user.create({ data: { email: "qa2@empresa.com",   password, role: "QA" } }),
    prisma.user.create({ data: { email: "dev1@empresa.com",  password, role: "DEVELOPER" } }),
    prisma.user.create({ data: { email: "dev2@empresa.com",  password, role: "DEVELOPER" } }),
    prisma.user.create({ data: { email: "admin@empresa.com", password, role: "ADMIN" } }),
  ]);

  // ── Perfis ────────────────────────────────────────
  await Promise.all([
    prisma.qAProfile.create({
      data: {
        userId: qaUser1.id,
        name: "Ana Paula Costa",
        experienceLevel: "SENIOR",
        specializations: ["Web", "Mobile", "API"],
        bio: "QA Sênior com 6 anos de experiência em automação.",
      },
    }),
    prisma.qAProfile.create({
      data: {
        userId: qaUser2.id,
        name: "Carlos Mendes",
        experienceLevel: "MID",
        specializations: ["Web", "Performance"],
      },
    }),
    prisma.developerProfile.create({
      data: {
        userId: dev1.id,
        name: "Fernanda Lima",
        techStack: ["React", "Node.js", "PostgreSQL"],
        team: "Core",
      },
    }),
    prisma.developerProfile.create({
      data: {
        userId: dev2.id,
        name: "Rafael Souza",
        techStack: ["Vue.js", "Python", "Docker"],
        team: "Payments",
      },
    }),
  ]);
  console.log("👥 Usuários e perfis criados");

  // ── Projeto 1: E-commerce ─────────────────────────
  const ecomProject = await prisma.project.create({
    data: {
      name: "Plataforma E-commerce v3",
      objective: "Garantir qualidade do fluxo de compra, carrinho e pagamento.",
      actors: ["Cliente", "Administrador", "Operador de Logística"],
      description: "Migração do e-commerce legado para microsserviços.",
      createdById: qaUser1.id,
    },
  });

  // ── Regras de Negócio ─────────────────────────────
  const [rn001, rn002, rn003, , rn005] = await Promise.all([
    prisma.businessRule.create({ data: {
      ruleCode: "RN-001", projectId: ecomProject.id, createdById: qaUser1.id,
      description: "O cliente deve estar autenticado para finalizar uma compra.",
    }}),
    prisma.businessRule.create({ data: {
      ruleCode: "RN-002", projectId: ecomProject.id, createdById: qaUser1.id,
      description: "O carrinho deve aceitar no máximo 50 itens distintos.",
    }}),
    prisma.businessRule.create({ data: {
      ruleCode: "RN-003", projectId: ecomProject.id, createdById: qaUser1.id,
      description: "Descontos não podem ser acumulados com cupons de frete grátis.",
    }}),
    prisma.businessRule.create({ data: {
      ruleCode: "RN-004", projectId: ecomProject.id, createdById: qaUser2.id,
      description: "O valor mínimo de compra para frete grátis é R$ 150,00.",
    }}),
    prisma.businessRule.create({ data: {
      ruleCode: "RN-005", projectId: ecomProject.id, createdById: qaUser2.id,
      description: "Pagamentos com PIX devem ser confirmados em até 30 minutos.",
    }}),
  ]);
  console.log("📋 Regras de negócio criadas");

  // ── Casos de Teste ────────────────────────────────
  await Promise.all([
    prisma.testCase.create({ data: {
      testCode: "TC-001", projectId: ecomProject.id,
      createdById: qaUser1.id, businessRuleId: rn001.id,
      title: "Compra sem autenticação deve redirecionar para login",
      steps: ["Acessar o site sem login", "Adicionar produto", "Clicar em Finalizar"],
      expectedResult: "Sistema redireciona para a página de login",
      output: "VALID", riskLevel: "HIGH",
    }}),
    prisma.testCase.create({ data: {
      testCode: "TC-002", projectId: ecomProject.id,
      createdById: qaUser1.id, businessRuleId: rn001.id,
      title: "Usuário autenticado pode finalizar compra",
      steps: ["Fazer login", "Adicionar produto", "Finalizar compra"],
      expectedResult: "Pedido criado com sucesso",
      output: "VALID", riskLevel: "HIGH",
    }}),
    prisma.testCase.create({ data: {
      testCode: "TC-003", projectId: ecomProject.id,
      createdById: qaUser1.id, businessRuleId: rn002.id,
      title: "Adicionar o 51º item ao carrinho deve ser bloqueado",
      steps: ["Fazer login", "Adicionar 50 produtos distintos", "Tentar adicionar o 51º"],
      expectedResult: "Sistema exibe mensagem de limite atingido",
      output: "INVALID", riskLevel: "MEDIUM",
      isAiGenerated: true,
    }}),
    prisma.testCase.create({ data: {
      testCode: "TC-004", projectId: ecomProject.id,
      createdById: qaUser2.id, businessRuleId: rn003.id,
      title: "Aplicar desconto e cupom de frete grátis simultaneamente",
      steps: ["Adicionar produto com desconto", "Inserir cupom de frete grátis"],
      expectedResult: "Sistema rejeita o cupom com mensagem explicativa",
      output: "INVALID", riskLevel: "HIGH",
    }}),
    prisma.testCase.create({ data: {
      testCode: "TC-005", projectId: ecomProject.id,
      createdById: qaUser2.id, businessRuleId: rn005.id,
      title: "PIX expirado após 30 minutos deve invalidar pedido",
      steps: ["Iniciar compra com PIX", "Aguardar 31 minutos", "Verificar status"],
      expectedResult: "Pedido cancelado com status Pagamento expirado",
      output: "INVALID", riskLevel: "HIGH",
      isAiGenerated: true,
    }}),
  ]);
  console.log("🧪 Casos de teste criados");

  // ── Bugs ──────────────────────────────────────────
  await Promise.all([
    prisma.bug.create({ data: {
      bugCode: "BUG-001", projectId: ecomProject.id,
      reportedById: qaUser1.id, assignedToId: dev1.id,
      title: "Carrinho não limpa após logout",
      description: "Itens persistem entre sessões de usuários diferentes.",
      severity: "HIGH", priority: "HIGH", status: "IN_PROGRESS",
      stepsToRepro: ["Login como A", "Adicionar itens", "Logout", "Login como B", "Ver carrinho"],
      expectedResult: "Carrinho vazio para o usuário B",
      actualResult: "Carrinho exibe itens do usuário A",
      environment: "Chrome 125 / Produção",
    }}),
    prisma.bug.create({ data: {
      bugCode: "BUG-002", projectId: ecomProject.id,
      reportedById: qaUser2.id, assignedToId: dev2.id,
      title: "PIX não expira após 30 minutos",
      description: "QR Code continua válido além do prazo, permitindo pagamentos indevidos.",
      severity: "CRITICAL", priority: "URGENT", status: "OPEN",
      stepsToRepro: ["Criar pedido com PIX", "Aguardar 35 minutos", "Escanear QR Code"],
      expectedResult: "Pagamento recusado — QR Code expirado",
      actualResult: "Pagamento aceito e pedido em estado inconsistente",
      environment: "Staging / Todos os browsers",
      isAiGenerated: true,
    }}),
    prisma.bug.create({ data: {
      bugCode: "BUG-003", projectId: ecomProject.id,
      reportedById: qaUser1.id,
      title: "Cálculo de frete incorreto para região Norte",
      description: "CEPs de AM, PA e RR recebem tabela de frete do Sudeste.",
      severity: "HIGH", priority: "HIGH", status: "OPEN",
      stepsToRepro: ["Adicionar produto", "Inserir CEP 69000-000", "Ver frete calculado"],
      expectedResult: "Frete pela tabela da região Norte",
      actualResult: "Frete pela tabela do Sudeste (valor incorreto)",
      environment: "Produção",
    }}),
  ]);
  console.log("🐛 Bugs criados");

  // ── Projeto 2: App Mobile ─────────────────────────
  const mobileProject = await prisma.project.create({
    data: {
      name: "App Mobile de Fidelidade",
      objective: "Validar sistema de pontuação, resgate de prêmios e notificações push.",
      actors: ["Cliente", "Parceiro"],
      createdById: qaUser2.id,
    },
  });

  await Promise.all([
    prisma.businessRule.create({ data: {
      ruleCode: "RN-001", projectId: mobileProject.id, createdById: qaUser2.id,
      description: "Pontos expiram após 12 meses sem movimentação na conta.",
    }}),
    prisma.businessRule.create({ data: {
      ruleCode: "RN-002", projectId: mobileProject.id, createdById: qaUser2.id,
      description: "O resgate mínimo é de 500 pontos por transação.",
    }}),
  ]);

  console.log("📱 Projeto mobile criado");
  console.log("\n✅ Seed concluído com sucesso!\n");
  console.log("Usuários criados (senha: Senha@123):");
  console.log("  QA:    qa1@empresa.com  |  qa2@empresa.com");
  console.log("  Dev:   dev1@empresa.com |  dev2@empresa.com");
  console.log("  Admin: admin@empresa.com");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
