import { ExternalLink, ListPlus } from "lucide-react";
import { tStatic } from "@seliseblocks/genesis-os/i18n";
import { renderRichText } from "../utils/rich-text-slots";

export { KEY_MODE_INSTRUCTIONS_MD } from "./key-mode-instructions";

export const EXTENSION_WEBSTORE_URL =
  "https://chromewebstore.google.com/detail/selise-blocks-assistant/ehnhmdghlkaeaiinoahgipdeogkikjem";

const EXTENSION_GUIDE_IMAGE_PATH = "/assets/images/extension-guide";
const MODULE = "localization.tools";

const text = (key: string) => tStatic(MODULE, key);
const richText = (key: string) =>
  renderRichText(text(key), {
    b: (children) => <strong>{children}</strong>,
    icon: () => <ListPlus className="inline h-4 w-4" />,
  });

/** Setup steps shown on the Extension Guides page. Call it when rendering so the text follows the language. */
export const getSetupSteps = () =>
  [
    {
      title: text("EXTENSION_GUIDE_STEPS.STEP_1_TITLE"),
      description: renderRichText(text("EXTENSION_GUIDE_STEPS.STEP_1_DESCRIPTION"), {
        store: (children) => (
          <a
            href={EXTENSION_WEBSTORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            {children}
          </a>
        ),
        icon: () => <ExternalLink className="h-3 w-3" />,
      }),
      images: [],
    },
    {
      title: text("EXTENSION_GUIDE_STEPS.STEP_2_TITLE"),
      description: richText("EXTENSION_GUIDE_STEPS.STEP_2_DESCRIPTION"),
      images: [
        {
          src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_1.png`,
          alt: text("EXTENSION_GUIDE_STEPS.STEP_2_IMAGE_ALT"),
          width: 708,
          height: 1394,
        },
      ],
    },
    {
      title: text("EXTENSION_GUIDE_STEPS.STEP_3_TITLE"),
      description: richText("EXTENSION_GUIDE_STEPS.STEP_3_DESCRIPTION"),
      images: [
        {
          src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_2.png`,
          alt: text("EXTENSION_GUIDE_STEPS.STEP_3_IMAGE_ALT"),
          width: 708,
          height: 1396,
        },
      ],
    },
    {
      title: text("EXTENSION_GUIDE_STEPS.STEP_4_TITLE"),
      description: text("EXTENSION_GUIDE_STEPS.STEP_4_DESCRIPTION"),
      images: [
        {
          src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_3.png`,
          alt: text("EXTENSION_GUIDE_STEPS.STEP_4_IMAGE_1_ALT"),
          width: 714,
          height: 1392,
        },
        {
          src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_4.png`,
          alt: text("EXTENSION_GUIDE_STEPS.STEP_4_IMAGE_2_ALT"),
          width: 698,
          height: 1380,
        },
      ],
    },
    {
      title: text("EXTENSION_GUIDE_STEPS.STEP_5_TITLE"),
      description: richText("EXTENSION_GUIDE_STEPS.STEP_5_DESCRIPTION"),
      images: [
        {
          src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_5.png`,
          alt: text("EXTENSION_GUIDE_STEPS.STEP_5_IMAGE_ALT"),
          width: 700,
          height: 1396,
        },
      ],
    },
    {
      title: text("EXTENSION_GUIDE_STEPS.STEP_6_TITLE"),
      description: richText("EXTENSION_GUIDE_STEPS.STEP_6_DESCRIPTION"),
      images: [
        {
          src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_6.png`,
          alt: text("EXTENSION_GUIDE_STEPS.STEP_6_IMAGE_1_ALT"),
          width: 704,
          height: 1392,
        },
        {
          src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_7.png`,
          alt: text("EXTENSION_GUIDE_STEPS.STEP_6_IMAGE_2_ALT"),
          width: 704,
          height: 1380,
        },
      ],
    },
  ] as const;
