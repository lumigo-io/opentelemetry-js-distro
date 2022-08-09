from __future__ import annotations

import attr
import os
import re

from glob import glob
from contextlib import contextmanager
from dataclasses import dataclass
from typing import List, Optional, Union, cast, Dict, Tuple

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

# This regexp splits the version line across three capture groups:
# `(!)?` captures whether or not the version is supported (if supported, the `!` character is missing)
# `([^\s]+)` represents the actual version, as it is a list of non-whitespace characters
# `(.*)` is the conent of the comment.
# The various non-capturing groups `(?:\s*)` get rid of whitespace sequences before the ! mark,
# in between `!` and the version, and in between the version and the (optional) comment, denoted by `#`
#
# For example:
#
#  * '  ! 1.2.3  # This is awesome' => ['!', '1.2.3', 'This is awesome']
#  * '1.2.3' => ['', '1.2.3', '']
_SPLIT_VERSION_FROM_COMMENT_PATTERN = re.compile(
    r"(?:\s*)(!)?(?:\s*)([^\s]+)(?:\s*#\s*(.*))?"
)

# Major, minor, patch and (non semver standard, suffix)
# A "1.2.3" value (no suffix) is split into the four capture groups: [ '1', '2', '3', '' ]
# A "1.2.3-ciao" value is split into the four capture groups: [ '1', '2', '3', '-ciao' ]
_SEMANTIC_VERSION_PATTERN = re.compile(r"(\d+).(\d+).(\d+)([^\s]*)")

# This file implements a custom version parsing and sorting mechanism,
# as `packaging.version` has strange behaviors that won't work for other
# languages, like:
#
# ```
# >>> from packaging.version import parse
# >>> str(parse("1.2.4c"))
# '1.2.4rc0'
# ```
#
# ```
# >>> from packaging.version import parse
# >>> str(parse("1.2.4b"))
# '1.2.4b0'
# ```


@dataclass(frozen=True, repr=False, order=False)
class NonSemanticVersion:
    supported: bool
    version: str
    comment: str

    def __eq__(self, other):
        if not isinstance(other, NonSemanticVersion):
            return False

        return self.version == other.version

    def __lt__(self, other):
        if not isinstance(other, NonSemanticVersion):
            return False

        return self.version < other.version

    def __repr__(self):
        return f"{'' if self.supported else '!'}{self.version}{' # ' + self.comment if self.comment else ''}"


@dataclass(frozen=True, repr=False, order=False)
class SemanticVersion:
    supported: bool
    version: str
    major: int
    minor: int
    patch: int
    suffix: str
    comment: str

    def __eq__(self, other):
        if not isinstance(other, SemanticVersion):
            return False

        return (
            self.major == other.major
            and self.minor == other.minor
            and self.patch == other.patch
            and self.suffix == other.suffix
        )

    def __lt__(self, other):
        if not isinstance(other, SemanticVersion):
            return True

        if self.major < other.major:
            return True

        if self.major > other.major:
            return False

        if self.minor < other.minor:
            return True

        if self.minor > other.minor:
            return False

        if self.patch < other.patch:
            return True

        if self.patch > other.patch:
            return False

        if not self.suffix and other.suffix:
            return True

        if self.suffix and not other.suffix:
            return False

        return self.suffix < other.suffix

    def __repr__(self):
        return f"{'' if self.supported else '!'}{self.version}{' # ' + self.comment if self.comment else ''}"


def parse_version(version: str) -> Union[SemanticVersion, NonSemanticVersion]:
    res = re.search(_SPLIT_VERSION_FROM_COMMENT_PATTERN, version)
    if not res:
        raise Exception(f"Version does not parse as non-semantic: {version}")
    (supported_string, version_string, comment) = res.groups()
    # The `supported_string` is either an empty string (supported) or the '!' string (not supported)
    supported = not bool(supported_string)

    res = re.search(_SEMANTIC_VERSION_PATTERN, version_string)
    if res:
        (major, minor, patch, suffix) = res.groups()
        return SemanticVersion(
            supported=supported,
            version=version_string,
            major=int(major),
            minor=int(minor),
            patch=int(patch),
            suffix=suffix,
            comment=comment,
        )

    # The `supported` is either an empty string (supported) or the '!' string (not supported)
    return NonSemanticVersion(
        supported=supported,
        version=version_string,
        comment=comment,
    )


