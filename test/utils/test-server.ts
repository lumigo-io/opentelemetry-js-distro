import http from 'http';
import { AddressInfo } from 'net';
import url from 'url';

type EndpointType = {
    [key: string]: (req: http.IncomingMessage, res: http.ServerResponse) => void;
};

export class TestServer {
    private httpServer: http.Server;
    private port: Number | undefined;
    private endpoints: EndpointType;

    constructor(
        endpoints: EndpointType = {},
    ) {
        this.setEndpoints(endpoints);
    }

    private constructRequestListener() {
        return (req: http.IncomingMessage, res: http.ServerResponse) => {
            if (!req.url) {
                throw   new Error('request url is undefined');
            }
            const requestUrl = url.parse(req.url, true);
            if (!requestUrl || !requestUrl.pathname) {
                throw new Error('request url pathname is undefined');
            }
            const endpoint = this.endpoints[requestUrl.pathname];
            if (endpoint) {
                endpoint(req, res);
            } else {
                res.writeHead(404);
                res.end();
            }
        };
    }

    public getUri(): string {
        if (!this.port) {
            throw new Error('server port is undefined');
        }
        return `http://localhost:${this.port}`;
    }

    public start(): Promise<Number> {
        return new Promise((resolve) => {
            this.httpServer = http.createServer(this.constructRequestListener());
            this.httpServer.listen(0, 'localhost', () => {
                const address = this.httpServer.address() as AddressInfo
                this.port = address.port;
                console.error(`Test HTTP server listening on port ${this.port}`);
                resolve(this.port);
            });
        });
    }

    public setEndpoints(
        endpoints: EndpointType = {},
    ) {
        this.endpoints = endpoints || {};
    }

    public stop(): Promise<void> {
        return new Promise((resolve) => {
            this.httpServer.close(() => {
                this.port = undefined;
                resolve();
            });
        });
    }
}
