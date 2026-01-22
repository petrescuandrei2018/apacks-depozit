namespace Apacks.Depozit.Models;

/// <summary>
/// Model pentru coletele extrase din PDF-urile AWB Cargus
/// </summary>
public class AwbColet
{
    public int Id { get; set; }
    
    /// <summary>
    /// Codul AWB (ex: 1177180228)
    /// </summary>
    public string AwbCode { get; set; } = "";
    
    /// <summary>
    /// Numele destinatarului sau al firmei
    /// </summary>
    public string Destinatar { get; set; } = "";
    
    /// <summary>
    /// Descrierea produselor din colet
    /// </summary>
    public string Observatii { get; set; } = "";
    
    /// <summary>
    /// Suma de plată la livrare (ramburs)
    /// </summary>
    public decimal RambursRon { get; set; } = 0;
    
    /// <summary>
    /// Telefon destinatar
    /// </summary>
    public string Telefon { get; set; } = "";
    
    /// <summary>
    /// Adresa de livrare
    /// </summary>
    public string Adresa { get; set; } = "";
    
    /// <summary>
    /// Cod poștal destinatar
    /// </summary>
    public string CodPostal { get; set; } = "";
    
    /// <summary>
    /// Greutatea coletului în kg
    /// </summary>
    public decimal GreutateKg { get; set; } = 0;
    
    /// <summary>
    /// Data de pe AWB
    /// </summary>
    public string DataAwb { get; set; } = "";
    
    /// <summary>
    /// Tipul serviciului (Standard, Express, etc.)
    /// </summary>
    public string Serviciu { get; set; } = "";
    
    /// <summary>
    /// Numele expeditorului
    /// </summary>
    public string Expeditor { get; set; } = "";
    
    /// <summary>
    /// Curierul (CARGUS, FAN, etc.)
    /// </summary>
    public string Curier { get; set; } = "CARGUS";
    
    /// <summary>
    /// Numele fișierului PDF original
    /// </summary>
    public string NumeFisier { get; set; } = "";
    
    /// <summary>
    /// Calea către PDF-ul salvat
    /// </summary>
    public string CaleFisier { get; set; } = "";
    
    /// <summary>
    /// Status: PENDING, LIVRAT, RETURNAT, etc.
    /// </summary>
    public string Status { get; set; } = "PENDING";
    
    /// <summary>
    /// Data și ora încărcării
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    
    /// <summary>
    /// Data și ora ultimei actualizări
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}
