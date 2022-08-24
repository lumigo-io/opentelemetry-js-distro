import { Db } from 'mongodb';
import { initContainerDB, stopDbContainer } from './app/app';

// jest.setTimeout(700000);
// describe('Test container suite', () => {
    // let db: Db;
    //
    // beforeAll(async () => {
    //     db = await initContainerDB();
    // });
    //
    // afterAll(async () => {
    //     await stopDbContainer();
    // })

    // it('database should be initialized', async () => {
    //     expect(db).toBeTruthy();
    //     expect(db?.databaseName).toBe('db-data');
    // })
// });

import {ChildProcess} from "child_process";
import {InstrumentationTest} from "../../helpers/InstrumentationTest";
import {callContainer} from "../../helpers/helpers";
import {getReadyServer, getReadySpans} from "../http/httpTestUtils";


class MongoDbInstrumentationTest implements InstrumentationTest {
    isChildProcessReadyPredicate(data: any, nodeChildApp: ChildProcess, resolve, reject): void {
        getReadyServer(data, resolve);
    }

    getEnvVars(){
        return {}
    }

    onChildProcessReady(): Promise<void> {
        return callContainer(8080, '/', 'get');
    }

    spansReadyCondition(lines: string[], resolve): void {
        getReadySpans(lines, resolve);
    }

    getName() {
        return "mongodb" //should be the same as package.json script middle name "start:http:injected"
    }

    //TODO: SHANI
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

const mongoDbInstrumentationTest = new MongoDbInstrumentationTest();
export default {mongoDbInstrumentationTest};


export const mongodbComponentTests = [mongoDbInstrumentationTest];