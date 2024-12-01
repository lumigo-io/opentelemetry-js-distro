import path from "path"
import { range } from 'lodash'
import fs from "fs"

const deasyncPath = path.dirname(require.resolve("deasync"))
const supportedSyncInitNodeVersions = range(14, 22)

describe("pre-built binaries for arm64 (applicable when loaded by the operator)", () => {
  /*
  This test effectively checks the correctness of our post-install script, responsible for adding pre-built binaries
  for the `deasync` package to be used on arm64 hosts.
  Those binaries are required since:
  1. The `deasync` package is a native module, and as such, it needs to be compiled for the target architecture.
  2. The operator pre-installs the distro (and therefore pre-compiles the `deasync` package), so it could be later added
  from an init-container volume-mount
  3. Since that pre-installed version is compiled when building the injector image, it does not product a binary for other target plafforms
  4. `deasync` addresses that by providing pre-built binaries for the most common platforms, but not for arm64 :(
  */
  test.each(supportedSyncInitNodeVersions)("binaries are added for arm64 running Node %i", nodeVersion => {
    const expectedBinaryPath = path.join(deasyncPath, "bin", `linux-arm64-node-${nodeVersion}`)
    expect(fs.existsSync(expectedBinaryPath)).toBe(true)
  })
})