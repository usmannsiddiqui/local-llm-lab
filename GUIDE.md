# Running a Local LLM on Apple Silicon — the full guide

Everything from a one-day build: running gpt-oss-20b on a MacBook Pro
(M3 Pro, 18GB) with LM Studio, serving it over an API, building a mini
coding assistant against it, and wiring it into an editor.

## 1. The hardware math (do this before picking any model)

Apple Silicon has **unified memory** — CPU and GPU share one pool. That's
why Macs punch above their weight for LLMs: the GPU can use (almost) all
your RAM, not a separate small VRAM chip.

The budget on an 18GB machine:

| What | Roughly |
|---|---|
| macOS + normal apps | 5–6 GB |
| Realistic model budget | 11–13 GB |
| Sweet spot | models that need ~8–12 GB loaded |

Two things consume that budget:

1. **The weights** — fixed cost, depends on parameter count × precision.
2. **The KV cache** — the model's working memory of the conversation,
   allocated up front based on **context length**. A 131k-token context
   reserves gigabytes you may never use; 4,096 tokens is nearly free.
   When a big model won't load, *lower the context length first.*

## 2. Quantization: why a "21B model" fits in 12GB

A parameter stored at full precision (16-bit) costs 2 bytes → 21B params
≈ 42GB. **Quantization** rounds weights to fewer bits: at ~4 bits/param
(MXFP4, Q4), the same model is ~12GB. Large models tolerate 4-bit
rounding remarkably well — **a big quantized model beats a small
full-precision one at the same memory cost**. That trade is the whole
game of local LLMs.

Quant names you'll see: `Q4_K_M` (standard 4-bit, the default choice),
`Q6_K`/`Q8_0` (higher fidelity, more RAM), `MXFP4` (the 4-bit format
gpt-oss ships in natively).

## 3. Why gpt-oss-20b (and what MoE means)

**gpt-oss-20b** is OpenAI's open-weight model: 21B parameters, but it's a
**Mixture of Experts (MoE)** — each token is routed through a few
"experts," so only **~3.6B parameters compute per token**. Memory cost =
all 21B (~12GB); speed ≈ a 3.6B model (~44 tok/sec on an M3 Pro, vs
~10-12 for a dense 20B). Big-model quality, small-model speed.

It's also a **reasoning model**: it generates hidden "thinking" tokens
before answering (that's why a bare "hi" can take 11 seconds). Control it
by putting `Reasoning: low` (or medium/high) in the system prompt.

**MLX vs GGUF:** same weights, different engines. MLX is Apple's
framework, ~20-30% faster on M-series; GGUF (llama.cpp) runs everywhere.
On a Mac, prefer MLX when it exists.

## 4. LM Studio setup

```bash
brew install --cask lm-studio
```

- First run: pick **Power User** mode (shows the useful knobs).
- **Discover** tab → search `gpt-oss-20b` → download the **MLX** build (~12GB).
- Load it with **context length 4096** (see §1).

### The memory-guardrail dance (18GB machines hit this)

LM Studio refuses to load a model bigger than *free* RAM. But macOS
counts evictable caches as "used," so the check is pessimistic. The
sequence that works:

1. Close the RAM eaters (browser, Electron apps). Check with
   `memory_pressure | tail -1` — you want ~60%+ free for a 12GB model.
2. Settings (⌘,) → Hardware → set guardrails to **Balanced/Relaxed**.
3. If it still refuses and you've *verified* the numbers, hold **⌥** and
   click "Load Anyway." Don't enable "always allow" — the guardrail
   catches real mistakes (it correctly stopped a 12GB load into 8GB free).

While the model is loaded you're at the machine's edge: heavy apps on
top of it mean SSD swap and sluggishness. Unload when done: `lms unload --all`.

### Reading the numbers

- **tok/sec** — generation speed. ~44 on M3 Pro for this model; reading
  speed is ~5-8, so this is comfortable.
- **Stop reason "EOS token found"** — the model finished naturally.
  "Max tokens reached" means the reply was cut off.

## 5. The API server (the bridge to everything)

```bash
lms server start        # OpenAI-compatible server on http://localhost:1234
curl http://localhost:1234/v1/models
```

See [examples/chat.sh](examples/chat.sh) for a full chat completion via
curl. The shape to internalize:

- A conversation is an array of `{role, content}` messages —
  `system` sets behavior, then `user`/`assistant` alternate.
- **The server is stateless.** Every request re-sends the whole history.
  "Memory" in every chat product is just an array something re-sends.
- `usage` reports prompt/completion tokens — on paid APIs that's the
  bill; here it's free.
- The `openai` SDK works with any compatible server: set
  `baseURL: "http://localhost:1234/v1"` and any string as the key.

## 6. The mini assistant (what each version teaches)

[mini-assistant/](mini-assistant/) — `pnpm start` to run. The git history
is the lesson plan:

| Version | Feature | The concept |
|---|---|---|
| v1 | one-shot question | the SDK + baseURL trick |
| v2 | streaming | responses are Server-Sent Events; each chunk is a delta |
| v3 | chat loop | memory = re-sending the array; the model remembers nothing |
| v4 | `/file` command | "file context" = pasting file text into a message; ~4 chars ≈ 1 token |

That's the anatomy of every AI coding tool: context assembly + the same
API call in a loop. The tools differ in *what text they choose to paste in*.

## 7. Editor integration (Continue in Antigravity)

Config lives at `~/.continue/config.yaml`:

```yaml
models:
  - name: gpt-oss-20b (local)
    provider: lmstudio
    model: openai/gpt-oss-20b
    roles: [chat, edit, apply]
```

Antigravity's marketplace may claim Continue is "not compatible" (fork
marketplaces filter over-aggressively). Bypass: download the VSIX from
Open VSX and install directly:

```bash
curl -sL -o continue.vsix \
  "https://open-vsx.org/api/Continue/continue/darwin-arm64/2.1.0/file/Continue.continue-2.1.0@darwin-arm64.vsix"
"/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide" \
  --install-extension continue.vsix
```

Usage: highlight code + **⌘L** to add it as context; `@` for context
providers (file/codebase/terminal/diff). Requires the LM Studio server
running with the model loaded.

### Why editor requests feel slower than chat

Generation is fast (~44 tok/sec) but **prompt processing (prefill) is the
Mac's weak spot** — before the first token appears, the model must chew
through the entire prompt, and editor tools send big prompts (system
instructions + your code + history). A few thousand tokens of context can
mean several seconds of silence before streaming starts. Keep selections
tight; don't `@codebase` when `@file` will do.

## 8. Troubleshooting quick reference

| Symptom | Fix |
|---|---|
| "Insufficient system resources" on load | Close apps; lower context length; guardrails → Relaxed; ⌥-Load |
| Continue/API says connection refused | `lms server start` + load the model |
| Everything sluggish while model loaded | You're swapping — `lms unload --all` or close apps |
| Replies cut off mid-sentence | Raise max tokens; check stop reason |
| Long wait before first token | Big prompt = slow prefill (see §7) — send less context |
| Chat errors after long conversation | Context window (4096) overflowed — restart chat or load with more context |

## 9. Where to go next

- **Persist chat history** — save/load the `messages` array as JSON (10 lines).
- **Raise context to 8192** when running light — more conversation room.
- **Try Qwen3-Coder-Next** — the current best local *coding* specialist; in
  LM Studio, switching models is one click.
- **Tool calling** — give the mini-assistant a function (e.g. run a shell
  command) via the API's `tools` parameter; that's the step from
  "assistant" to "agent."
