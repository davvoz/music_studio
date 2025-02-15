# Music Studio

A browser-based virtual music studio with multiple instruments and sequencers.

## Core Features

### Virtual Instruments
- **TB-303 Emulator**
  - Classic acid bass synthesis
  - 32-step sequencer with slide/accent
  - Advanced envelope system
  - Pattern memory with MIDI mapping

- **Drum Machine**
  - 32-step pattern sequencer
  - Custom sample support
  - Individual voice controls
  - Pattern memory system

- **FM Synthesizer**
  - Multiple operator configurations
  - Complex modulation routing
  - Real-time parameter control
  - Advanced envelope system

- **Sampler**
  - WAV/MP3 support
  - 32-step sequencer
  - Per-step pitch/velocity/length
  - Waveform visualization

- **Looper**
  - 4 independent audio slots
  - 32-step slice sequencer
  - Real-time manipulation
  - MIDI-mappable triggers

- **AI Composer**
  - Intelligent melody generation
  - Scale-based composition
  - Real-time variations
  - Built-in synthesizer

### Studio Features
- Global transport control
- Master volume with VU meter
- Project save/load system
- Real-time automation
- Effect processing (Delay, more coming)

## Technical Overview

### Architecture
```javascript
Core Components:
- AudioEngine    // Audio processing & timing
- RenderEngine   // UI & state management
- MIDIManager    // MIDI handling & mapping
```

### MIDI Implementation
- Universal parameter mapping
- Pattern switching/memory recall
- Real-time control
- Mapping persistence

## Requirements
- Modern browser with Web Audio API
- Multi-core CPU recommended
- MIDI controller (optional)

## Quick Start
1. Clone repository
2. Open `index.html`
3. Add instruments
4. Start creating!

## Design

### Theme
```css
:root {
    --background: #1E2328;
    --secondary: #272C32;
    --accent-main: #FF9500;
    --accent-alt: #00ff9d;
}
```

### UI Components
- Neumorphic controls
- Interactive waveforms
- Responsive layouts
- Touch-friendly interface
- Accessibility features

## Development

For detailed technical documentation and contribution guidelines, see our [Wiki](https://github.com/davvoz/music_studio/wiki).


