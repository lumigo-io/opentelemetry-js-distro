export {};

declare global {
  namespace NodeJS {
   interface Global {
      describeVersions(instrumentationName: string, versionName: string): typeof global.describe;
   }
 }
}