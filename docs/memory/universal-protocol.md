---
sidebar_position: 40
---

# Universal Memory Protocol (UMP)

A provider-agnostic document standard for agent memory and project rules. UMP files are plain Markdown with a YAML frontmatter header (`ump_version`, `name`, `type`, `scope`, `visibility`, `provenance`, `links`) and a free-form body. `[[wikilink]]`s written in the body are automatically discovered and merged into the document's `links`, so memory becomes a linkable graph rather than isolated files. The reference implementation ships an async reader/writer, a spec validator, and adapters that lift existing tool-specific memory files — `CLAUDE.md`, Cursor rules, Aider config, Continue config — into the shared format.

**Import:**
```python
from synapsekit.ump import (
    UMPDocument,
    UMPFrontmatter,
    UMPProvenance,
    UMPReader,
    UMPWriter,
    UMPValidator,
    ValidationError,
    ValidationResult,
    BaseUMPAdapter,
    ClaudeAdapter,
    CursorAdapter,
    AiderAdapter,
    ContinueAdapter,
    auto_detect_and_convert,
)
```

No extra install is required — UMP is part of the core package (it uses `PyYAML`, already a core dependency).

---

## Quickstart

Read a UMP document from disk, inspect the wikilinks that were extracted from its body, then write it back out. File IO is async; the pure string transforms are synchronous.

```python
import asyncio
from synapsekit.ump import UMPReader, UMPWriter, UMPValidator

MEMORY = """---
ump_version: "1.0"
name: testing-standards
type: feedback
scope: project
visibility: shared
provenance:
  authors: ["human", "agent:claude"]
---

Always write pytest tests. See [[user-preferences]] and [[async-rules]].
"""

async def main():
    # Parse from a raw string (sync) ...
    doc = UMPReader.parse(MEMORY)

    # ... wikilinks in the body are auto-discovered and merged into links:
    print(doc.frontmatter.links)   # ['[[user-preferences]]', '[[async-rules]]']
    print(doc.frontmatter.type)    # 'feedback'

    # Validate against the UMP spec.
    result = UMPValidator.validate(doc)
    print(result.is_valid)         # True

    # Serialize back to a string (sync) ...
    print(UMPWriter.serialize(doc))

    # ... or persist to disk (async; creates parent dirs).
    await UMPWriter.write_file(doc, "memory/testing-standards.ump.md")

    # And read it back (async).
    loaded = await UMPReader.read_file("memory/testing-standards.ump.md")
    print(loaded.frontmatter.name)  # 'testing-standards'

asyncio.run(main())
```

---

## The document model

A `UMPDocument` is a dataclass with three parts:

| Field | Type | Description |
|---|---|---|
| `frontmatter` | `UMPFrontmatter` | Structured YAML header |
| `body` | `str` | Free-form Markdown content |
| `source_path` | `str` | Absolute path the document was read from (empty for in-memory docs) |

`UMPDocument` supports `to_dict()`, `from_dict(data)`, and `to_json()` for interchange.

### `UMPFrontmatter`

| Field | Type | Default | Notes |
|---|---|---|---|
| `ump_version` | `str` | `"1.0"` | Spec version |
| `name` | `str` | `""` | Human-readable document name |
| `type` | `UMPType` | `"general"` | `user` / `feedback` / `project` / `reference` / `general` |
| `scope` | `UMPScope` | `"project"` | `global` / `project` / `session` |
| `visibility` | `UMPVisibility` | `"local"` | `local` / `shared` / `team` |
| `provenance` | `UMPProvenance` | empty | Authors, evidence, signature |
| `links` | `list[str]` | `[]` | Wikilinks (e.g. `"[[other-doc]]"`) |

### `UMPProvenance`

| Field | Type | Default |
|---|---|---|
| `authors` | `list[str]` | `[]` |
| `evidence` | `list[str]` | `[]` |
| `signed_by` | `str` | `""` |

Empty provenance fields are omitted when serializing, keeping the YAML concise.

---

## Reading and writing

`UMPReader` and `UMPWriter` expose both sync string transforms and async file IO. The split is intentional and enforced by a test tripwire: string methods stay synchronous, file methods stay coroutines so they never block the event loop.

### `UMPReader`

| Method | Sync/Async | Description |
|---|---|---|
| `UMPReader.parse(content, *, source_path="")` | sync | Parse a raw string into a `UMPDocument` |
| `await UMPReader.read_file(path)` | async | Read + parse a file (`str \| Path`); sets `source_path` to the resolved path |

`parse` splits the YAML frontmatter from the body, then scans the body for `[[wikilink]]` patterns. Discovered links are de-duplicated and merged into `frontmatter.links` (existing frontmatter links are preserved; new ones are appended). Malformed or missing frontmatter is tolerated — the parser falls back to defaults and the body always survives.

### `UMPWriter`

| Method | Sync/Async | Description |
|---|---|---|
| `UMPWriter.serialize(doc)` | sync | Render a `UMPDocument` to a UMP-formatted string |
| `await UMPWriter.write_file(doc, path)` | async | Serialize and write to disk, creating parent directories |

