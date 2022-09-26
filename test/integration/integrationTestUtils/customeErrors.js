/**
 * Indicates that the waiting for the loop to finish is over and no valid results were approved
 */
export class WaitIsOverError extends Error {}

/**
 * Indicates that element was not found therefore another sync loop should be made.
 */
export class ContinueLoopError extends Error {}