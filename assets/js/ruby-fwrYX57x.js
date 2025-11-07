const e=`name: Filter text using Ruby
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
    image: ruby:3.4.3
    command:
    - sh
    - -ec
    - |
      # This is how additional gems can be installed dynamically
      # gem install something
      # Run the rest of the command after installing the gems.
      "$0" "$@"
    - ruby
    - -e
    - |
      require 'fileutils'

      text_path = ARGV[0]
      pattern = ARGV[1]
      filtered_text_path = ARGV[2]

      regex = Regexp.new(pattern)

      # Create the directory for the output file if it doesn't exist
      FileUtils.mkdir_p(File.dirname(filtered_text_path))

      # Open the input file for reading
      File.open(text_path, 'r') do |reader|
        # Open the output file for writing
        File.open(filtered_text_path, 'w') do |writer|
          reader.each_line do |line|
            if regex.match(line)
              writer.write(line)
            end
          end
        end
      end

    - {inputPath: Text}
    - {inputValue: Pattern}
    - {outputPath: Filtered text}`;export{e as default};
//# sourceMappingURL=ruby-fwrYX57x.js.map
