import 'jest-json';

import { ProcessEnvironmentDetector } from './ProcessEnvironmentDetector';

describe('ProcessEnvironmentDetector', () => {
  const ORIGINAL_PROCESS_ENV = process.env;

  afterAll(() => {
    process.env = ORIGINAL_PROCESS_ENV;
  });

  beforeEach(() => {
    /*
     * We have a limit on the size of env we sent to the backend, and the env
     * in the CI/CD goes over the limit, so the additional env vars we want to
     * check for scrubbing get dropped.
     */
    process.env = {};
  });

  test('truncates deterministically', async () => {
    process.env = JSON.parse(
      `{"GITHUB_STATE":"/home/runner/work/_temp/_runner_file_commands/save_state_466477c7-d154-466f-ab62-c37433b53aaf","npm_package_devDependencies__types_node":"^17.0.23","npm_package_devDependencies_aws_sdk":"^2.1066.0","npm_package_devDependencies_semantic_release":"^19.0.2","npm_package_devDependencies_ts_node":"^9.1.1","npm_config_cache_lock_stale":"60000","npm_config_ham_it_up":"","STATS_TRP":"true","DEPLOYMENT_BASEPATH":"/opt/runner","DOTNET_NOLOGO":"1","npm_package_devDependencies_body_parser":"^1.19.1","npm_config_legacy_bundling":"","npm_config_sign_git_tag":"","USER":"runner","npm_package_dependencies__opentelemetry_instrumentation_http":"0.38.0","npm_package_devDependencies_jest":"^29.4.0","npm_package_devDependencies_webpack_cli":"^4.10.0","npm_config_user_agent":"npm/6.14.18 node/v14.21.3 linux x64 ci/github-actions","npm_config_always_auth":"","LUMIGO_ENDPOINT":"https://walle-edge-app-us-west-2.walle.golumigo.com","CI":"true","npm_package_dependencies__opentelemetry_resources":"1.9.0","npm_package_dependencies_opentelemetry_instrumentation_express":"0.35.0","npm_package_bugs_url":"https://github.com/lumigo-io/opentelemetry-js-distro/issues","npm_config_bin_links":"true","npm_config_key":"","GITHUB_ENV":"/home/runner/work/_temp/_runner_file_commands/set_env_466477c7-d154-466f-ab62-c37433b53aaf","PIPX_HOME":"/opt/pipx","npm_package_devDependencies_mock_http_server":"^1.4.5","npm_config_allow_same_version":"","npm_config_description":"true","npm_config_fetch_retries":"2","npm_config_heading":"npm","npm_config_if_present":"","npm_config_init_version":"1.0.0","npm_config_user":"1001","npm_node_execpath":"/opt/hostedtoolcache/node/14.21.3/x64/bin/node","JAVA_HOME_8_X64":"/usr/lib/jvm/temurin-8-jdk-amd64","SHLVL":"1","npm_package_dependencies__opentelemetry_instrumentation":"0.38.0","npm_package_devDependencies__types_express":"^4.17.8","npm_package_devDependencies_wait_on":"^6.0.1","npm_config_prefer_online":"","npm_config_noproxy":"","HOME":"/home/runner","npm_package_devDependencies__babel_plugin_proposal_class_properties":"SOOOOOOOOO VEEEEEEERY L${new Array(
        600
      ).join('O')}NG", "zzzzz":"zzzzz"}`
    );

    const resource = await new ProcessEnvironmentDetector().detect();

    expect(resource.attributes['process.environ']).toEqual(
      `{"GITHUB_STATE":"/home/runner/work/_temp/_runner_file_commands/save_state_466477c7-d154-466f-ab62-c37433b53aaf","npm_package_devDependencies__types_node":"^17.0.23","npm_package_devDependencies_aws_sdk":"^2.1066.0","npm_package_devDependencies_semantic_release":"^19.0.2","npm_package_devDependencies_ts_node":"^9.1.1","npm_config_cache_lock_stale":"60000","npm_config_ham_it_up":"","STATS_TRP":"true","DEPLOYMENT_BASEPATH":"/opt/runner","DOTNET_NOLOGO":"1","npm_package_devDependencies_body_parser":"^1.19.1","npm_config_legacy_bundling":"","npm_config_sign_git_tag":"","USER":"runner","npm_package_dependencies__opentelemetry_instrumentation_http":"0.38.0","npm_package_devDependencies_jest":"^29.4.0","npm_package_devDependencies_webpack_cli":"^4.10.0","npm_config_user_agent":"npm/6.14.18 node/v14.21.3 linux x64 ci/github-actions","npm_config_always_auth":"","LUMIGO_ENDPOINT":"https://walle-edge-app-us-west-2.walle.golumigo.com","CI":"true","npm_package_dependencies__opentelemetry_resources":"1.9.0","npm_package_dependencies_opentelemetry_instrumentation_express":"0.35.0","npm_package_bugs_url":"https://github.com/lumigo-io/opentelemetry-js-distro/issues","npm_config_bin_links":"true","npm_config_key":"","GITHUB_ENV":"/home/runner/work/_temp/_runner_file_commands/set_env_466477c7-d154-466f-ab62-c37433b53aaf","PIPX_HOME":"/opt/pipx","npm_package_devDependencies_mock_http_server":"^1.4.5","npm_config_allow_same_version":"","npm_config_description":"true","npm_config_fetch_retries":"2","npm_config_heading":"npm","npm_config_if_present":"","npm_config_init_version":"1.0.0","npm_config_user":"1001","npm_node_execpath":"/opt/hostedtoolcache/node/14.21.3/x64/bin/node","JAVA_HOME_8_X64":"/usr/lib/jvm/temurin-8-jdk-amd64","SHLVL":"1","npm_package_dependencies__opentelemetry_instrumentation":"0.38.0","npm_package_devDependencies__types_express":"^4.17.8","npm_package_devDependencies_wait_on":"^6.0.1","npm_config_prefer_online":"","npm_config_noproxy":"","HOME":"/home/runner","npm_package_devDependencies__babel_plugin_proposal_class_properties":"✂"}`
    );
  });
});
