using Apacks.Depozit.Data;
using Apacks.Depozit.Models;
using Apacks.Depozit.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Apacks.Depozit.Controllers;

[Route("[controller]")]
public class CargusController : Controller
{
    private readonly ICargusApiService _cargus;
    private readonly AppDbContext _db;
    private readonly ILogger<CargusController> _logger;

    public CargusController(
        ICargusApiService cargus,
        AppDbContext db,
        ILogger<CargusController> logger)
    {
        _cargus = cargus;
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Track un singur AWB
    /// </summary>
    [HttpGet("Track/{awbCode}")]
    public async Task<IActionResult> Track(string awbCode)
    {
        if (string.IsNullOrWhiteSpace(awbCode))
            return BadRequest("AWB code required");

        var tracking = await _cargus.TrackAwbAsync(awbCode);
        if (tracking == null || tracking.Count == 0)
            return NotFound(new { error = true, message = "AWB not found" });

        var result = tracking.First();
        return Json(new
        {
            awbCode = result.Code,
            events = result.Event?.Select(e => new
            {
                date = e.Date,
                description = e.Description,
                locality = e.LocalityName
            }).OrderByDescending(e => e.date),
            lastStatus = result.Event?.OrderByDescending(e => e.Date).FirstOrDefault()?.Description,
            confirmationName = result.ConfirmationName,
            weight = result.MeasuredWeight
        });
    }

    /// <summary>
    /// Track multiple AWB-uri
    /// </summary>
    [HttpPost("TrackMultiple")]
    public async Task<IActionResult> TrackMultiple([FromBody] string[] awbCodes)
    {
        if (awbCodes == null || awbCodes.Length == 0)
            return BadRequest("AWB codes required");

        var tracking = await _cargus.TrackAwbAsync(awbCodes);
        if (tracking == null)
            return StatusCode(500, new { error = true, message = "API error" });

        return Json(tracking.Select(t => new
        {
            awbCode = t.Code,
            lastStatus = t.Event?.OrderByDescending(e => e.Date).FirstOrDefault()?.Description,
            lastDate = t.Event?.OrderByDescending(e => e.Date).FirstOrDefault()?.Date,
            eventsCount = t.Event?.Count ?? 0,
            confirmationName = t.ConfirmationName
        }));
    }

    /// <summary>
    /// Detalii complete AWB de la Cargus
    /// </summary>
    [HttpGet("Details/{awbCode}")]
    public async Task<IActionResult> Details(string awbCode)
    {
        if (string.IsNullOrWhiteSpace(awbCode))
            return BadRequest("AWB code required");

        var details = await _cargus.GetAwbDetailsAsync(awbCode);
        if (details == null)
            return NotFound(new { error = true, message = "AWB not found" });

        return Json(new
        {
            awbCode = details.BarCode,
            status = details.Status,
            sender = details.Sender != null ? new
            {
                name = details.Sender.Name,
                locality = details.Sender.LocalityName,
                county = details.Sender.CountyName
            } : null,
            recipient = details.Recipient != null ? new
            {
                name = details.Recipient.Name,
                address = details.Recipient.AddressText,
                locality = details.Recipient.LocalityName,
                county = details.Recipient.CountyName,
                phone = details.Recipient.PhoneNumber,
                postalCode = details.Recipient.CodPostal
            } : null,
            parcels = details.Parcels,
            envelopes = details.Envelopes,
            weight = details.TotalWeight,
            cashRepayment = details.CashRepayment,
            bankRepayment = details.BankRepayment,
            declaredValue = details.DeclaredValue,
            observations = details.Observations,
            validationDate = details.ValidationDate
        });
    }

    /// <summary>
    /// Descarcă PDF AWB direct de la Cargus
    /// </summary>
    [HttpGet("Pdf/{awbCode}")]
    public async Task<IActionResult> GetPdf(string awbCode)
    {
        var pdf = await _cargus.GetAwbPdfAsync(awbCode);
        if (pdf == null)
            return NotFound("PDF not available");

        return File(pdf, "application/pdf", $"AWB_{awbCode}.pdf");
    }

    /// <summary>
    /// Imagine confirmare livrare
    /// </summary>
    [HttpGet("Confirmation/{awbCode}")]
    public async Task<IActionResult> GetConfirmation(string awbCode)
    {
        var image = await _cargus.GetConfirmationImageAsync(awbCode);
        if (image == null)
            return NotFound("Confirmation image not available");

        return File(image, "image/jpeg");
    }

    /// <summary>
    /// Status ramburs pentru un AWB
    /// </summary>
    [HttpGet("Repayment/{awbCode}")]
    public async Task<IActionResult> GetRepayment(string awbCode)
    {
        var repayments = await _cargus.GetRepaymentsByAwbAsync(awbCode);
        if (repayments == null || repayments.Count == 0)
            return Json(new { found = false, message = "No repayment info" });

        var r = repayments.First();
        return Json(new
        {
            found = true,
            awbCode = r.BarCode,
            receiver = r.Receiver,
            repaymentValue = r.RepaymentValue,
            repaymentDate = r.RepaymentDate,
            deductionDate = r.DeductionDate,
            deductionId = r.DeductionId
        });
    }

    /// <summary>
    /// Sincronizează statusurile AWB-urilor CARGUS din AwbColete
    /// </summary>
    [HttpPost("SyncStatuses")]
    public async Task<IActionResult> SyncStatuses()
    {
        // Ia toate coletele PENDING care sunt Cargus (AWB începe cu 117)
        var pendingColete = await _db.AwbColete
            .Where(c => c.Status == "PENDING" && c.AwbCode.StartsWith("117"))
            .ToListAsync();

        if (pendingColete.Count == 0)
            return Json(new { synced = 0, message = "No pending Cargus AWBs" });

        var awbCodes = pendingColete.Select(c => c.AwbCode).ToArray();
        var tracking = await _cargus.TrackAwbAsync(awbCodes);

        if (tracking == null)
            return StatusCode(500, new { error = true, message = "API error" });

        int updatedCount = 0;
        var results = new List<object>();

        foreach (var track in tracking)
        {
            var lastEvent = track.Event?.OrderByDescending(e => e.Date).FirstOrDefault();
            var colet = pendingColete.FirstOrDefault(c => c.AwbCode == track.Code);

            if (colet == null) continue;

            var status = lastEvent?.Description?.ToUpper() ?? "";
            string? newStatus = null;

            // Detectează status livrare
            if (status.Contains("LIVRAT") || status.Contains("PREDAT") ||
                !string.IsNullOrEmpty(track.ConfirmationName))
            {
                newStatus = "LIVRAT";
            }
            else if (status.Contains("RETURNAT") || status.Contains("RETUR") ||
                     status.Contains("REFUZAT"))
            {
                newStatus = "RETURNAT";
            }

            if (newStatus != null && colet.Status != newStatus)
            {
                colet.Status = newStatus;
                colet.UpdatedAt = DateTime.Now;
                updatedCount++;

                // Folosește AuditLog existent
                _db.AuditLogs.Add(new AuditLog
                {
                    Action = "SYNC_CARGUS",
                    EntityType = "COLET",
                    EntityInfo = $"AWB: {colet.AwbCode} -> {newStatus} ({lastEvent?.Description})"
                });
            }

            results.Add(new
            {
                awbCode = track.Code,
                lastStatus = lastEvent?.Description,
                lastDate = lastEvent?.Date,
                dbStatus = colet.Status,
                updated = newStatus != null
            });
        }

        await _db.SaveChangesAsync();

        return Json(new { total = pendingColete.Count, synced = updatedCount, results });
    }

    /// <summary>
    /// Info completă: local (AwbColet) + API Cargus
    /// </summary>
    [HttpGet("FullInfo/{awbCode}")]
    public async Task<IActionResult> GetFullInfo(string awbCode)
    {
        // Din baza de date locală (AwbColet)
        var coletDb = await _db.AwbColete.FirstOrDefaultAsync(c => c.AwbCode == awbCode);

        // De la API Cargus
        var trackingTask = _cargus.TrackAwbAsync(awbCode);
        var detailsTask = _cargus.GetAwbDetailsAsync(awbCode);
        var repaymentTask = _cargus.GetRepaymentsByAwbAsync(awbCode);

        await Task.WhenAll(trackingTask, detailsTask, repaymentTask);

        var tracking = trackingTask.Result?.FirstOrDefault();
        var details = detailsTask.Result;
        var repayment = repaymentTask.Result?.FirstOrDefault();

        return Json(new
        {
            // Date din AwbColet (modelul tău existent)
            local = coletDb != null ? new
            {
                id = coletDb.Id,
                awbCode = coletDb.AwbCode,
                destinatar = coletDb.Destinatar,
                observatii = coletDb.Observatii,
                ramburs = coletDb.RambursRon,
                telefon = coletDb.Telefon,
                adresa = coletDb.Adresa,
                codPostal = coletDb.CodPostal,
                greutate = coletDb.GreutateKg,
                status = coletDb.Status,
                dataAwb = coletDb.DataAwb,
                curier = coletDb.Curier,
                caleFisier = coletDb.CaleFisier,
                createdAt = coletDb.CreatedAt
            } : null,

            // Date de la API Cargus
            cargus = new
            {
                tracking = tracking != null ? new
                {
                    events = tracking.Event?.Select(e => new
                    {
                        date = e.Date,
                        description = e.Description,
                        locality = e.LocalityName
                    }).OrderByDescending(e => e.date),
                    lastStatus = tracking.Event?.OrderByDescending(e => e.Date).FirstOrDefault()?.Description,
                    confirmationName = tracking.ConfirmationName,
                    weight = tracking.MeasuredWeight
                } : null,
                details = details != null ? new
                {
                    status = details.Status,
                    recipient = details.Recipient?.Name,
                    address = details.Recipient?.AddressText,
                    phone = details.Recipient?.PhoneNumber,
                    cashRepayment = details.CashRepayment,
                    weight = details.TotalWeight
                } : null,
                repayment = repayment != null ? new
                {
                    value = repayment.RepaymentValue,
                    date = repayment.RepaymentDate,
                    deductionDate = repayment.DeductionDate
                } : null
            }
        });
    }

    /// <summary>
    /// Test conexiune API
    /// </summary>
    [HttpGet("TestConnection")]
    public async Task<IActionResult> TestConnection()
    {
        try
        {
            // Facem request manual pentru debug
            using var http = new HttpClient();
            http.BaseAddress = new Uri("https://urgentcargus.azure-api.net/api/");

            // Citește config din DI - trebuie să injectăm IOptions
            var configSection = HttpContext.RequestServices
                .GetService<Microsoft.Extensions.Options.IOptions<CargusApiConfig>>();
            var config = configSection?.Value;

            if (config == null)
                return Json(new { success = false, error = "Config not loaded" });

            http.DefaultRequestHeaders.Add("Ocp-Apim-Subscription-Key", config.SubscriptionKey);

            var loginData = new { UserName = config.UserName, Password = config.Password };
            var json = System.Text.Json.JsonSerializer.Serialize(loginData);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            var response = await http.PostAsync("LoginUser", content);
            var responseBody = await response.Content.ReadAsStringAsync();

            return Json(new
            {
                success = response.IsSuccessStatusCode,
                statusCode = (int)response.StatusCode,
                statusText = response.StatusCode.ToString(),
                responseBody = responseBody,
                debug = new
                {
                    baseUrl = config.BaseUrl,
                    userName = config.UserName,
                    passwordLength = config.Password?.Length ?? 0,
                    subscriptionKeyLength = config.SubscriptionKey?.Length ?? 0,
                    subscriptionKeyFirst4 = config.SubscriptionKey?.Substring(0, Math.Min(4, config.SubscriptionKey?.Length ?? 0))
                }
            });
        }
        catch (Exception ex)
        {
            return Json(new
            {
                success = false,
                error = ex.Message,
                stackTrace = ex.StackTrace
            });
        }
    }
}
