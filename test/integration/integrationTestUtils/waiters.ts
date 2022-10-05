import { assert } from "chai";
import {ContinueLoopError, WaitIsOverError} from "./customErrors";
require('log-timestamp');

const WAIT=300
const MAX_REPETITIONS= 50
const MAX_WAIT_TIME = 10000

const sleep = (time: number) => {
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
async function syncLoop(func: Function, wait: number, givenMaxRepetitions: number, givenMaxWaitTime: number = MAX_WAIT_TIME) {
    let exit = false;
    let repCount = 0;
    let sleepTime = wait;
    givenMaxRepetitions = Math.min(MAX_REPETITIONS, givenMaxRepetitions);
    while (!exit) {
        console.info(`Running function ${func.name} ${repCount + 1} times.`);
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

export async function waitForSpansInFile(filePath: string, condition: Function) {
    async function waitForSpans() {
        try {
            const result = condition(filePath);
            assert(result);
            return result;
        } catch (e) {
            console.error("Failed on waitForSpansInFile", e);
        }
        throw new ContinueLoopError();
    }
    return await syncLoop(waitForSpans, WAIT, MAX_REPETITIONS);
}