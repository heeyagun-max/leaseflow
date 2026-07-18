# Codex Credits and Runtime GPT-5.6

The event promotional credit is for Codex development usage. It is separate from OpenAI API billing.

For the hackathon:

- use the redeemed Codex credit to build, test, refactor, and document the repository;
- separately configure an OpenAI API project, API key, billing/credit balance, and model access for the deployed runtime;
- set the exact GPT-5.6 API model identifier available in the project through `OPENAI_MODEL`;
- verify three real runtime calls before recording the video: source extraction, request extraction, and report patch;
- keep a deterministic demo fallback for local development, but do not use mock AI for the final judged demo.

Never expose `OPENAI_API_KEY` in the browser or mobile bundle.
