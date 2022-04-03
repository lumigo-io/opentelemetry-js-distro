const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = {
  entry: './src/wrapper.ts',
  mode: "production",
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/,
        exclude: /node_modules/,
        use: 'ts-loader'
      },
    ],
  },
  externals: [ nodeExternals() ],
  resolve: {
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      util: require.resolve("util/")
    },
    modules: ['node_modules', path.join(__dirname, 'src')],
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    globalObject: 'this',
    library: 'lumigoNodeWrapper',
    filename: 'wrapper.js',
    libraryTarget: 'umd',
    umdNamedDefine: true,
    path: path.resolve(__dirname, 'bundle'),
  },
};