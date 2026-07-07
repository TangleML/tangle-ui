import { useEffect, useState } from "react";

import {
  type ComponentFileEntry,
  getAllComponentFilesFromList,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

const useLoadUserPipelines = () => {
  const [isLoadingUserPipelines, setIsLoadingUserPipelines] = useState(true);
  const [userPipelines, setUserPipelines] = useState<
    Map<string, ComponentFileEntry>
  >(new Map());

  const fetchUserPipelines = async () => {
    setIsLoadingUserPipelines(true);
    try {
      const pipelines = await getAllComponentFilesFromList(
        USER_PIPELINES_LIST_NAME,
      );
      setUserPipelines(pipelines);
    } catch (error) {
      console.error("Failed to load user pipelines:", error);
    } finally {
      setIsLoadingUserPipelines(false);
    }
  };

  const refetch = async () => {
    setIsLoadingUserPipelines(true);
    try {
      await fetchUserPipelines();
    } catch (error) {
      console.error("Failed to refetch user pipelines:", error);
    } finally {
      setIsLoadingUserPipelines(false);
    }
  };

  useEffect(() => {
    fetchUserPipelines();
  }, []);

  return { userPipelines, isLoadingUserPipelines, refetch };
};

export default useLoadUserPipelines;
