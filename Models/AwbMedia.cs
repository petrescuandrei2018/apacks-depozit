namespace Apacks.Depozit.Models;

public class AwbMedia
{
    public int Id { get; set; }
    public int AwbId { get; set; }
    public string FileName { get; set; } = "";
    public string FilePath { get; set; } = "";
    public string MediaType { get; set; } = "image"; // "image" sau "video"
    public DateTime UploadedAt { get; set; } = DateTime.Now;

    public Awb Awb { get; set; } = null!;
}