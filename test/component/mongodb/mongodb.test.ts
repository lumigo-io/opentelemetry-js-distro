import { Db } from 'mongodb';
import { initContainerDB, stopDbContainer } from './app/app';

jest.setTimeout(700000);
describe('Test container suite', () => {
    let db: Db;

    beforeAll(async () => {
        db = await initContainerDB();
    });

    afterAll(async () => {
        await stopDbContainer();
    })

    it('database should be initialized', async () => {
        expect(db).toBeTruthy();
        expect(db?.databaseName).toBe('db-data');
    })
});