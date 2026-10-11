/** @type {import("prettier").Config} */
export default {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  useTabs: false,
  trailingComma: "all",
  printWidth: 100,
  endOfLine: "lf",
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindConfig: "./tailwind.config.ts",
  tailwindAttributes: ["className", "class"],
};
