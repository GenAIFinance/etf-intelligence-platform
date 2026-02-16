import prisma from '../db';

interface ScreenRequest {
  query: string;
  limit: number;
}

interface ScreenResult {
  etfs: any[];
  interpretation: string;
  searchCriteria: any;
}

export const aiScreenerService = {
  async screenETFs(request: ScreenRequest): Promise<ScreenResult> {
    try {
      // Simple keyword search - FIXED: Using Etf (not eTF)
      const etfs = await prisma.etf.findMany({
        where: {
          OR: [
            { ticker: { contains: request.query, mode: 'insensitive' } },
            { name: { contains: request.query, mode: 'insensitive' } },
            { assetClass: { contains: request.query, mode: 'insensitive' } },
          ],
        },
        take: request.limit,
        orderBy: { aum: 'desc' },
      });

      return {
        etfs,
        interpretation: `Found ${etfs.length} ETFs matching "${request.query}"`,
        searchCriteria: { query: request.query, limit: request.limit },
      };
    } catch (error) {
      console.error('AI Screener error:', error);
      throw error;
    }
  },
};
