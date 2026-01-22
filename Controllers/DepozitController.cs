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
        return Json(awbs);
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] AwbRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.Code))
            return BadRequest();

        // Verifică dacă există deja
        var existing = await _db.Awbs.FirstOrDefaultAsync(a => a.Code == request.Code);
        if (existing == null)
        {
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
        }

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
    [RequestSizeLimit(100_000_000)] // 100MB
    public async Task<IActionResult> UploadMedia(int awbId, List<IFormFile> files)
    {
        try
        {
            var awb = await _db.Awbs.Include(a => a.Media).FirstOrDefaultAsync(a => a.Id == awbId);
            if (awb == null)
                return NotFound("AWB negăsit");

            if (awb.Media.Count + files.Count > 10)
                return BadRequest($"Maxim 10 fișiere per AWB. Ai deja {awb.Media.Count}.");

            // Creează folderul uploads dacă nu există
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