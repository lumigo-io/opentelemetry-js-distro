import LumigoFastifyInstrumentation from './FastifyInstrumentation';

describe('LumigoFastifyInstrumentation', () => {
  let lumigoFastifyInstrumentation = new LumigoFastifyInstrumentation();

  test('getInstrumentedModule should return "fastify"', () => {
    expect(lumigoFastifyInstrumentation.getInstrumentedModules()).toEqual(['fastify']);
  });
});
