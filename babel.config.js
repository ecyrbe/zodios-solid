const loose = true;

module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        loose,
        modules: false,
        exclude: [
          "@babel/plugin-transform-regenerator",
          "@babel/plugin-transform-parameters",
        ],
      },
    ],
    "@babel/preset-typescript",
    "babel-preset-solid",
  ],
  plugins: [["@babel/transform-modules-commonjs", { loose }]],
};
