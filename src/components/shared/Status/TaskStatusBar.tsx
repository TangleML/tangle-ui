import type { TaskStatusCounts } from "@/types/pipelineRun";

const getSegmentStyle = (width: string, hatched: boolean = false) =>
  hatched
    ? {
        width,
        height: "100%",
        backgroundImage:
          "repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(0,0,0,0.5) 6px, rgba(0,0,0,0.5) 12px)",
        backgroundBlendMode: "multiply",
        backgroundRepeat: "repeat",
        backgroundSize: "512px 24px",
        backgroundPosition: "left top",
      }
    : { width, height: "100%" };

const TaskStatusBar = ({
  statusCounts,
}: {
  statusCounts?: TaskStatusCounts;
}) => {
  if (!statusCounts || statusCounts.total === 0) {
    return (
      <div className="flex h-2 w-full rounded overflow-hidden bg-gray-200"></div>
    );
  }

  const { total, succeeded, failed, running, waiting, skipped, cancelled } =
    statusCounts;

  // Calculate percentages for each segment
  const successWidth = `${(succeeded / total) * 100}%`;
  const failedWidth = `${(failed / total) * 100}%`;
  const runningWidth = `${(running / total) * 100}%`;
  const waitingWidth = `${(waiting / total) * 100}%`;
  const skippedWidth = `${(skipped / total) * 100}%`;
  const cancelledWidth = `${(cancelled / total) * 100}%`;

  const hatched = cancelled > 0;

  return (
    <div className="flex h-2 w-full rounded overflow-hidden bg-gray-200">
      {succeeded > 0 && (
        <div
          className="bg-green-500"
          style={getSegmentStyle(successWidth, hatched)}
        ></div>
      )}
      {failed > 0 && (
        <div
          className="bg-red-500"
          style={getSegmentStyle(failedWidth, hatched)}
        ></div>
      )}
      {running > 0 && (
        <div
          className="bg-blue-500"
          style={getSegmentStyle(runningWidth, hatched)}
        ></div>
      )}
      {waiting > 0 && (
        <div
          className="bg-yellow-500"
          style={getSegmentStyle(waitingWidth, hatched)}
        ></div>
      )}
      {skipped > 0 && (
        <div
          className="bg-gray-800"
          style={getSegmentStyle(skippedWidth, hatched)}
        ></div>
      )}
      {cancelled > 0 && (
        <div
          className="bg-gray-500"
          style={getSegmentStyle(cancelledWidth, hatched)}
        ></div>
      )}
    </div>
  );
};

export default TaskStatusBar;
