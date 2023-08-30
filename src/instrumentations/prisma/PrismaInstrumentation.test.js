import LumigoPrismaInstrumentation from './PrismaInstrumentation';

describe('LumigoPrismaInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoPrismaInstrumentation = new LumigoPrismaInstrumentation();

  test('getInstrumentedModule should return "prisma"', () => {
    expect(lumigoPrismaInstrumentation.getInstrumentedModule()).toEqual('prisma');
  });

  // should not be skipped, see https://lumigo.atlassian.net/browse/RD-11195
  test.skip('requireIfAvailable should return required name', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install prisma', { stdio: 'inherit' });
    const prisma = require('prisma');

    expect(lumigoPrismaInstrumentation.requireIfAvailable()).toEqual(prisma);
    child_process.execSync('npm uninstall prisma', { stdio: 'inherit' });
  });
});
