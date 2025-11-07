const n=`import importlib
import pathlib
import json
from cloud_pipelines import components


def create_component_from_python_function_text(
    python_function_text: str,
    base_image: str = "python:3.12",
    packages_to_install: list[str] = None,
    annotations: dict[str, str] = None,
    function_name: str = None,
    add_metadata_annotations: bool = True,
):
    pathlib.Path("component_code.py").write_text(python_function_text)
    # Issue: For some reason, despite importlib.reload, Pyodide retains
    # the original module attributes (like the old function), so the
    # new module is concatenated with the old one, causing there to be two functions.
    # Fortunately, deleting the module from sys.modules fixes this.
    import sys
    try:
        del sys.modules["component_code"]
    except:
        pass
    import component_code

    importlib.reload(component_code)

    if function_name:
        function = getattr(component_code, function_name)
    else:
        functions = []
        for name in dir(component_code):
            if not name.startswith("_"):
                obj = getattr(component_code, name)
                if callable(obj) and not isinstance(obj, type):
                    functions.append(obj)
        if not functions:
            raise ValueError(f"Could not find any functions in code.")

        if len(functions) > 1:
            raise ValueError(
                f"Found multiple functions in code. Please specify function-name=name. Functions: {[func.__name__ for func in functions]}"
            )
        function = functions[0]
    
    if add_metadata_annotations:
        annotations = annotations or {}
        annotations["python_original_code"] = python_function_text
        if packages_to_install:
            annotations["python_dependencies"] = json.dumps(packages_to_install)
        annotations["cloud-pipelines.net"] = "true"
        annotations["cloud-pipelines.net/pipeline-studio-app"] = "true"

    op = components.create_component_from_func(
        func=function,
        base_image=base_image,
        packages_to_install=packages_to_install,
        annotations=annotations,
        output_component_file="component.yaml",
    )
    component_text = pathlib.Path("component.yaml").read_text()
    
    return component_text`;export{n as default};
//# sourceMappingURL=create_component_from_python_function_text-CTH31WE9.js.map
