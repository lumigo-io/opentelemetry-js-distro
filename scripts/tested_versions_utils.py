from __future__ import annotations

import os
import re
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Dict, Generator, List, Optional, Tuple, Union, cast

import attr

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

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, NonSemanticVersion):
            return False

        return self.version == other.version

    def __lt__(self, other: Any) -> bool:
        if not isinstance(other, NonSemanticVersion):
            return False

        return self.version < other.version

    def __repr__(self) -> str:
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

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, SemanticVersion):
            return False

        return (
            self.major == other.major
            and self.minor == other.minor
            and self.patch == other.patch
            and self.suffix == other.suffix
        )

    def __lt__(self, other: Any) -> bool:
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

    def __repr__(self) -> str:
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
        directory: str,
        python: str,
        dependency_name: str,
        dependency_version: str,
        supported: bool,
    ) -> None:
        dependency_file_path = TestedVersions.get_file_path(
            directory, python, dependency_name
        )
        TestedVersions.add_version_to_file(
            dependency_file_path, dependency_version, supported
        )

    @staticmethod
    def add_version_to_file(path: str, version: str, supported: bool) -> None:
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
        directory: str, python: str, dependency_name: str, dependency_version: str
    ) -> Generator[None, None, None]:
        if should_test_only_untested_versions():
            try:
                yield
            except Exception:
                TestedVersions._add_version_to_file(
                    directory, python, dependency_name, dependency_version, False
                )
                raise
            TestedVersions._add_version_to_file(
                directory, python, dependency_name, dependency_version, True
            )
        else:
            yield

    @staticmethod
    def get_file_path(directory: str, python: str, dependency_name: str) -> str:
        return (
            os.path.dirname(os.path.dirname(__file__))
            + f"/test/integration/{directory}/tested_versions/{python}/{dependency_name}"
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


def sort_runtime_array(runtime_array: List[str]) -> List[str]:
    unsorted_version_tuples: List[Tuple[int, int]] = [
        (int(version.split(".")[0]), int(version.split(".")[1]))
        for version in runtime_array
    ]
    return [
        ".".join([str(version[0]), str(version[1])])
        for version in sorted(unsorted_version_tuples)
    ]


def generate_support_matrix_markdown(
    src_root: Optional[str] = None,
    package_url_template: str = "https://pypi.org/project/{}",
) -> List[str]:
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

    if src_root:
        project_root = os.path.join(project_root, src_root)

    # Find all the 'tested_versions' folders and the supported runtimes
    package_support_version_directories = []
    package_support_version_runtimes = []
    for root, directories, files in os.walk(project_root):
        for directory in directories:
            if os.path.basename(directory) == "tested_versions":
                tested_versions_path = os.path.join(root, directory)
                package_support_version_directories += [tested_versions_path]
                # for each subfolder under tested_versions, we have a runtime
                for runtime in os.listdir(tested_versions_path):
                    package_support_version_runtimes += (
                        [runtime]
                        if runtime not in package_support_version_runtimes
                        else []
                    )

    package_support_version_runtimes = sort_runtime_array(
        package_support_version_runtimes
    )

    res = [
        # add on one less than the number of runtimes because "supported versions" is the first runtime's column
        f"| Instrumentation | Package | Supported Versions |{'|'.join([' ' for _ in package_support_version_runtimes[:-1]])}|",
        # | | | :---: | :---: | ... |
        f"| --- | --- | {' | '.join([':---:' for _ in package_support_version_runtimes])} |",
        # | | | 3.7 | 3.8 | ... |
        f"| | | {' | '.join(package_support_version_runtimes)} |",
    ]

    for package_support_version_directory in sorted(
        package_support_version_directories
    ):
        res += _generate_support_matrix_markdown_row(
            package_support_version_directory,
            package_support_version_runtimes,
            package_url_template,
        )

    return res


def _generate_support_matrix_markdown_row(
    tested_versions_directory: str,
    package_support_version_runtimes: List[str],
    package_url_template: str,
) -> List[str]:
    """Generate the markdown row for an instrumentation"""

    # The package name is the name of the parent of the 'tested_versions' directory
    # But there are cases, like FastAPI, where we actually test multiple packages,
    # like fastapi and uvicorn
    instrumentation = os.path.basename(os.path.dirname(tested_versions_directory))

    # initialize versions dict for all the packages we find
    versions: Dict[str, Dict[str, List[str]]] = {}
    for runtime in package_support_version_runtimes:
        runtime_path = os.path.join(tested_versions_directory, runtime)
        # if we have a folder in the tested_versions_directory that matches the runtime,
        # use that to determine which packages we have
        if os.path.isdir(runtime_path):
            package_names = os.listdir(runtime_path)
            for package_name in package_names:
                if package_name not in versions.keys():
                    versions[package_name] = {
                        package_support_version_runtime: []
                        for package_support_version_runtime in package_support_version_runtimes
                    }
                tested_versions_path = os.path.join(
                    tested_versions_directory, runtime, package_name
                )
                # if tested_versions_path exists then we have a package that is tested for this runtime
                if os.path.exists(tested_versions_path):
                    versions[package_name][runtime] = _get_supported_version_ranges(
                        TestedVersions.from_file(tested_versions_path)
                    )

    res = []
    is_instrumentation_written = False
    for package_name in versions:
        displayed_instrumentation = ""
        if not is_instrumentation_written:
            displayed_instrumentation = instrumentation
            is_instrumentation_written = True

        first_row = f"| {displayed_instrumentation} | [{package_name}]({package_url_template.format(package_name)}) | "
        for runtime in package_support_version_runtimes:
            if len(versions[package_name][runtime]) > 0:
                first_row += versions[package_name][runtime][0] + "|"
            else:
                first_row += " |"
        res.append(first_row)

        # as long as there are more rows, add them
        row_num = 1
        while True:
            row_found = False
            for runtime in package_support_version_runtimes:
                if len(versions[package_name][runtime]) > row_num:
                    row_found = True
            if not row_found:
                break
            next_row = "| | |"
            for runtime in package_support_version_runtimes:
                if len(versions[package_name][runtime]) > row_num:
                    next_row += " " + versions[package_name][runtime][row_num] + "|"
                else:
                    next_row += " |"
            res.append(next_row)
            row_num += 1

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
