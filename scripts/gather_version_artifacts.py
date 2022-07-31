import os
from glob import glob
from typing import List, Dict, Tuple

from src.ci.tested_versions_utils import TestedVersions

ARTIFACT_DIR_NAME = "versions_artifacts"


# Before this script runs, the job downloads the artifacts into files with the following example structure:
#
#   versions_artifacts/
#       12/
#           express: (next lines are the data inside the file)
#               4.17.2
#               !4.17.3
#           mongoose:
#               6.4.4
#               3.9.7
#       14/
#           express:
#               4.17.2
#               !4.17.3
#           mongoose:
#               3.9.7
#               6.4.4
#
# Each file contains the original supported versions and the results from the tests in the previous job.


def main() -> None:
    runtime_to_files = {
        python_runtime: sorted(
            os.listdir(os.path.join(ARTIFACT_DIR_NAME, python_runtime))
        )
        for python_runtime in os.listdir(ARTIFACT_DIR_NAME)
    }
    print("runtime_to_files:", runtime_to_files)
    if not any(runtime_to_files.values()):
        print("No files were found so nothing to update, returning")
        return
    files_names = list(runtime_to_files.values())[0]
    if any([files != files_names for files in runtime_to_files.values()]):
        raise Exception("Got different files from different runtimes")
    origin_tested_files = glob(
        "src/lumigo_opentelemetry/instrumentations/*/tested_versions/*"
    )
    for instrumentation_name in files_names:
        handle_dependency(
            instrumentation_name, origin_tested_files, tuple(runtime_to_files)
        )


def handle_dependency(
    instrumentation_name: str, origin_tested_files: List[str], runtimes: Tuple[str, ...]
) -> None:
    print("working on:", instrumentation_name)
    origin_path = next(
        path
        for path in origin_tested_files
        if path.endswith(f"tested_versions/{instrumentation_name}")
    )

    runtime_to_tested_versions = calculate_runtime_to_tested_versions_dict(
        instrumentation_name, runtimes
    )

    for version in list(runtime_to_tested_versions.values())[0].all_versions:
        supported = all(
            [
                # A version is supported only if it works in all runtimes
                (version in runtime_to_tested_versions[runtime].supported_versions)
                for runtime in runtimes
            ]
        )

        TestedVersions.add_version_to_file(origin_path, version, supported)


def calculate_runtime_to_tested_versions_dict(
    instrumentation_name: str, runtimes: Tuple[str, ...]
) -> Dict[str, TestedVersions]:
    runtime_to_tested_versions = {
        runtime: TestedVersions.from_file(
            os.path.join(ARTIFACT_DIR_NAME, runtime, instrumentation_name)
        )
        for runtime in runtimes
    }
    print("runtime_to_tested_versions:", runtime_to_tested_versions)

    # Sanity check that we tested the same versions in all runtimes
    all_versions = set(list(runtime_to_tested_versions.values())[0].all_versions)
    if any(
        [
            set(tested_versions.all_versions) != all_versions
            for tested_versions in runtime_to_tested_versions.values()
        ]
    ):
        raise Exception("Got different versions from different runtimes")
    return runtime_to_tested_versions


if __name__ == "__main__":
    main()
