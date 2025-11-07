const t=`name: Filter text using shell and grep
inputs:
- {name: Text}
- {name: Pattern, default: '.*'}
outputs:
- {name: Filtered text}
metadata:
  annotations:
    author: Your Name <email@address.com>
implementation:
  container:
    image: alpine
    command:
    - sh
    - -ec
    - |
      text_path=$0
      pattern=$1
      filtered_text_path=$2
      mkdir -p "$(dirname "$filtered_text_path")"

      grep "$pattern" < "$text_path" > "$filtered_text_path"
    - {inputPath: Text}
    - {inputValue: Pattern}
    - {outputPath: Filtered text}`;export{t as default};
//# sourceMappingURL=bash-C3Eco8dr.js.map
