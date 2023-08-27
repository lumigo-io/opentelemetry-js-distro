import { CommonUtils, ScrubContext } from '@lumigo/node-core';
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
    });
  }
}
