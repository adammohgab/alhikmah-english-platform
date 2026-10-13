/**
 * Multi-provider AI adapter layer with fallback and fake mocks
 *
 * Implements provider-agnostic AI adapter supporting:
 * - Google Gemini (default primary)
 * - Secondary fallback provider (Anthropic / OpenAI compatible)
 * - FakeAIAdapter returning deterministic test fixtures for offline CI/CD unit testing
 *
 * Standard interface:
 * - generateCompletion()
 * - streamCompletion()
 * - generateStructured<T>()
 *
 * Supports temperature, maxTokens, and systemInstruction parameters.
 * Keys reside strictly in Edge secrets: never exposed to client.
 */

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

// -------------------------------------------------------------------
// Types & Interfaces
// -------------------------------------------------------------------

export type ModelTier = "fast" | "smart";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  tier?: ModelTier;
  systemInstruction?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  metadata?: {
    feature?: string;
    requestId?: string;
    userId?: string;
  };
}

export interface CompletionResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  latencyMs: number;
  finishReason: "stop" | "length" | "safety" | "error";
  provider: "gemini" | "fallback" | "fake";
}

export interface StreamChunk {
  delta: string;
  isComplete: boolean;
  tokensIn?: number;
  tokensOut?: number;
  finishReason?: string;
  model?: string;
}

export interface StructuredResult<T> {
  data: T;
  rawText: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  latencyMs: number;
  provider: "gemini" | "fallback" | "fake";
}

export interface AIAdapter {
  generateCompletion(req: CompletionRequest): Promise<CompletionResult>;
  streamCompletion(req: CompletionRequest): AsyncIterable<StreamChunk>;
  generateStructured<T>(
    req: CompletionRequest,
    validator?: (json: unknown) => T
  ): Promise<StructuredResult<T>>;
}

// -------------------------------------------------------------------
// Fake AI Adapter for offline CI/CD testing
// -------------------------------------------------------------------

export class FakeAIAdapter implements AIAdapter {
  private customResponses: Map<string, string> = new Map();

  constructor(customResponses?: Record<string, string>) {
    if (customResponses) {
      for (const [key, value] of Object.entries(customResponses)) {
        this.customResponses.set(key, value);
      }
    }
  }

  setMockResponse(key: string, response: string): void {
    this.customResponses.set(key, response);
  }

  async generateCompletion(req: CompletionRequest): Promise<CompletionResult> {
    const lastMsg = req.messages[req.messages.length - 1]?.content || "";
    const matched = this.customResponses.get(lastMsg);
    const text = matched ?? `[FakeAI Response for tier="${req.tier || "fast"}"]: ${lastMsg}`;

    return {
      text,
      tokensIn: Math.ceil((req.systemInstruction?.length || 0) + lastMsg.length / 4),
      tokensOut: Math.ceil(text.length / 4),
      model: "mock-model-v1",
      latencyMs: 15,
      finishReason: "stop",
      provider: "fake",
    };
  }

  async *streamCompletion(req: CompletionRequest): AsyncIterable<StreamChunk> {
    const completion = await this.generateCompletion(req);
    const words = completion.text.split(" ");

    for (let i = 0; i < words.length; i++) {
      const chunkText = (i === 0 ? "" : " ") + words[i];
      yield {
        delta: chunkText,
        isComplete: false,
      };
    }

    yield {
      delta: "",
      isComplete: true,
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
      finishReason: "stop",
      model: completion.model,
    };
  }

  async generateStructured<T>(
    req: CompletionRequest,
    validator?: (json: unknown) => T
  ): Promise<StructuredResult<T>> {
    const lastMsg = req.messages[req.messages.length - 1]?.content || "";
    const custom = this.customResponses.get(lastMsg);

    let parsed: unknown;
    let rawText = "";

    if (custom) {
      rawText = custom;
      parsed = JSON.parse(custom);
    } else {
      // Default deterministic fixture
      rawText = JSON.stringify({
        summary: "Fake deterministic analysis",
        status: "success",
        score: 4,
        details: { tier: req.tier || "fast", query: lastMsg },
      });
      parsed = JSON.parse(rawText);
    }

    const validatedData = validator ? validator(parsed) : (parsed as T);

    return {
      data: validatedData,
      rawText,
      tokensIn: 25,
      tokensOut: 40,
      model: "mock-structured-v1",
      latencyMs: 18,
      provider: "fake",
    };
  }
}

// -------------------------------------------------------------------
// Gemini Adapter (Default Primary)
// -------------------------------------------------------------------

export class GeminiAIAdapter implements AIAdapter {
  private apiKey: string;
  private fastModel: string;
  private smartModel: string;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(opts?: { apiKey?: string; fastModel?: string; smartModel?: string }) {
    this.apiKey = opts?.apiKey || (typeof Deno !== "undefined" ? Deno.env.get("GEMINI_API_KEY") || Deno.env.get("AI_API_KEY") : "") || "";
    this.fastModel = opts?.fastModel || (typeof Deno !== "undefined" ? Deno.env.get("AI_MODEL_FAST") : "") || "gemini-1.5-flash";
    this.smartModel = opts?.smartModel || (typeof Deno !== "undefined" ? Deno.env.get("AI_MODEL_SMART") : "") || "gemini-1.5-pro";
  }

