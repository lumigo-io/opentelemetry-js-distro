const fs = require("fs");

export const expectedResourceAttributes = {
    attributes: {
        'service.name': 'express',
        'telemetry.sdk.language': 'nodejs',
        'telemetry.sdk.name': 'opentelemetry',
        'telemetry.sdk.version':  expect.any(String),
        framework: 'express',
        'process.environ': expect.jsonMatching(
            expect.objectContaining({
                "OTEL_SERVICE_NAME": "express",
            })),
        'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
        'process.pid': expect.any(Number),
        'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
        'process.runtime.name': 'nodejs',
        'process.executable.name': 'node',
    },
};

export const expectedServerAttributes = {
    'http.method': 'GET',
    'http.target': '/invoke-requests',
    'http.flavor': '1.1',
    'http.host': expect.stringMatching(/localhost:\d+/),
    'http.scheme': 'http',
    'net.peer.ip': '::ffff:127.0.0.1',
    'http.request.query': '{}',
    'http.request.headers': expect.stringMatching(/\{.*\}/),
    'http.response.headers': expect.stringMatching(/\{.*\}/),
    'http.response.body': expect.jsonMatching(["animal", "career", "celebrity", "dev", "explicit", "fashion", "food", "history", "money", "movie", "music", "political", "religion", "science", "sport", "travel"]),
    'http.request.body': '{}',
    'http.route': '/invoke-requests',
    'express.route.full': '/invoke-requests',
    'express.route.configured': '/invoke-requests',
    'express.route.params': '{}',
    'http.status_code': 200,
};

export const internalSpanAttributes = {
    'http.url': expect.stringMatching(/http:\/\/localhost:\d+\/invoke-requests/),
    'http.host': expect.stringMatching(/localhost:\d+/),
    'net.host.name': 'localhost',
    'http.method': 'GET',
    'http.target': '/invoke-requests',
    'http.user_agent': 'axios/0.21.4',
    'http.flavor': '1.1',
    'net.transport': 'ip_tcp',
    'net.host.ip': '::ffff:127.0.0.1',
    'net.host.port': expect.any(Number),
    'net.peer.ip': '::ffff:127.0.0.1',
    'net.peer.port': expect.any(Number),
    'http.status_code': 200,
    'http.status_text': 'OK',
    'http.route': '/invoke-requests',
};

export const expectedClientAttributes = {
    'http.url': 'https://api.chucknorris.io/jokes/categories',
    'http.method': 'GET',
    'http.target': '/jokes/categories',
    'net.peer.name': 'api.chucknorris.io',
    'http.request.body': '""',
    'net.peer.ip': expect.stringMatching(
        /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$)){4}\b/
    ),
    'net.peer.port': 443,
    'http.host': 'api.chucknorris.io:443',
    'http.status_code': 200,
    'http.status_text': 'OK',
    'http.flavor': '1.1',
    'http.request.headers': expect.stringMatching(/\{.*\}/),
    'http.response.headers': expect.stringMatching(/\{.*\}/),
    'http.response.body': expect.stringMatching(
        /\["animal","career","celebrity","dev","explicit","fashion","food","history","money","movie","music","political","religion","science","sport","travel"\]/
    ),
};

export function getInstrumentationSpansFromFile(filePath) {
    const allFileContents = fs.readFileSync(filePath, 'utf-8');
    const lines = allFileContents.split(/\r?\n/).filter((l) => l !== '');
    const spansWithoutWaitOnCall = lines.slice(2, lines.length)
    if (
        spansWithoutWaitOnCall.length === 3 &&
        spansWithoutWaitOnCall[0].startsWith('{"traceId"') &&
        spansWithoutWaitOnCall[1].startsWith('{"traceId"') &&
        spansWithoutWaitOnCall[2].startsWith('{"traceId"')
    ) {
        return spansWithoutWaitOnCall
    }
}