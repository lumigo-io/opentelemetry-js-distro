import fs from 'fs';

export function getSpanByName(spans, spanName) {
    return spans.find((span) => span.name === spanName);
}

export function getInstrumentationSpansFromFile(filePath) {
    const allFileContents = fs.readFileSync(filePath, 'utf-8');
    const lines = allFileContents.split(/\r?\n/).filter((l) => l !== '');
    if (
        lines.length > 2 &&
        lines[0].startsWith('{"traceId"') &&
        lines[1].startsWith('{"traceId"') &&
        lines.filter((line) => line.includes('"name":"mongodb') && !line.includes('mongodb.isMaster')).length === 5
    ) {
        return lines
    }
}

export function getExpectedResourceAttributes() {
    return {
        'service.name': 'mongodb',
        'telemetry.sdk.language': 'nodejs',
        'telemetry.sdk.name': 'opentelemetry',
        'telemetry.sdk.version':  expect.any(String),
        'framework': 'node',
        'process.environ': expect.jsonMatching(
            expect.objectContaining({
                'OTEL_SERVICE_NAME': 'mongodb',
            })),
        'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
        'process.pid': expect.any(Number),
        'process.executable.name': 'node',
        'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
        'process.runtime.name': 'nodejs',
        'process.runtime.description': 'Node.js',
    };
}

export function getExpectedSpan(nameSpanAttr, resourceAttributes, dbStatement) {
    return {
        traceId: expect.any(String),
        id: expect.any(String),
        timestamp: expect.any(Number),
        duration: expect.any(Number),
        name: nameSpanAttr,
        kind: 2,
        resource: {
            attributes: resourceAttributes
        },
        attributes: {
            'db.system': 'mongodb',
            'db.name': 'myProject',
            'db.mongodb.collection': 'insertOne',
            'db.statement': dbStatement,
        },
        status: {
            code: 0,
        },
        events: [],
    };
}

export function getExpectedSpanWithParent(nameSpanAttr, resourceAttributes, dbStatement, dbCollection='insertOne') {
    return {
        traceId: expect.any(String),
        parentId: expect.any(String),
        id: expect.any(String),
        timestamp: expect.any(Number),
        duration: expect.any(Number),
        name: nameSpanAttr,
        kind: 2,
        resource: {
            attributes: resourceAttributes
        },
        attributes: {
            'db.system': 'mongodb',
            'db.name': 'myProject',
            'db.mongodb.collection': dbCollection,
            'db.statement': dbStatement,
        },
        status: {
            code: 0,
        },
        events: [],
    };
}

export function getFilteredSpans(spans) {
    return spans.filter(span => span.name.includes('mongodb') && !span.name.includes('mongodb.isMaster'));
}