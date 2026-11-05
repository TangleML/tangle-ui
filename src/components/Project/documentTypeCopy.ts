import type { DocumentDescriptorType } from "@/services/projects/resourceDescriptor";

interface DocumentTypeCopy {
  addLabel: string;
  addDescription: string;
  nameLabel: string;
  namePlaceholder: string;
  contentPlaceholder: string;
  dropHint: string;
}

export const DOCUMENT_TYPE_COPY: Record<
  DocumentDescriptorType,
  DocumentTypeCopy
> = {
  document: {
    addLabel: "Add a document",
    addDescription: "Write a document for this project.",
    nameLabel: "Title",
    namePlaceholder: "model-card.md",
    contentPlaceholder: "What this document records",
    dropHint: "Drop to fill in the title and content",
  },
  code: {
    addLabel: "Add code",
    addDescription: "Add a code file to this project.",
    nameLabel: "Filename",
    namePlaceholder: "train.py",
    contentPlaceholder: "The source code",
    dropHint: "Drop to fill in the filename and content",
  },
};
