# local-llm-lab

Learning to run LLMs locally on a MacBook Pro (M3 Pro, 18GB unified memory) —
and building a small coding assistant against one from scratch.

## What's here

- **[GUIDE.md](GUIDE.md)** — the full beginner guide: hardware math, quantization,
  MoE, the OpenAI-compatible API, editor integration, troubleshooting.
- **`mini-assistant/`** — a TypeScript CLI coding assistant built step by step
  against a local model (gpt-oss-20b served by LM Studio).

## The stack

| Piece | Choice | Why |
|---|---|---|
| Runner | [LM Studio](https://lmstudio.ai) | GUI, Apple-Silicon MLX engine, built-in OpenAI-compatible server |
| Model | gpt-oss-20b | 21B-param MoE (3.6B active) — fits in ~12GB, strong reasoning + coding |
| Editor | Continue in Antigravity | in-editor chat backed by the local model |

Built in one day. Model runs 100% offline — no API keys anywhere in this repo.
