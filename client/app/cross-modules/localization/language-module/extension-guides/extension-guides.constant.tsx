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
    image: null,
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
    image: {
      src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_1.png`,
      alt: "SELISE Blocks sign-in screen highlighting the Manage instances button",
      caption: "Open instance management from the sign-in screen.",
      width: 708,
      height: 1394,
    },
  },
  {
    title: "Add a cloud instance",
    description: (
      <>
        Select <strong>+ Add Cloud Instance</strong>. You can save up to 10 instances and return
        here later to edit or remove them.
      </>
    ),
    image: {
      src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_2.png`,
      alt: "Manage Instances screen showing the Add Cloud Instance button",
      caption: "Select Add Cloud Instance to create a new configuration.",
      width: 708,
      height: 1396,
    },
  },
  {
    title: "Enter the instance details",
    description: (
      <>
        Give the instance a recognizable name, select its microservice version, then copy the
        matching API Base URL and X-Blocks-Key from the Blocks instances section below and paste
        them into the extension.
      </>
    ),
    image: {
      src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_3.png`,
      alt: "Add New Cloud Instance form with the name, version, API URL, and X-Blocks-Key fields",
      caption: "Enter the instance name, version, API Base URL, and X-Blocks-Key.",
      width: 714,
      height: 1392,
    },
  },
  {
    title: "Save and select the instance",
    description: (
      <>
        Select <strong>Save</strong>, return to the sign-in screen, and choose the new instance from
        the <strong>Choose Instance</strong> list. The selected instance is marked as active.
      </>
    ),
    image: {
      src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_4.png`,
      alt: "Manage Instances screen showing saved Blocks Cloud and Blocks OS instances",
      caption: "Confirm that the new instance appears in your saved instances.",
      width: 700,
      height: 1396,
    },
  },
  {
    title: "Sign in",
    description: (
      <>
        Enter the account credentials for the selected Blocks environment and select{" "}
        <strong>Sign in</strong>. You can now use the extension with that instance.
      </>
    ),
    image: {
      src: `${EXTENSION_GUIDE_IMAGE_PATH}/guide_5.png`,
      alt: "SELISE Blocks sign-in screen with the instance selector open",
      caption: "Choose the saved instance, then enter your credentials and sign in.",
      width: 706,
      height: 1398,
    },
  },
] as const;
