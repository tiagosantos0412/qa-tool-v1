# 🧪 QA Tool Platform

Plataforma completa para gestão de qualidade de software (QA), permitindo o controle de testes, bugs, regras de negócio e integração com automação (Cypress).

---

## 🚀 Objetivo do Projeto

O **QA Tool Platform** foi desenvolvido com o objetivo de simular um ambiente real de trabalho de um time de QA, centralizando:

- Gestão de **casos de teste**
- Registro e acompanhamento de **bugs**
- Organização de **regras de negócio**
- Integração com **testes automatizados (Cypress)**
- Controle de usuários com diferentes papéis (QA, Dev, Admin)

A aplicação serve como **ferramenta prática de estudo e portfólio**, focada em boas práticas de qualidade de software e arquitetura backend.

---

## 🧠 Regras de Negócio Principais

- Cada projeto possui:
  - Regras de negócio
  - Casos de teste
  - Bugs associados

- Casos de teste:
  - Podem estar vinculados a uma regra de negócio
  - Possuem resultado (válido/inválido)
  - Podem ser gerados por IA

- Bugs:
  - Possuem severidade e prioridade
  - Podem ser atribuídos a desenvolvedores
  - Possuem status de ciclo de vida

- Usuários:
  - QA → cria testes e bugs
  - Dev → resolve bugs
  - Admin → gerencia tudo

---

## 🏗️ Arquitetura


qa-tool-v1/
├── backend/
│ ├── prisma/
│ ├── src/
│ ├── .env
│ └── prisma.config.ts
│
├── frontend/
│ └── (integração com API)
│
└── docker-compose.yml


---

## 🛠️ Tecnologias Utilizadas

### 🔹 Backend
- Node.js
- TypeScript
- Express
- Prisma ORM (v7)
- PostgreSQL
- JWT (Autenticação)
- Bcrypt (Hash de senha)

### 🔹 Banco de Dados
- PostgreSQL (Docker)

### 🔹 ORM
- Prisma (modelagem avançada com enums e relações)

### 🔹 DevOps
- Docker
- Docker Compose

### 🔹 Testes (estrutura preparada)
- Cypress (integração planejada via `CypressRun`)

---

## 🧬 Modelagem de Dados

O sistema possui entidades robustas como:

- User / QAProfile / DeveloperProfile
- Project
- BusinessRule
- TestCase
- Bug
- Attachment
- CypressRun
- AI Generation Log

Com uso de:
- Relacionamentos complexos
- Enum types
- Soft lifecycle de bugs
- Histórico de execuções automatizadas

---

## ⚙️ Setup do Projeto

### 1. Clonar repositório

```bash
git clone https://github.com/tiagosantos0412/qa-tool-v1.git
cd qa-tool-v1/backend
2. Configurar variáveis de ambiente

Criar .env:

DATABASE_URL="postgresql://qa_user:senha@localhost:5432/qa_platform_db"
JWT_SECRET="sua_secret"
JWT_REFRESH_SECRET="sua_refresh_secret"
PORT=3001
3. Subir banco com Docker
docker compose up -d postgres
4. Instalar dependências
npm install
5. Gerar Prisma Client
npx prisma generate
6. Rodar seed (dados iniciais)
node --env-file=.env prisma/seed.js
🧪 Usuários de Teste
QA:
- qa1@empresa.com
- qa2@empresa.com

DEV:
- dev1@empresa.com
- dev2@empresa.com

ADMIN:
- admin@empresa.com

Senha padrão:
Senha@123