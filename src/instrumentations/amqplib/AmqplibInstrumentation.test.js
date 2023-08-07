import LumigoAmqplibInstrumentation from './AmqplibInstrumentation';

describe('LumigoAmqplibInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoAmqplibInstrumentation = new LumigoAmqplibInstrumentation();

  test('getInstrumentedModule should return "amqplib"', () => {
    expect(lumigoAmqplibInstrumentation.getInstrumentedModule()).toEqual('amqplib');
  });

  test.skip('requireIfAvailable should return required name', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install amqplib', { stdio: 'inherit' });
    const amqplib = require('amqplib');

    expect(lumigoAmqplibInstrumentation.requireIfAvailable()).toEqual(amqplib);
    child_process.execSync('npm uninstall amqplib', { stdio: 'inherit' });
  });
});
