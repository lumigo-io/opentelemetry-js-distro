import { FileSpanExporter } from '.';
import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Span, SpanKind } from '@opentelemetry/api';

import * as assert from 'assert';
import fs from 'fs';
import tmp from 'tmp';

describe('FileSpanExporter', () => {
    let provider: BasicTracerProvider;

    describe('creating no spans', () => {

        it('should not write anything to file', () => {
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: 'test-FileSpanExporter-', postfix: 'json' });

            const exporterUnderTest = new FileSpanExporter(tmpFile.name);
            provider = new BasicTracerProvider();
            provider.addSpanProcessor(new SimpleSpanProcessor(exporterUnderTest));

            exporterUnderTest.shutdown()
            assert.strictEqual(fs.statSync(tmpFile.name).size, 0)
        })
    })

    describe('creating one span', () => {

        it('should write one line of JSON to file', async () => {
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: 'test-FileSpanExporter-', postfix: 'json' });

            const exporterUnderTest = new FileSpanExporter(tmpFile.name);
            provider = new BasicTracerProvider();
            provider.addSpanProcessor(new SimpleSpanProcessor(exporterUnderTest));

            const root: Span = provider.getTracer('default').startSpan('root');
            root.setAttribute('foo', 'bar');
            root.end();

            await provider.shutdown();

            const spans = getSpans(tmpFile.name);

            assert.strictEqual(spans.length, 1);

            const span = spans[0]
            assert.equal(span['name'], 'root')
            assert.deepEqual(span['attributes'], {'foo': 'bar'})
        })
    })

    describe('creating two spans', () => {

        it('should write two lines of JSON to file', async () => {
            const tmpFile = tmp.fileSync({ mode: 0o644, prefix: 'test-FileSpanExporter-', postfix: 'json' });

            const exporterUnderTest = new FileSpanExporter(tmpFile.name);
            provider = new BasicTracerProvider();
            provider.addSpanProcessor(new SimpleSpanProcessor(exporterUnderTest));

            const tracer = provider.getTracer('default');

            const root: Span = tracer.startSpan('root', {
                kind: SpanKind.SERVER,                
            });
            root.setAttribute('foo', 'bar');

            const child: Span = tracer.startSpan('child', {
                kind: SpanKind.CLIENT,
            });
            child.setAttribute('fooz', 'baz');
            child.end();

            root.end();

            await provider.shutdown();

            const spans = getSpans(tmpFile.name);

            assert.strictEqual(spans.length, 2);

            // Inverted order because we close child before root
            const rootSpan = spans[1]
            assert.equal(rootSpan['name'], 'root')
            assert.equal(rootSpan['kind'], SpanKind.SERVER)
            assert.deepEqual(rootSpan['attributes'], {'foo': 'bar'})

            const childSpan = spans[0]
            assert.equal(childSpan['parentId'], root['id'])
            assert.equal(childSpan['name'], 'child')
            assert.equal(childSpan['kind'], SpanKind.CLIENT)
            assert.deepEqual(childSpan['attributes'], {'fooz': 'baz'})
        })
    })

});

function getSpans(filename: string): Object[] {
    return fs.readFileSync(filename).toString().split('\n').filter(line => line.length > 0).map(line => JSON.parse(line));
}
