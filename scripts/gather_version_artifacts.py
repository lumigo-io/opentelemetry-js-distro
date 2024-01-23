# call this script from the project root with python3 -m scripts.gather_version_artifacts

import os
from glob import glob
from typing import List

from tested_versions_utils import TestedVersions

ARTIFACTS_PATH = "versions_artifacts"
INSTRUMENTATIONS_PATH = "src/instrumentations/"

# Before this script runs, the job downloads the artifacts into files with the following example structure:
#
#   versions_artifacts/
#       3.7/
#           boto3: (next lines are the data inside the file)
#               1.0.0
#              !2.0.0
#       3.10/
#           fastapi:
#               5.1.0
#               5.2.0
#
# Each file contains the original supported versions and the results from the tests in the previous job.


def main() -> None:
    files_by_runtime = {
        python_runtime: sorted(os.listdir(os.path.join(ARTIFACTS_PATH, python_runtime)))
        for python_runtime in os.listdir(ARTIFACTS_PATH)
    }
    print(f"new results detected: {files_by_runtime}")

    if not any(files_by_runtime.values()):
        print("No files were found so nothing to update, returning")
        return

    for runtime, dependencies in files_by_runtime.items():
        update_dependencies(dependencies, runtime)


def update_dependencies(dependencies: List[str], runtime: str) -> None:
    for instrumentation_name in dependencies:
        print(
            f"processing {instrumentation_name} for {runtime}...",
        )
        # find all the relevant files in the instrumentations path
        # NOTE: this handles the case where the instrumentation's tested versions are
        #       not in its own path, eg. uvicorn
        original_tested_versions_files = glob(
            f"{INSTRUMENTATIONS_PATH}/*/tested_versions/{runtime}/*"
        )
        for original_tested_versions_file in original_tested_versions_files:
            if original_tested_versions_file.endswith(
                f"tested_versions/{runtime}/{instrumentation_name}"
            ):
                tested_versions = TestedVersions.from_file(
                    os.path.join(ARTIFACTS_PATH, runtime, instrumentation_name)
                )
                for version in tested_versions.all_versions:
                    supported = version in tested_versions.supported_versions
                    TestedVersions.add_version_to_file(
                        original_tested_versions_file, version, supported
                    )


if __name__ == "__main__":
    main()
