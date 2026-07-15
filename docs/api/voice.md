---
sidebar_position: 13
title: "Voice Pipeline API Reference"
description: "Real-time voice agents in Python: VAD, streaming STT, LLM, and streaming TTS composed into a single VoicePipeline with interruption handling."
keywords: [python voice agent, real-time speech to text python, streaming tts python, voice activity detection python, synapsekit voice]
---

# Voice Pipeline API Reference

`VoicePipeline` composes a VAD, STT, LLM, and TTS provider into a single real-time conversation loop:

```
microphone → VAD → STT → LLM → TTS → speaker
```

Key behaviours:
- **VAD gating** — silence is never forwarded to STT; a session opens only when the VAD detects speech onset, keeping cloud STT costs low.
- **Sentence-level TTS streaming** — LLM output is parsed at sentence boundaries so the first sentence plays before the full response finishes generating (sub-500ms perceived latency).
- **Interruption handling** — if the user speaks for longer than `interrupt_threshold_ms` while the assistant is talking, TTS is cancelled immediately, audio buffers are flushed, and a fresh STT session opens for the new utterance.
- **Optional persistent memory** — pass an `AgentMemory` instance to recall relevant past exchanges before each turn and store new ones as episodic memories.

**Import (lazy-loaded):**
```python
from synapsekit import VoicePipeline, BaseSTT, BaseTTS, BaseVAD
```

All voice symbols are lazily imported (since v1.9.1) — `sounddevice` and other audio dependencies are only loaded when a voice symbol is first accessed, so `import synapsekit` stays fast for non-voice users.

**Install:**
```bash
pip install 'synapsekit[voice]'          # OpenAI STT/TTS + sounddevice playback
pip install 'synapsekit[voice-local]'    # faster-whisper + pyttsx3, fully offline
pip install 'synapsekit[voice-stream]'   # sounddevice only, for run_microphone()/playback
pip install 'synapsekit[voice-deepgram]' # Deepgram streaming STT
pip install 'synapsekit[voice-elevenlabs]' # ElevenLabs streaming TTS
pip install 'synapsekit[voice-cartesia]' # Cartesia streaming TTS
pip install 'synapsekit[voice-piper]'    # Piper local TTS
```

---

## `VoicePipeline`

```python
from synapsekit import VoicePipeline

pipeline = VoicePipeline(
    llm: BaseLLM,
    stt: BaseSTT,
    tts: BaseTTS,
    vad: BaseVAD,
    allow_interruption: bool = True,
    interrupt_threshold_ms: int = 300,
    memory: AgentMemory | None = None,
    agent_id: str = "voice_agent",
    memory_top_k: int = 3,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | Any provider that supports `stream_with_messages` |
| `stt` | `BaseSTT` | required | Speech-to-text provider |
| `tts` | `BaseTTS` | required | Text-to-speech provider |
| `vad` | `BaseVAD` | required | Voice activity detector |
| `allow_interruption` | `bool` | `True` | Enable mid-speech interruption detection |
| `interrupt_threshold_ms` | `int` | `300` | Continuous speech duration required to trigger an interruption; the 300ms debounce avoids false triggers from clicks/keyboard noise |
| `memory` | `AgentMemory \| None` | `None` | Optional persistent memory for cross-session recall |
| `agent_id` | `str` | `"voice_agent"` | Namespaces memories when sharing a memory backend across sessions |
| `memory_top_k` | `int` | `3` | Memory records retrieved per turn |

### Methods

- `set_system_prompt(prompt: str) -> None` — set or replace the system message
- `reset_history() -> None` — clear conversation history, keeping the system prompt
- `async run(audio_source: AsyncIterator[bytes], *, sample_rate=16000, chunk_duration_ms=30, silence_duration_ms=1500, tts_sample_rate=24000, system_prompt=None, on_event=None) -> None` — run the pipeline over an async iterator of raw 16-bit mono PCM frames until the source is exhausted
- `async run_microphone(*, sample_rate=16000, chunk_duration_ms=30, silence_duration_ms=1500, tts_sample_rate=24000, system_prompt=None, on_event=None) -> None` — convenience wrapper that opens the system microphone via `sounddevice` and calls `run()`. Requires `synapsekit[voice-stream]`

`tts_sample_rate` defaults to 24000 (OpenAI TTS PCM output) — set to 22050 for `PiperTTS` or match your `CartesiaTTS`/`ElevenLabsTTS` output format.

### `on_event` and `PipelineEvent`

```python
@dataclass
class PipelineEvent:
    kind: str   # "state_change" | "transcript" | "response_token" | "audio_chunk" | "error"
    data: Any
