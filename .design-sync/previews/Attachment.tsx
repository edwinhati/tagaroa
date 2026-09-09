import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@repo/ui";
import { DownloadIcon, FileTextIcon, XIcon } from "lucide-react";

export const Done = () => (
  <Attachment>
    <AttachmentMedia>
      <FileTextIcon />
    </AttachmentMedia>
    <AttachmentContent>
      <AttachmentTitle>
        Supplier contract — Kessler Logistics.pdf
      </AttachmentTitle>
      <AttachmentDescription>Signed 18 Aug · 412 KB</AttachmentDescription>
    </AttachmentContent>
    <AttachmentActions>
      <AttachmentAction aria-label="Download">
        <DownloadIcon />
      </AttachmentAction>
      <AttachmentAction aria-label="Remove">
        <XIcon />
      </AttachmentAction>
    </AttachmentActions>
  </Attachment>
);

export const States = () => (
  <AttachmentGroup className="max-w-full">
    <Attachment state="uploading">
      <AttachmentMedia>
        <FileTextIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>Subsidiary onboarding checklist.docx</AttachmentTitle>
        <AttachmentDescription>Uploading · 2.1 MB</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
    <Attachment state="processing">
      <AttachmentMedia>
        <FileTextIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>Q3 audit log export.csv</AttachmentTitle>
        <AttachmentDescription>Processing</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
    <Attachment state="error">
      <AttachmentMedia>
        <FileTextIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>Break-glass justification.pdf</AttachmentTitle>
        <AttachmentDescription>
          Upload failed — file too large
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction aria-label="Retry">
          <DownloadIcon />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  </AttachmentGroup>
);

export const Idle = () => (
  <Attachment state="idle">
    <AttachmentMedia>
      <FileTextIcon />
    </AttachmentMedia>
    <AttachmentContent>
      <AttachmentTitle>Drop a file to attach</AttachmentTitle>
      <AttachmentDescription>PDF, DOCX up to 10 MB</AttachmentDescription>
    </AttachmentContent>
  </Attachment>
);

export const Vertical = () => (
  <Attachment orientation="vertical">
    <AttachmentMedia variant="icon">
      <FileTextIcon />
    </AttachmentMedia>
    <AttachmentContent>
      <AttachmentTitle>Finance policy v3.pdf</AttachmentTitle>
      <AttachmentDescription>216 KB</AttachmentDescription>
    </AttachmentContent>
    <AttachmentActions>
      <AttachmentAction aria-label="Download">
        <DownloadIcon />
      </AttachmentAction>
    </AttachmentActions>
  </Attachment>
);

export const Sizes = () => (
  <div className="gap-3 flex flex-wrap items-start">
    <Attachment size="xs">
      <AttachmentMedia>
        <FileTextIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>roles-export.json</AttachmentTitle>
        <AttachmentDescription>4 KB</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
    <Attachment size="sm">
      <AttachmentMedia>
        <FileTextIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>session-report.pdf</AttachmentTitle>
        <AttachmentDescription>88 KB</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
    <Attachment size="default">
      <AttachmentMedia>
        <FileTextIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>directory-sync-log.csv</AttachmentTitle>
        <AttachmentDescription>1.3 MB</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
  </div>
);
