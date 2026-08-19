import React, { type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { PuckComponentData, PuckPocBlockType } from "./puckData";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function childText(value: unknown, fallback: string): ReactNode {
  if (typeof value === "string" || typeof value === "number") return value;
  if (value) return value as ReactNode;
  return fallback;
}

export function SectionView({
  background,
  padding,
  children,
}: {
  background: string;
  padding: string;
  children: ReactNode;
}) {
  const style: CSSProperties = {
    background: background || "#ffffff",
    padding: padding || "32px",
  };
  return (
    <section className="puck-poc-section" data-puck-block="Section" style={style}>
      <div className="puck-poc-section__content">{children}</div>
    </section>
  );
}

export function ColumnsView({
  count,
  children,
}: {
  count: string;
  children: ReactNode;
}) {
  const columns = count === "3" ? 3 : 2;
  const style: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: "24px",
  };
  return (
    <div className="puck-poc-columns" data-puck-block="Columns" style={style}>
      {children}
    </div>
  );
}

export function HeadingView({
  text,
  level,
}: {
  text: ReactNode;
  level: string;
}) {
  const className = `puck-poc-heading puck-poc-heading--${level === "h2" || level === "h3" ? level : "h1"}`;
  if (level === "h2") {
    return (
      <h2 className={className} data-puck-block="Heading">
        {text}
      </h2>
    );
  }
  if (level === "h3") {
    return (
      <h3 className={className} data-puck-block="Heading">
        {text}
      </h3>
    );
  }
  return (
    <h1 className={className} data-puck-block="Heading">
      {text}
    </h1>
  );
}

export function TextView({ body }: { body: ReactNode }) {
  return (
    <p className="puck-poc-text" data-puck-block="Text">
      {body}
    </p>
  );
}

export function ImageView({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      className="puck-poc-image"
      data-puck-block="Image"
      src={src}
      alt={alt}
    />
  );
}

export function ButtonView({ label, href }: { label: ReactNode; href: string }) {
  return (
    <a className="puck-poc-button" data-puck-block="Button" href={href || "#"}>
      {label}
    </a>
  );
}

export function FormView({
  title,
  submitLabel,
  showPhone,
}: {
  title: ReactNode;
  submitLabel: string;
  showPhone: boolean;
}) {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };
  return (
    <form className="puck-poc-form" data-puck-block="Form" action="#" method="post" onSubmit={onSubmit}>
      <h2 className="puck-poc-form__title">{title}</h2>
      <label className="puck-poc-form__field">
        Name
        <input name="name" type="text" />
      </label>
      <label className="puck-poc-form__field">
        Email
        <input name="email" type="email" />
      </label>
      {showPhone ? (
        <label className="puck-poc-form__field">
          Phone
          <input name="phone" type="tel" />
        </label>
      ) : null}
      <button className="puck-poc-form__submit" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}

export function PuckBlock({ node }: { node: PuckComponentData }) {
  const type = node.type as PuckPocBlockType;
  if (type === "Section") {
    const children = Array.isArray(node.props.content)
      ? (node.props.content as PuckComponentData[])
      : [];
    return (
      <SectionView
        background={asString(node.props.background, "#ffffff")}
        padding={asString(node.props.padding, "32px")}
      >
        {children.map((child, index) => (
          <PuckBlock key={asString(child.props.id, String(index))} node={child} />
        ))}
      </SectionView>
    );
  }
  if (type === "Columns") {
    const children = Array.isArray(node.props.columns)
      ? (node.props.columns as PuckComponentData[])
      : [];
    return (
      <ColumnsView count={asString(node.props.count, "2")}>
        {children.map((child, index) => (
          <PuckBlock key={asString(child.props.id, String(index))} node={child} />
        ))}
      </ColumnsView>
    );
  }
  if (type === "Heading") {
    return (
      <HeadingView
        text={childText(node.props.text, "Heading")}
        level={asString(node.props.level, "h1")}
      />
    );
  }
  if (type === "Text") {
    return <TextView body={childText(node.props.body, "Text")} />;
  }
  if (type === "Image") {
    return (
      <ImageView
        src={asString(node.props.src)}
        alt={asString(node.props.alt, "")}
      />
    );
  }
  if (type === "Button") {
    return (
      <ButtonView
        label={asString(node.props.label, "Button")}
        href={asString(node.props.href, "#")}
      />
    );
  }
  return (
    <FormView
      title={asString(node.props.title, "Form")}
      submitLabel={asString(node.props.submitLabel, "Submit")}
      showPhone={node.props.showPhone !== false}
    />
  );
}
