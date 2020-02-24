export interface RtcAuthParams {
  conferenceId: string;
  participantId: string;
}

export interface RtcOptions {
  websocketUrl?: string;
}

export interface JoinResponse {
}

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
  DATA = "data"
}

export interface RtcStream {
  streamId: string;
  mediaType: MediaType;
  mediaStream: MediaStream;
}

export interface SubscriptionEvent {
  mediaType: MediaType;
  streamId: string;
}

export interface UnpublishedEvent {
  streamId: string;
}

export interface MediaServerResetEvent {
  streamId: string;
  message: string;
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
