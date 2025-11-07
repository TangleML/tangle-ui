const n=`name: Filter text with pattern using JavaScript
inputs:
- {name: Text}
- {name: Pattern, type: String, default: '.*'}
outputs:
- {name: Filtered text}
metadata:
  annotations:
    author: Your Name <email@address.com>
implementation:
  container:
    image: node:18.0.0-slim
    command:
    - node
    - --eval
    - |
      const fs = require("fs");
      const readline = require("readline");
      const path = require("path");

      // Skip 1 argument when running the script using node --eval
      // Skip 2 arguments when running from file: \`node grep.js\`.
      const args = process.argv.slice(1);
      const input_path = args[0];
      const pattern = args[1];
      const output_path = args[2];

      fs.mkdirSync(path.dirname(output_path), { recursive: true });
      const inputStream = fs.createReadStream(input_path);
      const outputStream = fs.createWriteStream(output_path, { encoding: "utf8" });
      var lineReader = readline.createInterface({
        input: inputStream,
        terminal: false,
      });
      lineReader.on("line", function (line) {
        if (line.match(pattern)) {
          outputStream.write(line + "\\n");
        }
      });
    - {inputPath: Text}
    - {inputValue: Pattern}
    - {outputPath: Filtered text}`;export{n as default};
//# sourceMappingURL=javascript-C_VrdkgD.js.map
