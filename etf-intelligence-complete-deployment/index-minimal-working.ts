// ETF Intelligence API Server
// apps/api/src/index.ts
// WORKING VERSION - Copy this entire file

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function startServer() {
  const app = Fastify({
    logger: true,
  });

  // Register CORS
  await app.register(cors, {
    origin: true,
  });

  // Health check endpoint
  app.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'ETF Intelligence API is running'
    };
  });

  // Start server
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('✅ Server listening at http://0.0.0.0:3001');
    console.log('✅ Health check: http://localhost:3001/health');
    console.log('');
    console.log('Next steps:');
    console.log('1. Test health endpoint works');
    console.log('2. Copy route files from package');
    console.log('3. Uncomment route imports above');
    console.log('4. Restart server');
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Start the server
startServer().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
