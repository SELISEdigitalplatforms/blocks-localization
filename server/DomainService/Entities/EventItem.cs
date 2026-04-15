

namespace BlocksTemplate.DomainService;

public sealed record EventItem(
    [property: MongoDB.Bson.Serialization.Attributes.BsonId] string Id,
    string Name,
    DateTimeOffset StartDateTime,
    DateTimeOffset EndDateTime,
    string Description,
    string Location,
    string Organizer);