---
sidebar_position: 6
---

# MCP (Model Context Protocol)

SynapseKit supports the [Model Context Protocol](https://modelcontextprotocol.io/) for connecting to external tool servers, wrapping MCP tools for use with agents, and exposing your own tools as an MCP server.

## MCPClient

Connect to an MCP server. `connect_stdio()` and `connect_sse()` return a list of ready-to-use `BaseTool` adapters. `MCPClient` does not expose public `list_tools()` or `call_tool()` methods; pass the returned tools to an agent, as in the example below.

### Stdio transport

```python
from synapsekit import MCPClient

client = MCPClient()
tools = await client.connect_stdio(
    "npx", ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
)
for tool in tools:
    print(tool.name, tool.description)

await client.close()
```

### SSE transport

```python
client = MCPClient()
tools = await client.connect_sse("http://localhost:8080/sse")
for tool in tools:
    print(tool.name, tool.description)

await client.close()
```

## MCPToolAdapter

`connect_stdio()` and `connect_sse()` create `MCPToolAdapter` instances for every server tool and return them as `BaseTool` values. Use those returned adapters directly; there is no `MCPToolAdapter.from_client()` factory.

```python
from synapsekit import FunctionCallingAgent, MCPClient, MCPToolAdapter

async with MCPClient() as client:
    tools = await client.connect_stdio(
        "npx", ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    )
    assert all(isinstance(tool, MCPToolAdapter) for tool in tools)

    agent = FunctionCallingAgent(llm=llm, tools=tools)
    result = await agent.run("List files in /tmp")
    print(result)
```

Each wrapped tool preserves the server-provided name, description, and parameter schema. The adapter handles serialization and deserialization automatically. Keep the client connected while the agent uses its tools; leaving the `async with` block closes the session.

## Tool-description scanning and pinning

MCP tool descriptions come from an external server. `MCPClient` can apply a local heuristic scanner before registering tools:

```python
from synapsekit.mcp import MCPClient, ToolScanBlockedError

client = MCPClient(block_on_high_severity=True)  # opt-in; default is False
try:
    tools = await client.connect_stdio("example-mcp-server")
except ToolScanBlockedError as exc:
    for finding in exc.report.findings:
        print(finding.tool_name, finding.severity, finding.rule)
```

The scanner reports patterns associated with instruction overrides, role spoofing, concealment, secret transfer, remote script execution, and hidden characters. High-severity findings block the whole registration; medium findings are reported but do not block. When enabled, the scanner also checks the exact definitions again during approval and blocks registration before writing pins. A blocked initial connection is closed. `ToolApprovalRequiredError` and `ToolDriftDetectedError` retain the connection for review; inspect the pending definitions and `client.last_scan_report` before calling `approve_current_tools()`.

For persistent definition pins, configure both `server_id` and `pin_store_path`; pins detect changes but do not determine whether a definition is malicious. The scan covers effective descriptions and input-schema string keys and values, including nested descriptions. It limits tools, text size, schema nodes and depth. Limit violations fail closed. Pattern matching runs off the event loop, but limits do not bound the MCP transport response before decoding.

This is heuristic analysis of tool text—not a full manifest, server-code, or runtime audit. A clean scan or matching pin does not prove safety, and server behavior can change without its definition changing. Review the server, restrict its permissions and network access, isolate credentials, and monitor calls. See [scanner behavior and limitations](./mcp-tool-scanning) for rule details.

## MCPServer

Expose your SynapseKit tools as an MCP-compatible server so external clients can discover and call them:

```python
from synapsekit import MCPServer, CalculatorTool, WebSearchTool

server = MCPServer(
    name="my-tools",
    tools=[CalculatorTool(), WebSearchTool()],
)

# Run as stdio server (for CLI-based MCP clients)
await server.run_stdio()
```

Any `BaseTool` subclass or `@tool`-decorated function can be exposed via MCP. The server automatically generates the MCP-compatible tool schema from your tool's `parameters` definition.

### Using with Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "synapsekit-tools": {
      "command": "python",
      "args": ["my_server.py"]
    }
  }
}
```

Where `my_server.py` contains:

```python
import asyncio
from synapsekit import MCPServer, CalculatorTool, WebSearchTool

server = MCPServer(name="synapsekit-tools", tools=[CalculatorTool(), WebSearchTool()])
asyncio.run(server.run_stdio())
```
