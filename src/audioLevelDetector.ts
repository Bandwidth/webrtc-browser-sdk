import { EventEmitter } from "events";
import { AudioLevel } from "./types";

export interface AudioLevelDetectorOptions {
  mediaStream: MediaStream;
  timeThreshold?: number;
  amplitudeThreshold?: number;
  sampleInterval?: number;
  maxEmitInterval?: number;
}

export default class AudioLevelDetector extends EventEmitter {
  private start: number = 0;
  private lastEmitTime: number = 0;
  private timeThreshold = 500;
  private silenceAmplitudeThreshold = 0.2;
  private highAmplitudeThreshold = 0.5;
  private sampleInterval: number = 100; // ms
  private maxEmitInterval: number = 500; // ms;
  private analyzerNode: AnalyserNode;
  private currentAudioLevel: AudioLevel = AudioLevel.SILENT;
  private previousAudioLevel: AudioLevel = AudioLevel.SILENT;

  constructor(config: AudioLevelDetectorOptions) {
    super();

    const context = new AudioContext();

    if (config.amplitudeThreshold) {
      this.silenceAmplitudeThreshold = config.amplitudeThreshold;
    }
    if (config.timeThreshold) {
      this.timeThreshold = config.timeThreshold;
    }
    if (config.maxEmitInterval) {
      this.maxEmitInterval = config.maxEmitInterval;
    }
    if (config.sampleInterval) {
      this.sampleInterval = config.sampleInterval;
    }

    // Chrome hack
    new Audio().srcObject = config.mediaStream;
    const source = context.createMediaStreamSource(config.mediaStream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);
    this.analyzerNode = analyser;

    setInterval(this.analyze.bind(this), this.sampleInterval);
  }

  private analyze() {
    const bufferLength = this.analyzerNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    const now = Date.now();
    const elapsedTime = now - this.start;
    this.analyzerNode.getByteTimeDomainData(dataArray);
    // Iterate over each of the samples
    for (let i = 0; i < bufferLength; i++) {
      // Normalize between 0 and 1
      const sampleValue = Math.abs(dataArray[i] / 128 - 1.0);
      if (sampleValue < this.silenceAmplitudeThreshold) {
        if (elapsedTime > this.timeThreshold) {
          // Not speaking
          if (this.currentAudioLevel !== AudioLevel.SILENT) {
            this.currentAudioLevel = AudioLevel.SILENT;
          }
        }
      } else if (sampleValue >= this.highAmplitudeThreshold) {
        // Speaking loudly
        this.start = now;
        this.currentAudioLevel = AudioLevel.HIGH;
      } else {
        // Speaking softly
        this.start = now;
        this.currentAudioLevel = AudioLevel.LOW;
      }
      if (this.previousAudioLevel !== this.currentAudioLevel) {
        // Allow emitting "high" sooner
        if (now - this.lastEmitTime > this.maxEmitInterval || this.currentAudioLevel === AudioLevel.HIGH) {
          this.emit("audioLevelChange", this.currentAudioLevel);
          this.lastEmitTime = now;
          this.previousAudioLevel = this.currentAudioLevel;
        }
      }
    }
  }
}
