/*
 * Copyright Lumigo
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * To provide better support and better data-driven product decisions
 * with respect to which packages to support next, the Lumigo
 * OpenTelemetry Distro for JS will report to Lumigo on startup the
 * packages and their versions used in this application, together with the
 * OpenTelemetry resource data to enable analytics in terms of which platforms
 * use which dependencies.
 *
 * This behavior is opt-out using the `LUMIGO_REPORT_DEPENDENCIES=false`
 * environment variable. Additionally, data is sent only when the Lumigo endpoint
 * is the default one (as to avoid issues when tracing data is sent through proxies
 * like OpenTelemetry collectors), and it active only when a `LUMIGO_TRACER_TOKEN`
 * is present in the process environment.
 */

import { access, lstat, readFile, readdir } from 'fs/promises';
import { postUri } from '../utils';
import type { ResourceAttributes } from '@opentelemetry/resources';

export async function report(
  dependenciesEndpoint: string,
  lumigoToken: string,
  resourceAttributes: ResourceAttributes
) {
  const packages = await listPackages();

  return (
    postUri(
      dependenciesEndpoint,
      { resourceAttributes, packages },
      { Authorization: `LumigoToken ${lumigoToken.trim()}` }
    )
      /* eslint-disable */
      .catch(() => {})
    /* eslint-enable */
  );
}

async function listPackages() {
  const validModulePaths = [];

  for (const modulesPath of module.paths) {
    try {
      // Basic existence check of the modulesPath (no actual FS access)
      await access(modulesPath);
      // Check if modulesPath is an actual directory
      const stats = await lstat(modulesPath);
      if (stats.isDirectory()) {
        validModulePaths.push(modulesPath);
      }
    } catch (err) {
      /*
       * Likely it is a default option, like /node_modules,
       * that does not actually exist.
       */
      continue;
    }
  }

  const packages = [];
  for (const modulesPath of validModulePaths) {
    const packageDirs = await readdir(modulesPath);

    for (const packageDir of packageDirs) {
      try {
        const packageJsonFile = `${modulesPath}/${packageDir}/package.json`;
        const content = await readFile(packageJsonFile);
        const packageJson = JSON.parse(content.toString());
        packages.push({
          name: packageJson.name,
          version: packageJson.version,
        });
      } catch (err) {
        /*
         * Could be that the packageDir is actually not a directory,
         * or that it does not contain a package.json file (so it is
         * actually not a package directory), or that the package.json
         * file is malformed. In any of these cases, it is not an actual
         * dependency the application can load, so it is safe to skip.
         */
        continue;
      }
    }
  }

  return packages;
}
