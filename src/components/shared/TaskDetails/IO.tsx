import { Badge } from "@/components/ui/badge";
import type { ComponentSpec } from "@/utils/componentSpec";

interface TaskIOProps {
  componentSpec: ComponentSpec;
}

const TaskIO = ({ componentSpec }: TaskIOProps) => {
  return (
    <div className="h-full overflow-auto hide-scrollbar">
      {componentSpec?.inputs && componentSpec.inputs.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Inputs</h4>
          <div className="border rounded-md divide-y">
            {componentSpec.inputs.map((input, index) => (
              <div key={index} className="flex flex-col px-3 py-2 gap-2">
                <div className="shrink-0 font-bold text-sm text-gray-700 mb-1">
                  {input.name.replace(/_/g, " ")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!input.optional && (
                    <Badge className="bg-rose-400 text-white">Required</Badge>
                  )}
                  {input.type && <Badge>Type: {String(input.type)}</Badge>}
                </div>
                <div className="text-gray-600 break-all text-xs font-bold">
                  {input.default !== undefined && (
                    <>
                      Default:{" "}
                      <span className="font-normal">
                        {String(input.default)}
                      </span>
                    </>
                  )}
                </div>
                {input.description && (
                  <div className="text-gray-600 break-words text-xs">
                    {input.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {componentSpec?.outputs && componentSpec.outputs.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Outputs</h4>
          <div className="border rounded-md divide-y">
            {componentSpec.outputs.map((output) => (
              <div key={output.name} className="flex flex-col px-3 py-2 gap-2">
                <div className="shrink-0 font-bold text-sm text-gray-700 mb-1">
                  {output.name.replace(/_/g, " ")}
                </div>
                {output.type && <Badge>Type: {String(output.type)}</Badge>}
                {output.description && (
                  <div className="text-muted-foreground break-words text-xs">
                    {output.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskIO;
