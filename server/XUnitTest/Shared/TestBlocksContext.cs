using System;
using System.Collections.Generic;
using Blocks.Genesis;

namespace XUnitTest.Shared
{
    /// <summary>
    /// Helper for establishing an ambient <see cref="BlocksContext"/> during tests so that
    /// production code calling <c>BlocksContext.GetContext()</c> (which is not null-safe in a
    /// number of services/repositories) does not throw a <see cref="NullReferenceException"/>.
    /// </summary>
    internal static class TestBlocksContext
    {
        /// <summary>
        /// Creates and installs a <see cref="BlocksContext"/> with the given tenant id and
        /// returns it. Call from a test constructor (the ambient value flows into the test body).
        /// </summary>
        public static BlocksContext Set(string tenantId = "test-tenant")
        {
            var context = BlocksContext.Create(
                tenantId: tenantId,
                roles: new List<string>(),
                userId: "test-user",
                isAuthenticated: true,
                requestUri: "https://localhost/test",
                organizationId: "test-org",
                expireOn: DateTime.UtcNow.AddHours(1),
                email: "test@test.com",
                permissions: new List<string>(),
                userName: "test-user",
                phoneNumber: "",
                displayName: "Test User",
                oauthToken: "",
                originalTenantId: tenantId,
                applicationDomain: "test.example.com",
                impersonated: false,
                impersonationSessionId: "");

            BlocksContext.SetContext(context, true);
            return context;
        }
    }
}
