import { api } from "../data/dist/example.js";
import fs from "fs";

const message = api.MyMessage.encode({ value: "Hello World!" }).finish();
fs.writeFileSync("message.bin", message);

const buffer = fs.readFileSync("message.bin");
const decoded = api.MyMessage.decode(buffer);
console.log(decoded.value);
