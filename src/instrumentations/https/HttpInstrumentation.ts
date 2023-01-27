import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

import { HttpHooks } from './http';
import { Instrumentor } from '../instrumentor';
import { RequestOptions } from 'https';

export default class LumigoHttpInstrumentation extends Instrumentor<HttpInstrumentation> {
  private readonly ignoredHostnames: string[];

  constructor(...ignoredHostnames: string[]) {
    super();

    this.ignoredHostnames = (ignoredHostnames || [])
      .concat(
        [process.env.ECS_CONTAINER_METADATA_URI, process.env.ECS_CONTAINER_METADATA_URI_V4]
          .filter(Boolean)
          .map((url) => {
            try {
              return new URL(url).hostname;
            } catch (err) {
              return;
            }
          })
      )
      // Unroutable addresses, used by metadata services on all clouds
      .concat('169.254.169.254');
  }

  getInstrumentedModule(): string {
    return 'http';
  }

  getInstrumentation = (): HttpInstrumentation =>
    new HttpInstrumentation({
      ignoreOutgoingRequestHook: (request: RequestOptions) =>
        this.ignoredHostnames.includes(request.hostname),
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
}