Frontmatter is rendered with `sort_keys=False` (field order preserved) and `allow_unicode=True`.

---

## Validation

`UMPValidator` checks a document against the spec and returns a `ValidationResult` — it never raises during validation of a parsed document.

```python
from synapsekit.ump import UMPValidator

result = await UMPValidator.validate_file("memory/testing-standards.ump.md")
if not result.is_valid:
    for err in result.errors:
        print(err.field, err.message)   # e.g. type "Invalid type 'foo'. Must be one of [...]"
for warn in result.warnings:
    print("warning:", warn.field, warn.message)
```

| Method | Sync/Async | Description |
|---|---|---|
| `UMPValidator.validate(doc)` | sync | Validate an in-memory `UMPDocument` |
| `await UMPValidator.validate_file(path)` | async | Read + validate a file; a read/parse failure yields an `is_valid=False` result with a `field="file"` error |

A `ValidationResult` carries `is_valid: bool`, `errors: list[ValidationError]`, and `warnings: list[ValidationError]`. Each `ValidationError` has `field`, `message`, and `severity` (`"error"` or `"warning"`).

**Errors** (make the document invalid): an unrecognized `type`, `scope`, or `visibility`. **Warnings** (advisory only): a version other than `1.0`, an empty `name`, an empty `body`, or provenance with no authors.

---

## Adapters — import existing tool memory

Adapters lift a tool's native memory/rules file into a `UMPDocument` so heterogeneous configs share one format. All adapters subclass `BaseUMPAdapter` and expose the same interface.

| Adapter | `tool_name` | `default_filename` | Body handling |
|---|---|---|---|
| `ClaudeAdapter` | `claude-code` | `CLAUDE.md` | Raw Markdown |
| `CursorAdapter` | `cursor` | `.cursorrules` | Raw text; `detect()` also matches `.cursor/rules` |
| `AiderAdapter` | `aider` | `.aider.conf.yml` | YAML parsed to pretty JSON (falls back to raw on parse error) |
| `ContinueAdapter` | `continue` | `.continue/config.json` | JSON pretty-printed (falls back to raw on parse error) |

Each adapter provides:

- `Adapter.detect(base_dir) -> bool` (sync) — whether the source file exists under a directory.
- `await Adapter.to_ump(path) -> UMPDocument` (async) — read the source file and wrap it, stamping a sensible `name` (e.g. `"claude-memory"`, `"cursor-rules"`) and `provenance.authors` (e.g. `["agent:claude-code"]`). A missing file yields an empty body rather than an error.
- `Adapter.from_ump(doc) -> str` (sync) — the document body, for round-tripping back out.

### Auto-detect a whole directory

```python
from synapsekit.ump import auto_detect_and_convert

# Scans for CLAUDE.md, .cursorrules/.cursor/rules, .aider.conf.yml,
# .continue/config.json and converts each one it finds.
docs = await auto_detect_and_convert("/path/to/project")
for doc in docs:
    print(doc.frontmatter.name, "<-", doc.source_path)
```

`auto_detect_and_convert(directory)` (async) returns a `list[UMPDocument]`, one per detected tool file — a one-call way to normalize a project's scattered agent-memory files into UMP.

---

## API reference

### `UMPReader`
- `parse(content: str, *, source_path: str = "") -> UMPDocument` — sync
- `async read_file(path: str | Path) -> UMPDocument`

### `UMPWriter`
- `serialize(doc: UMPDocument) -> str` — sync
- `async write_file(doc: UMPDocument, path: str | Path) -> None`

### `UMPValidator`
- `validate(doc: UMPDocument) -> ValidationResult` — sync
- `async validate_file(path: str | Path) -> ValidationResult`
- Class constants: `UMP_VERSION = "1.0"`, `VALID_TYPES`, `VALID_SCOPES`, `VALID_VISIBILITIES`

### Adapters (`BaseUMPAdapter` subclasses)
`ClaudeAdapter`, `CursorAdapter`, `AiderAdapter`, `ContinueAdapter`:
- `detect(base_dir: str | Path) -> bool` — sync
- `async to_ump(path: str | Path) -> UMPDocument`
- `from_ump(doc: UMPDocument) -> str` — sync
- `async auto_detect_and_convert(directory: str | Path) -> list[UMPDocument]`

### Data types
- `UMPDocument(frontmatter, body, source_path)` — `to_dict()`, `from_dict()`, `to_json()`
- `UMPFrontmatter(ump_version, name, type, scope, visibility, provenance, links)`
- `UMPProvenance(authors, evidence, signed_by)`
- `ValidationResult(is_valid, errors, warnings)`
- `ValidationError(field, message, severity)`
- Type aliases: `UMPType`, `UMPScope`, `UMPVisibility`

---

## See also

- [Memory overview](/docs/memory/)
- [Living memory](/docs/memory/living-memory)
