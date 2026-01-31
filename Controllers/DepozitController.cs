using Apacks.Depozit.Data;
using Apacks.Depozit.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Apacks.Depozit.Controllers;

public class DepozitController : Controller
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;

    public DepozitController(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    public IActionResult Index()
    {
        return View("DepozitIndex");
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var awbs = await _db.Awbs
            .Include(a => a.Media)
            .OrderByDescending(a => a.ScannedAt)
            .Select(a => new
            {
                a.Id,
                a.Code,
                a.Courier,
                a.ScannedAt,
                MediaCount = a.Media.Count,
                Media = a.Media.Select(m => new { m.Id, m.FileName, m.FilePath, m.MediaType }).ToList()
            })
            .ToListAsync();

        // Adaugă informațiile coletului pentru fiecare AWB
        var result = new List<object>();
        foreach (var awb in awbs)
        {
            var colet = await _db.AwbColete.FirstOrDefaultAsync(c => c.AwbCode == awb.Code);
            result.Add(new
            {
                awb.Id,
                awb.Code,
                awb.Courier,
                awb.ScannedAt,
                awb.MediaCount,
                awb.Media,
                ColetInfo = colet != null ? new
                {
                    colet.Destinatar,
                    colet.Observatii,
                    colet.RambursRon,
                    colet.GreutateKg,
                    colet.Telefon
                } : null
            });
        }

        return Json(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetColeteDePregatit()
    {
        var colete = await _db.AwbColete
            .Where(c => c.Status == "PENDING")
            .OrderBy(c => c.DataAwb)
            .ThenBy(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.AwbCode,
                c.Destinatar,
                c.Observatii,
                c.RambursRon,
                c.Telefon,
                c.GreutateKg,
                c.DataAwb,
                c.Status,
                c.CaleFisier,
                c.Curier
            })
            .ToListAsync();
        return Json(colete);
    }

    [HttpPost]
    public async Task<IActionResult> MarcheazaPregatit(int id)
    {
        var colet = await _db.AwbColete.FindAsync(id);
        if (colet == null) return NotFound();

        colet.Status = "LIVRAT";
        colet.UpdatedAt = DateTime.Now;

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "PREGATIT",
            EntityType = "COLET",
            EntityInfo = $"AWB: {colet.AwbCode}, Destinatar: {colet.Destinatar}"
        });

        await _db.SaveChangesAsync();
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> VerificaSiMarcheaza([FromBody] AwbRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.Code))
            return Json(new { found = false });

        var colet = await _db.AwbColete.FirstOrDefaultAsync(c =>
            c.AwbCode == request.Code && c.Status == "PENDING");

        if (colet != null)
        {
            colet.Status = "LIVRAT";
            colet.UpdatedAt = DateTime.Now;

            _db.AuditLogs.Add(new AuditLog
            {
                Action = "PREGATIT_AUTO",
                EntityType = "COLET",
                EntityInfo = $"AWB: {colet.AwbCode}, Destinatar: {colet.Destinatar} (scanat automat)"
            });

            await _db.SaveChangesAsync();

            return Json(new
            {
                found = true,
                marcat = true,
                awbCode = colet.AwbCode,
                destinatar = colet.Destinatar,
                observatii = colet.Observatii
            });
        }

        return Json(new { found = false, marcat = false });
    }

    [HttpGet]
    public async Task<IActionResult> GetColetePregatieLaData(string? data = null)
    {
        DateTime targetDate;

        if (string.IsNullOrEmpty(data))
            targetDate = DateTime.Today;
        else if (!DateTime.TryParse(data, out targetDate))
            targetDate = DateTime.Today;

        var startOfDay = targetDate.Date;
        var endOfDay = targetDate.Date.AddDays(1);

        var colete = await _db.AwbColete
            .Where(c => c.Status == "LIVRAT" && c.UpdatedAt >= startOfDay && c.UpdatedAt < endOfDay)
            .OrderByDescending(c => c.UpdatedAt)
            .Select(c => new
            {
                c.Id,
                c.AwbCode,
                c.Destinatar,
                c.Observatii,
                c.RambursRon,
                c.Telefon,
                c.GreutateKg,
                c.DataAwb,
                c.Curier,
                PregatitLa = c.UpdatedAt
            })
            .ToListAsync();

        return Json(new
        {
            data = targetDate.ToString("yyyy-MM-dd"),
            dataFormatata = targetDate.ToString("dd.MM.yyyy"),
            total = colete.Count,
            totalRamburs = colete.Sum(c => c.RambursRon),
            colete = colete
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetDateDisponibile()
    {
        var dates = await _db.AwbColete
            .Where(c => c.Status == "LIVRAT")
            .Select(c => c.UpdatedAt.Date)
            .Distinct()
            .OrderByDescending(d => d)
            .Take(30)
            .ToListAsync();

        var result = dates.Select(d => new
        {
            value = d.ToString("yyyy-MM-dd"),
            label = d.ToString("dd.MM.yyyy"),
            isToday = d.Date == DateTime.Today
        }).ToList();

        if (!result.Any(r => r.isToday))
        {
            result.Insert(0, new
            {
                value = DateTime.Today.ToString("yyyy-MM-dd"),
                label = DateTime.Today.ToString("dd.MM.yyyy") + " (Azi)",
                isToday = true
            });
        }

        return Json(result);
    }

    [HttpPost]
    public async Task<IActionResult> RevineLaPending(int id)
    {
        var colet = await _db.AwbColete.FindAsync(id);
        if (colet == null) return NotFound();

        colet.Status = "PENDING";
        colet.UpdatedAt = DateTime.Now;

        var awbScanat = await _db.Awbs
            .Include(a => a.Media)
            .FirstOrDefaultAsync(a => a.Code == colet.AwbCode);

        if (awbScanat != null)
        {
            foreach (var media in awbScanat.Media)
            {
                var filePath = Path.Combine(_env.WebRootPath, media.FilePath.TrimStart('/'));
                if (System.IO.File.Exists(filePath))
                    System.IO.File.Delete(filePath);
            }
            _db.Awbs.Remove(awbScanat);
        }

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "REVENIT_PENDING",
            EntityType = "COLET",
            EntityInfo = $"AWB: {colet.AwbCode}, Destinatar: {colet.Destinatar} (anulat manual)"
        });

        await _db.SaveChangesAsync();
        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] AwbRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.Code))
            return BadRequest(new { error = true, message = "Cod AWB invalid" });

        var existing = await _db.Awbs.FirstOrDefaultAsync(a => a.Code == request.Code);
        if (existing != null)
        {
            return Json(new
            {
                error = true,
                message = "AWB-ul există deja în sistem!",
                existingCode = request.Code,
                scannedAt = existing.ScannedAt
            });
        }

        var awb = new Awb
        {
            Code = request.Code,
            Courier = request.Courier ?? "CARGUS",
            ScannedAt = DateTime.Now
        };
        _db.Awbs.Add(awb);

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "ADD",
            EntityType = "AWB",
            EntityInfo = $"Cod: {request.Code}, Curier: {request.Courier}"
        });

        await _db.SaveChangesAsync();

        return await GetAll();
    }

    [HttpPost]
    public async Task<IActionResult> Remove([FromBody] AwbRequest request)
    {
        var awb = await _db.Awbs
            .Include(a => a.Media)
            .FirstOrDefaultAsync(a => a.Code == request.Code);

        if (awb != null)
        {
            var colet = await _db.AwbColete.FirstOrDefaultAsync(c => c.AwbCode == request.Code && c.Status == "LIVRAT");
            if (colet != null)
            {
                colet.Status = "PENDING";
                colet.UpdatedAt = DateTime.Now;

                _db.AuditLogs.Add(new AuditLog
                {
                    Action = "REVENIT_PENDING",
                    EntityType = "COLET",
                    EntityInfo = $"AWB: {colet.AwbCode}, Destinatar: {colet.Destinatar} (anulat din scanare)"
                });
            }

            foreach (var media in awb.Media)
            {
                var filePath = Path.Combine(_env.WebRootPath, media.FilePath.TrimStart('/'));
                if (System.IO.File.Exists(filePath))
                    System.IO.File.Delete(filePath);
            }

            _db.AuditLogs.Add(new AuditLog
            {
                Action = "DELETE",
                EntityType = "AWB",
                EntityInfo = $"Cod: {awb.Code}, Curier: {awb.Courier}, Media: {awb.Media.Count} fișiere"
            });

            _db.Awbs.Remove(awb);
            await _db.SaveChangesAsync();
        }
        return await GetAll();
    }

    [HttpPost]
    public async Task<IActionResult> Clear()
    {
        var allAwbs = await _db.Awbs.Include(a => a.Media).ToListAsync();

        foreach (var awb in allAwbs)
        {
            foreach (var media in awb.Media)
            {
                var filePath = Path.Combine(_env.WebRootPath, media.FilePath.TrimStart('/'));
                if (System.IO.File.Exists(filePath))
                    System.IO.File.Delete(filePath);
            }
        }

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "CLEAR_ALL",
            EntityType = "AWB",
            EntityInfo = $"Șterse {allAwbs.Count} AWB-uri"
        });

        _db.Awbs.RemoveRange(allAwbs);
        await _db.SaveChangesAsync();
        return Json(new List<object>());
    }

    [HttpPost]
    [RequestSizeLimit(100_000_000)]
    public async Task<IActionResult> UploadMedia(int awbId, List<IFormFile> files)
    {
        try
        {
            var awb = await _db.Awbs.Include(a => a.Media).FirstOrDefaultAsync(a => a.Id == awbId);
            if (awb == null)
                return NotFound("AWB negăsit");

            if (awb.Media.Count + files.Count > 10)
                return BadRequest($"Maxim 10 fișiere per AWB. Ai deja {awb.Media.Count}.");

            var uploadsRoot = Path.Combine(_env.WebRootPath, "uploads");
            if (!Directory.Exists(uploadsRoot))
                Directory.CreateDirectory(uploadsRoot);

            var uploadPath = Path.Combine(uploadsRoot, awbId.ToString());
            if (!Directory.Exists(uploadPath))
                Directory.CreateDirectory(uploadPath);

            foreach (var file in files)
            {
                if (file.Length == 0) continue;

                var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                var filePath = Path.Combine(uploadPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var mediaType = file.ContentType.StartsWith("video") ? "video" : "image";

                var media = new AwbMedia
                {
                    AwbId = awbId,
                    FileName = file.FileName,
                    FilePath = $"/uploads/{awbId}/{fileName}",
                    MediaType = mediaType,
                    UploadedAt = DateTime.Now
                };

                _db.AwbMedia.Add(media);

                _db.AuditLogs.Add(new AuditLog
                {
                    Action = "ADD_MEDIA",
                    EntityType = "MEDIA",
                    EntityInfo = $"AWB: {awb.Code}, Fișier: {file.FileName}, Tip: {mediaType}"
                });
            }

            await _db.SaveChangesAsync();
            return await GetAll();
        }
        catch (Exception ex)
        {
            return BadRequest($"Eroare: {ex.Message}");
        }
    }

    [HttpPost]
    public async Task<IActionResult> DeleteMedia(int mediaId)
    {
        var media = await _db.AwbMedia.Include(m => m.Awb).FirstOrDefaultAsync(m => m.Id == mediaId);
        if (media == null)
            return NotFound();

        var filePath = Path.Combine(_env.WebRootPath, media.FilePath.TrimStart('/'));
        if (System.IO.File.Exists(filePath))
            System.IO.File.Delete(filePath);

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "DELETE_MEDIA",
            EntityType = "MEDIA",
            EntityInfo = $"AWB: {media.Awb.Code}, Fișier: {media.FileName}"
        });

        _db.AwbMedia.Remove(media);
        await _db.SaveChangesAsync();

        return await GetAll();
    }

    public class AwbRequest
    {
        public string Code { get; set; } = "";
        public string Courier { get; set; } = "CARGUS";
    }
}