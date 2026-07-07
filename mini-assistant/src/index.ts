import OpenAI from "openai";
import readline from "node:readline/promises";

// The whole trick: same SDK everyone uses for OpenAI, pointed at your laptop.
// LM Studio requires no API key, but the SDK insists the field exists.
const client = new OpenAI({
  baseURL: "http://localhost:1234/v1",
  apiKey: "not-needed",
});

const MODEL = "openai/gpt-oss-20b";

// The model is stateless: it remembers NOTHING between requests. "Memory" is
// this array — we append every turn and re-send the whole thing each time.
const messages: OpenAI.ChatCompletionMessageParam[] = [
  { role: "system", content: "You are a helpful coding assistant. Reasoning: low" },
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log("mini-assistant — chat with your local model. Ctrl+C or 'exit' to quit.\n");

while (true) {
  // question() rejects if stdin closes (Ctrl+D or end of piped input) —
  // treat that the same as typing "exit".
  let input: string;
  try {
    input = (await rl.question("you> ")).trim();
  } catch {
    break;
  }
  if (!input || input === "exit") break;

  messages.push({ role: "user", content: input });

  const stream = await client.chat.completions.create({
    model: MODEL,
    messages,
    stream: true,
  });

  let reply = "";
  process.stdout.write("\nassistant> ");
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    reply += delta;
    process.stdout.write(delta);
  }
  process.stdout.write("\n\n");

  // Without this line the model would forget its own answer next turn.
  messages.push({ role: "assistant", content: reply });
}

rl.close();
