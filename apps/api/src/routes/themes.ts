import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { THEME_TAXONOMY, getThemeById, searchThemes } from '@etf-intelligence/shared';

export async function themeRoutes(fastify: FastifyInstance) {
  // GET /api/themes/taxonomy - Get all themes
  fastify.get('/themes/taxonomy', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return {
        themes: THEME_TAXONOMY.map((theme) => ({
          id: theme.id,
          name: theme.name,
          description: theme.description,
          keywords: theme.keywords.slice(0, 5), // First 5 keywords
          sectorHints: theme.sectorHints,
        })),
      };
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/themes/:themeId - Get theme details
  fastify.get('/themes/:themeId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { themeId } = request.params as { themeId: string };
      const theme = getThemeById(themeId);

      if (!theme) {
        return reply.status(404).send({ error: 'Theme not found' });
      }

      return { theme };
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/themes/search - Search themes
  fastify.get('/themes/search', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { q } = request.query as { q?: string };

      if (!q) {
        return { themes: [] };
      }

      const themes = searchThemes(q);
      return { themes };
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });
}
