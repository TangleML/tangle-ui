import {
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useReducer,
  useRef,
} from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input, InputGroup } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";

import type { YamlGeneratorOptions } from "../types";

type Annotation = { id: number; key: string; value: string };
type YamlOptionsEditorState = Pick<
  YamlGeneratorOptions,
  "baseImage" | "packagesToInstall"
> & {
  annotations: Annotation[];
};

type YamlGeneratorOptionsStateAction =
  | { type: "SET_BASE_IMAGE"; payload: string }
  | { type: "ADD_PACKAGE"; payload: string }
  | { type: "UPDATE_PACKAGE"; index: number; value: string }
  | { type: "REMOVE_PACKAGE"; index: number }
  | { type: "ADD_ANNOTATION"; payload: { key: string; value: string } }
  | { type: "UPDATE_ANNOTATION"; id: number; key: string; value: string }
  | { type: "REMOVE_ANNOTATION"; id: number };

export const YamlGeneratorOptionsEditor = ({
  onChange,
  initialOptions,
}: {
  initialOptions: YamlGeneratorOptions;
  onChange: (options: YamlGeneratorOptions) => void;
}) => {
  const { state, dispatch } = useYamlGeneratorOptionsReducer(initialOptions);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    onChangeRef.current({
      baseImage: state.baseImage,
      packagesToInstall: state.packagesToInstall?.filter(Boolean) ?? [],
      annotations: Object.fromEntries(
        state.annotations
          .filter(({ key, value }) => key && value)
          .map(({ key, value }) => [key, value]),
      ),
    });
  }, [state]);

  return (
    <BlockStack className="flex-1 relative px-1" gap="4">
      <Section
        title="Container Image"
        description='The container image to use for the component. Default is "python:3.12".'
      >
        <Input
          name="container-image"
          placeholder="python:3.12"
          value={state.baseImage}
          onChange={(e) =>
            dispatch({ type: "SET_BASE_IMAGE", payload: e.target.value })
          }
        />
      </Section>

      <Section
        title="Packages to Install"
        description="The PIP packages to install in the container."
        actions={
          <AddButton
            onClick={() => dispatch({ type: "ADD_PACKAGE", payload: "" })}
          />
        }
      >
        {state.packagesToInstall?.map((pkg, index) => (
          <InputGroup
            key={`${pkg}-${index}`}
            className="w-full group"
            suffixElement={
              <RemoveButton
                onClick={() => dispatch({ type: "REMOVE_PACKAGE", index })}
              />
            }
          >
            <Input
              variant="noBorder"
              placeholder="Package name"
              defaultValue={pkg}
              onBlur={(e) =>
                dispatch({
                  type: "UPDATE_PACKAGE",
                  index,
                  value: e.target.value,
                })
              }
            />
          </InputGroup>
        ))}
      </Section>

      <Section
        title="Annotations"
        description="The annotations to add to the component. Empty values will be ignored in the final YAML."
        actions={
          <AddButton
            onClick={() =>
              dispatch({
                type: "ADD_ANNOTATION",
                payload: { key: "", value: "" },
              })
            }
          />
        }
      >
        {(state.annotations ?? []).map(({ id, key, value }) => (
          <InlineStack
            key={`annotation-${id}`}
            align="space-between"
            className="w-full group"
            gap="1"
          >
            <InlineStack wrap="nowrap" className="flex-1" gap="1">
              <Input
                className="w-full"
                placeholder="Annotation key"
                defaultValue={key}
                onBlur={(e) =>
                  dispatch({
                    type: "UPDATE_ANNOTATION",
                    id,
                    key: e.target.value,
                    value,
                  })
                }
              />
              <Text>:</Text>
            </InlineStack>
            <InlineStack wrap="nowrap" className="flex-1">
              <Input
                className="w-full"
                placeholder="Annotation value"
                defaultValue={value}
                onBlur={(e) =>
                  dispatch({
                    type: "UPDATE_ANNOTATION",
                    id,
                    key,
                    value: e.target.value,
                  })
                }
              />
              <RemoveButton
                onClick={() => dispatch({ type: "REMOVE_ANNOTATION", id })}
              />
            </InlineStack>
          </InlineStack>
        ))}
      </Section>
    </BlockStack>
  );
};

let autoincrementId = 0;

function yamlGeneratorOptionsReducer(
  state: YamlOptionsEditorState,
  action: YamlGeneratorOptionsStateAction,
): YamlOptionsEditorState {
  switch (action.type) {
    case "SET_BASE_IMAGE":
      return { ...state, baseImage: action.payload };

    case "ADD_PACKAGE":
      return {
        ...state,
        packagesToInstall: [...(state.packagesToInstall ?? []), action.payload],
      };
    case "UPDATE_PACKAGE":
      return {
        ...state,
        packagesToInstall: (state.packagesToInstall ?? []).map((pkg, index) =>
          index === action.index ? action.value : pkg,
        ),
      };
    case "REMOVE_PACKAGE":
      return {
        ...state,
        packagesToInstall: (state.packagesToInstall ?? []).filter(
          (_, index) => index !== action.index,
        ),
      };
    case "ADD_ANNOTATION":
      return {
        ...state,
        annotations: [
          ...(state.annotations ?? []),
          { id: autoincrementId++, ...action.payload },
        ],
      };
    case "UPDATE_ANNOTATION":
      return {
        ...state,
        annotations: (state.annotations ?? []).map((annotation) =>
          annotation.id === action.id
            ? { ...annotation, key: action.key, value: action.value }
            : annotation,
        ),
      };
    case "REMOVE_ANNOTATION":
      if (!state.annotations) return state;
      return {
        ...state,
        annotations: (state.annotations ?? []).filter(
          (annotation) => annotation.id !== action.id,
        ),
      };
    default:
      return state;
  }
}

function useYamlGeneratorOptionsReducer(
  initial?: Partial<YamlGeneratorOptions>,
) {
  const [state, dispatch] = useReducer(yamlGeneratorOptionsReducer, {
    baseImage: initial?.baseImage ?? "python:3.12",
    packagesToInstall: initial?.packagesToInstall ?? [],
    annotations:
      Object.entries(initial?.annotations ?? {}).map(([key, value]) => ({
        key,
        value,
        id: autoincrementId++,
      })) ?? [],
  });
  return { state, dispatch };
}

const RemoveButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <Button
      variant="ghost"
      size="xs"
      className="group-hover:visible group-focus-within:visible invisible"
      onClick={onClick}
    >
      <Icon name="Trash" className="text-destructive" />
    </Button>
  );
};

const AddButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <Button variant="ghost" size="xs" onClick={onClick}>
      <Icon name="CirclePlus" /> Add
    </Button>
  );
};

const Section = ({
  title,
  description,
  actions,
  children,
}: PropsWithChildren<{
  title: string;
  description?: string;
  actions?: ReactNode;
}>) => {
  return (
    <BlockStack gap="3" className="border rounded-md p-3">
      <BlockStack>
        <InlineStack align="space-between" className="w-full">
          <Heading level={2}>{title}</Heading>
          {actions}
        </InlineStack>
        {description && (
          <Paragraph tone="subdued" size="xs">
            {description}
          </Paragraph>
        )}
      </BlockStack>

      <BlockStack gap="1">{children}</BlockStack>
    </BlockStack>
  );
};
