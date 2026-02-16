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
      // Convert query to uppercase for matching
      const upperQuery = request.query.toUpperCase();
      
      // Simple keyword search - removed 'mode: insensitive'
      const etfs = await prisma.etf.findMany({
        where: {
          OR: [
            { ticker: { contains: request.query } },
            { name: { contains: request.query } },
            { assetClass: { contains: request.query } },
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
