import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { Fragment } from "react";

import { brand } from "./brand.js";
import { tagaroaTheme } from "./theme-tagaroa.js";

const theme = tagaroaTheme;

export interface ShellProps {
  /** The rendered subject, used as the inbox preview when there is one. */
  subject: string | null;
  /** The rendered wording, exactly as the plain-text part carries it. */
  body: string;
}

/**
 * Blank line separates paragraphs; a single newline is a line break.
 *
 * The whole grammar. A template author writes the message they would send as
 * text and gets the message they would send as text, laid out — there is no
 * second syntax to learn and no directive that ships as literal characters
 * when it is mistyped. React escapes every value on the way in, so a name
 * containing `<` is a name and not markup.
 */
export const paragraphs = (body: string): string[][] =>
  body
    .split(/\n{2,}/)
    .map((block) => block.split("\n").map((line) => line.trimEnd()))
    .filter((lines) => lines.some((line) => line.length > 0));

/**
 * Three bars, drawn rather than fetched.
 *
 * `@repo/ui`'s `Logo` is an SVG, which Gmail strips and Outlook cannot read,
 * and a hosted PNG is blank until the reader agrees to load remote images —
 * which is exactly the moment a password-reset email should look legitimate.
 * Table cells with a background colour render everywhere, with images off.
 */
const Mark = () => (
  <Row style={{ width: "32px" }}>
    {[0, 1, 2].map((index) => (
      <Fragment key={index}>
        {index > 0 ? <Column style={{ width: "7px" }} /> : null}
        <Column
          style={{
            backgroundColor: theme.colorPrimary,
            fontSize: 0,
            height: "32px",
            lineHeight: "32px",
            width: "6px",
          }}
        >
          &zwj;
        </Column>
      </Fragment>
    ))}
  </Row>
);

const text = {
  color: theme.colorText,
  fontFamily: theme.fontFamily,
  fontSize: theme.fontSizeBase,
  lineHeight: theme.lineHeightBase,
  margin: `0 0 ${theme.spacingBase} 0`,
};

const muted = {
  ...text,
  color: theme.colorTextMuted,
  fontSize: theme.fontSizeSm,
  margin: 0,
};

const rule = {
  borderColor: theme.colorBorder,
  borderWidth: "1px 0 0 0",
  margin: `${theme.spacingLg} 0`,
};

/**
 * The one layout every Tagaroa email wears.
 *
 * It carries no wording of its own beyond the footer: the message itself is
 * a published `notification.template` row, rendered to text at enqueue and
 * dropped in here at send. That split is what lets someone edit an email in
 * `apps/admin` without touching a `.tsx` file, and what keeps the message log
 * a record of words rather than of markup.
 */
export const Shell = ({ subject, body }: ShellProps) => (
  <Html lang="en">
    <Head />
    {subject === null ? null : <Preview>{subject}</Preview>}
    <Body
      style={{
        backgroundColor: theme.colorBackground,
        margin: 0,
        padding: `${theme.spacingLg} 0`,
      }}
    >
      <Container
        style={{
          backgroundColor: theme.colorBackgroundSubtle,
          border: `1px solid ${theme.colorBorder}`,
          borderRadius: theme.borderRadiusLg,
          margin: "0 auto",
          maxWidth: theme.containerWidth,
          padding: theme.spacingLg,
        }}
      >
        <Section>
          <Mark />
        </Section>

        <Hr style={rule} />

        {paragraphs(body).map((lines, block) => (
          <Text key={block} style={text}>
            {lines.map((line, index) => (
              <Fragment key={index}>
                {index > 0 ? <br /> : null}
                {line}
              </Fragment>
            ))}
          </Text>
        ))}

        <Hr style={rule} />

        <Text style={muted}>
          You received this because an administrator manages your {brand.name}{" "}
          account. Not expecting this? Contact your administrator through your
          usual trusted channel.
        </Text>
      </Container>
    </Body>
  </Html>
);
