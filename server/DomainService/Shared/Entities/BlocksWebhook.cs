namespace BlocksTemplate.DomainService.Shared.Entities
{
    using Blocks.Genesis;
    using MongoDB.Bson.Serialization.Attributes;

    [BsonIgnoreExtraElements]
    public class BlocksWebhook : IProjectKey
    {
        [BsonId]
        public string ItemId { get; set; } = Guid.NewGuid().ToString();
        public DateTime CreateDate { get; set; } = DateTime.Now;
        public DateTime LastUpdateDate { get; set; } = DateTime.Now;
        public required string Url { get; set; }
        public required string ContentType { get; set; }
        public required BlocksWebhookSecret BlocksWebhookSecret { get; set; }
        public bool IsDisabled { get; set; }
        public required string ProjectKey { get; set; }
    }

    public class BlocksWebhookSecret
    {
        public required string Secret { get; set; }
        public required string HeaderKey { get; set; }
    }
}