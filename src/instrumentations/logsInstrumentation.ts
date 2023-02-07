import {
  InstrumentationBase,
  InstrumentationModuleDefinition,
  InstrumentationNodeModuleDefinition,
} from '@opentelemetry/instrumentation';
import { SpanKind } from '@opentelemetry/api';

import { logger } from '../logging';

export default class LogsInstrumentation extends InstrumentationBase<any> {
  instrumentationDescription: string;
  supportedVersions: string[];

  constructor() {
    super('logs-instrumentation', '0.0.1');
  }

  protected init():
    | InstrumentationModuleDefinition<any>
    | InstrumentationModuleDefinition<any>[]
    | void {
    logger.debug('in console instrumentation');

    return [
      new InstrumentationNodeModuleDefinition<any>(
        'console',
        ['*'],
        (moduleExports, moduleVersion) => {
          const instrumentation = this;
          this._wrap(moduleExports, 'warn', this.logsWrapper(instrumentation, 'warn'));
          this._wrap(moduleExports, 'error', this.logsWrapper(instrumentation, 'error'));
          return moduleExports;
        },
        (exports) => {},
        []
      ),
    ];
  }
  private logsWrapper = (instrumentation, level) => {
    return (original) => {
      return (
        // eslint-disable-next-line node/no-unsupported-features/node-builtins
        message,
        options
      ) => {
        let result;
        let stringifyOptions;
        try {
          stringifyOptions = JSON.stringify(options);
        } catch (e) {}
        instrumentation.tracer.startActiveSpan(
          'logs-span',
          {
            kind: SpanKind.INTERNAL,
            attributes: { log: message, level, options: stringifyOptions },
          },
          (span) => {
            span.end();
            return span;
          }
        );
        result = options
          ? original.apply(this, [message, options])
          : original.apply(this, [message]);
        return result;
      };
    };
  };
}
