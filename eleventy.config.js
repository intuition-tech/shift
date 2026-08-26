export default function (conf) {
  // static/ повторяет корень сайта: css и js дизайн-системы, fonts, favicon
  conf.addPassthroughCopy({ static: "/" });
  conf.addPassthroughCopy({ "src/styles/site.css": "assets/site.css" });
  conf.addPassthroughCopy({ "src/scripts/main.js": "assets/main.js" });

  conf.addWatchTarget("./src/styles/");
  conf.addWatchTarget("./src/scripts/");

  return {
    dir: {
      input: "./src/pages",
      includes: "../includes",
      output: "./site"
    },
    htmlTemplateEngine: "njk"
  };
}
