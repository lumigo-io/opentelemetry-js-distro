import {ChildProcess} from "child_process";
import {InstrumentationTest} from "../../helpers/InstrumentationTest";
import {callContainer} from "../../helpers/helpers";
import {getReadyServer, getReadySpans} from "./httpTestUtils";


class HttpInstrumentationTest implements InstrumentationTest {
    isChildProcessReadyPredicate(data: any, nodeChildApp: ChildProcess, resolve, reject): void {
        getReadyServer(data, resolve);
    }

    getEnvVars(){
        return {}
    }

    onChildProcessReady(): Promise<void> {
        return callContainer(8000, 'test', 'get');
    }

    spansReadyCondition(lines: string[], resolve): void {
        getReadySpans(lines, resolve);
    }

    getName() {
        return "http" //should be the same as package.json script middle name "start:http:injected"
    }

    runTests(spans: any[]): void {
        expect(spans).toHaveLength(2);
        const internalSpan = spans.find((span) => span.kind === 1);
        const clientSpan = spans.find((span) => span.kind === 2);
        expect(internalSpan).toMatchObject({
            traceId: expect.any(String),
            id: expect.any(String),
            timestamp: expect.any(Number),
            duration: expect.any(Number),
            name: 'HTTP GET',
            kind: 1,
            resource: {
                attributes: {
                    "service.name": "http-js",
                    "telemetry.sdk.language": "nodejs",
                    "telemetry.sdk.name": "opentelemetry",
                    "telemetry.sdk.version": "1.1.1",
                    "framework": "node",
                    'process.environ': expect.jsonMatching(
                        expect.objectContaining({
                            "OTEL_SERVICE_NAME": "http-js",
                            "LUMIGO_TRACER_TOKEN": "t_123321",
                        })),
                    'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
                    'process.pid': expect.any(Number),
                    "process.executable.name": "node",
                    'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
                    "process.runtime.name": "nodejs",
                    "process.runtime.description": "Node.js",
                }
            },
            attributes: {
                'http.host': expect.stringMatching(/localhost:\d+/),
                'net.host.name': 'localhost',
                'http.method': 'GET',
                'http.user_agent': 'axios/0.21.4',
                'http.flavor': '1.1',
                'net.transport': 'ip_tcp',
                "net.host.ip": "127.0.0.1",
                'net.host.port': expect.any(Number),
                "net.peer.ip": "127.0.0.1",
                'net.peer.port': expect.any(Number),
                'http.status_code': 200,
                'http.status_text': 'OK',
                "http.url": "http://localhost:8000/test",
            },
            status: {
                code: 0,
            },
            events: [],
        });
        expect(clientSpan).toMatchObject({
            traceId: expect.any(String),
            parentId: expect.any(String),
            id: expect.any(String),
            timestamp: expect.any(Number),
            duration: expect.any(Number),
            name: 'HTTPS GET',
            kind: 2,
            attributes: {
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
            },
            status: {
                code: 0,
            },
            events: [],
        });
    }
}

class HttpSpanAttrLengthTest implements InstrumentationTest {
    isChildProcessReadyPredicate(data: any, nodeChildApp: ChildProcess, resolve, reject): void {
        getReadyServer(data, resolve);
    }

    onChildProcessReady(): Promise<void> {
        return callContainer(8000, 'test', 'get');
    }

    spansReadyCondition(lines: string[], resolve): void {
        getReadySpans(lines, resolve);
    }

    getEnvVars(){
        return {
            OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: "1"
        }
    }

    getName() {
        return "http"
    }

    runTests(spans: any[]): void {
        expect(spans).toHaveLength(2);
        const internalSpan = spans.find((span) => span.kind === 1);
        const clientSpan = spans.find((span) => span.kind === 2);
        expect(Object.values(JSON.parse(internalSpan.resource.attributes["process.environ"])).join("").length).toBeLessThanOrEqual(1);
        expect(internalSpan.attributes).toMatchObject(
            {
                'http.host': "l",
                'net.host.name': 'l',
                'http.method': 'G',
                'http.user_agent': 'a',
                'http.flavor': '1',
                'net.transport': 'i',
                "net.host.ip": "1",
                'net.host.port': expect.any(Number),
                "net.peer.ip": "1",
                'net.peer.port': expect.any(Number),
                'http.status_code': 200,
                'http.status_text': 'O',
                "http.url": "h",
            }
        )
        expect(clientSpan.attributes).toMatchObject(
            {
                'http.url': 'h',
                'http.method': 'G',
                'http.target': '/',
                'net.peer.name': 'a',
                'http.request.body': '"',
                'net.peer.ip': "1",
                'net.peer.port': 443,
                'http.host': 'a',
                'http.status_code': 200,
                'http.status_text': 'O',
                'http.flavor': '1',
                'http.request.headers': "{",
                'http.response.headers': "{",
                'http.response.body': '"',
            }
        )
    }
}

