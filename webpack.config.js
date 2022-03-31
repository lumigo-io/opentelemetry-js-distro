const path = require('path');

module.exports = {
  entry: './src/wrapper.ts',
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/,
        use: 'ts-loader'
      },
    ],
  },
  resolve: {
    modules: ['node_modules'],
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'wrapper.js',
    path: path.resolve(__dirname, 'lib'),
  },
};