```

`state_change` events carry a `PipelineState`: `IDLE`, `LISTENING`, `TRANSCRIBING`, `GENERATING`, `SPEAKING`, `INTERRUPTED`.

---

## Base classes

```python
from synapsekit import BaseVAD, BaseSTT, BaseTTS
```

| Class | Required method | Notes |
|---|---|---|
| `BaseVAD` | `async is_speech(frame: bytes) -> bool` | Called once per audio frame |
| `BaseSTT` | `async transcribe_stream(audio_stream) -> AsyncIterator[str]` | Yields partial transcript strings; also provides `async transcribe(audio: bytes) -> str` for one-shot use |
| `BaseTTS` | `async synthesize_stream(text_stream) -> AsyncIterator[bytes]` | Buffers to sentence boundaries and yields audio as each sentence is ready; also provides `async synthesize(text: str) -> bytes` for one-shot use |

Implement any of these to plug in a custom provider — `VoicePipeline` only depends on the abstract interface.

---

## VAD providers

```python
from synapsekit import EnergyVAD, SileroVAD
```

| Class | Constructor | Notes |
|---|---|---|
| `EnergyVAD(threshold: float = 0.01, sample_width: int = 2)` | RMS-energy based, zero dependencies, fast (under 0.1ms/frame) | Good default for quiet environments |
| `SileroVAD(threshold: float = 0.5, sample_rate: int = 16000)` | Silero ONNX model, more robust to background noise | Requires `synapsekit[voice-silero]` |

---

## STT providers

```python
from synapsekit import LocalWhisperSTT, OpenAIWhisperSTT, DeepgramSTT
```

| Class | Constructor | Notes |
|---|---|---|
| `LocalWhisperSTT(model: str = "base", language: str \| None = None, sample_rate: int = 16000)` | Offline, via `faster-whisper` | Requires `synapsekit[voice-local]` |
| `OpenAIWhisperSTT(model: str = "whisper-1", api_key: str \| None = None, language: str \| None = None, sample_rate: int = 16000)` | OpenAI Whisper API | Requires `synapsekit[voice]` |
| `DeepgramSTT(api_key: str, model: str = "nova-2", language: str = "en", sample_rate: int = 16000)` | Deepgram streaming STT, lowest latency | Requires `synapsekit[voice-deepgram]` |

---

## TTS providers

```python
from synapsekit import OpenAITTS, ElevenLabsTTS, CartesiaTTS, PiperTTS
```

| Class | Constructor | Notes |
|---|---|---|
| `OpenAITTS(model: str = "tts-1", voice: str = "alloy", api_key: str \| None = None, response_format: str = "pcm")` | OpenAI TTS, 24kHz PCM output | Requires `synapsekit[voice]` |
| `ElevenLabsTTS(api_key: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM", model_id: str = "eleven_turbo_v2", output_format: str = "pcm_24000")` | ElevenLabs streaming TTS | Requires `synapsekit[voice-elevenlabs]` |
| `CartesiaTTS(api_key: str, voice_id: str = "a0e99841-438c-4a64-b679-ae501e7d6091", model_id: str = "sonic-2", language: str = "en", sample_rate: int = 24000)` | Cartesia streaming TTS | Requires `synapsekit[voice-cartesia]` |
| `PiperTTS(model_path: str, config_path: str \| None = None, speaker: int = 0, sample_rate: int = 22050)` | Fully offline, local ONNX model | Requires `synapsekit[voice-piper]` |

---

## Example — voice agent on the local microphone

```python
import asyncio
from synapsekit import (
    OpenAILLM,
    LLMConfig,
    VoicePipeline,
    SileroVAD,
    OpenAIWhisperSTT,
    OpenAITTS,
    PipelineEvent,
)

async def main():
    llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

    pipeline = VoicePipeline(
        llm=llm,
        stt=OpenAIWhisperSTT(api_key="sk-..."),
        tts=OpenAITTS(voice="alloy", api_key="sk-..."),
        vad=SileroVAD(),
        allow_interruption=True,
        interrupt_threshold_ms=300,
    )

    async def on_event(event: PipelineEvent) -> None:
        if event.kind == "state_change":
            print(f"[state] {event.data}")
        elif event.kind == "transcript":
            print(f"[you] {event.data}", end="", flush=True)

    await pipeline.run_microphone(
        system_prompt="You are a concise, friendly voice assistant.",
        on_event=on_event,
    )

asyncio.run(main())
```

---

## See also

- [Agent memory API reference](memory)
- [LLM API reference](llm)
- [Observability API reference](observability)
