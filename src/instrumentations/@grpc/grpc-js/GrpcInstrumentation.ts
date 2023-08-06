import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { Instrumentor } from '../../instrumentor';
import { wrapServer } from './wrapGrpcServer';
import { wrapClient } from './wrapGrpcClient';

export default class LumigoGrpcInstrumentation extends Instrumentor<GrpcInstrumentation> {
  getInstrumentedModule(): string {
    return '@grpc/grpc-js';
  }

  getInstrumentation(): GrpcInstrumentation {
    wrapClient();
    wrapServer();
    return new GrpcInstrumentation();
  }
}
