import LumigoKafkaJsInstrumentation from './KafkaJsInstrumentation';

describe('LumigoKafkaJsInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoKafkaJsInstrumentation = new LumigoKafkaJsInstrumentation();

  test('getInstrumentedModule should return "kafkajs"', () => {
    expect(lumigoKafkaJsInstrumentation.getInstrumentedModule()).toEqual('kafkajs');
  });

  // should not be skipped, see https://lumigo.atlassian.net/browse/RD-11195
  test.skip('requireIfAvailable should return required name', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install kafkajs', { stdio: 'inherit' });
    const kafkajs = require('kafkajs');

    expect(lumigoKafkaJsInstrumentation.requireIfAvailable()).toEqual(kafkajs);
    child_process.execSync('npm uninstall kafkajs', { stdio: 'inherit' });
  });
});
