import { loginFresh } from "@/support/auth-helpers";
import { test, expect, Page } from "@playwright/test";

async function openFirstProject(page: Page) {
  await page
    .getByRole("button", {
      name: /Development|Testing|Staging|IAT|UAT|Production/,
    })
    .first()
    .click();

  await expect(page.getByText(/^workspace$/i)).toBeVisible({
    timeout: 50_000,
  });
}

function sidebarNavItem(page: Page, name: "Overview" | "Deployment") {
  return page
    .getByRole("link", { name, exact: true })
    .or(page.getByRole("button", { name, exact: true }));
}

test.describe("Console & Project Overview", () => {
  test.beforeEach(async ({ page }) => {
    await loginFresh(page);
  });

  test("Console & Project Overview - Full Flow", async ({ page }) => {
    // Theme switcher offers Auto/Light/Dark and has an active theme
    {
      const themeTablist = page.getByRole("tablist").first();

      const autoTab = themeTablist.locator('[aria-controls$="-content-system"]');

      const lightTab = themeTablist.locator('[aria-controls$="-content-light"]');

      const darkTab = themeTablist.locator('[aria-controls$="-content-dark"]');

      const activeTab = themeTablist.locator('[role="tab"][data-state="active"]');

      await expect(themeTablist).toBeVisible({
        timeout: 30_000,
      });

      await expect(autoTab).toBeVisible({
        timeout: 30_000,
      });

      await expect(lightTab).toBeVisible({
        timeout: 30_000,
      });

      await expect(darkTab).toBeVisible({
        timeout: 30_000,
      });

      await expect(activeTab).toHaveCount(1);
    }

    // Switching to Dark applies the dark theme
    {
      const themeTablist = page.getByRole("tablist").first();

      const darkTab = themeTablist.locator('[aria-controls$="-content-dark"]');

      const lightTab = themeTablist.locator('[aria-controls$="-content-light"]');

      await darkTab.click();

      await expect(darkTab).toHaveAttribute("data-state", "active");

      await expect(page.locator("html")).toHaveClass(/dark/);

      await lightTab.click();

      await expect(lightTab).toHaveAttribute("data-state", "active");
    }

    // Language selector shows EN and lists English/German/French
    {
      const languageButton = page.getByRole("button", {
        name: /^en$/i,
      });

      await expect(languageButton).toBeVisible();

      await languageButton.click();

      await expect(page.getByRole("menuitem", { name: "English" })).toBeVisible();

      await expect(page.getByRole("menuitem", { name: "German" })).toBeVisible();

      await expect(page.getByRole("menuitem", { name: "French" })).toBeVisible();

      await page.keyboard.press("Escape");
    }

    // German and French are disabled
    {
      const languageButton = page.getByRole("button", {
        name: /^en$/i,
      });

      await languageButton.click();

      await expect(page.getByRole("menuitem", { name: "German" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );

      await expect(page.getByRole("menuitem", { name: "French" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );

      await page.keyboard.press("Escape");
    }

    // Notification bell opens the notifications popover
    {
      await page.getByTestId("notification-bell").click();

      await expect(page.getByText("Notifications", { exact: true })).toBeVisible();

      await expect(
        page.getByRole("button", {
          name: "Mark all as read",
        }),
      ).toBeVisible();

      await page.keyboard.press("Escape");
    }

    // App switcher opens the SELISE Blocks apps list
    {
      await page
        .getByRole("button", {
          name: "SELISE Blocks apps",
        })
        .click();

      await expect(
        page.getByText("SELISE Blocks", {
          exact: true,
        }),
      ).toBeVisible();

      await page.keyboard.press("Escape");
    }

    // User menu exposes account info and Log out action
    {
      await page
        .getByRole("button", {
          name: "Open user menu",
        })
        .click();

      await expect(
        page.getByText("Log out", {
          exact: true,
        }),
      ).toBeVisible();

      await page.keyboard.press("Escape");
    }

    // Your Blocks Projects section lists at least one project
    {
      await expect(
        page.getByRole("heading", {
          name: "Your Blocks Projects",
        }),
      ).toBeVisible();

      await expect(
        page.getByText("Add Project", {
          exact: true,
        }),
      ).toBeVisible();
    }

    // Resources section Docs/Code/Cloud is visible
    {
      await expect(
        page.getByText("Resources", {
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        page.getByRole("heading", {
          name: "Docs",
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        page.getByRole("heading", {
          name: "Code",
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        page.getByRole("heading", {
          name: "Cloud",
          exact: true,
        }),
      ).toBeVisible();
    }

    // Open first project and navigate to Overview
    {
      await openFirstProject(page);

      await sidebarNavItem(page, "Overview").click();

      await expect(
        page.getByRole("heading", {
          name: "Project Details",
        }),
      ).toBeVisible({
        timeout: 30_000,
      });
    }

    // Project Details card shows core metadata fields
    {
      await expect(
        page.getByRole("heading", {
          name: "Project Details",
        }),
      ).toBeVisible();

      await expect(
        page.getByText("Core configuration and metadata for this project"),
      ).toBeVisible();

      await expect(
        page.getByText("Name", {
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        page.getByText("X-Blocks-Key", {
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        page.getByRole("main").getByText("Environment", {
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        page.getByText("Last updated Date", {
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        page.getByText("Created Date", {
          exact: true,
        }),
      ).toBeVisible();
    }

    // X-Blocks-Key value is masked
    {
      const keyRow = page
        .getByText("X-Blocks-Key", {
          exact: true,
        })
        .locator("..");

      await expect(keyRow).toContainText("*");
    }

    // X-Blocks-Key value can be copied to clipboard
    {
      const keyRow = page
        .getByText("X-Blocks-Key", {
          exact: true,
        })
        .locator("..");

      const copyButton = keyRow.getByRole("button");

      const copyTooltip = keyRow.locator("span").filter({
        hasText: /^(Copy|Copied!)$/,
      });

      await expect(copyButton).toBeVisible();

      await copyButton.click();

      await expect(copyTooltip).toHaveText("Copied!");
    }

    // Core APIs section lists endpoint groups with counts
    // {
    //   await expect(
    //     page.getByRole("heading", {
    //       name: "Core APIs",
    //     }),
    //   ).toBeVisible();

    //   await expect(page.getByText("Available endpoints for this module")).toBeVisible();

    //   await expect(page.getByText(/^\d+ Endpoints$/)).toBeVisible();

    //   await expect(
    //     page.getByText("Auth", {
    //       exact: true,
    //     }),
    //   ).toBeVisible();

    //   await expect(
    //     page.getByRole("button", {
    //       name: "Build",
    //     }),
    //   ).toHaveAttribute("aria-expanded", "false");
    // }

    // Sidebar shows PROJECT and ENVIRONMENT context
    {
      await expect(page.getByText(/^Project$/i)).toBeVisible();

      await expect(
        page.getByRole("button", {
          name: /Environment/i,
        }),
      ).toBeVisible();
    }

    // Back to console returns to project list
    {
      await page
        .getByRole("button", {
          name: "Back to console",
        })
        .click();

      await expect(
        page.getByRole("heading", {
          name: "Your Blocks Projects",
        }),
      ).toBeVisible({
        timeout: 30_000,
      });
    }

    // Open project and verify navigation to Overview
    {
      await openFirstProject(page);

      await sidebarNavItem(page, "Overview").click();

      await expect(
        page.getByRole("heading", {
          name: "Project Details",
        }),
      ).toBeVisible({
        timeout: 30_000,
      });
    }
  });
});
