# Music Studio

A browser-based virtual music studio with multiple instruments and sequencers.

## Features

- **Multiple Virtual Instruments**:
  - TB-303 Emulator:
    - Classic acid bass synthesizer emulation
    - Pattern sequencer with up to 32 steps
    - Advanced envelope modulation system
    - Pattern memory with MIDI-mappable slots
  - Drum Machine:
    - 32-step pattern sequencer
    - Multiple drum voices with individual controls
    - Pattern memory system
    - Sample loading capability
  - FM Synthesizer:
    - Complex FM synthesis engine
    - Multiple operator configurations
    - Advanced envelope control
  - Sampler:
    - Audio file loading and manipulation
    - Per-step pitch, velocity, and length control
    - Advanced sample playback controls
    - Pattern sequencing system

- **Studio Features**:
  - Global Transport Control (Play/Stop)
  - Master Volume Control with VU Meter
  - Tempo Control (BPM)
  - Project Save/Load System
  - MIDI Support with Learning Capability
  - Real-time Parameter Automation

- **Effects Processing**:
  - Delay with feedback control
  - More effects coming soon

## Technical Overview

Built using pure JavaScript and Web Audio API, with a modular architecture:

### Core Components
- `AudioEngine`: Audio processing and timing management
- `RenderEngine`: UI rendering and state management
- `MIDIManager`: MIDI device handling and mapping system

### Architecture

- `/js/core/`: Core system components
- `/js/audio-components/`: Audio processing modules
- `/js/workers/`: Web Workers for performance optimization

## Requirements

- Modern web browser with Web Audio API support
- MIDI controller (optional)

## Getting Started

1. Clone the repository
2. Open `index.html` in a web browser
3. Click "+ Add Instrument" to add virtual instruments
4. Press Play to start the sequencer

## Instruments

### TB-303 Emulator
- Authentic acid bassline synthesis
- 32-step pattern sequencer
- Per-step slide and accent controls
- Advanced envelope modulation system
- Pattern memory with MIDI control
- Real-time parameter automation
- Key-based pattern generation (Major/Minor)
- Octave transpose controls

### Drum Machine
- 32-step pattern sequencer
- Custom sample loading per drum voice
- Individual volume and pitch controls
- Pattern memory system with MIDI triggering
- Velocity control per step
- Default kit included

### Sampler
- Audio file import support
- 32-step sequencer
- Per-step controls:
  - Pitch shifting
  - Velocity
  - Start point
  - Length adjustment
- Pattern memory system
- Random pattern generation

### AI Composer
- Intelligent melody generation
- Scale-based composition
- Adjustable complexity and variation
- Real-time pattern modification
- Built-in synthesizer engine
- Pattern variation control

### FM Synthesizer
- Multiple operator configurations
- Complex modulation routing
- Advanced envelope system
- Waveform selection per operator
- Real-time modulation control
- Harmonic control system

### Looper
- Multi-slot audio file loading
- 32-step slice sequencer 
- Real-time pitch control
- Per-slice controls:
  - Mute/Unmute
  - Reverse playback
  - Copy/Paste functionality
- MIDI-mappable triggers
- Sample accurate playback
- Adjustable slice length
- Configurable starting position
- Waveform visualization with grid overlay
- Built-in keyboard shortcuts:
  - Space: Play/Stop
  - Shift + Mouse Wheel: Pitch control
- Memory system:
  - Up to 4 sound slots
  - Per-slot configuration saving
  - MIDI-mappable slot selection

## MIDI Implementation

### Global MIDI Features
- MIDI Learn on all parameters
- Pattern switching via MIDI
- Real-time parameter control
- Pattern memory recall
- Automatic mapping persistence

### Per-Instrument MIDI
- TB-303: Pattern and parameter control
- Drum Machine: Trigger and velocity support
- Sampler: Sample triggering and modulation
- FM Synth: Complex parameter mapping

## Audio Processing

### Features
- High-quality audio engine
- Sample-accurate timing
- Real-time parameter modulation
- Web Audio API optimization
- Worker-based processing for performance
- VU metering and monitoring

## Development

### Project Structure

## Usage

## User Interface

### Sample Management
- Support for WAV and MP3 files
- Real-time sample loading
- Multiple sample slots per instrument
- Sample visualization
- Slice-based editing

## Design & Styling

### Visual Theme
- Dark mode interface optimized for studio environments
- Color scheme:
  - Primary background: #1E2328
  - Secondary background: #272C32
  - Accent colors: 
    - Orange (#FF9500) for TB-303 and controls
    - Cyan (#00ff9d) for Drum Machine
    - Custom colors per instrument
- Neumorphic design elements for knobs and buttons
- High contrast for better readability

### UI Components

#### Knobs
- Custom WebAudio controls
- Real-time visual feedback
- Smooth animations
- MIDI-learn integration
- Support for:
  - Click and drag
  - Mouse wheel with modifier keys
  - Touch input

#### Sequencer Grids
- Responsive 32-step layouts
- Visual beat markers
- Active step highlighting
- Pattern length indicators
- Bar/beat divisions

#### Waveform Displays
- Real-time waveform visualization
- Grid overlay system
- Slice markers
- Playhead tracking
- Interactive regions

### Responsive Design
- Flexible layouts for different screen sizes
- Collapsible instrument panels
- Scrollable pattern grids
- Touch-friendly controls
- Minimum width safeguards

### CSS Architecture
- Modular CSS files per instrument
- Shared component styles
- CSS Variables for theming
- Hardware-accelerated animations
- Performance optimizations

### Accessibility Features
- High contrast mode support
- Keyboard navigation
- ARIA labels
- Screen reader compatibility
- Focus management


