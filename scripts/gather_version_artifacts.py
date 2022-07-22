from __future__ import annotations
import os
from glob import glob
from typing import List, Dict, Tuple
from contextlib import contextmanager
from dataclasses import dataclass

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




@dataclass(frozen=True)
class TestedVersions:
    success: Tuple[str, ...]
    failed: Tuple[str, ...]

    @staticmethod
    def _add_version_to_file(
        directory: str, dependency_name: str, dependency_version: str, success: bool
    ):
        dependency_file_path = TestedVersions.get_file_path(directory, dependency_name)
        TestedVersions.add_version_to_file(
            dependency_file_path, dependency_version, success
        )

    @staticmethod
    def add_version_to_file(path: str, version: str, success: bool):
        new_line = f"{'' if success else '!'}{version}\n"
        print(f"Adding the following line to {path}: {new_line}")
        with open(path, "a") as f:
            f.write(new_line)

    @staticmethod
    @contextmanager
    def save_tests_result(
        directory: str, dependency_name: str, dependency_version: str
    ):
        if should_add_new_versions():
            try:
                yield
            except Exception:
                TestedVersions._add_version_to_file(
                    directory, dependency_name, dependency_version, False
                )
                raise
            TestedVersions._add_version_to_file(
                directory, dependency_name, dependency_version, True
            )
        else:
            yield

    @staticmethod
    def get_file_path(directory: str, dependency_name: str) -> str:
        return (
            os.path.dirname(os.path.dirname(__file__))
            + f"/instrumentations/{directory}/tested_versions/{dependency_name}"
        )

    @staticmethod
    def from_file(path: str) -> TestedVersions:
        success = []
        failed = []
        with open(path, "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith("!"):
                    failed.append(line[1:])
                else:
                    success.append(line)
        return TestedVersions(success=tuple(success), failed=tuple(failed))

    def get_all_versions(self) -> Tuple[str, ...]:
        return self.success + self.failed


def should_add_new_versions() -> bool:
    return os.getenv("ADD_NEW_VERSIONS", "").lower() == "true"


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
        "instrumentations/*/tested_versions/*"
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
    version_to_success = calculate_version_to_success_dict(
        origin_path, runtime_to_tested_versions
    )
    for version, success in version_to_success.items():
        TestedVersions.add_version_to_file(origin_path, version, success)


def calculate_version_to_success_dict(
    origin_path: str,
    runtime_to_tested_versions: Dict[str, TestedVersions],
) -> Dict[str, bool]:
    version_to_success = {}
    origin_versions = set(TestedVersions.from_file(origin_path).get_all_versions())
    for runtime, tested_versions in runtime_to_tested_versions.items():
        for version in tested_versions.success:
            if version not in origin_versions and version not in version_to_success:
                version_to_success[version] = True
        for version in tested_versions.failed:
            if version not in origin_versions:
                version_to_success[version] = False
    if not version_to_success:
        print("no new versions found, not writing to file")
    return version_to_success


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
    all_versions = sorted(
        list(runtime_to_tested_versions.values())[0].get_all_versions()
    )
    if any(
        [
            sorted(tested_versions.get_all_versions()) != all_versions
            for tested_versions in runtime_to_tested_versions.values()
        ]
    ):
        raise Exception("Got different versions from different runtimes")
    return runtime_to_tested_versions


if __name__ == "__main__":
    main()