@attr.s(frozen=True)
class TestedVersions:
    versions: List[Union[SemanticVersion, NonSemanticVersion]] = attr.ib(
        converter=sorted
    )

    @staticmethod
    def _add_version_to_file(
        directory: str, dependency_name: str, dependency_version: str, supported: bool
    ):
        dependency_file_path = TestedVersions.get_file_path(directory, dependency_name)
        TestedVersions.add_version_to_file(
            dependency_file_path, dependency_version, supported
        )

    @staticmethod
    def add_version_to_file(path: str, version: str, supported: bool):
        tested_versions = TestedVersions.from_file(path)

        parsed_version = parse_version(("" if supported else "!") + version)
        previous_version: Optional[Union[SemanticVersion, NonSemanticVersion]] = None

        try:
            previous_version = next(
                filter(
                    lambda v: v.version == parsed_version.version,
                    tested_versions.versions,
                )
            )
        except StopIteration:
            # This version does not appear in the file
            pass

        tested_versions.versions.append(parsed_version)
        if previous_version:
            tested_versions.versions.remove(previous_version)

            print(f"Updating '{previous_version}' to '{parsed_version}' in {path}")

            if previous_version.supported and (not parsed_version.supported):
                # This is, above all, the most dangerous case we could possibly overlook
                print(f"DANGER! Removing support for {previous_version.version}!")

            if (not previous_version.supported) and parsed_version.supported:
                print(f"COOL! Adding support for {previous_version.version}!")
        else:
            print(f"Adding '{parsed_version}' to {path}")

        with open(path, "w") as f:
            for tested_version in sorted(tested_versions.versions):
                if not tested_version.supported:
                    f.write("!")

                f.write(tested_version.version)

                if tested_version.comment:
                    f.write(" # " + tested_version.comment)

                f.write("\n")

    @staticmethod
    @contextmanager
    def save_tests_result(
        directory: str, dependency_name: str, dependency_version: str
    ):
        if should_test_only_untested_versions():
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
            + f"/test/integration/{directory}/tested_versions/{dependency_name}"
        )

    @staticmethod
    def from_file(path: str) -> TestedVersions:
        with open(path, "r") as f:
            # Sort versions on creation
            return TestedVersions([parse_version(line) for line in f])  # type: ignore # MyPy gets confused by the Union of RichSortable types

    @property
    def supported_versions(self) -> List[str]:
        """Return all supported versions, sorted"""
        return [
            tested_version.version
            for tested_version in self.versions
            if tested_version.supported
        ]

    @property
    def unsupported_versions(self) -> List[str]:
        """Return all unsupported versions, sorted"""
        return [
            tested_version.version
            for tested_version in self.versions
            if not tested_version.supported
        ]

    @property
    def all_versions(self) -> List[str]:
        """Return all versions, sorted"""
        return [tested_version.version for tested_version in self.versions]


def should_test_only_untested_versions() -> bool:
    return os.getenv("TEST_ONLY_UNTESTED_NEW_VERSIONS", "").lower() == "true"


def generate_support_matrix_markdown(
    src_root=None, package_url_template="https://pypi.org/project/{}"
) -> List[str]:
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

    if src_root:
        project_root = os.path.join(project_root, src_root)

    # Find all the 'tested_versions' folders and the files inside
    package_support_version_directories = []
    for root, directories, files in os.walk(project_root):
        for directory in directories:
            if os.path.basename(directory) == "tested_versions":
                package_support_version_directories += [os.path.join(root, directory)]

    res = ["| Instrumentation | Package | Supported Versions |", "| --- | --- | --- |"]
    for package_support_version_directory in sorted(
        package_support_version_directories
    ):
        res += _generate_support_matrix_markdown_row(
            package_support_version_directory, package_url_template
        )

    return res


