import LumigoFastifyInstrumentation from './FastifyInstrumentation';

describe('LumigoFastifyInstrumentation', () => {
  let lumigoFastifyInstrumentation = new LumigoFastifyInstrumentation();

  test('getInstrumentedModule should return "fastify"', () => {
    expect(lumigoFastifyInstrumentation.getInstrumentedModule()).toEqual('fastify');
  });

  // should not be skipped, see https://lumigo.atlassian.net/browse/RD-11195
  test.skip('requireIfAvailable should return required name', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install fastify', { stdio: 'inherit' });
    const fastify = require('fastify');

    expect(lumigoFastifyInstrumentation.requireIfAvailable()).toEqual(fastify);
    child_process.execSync('npm uninstall fastify', { stdio: 'inherit' });
  });
});
