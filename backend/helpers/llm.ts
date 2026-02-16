// LLM Client (stub for now - AI Screener works without LLM using keyword fallback)
// apps/api/src/services/llm.ts

export const llmClient = {
  enabled: false,
  chat: async () => {
    throw new Error('LLM not configured - using keyword fallback');
  }
};
