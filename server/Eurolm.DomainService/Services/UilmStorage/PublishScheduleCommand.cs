namespace Eurolm.DomainService.Services.UilmStorage
{
    /// <summary>
    /// The command the blocks-logic scheduler sends to a queue schedule's queue. Genesis routes messages by type
    /// name only, so this local class only has to share the scheduler's name (the blocks-os maintenance pattern).
    /// </summary>
    public class PublishScheduleCommand
    {
        /// <summary>The schedule row's opaque JSON, for example <c>{"task":"uilm-maintenance"}</c>.</summary>
        public string Payload { get; set; } = string.Empty;
    }
}
