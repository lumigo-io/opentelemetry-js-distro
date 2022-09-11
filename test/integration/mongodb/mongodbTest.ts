import {ChildProcess} from "child_process";
import {InstrumentationTest} from "../../helpers/InstrumentationTest";
import {callContainer} from "../../helpers/helpers";
import {getReadyServer} from "../../component/http/httpTestUtils";

export const runOneTimeWrapper = (func: Function, context: any = undefined): Function => {
    let done = false;
    return (...args) => {
        if (!done) {
            const result = func.apply(context || this, args);
            done = result;
            return result;
        }
    };
};

class MongoDbV3InstrumentationTest implements InstrumentationTest {
    isChildProcessReadyPredicate(data: any, nodeChildApp: ChildProcess, resolve, reject): void {
        runOneTimeWrapper(getReadyServer)(data, resolve);
    }

    getEnvVars() {
        return {
            OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: "4096"
        }
    }

    getSupportedVersion() {
        return 3;
    }


    getChildProcessTimeout(): number {
        return 30000;
    }

    getTestTimeout(): number {
        return 30000;
    }

    onChildProcessReady(): Promise<void> {
        return callContainer(8080, '/', 'get');
    }

    spansReadyCondition(lines: string[], resolve): void {
        if (
            lines.length > 2 &&
            lines[0].startsWith('{"traceId"') &&
            lines[1].startsWith('{"traceId"') &&
            lines.filter((line) => line.includes('"name":"mongodb') && !line.includes("mongodb.isMaster")).length == 6
        ) {
            resolve(lines);
        }
    }

    getName() {
        return "mongodb" //should be the same as package.json script middle name "start:http:injected"
    }

    runTests(spans: any[]): void {
        expect(spans.filter(span => span.name.includes("mongodb") && !span.name.includes("mongodb.isMaster"))).toHaveLength(6);
        const insertSpan = spans.find((span) => span.name === "mongodb.insert");
        const findSpan = spans.find((span) => span.name === "mongodb.find");
        const updateSpan = spans.find((span) => span.name === "mongodb.update");
        const removeSpan = spans.find((span) => span.name === "mongodb.remove");
        const endSessionSpan = spans.find((span) => span.name === "mongodb.command");
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
                'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
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
                'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
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
                'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
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
                'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
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
        expect(endSessionSpan).toMatchObject({
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
                'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
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
                'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                'net.host.port': expect.any(String),
                'db.system': "mongodb",
                'db.name': "myProject",
                'db.mongodb.collection': "$cmd",
                'db.statement':   expect.stringMatching(/"createIndexes":"insertOne","indexes":\[{"name":"a_1","key":/),
            },
            status: {
                code: 0,
            },
            events: [],
        });
    }
}

class MongoDbV4InstrumentationTest implements InstrumentationTest {
    isChildProcessReadyPredicate(data: any, nodeChildApp: ChildProcess, resolve, reject): void {
        runOneTimeWrapper(getReadyServer)(data, resolve);
    }

    getEnvVars() {
        return {
            OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: "4096"
        }
    }

    getSupportedVersion() {
        return 4;
    }

    getChildProcessTimeout(): number {
        return 30000;
    }

    getTestTimeout(): number {
        return 30000;
    }

    onChildProcessReady(): Promise<void> {
        return callContainer(8080, '/', 'get');
    }

    spansReadyCondition(lines: string[], resolve): void {
        if (
            lines.length > 2 &&
            lines[0].startsWith('{"traceId"') &&
            lines[1].startsWith('{"traceId"') &&
            lines.filter((line) => line.includes('"name":"mongodb') && !line.includes("mongodb.isMaster")).length == 6
        ) {
            resolve(lines);
        }
    }

    getName() {
        return "mongodb" //should be the same as package.json script middle name "start:http:injected"
    }

    runTests(spans: any[]): void {
        expect(spans.filter(span => span.name.includes("mongodb") && !span.name.includes("mongodb.isMaster"))).toHaveLength(6);
        const insertSpan = spans.find((span) => span.name === "mongodb.insert");
        const findSpan = spans.find((span) => span.name === "mongodb.find");
        const updateSpan = spans.find((span) => span.name === "mongodb.update");
        const removeSpan = spans.find((span) => span.name === "mongodb.delete");
        const endSessionSpan = spans.find((span) => span.name === "mongodb.endSessions");
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
                'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
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
                'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                'net.host.port': expect.any(String),
                'db.system': "mongodb",
                'db.name': "myProject",
                'db.mongodb.collection': "insertOne",
                'db.statement': "{\"find\":\"insertOne\",\"filter\":{\"a\":1}}"
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
                'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                'net.host.port': expect.any(String),
                'db.system': "mongodb",
                'db.name': "myProject",
                'db.mongodb.collection': "insertOne",
                'db.statement': "{\"update\":\"insertOne\",\"updates\":[{\"q\":{\"a\":1},\"u\":{\"$set\":{\"b\":1}}}],\"ordered\":true}"
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
            name: 'mongodb.delete',
            kind: 2,
            resource: {
                attributes: resourceAttributes
            },
            attributes: {
                'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                'net.host.port': expect.any(String),
                'db.system': "mongodb",
                'db.name': "myProject",
                'db.mongodb.collection': "insertOne",
                'db.statement': "{\"delete\":\"insertOne\",\"deletes\":[{\"q\":{\"b\":1},\"limit\":0}],\"ordered\":true}"
            },
            status: {
                code: 0,
            },
            events: [],
        });
        expect(endSessionSpan).toMatchObject({
            traceId: expect.any(String),
            parentId: expect.any(String),
            id: expect.any(String),
            timestamp: expect.any(Number),
            duration: expect.any(Number),
            name: 'mongodb.endSessions',
            kind: 2,
            resource: {
                attributes: resourceAttributes
            },
            attributes: {
                'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                'net.host.port': expect.any(String),
                'db.system': "mongodb",
                'db.name': "admin",
                'db.mongodb.collection': "$cmd",
                'db.statement': expect.stringMatching(/"endSessions":/),
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
                'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                'net.host.port': expect.any(String),
                'db.system': "mongodb",
                'db.name': "myProject",
                'db.mongodb.collection': "$cmd",
                'db.statement': expect.stringMatching(/"createIndexes":"insertOne","indexes":\[{"name":"a_1","key":/),
            },
            status: {
                code: 0,
            },
            events: [],
        });
    }
}

const mongodbV3InstrumentationTest = new MongoDbV3InstrumentationTest();
const mongodbV4InstrumentationTest = new MongoDbV4InstrumentationTest();
export default {mongodbV3InstrumentationTest, mongodbV4InstrumentationTest};


export const mongodbInstrumentationTests = [mongodbV3InstrumentationTest, mongodbV4InstrumentationTest];