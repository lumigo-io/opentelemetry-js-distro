const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = {
  entry: './src/expressAppProgrammatically.ts',
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
        'axios'
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
