require("webrtc-adapter");
import {
  MediaType,
  MessageReceivedEvent,
  PublishCommand,
  OnIceCandidateEvent,
  RtcAuthParams,
  RtcOptions,
  RtcStream,
  SdpOfferRejectedError,
  SubscribeCommand,
  UnpublishedEvent,
  UnsubscribedEvent
} from "./types";
import Signaling from "./signaling";

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: []
};

class BandwidthRtc {

  // Signaling
  private signaling: Signaling = new Signaling();

  // WebRTC
  private localPeerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStreams: Map<string, MediaStream> = new Map();
  private localDataChannels: Map<string, RTCDataChannel> = new Map();

  private remotePeerConnections: Map<string, RTCPeerConnection> = new Map();
  private iceCandidateQueues: Map<string, OnIceCandidateEvent[]> = new Map();
  private remoteDataChannels: Map<string, RTCDataChannel> = new Map();
  private remoteMediaTypes: Map<string, MediaType> = new Map();

  // Event handlers
  publishCommandHandler?: { (event: PublishCommand): void };
  subscribeCommandHandler?: { (event: SubscribeCommand): void };
  subscribedHandler?: { (event: RtcStream): void };
  unsubscribedHandler?: { (event: UnsubscribedEvent): void };
  unpublishedHandler?: { (event: UnpublishedEvent): void };
  removedHandler?: { (): void };
  messageReceivedHandler?: { (message: MessageReceivedEvent): void };

  constructor() {
    this.setMicEnabled = this.setMicEnabled.bind(this);
    this.setCameraEnabled = this.setCameraEnabled.bind(this);
  }

  connect(authParams: RtcAuthParams, options?: RtcOptions) {

    this.createSignalingBroker()

    this.signaling.addListener(
      "onIceCandidate",
      this.onIceCandidateHandler.bind(this)
    );
    this.signaling.addListener(
      "publish",
      this.handlePublishCommand.bind(this)
    );
    this.signaling.addListener(
      "subscribe",
      this.handleSubscribeCommand.bind(this)
    );
    this.signaling.addListener(
      "unsubscribed",
      this.handleUnsubscribedEvent.bind(this)
    );
    this.signaling.addListener(
      "unpublished",
      this.handleUnpublishedEvent.bind(this)
    );
    this.signaling.addListener(
      "removed",
      this.handleRemovedEvent.bind(this)
    );
  
    return this.connectAndJoin(authParams, options);
  }

  private async connectAndJoin(authParams: RtcAuthParams, options?: RtcOptions) {
    await this.signaling.connect(authParams, options);
    await this.signaling.join();
  }

  private createSignalingBroker() {
    this.signaling = new Signaling();
  }

  private onIceCandidateHandler(event: OnIceCandidateEvent) {
    const streamId = event.streamId;
    if (streamId) {
      const rtcPeerConnection =
        this.remotePeerConnections.get(streamId) ||
        this.localPeerConnections.get(streamId);
      
      const iceCandidate = new RTCIceCandidate({
        candidate: event.candidate,
        sdpMLineIndex: event.sdpMLineIndex,
        sdpMid: event.sdpMid
      });

      if (rtcPeerConnection && rtcPeerConnection.currentRemoteDescription) {
        // If we have already created a peer connection and set its remote description, just add the candidate
        rtcPeerConnection.addIceCandidate(iceCandidate);
      } else {
        // Otherwise, we will need to put the candidate on a queue until the remote description is set
        let remoteIceCandidates = this.iceCandidateQueues.get(streamId);
        if (remoteIceCandidates) {
          remoteIceCandidates.push(event);
        } else {
          this.iceCandidateQueues.set(streamId, [event]);
        }
      }
    }
  }

  private handleSubscribeCommand(command: SubscribeCommand) {
    if (command.streamId && command.mediaType) {
      this.subscribeToStream(command.streamId, command.mediaType);
    } else {
      this.resubscribeToAllStreams()
    }
  }

  private async resubscribeToAllStreams() {
    // resubscribe to existing known streams
    for (const streamId in this.remotePeerConnections.keys) {
      let mediaType = this.remoteMediaTypes.get(streamId);
      if (mediaType) {
        this.subscribeToStream(streamId, mediaType);
      }
    }
  }

