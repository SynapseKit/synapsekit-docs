---
sidebar_position: 6
---

# MCP (Model Context Protocol)

SynapseKit supports the [Model Context Protocol](https://modelcontextprotocol.io/) for connecting to external tool servers, wrapping MCP tools for use with agents, and exposing your own tools as an MCP server.

## MCPClient

Connect to an MCP server to discover and call remote tools.

### Stdio transport

```python
from synapsekit import MCPClient

client = MCPClient()
await client.connect_stdio("npx", ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"])

# List available tools
tools = await client.list_tools()
for t in tools:
    print(t.name, t.description)

# Call a tool
result = await client.call_tool("read_file", {"path": "/tmp/hello.txt"})
print(result)
```

### SSE transport

```python
client = MCPClient()
await client.connect_sse("http://localhost:8080/sse")

tools = await client.list_tools()
result = await client.call_tool("search", {"query": "hello"})
```

## MCPToolAdapter

Wrap MCP tools as `BaseTool` instances so they work with any SynapseKit agent:

```python
from synapsekit import MCPClient, MCPToolAdapter, FunctionCallingAgent

client = MCPClient()
await client.connect_stdio("npx", ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"])

# Wrap all MCP tools as BaseTool instances
tools = await MCPToolAdapter.from_client(client)

# Use with any agent
agent = FunctionCallingAgent(llm=llm, tools=tools)
result = await agent.run("List files in /tmp")
```

Each wrapped tool preserves the original name, description, and parameter schema from the MCP server. The adapter handles serialization and deserialization automatically.

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
