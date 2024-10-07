import * as lumigo from "@lumigo/opentelemetry";
import { createServer } from "http";
import { parse } from "url";
import next from "next";

// Set up the environment and fallback port
const port = process.env.PORT || 3000;  // Default to port 3000 if PORT env is not set
const dev = process.env.NODE_ENV !== "production";
await lumigo.init;
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`listening on port ${port}`);
  });
});
