import LumigoPrismaInstrumentation from './PrismaInstrumentation';

describe('LumigoPrismaInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoPrismaInstrumentation = new LumigoPrismaInstrumentation();

  test('getInstrumentedModule should return "prisma"', () => {
    expect(lumigoPrismaInstrumentation.getInstrumentedModules()).toEqual(['prisma']);
  });
});
