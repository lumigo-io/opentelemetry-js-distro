import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import { Span } from '@opentelemetry/api';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { getSpanAttributeMaxLength } from '../../utils';
import { Instrumentor } from '../instrumentor';

export default class LumigoIORedisInstrumentation extends Instrumentor<IORedisInstrumentation> {
  getInstrumentedModule(): string {
    return 'ioredis';
  }

  getInstrumentation(): IORedisInstrumentation {
    return new IORedisInstrumentation({
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
            response?.toString(),
            ScrubContext.HTTP_RESPONSE_BODY,
            getSpanAttributeMaxLength()
          )
        );
      },
      requireParentSpan: false,
    });
  }
}
