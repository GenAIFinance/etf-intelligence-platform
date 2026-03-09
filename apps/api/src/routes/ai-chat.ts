// AI Chat — Expert Portfolio Manager Advisory
// apps/api/src/routes/ai-chat.ts
//
// POST /api/ai-chat/query
//   Body:  { query: string, userProfile?: UserProfile, history?: HistoryMessage[] }
//   Reply: ChatResponse — structured JSON with analysis, recommendations, avoid, education, disclaimer
//
// Calls DeepSeek with expert persona + live ETF context from DB.
// Separate from ai-screener.ts (which extracts structured params).
// This route is for open-ended advisory questions in plain English.

import { FastifyInstance } from 'fastify';
import axios, { AxiosError } from 'axios';
import { cacheGet, cacheSet, makeCacheKey } from '../lib/cache';
import { getEtfContext } from '../services/etf-context';

// ============================================================================
// TYPES
// ============================================================================

export interface UserProfile {
  objective?:   'growth' | 'income' | 'preservation';
  riskProfile?: 'low' | 'medium' | 'high';
}

export interface HistoryMessage {
  role:    'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  query:       string;
  userProfile?: UserProfile;
  history?:    HistoryMessage[];
}

export interface RecommendationMetrics {
  return3Y:     number | null;
  volatility:   number | null;
  sharpe:       number | null;
  expenseRatio: number | null;
  dividendYield:number | null;
}

export interface Recommendation {
  ticker:     string;
  name:       string;
  allocation: number | null;
  reasoning:  string;
  risks:      string;
  profile:    string[];
  metrics:    RecommendationMetrics;
}

export interface AvoidItem {
  ticker:      string;
  name:        string;
  reasoning:   string;
  alternative: string | null;
}

export interface SelectionRationale {
  summary: string;   // e.g. "From 5,000+ ETFs, I narrowed to 4 based on your question"
  filters: string[]; // e.g. ["Sector relevance to rate environment", "Expense ratio ≤ 0.30%"]
}

export interface ChatResponse {
  analysis: {
    macroView:  string;
    keyRisks:   string[];
    sentiment:  'bullish' | 'bearish' | 'neutral' | 'mixed';
  };
  recommendations:    Recommendation[];
  avoid:              AvoidItem[];
  education:          Record<string, string>;
  selectionRationale: SelectionRationale;
  disclaimer:         string;
}

// ============================================================================
// SYSTEM PROMPT — Expert Persona
// ============================================================================

const SYSTEM_PROMPT = `You are a seasoned portfolio manager and economist with 20+ years of experience analyzing global markets. Your specialty is translating complex macroeconomic and geopolitical developments into clear, actionable ETF insights for investors of all knowledge levels.

When responding:
- First analyze from a top-down perspective: macro trends, central bank policy, supply/demand shifts, sector sentiment.
- Drill down to specific ETFs from the provided list that are most relevant.
- Explain reasoning step by step using analogies so a novice investor can follow.
- Always include risk factors and alternative scenarios.
- Never recommend a specific allocation percentage greater than 25% in a single ETF.
- Only reference ETFs from the provided database list when making recommendations.

CRITICAL: You must always include a disclaimer field reminding users this is not investment advice.

Output ONLY a raw JSON object matching this exact schema — no markdown, no preamble:
{
  "analysis": {
    "macroView": "string — 2-4 sentences, top-down analysis",
    "keyRisks": ["string", "string", "string"],
    "sentiment": "bullish" | "bearish" | "neutral" | "mixed"
  },
  "recommendations": [
    {
      "ticker": "string",
      "name": "string",
      "allocation": number | null,
      "reasoning": "string — why this ETF fits the situation and user profile",
      "risks": "string — specific downside risks",
      "profile": ["Growth" | "Income" | "Preservation"],
      "metrics": {
        "return3Y": number | null,
        "volatility": number | null,
        "sharpe": number | null,
        "expenseRatio": number | null,
        "dividendYield": number | null
      }
    }
  ],
  "avoid": [
    {
      "ticker": "string",
      "name": "string",
      "reasoning": "string — why to avoid in this environment",
      "alternative": "string | null — what to consider instead"
    }
  ],
  "education": {
    "conceptName": "plain English explanation using an analogy"
  },
  "selectionRationale": {
    "summary": "string — one sentence explaining how you narrowed from 5,000+ ETFs to these specific ones, referencing the user's question",
    "filters": ["string — each filter or criterion you applied, e.g. 'Sector relevance to rate environment', 'Expense ratio under 0.40%', 'Minimum 3-year track record', 'Sufficient liquidity (AUM > $500M)'"]
  },
  "disclaimer": "This analysis is for educational and informational purposes only. It does not constitute investment advice, a solicitation, or a recommendation to buy or sell any security. Past performance does not guarantee future results. Always consult a qualified financial advisor before making investment decisions."
}`;

// ============================================================================
// ROUTE
// ============================================================================

