---
sidebar_position: 12
---

# Plugins

SynapseKit supports a plugin system using Python's `importlib.metadata` entry points. Third-party packages can register plugins that are automatically discoverable.

## PluginRegistry

```python
from synapsekit import PluginRegistry

registry = PluginRegistry()

# Discover all installed plugins
names = registry.discover()
print(names)  # ["my-plugin", "another-plugin"]

# Load a specific plugin
result = registry.load("my-plugin")

# Load all discovered plugins
all_plugins = registry.load_all()
```

### Methods

| Method | Returns | Description |
|---|---|---|
| `discover()` | `list[str]` | Find all installed plugins, return names |
| `load(name)` | `Any` | Load a plugin by name, call its register function |
| `load_all()` | `dict[str, Any]` | Load all discovered plugins |

### Properties

| Property | Type | Description |
|---|---|---|
| `loaded` | `dict[str, Any]` | Currently loaded plugins |

## Creating a plugin

To create a SynapseKit plugin, register an entry point in your package's `pyproject.toml`:

```toml
[project.entry-points."synapsekit.plugins"]
my_plugin = "my_package.plugin:register"
```

The entry point should point to a callable that will be invoked when the plugin is loaded:

```python
# my_package/plugin.py

def register():
    """Called when the plugin is loaded by SynapseKit."""
    from synapsekit import ToolRegistry

    # Register custom tools, providers, etc.
    return {"name": "my-plugin", "version": "1.0.0"}
```

The return value of the register function is cached and returned by `PluginRegistry.load()`.

## Entry point group

All plugins must use the entry point group `synapsekit.plugins`. SynapseKit uses the Python 3.10+ `importlib.metadata.entry_points()` API with `select()` for efficient filtering.
