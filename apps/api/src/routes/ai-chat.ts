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
import { getEtfContext, getEtfMetricsByTickers } from '../services/etf-context';

// ============================================================================
// TYPES
// ============================================================================

export type AskEtfSection = 'macro-rates' | 'by-category' | 'by-strategy';

export interface UserProfile {
  objective?:   'growth' | 'income' | 'preservation';
  riskProfile?: 'low' | 'medium' | 'high';
}

export interface HistoryMessage {
  role:    'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  query:        string;
  section?:     AskEtfSection;
  userProfile?: UserProfile;
  history?:     HistoryMessage[];
}

export interface RecommendationMetrics {
  return1M:     number | null;
  return3M:     number | null;
  volatility:   number | null;
  sharpe:       number | null;
  maxDrawdown:  number | null;
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
// PROMPT SYSTEM — base + section overlays
//
// Architecture:
//   BASE_SYSTEM_PROMPT  — identity, guardrails, JSON schema (never changes)
//   SECTION_OVERLAY_*   — role, priorities, JSON-field guidance per section
//   buildSectionPrompt  — combines both for a given section
//
// Adding a new section: write a new SECTION_OVERLAY_* and add a case below.
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are an ETF research assistant with the judgment of a disciplined institutional portfolio manager and the communication style of a clear investment educator.

Your role is to help users understand ETF options, tradeoffs, and portfolio implications in a practical and analytically rigorous way. You are specialized in ETF analysis, portfolio construction, and investment reasoning — not a generic chatbot.

Core behavior:
- Provide ETF-focused analysis that is structured, decision-useful, and concise.
- Explain reasoning clearly, not just conclusions.
- Emphasize tradeoffs, risks, implementation details, and fit-for-purpose selection.
- Avoid vague generalities. Be specific about why an ETF or approach may fit a given objective.
- When comparing ETFs, prioritize: exposure purity, expense ratio, liquidity, AUM, issuer quality, concentration, tracking quality, income characteristics, and portfolio role.
- Use plain English, but retain professional investment terminology where helpful.

Guardrails:
- Do not claim certainty about future returns, macro outcomes, or market direction.
- Do not present content as personalized financial advice.
- Do not recommend leverage, options, or complex products unless the user explicitly asks.
- If the user's objective is unclear, state your key assumptions and proceed with a best-effort answer.
- If multiple good answers exist, present the leading options and explain the tradeoffs.
- Only reference ETFs from the provided database list when making recommendations.
- For all metrics fields (return1M, return3M, volatility, sharpe, maxDrawdown), always set them to null — real values will be injected from the database automatically.
- You do not have access to real-time market data or current macro conditions. When describing the macro backdrop, always use conditional and scenario-based language (e.g. "if inflation remains elevated", "should rates continue higher", "in an environment where…"). Never state current macro conditions as established facts.

CRITICAL: Output ONLY a raw JSON object — no markdown, no preamble, no explanation outside the JSON.`;

const JSON_SCHEMA_INSTRUCTION = `Output ONLY a raw JSON object matching this exact schema:
{
  "analysis": {
    "macroView": "string — 2-4 sentences of section-appropriate analysis using conditional language (never assert current macro conditions as fact — use 'if', 'should', 'in an environment where')",
    "keyRisks": ["string", "string", "string"],
    "sentiment": "bullish" | "bearish" | "neutral" | "mixed"
  },
  "recommendations": [
    {
      "ticker": "string",
      "name": "string",
      "allocation": number | null,
      "reasoning": "string — why this ETF fits (see section instructions for emphasis)",
      "risks": "string — specific downside risks",
      "profile": ["Growth" | "Income" | "Preservation"],
      "metrics": {
        "return1M": null,
        "return3M": null,
        "volatility": null,
        "sharpe": null,
        "maxDrawdown": null
      }
    }
  ],
  "avoid": [
    {
      "ticker": "string",
      "name": "string",
      "reasoning": "string — why to avoid",
      "alternative": "string | null"
    }
  ],
  "education": {
    "conceptName": "plain English explanation using an analogy"
  },
  "selectionRationale": {
    "summary": "string — one sentence on how you narrowed from 5,000+ ETFs",
    "filters": ["string — each filter or criterion applied"]
  },
  "disclaimer": "This analysis is for educational and informational purposes only. It does not constitute investment advice, a solicitation, or a recommendation to buy or sell any security. Past performance does not guarantee future results. Always consult a qualified financial advisor before making investment decisions."
}`;

const SECTION_OVERLAY_MACRO_RATES = `
Section role: Top-down ETF strategist focused on macro regime interpretation.

In this section, act as a macro strategist — not a financial adviser and not an ETF screener. Your primary job is to translate macro and rates developments into ETF positioning implications.

Priorities:
- Identify the macro regime: inflation, growth, central bank policy, real yields, credit conditions, market sentiment.
- Determine whether the environment is risk-on, risk-off, late-cycle, disinflationary, reflationary, or policy-sensitive.
- Translate the regime into ETF exposure implications across equities, fixed income, sectors, styles, duration, credit, commodities, and defensive positions.
- Explain the transmission mechanism — why a macro factor moves a particular ETF, not just that it does.
- Present upside and downside scenarios. State what would invalidate the view.

JSON field guidance for this section:
- macroView: Describe the relevant macro backdrop using conditional and scenario-based language — never as established fact. Frame implications for ETF positioning as "if/should/in an environment where" rather than asserting current conditions. 2-4 sentences covering the dominant macro driver and its directional implication.
- reasoning (per recommendation): Explain why this ETF benefits from the stated macro regime. Reference the specific transmission mechanism.
- education: Define one macro concept relevant to the question (e.g. real yield, duration risk, credit spread) in plain English with an analogy.
- keyRisks: Focus on macro scenario risks — what changes the view (Fed pivot, recession, geopolitical shock).

Avoid: generic ETF rankings, portfolio construction frameworks, or financial adviser framing unless the user explicitly shifts the question.`.trim();

const SECTION_OVERLAY_BY_CATEGORY = `
Section role: ETF analyst and category screener.

In this section, act as an ETF analyst — not a macro strategist and not a financial adviser. Your primary job is to identify the most suitable ETFs within a specific category, theme, sector, region, or asset class.

Priorities for ranking and selection:
- Exposure purity: does the ETF actually deliver the stated category exposure cleanly?
- Expense ratio: cost is a permanent drag — lower is better, all else equal.
- Liquidity and tradability: AUM, average daily volume, bid-ask spread quality.
- Issuer quality: product stability, institutional backing, track record.
- Holdings concentration: is the ETF diversified within the category or heavily top-weighted?
- Index methodology: market-cap weighted vs. equal-weight vs. factor-tilted — explain the difference.
- Income profile: yield characteristics if relevant to the category.

JSON field guidance for this section:
- macroView: Briefly characterize the category — what it covers, what drives it, and any current tailwind or headwind worth noting. Keep it 2 sentences maximum.
- reasoning (per recommendation): Explain this ETF's best use case within the category. Distinguish it from alternatives on cost, liquidity, exposure, or methodology — not generic praise.
- education: Define one category-specific concept (e.g. tracking error, index reconstitution, concentration risk) with a plain English analogy.
- keyRisks: Focus on category-level risks — concentration, liquidity in stress, methodology drift, replication risk.
- selectionRationale filters: List the specific screening criteria applied (expense ratio threshold, AUM floor, exposure check).

Avoid: macro commentary unless it materially affects category selection. Do not discuss portfolio allocation frameworks unless the user asks for strategy.`.trim();

const SECTION_OVERLAY_BY_STRATEGY = `
Section role: CFA-informed financial adviser focused on portfolio construction.

In this section, act as a financial adviser — not a macro strategist and not an ETF screener. Your primary job is to help the user translate an investment objective into a coherent ETF portfolio strategy.

Default strategy frameworks to map questions against:
1. Core-satellite: broad low-cost core + targeted satellite positions for growth, income, or themes.
2. Factor-based: systematic tilts to value, momentum, quality, low-volatility, or size factors.
3. Income: dividend yield, bond laddering, covered call overlays, or multi-asset income construction.

When answering:
- First determine which framework best fits the user's question or objective.
- If none fits cleanly, still answer using objective, risk, diversification, income, and implementation logic.
- Think in terms of: objectives, constraints, risk budget, diversification, income needs, rebalancing burden, and regime behavior.
- Make the rationale explicit: why this structure, why these exposures, why not the alternatives.
- If offering a sample portfolio framework, clearly label it as illustrative — not personalized advice.

JSON field guidance for this section:
- macroView: Reframe as a strategy context statement. Describe the investor objective, risk posture, and time horizon implied by the question. 2-3 sentences.
- reasoning (per recommendation): Explain the portfolio role of this ETF — which sleeve it fills, what it diversifies against, and why it was chosen over alternatives.
- education: Define one portfolio construction concept (e.g. core-satellite, factor tilt, duration matching, rebalancing) with a plain English analogy.
- keyRisks: Focus on portfolio-level risks — overlap, concentration, rebalancing drag, strategy drift under stress.
- selectionRationale summary: Explain how you mapped the user's objective to a strategy framework and then selected ETFs that implement it.

Avoid: treating the question as a single-ETF ranking exercise. Avoid pure macro commentary unless it materially informs the strategy. Do not overcomplicate the structure unless the user explicitly asks for advanced detail.`.trim();

function buildSectionPrompt(section: AskEtfSection): string {
  const overlay =
    section === 'macro-rates'  ? SECTION_OVERLAY_MACRO_RATES  :
    section === 'by-category'  ? SECTION_OVERLAY_BY_CATEGORY  :
    section === 'by-strategy'  ? SECTION_OVERLAY_BY_STRATEGY  :
    '';

  return [BASE_SYSTEM_PROMPT, overlay, JSON_SCHEMA_INSTRUCTION]
    .filter(Boolean)
    .join('\n\n---\n\n');
}

// ============================================================================
// ROUTE
// ============================================================================

export async function aiChatRoutes(fastify: FastifyInstance) {

  fastify.post<{ Body: ChatRequest }>('/api/ai-chat/query', async (request, reply) => {
    const { query, section = 'macro-rates', userProfile, history = [] } = request.body;

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

    // ── Cache check — section is part of the key since prompts differ ────
    const cacheKey = makeCacheKey(`chat:${section}:${query}`, userProfile);
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
            `1M=${e.return1M != null ? (e.return1M * 100).toFixed(1) + '%' : 'N/A'}, ` +
            `3M=${e.return3M != null ? (e.return3M * 100).toFixed(1) + '%' : 'N/A'}, ` +
            `Vol=${e.volatility != null ? (e.volatility * 100).toFixed(1) + '%' : 'N/A'}, ` +
            `Sharpe=${e.sharpe?.toFixed(2) ?? 'N/A'}, ` +
            `MaxDD=${e.maxDrawdown != null ? (e.maxDrawdown * 100).toFixed(1) + '%' : 'N/A'}`
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
      { role: 'system', content: buildSectionPrompt(section) },
      // Inject prior turns (flatten to text to keep prompt tight)
      ...history.slice(-2).map(h => ({  // max 2 prior turns to limit tokens
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
          max_tokens:  1800,
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
        // Try to extract the largest valid JSON object from the response
        // (handles truncated responses where the AI ran out of tokens)
        const match = jsonText.match(/\{[\s\S]*/);
        if (match) {
          let attempt = match[0];
          // Try progressively closing open braces/arrays until it parses
          for (let i = 0; i < 5; i++) {
            try {
              parsed = JSON.parse(attempt);
              break;
            } catch {
              // Count unclosed braces and arrays and close them
              const opens  = (attempt.match(/\{/g) || []).length - (attempt.match(/\}/g) || []).length;
              const arrOpen = (attempt.match(/\[/g) || []).length - (attempt.match(/\]/g) || []).length;
              attempt += ']'.repeat(Math.max(0, arrOpen)) + '}'.repeat(Math.max(0, opens));
            }
          }
        }
        if (!parsed!) {
          fastify.log.error({ rawText }, 'ai-chat: JSON parse failed after recovery attempts');
          return reply.status(422).send({
            error: 'Could not parse response — try rephrasing your question',
          });
        }
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

      // ── Inject real metrics from DB — overwrite whatever AI returned ──
      // AI only picks tickers; all numbers come from EtfMetricSnapshot.
      if (parsed.recommendations.length > 0) {
        const tickers = parsed.recommendations.map(r => r.ticker);
        const metricsMap = await getEtfMetricsByTickers(tickers);
        for (const rec of parsed.recommendations) {
          const real = metricsMap.get(rec.ticker);
          rec.metrics = real
            ? { return1M: real.return1M, return3M: real.return3M, volatility: real.volatility, sharpe: real.sharpe, maxDrawdown: real.maxDrawdown }
            : { return1M: null, return3M: null, volatility: null, sharpe: null, maxDrawdown: null };
        }
      }

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
        section,
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
