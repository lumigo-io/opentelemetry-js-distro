import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import type { Span } from '@opentelemetry/api';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { getSpanAttributeMaxLength } from '../../utils';
import { TracingInstrumentor } from '../instrumentor';

export default class LumigoRedisInstrumentation extends TracingInstrumentor<RedisInstrumentation> {
  override isApplicable(): boolean {
    return (
      super.isApplicable() &&
      process.env.LUMIGO_DISABLE_REDIS_INSTRUMENTATION?.toLocaleLowerCase() !== 'true'
    );
  }

  getInstrumentedModule(): string {
    return 'redis';
  }

  getInstrumentation(): RedisInstrumentation {
    return new RedisInstrumentation({
      dbStatementSerializer: function (cmdName, cmdArgs) {
        const statement = [cmdName, ...cmdArgs].join(' ');
        return CommonUtils.payloadStringify(
          statement,
          ScrubContext.HTTP_REQUEST_BODY,
          getSpanAttributeMaxLength()
        );
      },
      responseHook: (
        span: Span,
        cmdName: string,
        cmdArgs: (string | Buffer)[],
        response: unknown
      ) => {
        span.setAttribute(
          `db.response.body`,
          CommonUtils.payloadStringify(
            response,
            ScrubContext.HTTP_RESPONSE_BODY,
            getSpanAttributeMaxLength()
          )
        );
      },
    });
  }
}
