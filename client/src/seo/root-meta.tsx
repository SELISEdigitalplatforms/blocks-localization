import { Helmet } from "react-helmet-async";
import { publicAsset } from "@/lib/public-asset";
import { SITE_AUTHOR, SITE_AUTHOR_URL, SITE_DEFAULT_DESCRIPTION, SITE_NAME } from "@/seo/site-defaults";

/**
 * Global head tags (favicon links respect Vite `base` via `publicAsset`).
 * Per-route titles compose with `titleTemplate` from react-helmet-async.
 */
export function RootMeta() {
  const iconHref = publicAsset("Favicon-new.svg");

  return (
    <Helmet
      defaultTitle={SITE_NAME}
      titleTemplate={`%s | ${SITE_NAME}`}
      htmlAttributes={{ lang: "en" }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap"
      />
      <meta name="description" content={SITE_DEFAULT_DESCRIPTION} />
      <link rel="author" href={SITE_AUTHOR_URL} />
      <meta name="author" content={SITE_AUTHOR} />
      <link rel="icon" type="image/svg+xml" href={iconHref} />
      <link rel="shortcut icon" type="image/svg+xml" href={iconHref} />
    </Helmet>
  );
}
