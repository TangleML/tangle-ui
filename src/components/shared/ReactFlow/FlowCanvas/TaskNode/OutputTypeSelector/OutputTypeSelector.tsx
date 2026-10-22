import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AggregatorOutputType } from "@/types/aggregator";

interface OutputTypeSelectorProps {
  value: AggregatorOutputType;
  onChange: (value: AggregatorOutputType) => void;
  disabled?: boolean;
}

export const OutputTypeSelector = ({
  value,
  onChange,
  disabled = false,
}: OutputTypeSelectorProps) => {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={AggregatorOutputType.JsonArray}>
          JSON Array
        </SelectItem>
        <SelectItem value={AggregatorOutputType.JsonObject}>
          JSON Object
        </SelectItem>
        <SelectItem value={AggregatorOutputType.CSV}>CSV Data</SelectItem>
      </SelectContent>
    </Select>
  );
};
