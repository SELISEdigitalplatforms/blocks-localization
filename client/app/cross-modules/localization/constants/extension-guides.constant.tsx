import { ExternalLink, ListPlus } from "lucide-react";

export const EXTENSION_WEBSTORE_URL =
  "https://chromewebstore.google.com/detail/selise-blocks-assistant/ehnhmdghlkaeaiinoahgipdeogkikjem";

const EXTENSION_GUIDE_IMAGE_PATH = "/assets/images/extension-guide";

export const SETUP_STEPS = [
  {
    title: "Install the browser extension",
    description: (
      <>
        Install SELISE Blocks Assistant from the{" "}
        <a
          href={EXTENSION_WEBSTORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Chrome Web Store
          <ExternalLink className="h-3 w-3" />
        </a>
        , then open it to reach the sign-in screen.
      </>
    ),
    images: [],
  },
  {
    title: "Open Manage Instances",
    description: (
      <>
        On the sign-in screen, select the <strong>Manage instances</strong> button{" "}
        <ListPlus className="inline h-4 w-4" /> to the right of the <strong>Choose Instance</strong>{" "}
        list.
      </>
    ),
    images: [
      {
        src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_1.png`,
        alt: "SELISE Blocks sign-in screen highlighting the Manage instances button",
        width: 708,
        height: 1394,
      },
    ],
  },
  {
    title: "Add a cloud instance",
    description: (
      <>
        Select <strong>+ Add Cloud Instance</strong>. You can save up to 10 instances and return
        here later to edit or remove them.
      </>
    ),
    images: [
      {
        src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_2.png`,
        alt: "Manage Instances screen showing the Add Cloud Instance button",
        width: 708,
        height: 1396,
      },
    ],
  },
  {
    title: "Enter the instance details",
    description: (
      <>
        Give the instance a recognizable name and select its microservice version(i.e. V4 - Blocks
        OS). Use the manual setup to enter the API Base URL and X-Blocks-Key, or select the JSON
        setup method and paste the instance configuration from below.
      </>
    ),
    images: [
      {
        src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_3.png`,
        alt: "Manual setup form with the instance name, version, API URL, and X-Blocks-Key fields",
        width: 714,
        height: 1392,
      },
      {
        src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_4.png`,
        alt: "JSON setup form for adding a Blocks OS V4 instance configuration",
        width: 698,
        height: 1380,
      },
    ],
  },
  {
    title: "Save and select the instance",
    description: (
      <>
        Select <strong>Save</strong>, return to the sign-in screen, and choose the new instance from
        the <strong>Choose Instance</strong> list. The selected instance is marked as active.
      </>
    ),
    images: [
      {
        src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_5.png`,
        alt: "Manage Instances screen showing saved Blocks Cloud and Blocks OS instances",
        width: 700,
        height: 1396,
      },
    ],
  },
  {
    title: "Sign in",
    description: (
      <>
        Select the Blocks OS instance from the <strong>Choose Instance</strong> list, then click{" "}
        <strong>Sign in with Blocks OS</strong>. You can now use the extension with that instance.
      </>
    ),
    images: [
      {
        src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_6.png`,
        alt: "SELISE Blocks sign-in screen with the instance selector open",
        width: 704,
        height: 1392,
      },
      {
        src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_7.png`,
        alt: "SELISE Blocks sign-in screen with a Blocks OS instance selected",
        width: 704,
        height: 1380,
      },
    ],
  },
] as const;
