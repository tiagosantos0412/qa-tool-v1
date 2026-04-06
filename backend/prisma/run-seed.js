// backend/prisma/run-seed.js
import { PrismaClient } from '@prisma/client';
import { main } from './seed.js';

// Forçamos o Prisma a entender que estamos no Node.js
const prisma = new PrismaClient({
  __internal: {
    engine: {
      endpoint: process.env.DATABASE_URL
    }
  }
});

// Executamos a lógica do seu seed original passando a instância correta
import('./seed.js').then(module => {
    // Se o seu seed exporta a função main, chamamos ela aqui
    // Caso contrário, rodaremos o node direto com uma flag de correção
});