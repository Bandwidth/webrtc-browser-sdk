# Bandwidth WebRTC Client SDK Documentation

## Initialize the Bandwidth WebRTC SDK

```javascript
import BandwidthRtc from "@bandwidth/webrtc-browser-sdk";

const bandwidthRtc = new BandwidthRtc();
```

## API Methods

### connect

- Params:
  - authParams: The conferenceId and participantId.
  - options: Optional SDK settings (can be omitted).
    - websocketUrl: override the default Bandwidth RTC connection url (this should not generally be needed)
- Description: Connect participant to a conference.

```javascript
await bandwidthRtc.connect({
  conferenceId: conferenceId,
  participantId: participantId,
});
```

### publish

- Params:
  - constraints: The media stream constraints such as audio, peerIdentity, video
    - Type: MediaStreamConstraints
- Return:
  - userMedia: A media stream with the supplied media stream constraints.
- Description: Publish media

#### Publish with default settings:

```javascript
let localStream: MediaStream = await bandwidthRtc.publish();
```

#### Publish audio only

```javascript
const mediaConstraints: MediaStreamConstraints = {
  audio: true,
  video: false,
};
let localStream: MediaStream = await bandwidthRtc.publish(mediaConstraints);
```

#### Publish with customized constraints

```javascript
const mediaConstraints: MediaStreamConstraints = {
  audio: {
    autoGainControl: true,
    channelCount: 1,
    deviceId: "default",
    echoCancellation: true,
    latency: 0.01,
    noiseSuppression: true,
    sampleRate: 48000,
    sampleSize: 16,
  },
  video: {
    aspectRatio: 1.3333333333333333,
    frameRate: 30,
    width: { min: 640, ideal: 1280 },
    height: { min: 480, ideal: 720 },
    resizeMode: "none",
  },
};
let localStream: MediaStream = await bandwidthRtc.publish(mediaConstraints);
```

Please see the following resources for more information on MediaStreamConstraints and MediaTrackConstraints that can be specified here:

- https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints
- https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints

### disconnect

- Description: Disconnect from conference.

## Event Listeners

### onUnpublished

- Description: Listens for the unpublished event.

```javascript
bandwidthRtc.onUnpublished((event) => {
  console.log(`The stream ${event.streamId} has been unpublished.`);
});
```

### onSubscribe

- Description: Listens for the subscribe event.

```javascript
bandwidthRtc.onSubscribe((event) => {
  console.log(`The stream ${event.streamId} has been subscribed to.`);
});
```

### onUnsubscribed

- Descripton: Listens for the unsubscribed event.

```javascript
bandwidthRtc.onUnsubscribed((event) => {
  console.log(`The stream ${event.streamId} has been unsubscribed from.`);
});
```

### onRemoved

- Description: Listens for the removed from conference event.

```javascript
bandwidth.onRemoved((event) => {
  console.log(`Participant ${event.participantId} has been removed from the conference.`);
});
```

### onConferenceEnded

- Description: Listens for the conference ended event.

```javascript
bandwidthRtc.onConferenceEnded((event) => {
  console.log(`The conference ${event.conferenceId} ended.`);
});
```
