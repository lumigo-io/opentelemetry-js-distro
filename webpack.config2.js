const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = {
  entry: './src/wrapper.ts',
  mode: 'production',
  devtool: 'source-map',
  target: 'node',
  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/,
        use: 'ts-loader',
      },
    ],
  },
  optimization: {
    minimize: false
  },
  externals: [
    nodeExternals({
      allowlist: [
        '@opentelemetry/api',
        '@opentelemetry/auto-instrumentations-node',
        '@opentelemetry/core',
        '@opentelemetry/exporter-jaeger',
        '@opentelemetry/exporter-trace-otlp-http',
        '@opentelemetry/instrumentation',
        '@opentelemetry/instrumentation-http',
        '@opentelemetry/resources',
        '@opentelemetry/sdk-node',
        '@opentelemetry/sdk-trace-base',
        '@opentelemetry/sdk-trace-node',
        '@opentelemetry/semantic-conventions',
      ],
    }),
  ],
  resolve: {
    // fallback: {
    //   "crypto": require.resolve("crypto-browserify"),
    //   util: require.resolve("util/")
    // },
    extensions: ['.tsx', '.ts', '.js'],
  },

  output: {
    globalObject: 'this',
    library: 'lumigoNodeWrapper',
    filename: 'wrapper.js',
    libraryTarget: 'umd',
    umdNamedDefine: true,
    path: path.resolve(__dirname, 'dist'),
  },
};
