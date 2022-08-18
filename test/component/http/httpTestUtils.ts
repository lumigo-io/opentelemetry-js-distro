
export const getReadyServer = (data: any, resolve) => {
    const dataStr = data.toString();
    if (dataStr.includes("Server is running on http://localhost:")) {
        resolve();
    }
}

export const getReadySpans = (lines: string[], resolve) => {
    console.log(`Checking [${lines.length}] lines:`);
    lines.forEach((l) => console.log(l.substring(0, 50)));
    if (
        lines.length === 2 &&
        lines[0].startsWith('{"traceId"') &&
        lines[1].startsWith('{"traceId"')
    ) {
        console.log('Spans are ready!');
        resolve(lines);
    }
}


