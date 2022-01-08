require('dotenv').config();

const { LambdaELB } = require("@eyevinn/dev-lambda");
(new LambdaELB(require("./dist/index.js"))).run();
