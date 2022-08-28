import { HttpInstrumentation, IgnoreMatcher } from '@opentelemetry/instrumentation-http';

import { HttpHooks } from './http';
import { Instrumentor } from '../instrumentor';

export default class LumigoHttpInstrumentation extends Instrumentor<HttpInstrumentation> {
  getInstrumentationId(): string {
    return 'http';
  }

  getInstrumentation(): HttpInstrumentation {
    return new HttpInstrumentation({
      ignoreOutgoingUrls: this.getIgnoreConfig(),
      ignoreIncomingPaths: this.getIgnoreConfig(),
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
  }

  private getIgnoreConfig(): IgnoreMatcher[] {
    return [
      (url: string) =>
        [
          process.env.LUMIGO_ENDPOINT,
          process.env.ECS_CONTAINER_METADATA_URI,
          process.env.ECS_CONTAINER_METADATA_URI_V4,
        ]
          .filter(Boolean)
          .some((v) => url.includes(v)),
      /169\.254\.\d+\.\d+.*/gm,
    ];
  }
}
