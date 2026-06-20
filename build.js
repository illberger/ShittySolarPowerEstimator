import fs from "fs";

const version = Date.now();

let html = fs.readFileSync("index.html", "utf8");

html = html.replace(
  "./src/main.js",
  `./src/main.js?v=${version}`
);

fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/index.html", html);

fs.cpSync("src", "dist/src", { recursive: true });
