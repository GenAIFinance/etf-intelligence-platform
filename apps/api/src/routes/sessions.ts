import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function sessionRoutes(fastify: FastifyInstance) {

  // Called by /api/auth/login on successful password check
  fastify.post('/api/sessions/login', async (req, reply) => {
    const { session_id, username } = req.body as { session_id: string; username: string };
    await prisma.$executeRaw`
      INSERT INTO user_sessions (session_id, username, logged_in_at, last_active_at)
      VALUES (${session_id}::uuid, ${username}, NOW(), NOW())
      ON CONFLICT (session_id) DO NOTHING
    `;
    return reply.status(204).send();
  });

  // Called by middleware on every page navigation
  fastify.post('/api/sessions/ping', async (req, reply) => {
    const { session_id } = req.body as { session_id: string };
    await prisma.$executeRaw`
      UPDATE user_sessions
      SET last_active_at = NOW()
      WHERE session_id = ${session_id}::uuid
    `;
    return reply.status(204).send();
  });
}