  private getModel(tier?: ModelTier): string {
    return tier === "smart" ? this.smartModel : this.fastModel;
  }

  async generateCompletion(req: CompletionRequest): Promise<CompletionResult> {
    const startTime = Date.now();
    const model = this.getModel(req.tier);
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    const contents = req.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.maxTokens ?? 2048,
      },
    };

    if (req.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: req.systemInstruction }],
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: req.timeoutMs ? AbortSignal.timeout(req.timeoutMs) : undefined,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error [${response.status}]: ${errText}`);
    }

    const resJson = await response.json();
    const candidate = resJson.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || "";
    const tokensIn = resJson.usageMetadata?.promptTokenCount || 0;
    const tokensOut = resJson.usageMetadata?.candidatesTokenCount || 0;

    return {
      text,
      tokensIn,
      tokensOut,
      model,
      latencyMs: Date.now() - startTime,
      finishReason: candidate?.finishReason === "MAX_TOKENS" ? "length" : "stop",
      provider: "gemini",
    };
  }

  async *streamCompletion(req: CompletionRequest): AsyncIterable<StreamChunk> {
    const model = this.getModel(req.tier);
    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const contents = req.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.maxTokens ?? 2048,
      },
    };

    if (req.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: req.systemInstruction }],
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: req.timeoutMs ? AbortSignal.timeout(req.timeoutMs) : undefined,
    });

    if (!response.ok || !response.body) {
      const errText = await response.text();
      throw new Error(`Gemini stream error [${response.status}]: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr && dataStr !== "[DONE]") {
              try {
                const parsed = JSON.parse(dataStr);
                const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (chunkText) {
                  yield { delta: chunkText, isComplete: false };
                }
              } catch (_) {
                // partial json in buffer; continue
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield {
      delta: "",
      isComplete: true,
      finishReason: "stop",
      model,
    };
  }

  async generateStructured<T>(
    req: CompletionRequest,
    validator?: (json: unknown) => T
  ): Promise<StructuredResult<T>> {
    const startTime = Date.now();
    const model = this.getModel(req.tier);
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    const contents = req.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.1,
        maxOutputTokens: req.maxTokens ?? 2048,
        responseMimeType: "application/json",
      },
    };

    if (req.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: req.systemInstruction + "\nOutput valid JSON only." }],
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: req.timeoutMs ? AbortSignal.timeout(req.timeoutMs) : undefined,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini structured error [${response.status}]: ${err}`);
    }

    const resJson = await response.json();
    const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(rawText);
    const validatedData = validator ? validator(parsed) : (parsed as T);

    return {
      data: validatedData,
      rawText,
      tokensIn: resJson.usageMetadata?.promptTokenCount || 0,
      tokensOut: resJson.usageMetadata?.candidatesTokenCount || 0,
      model,
      latencyMs: Date.now() - startTime,
      provider: "gemini",
    };
  }
}

// -------------------------------------------------------------------
// Fallback Adapter (OpenAI / Anthropic Compatible Interface)
// -------------------------------------------------------------------

export class OpenAIFallbackAdapter implements AIAdapter {
  private apiKey: string;
  private baseUrl: string;
  private fastModel: string;
  private smartModel: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string; fastModel?: string; smartModel?: string }) {
    this.apiKey = opts?.apiKey || (typeof Deno !== "undefined" ? Deno.env.get("AI_FALLBACK_API_KEY") || Deno.env.get("OPENAI_API_KEY") : "") || "";
    this.baseUrl = opts?.baseUrl || (typeof Deno !== "undefined" ? Deno.env.get("AI_FALLBACK_URL") : "") || "https://api.openai.com/v1";
    this.fastModel = opts?.fastModel || (typeof Deno !== "undefined" ? Deno.env.get("AI_FALLBACK_MODEL_FAST") : "") || "gpt-4o-mini";
    this.smartModel = opts?.smartModel || (typeof Deno !== "undefined" ? Deno.env.get("AI_FALLBACK_MODEL_SMART") : "") || "gpt-4o";
  }

  private getModel(tier?: ModelTier): string {
    return tier === "smart" ? this.smartModel : this.fastModel;
  }

  async generateCompletion(req: CompletionRequest): Promise<CompletionResult> {
    const startTime = Date.now();
    const model = this.getModel(req.tier);

    const messages = [];
    if (req.systemInstruction) {
      messages.push({ role: "system", content: req.systemInstruction });
    }
    for (const m of req.messages) {
      messages.push({ role: m.role, content: m.content });
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 2048,
      }),
      signal: req.timeoutMs ? AbortSignal.timeout(req.timeoutMs) : undefined,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Fallback AI provider error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    return {
      text,
      tokensIn: data.usage?.prompt_tokens || 0,
      tokensOut: data.usage?.completion_tokens || 0,
      model,
      latencyMs: Date.now() - startTime,
      finishReason: data.choices?.[0]?.finish_reason === "length" ? "length" : "stop",
      provider: "fallback",
    };
  }

  async *streamCompletion(req: CompletionRequest): AsyncIterable<StreamChunk> {
    const model = this.getModel(req.tier);

    const messages = [];
    if (req.systemInstruction) {
      messages.push({ role: "system", content: req.systemInstruction });
    }
    for (const m of req.messages) {
      messages.push({ role: m.role, content: m.content });
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 2048,
        stream: true,
      }),
      signal: req.timeoutMs ? AbortSignal.timeout(req.timeoutMs) : undefined,
    });

    if (!response.ok || !response.body) {
      const err = await response.text();
      throw new Error(`Fallback AI stream error [${response.status}]: ${err}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") {
              yield { delta: "", isComplete: true, model };
              return;
            }
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              if (delta) {
                yield { delta, isComplete: false };
              }
            } catch (_) {
              // ignore partial json
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { delta: "", isComplete: true, model };
  }

  async generateStructured<T>(
    req: CompletionRequest,
    validator?: (json: unknown) => T
  ): Promise<StructuredResult<T>> {
    const startTime = Date.now();
    const model = this.getModel(req.tier);

    const messages = [];
    if (req.systemInstruction) {
      messages.push({ role: "system", content: req.systemInstruction + "\nRespond in JSON only." });
    }
    for (const m of req.messages) {
      messages.push({ role: m.role, content: m.content });
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        temperature: req.temperature ?? 0.1,
        max_tokens: req.maxTokens ?? 2048,
      }),
      signal: req.timeoutMs ? AbortSignal.timeout(req.timeoutMs) : undefined,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Fallback AI structured error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(rawText);
    const validatedData = validator ? validator(parsed) : (parsed as T);

    return {
      data: validatedData,
      rawText,
      tokensIn: data.usage?.prompt_tokens || 0,
      tokensOut: data.usage?.completion_tokens || 0,
      model,
      latencyMs: Date.now() - startTime,
      provider: "fallback",
    };
  }
}

