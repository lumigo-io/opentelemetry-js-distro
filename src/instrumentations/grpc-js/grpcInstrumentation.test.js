import LumigoGrpcInstrumentation from './GrpcInstrumentation';

describe('LumigoGrpcInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoGrpcInstrumentation = new LumigoGrpcInstrumentation();

  test('getInstrumentedModule should return "@grpc/grpc-js"', () => {
    expect(lumigoGrpcInstrumentation.getInstrumentedModule()).toEqual('@grpc/grpc-js');
  });
});
