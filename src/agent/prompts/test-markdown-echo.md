# H1: Pipeline assistant test

## H2: Section heading

### H3: Subsection

#### H4: Smallest heading

A paragraph with **bold**, _italic_, ~~strikethrough~~, and `inline code`.
Soft line break here
and another line.

---

## Lists

Unordered list:

- First item
- Second item with `inline code`
- Nested:
  - Nested item one
  - Nested item two
- Last item

Ordered list:

1. Step one
2. Step two
3. Step three

Task list (GFM):

- [x] Completed task
- [ ] Pending task

---

## Blockquote

> This is a blockquote. It should render with a left border, italic, and muted color.
>
> Second paragraph inside the blockquote.

---

## Table (GFM)

| Component       | Status | Notes                     |
| --------------- | :----: | ------------------------- |
| Data loader     |   OK   | Reads from GCS            |
| Training task   |  FAIL  | OOM at epoch 3            |
| Evaluation task |   --   | Skipped (upstream failed) |

---

## Code

Inline: use `pipeline.run()` to submit.

Fenced block with language (renders via `CodeBlock`):

```python
def train(model, data):
    for batch in data:
        loss = model.step(batch)
        print(f"loss={loss:.4f}")
    return model
```

Fenced block without a language (falls through to plain `<code>`):

```
no language tag here
just monospace
```

---

## Links and chips

Regular external link: [OpenAI docs](https://platform.openai.com/docs).

- Entity chip (task): [Train model](entity://task-train-001).
- Entity chip (input): [training_data](entity://input-data-001).
- Entity chip (output): [trained_model](entity://output-model-001).
- Entity chip (unknown id, renders as question mark): [missing-thing](entity://does-not-exist).

- Component chip with backing ref (renders draggable `ComponentChip`):
  [Format date and time](component://7784069b3bd1301674cfb4bbf7170b7db91ffd289138eb2d8838e3368158b70c).

- Component chip whose id is missing from `componentReferences` (falls through to the `<span>` fallback):
  [unknown component](component://not-in-refs).
