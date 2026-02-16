import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    // Simple keyword search
    const etfs = await prisma.eTF.findMany({
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
  },
};
