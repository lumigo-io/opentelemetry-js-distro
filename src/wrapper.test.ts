import * as api from '@opentelemetry/api';
import * as otlp from '@opentelemetry/exporter-trace-otlp-http';
import * as exporters from './exporters';
import * as detectors from './resources/detectors';

jest.mock('@opentelemetry/api');
jest.mock('@opentelemetry/exporter-trace-otlp-http');
jest.mock('./exporters');


const TOKEN = 't_10faa5e13e7844aaa1234';
const ENDPOINT = 'http://ec2-34-215-6-94.us-west-2.compute.amazonaws.com:55681/v1/trace';

describe('Distro initialization', () => {

  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV }; // Make a copy of env so that we can alter it in tests
  });

  afterEach(() => {
    process.env = OLD_ENV; // Restore old environment
    jest.resetAllMocks();
  });

  describe('with the \'LUMIGO_SWITCH_OFF\' environment variable set to \'true\'', () => {

    it('should not invoke \'initializeTracer\'', async () => {
      process.env.LUMIGO_SWITCH_OFF='true';

      jest.isolateModules(async () => {
        const wrapper = require('./wrapper');

        const sdkInitialized = await wrapper.sdkInit;

        expect(sdkInitialized).toBe(false);
        expect(api.diag.info).toBeCalledWith('Lumigo is switched off, tracer will not be initialized');
      });

    });

  });

  describe('with no an error occurring in a detector', () => {

    it('should reject the init promise', async () => {
      jest.isolateModules(async () => {
        jest.spyOn(detectors.AwsEcsDetector.prototype, 'detect').mockImplementation(config => {
          return Promise.reject(new Error("YOLO!"));
        });

        const wrapper = require('./wrapper');

        try {
          await wrapper.sdkInit;
          throw new Error('The SDK init should have failed!')
        } catch (error) {
          // Good case
        }

        expect(api.diag.error).toBeCalledWith('Error initializing Lumigo tracer: %e', new Error("YOLO!"));  
        expect(otlp.OTLPTraceExporter).not.toBeCalled();
      });
    });

  });

  describe('with no \'LUMIGO_TRACER_TOKEN\' environment variable set', () => {

    it('should warn that no data will be sent to Lumigo', async () => {
      jest.isolateModules(async () => {
        const wrapper = require('./wrapper');

        const sdkInitialized = await wrapper.sdkInit;

        expect(sdkInitialized).toBe(true);
        expect(api.diag.warn).toBeCalledWith("Lumigo token not provided (env var 'LUMIGO_TRACER_TOKEN' not set); no data will be sent to Lumigo");  
        expect(otlp.OTLPTraceExporter).not.toBeCalled();
      });
    });

  });

  describe('with the \'LUMIGO_TRACER_TOKEN\' environment variable set', () => {

    beforeEach(() => {
      process.env.LUMIGO_TRACER_TOKEN = TOKEN;
    });

    it('should initialize an OTLPTraceExporter', async () => {
      jest.isolateModules(async () => {
        const wrapper = require('./wrapper');

        const sdkInitialized = await wrapper.sdkInit;

        expect(sdkInitialized).toBe(true);
        expect(otlp.OTLPTraceExporter).toBeCalledWith({
          url: 'https://ga-otlp.lumigo-tracer-edge.golumigo.com/v1/traces',
          headers: {
            'Authorization': `LumigoToken ${TOKEN}`
          }
        });
        expect(api.diag.debug).toBeCalledWith('Lumigo tracer initialized');
      });
    });

    describe('with the \'LUMIGO_ENDPOINT\' environment variable set', () => {

      beforeEach(() => {
        process.env.LUMIGO_ENDPOINT = ENDPOINT;
      });

      it('should initialize an OTLPTraceExporter', async () => {
        jest.isolateModules(async () => {
          const wrapper = require('./wrapper');
  
          const sdkInitialized = await wrapper.sdkInit;

          expect(sdkInitialized).toBe(true);
          expect(otlp.OTLPTraceExporter).toBeCalledWith({
            url: ENDPOINT,
            headers: {
              'Authorization': `LumigoToken ${TOKEN}`
            }
          });
          expect(api.diag.debug).toBeCalledWith('Lumigo tracer initialized');
        });
      });

    });

  });

  describe('with \'LUMIGO_DEBUG_SPANDUMB\' environment variable set', () => {

    beforeEach(() => {
      process.env.LUMIGO_DEBUG_SPANDUMP = 'test.json';
    });

    it('should initialize a FileSpanExporter', async () => {
      jest.isolateModules(async () => {
        const wrapper = require('./wrapper');

        const sdkInitialized = await wrapper.sdkInit;

        expect(sdkInitialized).toBe(true);
        expect(exporters.FileSpanExporter).toBeCalledWith('test.json');
        expect(api.diag.debug).toBeCalledWith('Lumigo tracer initialized');
      });
    });
    
  });

});