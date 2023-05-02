import { diag, DiagLogLevel, DiagConsoleLogger } from '@opentelemetry/api';
import { LUMIGO_LOGGING_NAMESPACE } from './constants';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      LUMIGO_DEBUG?: string;
    }
  }
}

export const logger = diag.createComponentLogger({
  namespace: LUMIGO_LOGGING_NAMESPACE,
});

diag.setLogger(
  new DiagConsoleLogger(),
  {
    logLevel: process.env.LUMIGO_DEBUG?.toLowerCase() === 'true' ? DiagLogLevel.DEBUG : DiagLogLevel.INFO,
    suppressOverrideMessage: true, // Suppress noise in logs
  }
);
