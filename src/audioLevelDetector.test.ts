import { AudioLevel } from "./types";
import AudioLevelDetector from "./audioLevelDetector";
import { sleep } from "./time";

type fakeMediaStream = MediaStream;

class MockAudioContext {
  createMediaStreamSource() {
    return { connect: () => {} };
  }
  createAnalyser() {
    return {};
  }
}

const realInterval = setInterval;
//@ts-ignore
const realAudioContext = global.AudioContext;
const mockInterval = setInterval(() => {}, 0);

beforeAll(() => {
  //@ts-ignore
  global.AudioContext = MockAudioContext;
  global.setInterval = (callback: { (...args: any[]): void }, ms: number, ...args: any[]) => {
    return mockInterval;
  };
});

afterAll(() => {
  //@ts-ignore
  global.AudioContext = realAudioContext;
  global.setInterval = realInterval;
});

test("test emit silent at start", () => {
  const spy = jest.fn();
  const timeThreshold = 10;
  const audioLevelDetector = new AudioLevelDetector({
    mediaStream: {} as fakeMediaStream,
    timeThreshold: timeThreshold,
  });
  audioLevelDetector.on("audioLevelChange", spy);
  audioLevelDetector.emitCurrentAudioLevel();
  expect(spy).toHaveBeenCalledWith(AudioLevel.SILENT);
});

test("test emit low", () => {
  const spy = jest.fn();
  const timeThreshold = 10;
  const audioLevelDetector = new AudioLevelDetector({
    mediaStream: {} as fakeMediaStream,
    timeThreshold: timeThreshold,
  });
  audioLevelDetector.on("audioLevelChange", spy);
  audioLevelDetector.analyseSample(audioLevelDetector.normalizeSample(64)); // LOW
  audioLevelDetector.emitCurrentAudioLevel();
  expect(spy).toHaveBeenCalledWith(AudioLevel.LOW);
});

test("test emit high", () => {
  const spy = jest.fn();
  const timeThreshold = 10;
  const audioLevelDetector = new AudioLevelDetector({
    mediaStream: {} as fakeMediaStream,
    timeThreshold: timeThreshold,
  });
  audioLevelDetector.on("audioLevelChange", spy);
  audioLevelDetector.analyseSample(audioLevelDetector.normalizeSample(256)); // HIGH
  audioLevelDetector.emitCurrentAudioLevel();
  expect(spy).toHaveBeenCalledWith(AudioLevel.HIGH);
});

test("test immediate transition from low to high", () => {
  const spy = jest.fn();
  const timeThreshold = 10;
  const audioLevelDetector = new AudioLevelDetector({
    mediaStream: {} as fakeMediaStream,
    timeThreshold: timeThreshold,
  });
  audioLevelDetector.on("audioLevelChange", spy);
  audioLevelDetector.analyseSample(audioLevelDetector.normalizeSample(64)); // LOW
  audioLevelDetector.emitCurrentAudioLevel();
  expect(spy).toHaveBeenCalledWith(AudioLevel.LOW);
  audioLevelDetector.analyseSample(audioLevelDetector.normalizeSample(256)); // HIGH
  audioLevelDetector.emitCurrentAudioLevel();
  expect(spy).toHaveBeenCalledWith(AudioLevel.HIGH);
});

test("test emit silent after time threshold", async (done) => {
  const spy = jest.fn();
  const timeThreshold = 10;
  const audioLevelDetector = new AudioLevelDetector({
    mediaStream: {} as fakeMediaStream,
    timeThreshold: timeThreshold,
  });
  audioLevelDetector.on("audioLevelChange", spy);
  audioLevelDetector.analyseSample(audioLevelDetector.normalizeSample(64)); // LOW
  audioLevelDetector.analyseSample(audioLevelDetector.normalizeSample(256)); // HIGH
  await sleep(timeThreshold + 5);
  audioLevelDetector.analyseSample(audioLevelDetector.normalizeSample(0));
  audioLevelDetector.emitCurrentAudioLevel();
  expect(spy).toHaveBeenLastCalledWith(AudioLevel.SILENT);
  done();
});
