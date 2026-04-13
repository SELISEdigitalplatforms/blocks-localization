# Sourced for login shells via /etc/profile.d — install with:
#   sudo install -m 644 scripts/local/blocks-keyvault-env.profile.sh /etc/profile.d/blocks-keyvault.sh
# Then open a new terminal or: source /etc/profile.d/blocks-keyvault.sh
# Contains secrets: do not commit (see .gitignore).

export KeyVault__ClientId="64adb1e7-f2dd-4851-852e-31f8452ace19"
export KeyVault__ClientSecret="luG8Q~NPOkBPGCfhS7Go82Pnyqh4nxtC.kvyfakP"
export KeyVault__KeyVaultUrl="https://blocks-vault.vault.azure.net/"
export KeyVault__TenantId="5c6dd6a7-f0c7-4a32-8f7c-9ca7cebf6e87"
