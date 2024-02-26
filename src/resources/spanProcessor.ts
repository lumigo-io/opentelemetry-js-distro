import {
  BatchSpanProcessor,
  ReadableSpan,
  Span as MutableSpan,
} from '@opentelemetry/sdk-trace-base';
import { logger } from '../logging';

export class LumigoSpanProcessor extends BatchSpanProcessor {
  override onEnd(span: ReadableSpan) {
    if (shouldSkipSpanExport(span)) {
      logger.debug('Not exporting span because it has NO_EXPORT=true attribute');
      return;
    }

    super.onEnd(span);
  }
}

/**
 * Given a readable span, returns true if the span should be skipped from export
 * @param span A readable span to check
 */
export const shouldSkipSpanExport = (span: ReadableSpan): boolean => {
  return span.attributes && span.attributes.SKIP_EXPORT === true;
};

/**
 * Returns the span attributes that need to be added to a span in order for it to be skipped.
 * @param skipExport (Default true) should the span be skipped from export.
 *                   you can set it to false in order to explicitly not skip exporting a span
 */
export const getSpanSkipExportAttributes = (skipExport = true) => {
  return {
    SKIP_EXPORT: skipExport,
  };
};

export const setSpanAsNotExportable = (span: MutableSpan) => {
  span.setAttributes(getSpanSkipExportAttributes());
};
