# Sourced for login shells via /etc/profile.d — install with:
#   sudo install -m 644 scripts/local/blocks-keyvault-env.profile.sh /etc/profile.d/blocks-keyvault.sh
# Then open a new terminal or: source /etc/profile.d/blocks-keyvault.sh
# Contains secrets: do not commit (see .gitignore).

export KeyVault__ClientId="***REMOVED***"
export KeyVault__ClientSecret="***REMOVED***"
export KeyVault__KeyVaultUrl="https://blocks-vault.vault.azure.net/"
export KeyVault__TenantId="***REMOVED***"
