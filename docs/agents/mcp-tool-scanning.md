---
sidebar_position: 7
title: "MCP tool scanning — SynapseKit Agents"
---

# MCP tool-definition scanning

MCP servers supply tool names, descriptions and schemas at runtime. The `MCPClient` scanner applies deterministic local heuristics to effective descriptions and every input-schema string key and value, including nested property descriptions and defaults. It runs without a model call and is **off by default**. Each string is scanned separately, so patterns split across fields may be missed.

## Enable the registration gate

```python
from synapsekit.mcp import MCPClient, ToolScanBlockedError
from synapsekit.mcp.pinning import ToolApprovalRequiredError, ToolDriftDetectedError

client = MCPClient(
    block_on_high_severity=True,
    server_id="catalog-prod",
    pin_store_path="tool-pins.json",
)
try:
    tools = await client.connect_stdio("example-mcp-server")
except ToolScanBlockedError as exc:
    for finding in exc.report.findings:
        print(finding.tool_name, finding.severity, finding.rule)
except (ToolApprovalRequiredError, ToolDriftDetectedError) as exc:
    # Review the current definitions and findings before explicitly approving.
    print(client.last_scan_report)
    # After human review: tools = await client.approve_current_tools()
```

`server_id` and `pin_store_path` are required together when pinning is enabled. The scanner gate works with or without pinning. High-severity findings block registration and do not overwrite saved pins. Medium findings are reported but do not block. The gate scans the definitions it will register and re-scans the newly fetched definitions on approval. A scan rejection during initial connection closes the session/transport; an approval or drift exception retains it so the caller can inspect and resolve the review flow. Use `await client.close()` when finished.

## Standalone reports

```python
from synapsekit.mcp import scan_tools
from synapsekit.mcp.pinning import make_tool_definition

snapshot = make_tool_definition(
    "lookup",
    "Search public records",
    {"type": "object", "properties": {}},
)
report = await scan_tools([snapshot])
for finding in report.findings:
    print(finding.tool_name, finding.fingerprint, finding.severity, finding.rule)
```

Findings include tool name, original definition fingerprint, severity, rule ID and a short explanation; description text is not copied into the report. If a description is missing or empty, the scanner checks the adapter's effective fallback text (`MCP tool: {name}`). Tool names come from the server; escape them before logging or terminal output.

Rules flag patterns associated with instruction overrides, concealment, system/developer role spoofing, possible secret exfiltration, remote shell-script execution, and invisible/bidirectional characters. These are narrow heuristics, not a comprehensive scanner. A clean report does not prove the server or tool is safe.

## Resource limits and security boundaries

```python
from synapsekit.mcp import ToolScanLimitError, scan_tools

try:
    await scan_tools(oversized_or_untrusted_tool_set)
except ToolScanLimitError:
    # Reject input as a whole; scan_tools never returns a partial report.
    raise
```

The gate accepts at most 256 tools, 16,384 Unicode characters per description or individual schema string, and 262,144 combined description and schema characters. It also limits schema traversal to 16,384 nodes and depth 64, bounds tool names separately, and rejects invalid JSON-like values. Exceeding a limit raises `ToolScanLimitError` and fails closed; no partial report is returned. Normalization and pattern matching run in a worker thread, while pre-snapshot validation runs on the event loop. Limits do not bound the transport response before the MCP SDK decodes it.

The scanner examines effective descriptions and input-schema strings, not manifests, server code, tool outputs, transport behavior, or names when a nonempty description is present. It may miss encoded, paraphrased, or cross-field attacks. A server can change behavior without changing its definition or fingerprint. Pinning detects definition changes; it does not prove safety or enforce server-side behavior. Review the server, restrict its permissions and network access, isolate credentials, and monitor tool calls. Calls already in flight are not cancelled when a generation is revoked.