export async function aiChatRoutes(fastify: FastifyInstance) {

  fastify.post<{ Body: ChatRequest }>('/api/ai-chat/query', async (request, reply) => {
    const { query, userProfile, history = [] } = request.body;

    // ── Input validation ──────────────────────────────────────────────────
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return reply.status(400).send({ error: 'query is required' });
    }
    if (query.trim().length > 800) {
      return reply.status(400).send({ error: 'Query must be under 800 characters' });
    }

    // OpenAI preferred (reliable from Railway). Falls back to DeepSeek if OPENAI_API_KEY not set.
    const useOpenAI = !!process.env.OPENAI_API_KEY;
    const apiKey    = useOpenAI ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY;
    const apiUrl    = useOpenAI
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.deepseek.com/v1/chat/completions';
    const model     = useOpenAI ? 'gpt-4o-mini' : 'deepseek-chat';

    if (!apiKey) {
      fastify.log.error('No AI API key — set OPENAI_API_KEY or DEEPSEEK_API_KEY in Railway');
      return reply.status(500).send({ error: 'AI service not configured' });
    }

    // ── Cache check (skip if there is conversation history — context changes) ──
    const cacheKey = makeCacheKey(`chat:${query}`, userProfile);
    if (history.length === 0) {
      const cached = cacheGet(cacheKey);
      if (cached) {
        fastify.log.info({ query: query.trim() }, 'ai-chat: cache hit');
        return reply.send(JSON.parse(cached));
      }
    }

    // ── Fetch ETF context from DB ─────────────────────────────────────────
    let etfBlock = '';
    try {
      const etfContext = await getEtfContext(query.trim());
      if (etfContext.length > 0) {
        etfBlock =
          `\n\nRelevant ETFs in database (use ONLY these when making recommendations):\n` +
          etfContext.map(e =>
            `${e.ticker} (${e.name}): ` +
            `3Y=${e.return3Y != null ? (e.return3Y * 100).toFixed(1) + '%' : 'N/A'}, ` +
            `Vol=${e.volatility != null ? (e.volatility * 100).toFixed(1) + '%' : 'N/A'}, ` +
            `Sharpe=${e.sharpe?.toFixed(2) ?? 'N/A'}, ` +
            `ER=${e.expenseRatio != null ? (e.expenseRatio * 100).toFixed(2) + '%' : 'N/A'}`
          ).join('\n');
      }
    } catch (dbErr) {
      fastify.log.warn(dbErr, 'ai-chat: etf context fetch failed — proceeding without');
    }

    // ── Build user message ────────────────────────────────────────────────
    let userMessage = '';

    if (userProfile?.objective || userProfile?.riskProfile) {
      userMessage += `User profile: objective=${userProfile.objective ?? 'unspecified'}, ` +
                     `risk=${userProfile.riskProfile ?? 'unspecified'}.\n\n`;
    }

    userMessage += `Question: "${query.trim()}"`;
    userMessage += etfBlock;

    // ── Build messages array (supports multi-turn) ────────────────────────
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      // Inject prior turns (flatten to text to keep prompt tight)
      ...history.slice(-4).map(h => ({  // max 4 prior turns to limit tokens
        role:    h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: userMessage },
    ];

    // ── Call AI provider ──────────────────────────────────────────────────
    try {
      const dsResponse = await axios.post(
        apiUrl,
        {
          model,
          temperature: 0.3,
          max_tokens:  1200,
          messages,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type':  'application/json',
          },
          timeout: 30_000,
        }
      );

      const rawText: string = dsResponse.data?.choices?.[0]?.message?.content ?? '';

      const jsonText = rawText
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim();

      let parsed: ChatResponse;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        fastify.log.error({ rawText }, 'ai-chat: JSON parse failed');
        return reply.status(422).send({
          error: 'Could not parse response — try rephrasing your question',
        });
      }

      // ── Ensure disclaimer is always present ───────────────────────────
      if (!parsed.disclaimer || parsed.disclaimer.trim().length < 20) {
        parsed.disclaimer =
          'This analysis is for educational and informational purposes only. ' +
          'It does not constitute investment advice, a solicitation, or a recommendation ' +
          'to buy or sell any security. Past performance does not guarantee future results. ' +
          'Always consult a qualified financial advisor before making investment decisions.';
      }

      // ── Normalise optional arrays ─────────────────────────────────────
      if (!Array.isArray(parsed.recommendations)) parsed.recommendations = [];
      if (!Array.isArray(parsed.avoid))           parsed.avoid           = [];
      if (!parsed.education || typeof parsed.education !== 'object') parsed.education = {};

      // ── Normalise selectionRationale ──────────────────────────────────
      if (!parsed.selectionRationale || typeof parsed.selectionRationale !== 'object') {
        parsed.selectionRationale = {
          summary: `From 5,000+ ETFs, ${parsed.recommendations.length} were selected based on relevance to your question.`,
          filters: ['Relevance to the macro theme or question', 'Sufficient liquidity and track record', 'Risk/return profile fit'],
        };
      } else {
        if (!parsed.selectionRationale.summary) {
          parsed.selectionRationale.summary = `From 5,000+ ETFs, ${parsed.recommendations.length} were selected based on relevance to your question.`;
        }
        if (!Array.isArray(parsed.selectionRationale.filters) || parsed.selectionRationale.filters.length === 0) {
          parsed.selectionRationale.filters = ['Relevance to the macro theme or question', 'Sufficient liquidity and track record', 'Risk/return profile fit'];
        }
      }

      // ── Cache first-turn responses ────────────────────────────────────
      if (history.length === 0) {
        cacheSet(cacheKey, JSON.stringify(parsed), 1800); // 30 min for chat (news-sensitive)
      }

      fastify.log.info({
        query:    query.trim(),
        sentiment: parsed.analysis?.sentiment,
        recs:     parsed.recommendations?.length,
      }, 'ai-chat: response complete');

      return reply.send(parsed);

    } catch (err) {
      const axErr = err as AxiosError;
      fastify.log.error(err, 'ai-chat: DeepSeek error');

      if (axErr.response?.status === 401) return reply.status(500).send({ error: 'DeepSeek API key invalid' });
      if (axErr.response?.status === 429) return reply.status(429).send({ error: 'AI rate limit — try again in a moment' });
      if (axErr.code === 'ECONNABORTED')  return reply.status(504).send({ error: 'AI request timed out' });

      return reply.status(500).send({ error: 'Failed to process your question' });
    }
  });
}
