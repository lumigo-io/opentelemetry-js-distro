import LumigoHttpInstrumentation from './HttpInstrumentation';

export default class LumigoHttpsInstrumentation extends LumigoHttpInstrumentation {
  override getInstrumentationId(): string {
    return 'https';
  }
}
