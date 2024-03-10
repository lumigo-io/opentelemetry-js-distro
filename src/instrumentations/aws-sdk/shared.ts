import { AwsOtherService, AwsParsedService, SupportedAwsServices } from '../../spans/types';

export const isAwsInstrumentationSpanActive = (): boolean =>
  process.env._LUMIGO_AWS_INSTRUMENTATION_SPAN_ACTIVE === 'true';

export const setAwsInstrumentationSpanActive = (status: boolean) =>
  (process.env._LUMIGO_AWS_INSTRUMENTATION_SPAN_ACTIVE = status.toString());

const LUMIGO_AWS_INSTRUMENTATION_SUPPORTED_SERVICE_TYPES: SupportedAwsServices[] = [
  AwsParsedService.SQS,
  AwsOtherService.ElasticBeanstalkSqsDaemon,
];

export const isServiceSupportedByLumigoAwsSdkInstrumentation = (
  serviceType: SupportedAwsServices
): boolean => LUMIGO_AWS_INSTRUMENTATION_SUPPORTED_SERVICE_TYPES.includes(serviceType);
