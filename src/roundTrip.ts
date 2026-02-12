import { MyApiV1 } from "../data/dist/example.js";
import fs from "fs";

function roundTrip() {
  const message = MyApiV1.MyMessage.encode({
    value: "Hello World!",
    value2: "Another value",
  }).finish();
  fs.writeFileSync("message.bin", message);

  const buffer = fs.readFileSync("message.bin");
  const decoded = MyApiV1.MyMessage.decode(buffer);
  console.log(decoded.value);
}

roundTrip();
