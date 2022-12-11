import fs from "fs";

export function getInstrumentationSpansFromFile(filePath: string) {
    const allFileContents = fs.readFileSync(filePath, 'utf-8');
    const lines = allFileContents.split(/\r?\n/).filter((l) => l !== '');
    const spansWithoutWaitOnCall = lines.slice(1, lines.length)
    if (
        spansWithoutWaitOnCall.length === 2 &&
        spansWithoutWaitOnCall[0].startsWith('{"traceId"') &&
        spansWithoutWaitOnCall[1].startsWith('{"traceId"')
    ) {
        return spansWithoutWaitOnCall
    }
}

export const expectedResourceAttributes = {
    attributes: {
        "service.name": "http",
        "telemetry.sdk.language": "nodejs",
        "telemetry.sdk.name": "opentelemetry",
        "telemetry.sdk.version":expect.any(String),
        "framework": "node",
        'process.environ': expect.jsonMatching(
            expect.objectContaining({
                "OTEL_SERVICE_NAME": "http",
                "LUMIGO_TRACER_TOKEN": "****",
                "LUMIGO_ENDPOINT" :"https://walle-edge-app-us-west-2.walle.golumigo.com"
            })),
        'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
        'process.pid': expect.any(Number),
        "process.executable.name": "node",
        'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
        "process.runtime.name": "nodejs",
        "process.runtime.description": "Node.js",
    }
};

export const internalSpanAttributes = {
    'http.host': expect.stringMatching(/localhost:\d+/),
    'net.host.name': 'localhost',
    'http.method': 'GET',
    'http.user_agent': 'axios/0.21.4',
    'http.flavor': '1.1',
    'net.transport': 'ip_tcp',
    "net.host.ip": expect.any(String),
    'net.host.port': expect.any(Number),
    "net.peer.ip": expect.any(String),
    'net.peer.port': expect.any(Number),
    'http.status_code': 200,
    'http.status_text': 'OK',
    "http.url": expect.stringMatching(/http:\/\/localhost:\d+\/test/),
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
    'http.request.headers': expect.stringMatching(/{.*}/),
    'http.response.headers': expect.stringMatching(/{.*}/),
    'http.response.body': expect.jsonMatching(["animal", "career", "celebrity", "dev", "explicit", "fashion", "food", "history", "money", "movie", "music", "political", "religion", "science", "sport", "travel"]),
};

