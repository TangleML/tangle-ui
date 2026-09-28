# Component Discovery

Tangle provides component discovery in both the dashboard and the pipeline editor. Use it to find reusable components, compare component sources, and understand how a component might fit into a pipeline before adding it.

## Where to search

### Dashboard Components page

Open the dashboard **Components** page for the richest discovery view. The dashboard search includes:

- component results across all available sources
- source filters
- shareable search and selected-component URLs
- lifecycle badges and component details
- compatible component suggestions
- optional AI reranking when an AI provider is configured

When you select a component, the detail pane shows the component description, inputs, outputs, implementation details, lifecycle metadata when available, and compatible component suggestions.

### Editor component search

Use the editor component search when you are building a pipeline and want to add a component quickly. Editor search uses the same local component index and can show why a component matched your query. You can drag or select matching components from the result list as part of the normal editor workflow.

## Component sources

Search combines the component sources available to the app:

| Source               | What it contains                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Standard             | Components bundled with or loaded by the app's standard component library.               |
| Published            | Components available from your configured backend.                                       |
| Registered libraries | Components from registered external libraries, such as remote or GitHub-based libraries. |
| User generated       | Components saved locally by the user.                                                    |

The dashboard shows source filters when multiple source types are available. Turn source filters on or off to narrow results without changing the query. Registered libraries can also appear as collection results when the query matches the library name.

## How local search works

Component search is frontend-owned and works without a private semantic search service. It builds a local index from component data that is already available to the app.

Search can match:

- component names
- descriptions
- input and output names, types, and descriptions
- selected metadata annotations
- implementation command text

Registered library names can also appear as collection results when the query matches the library name.

Queries are normalized so common naming styles are easier to match. For example, search handles snake case, kebab case, camel case, simple plurals, and common term variants. Search also has limited typo tolerance for names and input/output fields.

You can exclude concepts with negative terms. For example, a query like `train not pandas` searches for training-related components while filtering out matches related to pandas.

## Understanding results

Result cards can show why a component matched. A `Why: ...` explanation may mention fields such as name, description, inputs/outputs, implementation, or metadata.

When no components match, Tangle shows suggested searches such as `csv`, `train`, `predict`, and `dataframe`. Select a suggestion to replace the current query and run that search.

The dashboard browse view shows an initial set of components and lets you load more. This keeps large libraries responsive while still allowing you to browse everything.

## Lifecycle badges

Components can show lifecycle badges when existing metadata marks them as deprecated or superseded. Tangle does not invent lifecycle state. It only displays lifecycle information already present on the component reference or component metadata annotations.

A superseded component may include a replacement digest when the metadata provides one. Components without lifecycle metadata appear normally.

## Compatible component suggestions

When a component is selected in the dashboard, Tangle can suggest compatible components based on local input and output type metadata:

- downstream suggestions can use the selected component's outputs
- upstream suggestions can provide the selected component's inputs

Compatibility suggestions are best-effort and local. They skip components without enough type metadata and ignore unconstrained `Any` types.

## Optional AI search

If an OpenAI-compatible AI provider is configured, the dashboard and editor can use AI search to rerank matching local candidates. AI search is optional and does not replace local search.

AI search is bounded:

- it reranks a limited local candidate pool
- when client-side embeddings are configured, semantic matches can supplement lexical matches
- it sends compact component summaries, not the full component implementation

If AI search is unavailable or not configured, local search still works.

## Sharing component links

The dashboard Components page stores search text, source filters, and the selected component in the URL. Use the component detail actions to copy a link to the current component context. Opening the link restores the search and selected component state where possible.
