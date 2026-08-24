import "server-only";

import { FunctionCallingConfigMode, GoogleGenAI, type FunctionCall, type GenerateContentResponse, type Part } from "@google/genai";
import { aiConfig } from "@/services/ai/ai.config";
import { buildSystemPrompt } from "@/services/ai/ai.prompt";
import { aiStructuredAnswerSchema } from "@/services/ai/ai.schemas";
import { uniqueEntities } from "@/services/ai/tools/tool.shared";
import type { AIEntity, AIProvider, AIProviderRequest, AIProviderResponse } from "@/services/ai/ai.types";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  readonly model = aiConfig.model;
  private readonly client: GoogleGenAI;

  constructor(apiKey = process.env.GEMINI_API_KEY) {
    if (!apiKey?.trim()) throw new Error("AI_PROVIDER_NOT_CONFIGURED");
    this.client = new GoogleGenAI({ apiKey: apiKey.trim(), apiVersion: "v1beta" });
  }

  async generateResponse(input: AIProviderRequest): Promise<AIProviderResponse> {
    const toolMap = new Map(input.tools.map((tool) => [tool.declaration.name, tool]));
    const history = normalizeHistory(input.history);
    const chat = this.client.chats.create({
      model: this.model,
      history,
      config: {
        systemInstruction: buildSystemPrompt(input.scopeDescription),
        temperature: 0.1,
        maxOutputTokens: 2_048,
        responseMimeType: "application/json",
        responseJsonSchema: { type: "object", additionalProperties: false, properties: { answer: { type: "string" } }, required: ["answer"] },
        tools: [{ functionDeclarations: input.tools.map((tool) => tool.declaration) }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        httpOptions: { timeout: aiConfig.timeoutMs, retryOptions: { attempts: 2, initialDelay: 0.5, maxDelay: 2 } },
      },
    });

    const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    const entities: AIEntity[] = [];
    const toolsUsed: string[] = [];
    let toolCallCount = 0;
    let response = await chat.sendMessage({ message: input.message });
    addUsage(usage, response);

    while (response.functionCalls?.length) {
      const functionResponses: Part[] = [];
      for (const call of response.functionCalls) {
        toolCallCount += 1;
        const functionResponse = await this.executeCall(call, toolCallCount, toolMap, input, entities, toolsUsed);
        functionResponses.push({ functionResponse });
      }
      response = await chat.sendMessage({
        message: functionResponses,
        ...(toolCallCount >= aiConfig.maxToolCalls ? { config: finalResponseConfig(input, input.tools) } : {}),
      });
      addUsage(usage, response);
    }

    const rawText = response.text;
    if (!rawText) throw new Error("AI_MALFORMED_RESPONSE");
    let parsed: unknown;
    try { parsed = JSON.parse(rawText); } catch { throw new Error("AI_MALFORMED_RESPONSE"); }
    const answer = aiStructuredAnswerSchema.parse(parsed).answer;
    return { answer, entities: uniqueEntities(entities), toolsUsed: [...new Set(toolsUsed)], usage };
  }

  private async executeCall(
    call: FunctionCall,
    callNumber: number,
    toolMap: Map<string | undefined, AIProviderRequest["tools"][number]>,
    input: AIProviderRequest,
    entities: AIEntity[],
    toolsUsed: string[],
  ) {
    const name = call.name || "unknown";
    if (callNumber > aiConfig.maxToolCalls) {
      return { id: call.id, name, response: { error: "The approved CRM tool-call limit was reached. Answer with the information already available." } };
    }
    const tool = toolMap.get(name);
    if (!tool) return { id: call.id, name, response: { error: "Unapproved tool. No data was accessed." } };
    toolsUsed.push(name);
    try {
      const toolResult = await tool.execute(call.args || {}, input.toolContext);
      if (toolResult.entities) entities.push(...toolResult.entities);
      return { id: call.id, name, response: { output: toolResult } };
    } catch (error) {
      const code = error instanceof Error && error.message === "FORBIDDEN" ? "FORBIDDEN" : "INVALID_OR_UNAVAILABLE";
      return { id: call.id, name, response: { error: code === "FORBIDDEN" ? "Access denied by server scope. No data was returned." : "The tool request was invalid or no authorized record was available." } };
    }
  }
}

function finalResponseConfig(input: AIProviderRequest, tools: AIProviderRequest["tools"]) {
  return {
    systemInstruction: buildSystemPrompt(input.scopeDescription),
    temperature: 0.1,
    maxOutputTokens: 2_048,
    responseMimeType: "application/json",
    responseJsonSchema: { type: "object", additionalProperties: false, properties: { answer: { type: "string" } }, required: ["answer"] },
    tools: [{ functionDeclarations: tools.map((tool) => tool.declaration) }],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.NONE } },
    httpOptions: { timeout: aiConfig.timeoutMs, retryOptions: { attempts: 2, initialDelay: 0.5, maxDelay: 2 } },
  };
}

function normalizeHistory(history: AIProviderRequest["history"]) {
  const normalized: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
  for (const message of history) {
    const role = message.role === "assistant" ? "model" : "user";
    if (!normalized.length && role === "model") continue;
    if (normalized.at(-1)?.role === role) continue;
    normalized.push({ role, parts: [{ text: message.content }] });
  }
  if (normalized.at(-1)?.role === "user") normalized.pop();
  return normalized;
}

function addUsage(target: AIProviderResponse["usage"], response: GenerateContentResponse) {
  target.inputTokens += response.usageMetadata?.promptTokenCount || 0;
  target.outputTokens += response.usageMetadata?.candidatesTokenCount || 0;
  target.totalTokens += response.usageMetadata?.totalTokenCount || 0;
}
