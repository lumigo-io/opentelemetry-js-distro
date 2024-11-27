import path from 'path';
import { logger } from './logging';

const getRequireFunction = (): NodeRequire =>
  // @ts-ignore __non_webpack_require__ not available at compile time
  typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;

export const safeRequire = (moduleSpecifier) => {
  try {
    const customRequire = getRequireFunction();
    const resolvedPath = safeResolvePath(moduleSpecifier);
    return resolvedPath ? customRequire(resolvedPath) : undefined;
  } catch (e) {
    logger.warn('Unable to load module', {
      error: e,
      libId: moduleSpecifier,
    });

    return undefined;
  }
};

const tryResolveFromPathGroup = (
  customRequire: NodeRequire,
  moduleSpecifier: string,
  paths: string[]
): string => {
  try {
    const resolvedPath = customRequire.resolve(moduleSpecifier, { paths });
    if (resolvedPath) {
      logger.debug(
        `${moduleSpecifier} successfully loaded from ${resolvedPath}. Paths searched: `,
        paths
      );
    } else {
      logger.debug(
        `${moduleSpecifier} could not be loaded from any of the following paths: `,
        paths
      );
    }
    return resolvedPath;
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      logger.warn('Unable to resolve module', { error, moduleSpecifier });
      return undefined;
    }
  }
};

const safeResolvePath = (moduleSpecifier: string): string | undefined => {
  const customReq = getRequireFunction();

  const pathGroups = [
    // default paths - same as not specifying paths to require.resolve()
    customReq.resolve?.paths?.(moduleSpecifier) || [],
    // paths specified in NODE_PATH, in case the user has set it for some reason
    (process.env.NODE_PATH || '').split(':'),
    // process CWD - i.e. the node_nodules folder of the process require()-ed the distro
    [path.resolve(process.cwd(), 'node_modules')],
  ];

  return pathGroups
    .map((pathGroup) => tryResolveFromPathGroup(customReq, moduleSpecifier, pathGroup))
    .find(Boolean);
};

export const canRequireModule = (moduleSpecifier) => !!safeResolvePath(moduleSpecifier);
