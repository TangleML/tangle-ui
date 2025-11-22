export async function checkPATStatus(repository: string, pat: string) {
  const response = await fetch(`https://api.github.com/repos/${repository}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github.v3+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  return response.ok;
}