class HttpAttrLengthTest implements InstrumentationTest {
    isChildProcessReadyPredicate(data: any, nodeChildApp: ChildProcess, resolve, reject): void {
        getReadyServer(data, resolve);
    }

    onChildProcessReady(): Promise<void> {
        return callContainer(8000, 'large-response', 'get');
    }

    getEnvVars(){
        return {
            OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT: "3"
        }
    }

    spansReadyCondition(lines: string[], resolve): void {
        getReadySpans(lines, resolve);
    }

    getName() {
        return "http"
    }

    runTests(spans: any[]): void {
        expect(spans).toHaveLength(2);
        const internalSpan = spans.find((span) => span.kind === 1);
        const clientSpan = spans.find((span) => span.kind === 2);
        expect(Object.values(JSON.parse(internalSpan.resource.attributes["process.environ"])).join("").length).toBeLessThanOrEqual(3);
        expect(internalSpan.attributes).toMatchObject(
            {
                'http.host': "loc",
                'net.host.name': 'loc',
                'http.method': 'GET',
                'http.user_agent': 'axi',
                'http.flavor': '1.1',
                'net.transport': 'ip_',
                "net.host.ip": "127",
                'net.host.port': expect.any(Number),
                "net.peer.ip": "127",
                'net.peer.port': expect.any(Number),
                'http.status_code': 200,
                'http.status_text': 'OK',
                "http.url": "htt",
            }
        )
        expect(clientSpan.attributes).toMatchObject(
            {
                'http.url': 'htt',
                'http.method': 'GET',
                'http.target': '/en',
                'net.peer.name': 'api',
                'http.request.body': '""',
                'net.peer.ip': expect.stringMatching(
                    /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$))\b/
                ),
                'net.peer.port': 443,
                'http.host': 'api',
                'http.status_code': 200,
                'http.status_text': 'OK',
                'http.flavor': '1.1',
                'http.request.headers': '{"a',
                'http.response.headers': '{"a',
                'http.response.body': '"{\\',
            }
        )
    }
}

class HttpDefaultAttrLengthTest implements InstrumentationTest {
    isChildProcessReadyPredicate(data: any, nodeChildApp: ChildProcess, resolve, reject): void {
        getReadyServer(data, resolve);
    }

    onChildProcessReady(): Promise<void> {
        return callContainer(8000, 'large-response', 'get');
    }

    spansReadyCondition(lines: string[], resolve): void {
        getReadySpans(lines, resolve);
    }

    getEnvVars(){
        return {}
    }

    getName() {
        return "http"
    }

    runTests(spans: any[]): void {
        expect(spans).toHaveLength(2);
        const internalSpan = spans.find((span) => span.kind === 1);
        const clientSpan = spans.find((span) => span.kind === 2);
        expect(internalSpan.attributes).toMatchObject(
            {
                'http.host': "localhost:8000",
                'net.host.name': "localhost",
                'http.method': 'GET',
                'http.user_agent': "axios/0.21.4",
                'http.flavor': '1.1',
                'net.transport': "ip_tcp",
                "net.host.ip": "127.0.0.1",
                'net.host.port': expect.any(Number),
                "net.peer.ip": "127.0.0.1",
                'net.peer.port': expect.any(Number),
                'http.status_code': 200,
                'http.status_text': 'OK',
                "http.url": "http://localhost:8000/large-response",
            }
        )
        const clientAttributes = clientSpan.attributes;
        expect(clientAttributes).toMatchObject(
            {
                'http.url': "https://api.publicapis.org/entries",
                'http.method': 'GET',
                'http.target': "/entries",
                'net.peer.name': "api.publicapis.org",
                'http.request.body': '""',
                'net.peer.ip': expect.stringMatching(
                    /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$))\b/
                ),
                'net.peer.port': 443,
                'http.host': "api.publicapis.org:443",
                'http.status_code': 200,
                'http.status_text': 'OK',
                'http.flavor': '1.1',
                'http.request.headers': expect.stringMatching(/{.*}/),
                'http.response.headers': expect.stringMatching(/{.*}/),
                'http.response.body': expect.any(String),
            }
        )
        expect(clientAttributes['http.response.body'].length).toEqual(2048)
    }
}

const httpInstrumentationTest = new HttpInstrumentationTest();
const httpSpanAttrLengthTest = new HttpSpanAttrLengthTest();
const httpAttrLengthTest = new HttpAttrLengthTest();
const httpDefaultAttrLengthTest = new HttpDefaultAttrLengthTest();
export default {httpInstrumentationTest, httpSpanAttrLengthTest, httpAttrLengthTest, httpDefaultAttrLengthTest};


export const httpComponentTests = [httpInstrumentationTest, httpSpanAttrLengthTest, httpAttrLengthTest, httpDefaultAttrLengthTest];
