import { RequestOptions } from 'https';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

import { HttpHooks } from './http';
import { Instrumentor } from '../instrumentor';

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

  getInstrumentedModule = () => 'http';

  getInstrumentation = () =>
    new HttpInstrumentation({
      ignoreOutgoingRequestHook: (request: RequestOptions) => {
        /*
         * Some requests, like towards the ECS Credentials endpoints, do not have the
         * hostname set, but they do have the host
         */
        const requestHostname = request.hostname || request.host;
        const isRequestIgnored =
          this.ignoredHostnames.includes(requestHostname) ||
          // Unroutable addresses, used by metadata and credential services on all clouds
          /169\.254\.\d+\.\d+.*/gm.test(requestHostname);

        return isRequestIgnored;
      },
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
}
