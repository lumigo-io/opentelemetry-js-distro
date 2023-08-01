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

  test('concatenatePayload - dont add new payload if the current is long enough', () => {
    const payload = concatenatePayload('0'.repeat(PAYLOAD_MAX_SIZE), '1'.repeat(10));
    expect(payload).toEqual('0'.repeat(PAYLOAD_MAX_SIZE));
  });

  test('concatenatePayload - JSON stringify', () => {
    const payload = concatenatePayload('', { next: 'bulk' });
    expect(payload).toEqual('{"next":"bulk"}');
  });

  test('concatenatePayload - truncate long JSONs', () => {
    const payload = concatenatePayload('', { next: '1'.repeat(PAYLOAD_MAX_SIZE) });
    expect(payload).toContain('{"next":"111111');
    expect(payload.length).toEqual(PAYLOAD_MAX_SIZE);
  });

  test('concatenatePayload - safe execute handle exceptions with returning old value', () => {
    const recursive = { a: 1 };
    recursive.b = recursive;
    const payload = concatenatePayload('before', recursive);
    expect(payload).toEqual('before');
  });
});
