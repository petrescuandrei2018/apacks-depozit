using Apacks.Depozit.Data;
using Apacks.Depozit.Models;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Listener;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
// Asigură-te că PDFtoImage este instalat prin NuGet
// using PDFtoImage; 
using Tesseract;

namespace Apacks.Depozit.Controllers;

public class AwbColetController : Controller
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<AwbColetController> _logger;
    private readonly string _tessdataPath;

    public AwbColetController(AppDbContext db, IWebHostEnvironment env, ILogger<AwbColetController> logger)
    {
        _db = db;
        _env = env;
        _logger = logger;
        _tessdataPath = Path.Combine(env.ContentRootPath, "tessdata");
    }

    public IActionResult Index() => View("AwbColetIndex");

    [HttpGet]
    public async Task<IActionResult> GetAll(string? search = null, string? status = null)
    {
        var query = _db.AwbColete.AsQueryable();

        if (!string.IsNullOrEmpty(search))
        {
            search = search.ToLower();
            query = query.Where(c =>
                c.AwbCode.ToLower().Contains(search) ||
                c.Destinatar.ToLower().Contains(search) ||
                c.Observatii.ToLower().Contains(search) ||
                c.Telefon.Contains(search));
        }

        if (!string.IsNullOrEmpty(status))
            query = query.Where(c => c.Status == status);

        var colete = await query
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.AwbCode,
                c.Destinatar,
                c.Observatii,
                c.RambursRon,
                c.Telefon,
                c.Adresa,
                c.CodPostal,
                c.GreutateKg,
                c.DataAwb,
                c.Serviciu,
                c.Expeditor,
                c.Curier,
                c.NumeFisier,
                c.CaleFisier,
                c.Status,
                c.CreatedAt
            })
            .ToListAsync();

        return Json(colete);
    }

    [HttpGet]
    public async Task<IActionResult> GetStats()
    {
        var stats = new
        {
            Total = await _db.AwbColete.CountAsync(),
            Pending = await _db.AwbColete.CountAsync(c => c.Status == "PENDING"),
            Livrat = await _db.AwbColete.CountAsync(c => c.Status == "LIVRAT"),
            Returnat = await _db.AwbColete.CountAsync(c => c.Status == "RETURNAT"),
            TotalRamburs = await _db.AwbColete.SumAsync(c => c.RambursRon),
            TotalGreutate = await _db.AwbColete.SumAsync(c => c.GreutateKg)
        };
        return Json(stats);
    }

    [HttpPost]
    [RequestSizeLimit(500_000_000)]
    public async Task<IActionResult> UploadPdfs(List<IFormFile> files)
    {
        if (files == null || files.Count == 0)
            return BadRequest("Nu au fost selectate fișiere.");

        var results = new List<object>();
        var uploadsPath = Path.Combine(_env.WebRootPath, "awb-pdfs");

        if (!Directory.Exists(uploadsPath))
        {
            try
            {
                Directory.CreateDirectory(uploadsPath);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"EROARE SERVER (PERMISIUNI): Nu pot crea folderul {uploadsPath}. Contactează adminul serverului (Plesk). Eroare: {ex.Message}");
            }
        }

        foreach (var file in files)
        {
            if (file.Length == 0 || !file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                results.Add(new { FileName = file.FileName, Success = false, Error = "Fișier invalid sau gol" });
                continue;
            }

            try
            {
                var fileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
                var filePath = Path.Combine(uploadsPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var (extractedData, debugInfo) = ExtractDataFromPdfWithDebug(filePath, file.FileName);

                var existing = await _db.AwbColete.FirstOrDefaultAsync(c => c.AwbCode == extractedData.AwbCode);
                if (existing != null)
                {
                    existing.Destinatar = extractedData.Destinatar;
                    existing.Observatii = extractedData.Observatii;
                    existing.RambursRon = extractedData.RambursRon;
                    existing.Telefon = extractedData.Telefon;
                    existing.Adresa = extractedData.Adresa;
                    existing.CodPostal = extractedData.CodPostal;
                    existing.GreutateKg = extractedData.GreutateKg;
                    existing.DataAwb = extractedData.DataAwb;
                    existing.Serviciu = extractedData.Serviciu;
                    existing.Expeditor = extractedData.Expeditor;
                    existing.CaleFisier = $"/awb-pdfs/{fileName}";
                    existing.UpdatedAt = DateTime.Now;

                    results.Add(new
                    {
                        FileName = file.FileName,
                        Success = true,
                        AwbCode = extractedData.AwbCode,
                        Ramburs = extractedData.RambursRon,
                        Action = "UPDATED",
                        Debug = debugInfo
                    });
                }
                else
                {
                    extractedData.CaleFisier = $"/awb-pdfs/{fileName}";
                    _db.AwbColete.Add(extractedData);

                    _db.AuditLogs.Add(new AuditLog
                    {
                        Action = "ADD_COLET",
                        EntityType = "COLET",
                        EntityInfo = $"AWB: {extractedData.AwbCode}, Destinatar: {extractedData.Destinatar}, Ramburs: {extractedData.RambursRon} RON"
                    });

                    results.Add(new
                    {
                        FileName = file.FileName,
                        Success = true,
                        AwbCode = extractedData.AwbCode,
                        Ramburs = extractedData.RambursRon,
                        Action = "ADDED",
                        Debug = debugInfo
                    });
                }
            }
            catch (UnauthorizedAccessException)
            {
                results.Add(new { FileName = file.FileName, Success = false, Error = "ACCES INTERZIS: Serverul nu are drepturi de scriere în folder." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Eroare la procesarea fișierului {FileName}", file.FileName);
                results.Add(new { FileName = file.FileName, Success = false, Error = ex.Message });
            }
        }

        await _db.SaveChangesAsync();

        return Json(new
        {
            ProcessedFiles = results.Count,
            SuccessCount = results.Count(r => ((dynamic)r).Success),
            Results = results
        });
    }

    private (AwbColet colet, object debugInfo) ExtractDataFromPdfWithDebug(string filePath, string originalFileName)
    {
        var colet = new AwbColet
        {
            NumeFisier = originalFileName,
            Curier = "CARGUS"
        };

        var debugLog = new List<string>();
        string textExtras = "";

        // 1. Încearcă iText (Metoda Location păstrează mai bine structura tabelară)
        try
        {
            using var reader = new PdfReader(filePath);
            using var document = new PdfDocument(reader);

            for (int i = 1; i <= document.GetNumberOfPages(); i++)
            {
                var page = document.GetPage(i);
                var strategy = new LocationTextExtractionStrategy();
                textExtras += PdfTextExtractor.GetTextFromPage(page, strategy);
            }
            debugLog.Add($"iText extras: {textExtras.Length} caractere");
        }
        catch (Exception ex)
        {
            debugLog.Add($"iText eroare: {ex.Message}");
        }

        // 2. Curățare text pentru regex
        textExtras = textExtras.Replace("\n", " ").Replace("\r", " ");
        textExtras = Regex.Replace(textExtras, @"\s+", " ");

        // 3. OCR Fallback
        if (string.IsNullOrWhiteSpace(textExtras) || textExtras.Length < 50)
        {
            debugLog.Add("iText insuficient, încercăm OCR...");
            try
            {
                textExtras = ExtractTextWithOcr(filePath, debugLog);
                textExtras = textExtras.Replace("\n", " ").Replace("\r", " ");
                textExtras = Regex.Replace(textExtras, @"\s+", " ");
            }
            catch (Exception ocrEx)
            {
                debugLog.Add("OCR a eșuat: " + ocrEx.Message);
            }
        }

        debugLog.Add($"RAW TEXT: {textExtras.Substring(0, Math.Min(1000, textExtras.Length))}");

        // === EXTRAGERE DATE ===

        // AWB
        var awbMatch = Regex.Match(textExtras, @"\b(117\d{7})\b");
        if (awbMatch.Success) colet.AwbCode = awbMatch.Groups[1].Value;

        // Destinatar
        var destMatch = Regex.Match(textExtras, @"Destinatar\s*:\s*(.*?)(?=\s*(?:Cod postal|Adresa|Telefon|Contact))", RegexOptions.IgnoreCase);
        if (destMatch.Success) colet.Destinatar = destMatch.Groups[1].Value.Trim();

        // Observații
        var obsMatch = Regex.Match(textExtras, @"Observatii\s*:\s*(.*?)(?=\s*(?:Nume curier|Motiv|Totul|$))", RegexOptions.IgnoreCase);
        if (obsMatch.Success) colet.Observatii = obsMatch.Groups[1].Value.Trim();

        // === RAMBURS ===
        var rambursPatterns = new[]
        {
            @"(\d+)[,\.](\d{2})\s+0[,\.]00", // Pattern Cargus: Suma | 0,00
            @"(\d+)[,\.](\d{2})\s+\d{1,3}[,\.]\d{2}",
            @"Cash\s*(\d+)[,\.](\d{2})",
            @"Ramburs.*?(\d+)[,\.](\d{2})\s*(?:RON|Lei)"
        };

        foreach (var pattern in rambursPatterns)
        {
            var matches = Regex.Matches(textExtras, pattern, RegexOptions.IgnoreCase);
            foreach (Match match in matches)
            {
                if (match.Success)
                {
                    string sumaStr = match.Groups[1].Value + "." + match.Groups[2].Value;
                    if (decimal.TryParse(sumaStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var suma))
                    {
                        if (suma > 0 && suma < 20000)
                        {
                            bool isStrictPattern = pattern.Contains("0[,,]00") || pattern.Contains("Cash") || pattern.Contains("Ramburs");
                            if (isStrictPattern || suma > 30)
                            {
                                colet.RambursRon = suma;
                                debugLog.Add($"✓ RAMBURS GĂSIT (Pattern: {pattern}): {suma} RON");
                                goto RambursFound;
                            }
                        }
                    }
                }
            }
        }
    RambursFound:;

        if (colet.RambursRon == 0) debugLog.Add("✗ Ramburs negăsit în text.");

        // ============================================
        // TELEFON (Logică actualizată pentru Destinatar)
        // ============================================

        // Găsim TOATE numerele de mobil din text
        var allPhoneMatches = Regex.Matches(textExtras, @"(07\d{8})");

        // Lista numerelor tale (expeditor) de IGNORAT
        var ignoredPhones = new[] { "0762603856", "0766365440" };

        bool phoneFound = false;
        foreach (Match match in allPhoneMatches)
        {
            string foundPhone = match.Value;

            // Verificăm dacă numărul este în lista celor de ignorat
            bool isMyPhone = false;
            foreach (var myPhone in ignoredPhones)
            {
                if (foundPhone.Contains(myPhone)) { isMyPhone = true; break; }
            }

            if (!isMyPhone)
            {
                // Este primul număr care NU e al expeditorului -> Presupunem că e al destinatarului
                colet.Telefon = foundPhone;
                debugLog.Add($"✓ Telefon Destinatar identificat: {foundPhone}");
                phoneFound = true;
                break;
            }
            else
            {
                debugLog.Add($"! Ignorat telefon expeditor (al tau): {foundPhone}");
            }
        }

        if (!phoneFound)
        {
            debugLog.Add("✗ Niciun telefon de destinatar găsit (toate erau ale expeditorului sau nu existau).");
        }

        // ============================================

        // Cod Postal
        var zipMatch = Regex.Match(textExtras, @"Cod postal\s*:\s*(\d{6})");
        if (zipMatch.Success) colet.CodPostal = zipMatch.Groups[1].Value;

        // Greutate
        var weightMatch = Regex.Match(textExtras, @"(\d+)\s+kg", RegexOptions.IgnoreCase);
        if (!weightMatch.Success) weightMatch = Regex.Match(textExtras, @"\d+\s+\d+\s+\d+\s+(\d+)\s+\d+\s+\d+\s+\d+\s+Inaltime");
        if (weightMatch.Success && decimal.TryParse(weightMatch.Groups[1].Value, out var weight)) colet.GreutateKg = weight;

        // Fallback la filename
        if (string.IsNullOrEmpty(colet.AwbCode) || string.IsNullOrEmpty(colet.Destinatar))
        {
            var filenameData = ExtractFromFilename(originalFileName);
            if (string.IsNullOrEmpty(colet.AwbCode)) colet.AwbCode = filenameData.AwbCode;
            if (string.IsNullOrEmpty(colet.Destinatar)) colet.Destinatar = filenameData.Destinatar;
            if (string.IsNullOrEmpty(colet.Observatii)) colet.Observatii = filenameData.Observatii;
        }

        var debugInfoObj = new
        {
            Log = debugLog,
            RambursFinal = colet.RambursRon
        };

        return (colet, debugInfoObj);
    }

    private string ExtractTextWithOcr(string pdfPath, List<string> debugLog)
    {
        var sb = new System.Text.StringBuilder();
        try
        {
            using var pdfStream = System.IO.File.OpenRead(pdfPath);
            var images = PDFtoImage.Conversion.ToImages(pdfStream);

            int pageNum = 0;
            foreach (var image in images)
            {
                pageNum++;
                var tempImagePath = Path.GetTempFileName() + ".png";
                try
                {
                    using (var fs = System.IO.File.OpenWrite(tempImagePath))
                    {
                        image.Encode(fs, SkiaSharp.SKEncodedImageFormat.Png, 100);
                    }
                    using var engine = new TesseractEngine(_tessdataPath, "eng", EngineMode.Default);
                    using var img = Pix.LoadFromFile(tempImagePath);
                    using var page = engine.Process(img);
                    sb.AppendLine(page.GetText());
                }
                finally
                {
                    if (System.IO.File.Exists(tempImagePath)) System.IO.File.Delete(tempImagePath);
                }
            }
        }
        catch (Exception ex)
        {
            debugLog.Add($"OCR eroare: {ex.Message}");
        }
        return sb.ToString();
    }

    private AwbColet ExtractFromFilename(string filename)
    {
        var colet = new AwbColet { NumeFisier = filename, Curier = "CARGUS" };
        var name = Path.GetFileNameWithoutExtension(filename);
        var awbMatch = Regex.Match(name, @"(117\d{7})");
        if (awbMatch.Success)
        {
            colet.AwbCode = awbMatch.Groups[1].Value;
            var parts = name.Split(colet.AwbCode);
            if (parts.Length >= 1) colet.Destinatar = parts[0].Trim('_', ' ').Replace('_', ' ');
            if (parts.Length >= 2) colet.Observatii = parts[1].Trim('_', ' ').Replace('_', ' ');
        }
        return colet;
    }

    [HttpPost]
    public async Task<IActionResult> UpdateStatus(int id, string status)
    {
        var colet = await _db.AwbColete.FindAsync(id);
        if (colet == null) return NotFound();
        colet.Status = status;
        colet.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> Delete(int id)
    {
        var colet = await _db.AwbColete.FindAsync(id);
        if (colet == null) return NotFound();
        if (!string.IsNullOrEmpty(colet.CaleFisier))
        {
            var filePath = Path.Combine(_env.WebRootPath, colet.CaleFisier.TrimStart('/'));
            if (System.IO.File.Exists(filePath)) System.IO.File.Delete(filePath);
        }
        _db.AwbColete.Remove(colet);
        await _db.SaveChangesAsync();
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> Clear()
    {
        var uploadsPath = Path.Combine(_env.WebRootPath, "awb-pdfs");
        if (System.IO.Directory.Exists(uploadsPath))
        {
            foreach (var file in System.IO.Directory.GetFiles(uploadsPath))
            {
                try { System.IO.File.Delete(file); } catch { }
            }
        }
        _db.AwbColete.RemoveRange(_db.AwbColete);
        await _db.SaveChangesAsync();
        return Json(new { success = true });
    }

    [HttpGet]
    public async Task<IActionResult> ExportExcel()
    {
        var colete = await _db.AwbColete.OrderByDescending(c => c.CreatedAt).ToListAsync();
        var csv = "AWB,Destinatar,Observatii,Ramburs RON,Telefon,Adresa,Cod Postal,Greutate,Data,Status\n";
        foreach (var c in colete) csv += $"\"{c.AwbCode}\",\"{c.Destinatar}\",\"{c.Observatii}\",{c.RambursRon},\"{c.Telefon}\",\"{c.Adresa}\",\"{c.CodPostal}\",{c.GreutateKg},\"{c.DataAwb}\",\"{c.Status}\"\n";
        var bytes = System.Text.Encoding.UTF8.GetPreamble().Concat(System.Text.Encoding.UTF8.GetBytes(csv)).ToArray();
        return File(bytes, "text/csv", $"colete_export_{DateTime.Now:yyyyMMdd_HHmmss}.csv");
    }
}