import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

import {
    LumigoSpanProcessor,
    shouldSkipSpanExport,
    getSpanSkipExportAttributes
} from "./spanProcessor";

describe('span processor', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    [
        {
            attributes: {'SKIP_EXPORT': true},
            shouldSkip: true,
        },
        {
            attributes: {'SKIP_EXPORT': false},
            shouldSkip: false,
        },
        {
            attributes: {'SKIP_EXPORT': 'not a boolean'},
            shouldSkip: false
        },
        {
            // This is the string "true", not a boolean value
            attributes: {'SKIP_EXPORT': 'true'},
            shouldSkip: false
        },
        {
            attributes: {'SKIP_EXPORT': null},
            shouldSkip: false
        },
        {
            attributes: {'SKIP_EXPORT': undefined},
            shouldSkip: false
        },
        {
            attributes: {},
            shouldSkip: false
        },
    ].map(({attributes, shouldSkip}) => {
        test('test should skip span export logic', () => {
            const readableSpan = { attributes };
            expect(shouldSkipSpanExport(readableSpan)).toEqual(shouldSkip);
        });
    });

    test('test get span skip export attributes', () => {
        expect(getSpanSkipExportAttributes()).toEqual({'SKIP_EXPORT': true});
        expect(getSpanSkipExportAttributes(true)).toEqual({'SKIP_EXPORT': true});
        expect(getSpanSkipExportAttributes(false)).toEqual({'SKIP_EXPORT': false});
    });

    [true, false].map((mockShouldSkipResult) => {
        test('test span processor checks skip attribute', () => {
            // Here we mock the parent class `onEnd` function. If the span was skipped this func shouldn't have been called
            const spySuperOnEnd = jest.spyOn(BatchSpanProcessor.prototype, 'onEnd').mockImplementation();

            const processor = new LumigoSpanProcessor();

            expect(spySuperOnEnd).not.toHaveBeenCalled();
            processor.onEnd({attributes: {SKIP_EXPORT: mockShouldSkipResult}});
            if (mockShouldSkipResult) {
                expect(spySuperOnEnd).not.toHaveBeenCalled();
            }
            else {
                expect(spySuperOnEnd).toHaveBeenCalled();
            }
        });
    });
});