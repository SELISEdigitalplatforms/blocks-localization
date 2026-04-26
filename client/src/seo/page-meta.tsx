import { Helmet } from "react-helmet-async";

type PageMetaProps = {
  /** Shown as `{title} | Blocks Cloud` when `RootMeta` titleTemplate is active. */
  title?: string;
  /** Overrides default description for this route when set. */
  description?: string;
};

export function PageMeta({ title, description }: PageMetaProps) {
  if (!title && !description) return null;

  return (
    <Helmet>
      {title != null && title !== "" ? <title>{title}</title> : null}
      {description != null && description !== "" ? (
        <meta name="description" content={description} />
      ) : null}
    </Helmet>
  );
}