// -------------------------------------------------------------------
// Multi-Provider Orchestrator with Fallback and Fake Mode
// -------------------------------------------------------------------

export class MultiProviderAIAdapter implements AIAdapter {
  private primary: AIAdapter;
  private fallback: AIAdapter;
  private useFake: boolean;

  constructor(opts?: { primary?: AIAdapter; fallback?: AIAdapter; forceFake?: boolean }) {
    const isCiOrTest =
      opts?.forceFake ??
      (typeof Deno !== "undefined"
        ? Deno.env.get("CI") === "true" ||
          Deno.env.get("DENO_ENV") === "test" ||
          Deno.env.get("AI_PROVIDER") === "fake" ||
          !Deno.env.get("GEMINI_API_KEY") && !Deno.env.get("AI_API_KEY")
        : true);

    this.useFake = isCiOrTest;
    this.primary = opts?.primary || (isCiOrTest ? new FakeAIAdapter() : new GeminiAIAdapter());
    this.fallback = opts?.fallback || (isCiOrTest ? new FakeAIAdapter() : new OpenAIFallbackAdapter());
  }

  async generateCompletion(req: CompletionRequest): Promise<CompletionResult> {
    if (this.useFake) {
      return this.primary.generateCompletion(req);
    }

    try {
      return await this.primary.generateCompletion(req);
    } catch (primaryErr) {
      console.warn("Primary AI provider failed, trying fallback provider:", primaryErr);
      return await this.fallback.generateCompletion(req);
    }
  }

  async *streamCompletion(req: CompletionRequest): AsyncIterable<StreamChunk> {
    if (this.useFake) {
      for await (const chunk of this.primary.streamCompletion(req)) {
        yield chunk;
      }
      return;
    }

    try {
      for await (const chunk of this.primary.streamCompletion(req)) {
        yield chunk;
      }
    } catch (primaryErr) {
      console.warn("Primary stream failed, switching to fallback stream:", primaryErr);
      for await (const chunk of this.fallback.streamCompletion(req)) {
        yield chunk;
      }
    }
  }

  async generateStructured<T>(
    req: CompletionRequest,
    validator?: (json: unknown) => T
  ): Promise<StructuredResult<T>> {
    if (this.useFake) {
      return this.primary.generateStructured(req, validator);
    }

    try {
      return await this.primary.generateStructured(req, validator);
    } catch (primaryErr) {
      console.warn("Primary structured failed, falling back:", primaryErr);
      return await this.fallback.generateStructured(req, validator);
    }
  }
}

/** Global default AI adapter instance for edge functions */
export const defaultAIAdapter = new MultiProviderAIAdapter();
