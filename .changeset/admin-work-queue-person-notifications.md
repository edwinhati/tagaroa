---
"@apps/admin": patch
---

Redesign three back-office screens to follow the design system:

- **Work queue:** one list of the people who need attention, oldest first, each with its own action. Repeated recent events collapse into one line with a count.
- **Person:** a single header line and one warning. Access, sign-in and activity move into tabs, beside a summary that states each sign-in fact once and says "Unavailable" when sessions can't be read.
- **Notifications overview:** a one-sentence summary and one channels table with its delivery-log links. The volume chart appears only once something has been sent.