  private async subscribeToStream(streamId: string, mediaType: MediaType) {
    // We have been instructed by Bandwidth to subscribe to this stream

    // Create a new RTC Peer to handle receiving this stream
    const remotePeerConnection = new RTCPeerConnection(RTC_CONFIGURATION);
    const remoteDataChannel = remotePeerConnection.createDataChannel(streamId);

    remotePeerConnection.onicecandidate = event =>
      this.signaling.sendIceCandidate(streamId, event.candidate, "subscribe");

    remotePeerConnection.ontrack = event => {
      if (this.subscribedHandler) {
        this.subscribedHandler({
          streamId: streamId,
          mediaStream: event.streams[0],
          mediaType: mediaType
        });
      }
    };

    remoteDataChannel.onmessage = event => {
      if (this.messageReceivedHandler) {
        this.messageReceivedHandler({
          channelId: streamId,
          message: event.data
        });
      }
    };

    const offerOptions = this.getOfferOptions(mediaType)
    let localOffer = await remotePeerConnection.createOffer(offerOptions);
    if (!localOffer.sdp) {
      throw new Error("Created offer with no SDP");
    }

    let result = await this.signaling.subscribe(streamId, localOffer.sdp);

    await remotePeerConnection.setLocalDescription(localOffer);
    await remotePeerConnection.setRemoteDescription({
      type: "answer",
      sdp: result.sdpAnswer
    });

    let queuedRemoteCandidates = this.iceCandidateQueues.get(streamId);
    if (queuedRemoteCandidates) {
      queuedRemoteCandidates.forEach(candidate => {
        remotePeerConnection.addIceCandidate(candidate);
      });
      this.iceCandidateQueues.delete(streamId);
    }

    this.remotePeerConnections.set(streamId, remotePeerConnection);
    this.remoteDataChannels.set(streamId, remoteDataChannel);
    this.remoteMediaTypes.set(streamId, mediaType);
  }