def _generate_support_matrix_markdown_row(
    tested_versions_directory, package_url_template
) -> List[str]:
    """Generate the markdown row for an instrumentation"""

    # The package name is the name of the parent of the 'tested_versions' directory
    # But there are cases, like FastAPI, where we actually test multiple packages,
    # like fastapi and uvicorn
    instrumentation = os.path.basename(os.path.dirname(tested_versions_directory))

    packages = sorted(os.listdir(tested_versions_directory))

    res = []
    if len(packages) == 1:
        package = packages[0]

        supported_version_ranges = _get_supported_version_ranges(
            TestedVersions.from_file(
                os.path.join(tested_versions_directory, packages[0])
            )
        )

        res.append(
            f"| {instrumentation} | [{package}]({package_url_template.format(package)}) | {supported_version_ranges[0]} |"
        )
        for supported_version_range in supported_version_ranges[1:]:
            res.append(f"| | | {supported_version_range} |")
    else:
        first_package = packages[0]
        supported_version_ranges_first_package = _get_supported_version_ranges(
            TestedVersions.from_file(
                os.path.join(tested_versions_directory, first_package)
            )
        )

        res.append(
            f"| {instrumentation} | [{first_package}]({package_url_template.format(first_package)}) | {supported_version_ranges_first_package[0]} |"
        )
        for supported_version_range in supported_version_ranges_first_package[1:]:
            res.append(f"| | | {supported_version_range} |")

        for package in packages[1:]:
            supported_version_ranges = _get_supported_version_ranges(
                TestedVersions.from_file(
                    os.path.join(tested_versions_directory, package)
                )
            )
            res.append(
                f"| | [{package}]({package_url_template.format(package)}) | {supported_version_ranges[0]} |"
            )

            for supported_version_range in supported_version_ranges[1:]:
                res.append(f"| | | {supported_version_range} |")

    return res


def _get_supported_version_ranges(tested_versions: TestedVersions) -> List[str]:
    # The versions are sorted, and assumed not to have gaps
    # We go over the list versions, and generate version ranges based on minors and patches

    version_ranges = []
    current_range: List[Union[NonSemanticVersion, SemanticVersion]] = []

    for current_version in tested_versions.versions:
        if not current_range:
            if current_version.supported:
                # Start a new version range
                current_range = [current_version]
                continue
            else:
                # We have not started a range, and we will skip this version
                continue

        if not current_version.supported:
            # We have started a range, and it finished with this version
            version_ranges.append(_version_range_to_string(current_range))
            current_range = []
            continue

        if isinstance(current_version, NonSemanticVersion):
            # Each NonSemanticVersion breaks the previous range
            version_ranges.append(_version_range_to_string(current_range))
            # Start a new version range
            current_range = [current_version]
            continue

        # If we get here, all versions in the current range are SemanticVersions and supported
        # We always break on a change of major
        if cast(SemanticVersion, current_range[0]).major < current_version.major:
            # There is a change of major
            version_ranges.append(_version_range_to_string(current_range))
            current_range = [current_version]
            continue

        current_range.append(current_version)

    # Process the last version range
    if current_range:
        version_ranges.append(_version_range_to_string(current_range))

    return version_ranges


def _version_range_to_string(
    version_range: List[Union[NonSemanticVersion, SemanticVersion]]
) -> str:
    if len(version_range) == 1:
        return version_range[0].version

    # Only SemanticVersions have ranges of more than one version
    first_version = cast(SemanticVersion, version_range[0])
    last_version = cast(SemanticVersion, version_range[len(version_range) - 1])

    return f"{first_version.major}.{first_version.minor}.{first_version.patch}{first_version.suffix}~{last_version.major}.{last_version.minor}.{last_version.patch}{last_version.suffix}"


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
        "src/instrumentations/*/tested_versions/*"
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
