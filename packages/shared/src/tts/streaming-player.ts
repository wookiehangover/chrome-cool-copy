/**
 * HybridStreamingPlayer - Web Audio API streaming player for TTS
 *
 * Features:
 * - Streams audio for immediate playback (no waiting for full download)
 * - Accumulates chunks to create a blob for replay with native controls
 * - Tracks playback position for seamless handoff to audio element
 * - Supports pause/resume during streaming
 */
export class HybridStreamingPlayer {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private sampleRate = 0;
  private numChannels = 0;
  private headerParsed = false;
  private headerBuffer = new Uint8Array(44);
  private headerBytesReceived = 0;
  private nextStartTime = 0;
  private minBufferSize = 16384;
  private pcmData = new Uint8Array(0);
  private onFirstAudio?: () => void;
  private firstAudioPlayed = false;

  // For accumulating the full WAV file
  private allChunks: Uint8Array[] = [];
  private stopped = false;

  // For tracking playback position
  private playbackStartContextTime = 0;
  private totalScheduledDuration = 0;

  // For pause/resume functionality
  private _isPaused = false;
  private pauseStartTime = 0;
  private totalPausedDuration = 0;

  constructor(onFirstAudio?: () => void) {
    this.audioContext = new AudioContext();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    this.onFirstAudio = onFirstAudio;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  private parseWavHeader(header: Uint8Array): void {
    const view = new DataView(header.buffer);
    const riff = String.fromCharCode(...Array.from(header.slice(0, 4)));
    const wave = String.fromCharCode(...Array.from(header.slice(8, 12)));

    if (riff !== "RIFF" || wave !== "WAVE") {
      throw new Error("Invalid WAV file");
    }

    this.numChannels = view.getUint16(22, true);
    this.sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    console.log(
      `[TTS] WAV Format: ${this.sampleRate}Hz, ${this.numChannels} channels, ${bitsPerSample} bits`,
    );
    this.headerParsed = true;
  }

  private appendPcmData(newData: Uint8Array): void {
    const newBuffer = new Uint8Array(this.pcmData.length + newData.length);
    newBuffer.set(this.pcmData);
    newBuffer.set(newData, this.pcmData.length);
    this.pcmData = newBuffer;
  }

  private tryPlayBuffer(): void {
    if (this.stopped || !this.headerParsed || this.pcmData.length < this.minBufferSize) {
      return;
    }

    const bytesPerSample = this.numChannels * 2;
    const samplesToPlay = Math.floor(this.pcmData.length / bytesPerSample);
    const bytesToPlay = samplesToPlay * bytesPerSample;

    if (bytesToPlay === 0) return;

    const dataToPlay = this.pcmData.slice(0, bytesToPlay);
    this.pcmData = this.pcmData.slice(bytesToPlay);

    const audioBuffer = this.audioContext.createBuffer(
      this.numChannels,
      samplesToPlay,
      this.sampleRate,
    );
    const int16Data = new Int16Array(
      dataToPlay.buffer,
      dataToPlay.byteOffset,
      samplesToPlay * this.numChannels,
    );

    for (let channel = 0; channel < this.numChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < samplesToPlay; i++) {
        channelData[i] = int16Data[i * this.numChannels + channel] / 32768;
      }
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(currentTime, this.nextStartTime);
    source.start(startTime);

    // Track first audio playback and record start time for position tracking
    if (!this.firstAudioPlayed && this.onFirstAudio) {
      this.firstAudioPlayed = true;
      this.playbackStartContextTime = startTime;
      this.onFirstAudio();
    }

    this.nextStartTime = startTime + audioBuffer.duration;
    this.totalScheduledDuration += audioBuffer.duration;

    // Continue playing if there's more data
    if (this.pcmData.length >= this.minBufferSize) {
      setTimeout(() => this.tryPlayBuffer(), 10);
    }
  }

  addChunk(chunk: Uint8Array): void {
    // Always accumulate for later blob creation
    this.allChunks.push(new Uint8Array(chunk));

    if (!this.headerParsed) {
      const headerBytesNeeded = 44 - this.headerBytesReceived;
      const bytesToCopy = Math.min(headerBytesNeeded, chunk.length);

      this.headerBuffer.set(chunk.slice(0, bytesToCopy), this.headerBytesReceived);
      this.headerBytesReceived += bytesToCopy;

      if (this.headerBytesReceived >= 44) {
        this.parseWavHeader(this.headerBuffer);
        if (chunk.length > bytesToCopy) {
          this.appendPcmData(chunk.slice(bytesToCopy));
        }
      }
    } else {
      this.appendPcmData(chunk);
    }

    this.tryPlayBuffer();
  }

  /** Flush any remaining buffered audio */
  flush(): void {
    if (this.pcmData.length > 0 && this.headerParsed && !this.stopped) {
      const originalMin = this.minBufferSize;
      this.minBufferSize = 0;
      this.tryPlayBuffer();
      this.minBufferSize = originalMin;
    }
  }

  /** Get the accumulated WAV blob for replay */
  getBlob(): Blob {
    const totalLength = this.allChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.allChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return new Blob([combined], { type: "audio/wav" });
  }

  /** Get current playback position in seconds */
  getCurrentTime(): number {
    if (!this.firstAudioPlayed || this.stopped) return 0;
    const elapsed = this.audioContext.currentTime - this.playbackStartContextTime;
    return Math.max(0, Math.min(elapsed, this.totalScheduledDuration));
  }

  /** Get total duration of all scheduled audio */
  getTotalDuration(): number {
    return this.totalScheduledDuration;
  }

  /** Pause playback without stopping the stream */
  pause(): void {
    if (this._isPaused || this.stopped) return;
    this._isPaused = true;
    this.pauseStartTime = this.audioContext.currentTime;
    this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    this.audioContext.suspend();
    console.log("[TTS] Playback paused");
  }

  /** Resume playback */
  resume(): void {
    if (!this._isPaused || this.stopped) return;
    this._isPaused = false;
    this.totalPausedDuration += this.audioContext.currentTime - this.pauseStartTime;
    this.audioContext.resume();
    this.gainNode.gain.setValueAtTime(1, this.audioContext.currentTime);
    console.log("[TTS] Playback resumed");
  }

  /** Stop playback and return current position for seamless handoff */
  stopAndGetPosition(): number {
    const currentTime = this.getCurrentTime();
    this.stopped = true;
    this.audioContext.close();
    return currentTime;
  }

  stop(): void {
    this.stopped = true;
    this.audioContext.close();
  }
}
