---
sidebar_position: 1
---

# Multimodal

SynapseKit v1.0.0 adds first-class support for multimodal content: images, audio, and mixed-content messages that work across providers.

## ImageContent

Create image payloads from files, URLs, or base64 data:

```python
from synapsekit import ImageContent

# From a local file
img = ImageContent.from_file("photo.jpg")

# From a URL
img = ImageContent.from_url("https://example.com/image.png")

# From base64 data
img = ImageContent.from_base64(base64_string, media_type="image/png")
```

Convert to provider-specific formats:

```python
# For OpenAI
openai_content = img.to_openai_format()
# {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}

# For Anthropic
anthropic_content = img.to_anthropic_format()
# {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": "..."}}
```

## AudioContent

Create audio payloads from files or base64 data:

```python
from synapsekit import AudioContent

# From a local file
audio = AudioContent.from_file("recording.mp3")

# From base64 data
audio = AudioContent.from_base64(base64_string, media_type="audio/mp3")
```

## MultimodalMessage

Compose messages with mixed content types and convert to provider formats:

```python
from synapsekit import MultimodalMessage, ImageContent

msg = MultimodalMessage(
    role="user",
    content=[
        "What do you see in this image?",
        ImageContent.from_file("photo.jpg"),
    ],
)

# Convert to OpenAI format
openai_messages = msg.to_openai_messages()
# [{"role": "user", "content": [{"type": "text", "text": "What do you see..."}, {"type": "image_url", ...}]}]

# Convert to Anthropic format
anthropic_messages = msg.to_anthropic_messages()
# [{"role": "user", "content": [{"type": "text", "text": "What do you see..."}, {"type": "image", ...}]}]
```

### Multiple images

```python
msg = MultimodalMessage(
    role="user",
    content=[
        "Compare these two images:",
        ImageContent.from_file("before.jpg"),
        ImageContent.from_file("after.jpg"),
    ],
)
```

### Mixed content types

```python
msg = MultimodalMessage(
    role="user",
    content=[
        "Describe this image and transcribe the audio:",
        ImageContent.from_url("https://example.com/chart.png"),
        AudioContent.from_file("narration.mp3"),
    ],
)
```

## ImageLoader

Load images with optional AI-powered descriptions using a vision LLM:

```python
from synapsekit import ImageLoader

loader = ImageLoader()

# Basic load (returns ImageContent)
image = loader.load("photo.jpg")

# Async load
image = await loader.async_load("photo.jpg")

# With vision LLM description
loader = ImageLoader(llm=vision_llm)
image = loader.load("chart.png")
print(image.description)  # "A bar chart showing Q4 revenue by region..."
```

## API Markers

v1.0.0 also introduces API stability markers:

```python
from synapsekit import public_api, experimental, deprecated

@public_api
class RAGPipeline:
    """Stable public API — will not break in minor versions."""
    ...

@experimental
class A2AServer:
    """Experimental — API may change in minor versions."""
    ...

@deprecated(reason="Use MultimodalMessage instead", alternative="MultimodalMessage")
class LegacyImageMessage:
    """Deprecated — will be removed in a future version."""
    ...
```

- `@public_api` — stable, follows semver
- `@experimental` — may change without notice
- `@deprecated(reason, alternative)` — scheduled for removal, with migration guidance
