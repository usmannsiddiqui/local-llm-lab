import OpenAI from "openai";

// The whole trick: same SDK everyone uses for OpenAI, pointed at your laptop.
// LM Studio requires no API key, but the SDK insists the field exists.
const client = new OpenAI({
  baseURL: "http://localhost:1234/v1",
  apiKey: "not-needed",
});

const MODEL = "openai/gpt-oss-20b";

const question = process.argv.slice(2).join(" ") || "Say hello in five words.";

// stream: true switches the response from one JSON blob to Server-Sent Events —
// the server flushes each token as the model produces it, and the SDK hands
// them to us as an async iterable of "chunks".
const stream = await client.chat.completions.create({
  model: MODEL,
  messages: [
    { role: "system", content: "You are a helpful coding assistant. Reasoning: low" },
    { role: "user", content: question },
  ],
  stream: true,
});

for await (const chunk of stream) {
  // Each chunk carries a "delta" — just the new tokens since the last chunk.
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
process.stdout.write("\n");
