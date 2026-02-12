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
}

export const OutputTypeSelector = ({
  value,
  onChange,
}: OutputTypeSelectorProps) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={AggregatorOutputType.JsonArray}>JSON Array</SelectItem>
        <SelectItem value={AggregatorOutputType.JsonObject}>JSON Object</SelectItem>
        <SelectItem value={AggregatorOutputType.CSV}>CSV Data</SelectItem>
      </SelectContent>
    </Select>
  );
};
