import type { JSONObject, JSONValue } from "../types/index.js";
import type { ModelDefinition } from "./models.js";

export const MODEL_CATALOG_CACHE_KEY = "modelCatalogV1";

const CREATOR_NAMES = new Map([
  ["openai", "OpenAI"],
  ["anthropic", "Anthropic"],
  ["google", "Google"],
  ["xai", "X.AI"],
  ["spacexai", "X.AI"],
  ["deepseek", "DeepSeek"],
  ["alibaba", "Alibaba"],
  ["moonshotai", "Moonshot AI"],
  ["zai", "Z.AI"],
  ["minimax", "MiniMax"],
  ["mistral", "Mistral"],
  ["meta", "Meta"],
  ["nvidia", "NVIDIA"],
]);

const RECOMMENDED_FAMILIES = new Map([
  ["openai", /^(?:gpt-(?:[5-9]|\d{2,})(?:[.-]|$)|o[3-9](?:[.-]|$))/],
  ["anthropic", /^claude-(?:opus|sonnet|haiku|fable)-(?:[4-9]|\d{2,})(?:[.-]|$)/],
  ["google", /^gemini-(?:[3-9]|\d{2,})(?:[.-]|$)/],
  ["spacexai", /^grok-(?:[4-9]|\d{2,})(?:[.-]|$)/],
  ["xai", /^grok-(?:[4-9]|\d{2,})(?:[.-]|$)/],
  ["deepseek", /^deepseek-(?:v(?:[3-9]|\d{2,})|r\d)/],
  ["alibaba", /^qwen-?(?:[3-9]|\d{2,})/],
  ["moonshotai", /^kimi-/],
  ["zai", /^glm-(?:[4-9]|\d{2,})/],
  ["minimax", /^minimax-m(?:[2-9]|\d{2,})/],
  ["mistral", /^(?:mistral-(?:large|medium)|magistral)/],
  ["meta", /^llama-(?:[4-9]|\d{2,})/],
  ["nvidia", /^nemotron-3/],
]);

function isCatalogRecord(value: JSONValue | undefined): value is JSONObject {
  return (
    value !== undefined &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function readCatalogText(value: JSONValue | undefined): string | undefined {
  return Object.prototype.toString.call(value) === "[object String]" ? String(value) : undefined;
}

function readCatalogNumber(value: JSONValue | undefined): number | undefined {
  if (Object.prototype.toString.call(value) !== "[object Number]") return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function readCatalogPrice(value: JSONValue | undefined): number | undefined {
  const text = readCatalogText(value);
  if (text === undefined || !/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)) return undefined;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function readCatalogTags(value: JSONValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const text = readCatalogText(entry);
    return text ? [text] : [];
  });
}

export function isGatewayModelId(modelId: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(modelId);
}

export function isRecommendedModel(modelId: string): boolean {
  const [creator, name] = modelId.split("/");
  if (
    !creator ||
    !name ||
    /(?:^|-)(?:batch|codex|coder|code|search|realtime|experimental)(?:-|$)/.test(name)
  ) {
    return false;
  }
  return RECOMMENDED_FAMILIES.get(creator)?.test(name) ?? false;
}

export function normalizeGatewayModels(payload: JSONObject): ModelDefinition[] {
  if (!Array.isArray(payload.data)) return [];
  const models = new Map<string, ModelDefinition>();
  for (const entry of payload.data) {
    if (!isCatalogRecord(entry)) continue;
    const id = readCatalogText(entry.id);
    const name = readCatalogText(entry.name)?.trim();
    if (!id || !isGatewayModelId(id) || !name || entry.type !== "language") continue;
    if (/(?:^|-)(?:batch|realtime|embedding|rerank)(?:-|$)/i.test(id.split("/")[1] ?? "")) continue;
    const tags = readCatalogTags(entry.tags);
    const specifications = readCatalogTags(entry.supported_specifications);
    if (!tags.includes("tool-use") || !specifications.includes("v4")) continue;
    if (!isCatalogRecord(entry.modalities)) continue;
    if (
      !readCatalogTags(entry.modalities.input).includes("text") ||
      !readCatalogTags(entry.modalities.output).includes("text")
    )
      continue;
    const creator = id.split("/")[0];
    const pricing = isCatalogRecord(entry.pricing) ? entry.pricing : undefined;
    models.set(id, {
      id,
      displayName: name,
      creator,
      provider: CREATOR_NAMES.get(creator) ?? creator,
      tags,
      recommended: isRecommendedModel(id),
      contextWindow: readCatalogNumber(entry.context_window),
      maxOutputTokens: readCatalogNumber(entry.max_tokens),
      inputPrice: readCatalogPrice(pricing?.input),
      outputPrice: readCatalogPrice(pricing?.output),
      variablePricing:
        pricing?.varies_by_provider === true ||
        (Array.isArray(pricing?.input_tiers) && pricing.input_tiers.length > 0) ||
        (Array.isArray(pricing?.output_tiers) && pricing.output_tiers.length > 0),
    });
  }
  return [...models.values()].sort(
    (first, second) =>
      first.provider.localeCompare(second.provider) ||
      first.displayName.localeCompare(second.displayName),
  );
}
