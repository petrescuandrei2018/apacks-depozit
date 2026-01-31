namespace Apacks.Depozit.Models;

// ===== CARGUS API REQUEST/RESPONSE MODELS =====
// Aceste modele sunt doar pentru comunicarea cu API-ul Cargus extern
// NU înlocuiesc modelele tale existente (Awb, AwbColet, etc.)

public class CargusLoginRequest
{
    public string UserName { get; set; } = "";
    public string Password { get; set; } = "";
}

public class CargusTrackingEvent
{
    public DateTime Date { get; set; }
    public string Description { get; set; } = "";
    public string LocalityName { get; set; } = "";
    public int? EventId { get; set; }
}

public class CargusTrackingResponse
{
    public string Code { get; set; } = "";
    public int Type { get; set; }
    public decimal? MeasuredWeight { get; set; }
    public decimal? VolumetricWeight { get; set; }
    public string? ConfirmationName { get; set; }
    public string? Observation { get; set; }
    public string? ResponseCode { get; set; }
    public List<CargusTrackingEvent> Event { get; set; } = new();
}

public class CargusAwbAddress
{
    public int LocationId { get; set; }
    public string Name { get; set; } = "";
    public int CountyId { get; set; }
    public string CountyName { get; set; } = "";
    public int LocalityId { get; set; }
    public string LocalityName { get; set; } = "";
    public string AddressText { get; set; } = "";
    public string ContactPerson { get; set; } = "";
    public string PhoneNumber { get; set; } = "";
    public string Email { get; set; } = "";
    public string CodPostal { get; set; } = "";
}

public class CargusAwbDetailsResponse
{
    public CargusAwbAddress? Sender { get; set; }
    public CargusAwbAddress? Recipient { get; set; }
    public int Parcels { get; set; }
    public int Envelopes { get; set; }
    public decimal TotalWeight { get; set; }
    public decimal CashRepayment { get; set; }
    public decimal BankRepayment { get; set; }
    public decimal DeclaredValue { get; set; }
    public string Observations { get; set; } = "";
    public string PackageContent { get; set; } = "";
    public string BarCode { get; set; } = "";
    public DateTime? ValidationDate { get; set; }
    public string Status { get; set; } = "";
}

public class CargusRepaymentInfo
{
    public DateTime Date { get; set; }
    public string BarCode { get; set; } = "";
    public string Sender { get; set; } = "";
    public string Receiver { get; set; } = "";
    public string FromLocality { get; set; } = "";
    public string ToLocality { get; set; } = "";
    public DateTime? RepaymentDate { get; set; }
    public decimal? RepaymentValue { get; set; }
    public DateTime? DeductionDate { get; set; }
    public int? DeductionId { get; set; }
}

// ===== CONFIG =====
public class CargusApiConfig
{
    public string BaseUrl { get; set; } = "https://urgentcargus.azure-api.net/api";
    public string SubscriptionKey { get; set; } = "";
    public string UserName { get; set; } = "";
    public string Password { get; set; } = "";
}

public class CargusTokenCache
{
    public string? Token { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool IsValid => !string.IsNullOrEmpty(Token) && ExpiresAt > DateTime.Now;
}
