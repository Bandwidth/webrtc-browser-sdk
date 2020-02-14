import BandwidthRtc from './bandwidthRtc';

test('test constructor', () => {
    const bandwidthRtc = new BandwidthRtc();
    expect(bandwidthRtc).toBeInstanceOf(BandwidthRtc);
    expect(bandwidthRtc.setMicEnabled).toBeInstanceOf(Function);
    expect(bandwidthRtc.setCameraEnabled).toBeInstanceOf(Function);
});

test('test connect', () => {
    const bandwidthRtc = new BandwidthRtc();
    const authParams = {
        conferenceId: 'foo',
        participantId: 'bar'
    };
    const options = {
        websocketUrl: 'huh://not.real.url.becaused.its.mocked'
    };

    bandwidthRtc.createSignalingBroker = jest.fn();
    bandwidthRtc.signaling.addListener = jest.fn();
    bandwidthRtc.signaling.connect = jest.fn();
    bandwidthRtc.connect(authParams, options);

    expect(bandwidthRtc.conferenceId).toBe('foo');
    expect(bandwidthRtc.participantId).toBe('bar');
    expect(bandwidthRtc.onIceCandidateHandler).toBeInstanceOf(Function);
    expect(bandwidthRtc.handleSubscribeEvent).toBeInstanceOf(Function);
    expect(bandwidthRtc.handleUnsubscribedEvent).toBeInstanceOf(Function);
    expect(bandwidthRtc.handleRemovedEvent).toBeInstanceOf(Function);
    expect(bandwidthRtc.handleMediaServerResetEvent).toBeInstanceOf(Function);
    expect(bandwidthRtc.signaling.connect).toBeCalledTimes(1);
    expect(bandwidthRtc.signaling.connect).toBeCalledWith(authParams, options);
});
