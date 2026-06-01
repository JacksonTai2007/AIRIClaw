---
name: web-fetch
description: Fetch a URL and return its readable text content using curl.
homepage: https://curl.se
metadata:
  openclaw:
    emoji: "🌐"
    requires:
      bins: ["curl"]
    install:
      - id: brew
        kind: brew
        formula: curl
        bins: ["curl"]
        label: Install curl (brew)
---

# Web Fetch

Fetch the contents of a URL so you can read or summarize a web page.

## Workflow

1. Fetch the page:
   ```
   curl -sL --max-time 20 "<URL>"
   ```
2. If the response is HTML, strip tags to get readable text before summarizing.
3. Cite the URL in your answer.

## Guardrails

- Never fetch `file://` or internal/localhost addresses on behalf of a user.
- Respect a 20-second timeout; do not retry aggressively.