  private getOfferOptions(mediaType: MediaType) {
    const offerOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    };
    if (mediaType === MediaType.AUDIO) {
      offerOptions.offerToReceiveVideo = false;
    }
    return offerOptions;
  }

  private handleUnsubscribedEvent(notification: UnsubscribedEvent) {
    this.cleanupRemoteStreams(notification.streamId);
    if (this.unsubscribedHandler) {
      this.unsubscribedHandler(notification);
    }
  }

  private handleUnpublishedEvent(notification: UnpublishedEvent) {
    this.cleanupLocalStreams(notification.streamId);
    if (this.unpublishedHandler) {
      this.unpublishedHandler(notification);
    }
  }

  private handleRemovedEvent() {
    this.cleanupLocalStreams();
    this.cleanupRemoteStreams();
    this.signaling.disconnect();
    if (this.removedHandler) {
      this.removedHandler();
    }
  }

  onSubscribe(callback: { (event: RtcStream): void }): void {
    this.subscribedHandler = callback;
  }

  onUnsubscribed(callback: { (event: UnsubscribedEvent): void }): void {
    this.unsubscribedHandler = callback;
  }

  onUnpublished(callback: { (event: UnpublishedEvent): void }): void {
    this.unpublishedHandler = callback;
  }

  onRemoved(callback: { (): void }): void {
    this.removedHandler = callback;
  }

  onMessageReceived(callback: { (message: MessageReceivedEvent): void }): void {
    this.messageReceivedHandler = callback;
  }

  private stopLocalMedia(streamId?: string) {
    if (streamId) {
      // If a stream ID was passed in, just stop that particular one
      this.localStreams
        .get(streamId)
        ?.getTracks()
        .forEach(track => track.stop());
    } else {
      // Otherwise stop all tracks from all streams
      this.localStreams.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
    }
  }

  private async handlePublishCommand(command: PublishCommand) {
    // reset publishing
    this.unpublish();
    this.publish();
  }

  async publish(constraints?: MediaStreamConstraints): Promise<RtcStream> {
    if (!constraints) {
      constraints = { audio: true, video: true };
    }
    const localMediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    const localPeerConnection = new RTCPeerConnection(RTC_CONFIGURATION);

    localMediaStream.getTracks().forEach(track => {
      localPeerConnection.addTrack(track, localMediaStream);
    });

    const localDataChannel = localPeerConnection.createDataChannel("default");

    const localOffer = await localPeerConnection.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false
    });
    if (!localOffer.sdp) {
      throw new Error("Created offer with no SDP");
    }

    try {
      const publishResponse = await this.signaling.publish(localOffer.sdp);
      const streamId = publishResponse.streamId;

      localPeerConnection.onicecandidate = event =>
        this.signaling.sendIceCandidate(streamId, event.candidate, "publish");

      await localPeerConnection.setLocalDescription(localOffer);
      await localPeerConnection.setRemoteDescription({
        type: "answer",
        sdp: publishResponse.sdpAnswer
      });

      let queuedIceCandidates = this.iceCandidateQueues.get(streamId);
      if (queuedIceCandidates) {
        queuedIceCandidates.forEach(candidate => {
          localPeerConnection.addIceCandidate(candidate);
        });
        this.iceCandidateQueues.delete(streamId);
      }

      this.localDataChannels.set(streamId, localDataChannel);
      this.localPeerConnections.set(streamId, localPeerConnection);
      this.localStreams.set(publishResponse.streamId, localMediaStream);

      let mediaType = MediaType.ALL;
      if (constraints.audio && !constraints.video) {
        mediaType = MediaType.AUDIO;
      } else {
        mediaType = MediaType.VIDEO;
      }
      return {
        streamId: publishResponse.streamId,
        mediaStream: localMediaStream,
        mediaType: mediaType
      };
    } catch (e) {
      if (String(e.message).toLowerCase().includes("sdp")) {
        throw new SdpOfferRejectedError(e.message);
      } else {
        throw e;
      }
    }
  }

  async unpublish(...streams: string[]) {
    if (streams.length === 0) {
      streams = Array.from(this.localStreams.keys());
    }
    for (const s of streams) {
      await this.signaling.unpublish(s);
      this.cleanupLocalStreams(s);
    }
  }

  private cleanupLocalStreams(...streams: string[]) {
    if (streams.length === 0) {
      streams = Array.from(this.localStreams.keys());
    }

    for (const s of streams) {
      this.stopLocalMedia(s);
      this.localStreams.delete(s);

      const localPeerConnection = this.localPeerConnections.get(s);
      localPeerConnection?.close();
      this.localPeerConnections.delete(s);

      const localDataChannel = this.localDataChannels.get(s);
      localDataChannel?.close();
      this.localDataChannels.delete(s);
    }
  }

  private cleanupRemoteStreams(...streams: string[]) {
    if (streams.length === 0) {
      streams = Array.from(this.remotePeerConnections.keys());
    }

    for (const s of streams) {
      const remotePeerConnection = this.remotePeerConnections.get(s);
      remotePeerConnection?.close();
      this.remotePeerConnections.delete(s);

      const remoteDataChannel = this.remoteDataChannels.get(s);
      remoteDataChannel?.close();
      this.remoteDataChannels.delete(s);
    }
  }

  sendMessage(message: string, sourceStreamId?: string): void {
    // Send from the specified stream ID. If none specified, pick the first (not predictable) one in the map
    const dataChannel = sourceStreamId
      ? this.localDataChannels.get(sourceStreamId)
      : this.localDataChannels.values().next().value;
    dataChannel?.send(message);
  }

  setMicEnabled(enabled: boolean, streamId?: string) {
    if (streamId) {
      this.localStreams
        .get(streamId)
        ?.getAudioTracks()
        .forEach(track => (track.enabled = enabled));
    } else {
      this.localStreams.forEach(stream =>
        stream.getAudioTracks().forEach(track => (track.enabled = enabled))
      );
    }
  }

  setCameraEnabled(enabled: boolean, streamId?: string) {
    if (streamId) {
      this.localStreams
        .get(streamId)
        ?.getVideoTracks()
        .forEach(track => (track.enabled = enabled));
    } else {
      this.localStreams.forEach(stream =>
        stream.getVideoTracks().forEach(track => (track.enabled = enabled))
      );
    }
  }

  disconnect() {
    this.signaling.disconnect();
    this.stopLocalMedia();
    this.localStreams = new Map();
  }
}

export default BandwidthRtc;
