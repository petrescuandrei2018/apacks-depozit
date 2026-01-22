namespace Apacks.Depozit.Models;

public class Awb
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Courier { get; set; } = ""; // CARGUS, FAN, OLXFAN
    public DateTime ScannedAt { get; set; } = DateTime.Now;

    public List<AwbMedia> Media { get; set; } = new();
}