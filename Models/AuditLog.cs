namespace Apacks.Depozit.Models;

public class AuditLog
{
    public int Id { get; set; }
    public string Action { get; set; } = ""; // "ADD", "DELETE", "ADD_MEDIA", "DELETE_MEDIA"
    public string EntityType { get; set; } = ""; // "AWB", "MEDIA"
    public string EntityInfo { get; set; } = ""; // Detalii despre entitate
    public DateTime Timestamp { get; set; } = DateTime.Now;
}