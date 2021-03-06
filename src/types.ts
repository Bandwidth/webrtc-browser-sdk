export interface RtcAuthParams {
  deviceToken: string;
}

export interface RtcOptions {
  websocketUrl?: string;
}

export interface JoinResponse {}

export interface SubscribeRequest {
  streamId: string;
  sdpOffer: string;
}

export interface SubscribeResponse {
  streamId: string;
  sdpAnswer: string;
}

export enum MediaType {
  ALL = "all",
  AUDIO = "audio",
  VIDEO = "video",
  DATA = "data",
}

export enum AudioLevel {
  SILENT = "silent",
  LOW = "low",
  HIGH = "high",
}

export type AudioLevelChangeHandler = { (audioLevel: AudioLevel): void };

// this is used as the event for subscribedHandler, and for other purposes
export interface RtcStream {
  streamId: string;
  mediaType: MediaType;
  mediaStream: MediaStream;
}

export interface RepublishEvent {
  streamId: string;
}

export interface ResubscribeEvent {
  mediaType?: MediaType;
  streamId: string;
}

export interface SubscribeEvent {
  mediaType: MediaType;
  streamId: string;
}
export interface UnsubscribedEvent {
  mediaType: MediaType;
  streamId: string;
}
// this is an alias for SubscribeEvent and UnsubscribedEvent, keeping for backward compat, TODO, remove
export interface SubscriptionEvent {
  mediaType: MediaType;
  streamId: string;
}

export interface UnpublishedEvent {
  streamId: string;
}

export interface OnIceCandidateEvent {
  streamId: string;
  candidate: string;
  sdpMLineIndex: number;
  sdpMid: string;
}

export interface MessageReceivedEvent {
  channelId: string;
  message: string;
}

export interface PublishRequest {
  sdpOffer: string;
}

export interface PublishResponse {
  streamId: string;
  sdpAnswer: string;
}

export class SdpOfferRejectedError extends Error {}
