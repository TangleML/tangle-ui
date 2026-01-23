import { InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/typography";
import {
  ABOUT_URL,
  BOTTOM_FOOTER_HEIGHT,
  DOCUMENTATION_URL,
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
        <InlineStack gap="4">
          <Link href={ABOUT_URL} target="_blank" rel="noopener noreferrer">
            About
          </Link>
          <Link
            href={GIVE_FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Give feedback
          </Link>
          <Link
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy policy
          </Link>
          <Link
            href={DOCUMENTATION_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </Link>
          <InlineStack gap="1">
            Version:
            <Link
              href={`${GIT_REPO_URL}/commit/${GIT_COMMIT}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {GIT_COMMIT.substring(0, 6)}
            </Link>
          </InlineStack>
        </InlineStack>
        <Text size="xs" font="mono" tone="subdued">
          Built with{" "}
          <Link
            href="https://reactflow.dev"
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
