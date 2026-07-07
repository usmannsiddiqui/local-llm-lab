import OpenAI from "openai";

// The whole trick: same SDK everyone uses for OpenAI, pointed at your laptop.
// LM Studio requires no API key, but the SDK insists the field exists.
const client = new OpenAI({
  baseURL: "http://localhost:1234/v1",
  apiKey: "not-needed",
});

const MODEL = "openai/gpt-oss-20b";

const question = process.argv.slice(2).join(" ") || "Say hello in five words.";

const response = await client.chat.completions.create({
  model: MODEL,
  messages: [
    { role: "system", content: "You are a helpful coding assistant. Reasoning: low" },
    { role: "user", content: question },
  ],
});

console.log(response.choices[0].message.content);
