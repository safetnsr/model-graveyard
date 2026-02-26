# model-graveyard

your AI model is being deprecated next month. do you know?

scan your codebase for hardcoded AI model strings. get warned before they break in production.

```
$ graveyard scan ./src

model-graveyard scan
path:    /home/user/myproject/src
scanned: 2/26/2026, 9:14:00 AM
files:   47

src/api/chat.ts
  12:18  ⚠ deprecated  "gpt-4"  eol: 2025-01-10  → gpt-4o
         const response = await openai.chat.completions.create({ model: "gpt-4",

config/llm.yaml
  3:8   ⚠ deprecated  "claude-3-opus-20240229"  eol: 2025-07-31  → claude-opus-4-6
         model: claude-3-opus-20240229

.env
  5:7   ⚠ deprecated  "claude-instant-1"  eol: 2024-11-01  → claude-haiku-3.5
         MODEL=claude-instant-1

total: 3  3 deprecated

run graveyard migrate ./src to replace deprecated models
```

---

## install

```bash
npm install -g @safetnsr/model-graveyard
```

or run without installing:

```bash
npx @safetnsr/model-graveyard scan .
```

## usage

**scan** — find all model strings in a codebase:

```bash
graveyard scan [path]          # human-readable output
graveyard scan [path] --json   # JSON report
graveyard scan [path] --json --output report.json
```

exits with code 1 if deprecated or eol models are found (useful in CI).

**migrate** — replace deprecated models with their successors:

```bash
graveyard migrate [path]          # dry-run (shows diff)
graveyard migrate [path] --apply  # write changes to disk
```

**list** — show all models in the registry:

```bash
graveyard list
```

## what it scans

- `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.jsx`
- `**/*.py`, `**/*.go`
- `**/*.yaml`, `**/*.yml`, `**/*.json`, `**/*.toml`
- `.env` files

catches:

```python
# string literals
model = "claude-3-opus-20240229"
client.create(model='gpt-4')

# config files
model: gpt-3.5-turbo

# env files
MODEL=claude-instant-1
```

## ci integration

```yaml
# .github/workflows/model-check.yml
- name: check for deprecated models
  run: npx @safetnsr/model-graveyard scan . --json --output graveyard.json
  # exits 1 if deprecated models found
```

## registry format

models live in `registry.yaml`, bundled with the package. community-maintainable.

```yaml
models:
  - id: claude-opus-3
    provider: anthropic
    aliases:
      - claude-3-opus-20240229
    status: deprecated       # active | deprecated | eol
    eol: "2025-07-31"
    successor: claude-opus-4-6
    notes: "Anthropic deprecated Feb 2026"

  - id: gpt-4o
    provider: openai
    status: active
```

to add or update a model: open a PR against `registry.yaml`. registry PRs merge fast.

## supported models

### anthropic
| model | status | eol |
|-------|--------|-----|
| claude-opus-4-6 | ✅ active | — |
| claude-sonnet-4-6 | ✅ active | — |
| claude-sonnet-4-5 | ✅ active | — |
| claude-haiku-4-5 | ✅ active | — |
| claude-haiku-3.5 | ✅ active | — |
| claude-opus-3 | ⚠ deprecated | 2025-07-31 |
| claude-2 | ⚠ deprecated | 2024-11-01 |
| claude-instant | ⚠ deprecated | 2024-11-01 |

### openai
| model | status | eol |
|-------|--------|-----|
| gpt-4o | ✅ active | — |
| gpt-4o-mini | ✅ active | — |
| gpt-4.1 | ✅ active | — |
| gpt-4.1-mini | ✅ active | — |
| o3 | ✅ active | — |
| o4-mini | ✅ active | — |
| gpt-5 | ✅ active | — |
| gpt-4 | ⚠ deprecated | 2025-01-10 |
| gpt-4-turbo | ⚠ deprecated | 2025-04-01 |
| gpt-3.5-turbo | ⚠ deprecated | 2025-09-01 |

### google
| model | status | eol |
|-------|--------|-----|
| gemini-2.5-pro | ✅ active | — |
| gemini-2.5-flash | ✅ active | — |
| gemini-2.0-flash | ✅ active | — |
| gemini-1.5-pro | ⚠ deprecated | 2025-09-24 |
| gemini-1.5-flash | ⚠ deprecated | 2025-09-24 |

---

## development

```bash
git clone https://github.com/safetnsr/model-graveyard
cd model-graveyard
npm install
npm run build
npm test
```

## license

MIT
