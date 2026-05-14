import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (cached) return cached;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY");
  cached = new Anthropic({ apiKey: key });
  return cached;
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 800
): Promise<string> {
  const client = anthropic();
  const resp = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const text = resp.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("\n")
    .trim();
  return text;
}
