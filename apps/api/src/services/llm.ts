import axios from 'axios';
import { config } from '../config';
import { LlmSummary, LlmNewsAnalysis } from '@etf-intelligence/shared';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export class LlmClient {
  private enabled: boolean;
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor() {
    this.enabled = config.llm.enabled;
    this.baseUrl = config.llm.baseUrl;
    this.apiKey = config.llm.apiKey;
    this.model = config.llm.model;
  }

  private async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.enabled) {
      throw new Error('LLM is disabled');
    }

    try {
      const response = await axios.post<ChatCompletionResponse>(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.choices[0]?.message?.content || '';
    } catch (error: any) {
      console.error('LLM API error:', error.message);
      throw error;
    }
  }

  // Summarize ETF fund
  async summarizeEtf(
    name: string,
    summary: string,
    assetClass: string,
    strategyType: string,
    topHoldings: { name: string; weight: number }[],
    sectorWeights: { sector: string; weight: number }[]
  ): Promise<LlmSummary> {
    if (!this.enabled) {
      return this.getFallbackEtfSummary(name, assetClass, strategyType, topHoldings, sectorWeights);
    }

    const holdingsStr = topHoldings
      .slice(0, 10)
      .map((h) => `${h.name} (${(h.weight * 100).toFixed(1)}%)`)
      .join(', ');

    const sectorsStr = sectorWeights
      .map((s) => `${s.sector}: ${(s.weight * 100).toFixed(1)}%`)
      .join(', ');

    const prompt = `Analyze this ETF and provide a brief summary:

ETF Name: ${name}
Asset Class: ${assetClass}
Strategy: ${strategyType}
Description: ${summary}

Top Holdings: ${holdingsStr}
Sector Weights: ${sectorsStr}

Provide a JSON response with these fields:
- whatItOwns: 1-2 sentences on what the ETF invests in
- riskProfile: 1-2 sentences on risk level and factor tilts
- keySensitivities: array of 3-5 key sensitivities (e.g., "interest rates", "tech sector", "regulatory risk")

Return only valid JSON, no markdown.`;

    try {
      const response = await this.chat([
        { role: 'system', content: 'You are a financial analyst providing ETF analysis.' },
        { role: 'user', content: prompt },
      ]);

      const parsed = JSON.parse(response);
      return {
        whatItOwns: parsed.whatItOwns || '',
        riskProfile: parsed.riskProfile || '',
        keySensitivities: parsed.keySensitivities || [],
      };
    } catch {
      return this.getFallbackEtfSummary(name, assetClass, strategyType, topHoldings, sectorWeights);
    }
  }

  private getFallbackEtfSummary(
    name: string,
    assetClass: string,
    strategyType: string,
    topHoldings: { name: string; weight: number }[],
    sectorWeights: { sector: string; weight: number }[]
  ): LlmSummary {
    const topSectors = sectorWeights.slice(0, 3).map((s) => s.sector).join(', ');
    const topHoldingNames = topHoldings.slice(0, 5).map((h) => h.name).join(', ');
    const top5Weight = topHoldings.slice(0, 5).reduce((s, h) => s + h.weight, 0);

    return {
      whatItOwns: `This ${assetClass || 'equity'} ETF follows a ${strategyType || 'diversified'} strategy. Top holdings include ${topHoldingNames || 'various securities'}.`,
      riskProfile: `Concentration: Top 5 holdings represent ${(top5Weight * 100).toFixed(1)}% of the fund. Main sector exposure: ${topSectors || 'diversified'}.`,
      keySensitivities: this.inferSensitivities(assetClass, strategyType, sectorWeights),
    };
  }

  private inferSensitivities(
    assetClass: string,
    strategyType: string,
    sectorWeights: { sector: string; weight: number }[]
  ): string[] {
    const sensitivities: string[] = [];

    if (assetClass?.toLowerCase().includes('fixed income') || assetClass?.toLowerCase().includes('bond')) {
      sensitivities.push('interest rate changes', 'credit spreads');
    }

    const sectors = sectorWeights.map((s) => s.sector.toLowerCase());
    if (sectors.some((s) => s.includes('tech'))) sensitivities.push('technology sector performance');
    if (sectors.some((s) => s.includes('financ'))) sensitivities.push('financial sector and interest rates');
    if (sectors.some((s) => s.includes('health'))) sensitivities.push('healthcare regulations');
    if (sectors.some((s) => s.includes('energy'))) sensitivities.push('energy prices');

    if (sensitivities.length < 3) {
      sensitivities.push('market volatility', 'economic conditions');
    }

    return sensitivities.slice(0, 5);
  }

  // Analyze news impact
  async analyzeNewsImpact(
    title: string,
    snippet: string,
    relatedHoldings: string[],
    relatedThemes: string[]
  ): Promise<LlmNewsAnalysis> {
    if (!this.enabled) {
      return this.getFallbackNewsAnalysis(title, relatedHoldings, relatedThemes);
    }

    const prompt = `Analyze this news article's potential market impact:

Title: ${title}
Summary: ${snippet}
Related Holdings: ${relatedHoldings.join(', ')}
Related Themes: ${relatedThemes.join(', ')}

Provide a JSON response with:
- summary: 1-2 sentence summary of the news
- impactRationale: 1-2 sentences explaining potential market impact
- sentiment: "positive", "negative", or "neutral"

Return only valid JSON.`;

    try {
      const response = await this.chat([
        { role: 'system', content: 'You are a financial news analyst.' },
        { role: 'user', content: prompt },
      ]);

      const parsed = JSON.parse(response);
      return {
        summary: parsed.summary || title,
        impactRationale: parsed.impactRationale || '',
        sentiment: parsed.sentiment || 'neutral',
      };
    } catch {
      return this.getFallbackNewsAnalysis(title, relatedHoldings, relatedThemes);
    }
  }

  private getFallbackNewsAnalysis(
    title: string,
    relatedHoldings: string[],
    relatedThemes: string[]
  ): LlmNewsAnalysis {
    const sentiment = this.inferSentiment(title);
    return {
      summary: title,
      impactRationale: relatedHoldings.length > 0
        ? `This news may affect ${relatedHoldings.slice(0, 3).join(', ')} and related ETFs with exposure to ${relatedThemes.slice(0, 2).join(', ') || 'these sectors'}.`
        : 'Market impact analysis requires LLM to be enabled.',
      sentiment,
    };
  }

  private inferSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const lower = text.toLowerCase();
    const positiveWords = ['surge', 'gain', 'rise', 'growth', 'beat', 'exceed', 'upgrade', 'breakthrough'];
    const negativeWords = ['fall', 'drop', 'decline', 'loss', 'miss', 'downgrade', 'lawsuit', 'investigation'];

    const positiveCount = positiveWords.filter((w) => lower.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => lower.includes(w)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const llmClient = new LlmClient();
