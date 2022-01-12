/* global module, __dirname */
const HTMLWebpackPlugin = require('html-webpack-plugin');
const common = require("./webpack.common.js");
const path = require("path");
const { merge } = require("webpack-merge");

module.exports = merge(common, {
    mode: "development",
    devtool: "inline-source-map",
    devServer: {
        static: [ path.resolve(__dirname, '') ],
        port: 3003
    },
    plugins: [
        new HTMLWebpackPlugin({
            title: 'Converse.js Dev',
            template: 'webpack.html',
            filename: 'index.html'
        })
    ],
});
