import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { Instrumentor } from '../instrumentor';

export default class LumigoGrpcInstrumentation extends Instrumentor<GrpcInstrumentation> {
  getInstrumentedModule(): string {
    return '@grpc/grpc-js';
  }

  getInstrumentation(): GrpcInstrumentation {
    return new GrpcInstrumentation();
  }
}
