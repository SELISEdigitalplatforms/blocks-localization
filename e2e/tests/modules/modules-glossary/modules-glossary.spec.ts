import { test, expect, uniqueName } from "../../../support/test-base"
import { loginToProject } from "../../../support/auth"
import {
  GlossaryFormPage,
  GlossaryListPage,
} from "../../../support/pages/glossary"
import {
  ModuleDetailsPage,
  ModulesListPage,
} from "../../../support/pages/modules"

test.describe("Modules & Glossary", () => {
  test.beforeEach(async ({ page }) => {
    await loginToProject(page)
  })

  test("add glossary, tag to module, delete glossary, verify untagged", async ({
    page,
  }) => {
    test.setTimeout(300_000)

    const glossaryName = uniqueName("market")
    const moduleName = uniqueName("e2e_mod")

    const glossaryList = new GlossaryListPage(page)
    const glossaryForm = new GlossaryFormPage(page)
    const modulesList = new ModulesListPage(page)
    const moduleDetails = new ModuleDetailsPage(page)

    // 1. Add glossary (do-not-translate term) without module tags yet.
    await glossaryList.openFromSidebar()
    await glossaryList.openNewGlossaryDialog()
    await glossaryForm.create({
      name: glossaryName,
      language: "English",
      type: "Full form",
    })
    await glossaryList.search(glossaryName)
    await glossaryList.expectVisible(glossaryName)

    // 2. Create module and tag the glossary from the modules list.
    await modulesList.openFromSidebar()
    await modulesList.createModule(moduleName)
    await modulesList.tagGlossaryToModule(moduleName, glossaryName)

    // 3. Open module details → Glossary tab → glossary is tagged.
    await modulesList.openModuleDetails(moduleName)
    await moduleDetails.waitForReady(moduleName)
    await moduleDetails.openGlossaryTab()
    await moduleDetails.expectGlossaryTagged(glossaryName)

    // 4. Delete glossary from the glossary page.
    await glossaryList.openFromSidebar()
    await glossaryList.deleteGlossary(glossaryName)
    await glossaryList.search(glossaryName)
    await glossaryList.expectNotVisible(glossaryName)

    // 5. Module details → Glossary tab → glossary link is gone.
    await modulesList.openFromSidebar()
    await modulesList.openModuleDetails(moduleName)
    await moduleDetails.openGlossaryTab()
    await moduleDetails.expectNoGlossariesTagged()
  })
})
