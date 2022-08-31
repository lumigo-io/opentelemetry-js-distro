import {ChildProcess} from "child_process";
import {InstrumentationTest} from "../../helpers/InstrumentationTest";
import {callContainer} from "../../helpers/helpers";
import {getReadyServer} from "../../component/http/httpTestUtils";


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
        if (
            lines.length > 2 &&
            lines[0].startsWith('{"traceId"') &&
            lines[1].startsWith('{"traceId"') &&
            lines.filter((line) => line.includes('"name":"mongodb')).length == 6
        ) {
            resolve(lines);
        }
    }

    getName() {
        return "mongodb" //should be the same as package.json script middle name "start:http:injected"
    }

    //TODO: SHANI
    runTests(spans: any[]): void {
        expect(spans.filter(span => span.name.includes("mongodb"))).toHaveLength(6);
        const insertSpan = spans.find((span) => span.name === "mongodb.insert");
        const findSpan = spans.find((span) => span.name === "mongodb.find");
        const updateSpan = spans.find((span) => span.name === "mongodb.update");
        const removeSpan = spans.find((span) => span.name === "mongodb.remove");
        const commandSpan = spans.find((span) => span.name === "mongodb.command");
        const indexSpan = spans.find((span) => span.name === "mongodb.createIndexes");

        let resourceAttributes = {
            "service.name": "mongodb",
            "telemetry.sdk.language": "nodejs",
            "telemetry.sdk.name": "opentelemetry",
            "telemetry.sdk.version": "1.1.1",
            "framework": "node",
            'process.environ': expect.jsonMatching(
                expect.objectContaining({
                    "OTEL_SERVICE_NAME": "mongodb",
                    "LUMIGO_TRACER_TOKEN": "t_123321",
                })),
            'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
            'process.pid': expect.any(Number),
            "process.executable.name": "node",
            'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
            "process.runtime.name": "nodejs",
            "process.runtime.description": "Node.js",
        };

        expect(insertSpan).toMatchObject({
            traceId: expect.any(String),
            id: expect.any(String),
            timestamp: expect.any(Number),
            duration: expect.any(Number),
            name: "mongodb.insert",
            kind: 2,
            resource: {
                attributes: resourceAttributes
            },
            attributes: {
                'net.host.name': 'localhost',
                'net.host.port': expect.any(String),
                'db.system': "mongodb",
                'db.name': "myProject",
                'db.mongodb.collection': "insertOne",
                'db.statement': expect.stringMatching(/"a":1,"_id":/),
            },
            status: {
                code: 0,
            },
            events: [],
        });
        expect(findSpan).toMatchObject({
            traceId: expect.any(String),
            parentId: expect.any(String),
            id: expect.any(String),
            timestamp: expect.any(Number),
            duration: expect.any(Number),
            name: 'mongodb.find',
            kind: 2,
            resource: {
                attributes: resourceAttributes
            },
            attributes: {
                'net.host.name': 'localhost',
                'net.host.port': expect.any(String),
                'db.system': "mongodb",
                'db.name': "myProject",
                'db.mongodb.collection': "insertOne",
                'db.statement': "{\"a\":1}"
            },
            status: {
                code: 0,
            },
            events: [],
        });
        expect(updateSpan).toMatchObject({
            traceId: expect.any(String),
            parentId: expect.any(String),
            id: expect.any(String),
            timestamp: expect.any(Number),
            duration: expect.any(Number),
            name: 'mongodb.update',
            kind: 2,
            resource: {
                attributes: resourceAttributes
            },
            attributes: {
                'net.host.name': 'localhost',
                'net.host.port': expect.any(String),
                'db.system': "mongodb",
                'db.name': "myProject",
                'db.mongodb.collection': "insertOne",
                'db.statement': "{\"a\":1}"
            },
            status: {
                code: 0,
            },
            events: [],
        });
        expect(removeSpan).toMatchObject({
            traceId: expect.any(String),
            parentId: expect.any(String),
            id: expect.any(String),
            timestamp: expect.any(Number),
            duration: expect.any(Number),
            name: 'mongodb.remove',
            kind: 2,
            resource: {
                attributes: resourceAttributes
            },
            attributes: {
                'net.host.name': 'localhost',
                'net.host.port': expect.any(String),
                'db.system': "mongodb",
                'db.name': "myProject",
                'db.mongodb.collection': "insertOne",
                'db.statement': "{\"b\":1}"
            },
            status: {
                code: 0,
            },
            events: [],
        });
        expect(commandSpan).toMatchObject({
            traceId: expect.any(String),
            parentId: expect.any(String),
            id: expect.any(String),
            timestamp: expect.any(Number),
            duration: expect.any(Number),
            name: 'mongodb.command',
            kind: 2,
            resource: {
                attributes: resourceAttributes
            },
            attributes: {
                'net.host.name': 'localhost',
                'net.host.port': expect.any(String),
                'db.system': "mongodb",
                'db.name': "admin",
                'db.mongodb.collection': "$cmd",
                'db.statement':  expect.stringMatching(/"endSessions":/),
            },
            status: {
                code: 0,
            },
            events: [],
        });
        expect(indexSpan).toMatchObject({
            traceId: expect.any(String),
            parentId: expect.any(String),
            id: expect.any(String),
            timestamp: expect.any(Number),
            duration: expect.any(Number),
            name: 'mongodb.createIndexes',
            kind: 2,
            resource: {
                attributes: resourceAttributes
            },
            attributes: {
                'net.host.name': 'localhost',
                'net.host.port': expect.any(String),
                'db.system': "mongodb",
                'db.name': "myProject",
                'db.mongodb.collection': "$cmd",
                'db.statement':  "{\"createIndexes\":\"insertOne\",\"indexes\":[{\"name\":\"a_1\",\"key\":{\"a\":1}}]}"
            },
            status: {
                code: 0,
            },
            events: [],
        });
    }
}

const mongodbInstrumentationTest = new MongoDbInstrumentationTest();
export default {mongodbInstrumentationTest};


export const mongodbInstrumentationTests = [mongodbInstrumentationTest];