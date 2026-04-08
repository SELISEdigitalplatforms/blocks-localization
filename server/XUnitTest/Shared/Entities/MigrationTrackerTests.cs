using BlocksTemplate.DomainService.Shared.Entities;
using FluentAssertions;

namespace BlocksTemplate.XUnitTest
{
    public class MigrationTrackerTests
    {
        [Fact]
        public void MigrationTracker_Properties_CanBeAssignedAndRead()
        {
            var before = DateTime.UtcNow;

            var tracker = new MigrationTracker
            {
                ProjectKey = "source-project",
                TargetedProjectKey = "target-project",
                TenantGroupId = "tenant-group-1",
                ErrorMessage = "migration failed",
                ItemId = "tracker-1",
                CreateDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                LastUpdateDate = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc),
                CreatedBy = "system",
                LastUpdatedBy = "worker",
                TenantId = "tenant-1",
                Authentication = new ServiceMigrationStatus
                {
                    ShouldOverWriteExistingData = true,
                    IsCompleted = false,
                    StartedAt = new DateTime(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc),
                    CompletedAt = new DateTime(2026, 1, 4, 0, 0, 0, DateTimeKind.Utc),
                    ErrorMessage = "auth error",
                    QueueName = "auth-queue"
                },
                IAM = new ServiceMigrationStatus { QueueName = "iam-queue" },
                MFA = new ServiceMigrationStatus { QueueName = "mfa-queue" },
                CAPTCHA = new ServiceMigrationStatus { QueueName = "captcha-queue" },
                Email = new ServiceMigrationStatus { QueueName = "email-queue" },
                DataGateway = new ServiceMigrationStatus { QueueName = "gateway-queue" },
                Notifications = new ServiceMigrationStatus { QueueName = "notification-queue" },
                Storage = new ServiceMigrationStatus { QueueName = "storage-queue" },
                LanguageService = new ServiceMigrationStatus { QueueName = "language-queue" }
            };

            tracker.ProjectKey.Should().Be("source-project");
            tracker.TargetedProjectKey.Should().Be("target-project");
            tracker.TenantGroupId.Should().Be("tenant-group-1");
            tracker.ErrorMessage.Should().Be("migration failed");

            tracker.ItemId.Should().Be("tracker-1");
            tracker.CreateDate.Should().Be(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
            tracker.LastUpdateDate.Should().Be(new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc));
            tracker.CreatedBy.Should().Be("system");
            tracker.LastUpdatedBy.Should().Be("worker");
            tracker.TenantId.Should().Be("tenant-1");

            tracker.Authentication.Should().NotBeNull();
            tracker.Authentication!.ShouldOverWriteExistingData.Should().BeTrue();
            tracker.Authentication.IsCompleted.Should().BeFalse();
            tracker.Authentication.StartedAt.Should().Be(new DateTime(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc));
            tracker.Authentication.CompletedAt.Should().Be(new DateTime(2026, 1, 4, 0, 0, 0, DateTimeKind.Utc));
            tracker.Authentication.ErrorMessage.Should().Be("auth error");
            tracker.Authentication.QueueName.Should().Be("auth-queue");

            tracker.IAM!.QueueName.Should().Be("iam-queue");
            tracker.MFA!.QueueName.Should().Be("mfa-queue");
            tracker.CAPTCHA!.QueueName.Should().Be("captcha-queue");
            tracker.Email!.QueueName.Should().Be("email-queue");
            tracker.DataGateway!.QueueName.Should().Be("gateway-queue");
            tracker.Notifications!.QueueName.Should().Be("notification-queue");
            tracker.Storage!.QueueName.Should().Be("storage-queue");
            tracker.LanguageService!.QueueName.Should().Be("language-queue");

            tracker.MigrationStartedAt.Should().BeOnOrAfter(before);
            tracker.MigrationStartedAt.Should().BeOnOrBefore(DateTime.UtcNow);
        }

        [Fact]
        public void ServiceMigrationStatus_DefaultValues_AreExpected()
        {
            var status = new ServiceMigrationStatus();

            status.ShouldOverWriteExistingData.Should().BeFalse();
            status.IsCompleted.Should().BeFalse();
            status.StartedAt.Should().BeNull();
            status.CompletedAt.Should().BeNull();
            status.ErrorMessage.Should().BeNull();
            status.QueueName.Should().BeNull();
        }
    }
}
