import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui";

export const Collapsed = () => (
  <Accordion type="single" className="max-w-lg">
    <AccordionItem value="access">
      <AccordionTrigger>Who can request a role change?</AccordionTrigger>
      <AccordionContent>
        Any subsidiary administrator can request a role change for people in
        their own subsidiary. Group-wide roles need a super-admin.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="mfa">
      <AccordionTrigger>
        Is MFA required for break-glass access?
      </AccordionTrigger>
      <AccordionContent>
        Yes. Emergency access always requires a session authenticated with MFA
        within the last 15 minutes.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="audit">
      <AccordionTrigger>How long are audit logs retained?</AccordionTrigger>
      <AccordionContent>
        Activation and use of privileged grants are retained for 24 months.
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

export const Expanded = () => (
  <Accordion type="single" defaultValue="mfa" className="max-w-lg">
    <AccordionItem value="access">
      <AccordionTrigger>Who can request a role change?</AccordionTrigger>
      <AccordionContent>
        Any subsidiary administrator can request a role change for people in
        their own subsidiary. Group-wide roles need a super-admin.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="mfa">
      <AccordionTrigger>
        Is MFA required for break-glass access?
      </AccordionTrigger>
      <AccordionContent>
        Yes. Emergency access always requires a session authenticated with MFA
        within the last 15 minutes, is limited to one permission and scope, and
        expires automatically after 15 minutes.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="audit">
      <AccordionTrigger>How long are audit logs retained?</AccordionTrigger>
      <AccordionContent>
        Activation and use of privileged grants are retained for 24 months.
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

export const WithDisabled = () => (
  <Accordion type="single" defaultValue="teams" className="max-w-lg">
    <AccordionItem value="teams">
      <AccordionTrigger>Can a team span subsidiaries?</AccordionTrigger>
      <AccordionContent>
        No. A team belongs to exactly one subsidiary; reporting lines within it
        may not form a cycle.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="legacy" disabled>
      <AccordionTrigger>
        Legacy domain admin table (deprecated)
      </AccordionTrigger>
      <AccordionContent>
        Superseded by access assignments in migration 0010.
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);
