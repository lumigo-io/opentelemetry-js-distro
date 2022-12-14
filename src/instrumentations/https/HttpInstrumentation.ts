import { HttpInstrumentation, IgnoreMatcher } from '@opentelemetry/instrumentation-http';

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

  getInstrumentationId(): string {
    return 'http';
  }

  getInstrumentation(): HttpInstrumentation {
    const ignoreConfig = this.getIgnoreConfig();

    return new HttpInstrumentation({
      ignoreOutgoingUrls: ignoreConfig,
      ignoreIncomingPaths: [],
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
  }

  private getIgnoreConfig(): IgnoreMatcher[] {
    return [
      (url: string) => this.ignoredHostnames.includes(new URL(url).hostname),
      // Unroutable addresses, used by metadata services on all clouds
      /169\.254\.\d+\.\d+.*/gm,
    ];
  }
}
