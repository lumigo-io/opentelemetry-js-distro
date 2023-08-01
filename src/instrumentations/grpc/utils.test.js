import { concatenatePayload, PAYLOAD_MAX_SIZE } from './utils';

describe('gRPC utils', () => {
  test('concatenatePayload - happy flow', () => {
    const payload = concatenatePayload('BODY', 'MORE');
    expect(payload).toEqual('BODYMORE');
  });

  test('concatenatePayload - too long', () => {
    const payload = concatenatePayload('0'.repeat(PAYLOAD_MAX_SIZE - 1), '1'.repeat(10));
    expect(payload).toEqual('0'.repeat(PAYLOAD_MAX_SIZE - 1) + '1');
  });

  test('concatenatePayload - long enough', () => {
    const payload = concatenatePayload('0'.repeat(PAYLOAD_MAX_SIZE), '1'.repeat(10));
    expect(payload).toEqual('0'.repeat(PAYLOAD_MAX_SIZE));
  });

  test('concatenatePayload - JSON stringify', () => {
    const payload = concatenatePayload('', { next: 'bulk' });
    expect(payload).toEqual('{"next":"bulk"}');
  });

  test('concatenatePayload - safe execute', () => {
    const recursive = { a: 1 };
    recursive.b = recursive;
    const payload = concatenatePayload('before', recursive);
    expect(payload).toEqual('before');
  });
});
