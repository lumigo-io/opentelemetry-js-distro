import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

import { HttpHooks } from './http';
import { Instrumentor } from '../instrumentor';
import { RequestOptions } from 'https';

export default class LumigoHttpInstrumentation extends Instrumentor<HttpInstrumentation> {
  private readonly ignoredHostnames: string[];

  constructor(...ignoredHostnames: string[]) {
    super();

    this.ignoredHostnames = (ignoredHostnames || []).concat(
      [process.env.ECS_CONTAINER_METADATA_URI, process.env.ECS_CONTAINER_METADATA_URI_V4]
        .filter(Boolean)
        .map((url) => {
          try {
            return new URL(url).hostname;
          } catch (err) {
            return;
          }
        })
    );
  }

  getInstrumentedModule(): string {
    return 'http';
  }

  getInstrumentation = (): HttpInstrumentation =>
    new HttpInstrumentation({
      ignoreOutgoingRequestHook: (request: RequestOptions) =>
        this.ignoredHostnames.includes(request.hostname) ||
        // Unroutable addresses, used by metadata and credential services on all clouds
        /169\.254\.\d+\.\d+.*/gm.test(request.hostname),
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
}
