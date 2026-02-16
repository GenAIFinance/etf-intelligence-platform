import cron from 'node-cron';
import { prisma } from '../db';
import { etfService } from '../services/etf';
import { newsService } from '../services/news';
import { CacheService } from '../services/cache';
import { config } from '../config';

export function startCronJobs() {
  console.log('📅 Starting scheduled jobs...');

  // Refresh ETF prices daily at 6 PM ET (after market close)
  cron.schedule('0 18 * * 1-5', async () => {
    console.log('🔄 Starting daily price refresh...');
    try {
      const etfs = await prisma.etf.findMany({ select: { ticker: true } });

      for (const etf of etfs) {
        await etfService.syncPrices(etf.ticker);
        await etfService.calculateMetrics(etf.ticker);
        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 200));
      }

      console.log(`✅ Refreshed prices for ${etfs.length} ETFs`);
    } catch (error) {
      console.error('❌ Daily price refresh failed:', error);
    }
  });

  // Refresh news every hour
  cron.schedule('0 * * * *', async () => {
    console.log('🔄 Starting hourly news refresh...');
    try {
      // Fetch news for popular ETF tickers
      const popularTickers = ['SPY', 'QQQ', 'IWM', 'VTI', 'VOO', 'ARKK', 'XLK', 'XLF', 'XLE', 'XLV'];

      for (const ticker of popularTickers) {
        const news = await newsService.fetchGoogleNews(ticker);

        for (const item of news.slice(0, 5)) {
          await newsService.processAndStoreNews({
            source: item.source || 'Google News',
            title: item.title,
            url: item.link,
            publishedAt: new Date(item.pubDate),
            snippet: item.contentSnippet,
          });
        }
      }

      // Also fetch for themes
      const themeQueries = ['AI technology ETF', 'semiconductor stocks', 'clean energy investing', 'biotech news'];

      for (const query of themeQueries) {
        const news = await newsService.fetchGoogleNews(query);

        for (const item of news.slice(0, 3)) {
          await newsService.processAndStoreNews({
            source: item.source || 'Google News',
            title: item.title,
            url: item.link,
            publishedAt: new Date(item.pubDate),
            snippet: item.contentSnippet,
          });
        }
      }

      console.log('✅ News refresh completed');
    } catch (error) {
      console.error('❌ News refresh failed:', error);
    }
  });

  // Clean up expired cache entries daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('🧹 Cleaning up expired cache entries...');
    try {
      await CacheService.cleanupExpired();
      console.log('✅ Cache cleanup completed');
    } catch (error) {
      console.error('❌ Cache cleanup failed:', error);
    }
  });

  // Calculate news impacts for ETFs every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    console.log('🔄 Calculating news impacts...');
    try {
      const recentNews = await prisma.newsItem.findMany({
        where: {
          publishedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        include: { impacts: true },
      });

      const etfs = await prisma.etf.findMany({
        include: {
          holdings: { orderBy: { weight: 'desc' } },
        },
      });

      for (const news of recentNews) {
        for (const etf of etfs) {
          // Skip if already calculated
          if (news.impacts.some((i) => i.etfId === etf.id)) continue;

          const themeExposures = await etfService.getThemeExposures(etf.ticker);

          const impact = await newsService.calculateImpact(
            news.id,
            etf.id,
            etf.holdings.map((h) => ({
              ticker: h.holdingTicker,
              name: h.holdingName,
              weight: h.weight,
            })),
            themeExposures.map((t) => ({ themeId: t.themeId, exposure: t.exposure }))
          );

          if (impact.score > 5) {
            await prisma.newsImpact.upsert({
              where: {
                newsItemId_etfId: { newsItemId: news.id, etfId: etf.id },
              },
              create: {
                newsItemId: news.id,
                etfId: etf.id,
                impactScore: impact.score,
                rationale: impact.rationale,
                matchedHoldingsJson: JSON.stringify(impact.matchedHoldings),
                matchedThemesJson: JSON.stringify(impact.matchedThemes),
              },
              update: {
                impactScore: impact.score,
                rationale: impact.rationale,
                matchedHoldingsJson: JSON.stringify(impact.matchedHoldings),
                matchedThemesJson: JSON.stringify(impact.matchedThemes),
              },
            });
          }
        }
      }

      console.log('✅ News impact calculation completed');
    } catch (error) {
      console.error('❌ News impact calculation failed:', error);
    }
  });

  console.log('✅ All scheduled jobs registered');
}
