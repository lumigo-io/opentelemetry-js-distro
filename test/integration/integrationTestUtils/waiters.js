const {info, error} = require("console")
const { assert } = require("chai");
const {ContinueLoopError, WaitIsOverError} = require("./customeErrors");
require('log-timestamp');


const WAIT=300
const MAX_REPETITIONS= 50
const MAX_WAIT_TIME = 10000

const sleep = (time) => {
    return new Promise((resolve) => setTimeout(resolve, time));
};

/**
 * Wait until function returns results or exit in time had passed or exception was thrown.
 * @param func {function} Run this function over and over
 * @param wait {number} Initial time wait. Pay attention that exponential backoff is used here, e.g. wait * 2 for each repetition until maxRepetitions have reached.
 * @param givenMaxRepetitions {number} How many repetition to run
 * @param givenMaxWaitTime {number} Maximum wait time
 * @returns {Promise<*>}
 */
async function syncLoop(func, wait, givenMaxRepetitions, givenMaxWaitTime = MAX_WAIT_TIME) {
    let exit = false;
    let repCount = 0;
    let sleepTime = wait;
    givenMaxRepetitions = Math.min(MAX_REPETITIONS, givenMaxRepetitions);
    while (!exit) {
        info(`Running function ${func.name} ${repCount + 1} times.`);
        try {
            await sleep(sleepTime);
            return await func();
        } catch (e) {
            if (e instanceof ContinueLoopError) {
                // Continue
            } else {
                throw e;
            }
        }
        repCount++;
        sleepTime = Math.min(2 * sleepTime, givenMaxWaitTime);
        exit = repCount > givenMaxRepetitions;
    }

    throw new WaitIsOverError(
        `Wait is over for ${func.name}. No valid results retrieved`
    );
}

async function waitForSpansInFile(filePath, condition) {
    async function waitForSpans() {
        try {
            const result = condition(filePath);
            assert(result);
            return result;
        } catch (e) {
            error("Failed on waitForSpansInFile", e);
        }
        throw new ContinueLoopError();
    }
    return await syncLoop(waitForSpans, WAIT, MAX_REPETITIONS);
}

module.exports = {waitForSpansInFile}