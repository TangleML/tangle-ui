// Side-effect imports that populate the workarea registry. Import this once at
// the Tangent page root so every kind is registered before any workarea tab
// renders, instead of coupling registration to whichever component happens to
// import a kind first.
import "./artifactKind";
import "./documentKind";
import "./pipelineKind";
import "./runKind";
