import type { Config, Slot } from "@measured/puck";
import React, { type ReactNode } from "react";
import {
  ButtonView,
  FormView,
  HeadingView,
  ImageView,
  TextView,
} from "./blocks";

type PuckPocComponents = {
  Section: {
    background: string;
    padding: string;
    content: Slot;
  };
  Columns: {
    count: string;
    columns: Slot;
  };
  Heading: {
    text: string | ReactNode;
    level: string;
  };
  Text: {
    body: string | ReactNode;
  };
  Image: {
    src: string;
    alt: string;
  };
  Button: {
    label: string;
    href: string;
  };
  Form: {
    title: string;
    submitLabel: string;
    showPhone: boolean;
  };
};

function columnCount(count: string): number {
  return count === "3" ? 3 : 2;
}

export const puckConfig: Config<PuckPocComponents> = {
  categories: {
    layout: { title: "Layout", components: ["Section", "Columns"] },
    content: {
      title: "Content",
      components: ["Heading", "Text", "Image", "Button", "Form"],
    },
  },
  components: {
    Section: {
      label: "Section",
      fields: {
        background: { type: "text", label: "Background" },
        padding: { type: "text", label: "Padding" },
        content: { type: "slot" },
      },
      defaultProps: {
        background: "#ffffff",
        padding: "32px",
        content: [],
      },
      render: ({ background, padding, content: Content }) => (
        <section
          className="puck-poc-section"
          data-puck-block="Section"
          style={{ background: background || "#ffffff", padding: padding || "32px" }}
        >
          <Content className="puck-poc-section__content" minEmptyHeight={88} />
        </section>
      ),
    },
    Columns: {
      label: "Columns",
      fields: {
        count: {
          type: "radio",
          label: "Count",
          options: [
            { label: "2", value: "2" },
            { label: "3", value: "3" },
          ],
        },
        columns: { type: "slot" },
      },
      defaultProps: {
        count: "2",
        columns: [],
      },
      render: ({ count, columns: ColumnsSlot }) => (
        <ColumnsSlot
          className="puck-poc-columns"
          data-puck-block="Columns"
          minEmptyHeight={88}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columnCount(count)}, minmax(0, 1fr))`,
            gap: "24px",
          }}
        />
      ),
    },
    Heading: {
      label: "Heading",
      fields: {
        text: { type: "text", contentEditable: true, label: "Text" },
        level: {
          type: "select",
          label: "Level",
          options: [
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
          ],
        },
      },
      defaultProps: {
        text: "Heading",
        level: "h1",
      },
      render: ({ text, level }) => <HeadingView text={text} level={level} />,
    },
    Text: {
      label: "Text",
      fields: {
        body: { type: "textarea", contentEditable: true, label: "Body" },
      },
      defaultProps: {
        body: "Write something…",
      },
      render: ({ body }) => <TextView body={body} />,
    },
    Image: {
      label: "Image",
      fields: {
        src: { type: "text", label: "Image URL" },
        alt: { type: "text", label: "Alt text" },
      },
      defaultProps: {
        src: "https://placehold.co/800x420/e2e8f0/0f172a?text=Image",
        alt: "Image",
      },
      render: ({ src, alt }) => <ImageView src={src} alt={alt} />,
    },
    Button: {
      label: "Button",
      fields: {
        label: { type: "text", contentEditable: true, label: "Label" },
        href: { type: "text", label: "Link" },
      },
      defaultProps: {
        label: "Button",
        href: "#",
      },
      render: ({ label, href }) => <ButtonView label={label} href={href} />,
    },
    Form: {
      label: "Form",
      fields: {
        title: { type: "text", contentEditable: true, label: "Title" },
        submitLabel: { type: "text", label: "Submit label" },
        showPhone: {
          type: "radio",
          label: "Phone field",
          options: [
            { label: "Show", value: true },
            { label: "Hide", value: false },
          ],
        },
      },
      defaultProps: {
        title: "Contact",
        submitLabel: "Submit",
        showPhone: true,
      },
      render: ({ title, submitLabel, showPhone }) => (
        <FormView
          title={title}
          submitLabel={submitLabel}
          showPhone={showPhone !== false}
        />
      ),
    },
  },
};
