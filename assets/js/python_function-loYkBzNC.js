const t=`from cloud_pipelines import components

def filter_text(
    # The InputPath() annotation makes the system pass a local input path where the function can read the input data.
    text_path: components.InputPath(),
    # The OutputPath() annotation makes the system pass a local output path where the function should write the output data.
    filtered_text_path: components.OutputPath(),
    pattern: str = ".*",
):
    """Filters text.

    Filtering is performed using regular expressions.

    Args:
        text_path: The source text
        pattern: The regular expression pattern
        filtered_text_path: The filtered text
    """
    # Function must be self-contained.
    # So all import statements must be inside the function.
    import os
    import re

    regex = re.compile(pattern)

    os.makedirs(os.path.dirname(filtered_text_path), exist_ok=True)
    with open(text_path, "r") as reader:
        with open(filtered_text_path, "w") as writer:
            for line in reader:
                if regex.search(line):
                    writer.write(line)`;export{t as default};
//# sourceMappingURL=python_function-loYkBzNC.js.map
