import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import type { Span } from '@opentelemetry/api';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { getSpanAttributeMaxLength } from '../../utils';
import { TracingInstrumentor } from '../instrumentor';

export default class LumigoIORedisInstrumentation extends TracingInstrumentor<IORedisInstrumentation> {
  override isApplicable(): boolean {
    return (
      super.isApplicable() &&
      process.env.LUMIGO_DISABLE_IOREDIS_INSTRUMENTATION?.toLocaleLowerCase() !== 'true'
    );
  }

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
