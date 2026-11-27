import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import type { GetUserResponse } from "@/api/types.gen";

type UserDetailsWithId = GetUserResponse & { id: string };

/**
 * Get the user details from the server.
 *
 * @returns The user details.
 */
export async function getUserDetails(backendUrl?: string) {
  const user = await getCurrentUserApiUsersMeGet(
    backendUrl === undefined ? undefined : { baseUrl: backendUrl },
  );

  if (user?.response.status !== 200 || !isAuthorizedUser(user.data)) {
    return { id: "Unknown", permissions: [] } as UserDetailsWithId;
  }

  return user.data;
}

function isAuthorizedUser(
  user: GetUserResponse | null | undefined,
): user is UserDetailsWithId {
  if (!user) {
    return false;
  }

  return user.id !== null;
}
