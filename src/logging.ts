import { diag, DiagLogLevel, DiagConsoleLogger } from '@opentelemetry/api';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      LUMIGO_DEBUG?: string;
    }
  }
}

export const logger = diag.createComponentLogger({
  namespace: '@lumigo/opentelemetry',
});

diag.setLogger(
  new DiagConsoleLogger(),
  {
    logLevel: process.env.LUMIGO_DEBUG?.toLowerCase() === 'true' ? DiagLogLevel.DEBUG : DiagLogLevel.INFO,
    suppressOverrideMessage: true,  // This removes noise from tests
  },
);
