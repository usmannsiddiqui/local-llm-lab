import OpenAI from "openai";
import readline from "node:readline/promises";
import { readFile } from "node:fs/promises";

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
console.log("mini-assistant — chat with your local model.");
console.log("Commands: /file <path> to add a file to the conversation, 'exit' to quit.\n");

// "File context" is no magic: the file's text just becomes another message in
// the array. That's the core of every AI coding tool — the model never touches
// your disk; the tool decides what text to paste into the conversation.
async function addFileContext(path: string): Promise<void> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (err) {
    console.log(`could not read ${path}: ${(err as Error).message}\n`);
    return;
  }
  messages.push({
    role: "user",
    content: `Here is the file \`${path}\` for reference:\n\n\`\`\`\n${content}\n\`\`\``,
  });
  // Rough rule of thumb: ~4 characters per token. Worth knowing because the
  // file spends context-window budget on EVERY turn from now on.
  console.log(`added ${path} (~${Math.round(content.length / 4)} tokens of context)\n`);
}

// With piped input, buffered lines keep processing after stdin has closed —
// prompting a closed interface throws, so only prompt while it's open.
let stdinOpen = true;
rl.on("close", () => {
  stdinOpen = false;
});
const prompt = () => {
  if (stdinOpen) rl.prompt();
};

rl.setPrompt("you> ");
prompt();

// Iterating readline (instead of calling rl.question in a loop) buffers lines
// that arrive while we're busy awaiting the model, rather than dropping them.
// The loop ends naturally on Ctrl+D or end of piped input.
for await (const line of rl) {
  const input = line.trim();
  if (input === "exit") break;
  if (!input) {
    prompt();
    continue;
  }

  if (input.startsWith("/file ")) {
    await addFileContext(input.slice("/file ".length).trim());
    prompt();
    continue;
  }

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
  prompt();
}

rl.close();
