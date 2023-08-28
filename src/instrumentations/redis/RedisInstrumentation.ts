import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import { Span } from '@opentelemetry/api';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { getSpanAttributeMaxLength } from '../../utils';
import { Instrumentor } from '../instrumentor';

export default class LumigoRedisInstrumentation extends Instrumentor<RedisInstrumentation> {
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
          `redis.response.body`,
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
