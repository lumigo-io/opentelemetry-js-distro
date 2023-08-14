import LumigoGrpcInstrumentation from './GrpcInstrumentation';

describe('LumigoGrpcInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoGrpcInstrumentation = new LumigoGrpcInstrumentation();

  test('getInstrumentedModule should return "@grpc/grpc-js"', () => {
    expect(lumigoGrpcInstrumentation.getInstrumentedModule()).toEqual('@grpc/grpc-js');
  });

  // should not be skipped, see https://lumigo.atlassian.net/browse/RD-11195
  test.skip('requireIfAvailable should return required name', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install @grpc/grpc-js', { stdio: 'inherit' });
    const grpcjs = require('@grpc/grpc-js');

    expect(lumigoGrpcInstrumentation.requireIfAvailable()).toEqual(grpcjs);
    child_process.execSync('npm uninstall @grpc/grpc-js', { stdio: 'inherit' });
  });
});
