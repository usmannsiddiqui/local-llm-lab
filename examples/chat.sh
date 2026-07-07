#!/usr/bin/env bash
# Minimal chat completion against LM Studio's local server.
# Prereq: model loaded and server running (`lms server start`).
# Usage: ./examples/chat.sh "your question here"

QUESTION="${1:-In one sentence: what is a KV cache?}"

curl -s http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "$(python3 -c '
import json, sys
print(json.dumps({
    "model": "openai/gpt-oss-20b",
    "messages": [
        {"role": "system", "content": "You are a concise assistant. Reasoning: low"},
        {"role": "user", "content": sys.argv[1]},
    ],
    "temperature": 0.7,
    "max_tokens": 400,
}))' "$QUESTION")" | python3 -c 'import json,sys; print(json.load(sys.stdin)["choices"][0]["message"]["content"])'
