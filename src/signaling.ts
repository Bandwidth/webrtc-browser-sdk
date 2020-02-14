const sdkVersion = require("../package.json").version;
import { EventEmitter } from "events";
import { Client as JsonRpcClient } from "rpc-websockets";
import {
  RtcAuthParams,
  RtcOptions,
  SubscribeResponse,
  PublishResponse
} from "./types";

class Signaling extends EventEmitter {
  // Websocket
  private defaultWebsocketUrl: string = "wss://device.webrtc.bandwidth.com";
  private ws: JsonRpcClient | null = null;
  private pingInterval?: NodeJS.Timeout;

  Signaling() {}

  connect(authParams: RtcAuthParams, options?: RtcOptions) {
    return new Promise((resolve, reject) => {
      let rtcOptions: RtcOptions = {
        websocketUrl: this.defaultWebsocketUrl
      };

      if (options) {
        rtcOptions = { ...rtcOptions, ...options };
      }

      const websocketUrl = `${rtcOptions.websocketUrl}/v1/?at=d&conferenceId=${authParams.conferenceId}&participantId=${authParams.participantId}&sdkVersion=${sdkVersion}`;

      const ws = new JsonRpcClient(websocketUrl, {
        max_reconnects: 0 // Unlimited
      });
      this.ws = ws;

      ws.addListener("subscribe", event => this.emit("subscribe", event));
      ws.addListener("unsubscribed", event => this.emit("unsubscribed", event));
      ws.addListener("unpublished", event => this.emit("unpublished", event));
      ws.addListener("removed", () => this.emit("removed"));
      ws.addListener("mediaServerReset", event => this.emit("mediaServerReset", event));
      ws.addListener("onIceCandidate", event => this.emit("onIceCandidate", event));

      ws.on("open", () => {
        this.pingInterval = setInterval(() => {
          ws.call("onTest", {});
        }, 300000);
        resolve();
      });

      ws.on("error", error => {
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
        }
      });

      ws.on("close", code => {
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
        }
      });
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  }

  publish(sdpOffer: string): Promise<PublishResponse> {
    return this.ws?.call("publishMedia", {
      sdpOffer: sdpOffer
    }) as Promise<PublishResponse>;
  }

  unpublish(streamId: string) {
    return this.ws?.call("unpublishMedia", {
      streamId: streamId
    });
  }

  subscribe(streamId: string, sdpOffer: string): Promise<SubscribeResponse> {
    return this.ws?.call("subscribeMedia", {
      streamId: streamId,
      sdpOffer: sdpOffer
    }) as Promise<SubscribeResponse>;
  }

  sendIceCandidate(
    streamId: string,
    candidate: RTCIceCandidate | null,
    candidateType: string
  ) {
    if (candidate) {
      let missingFields = [];
      if (candidate.sdpMid && candidate.sdpMLineIndex != null) {
        let params = {
          streamId: streamId,
          candidateType: candidateType,
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex
        };
        this.ws?.call("onIceCandidate", params);
      }
    }
  }
}

export default Signaling;
