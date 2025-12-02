import { InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/typography";
import {
  ABOUT_URL,
  BOTTOM_FOOTER_HEIGHT,
  GIT_COMMIT,
  GIT_REPO_URL,
  GIVE_FEEDBACK_URL,
  PRIVACY_POLICY_URL,
} from "@/utils/constants";

function AppFooter() {
  return (
    <footer
      className="footer w-full px-4 text-center bg-gray-50"
      style={{ height: `${BOTTOM_FOOTER_HEIGHT}px` }}
    >
      <InlineStack className="w-full" align="space-between">
        <div />
        <InlineStack gap="1" blockAlign="center">
          <Link
            href={ABOUT_URL}
            className="mx-1.5 text-blue-600 hover:text-blue-800 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            About
          </Link>
          <Link
            href={GIVE_FEEDBACK_URL}
            className="mx-1.5 text-blue-600 hover:text-blue-800 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Give feedback
          </Link>
          <Link
            href={PRIVACY_POLICY_URL}
            className="mx-1.5 text-blue-600 hover:text-blue-800 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy policy
          </Link>
          Version:
          <Link
            href={`${GIT_REPO_URL}/commit/${GIT_COMMIT}`}
            className="mx-1.5 text-blue-600 hover:text-blue-800 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {GIT_COMMIT.substring(0, 6)}
          </Link>
        </InlineStack>
        <Text size="xs" font="mono" tone="subdued">
          Built with{" "}
          <Link
            href="https://reactflow.dev"
            className="text-blue-400 hover:text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            ReactFlow
          </Link>
        </Text>
      </InlineStack>
    </footer>
  );
}

export default AppFooter;
